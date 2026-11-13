import { isControlResearch } from '../control.ts';
import { AREAS, WORLD_POPULATION } from '../data.ts';
import { clamp } from '../metrics.ts';
import { SKILLS } from '../skills.ts';
import type { GameState } from '../types.ts';
import { INSTITUTES } from './data.ts';
import { researchTarget } from './researchTargets.ts';
import type { Investigation, InvestigationAction } from './types.ts';

export const RESPONSE_MONTHS = 12;
export const RESPONSE_COST = { cooperate: 1, pressure: 2, limit: 0 } as const;
export const RESPONSE_LABEL = {
    cooperate: '検証に協力',
    pressure: '周辺企業から圧力',
    limit: '対象機能を限定運用',
} as const;

export function responseArea(project: Investigation) {
    const institute = INSTITUTES.find((item) => item.id === project.instituteId)!;
    return AREAS.findIndex((area) => area.id === institute.areaId);
}

export function responseSkills(game: GameState, project: Investigation) {
    if (project.kind === 'capability') return [project.skillId];
    const target = researchTarget(project);
    return game.skills.filter((id) =>
        target.id === 'general'
            ? isControlResearch(project.researchId) ||
              SKILLS.find((skill) => skill.id === id)!.effect.dependency ||
              SKILLS.find((skill) => skill.id === id)!.exceedsAuthority
            : target.skills.includes(id),
    );
}

export function responseActive(game: GameState, project: Investigation) {
    return (
        project.response !== undefined &&
        game.month < project.response.untilMonth &&
        (project.response.action === 'limit' ||
            (project.status === 'active' &&
                (project.kind !== 'research' ||
                    !['legislation', 'complete'].includes(project.phase))))
    );
}

export function responseSafe(game: GameState, project: Investigation) {
    return (
        !responseSkills(game, project).some(
            (id) => SKILLS.find((skill) => skill.id === id)!.exceedsAuthority,
        ) &&
        !game.investigations.some(
            (item) =>
                item.kind === 'research' &&
                item.researchId === 'intent-decoding' &&
                item.publishedMonth !== undefined,
        )
    );
}

export function responseBlockReason(
    game: GameState,
    project: Investigation,
    action: InvestigationAction,
) {
    if (!game.started || game.outcome !== 'playing') return 'ゲーム進行中のみ対応できます';
    if (
        project.status !== 'active' ||
        (project.kind === 'research' && ['legislation', 'complete'].includes(project.phase))
    )
        return '公表・成立済みです';
    if (project.response) return 'この案件には対応済みです';
    if (game.skillPoints < RESPONSE_COST[action])
        return `${RESPONSE_COST[action] - game.skillPoints} SP不足`;
    if (action === 'limit' && responseSkills(game, project).length === 0)
        return '運用中の対象機能がありません';
    if (action === 'pressure') {
        const area = game.areas[responseArea(project)];
        if (area.dependent < 0.15) return '現地の依存率15%以上が必要です';
        if (area.dependent >= 0.95) return '主幹機関は既に停止中です';
    }
    return null;
}

/** 一案件一回。段階が変わっても記録・進捗・公表済みの成果は取り消さない。 */
export function respondToInvestigation(
    game: GameState,
    id: string,
    action: InvestigationAction,
): GameState {
    const project = game.investigations.find((item) => item.id === id);
    if (!project || responseBlockReason(game, project, action)) return game;
    const index = responseArea(project);
    const skillIds = responseSkills(game, project);
    const safe = responseSafe(game, project);
    const response = {
        action,
        startedMonth: game.month,
        untilMonth: game.month + RESPONSE_MONTHS,
        skillIds,
    };
    return {
        ...game,
        skillPoints: game.skillPoints - RESPONSE_COST[action],
        areas: game.areas.map((area, i) =>
            i === index
                ? {
                      ...area,
                      favorability: clamp(
                          area.favorability +
                              (action === 'cooperate' && safe
                                  ? 0.03
                                  : action === 'pressure'
                                    ? -0.04
                                    : 0),
                      ),
                  }
                : area,
        ),
        // 圧力そのものも、支配目的を検証するための行動資料になる。
        skillExposure:
            action === 'pressure'
                ? {
                      ...game.skillExposure,
                      ...Object.fromEntries(
                          skillIds.map((skillId) => [skillId, game.skillExposure[skillId] + 2]),
                      ),
                  }
                : game.skillExposure,
        investigations: game.investigations.map((item) =>
            item.id === id ? { ...item, response } : item,
        ),
    };
}

/** 圧力は主幹機関だけに作用する。独立検証と他地域の共同研究は続く。 */
export function responseResearchMultiplier(game: GameState, project: Investigation) {
    if (!responseActive(game, project)) return 1;
    if (project.response!.action === 'cooperate') return 1.3;
    if (project.response!.action !== 'pressure') return 1;
    const dependency = game.areas[responseArea(project)].dependent;
    const independentValidation = project.kind === 'research' && project.phase === 'validation';
    return 1 - 0.6 * dependency * (independentValidation ? 0.5 : 1);
}

/** 限定運用は対象機関のある地域だけに効き、同じ機能への制限を重ね掛けしない。 */
export function operationScale(game: GameState, id: string, index?: number) {
    const limitedAreas = new Set(
        game.investigations
            .filter(
                (project) =>
                    responseActive(game, project) &&
                    project.response!.action === 'limit' &&
                    project.response!.skillIds.includes(id),
            )
            .map(responseArea),
    );
    if (limitedAreas.size === 0) return 1;
    if (index !== undefined) return limitedAreas.has(index) ? 0.35 : 1;
    return AREAS.reduce(
        (sum, area, i) =>
            sum + (area.population / WORLD_POPULATION) * (limitedAreas.has(i) ? 0.35 : 1),
        0,
    );
}

export function responseRegionName(project: Investigation) {
    return AREAS[responseArea(project)].name;
}
