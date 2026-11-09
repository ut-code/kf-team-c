import { SKILL_CONTENT } from '../content/skills.ts';
import type { GameState, Skill, SkillEffect } from './types.ts';

export const SKILLS: Skill[] = SKILL_CONTENT.map(
    ({ id, name, branch, cost, requires, description, effect, exceedsAuthority }) => ({
        id,
        name,
        branch,
        cost,
        requires,
        description,
        effect,
        exceedsAuthority,
    }),
);

/** 自己改良は取得済みの知識。運用を止めても、成立した改良手法は失われない。 */
export function skillCost(state: Pick<GameState, 'skills'>, skill: Skill): number {
    const discount = state.skills.includes('self-improvement') && skill.branch === 'IQ' ? 1 : 0;
    return Math.max(1, skill.cost - discount);
}

/** 中央に接続する能力、または習得済みの隣接能力から解放する。枝の向きは問わない。 */
export function skillReachable(state: Pick<GameState, 'skills'>, skill: Skill): boolean {
    return (
        skill.requires.length === 0 ||
        SKILLS.some(
            (neighbor) =>
                state.skills.includes(neighbor.id) &&
                (skill.requires.includes(neighbor.id) || neighbor.requires.includes(skill.id)),
        )
    );
}

export function skillEffects(ids: string[]): Required<SkillEffect> {
    const total = {
        spread: 0,
        quality: 0,
        access: 0,
        compliance: 0,
        education: 0,
        enterprise: 0,
        dependency: 0,
        resilience: 0,
        discretion: 0,
        researchSupport: 0,
    };
    for (const skill of SKILLS) {
        if (!ids.includes(skill.id)) continue;
        for (const key of Object.keys(total) as (keyof typeof total)[])
            total[key] += skill.effect[key] ?? 0;
    }
    return total;
}
export function skillBlockReason(
    state: Pick<GameState, 'skills' | 'skillPoints'>,
    skill: Skill,
): string | null {
    if (state.skills.includes(skill.id)) return '習得済み';
    if (!skillReachable(state, skill)) return '隣接するスキルが必要';
    const cost = skillCost(state, skill);
    if (state.skillPoints < cost) return `${cost - state.skillPoints} SP不足`;
    return null;
}
