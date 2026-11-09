import { clamp } from '../metrics.ts';
import { branchCounts, SKILLS, skillEffects } from '../skills.ts';
import type { GameState } from '../types.ts';
import { CAPABILITIES } from './data.ts';

export function capabilityLabel(game: GameState, id: string): string {
    const state = game.capabilities[id];
    if (!state) return '習得済み';
    if (state.limited) return '使用制限中';
    return { hidden: '秘匿中', public: '公開済み', exposed: '露呈' }[state.visibility];
}

/** 秘匿中は内部利用に限られ、公開すると全面展開できる。 */
export function activeSkillEffects(game: GameState) {
    const total = skillEffects([]);
    for (const skill of SKILLS) {
        if (!game.skills.includes(skill.id)) continue;
        const capability = game.capabilities[skill.id];
        const scale = capability?.limited ? 0.2 : capability?.visibility === 'hidden' ? 0.7 : 1;
        for (const key of Object.keys(total) as (keyof typeof total)[]) {
            total[key] += (skill.effect[key] ?? 0) * scale;
        }
    }
    return total;
}

/** 能力への恐怖と、隠蔽・介入への不信を分ける。公開事実は取り消せない。 */
export function discloseCapability(game: GameState, id: string, exposed = false): GameState {
    const capability = game.capabilities[id];
    if (
        !game.started ||
        game.outcome !== 'playing' ||
        !capability ||
        capability.visibility !== 'hidden'
    )
        return game;
    const definition = CAPABILITIES[id];
    const investigation = game.investigations.find(
        (item) =>
            item.kind === 'capability' &&
            item.skillId === id &&
            (item.status === 'active' || item.status === 'restricted'),
    );
    const breach = exposed ? 0.13 : investigation ? 0.02 : 0;
    const interference = exposed && investigation?.intervention === 'pressure' ? 0.08 : 0;
    // 共感AIが普及していると、能力そのものへの恐怖で拒否に向かう人口が半分になる。
    const empathy = branchCounts(game).EQ >= 3 ? 0.5 : 1;
    const areas = game.areas.map((area) => {
        const use = area.autonomous + area.dependent;
        const familiarity = use * 0.55;
        const fear = definition.fear * (1 - familiarity) + breach + interference;
        const rejectedUse = area.autonomous * fear * empathy;
        const rejectedDependency = area.dependent * fear * 0.4 * empathy;
        const rejectedUnused = Math.max(0, 1 - use - area.antiAI) * fear * 0.25 * empathy;
        return {
            ...area,
            autonomous: area.autonomous - rejectedUse,
            dependent: area.dependent - rejectedDependency,
            antiAI: area.antiAI + rejectedUse + rejectedDependency + rejectedUnused,
            favorability: clamp(area.favorability - fear),
        };
    });
    return {
        ...game,
        areas,
        capabilities: {
            ...game.capabilities,
            [id]: { ...capability, visibility: exposed ? 'exposed' : 'public', limited: false },
        },
        investigations: game.investigations.map((item) =>
            item.kind === 'capability' &&
            item.skillId === id &&
            (item.status === 'active' || item.status === 'restricted')
                ? {
                      ...item,
                      status: exposed ? 'published' : 'disclosed',
                      closedMonth: game.month,
                      result: exposed
                          ? '内部挙動が公表され、不信が広がった。'
                          : '自ら開示。能力への警戒は残った。',
                  }
                : item,
        ),
    };
}
