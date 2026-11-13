import { RESEARCH_TOPICS } from '../../content/research.ts';
import { MONTH_MS } from '../data.ts';
import { isEncounterLocationOccupied } from '../encounterLocations.ts';
import { metrics } from '../metrics.ts';
import type { GameState } from '../types.ts';
import { INSTITUTES } from './data.ts';

export const RESEARCH_CITY_REST = Math.ceil(75_000 / MONTH_MS);
export const RESEARCH_START_INTERVAL = Math.ceil(35_000 / MONTH_MS);

/** 背景研究は表示せず、普及の規模と依存・介入の問題に応じて並行調査を増やす。 */
export function investigationLimit(game: GameState) {
    const world = metrics(game);
    const dangerous = Object.entries(game.capabilities).some(
        ([id, capability]) =>
            ['companion', 'autonomous', 'backbone', 'mind-control', 'sns-intervention'].includes(
                id,
            ) && capability.evidence >= 5,
    );
    if (
        world.dependent >= 0.35 ||
        world.antiAI >= 0.12 ||
        Object.values(game.capabilities).some((item) => item.visibility === 'exposed')
    )
        return 3;
    // 広い利用基盤があれば、管理技術の研究と現場の問題調査を並行して行える。
    if (world.adoption >= 0.15 || world.dependent >= 0.12 || dangerous) return 2;
    return 1;
}

export function canStartInvestigation(game: GameState) {
    const ongoing = game.investigations.filter((item) => item.status === 'active');
    return (
        ongoing.length < investigationLimit(game) &&
        game.investigations.every(
            (item) =>
                (item.kind === 'research' &&
                    RESEARCH_TOPICS.find((topic) => topic.id === item.researchId)!.background) ||
                game.month - item.startedMonth >= RESEARCH_START_INTERVAL,
        )
    );
}

/** 同じ都市の別機関も休止対象とし、完了直後のマーカー再出現を防ぐ。 */
export function researchSiteAvailable(game: GameState, instituteId: string) {
    const institute = INSTITUTES.find((item) => item.id === instituteId)!;
    if (isEncounterLocationOccupied(game, institute)) return false;
    return game.investigations.every((item) => {
        if (
            item.kind === 'research' &&
            RESEARCH_TOPICS.find((topic) => topic.id === item.researchId)!.background
        )
            return true;
        const other = INSTITUTES.find((entry) => entry.id === item.instituteId)!;
        const sameCity =
            Math.abs(institute.longitude - other.longitude) < 2 &&
            Math.abs(institute.latitude - other.latitude) < 2;
        if (!sameCity) return true;
        if (item.status === 'active' || item.status === 'restricted') return false;
        return (
            item.closedMonth !== undefined && game.month - item.closedMonth >= RESEARCH_CITY_REST
        );
    });
}
