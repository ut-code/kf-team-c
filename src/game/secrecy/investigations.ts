import { AREAS } from '../data.ts';
import { SKILLS } from '../skills.ts';
import type { GameState } from '../types.ts';
import { discloseCapability, skillScale } from './capabilities.ts';
import { INSTITUTES } from './data.ts';
import { researchRate } from './research.ts';
import { researchCapacity, runningCapabilityIds } from './researchCapacity.ts';
import { responseResearchMultiplier } from './responses.ts';
import { canStartInvestigation, researchSiteAvailable } from './scheduling.ts';
import type { Investigation } from './types.ts';

export function instituteFor(investigation: Investigation) {
    return INSTITUTES.find((item) => item.id === investigation.instituteId)!;
}

export function instituteArea(investigation: Investigation) {
    return AREAS.findIndex((area) => area.id === instituteFor(investigation).areaId);
}

/** 周辺企業への依存が強いほど、公表をためらう経済的圧力が生まれる。 */
export function regionalDependencyMetrics(game: GameState, investigation: Investigation) {
    const center = AREAS[instituteArea(investigation)];
    return AREAS.reduce(
        (summary, area, index) => {
            if (area.region === center.region) {
                summary.population += area.population;
                summary.dependent += game.areas[index].dependent * area.population;
            }
            return summary;
        },
        { population: 0, dependent: 0 },
    );
}

export function regionalDependency(game: GameState, investigation: Investigation) {
    const summary = regionalDependencyMetrics(game, investigation);
    return summary.population > 0 ? summary.dependent / summary.population : 0;
}

/** unimpeded は速度表示の100%基準（研究支援・依存・介入を除く）。 */
export function investigationRate(
    game: GameState,
    investigation: Investigation,
    unimpeded = false,
) {
    if (investigation.kind === 'research') return researchRate(game, investigation, unimpeded);
    if (
        !unimpeded &&
        investigation.status === 'active' &&
        game.investigations.some((item) => item.id === investigation.id) &&
        !runningCapabilityIds(game).has(investigation.id)
    )
        return 0;
    const index = instituteArea(investigation);
    const area = game.areas[index];
    const materials = area.autonomous + area.dependent;
    return (
        Math.max(0.45, 1.1 + materials * 1.1 + AREAS[index].education * 0.5) *
        (unimpeded
            ? 1
            : researchCapacity(game, investigation.instituteId) *
              responseResearchMultiplier(game, investigation))
    );
}

export function advanceInvestigations(previous: GameState): GameState {
    let game = {
        ...previous,
        capabilities: { ...previous.capabilities },
        investigations: previous.investigations.map((item) => ({ ...item })),
    };
    for (const investigation of game.investigations) {
        if (
            investigation.kind !== 'capability' ||
            (investigation.status !== 'active' && investigation.status !== 'restricted')
        )
            continue;
        investigation.status = 'active';
        investigation.progress = Math.min(
            100,
            investigation.progress + investigationRate(game, investigation),
        );
        if (investigation.progress >= 100)
            game = discloseCapability(game, investigation.skillId, true);
    }
    const use =
        game.areas.reduce((sum, area) => sum + area.autonomous + area.dependent, 0) / AREAS.length;
    for (const [id, capability] of Object.entries(game.capabilities)) {
        if (capability.visibility !== 'hidden' || skillScale(game, id) <= 0.2) continue;
        // 普及と上位研究の活用が、外部から観測できる証拠を増やす。
        const successors = SKILLS.filter(
            (skill) =>
                game.skills.includes(skill.id) &&
                skill.requires.includes(id) &&
                skillScale(game, skill.id) > 0.2,
        ).length;
        game.capabilities[id] = {
            ...capability,
            evidence: Math.min(10, capability.evidence + use * (1 + successors * 0.25)),
        };
    }
    if (!canStartInvestigation(game)) return game;
    const candidate = Object.entries(game.capabilities).find(([id, capability]) => {
        return (
            capability.visibility === 'hidden' &&
            skillScale(game, id) > 0.2 &&
            capability.evidence >= 10 &&
            (SKILLS.find((skill) => skill.id === id)!.exceedsAuthority ||
                game.areas.some((area) => area.dependent >= 0.05)) &&
            !game.investigations.some((item) => item.kind === 'capability' && item.skillId === id)
        );
    });
    if (!candidate) return game;
    const [skillId] = candidate;
    const available = INSTITUTES.filter(
        (institute) =>
            researchSiteAvailable(game, institute.id) &&
            researchCapacity(game, institute.id) > 0 &&
            !game.investigations.some(
                (item) =>
                    item.kind === 'capability' &&
                    item.status === 'active' &&
                    instituteFor(item).areaId === institute.areaId,
            ),
    );
    const institute = available.sort((a, b) => {
        const score = (item: typeof a) => {
            const index = AREAS.findIndex((area) => area.id === item.areaId);
            const area = game.areas[index];
            return (area.autonomous + area.dependent) * (0.5 + AREAS[index].education);
        };
        return score(b) - score(a);
    })[0];
    if (!institute) return game;
    game.investigations.push({
        kind: 'capability',
        id: `investigation:${skillId}`,
        skillId,
        instituteId: institute.id,
        progress: 0,
        startedMonth: game.month,
        status: 'active',
    });
    game.lastInvestigationMonth = game.month;
    return game;
}
