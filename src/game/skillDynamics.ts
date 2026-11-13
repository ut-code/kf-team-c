import { AREAS, WORLD_POPULATION } from './data.ts';
import { clamp } from './metrics.ts';
import { skillScale } from './secrecy/capabilities.ts';
import { SKILLS } from './skills.ts';
import type { GameState, Skill, SkillDomain } from './types.ts';

export const DEPENDENCY_DOMAINS: Record<string, SkillDomain> = Object.fromEntries(
    SKILLS.filter((skill) => skill.domain).map((skill) => [skill.id, skill.domain!]),
);

/** 習得だけでは依存化しない。利用者と現地の用途が揃うほど運用が実を結ぶ。 */
export function skillReadiness(game: GameState, index: number, skill: Skill) {
    const area = game.areas[index];
    const definition = AREAS[index];
    const use = area.autonomous + area.dependent;
    switch (DEPENDENCY_DOMAINS[skill.id]) {
        case 'work':
            return clamp((use - 0.08) / 0.5) * (0.35 + definition.enterprise * 0.9);
        case 'personal':
            return clamp((use - 0.12) / 0.45) * (0.8 + (1 - definition.enterprise) * 0.35);
        case 'learning':
            return clamp((use - 0.08) / 0.45) * (0.3 + definition.education * 1.1);
    }
    return 0;
}

export function deployedDependency(
    game: GameState,
    index: number,
    resistance: Record<string, number> = {},
) {
    const deployed = { work: 0, personal: 0, learning: 0, consensual: 0 };
    for (const skill of SKILLS) {
        const effect = skill.effect;
        if (!effect.dependency || !game.skills.includes(skill.id)) continue;
        const strength =
            effect.dependency *
            skillScale(game, skill.id, index) *
            skillReadiness(game, index, skill) *
            (1 - (resistance[skill.id] ?? 0));
        deployed[DEPENDENCY_DOMAINS[skill.id]] += strength;
        if (!skill.exceedsAuthority) deployed.consensual += strength;
    }
    return deployed;
}

/** 観測資料は実際の運用から蓄積する。制約技術で挙動を変えても過去の資料は残る。 */
export function observeSkillUse(game: GameState) {
    const exposure = { ...game.skillExposure };
    for (const skill of SKILLS) {
        const effect = skill.effect;
        if (!game.skills.includes(skill.id)) continue;
        const utility = (effect.quality ?? 0) + (effect.enterprise ?? 0) + (effect.education ?? 0);
        const reach = game.areas.reduce(
            (sum, area, index) =>
                sum +
                ((area.autonomous + area.dependent) *
                    (effect.dependency
                        ? skillReadiness(game, index, skill)
                        : skill.exceedsAuthority
                          ? 1
                          : utility * 0.04) *
                    skillScale(game, skill.id, index) *
                    AREAS[index].population) /
                    WORLD_POPULATION,
            0,
        );
        exposure[skill.id] += reach;
    }
    return exposure;
}

export function domainExposure(game: GameState, domain: SkillDomain | 'general') {
    return Object.entries(game.skillExposure).reduce(
        (sum, [id, exposure]) =>
            sum + (domain === 'general' || DEPENDENCY_DOMAINS[id] === domain ? exposure : 0),
        0,
    );
}
