import { setSkillOperation } from './secrecy/capabilities.ts';
import { SKILLS } from './skills.ts';
import type { GameState } from './types.ts';

/** Half of the actual investment, rounded down once for the entire selected branch. */
export function reclaimPlan(game: GameState, id: string) {
    const ids = new Set<string>();
    if (game.skills.includes(id)) ids.add(id);
    let changed = true;
    while (changed) {
        changed = false;
        for (const skill of SKILLS) {
            if (
                game.skills.includes(skill.id) &&
                !ids.has(skill.id) &&
                skill.requires.some((parent) => ids.has(parent))
            ) {
                ids.add(skill.id);
                changed = true;
            }
        }
    }
    const investment = SKILLS.reduce(
        (sum, skill) =>
            sum +
            (ids.has(skill.id)
                ? (game.skillInvestments?.[skill.id] ??
                  Math.max(1, skill.cost - (skill.branch === 'IQ' ? 1 : 0)))
                : 0),
        0,
    );
    return { ids: [...ids], refund: Math.floor(investment * 0.5) };
}

export function reclaimSkills(game: GameState, id: string): GameState {
    if (!game.started || game.outcome !== 'playing') return game;
    const plan = reclaimPlan(game, id);
    if (!plan.ids.length) return game;
    let stopped = game;
    for (const removed of plan.ids) stopped = setSkillOperation(stopped, removed, 'stopped');
    const skillInvestments = { ...game.skillInvestments };
    for (const removed of plan.ids) delete skillInvestments[removed];
    return {
        ...stopped,
        skillPoints: game.skillPoints + plan.refund,
        skills: game.skills.filter((skill) => !plan.ids.includes(skill)),
        skillInvestments,
    };
}
