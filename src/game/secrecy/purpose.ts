import { AREAS } from '../data.ts';
import { clamp } from '../metrics.ts';
import { skillReadiness } from '../skillDynamics.ts';
import { SKILLS } from '../skills.ts';
import type { GameState } from '../types.ts';
import { skillScale } from './capabilities.ts';
import { INSTITUTES } from './data.ts';
import { researchHasFindings } from './researchTargets.ts';

/** 個別能力の解析とは別に、蓄積した行動資料と複数機関の検証から目的に迫る。 */
export function intentResearchReady(game: GameState) {
    const traces = game.investigations.filter(
        (project) =>
            project.kind === 'research' &&
            project.researchId === 'decision-tracing' &&
            researchHasFindings(project),
    );
    const institutions = new Set(
        traces.flatMap((project) =>
            project.kind === 'research' ? [project.instituteId, ...project.collaborators] : [],
        ),
    );
    const regions = new Set(
        [...institutions].map(
            (id) =>
                AREAS.find(
                    (area) =>
                        area.id === INSTITUTES.find((institute) => institute.id === id)!.areaId,
                )!.region,
        ),
    );
    const observedDelegation = SKILLS.filter(
        (skill) => skill.effect.dependency || skill.exceedsAuthority,
    ).reduce((sum, skill) => sum + game.skillExposure[skill.id], 0);
    return traces.length > 0 && regions.size >= 2 && observedDelegation >= 20;
}

/** 支配目的が判明しても、既に判断権や社会基盤を委ねた人々は容易には離れられない。 */
export function intentLockIn(game: GameState, index: number, resistance: Record<string, number>) {
    const area = game.areas[index];
    const dependency = clamp((area.dependent - 0.75) / 0.2);
    const deepDependency = dependency * dependency * (3 - 2 * dependency);
    const infrastructure: Record<string, number> = {
        integration: 0.15,
        decision: 0.15,
        public: 0.65,
        swarm: 0.65,
        curriculum: 0.2,
        backbone: 1,
    };
    const embedded = SKILLS.reduce((sum, skill) => {
        if (!game.skills.includes(skill.id) || !infrastructure[skill.id]) return sum;
        const established = 1 - Math.exp(-game.skillExposure[skill.id] / 12);
        return (
            sum +
            infrastructure[skill.id] *
                established *
                skillScale(game, skill.id) *
                (1 - (resistance[skill.id] ?? 0)) *
                skillReadiness(game, index, skill)
        );
    }, 0);
    const socialDependence = clamp((embedded * (area.autonomous + area.dependent)) / 1.2);
    return 1 - (1 - deepDependency) * (1 - socialDependence * 0.85);
}
