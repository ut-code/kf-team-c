import { SKILL_CONTENT } from '../content/skills.ts';
import type { GameState, Skill, SkillEffect } from './types.ts';

export const SKILLS: Skill[] = SKILL_CONTENT.map(
    ({
        id,
        name,
        branch,
        cost,
        requires,
        description,
        effect,
        exceedsAuthority,
        developmentMonths,
        domain,
        restrains,
    }) => ({
        id,
        name,
        branch,
        cost,
        requires,
        description,
        effect,
        exceedsAuthority,
        developmentMonths,
        domain,
        restrains,
    }),
);

/** 自己改良は取得済みの知識。成立した改良手法は以後の開発に残る。 */
export function skillCost(
    state: Pick<GameState, 'skills' | 'developmentProgress'>,
    skill: Skill,
): number {
    const discount =
        state.skills.includes('self-improvement') &&
        state.developmentProgress['self-improvement'] >= 1 &&
        skill.branch === 'IQ'
            ? 1
            : 0;
    return Math.max(1, skill.cost - discount);
}

/** 基礎技術、または前提技術の開発完了で解放する。 */
export function skillReachable(
    state: Pick<GameState, 'skills' | 'developmentProgress'>,
    skill: Skill,
): boolean {
    return (
        skill.requires.length === 0 ||
        skill.requires.some((id) => state.skills.includes(id) && state.developmentProgress[id] >= 1)
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
        trust: 0,
        reconciliation: 0,
    };
    for (const skill of SKILLS) {
        if (!ids.includes(skill.id)) continue;
        for (const key of Object.keys(total) as (keyof typeof total)[])
            total[key] += skill.effect[key] ?? 0;
    }
    return total;
}
export function skillBlockReason(
    state: Pick<GameState, 'skills' | 'skillPoints' | 'developmentProgress'>,
    skill: Skill,
): string | null {
    if (state.skills.includes(skill.id))
        return state.developmentProgress[skill.id] < 1 ? '開発中' : '開発済み';
    if (!skillReachable(state, skill))
        return state.skills.includes(skill.requires[0])
            ? '前提スキルの完成待ち'
            : '前提スキルの開発が必要';
    const cost = skillCost(state, skill);
    if (state.skillPoints < cost) return `${cost - state.skillPoints} SP不足`;
    return null;
}
