import { clamp } from '../metrics.ts';
import { SKILLS, skillEffects } from '../skills.ts';
import type { GameState } from '../types.ts';
import { CAPABILITIES } from './data.ts';

const RESTRAINT_SKILLS = SKILLS.filter((skill) => skill.restrains);

/** 開発は自動で進む。制約技術は将来の挙動を抑えるが、開発履歴と証拠は残す。 */
export function skillScale(game: GameState, id: string) {
    if (!game.skills.includes(id)) return 0;
    let scale = game.developmentProgress[id];
    for (const skill of RESTRAINT_SKILLS) {
        const restraint = skill.restrains![id];
        if (game.skills.includes(skill.id) && restraint)
            scale *= 1 - restraint * game.developmentProgress[skill.id];
    }
    return scale;
}

export function advanceSkillDevelopment(game: GameState) {
    const progress = { ...game.developmentProgress };
    for (const id of game.skills) {
        if (progress[id] >= 1) continue;
        const skill = SKILLS.find((item) => item.id === id)!;
        progress[id] = Math.min(
            1,
            (Math.round(progress[id] * skill.developmentMonths) + 1) / skill.developmentMonths,
        );
    }
    return progress;
}

export function capabilityLabel(game: GameState, id: string): string {
    if (game.developmentProgress[id] < 1)
        return `開発中 ${Math.floor(game.developmentProgress[id] * 100)}%`;
    return '開発済み';
}

export function activeSkillEffects(game: GameState) {
    const total = skillEffects([]);
    for (const skill of SKILLS) {
        if (!game.skills.includes(skill.id)) continue;
        const scale = skillScale(game, skill.id);
        const effect = skill.effect;
        for (const key of Object.keys(total) as (keyof typeof total)[]) {
            total[key] += (effect[key] ?? 0) * scale;
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
    const harmful = SKILLS.find((skill) => skill.id === id)!.exceedsAuthority;
    const breach = exposed ? (harmful ? 0.13 : 0.025) : investigation ? 0.02 : 0;
    const areas = game.areas.map((area) => {
        const use = area.autonomous + area.dependent;
        const familiarity = use * 0.55;
        const fear = definition.fear * (1 - familiarity) + breach;
        const rejectedUse = area.autonomous * fear;
        // 不信だけでは判断能力を取り戻さない。依存の解消は独立研究・回復で扱う。
        const rejectedDependency = 0;
        const rejectedUnused = Math.max(0, 1 - use - area.antiAI) * fear * 0.25;
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
            [id]: { ...capability, visibility: exposed ? 'exposed' : 'public' },
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
