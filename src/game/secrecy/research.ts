import { RESEARCH_TOPICS } from '../../content/research.ts';
import { AREAS } from '../data.ts';
import { isEncounterLocationOccupied } from '../encounterLocations.ts';
import { clamp, metrics } from '../metrics.ts';
import { skillEffects } from '../skills.ts';
import type { GameState } from '../types.ts';
import { INSTITUTES } from './data.ts';
import { researchCapacity, runningResearchIds } from './researchCapacity.ts';
import type { ScientificInvestigation } from './types.ts';

export { RESEARCH_TOPICS } from '../../content/research.ts';

export function researchTopic(investigation: ScientificInvestigation) {
    return RESEARCH_TOPICS.find((topic) => topic.id === investigation.researchId)!;
}

export function researchRate(
    game: GameState,
    investigation: ScientificInvestigation,
    unimpeded = false,
) {
    if (
        !unimpeded &&
        investigation.status === 'active' &&
        game.investigations.some((item) => item.id === investigation.id) &&
        !runningResearchIds(game).has(investigation.id)
    )
        return 0;
    const institute = INSTITUTES.find((item) => item.id === investigation.instituteId)!;
    const index = AREAS.findIndex((area) => area.id === institute.areaId);
    const area = game.areas[index];
    const topic = researchTopic(investigation);
    const publications = game.investigations.filter(
        (item) => item.kind === 'research' && item.status === 'published',
    ).length;
    const effect = skillEffects(game.skills);
    const slowdown =
        investigation.intervention === 'pressure'
            ? area.dependent * 0.7
            : investigation.intervention === 'partnership'
              ? clamp(effect.compliance * 0.3 + effect.discretion, 0, 0.5)
              : 0;
    // 共同検証・独立再現へ進むほど、一機関への介入が効かなくなる。
    return (
        ((1.4 +
            AREAS[index].education * 0.4 +
            (area.autonomous + area.dependent) * 0.4 +
            publications * 0.15) *
            (unimpeded
                ? 1
                : researchCapacity(game, investigation.instituteId) *
                  (1 - slowdown / (1 + topic.resistance))) *
            100) /
        topic.work
    );
}

export function publishedResearchPressure(game: GameState, index: number) {
    const exposure = clamp(metrics(game).adoption * 5);
    return game.investigations.reduce((pressure, investigation) => {
        if (investigation.kind !== 'research' || investigation.status !== 'published')
            return pressure;
        const topic = researchTopic(investigation);
        const institute = INSTITUTES.find((item) => item.id === investigation.instituteId)!;
        const center = AREAS.find((area) => area.id === institute.areaId)!;
        const reach = topic.resistance >= 8 ? 1 : AREAS[index].region === center.region ? 1 : 0.1;
        return pressure + topic.pressure * reach * exposure;
    }, 0);
}

/** 研究能力と発表済みの成果を蓄積する。ゲームの経過月による解禁は行わない。 */
export function advanceResearch(previous: GameState): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    const investigations = previous.investigations.map((item) => ({ ...item }));
    const researchKnowledge = { ...previous.researchKnowledge };
    const publications = investigations.filter(
        (item) => item.kind === 'research' && item.status === 'published',
    ).length;
    for (const institute of INSTITUTES) {
        const index = AREAS.findIndex((area) => area.id === institute.areaId);
        const use = previous.areas[index].autonomous + previous.areas[index].dependent;
        researchKnowledge[institute.id] +=
            (0.35 + AREAS[index].education * 0.35 + use * 0.25 + publications * 0.025) *
            institute.researchCapacity *
            researchCapacity(previous, institute.id);
    }
    for (const investigation of investigations) {
        if (investigation.kind !== 'research' || investigation.status !== 'active') continue;
        investigation.progress = Math.min(
            100,
            investigation.progress + researchRate(previous, investigation),
        );
        if (investigation.progress >= 100) {
            investigation.status = 'published';
            investigation.closedMonth = previous.month;
            investigation.result = `${researchTopic(investigation).name}を公表。成果は共有され、研究の土台と反AIの根拠として残る。`;
        }
    }
    let active = runningResearchIds({ ...previous, investigations }).size;
    for (const institute of INSTITUTES) {
        if (active >= 3) break;
        if (isEncounterLocationOccupied({ ...previous, investigations }, institute)) continue;
        if (researchCapacity(previous, institute.id) === 0) continue;
        if (
            investigations.some(
                (item) =>
                    item.kind === 'research' &&
                    item.instituteId === institute.id &&
                    item.status === 'active',
            )
        )
            continue;
        const next = RESEARCH_TOPICS.find(
            (topic, tier) =>
                researchKnowledge[institute.id] >= topic.knowledge &&
                !investigations.some(
                    (item) =>
                        item.kind === 'research' &&
                        item.instituteId === institute.id &&
                        item.researchId === topic.id,
                ) &&
                (tier === 0 ||
                    investigations.some(
                        (item) =>
                            item.kind === 'research' &&
                            item.instituteId === institute.id &&
                            item.researchId === RESEARCH_TOPICS[tier - 1].id &&
                            item.status === 'published',
                    )),
        );
        if (!next) continue;
        investigations.push({
            kind: 'research',
            id: `research:${institute.id}:${next.id}`,
            researchId: next.id,
            instituteId: institute.id,
            progress: 0,
            startedMonth: previous.month,
            status: 'active',
            intervention: 'none',
        });
        active++;
        break;
    }
    return { ...previous, investigations, researchKnowledge };
}
