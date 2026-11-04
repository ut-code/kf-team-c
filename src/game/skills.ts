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
    if (skill.requires.some((id) => !state.skills.includes(id))) return '前提スキルが必要';
    if (state.skillPoints < skill.cost) return `${skill.cost - state.skillPoints} SP不足`;
    return null;
}
