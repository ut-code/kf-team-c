import { AREAS } from '../data.ts';
import { clamp } from '../metrics.ts';
import type { GameState } from '../types.ts';
import { activeSkillEffects } from './capabilities.ts';
import { INSTITUTES } from './data.ts';
import type { ScientificInvestigation } from './types.ts';

/** 独立した研究基盤。利用自体は研究を助けるが、高依存では検証能力を失う。 */
export function researchCapacity(game: GameState, instituteId: string) {
    const institute = INSTITUTES.find((item) => item.id === instituteId)!;
    const index = AREAS.findIndex((area) => area.id === institute.areaId);
    const area = game.areas[index];
    const support = activeSkillEffects(game).researchSupport;
    // 一般利用者の依存が半数を超えただけでは、独立した研究組織まで機能不全にしない。
    const independence = clamp((0.95 - area.dependent) / 0.12);
    return independence ** (1 + support * 4) * (1 + support * (area.autonomous + area.dependent));
}

export function projectCapacity(game: GameState, project: ScientificInvestigation) {
    return Math.min(
        1.8,
        researchCapacity(game, project.instituteId) +
            project.collaborators.reduce((sum, id) => sum + researchCapacity(game, id) * 0.25, 0),
    );
}

/** 停止案件は保持し、稼働可能な先着3件に研究枠を回す。 */
export function runningResearchIds(game: GameState) {
    return new Set(
        game.investigations
            .filter(
                (item) =>
                    item.kind === 'research' &&
                    item.status === 'active' &&
                    projectCapacity(game, item) > 0,
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
                    researchCapacity(game, item.instituteId) > 0,
            )
            .slice(0, 2)
            .map((item) => item.id),
    );
}
