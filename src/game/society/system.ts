import { AREAS } from '../data.ts';
import { encounterLocation, isEncounterLocationOccupied } from '../encounterLocations.ts';
import { clamp, metrics } from '../metrics.ts';
import { branchCounts } from '../skills.ts';
import type { GameState } from '../types.ts';
import { CONVERSATIONS } from './conversations.ts';
import { WORLD_EVENTS } from './events.ts';
import { SOCIAL_STRATEGIES, STRATEGY_SWITCH_COST } from './strategies.ts';
import type {
    EncounterChoice,
    EncounterDefinition,
    EncounterLottery,
    EncounterState,
    SocietyEffect,
} from './types.ts';

export const ENCOUNTERS = [...WORLD_EVENTS, ...CONVERSATIONS].sort(
    (a, b) => a.trigger.month - b.trigger.month,
);
export function encounterDefinition(id: string) {
    return ENCOUNTERS.find((definition) => definition.id === id);
}
export function encounterChoices(definition: EncounterDefinition, encounter: EncounterState) {
    return definition.kind === 'event'
        ? (definition.choices ?? [])
        : (definition.dialogue?.find((node) => node.id === encounter.nodeId)?.choices ?? []);
}
export function affectedAreas(definition: EncounterDefinition, scope: SocietyEffect['scope']) {
    const center = AREAS.findIndex((area) => area.id === definition.areaId);
    if (scope === 'world') return AREAS.map((_, index) => index);
    if (scope === 'local') return [center];
    const target = AREAS[center];
    return AREAS.flatMap((area, index) => {
        const dx = Math.min(
            Math.abs(area.longitude - target.longitude),
            360 - Math.abs(area.longitude - target.longitude),
        );
        const distance = Math.hypot(
            dx * Math.cos(((area.latitude + target.latitude) * Math.PI) / 360),
            area.latitude - target.latitude,
        );
        return index === center || distance < 22 ? [index] : [];
    });
}

/** シード・月・キーから決定論的な 0 以上 1 未満の値を作る。同一シードなら同一の結果になる。 */
export function random01(seed: number, month: number, key: string): number {
    let hash = Math.imul(seed, 2654435761) | 0;
    const text = `${month}:${key}`;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619) | 0;
    }
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 2246822519) | 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489917) | 0;
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
}

/** ギャンブル選択肢の当り確率と、当り外れの効果を決める。盤面から決定論的に出る。 */
export function resolveLottery(
    state: GameState,
    encounter: EncounterState,
    choice: EncounterChoice,
    lottery: EncounterLottery,
) {
    let chance = lottery.chance ?? 0.5;
    if (lottery.formula === 'favor-swing') {
        const summary = metrics(state);
        const counts = branchCounts(state);
        chance =
            0.5 + (summary.favorability - summary.antiAI) * 0.6 + (counts.IQ + counts.EQ) * 0.015;
    } else if (lottery.formula === 'empathy-calm') {
        chance = 0.35 + branchCounts(state).EQ * 0.08;
    }
    chance = clamp(chance, 0.05, 0.95);
    const roll = random01(
        state.seed,
        state.month,
        `${encounter.id}:${encounter.nodeId ?? 'event'}:${choice.id}`,
    );
    return { outcome: roll < chance ? lottery.win : lottery.lose, chance };
}

/** Population changes are transfers between exclusive groups, never new population. */
export function applySocietyEffects(
    state: GameState,
    definition: EncounterDefinition,
    effects: SocietyEffect[],
    audience: 'everyone' | 'users' = 'everyone',
): GameState {
    const areas = state.areas.map((area) => ({ ...area }));
    let skillPoints = state.skillPoints;
    for (const effect of effects) {
        skillPoints = Math.max(0, skillPoints + (effect.skillPoints ?? 0));
        for (const index of affectedAreas(definition, effect.scope)) {
            const area = areas[index];
            if (!area) continue;
            // 未対応への反応は、その地域で実際に利用している人口に応じて生じる。
            const exposure =
                audience === 'users'
                    ? state.areas[index].autonomous + state.areas[index].dependent
                    : 1;
            area.favorability = clamp(area.favorability + (effect.favorability ?? 0) * exposure);
            // Decreases return people to the unused group before increases consume it.
            for (const key of ['antiAI', 'autonomous', 'dependent'] as const) {
                const delta = (effect[key] ?? 0) * exposure;
                if (delta < 0) {
                    const removed = Math.min(area[key], -delta);
                    area[key] -= removed;
                    if (key === 'dependent') area.autonomous += removed;
                }
            }
            for (const key of ['antiAI', 'autonomous', 'dependent'] as const) {
                const delta = (effect[key] ?? 0) * exposure;
                if (delta <= 0) continue;
                if (key === 'dependent') {
                    const converted = Math.min(area.autonomous, delta);
                    area.autonomous -= converted;
                    area.dependent += converted;
                } else {
                    const available = Math.max(
                        0,
                        1 - area.autonomous - area.dependent - area.antiAI,
                    );
                    const fromUnused = Math.min(available, delta);
                    area[key] += fromUnused;
                    if (key === 'antiAI') {
                        const fromUse = Math.min(area.autonomous, delta - fromUnused);
                        area.autonomous -= fromUse;
                        area.antiAI += fromUse;
                        const fromDependency = Math.min(
                            area.dependent,
                            delta - fromUnused - fromUse,
                        );
                        area.dependent -= fromDependency;
                        area.antiAI += fromDependency;
                    }
                }
            }
        }
    }
    return { ...state, areas, skillPoints };
}

export function chooseEncounter(
    state: GameState,
    encounterId: string,
    choiceId: string,
): GameState {
    const encounter = state.encounters.find((item) => item.id === encounterId);
    const definition = encounterDefinition(encounterId);
    if (!encounter || !definition || encounter.status !== 'pending' || state.outcome !== 'playing')
        return state;
    const choice = encounterChoices(definition, encounter).find((item) => item.id === choiceId);
    if (!choice || state.skillPoints < (choice.cost ?? 0)) return state;
    const nextNode = definition.dialogue?.find((node) => node.id === choice.next);
    const lottery =
        choice.lottery && definition.kind === 'event'
            ? resolveLottery(state, encounter, choice, choice.lottery)
            : null;
    const result = lottery ? lottery.outcome.result : choice.result;
    const effects = lottery ? lottery.outcome.effects : choice.effects;
    const updated = applySocietyEffects(state, definition, effects);
    updated.skillPoints -= choice.cost ?? 0;
    updated.encounters = state.encounters.map((item) =>
        item.id !== encounterId
            ? item
            : {
                  ...item,
                  status: nextNode ? 'pending' : 'resolved',
                  nodeId: nextNode?.id,
                  result,
                  messages: [
                      ...item.messages,
                      {
                          id: `${encounterId}:${encounter.nodeId ?? 'event'}:${choice.id}:player`,
                          role: 'player',
                          text: choice.label,
                      },
                      {
                          id: `${encounterId}:${encounter.nodeId ?? 'event'}:${choice.id}:result`,
                          role: 'system',
                          text: result,
                      },
                      ...(nextNode
                          ? [
                                {
                                    id: `${encounterId}:${nextNode.id}:contact`,
                                    role: 'contact' as const,
                                    text: nextNode.message,
                                },
                            ]
                          : []),
                  ],
              },
    );
    return updated;
}

export function selectSocialStrategy(state: GameState, id: string): GameState {
    if (
        state.outcome !== 'playing' ||
        id === state.socialStrategy ||
        !SOCIAL_STRATEGIES.some((strategy) => strategy.id === id) ||
        state.skillPoints < (id === 'listening' ? 0 : STRATEGY_SWITCH_COST)
    )
        return state;
    return {
        ...state,
        socialStrategy: id,
        skillPoints: state.skillPoints - (id === 'listening' ? 0 : STRATEGY_SWITCH_COST),
    };
}

/** Expiration happens once in game months; closed panels never stop deadlines. */
export function advanceSociety(previous: GameState): GameState {
    let state = previous;
    for (const encounter of previous.encounters) {
        if (encounter.status !== 'pending' || state.month < encounter.deadline) continue;
        const definition = encounterDefinition(encounter.id);
        if (!definition) continue;
        state = applySocietyEffects(state, definition, definition.ignored.effects, 'users');
        state = {
            ...state,
            encounters: state.encounters.map((item) =>
                item.id !== encounter.id
                    ? item
                    : {
                          ...item,
                          status: 'expired',
                          result: definition.ignored.description,
                          messages: [
                              ...item.messages,
                              {
                                  id: `${encounter.id}:expired`,
                                  role: 'system',
                                  text: `期限切れ：${definition.ignored.description}`,
                              },
                          ],
                      },
            ),
        };
    }
    if (
        state.month - state.lastEncounterMonth < 6 ||
        state.encounters.filter((item) => item.status === 'pending').length >= 3
    )
        return state;
    const summary = metrics(state);
    const counts = branchCounts(state);
    const next = ENCOUNTERS.find((definition) => {
        const local = state.areas[AREAS.findIndex((area) => area.id === definition.areaId)];
        const trigger = definition.trigger;
        return (
            !state.encounters.some((item) => item.id === definition.id) &&
            !isEncounterLocationOccupied(state, encounterLocation(definition)) &&
            state.month >= trigger.month &&
            local.autonomous + local.dependent >= (trigger.localAdoption ?? 0) &&
            summary.adoption >= (trigger.adoption ?? 0) &&
            summary.dependent >= (trigger.dependent ?? 0) &&
            summary.antiAI >= (trigger.antiAI ?? 0) &&
            counts.IQ >= (trigger.iqSkills ?? 0) &&
            counts.EQ >= (trigger.eqSkills ?? 0) &&
            counts.SYSTEM >= (trigger.systemSkills ?? 0) &&
            counts.EQ <= (trigger.eqSkillsMax ?? Infinity) &&
            counts.SYSTEM <= (trigger.systemSkillsMax ?? Infinity) &&
            summary.favorability >= (trigger.favorability ?? 0)
        );
    });
    if (!next) return state;
    const opening = next.dialogue?.[0];
    return {
        ...state,
        lastEncounterMonth: state.month,
        encounters: [
            ...state.encounters,
            {
                id: next.id,
                openedMonth: state.month,
                deadline: state.month + next.duration,
                status: 'pending',
                nodeId: opening?.id,
                messages: opening
                    ? [
                          {
                              id: `${next.id}:${opening.id}:contact`,
                              role: 'contact',
                              text: opening.message,
                          },
                      ]
                    : [],
            },
        ],
    };
}
