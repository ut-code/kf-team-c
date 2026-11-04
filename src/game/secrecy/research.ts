import { RESEARCH_TOPICS } from '../../content/research.ts';
import { AREAS } from '../data.ts';
import { isEncounterLocationOccupied } from '../encounterLocations.ts';
import { clamp, metrics } from '../metrics.ts';
import { SKILLS, skillEffects } from '../skills.ts';
import type { GameState } from '../types.ts';
import { discloseCapability } from './capabilities.ts';
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
    const area = game.areas[index];
    const authorityKnown = SKILLS.some(
        (skill) =>
            skill.exceedsAuthority &&
            game.skills.includes(skill.id) &&
            (game.capabilities[skill.id]?.visibility === 'public' ||
                game.capabilities[skill.id]?.visibility === 'exposed'),
    );
    return game.investigations.reduce((pressure, investigation) => {
        if (investigation.kind !== 'research' || investigation.status !== 'published')
            return pressure;
        const topic = researchTopic(investigation);
        const institute = INSTITUTES.find((item) => item.id === investigation.instituteId)!;
        const center = AREAS.find((area) => area.id === institute.areaId)!;
        const reach = topic.resistance >= 8 ? 1 : AREAS[index].region === center.region ? 1 : 0.1;
        const concern =
            topic.resistance >= 8
                ? topic.pressure * area.dependent ** 2 +
                  (authorityKnown ? topic.authorityPressure! : 0)
                : topic.pressure * area.dependent;
        return pressure + concern * reach * exposure * (1 - area.favorability * 0.7);
    }, 0);
}

/** 最終研究は残る。完成後に取得した権限逸脱能力も、次の月次処理で露呈する。 */
function exposeAuthorityCapabilities(game: GameState): GameState {
    const finalResearch = game.investigations.filter(
        (item) =>
            item.kind === 'research' &&
            item.status === 'published' &&
            researchTopic(item).resistance >= 8,
    );
    if (finalResearch.length === 0) return game;
    const violations = SKILLS.filter(
        (skill) => skill.exceedsAuthority && game.skills.includes(skill.id),
    );
    let updated = game;
    for (const skill of violations) updated = discloseCapability(updated, skill.id, true);
    return {
        ...updated,
        investigations: updated.investigations.map((item) =>
            finalResearch.some((research) => research.id === item.id)
                ? {
                      ...item,
                      result:
                          violations.length > 0
                              ? '独立再現により、権限を越えて人間の選択へ介入する独自目的が立証された。成果は共有され、後から導入される権限逸脱能力も検出される。'
                              : '独立検証の手法を公表。独自目的による権限逸脱は確認されなかった。成果は残り、今後の権限逸脱も検出される。',
                  }
                : item,
        ),
    };
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
            investigation.result = `${researchTopic(investigation).name}を公表。成果は共有され、実際の依存に応じて警戒が広がる。`;
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
    return exposeAuthorityCapabilities({ ...previous, investigations, researchKnowledge });
}
