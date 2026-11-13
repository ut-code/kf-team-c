import { AREAS, WORLD_POPULATION } from '../data.ts';
import { skillReadiness } from '../skillDynamics.ts';
import { SKILLS } from '../skills.ts';
import type { GameState, Skill } from '../types.ts';
import { skillScale } from './capabilities.ts';
import { publishedResearchEffects, researchTopic } from './research.ts';
import { researchTarget } from './researchTargets.ts';
import type { ScientificInvestigation } from './types.ts';

/** 研究名ではなく、対象となる取得済み能力への実際の対策を集計する。 */
export function researchImpact(game: GameState, project: ScientificInvestigation) {
    const target = researchTarget(project);
    const skills = SKILLS.filter(
        (skill) => target.skills.includes(skill.id) && game.skills.includes(skill.id),
    );
    const coverage = project.coverage.reduce(
        (sum, value, index) => sum + (value * AREAS[index].population) / WORLD_POPULATION,
        0,
    );
    return {
        skills,
        targeted: target.skills.length > 0,
        suppression: skillSuppression(game, skills),
        coverage,
        strength: researchTopic(project).countermeasures[target.id] ?? 0,
    };
}

export function skillSuppression(game: GameState, skills: Skill[]) {
    let potential = 0,
        prevented = 0;
    for (let i = 0; i < AREAS.length; i++) {
        const resistance = publishedResearchEffects(game, i).resistance;
        for (const skill of skills) {
            const strength =
                (skillScale(game, skill.id) *
                    (skill.effect.dependency ?? 1) *
                    (skill.domain ? skillReadiness(game, i, skill) : 1) *
                    AREAS[i].population) /
                WORLD_POPULATION;
            potential += strength;
            prevented += strength * (resistance[skill.id] ?? 0);
        }
    }
    return potential > 0 ? prevented / potential : 0;
}
