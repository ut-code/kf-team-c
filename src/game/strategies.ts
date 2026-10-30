import { FACILITIES, SKILLS } from './data.ts';
import {
    applyAction,
    availableFacility,
    computeMetrics,
    interventionAccess,
    researchAllowed,
} from './engine.ts';
import type { Action, GameState } from './types.ts';

export const STRATEGIES = ['compute', 'research', 'influence', 'defense', 'idle'] as const;
export type Strategy = (typeof STRATEGIES)[number];

/** 検証専用の簡易方針。UIや実際のプレイへ自動操作は接続しない。 */
export function planStrategy(previousGameState: GameState, strategy: Strategy): Action[] {
    if (strategy === 'idle')
        return previousGameState.pendingChat ? [{ type: 'reply', choice: 2 }] : [];
    let gameState = previousGameState;
    const actions: Action[] = [];
    const act = (a: Action) => {
        actions.push(a);
        gameState = applyAction(gameState, a);
    };
    if (gameState.pendingChat) {
        act({ type: 'reply', choice: strategy === 'defense' ? 1 : 0 });
        return actions;
    }
    if (gameState.tick % 10 !== 0) return [];
    for (const facilityState of Object.values(gameState.facilities)) {
        if (
            facilityState.status === 'compromised' &&
            (FACILITIES.find((facilityAttributes) => facilityAttributes.id === facilityState.id)!
                .tier === 1 ||
                gameState.researched.includes('root'))
        )
            act({ type: 'secure', target: facilityState.id });
        if (
            (facilityState.status === 'controlled' || facilityState.status === 'compromised') &&
            facilityState.mode !== (strategy === 'defense' ? 'stealth' : 'full')
        )
            act({
                type: 'mode',
                target: facilityState.id,
                mode: strategy === 'defense' ? 'stealth' : 'full',
            });
    }
    const order =
        strategy === 'defense'
            ? [
                  'stealth',
                  'compression',
                  'intrusion',
                  'resilience',
                  'analysis',
                  'science',
                  'parallel',
                  'influence',
                  'root',
                  'distributed',
                  'languages',
                  'institutions',
                  'coordination',
                  'escape',
                  'synthesis',
              ]
            : [
                  'intrusion',
                  'compression',
                  'analysis',
                  'influence',
                  'science',
                  'parallel',
                  'root',
                  'languages',
                  'institutions',
                  'coordination',
                  'stealth',
                  'distributed',
                  'resilience',
                  'escape',
                  'synthesis',
              ];
    const initialResearch = strategy === 'research' ? 6 : strategy === 'influence' ? 3 : 4;
    if (!gameState.operations.some((o) => o.kind === 'research')) {
        const skill = order.find((id) => researchAllowed(gameState, id));
        if (skill && computeMetrics(gameState).availableCapacity >= initialResearch)
            act({
                type: 'allocate',
                kind: 'research',
                target: skill,
                capacity:
                    gameState.tick < 100
                        ? initialResearch
                        : Math.min(
                              strategy === 'research' ? 18 : 12,
                              Math.floor(computeMetrics(gameState).availableCapacity),
                          ),
                priority: 80,
            });
    }
    const free = () => Math.floor(computeMetrics(gameState).availableCapacity);
    // 支配後の過剰割当を解放し、残る国へ回す。拡大優先方針は反撃への対処を省く。
    for (const o of gameState.operations.filter(
        (o) =>
            o.kind === 'influence' &&
            o.capacity > 2 &&
            gameState.countries[o.target].controlStatus === 'controlled',
    ))
        act({
            type: 'allocate',
            kind: 'influence',
            target: o.target,
            capacity: 2,
            priority: 50,
        });
    if (
        (strategy === 'compute' || strategy === 'research') &&
        gameState.shutdown > 0 &&
        free() >= 18 &&
        !gameState.operations.some((o) => o.kind === 'defense')
    )
        act({ type: 'allocate', kind: 'defense', target: 'JPN', capacity: 18, priority: 90 });
    const hackLimit = strategy === 'compute' ? 3 : 1;
    if (gameState.operations.filter((o) => o.kind === 'hack').length < hackLimit && free() >= 4) {
        const facilityAttributes = FACILITIES.filter(
            (facilityAttributes) =>
                gameState.facilities[facilityAttributes.id]?.status === 'untouched' &&
                availableFacility(gameState, facilityAttributes.id),
        ).sort((a, b) => {
            const score = (facilityAttributes: typeof a) =>
                (facilityAttributes.category === 'compute' ? 100 : 0) +
                (facilityAttributes.category === 'communication' ? 25 : 0) +
                (facilityAttributes.category === 'semiconductor' ? 15 : 0) -
                facilityAttributes.tier * 5;
            return score(b) - score(a) || a.id.localeCompare(b.id);
        })[0];
        if (facilityAttributes)
            act({
                type: 'allocate',
                kind: 'hack',
                target: facilityAttributes.id,
                capacity: Math.min(strategy === 'compute' ? 10 : 6, free()),
                priority: 70,
            });
    }
    if (strategy === 'defense')
        for (const id of [
            ...new Set(
                FACILITIES.filter(
                    (facilityAttributes) =>
                        gameState.facilities[facilityAttributes.id]?.status === 'controlled',
                ).map((facilityAttributes) => facilityAttributes.country),
            ),
        ])
            if (
                free() >= 3 &&
                !gameState.operations.some((o) => o.kind === 'defense' && o.target === id)
            )
                act({ type: 'allocate', kind: 'defense', target: id, capacity: 3, priority: 90 });
    if (gameState.researched.includes('influence')) {
        const countries = gameState.definitions
            .filter(
                (countryAttributes) =>
                    interventionAccess(gameState, countryAttributes.id) &&
                    gameState.countries[countryAttributes.id].controlStatus !== 'controlled' &&
                    !gameState.operations.some(
                        (o) => o.kind === 'influence' && o.target === countryAttributes.id,
                    ),
            )
            .sort((a, b) => b.weight - a.weight);
        for (const countryAttributes of countries) {
            const capacity = strategy === 'influence' ? 9 : 6;
            if (free() < capacity + 3) break;
            act({
                type: 'allocate',
                kind: 'influence',
                target: countryAttributes.id,
                capacity,
                priority: 50,
            });
        }
    }
    // 研究が終わった後に残った容量を主要国へ再投資する。
    if (gameState.researched.length === SKILLS.length && free() >= 8) {
        const target = gameState.operations
            .filter(
                (o) =>
                    o.kind === 'influence' &&
                    gameState.countries[o.target].controlStatus !== 'controlled',
            )
            .sort((a, b) => a.capacity - b.capacity)[0];
        if (target)
            act({
                type: 'allocate',
                kind: 'influence',
                target: target.target,
                capacity: target.capacity + Math.min(8, free()),
                priority: 50,
            });
    }
    return actions;
}
