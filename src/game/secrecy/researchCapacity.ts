import { AREAS } from '../data.ts';
import { clamp } from '../metrics.ts';
import type { GameState } from '../types.ts';
import { activeSkillEffects } from './capabilities.ts';
import { INSTITUTES } from './data.ts';

/** 独立した研究基盤。利用自体は研究を助けるが、高依存では検証能力を失う。 */
export function researchCapacity(game: GameState, instituteId: string) {
    const institute = INSTITUTES.find((item) => item.id === instituteId)!;
    const index = AREAS.findIndex((area) => area.id === institute.areaId);
    const area = game.areas[index];
    const support = activeSkillEffects(game).researchSupport;
    const independence = clamp((0.95 - area.dependent) / 0.45);
    return independence ** (1 + support * 4) * (1 + support * (area.autonomous + area.dependent));
}

/** 停止案件は保持し、稼働可能な先着3件に研究枠を回す。 */
export function runningResearchIds(game: GameState) {
    return new Set(
        game.investigations
            .filter(
                (item) =>
                    item.kind === 'research' &&
                    item.status === 'active' &&
                    researchCapacity(game, item.instituteId) > 0,
            )
            .slice(0, 3)
            .map((item) => item.id),
    );
}

/** 能力調査も、停止案件で他地域の稼働枠を塞がない。 */
export function runningCapabilityIds(game: GameState) {
    return new Set(
        game.investigations
            .filter(
                (item) =>
                    item.kind === 'capability' &&
                    item.status === 'active' &&
                    !game.stoppedSkills.includes(item.skillId) &&
                    !game.capabilities[item.skillId]?.limited &&
                    researchCapacity(game, item.instituteId) > 0,
            )
            .slice(0, 2)
            .map((item) => item.id),
    );
}
