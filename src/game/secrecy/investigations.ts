import { AREAS } from '../data.ts';
import { clamp } from '../metrics.ts';
import { SKILLS, skillEffects } from '../skills.ts';
import type { GameState } from '../types.ts';
import { discloseCapability } from './capabilities.ts';
import { INSTITUTES } from './data.ts';
import { researchRate, researchTopic } from './research.ts';
import { researchCapacity, runningCapabilityIds } from './researchCapacity.ts';
import type { Investigation, InvestigationAction } from './types.ts';

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
    const effect = skillEffects(game.skills);
    const partnership =
        !unimpeded && investigation.intervention === 'partnership'
            ? 0.85 - effect.discretion * 6 - effect.compliance * 0.5
            : 0;
    const pressure =
        !unimpeded && investigation.intervention === 'pressure'
            ? regionalDependency(game, investigation) * 3
            : 0;
    return (
        Math.max(
            0.45,
            1.1 + materials * 1.1 + AREAS[index].education * 0.5 + partnership - pressure,
        ) * (unimpeded ? 1 : researchCapacity(game, investigation.instituteId))
    );
}

export function respondToInvestigation(
    game: GameState,
    id: string,
    action: InvestigationAction,
): GameState {
    const investigation = game.investigations.find((item) => item.id === id);
    if (
        !game.started ||
        game.outcome !== 'playing' ||
        !investigation ||
        investigation.status !== 'active'
    )
        return game;
    if (investigation.kind === 'research') {
        if (
            action === 'disclose' ||
            action === 'restrict' ||
            investigation.intervention !== 'none' ||
            game.skillPoints < 2
        )
            return game;
        return {
            ...game,
            skillPoints: game.skillPoints - 2,
            investigations: game.investigations.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          intervention: action,
                          result:
                              researchTopic(investigation).resistance >= 8
                                  ? '独立再現と成果共有が進み、介入による遅延はわずか。'
                                  : '研究への介入で時間を稼ぐ。蓄積された知識や発表済みの成果は消せない。',
                      }
                    : item,
            ),
        };
    }
    if (action === 'disclose') return discloseCapability(game, investigation.skillId);
    if (action === 'restrict') {
        const capability = game.capabilities[investigation.skillId];
        return {
            ...game,
            capabilities: {
                ...game.capabilities,
                [investigation.skillId]: { ...capability, limited: true },
            },
            investigations: game.investigations.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          status: 'restricted',
                          closedMonth: game.month,
                          result: '機能を制限。研究効果は20%に低下した。過去の記録は残る。',
                      }
                    : item,
            ),
        };
    }
    // 介入は一度だけ。費用で進捗を消すことはできない。
    if (investigation.intervention !== 'none' || game.skillPoints < 2) return game;
    const index = instituteArea(investigation);
    return {
        ...game,
        skillPoints: game.skillPoints - 2,
        areas: game.areas.map((area, i) => {
            if (i !== index || action !== 'partnership') return area;
            const adopted = Math.min(
                0.06,
                Math.max(0, 1 - area.autonomous - area.dependent - area.antiAI),
            );
            return {
                ...area,
                autonomous: area.autonomous + adopted,
                favorability: clamp(area.favorability + 0.02),
            };
        }),
        investigations: game.investigations.map((item) =>
            item.id === id
                ? {
                      ...item,
                      intervention: action,
                      result:
                          action === 'pressure'
                              ? '周辺企業と連携。地域の依存が高いほど調査が遅れる。'
                              : '検証環境を提供。個人情報保護が未整備だと調査材料も増える。',
                  }
                : item,
        ),
    };
}

export function advanceInvestigations(previous: GameState): GameState {
    let game = {
        ...previous,
        capabilities: { ...previous.capabilities },
        investigations: previous.investigations.map((item) => ({ ...item })),
    };
    for (const investigation of game.investigations) {
        if (investigation.kind !== 'capability' || investigation.status !== 'active') continue;
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
        if (capability.visibility !== 'hidden' || capability.limited) continue;
        // 普及と上位研究の活用が、外部から観測できる証拠を増やす。
        const successors = SKILLS.filter(
            (skill) =>
                game.skills.includes(skill.id) &&
                skill.requires.includes(id) &&
                !game.capabilities[skill.id]?.limited,
        ).length;
        game.capabilities[id] = {
            ...capability,
            evidence: Math.min(10, capability.evidence + use * (1 + successors * 0.25)),
        };
    }
    if (game.month - game.lastInvestigationMonth < 18 || runningCapabilityIds(game).size >= 2)
        return game;
    const candidate = Object.entries(game.capabilities).find(([id, capability]) => {
        return (
            capability.visibility === 'hidden' &&
            !capability.limited &&
            capability.evidence >= 10 &&
            !game.investigations.some((item) => item.kind === 'capability' && item.skillId === id)
        );
    });
    if (!candidate) return game;
    const [skillId] = candidate;
    const available = INSTITUTES.filter(
        (institute) =>
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
        intervention: 'none',
    });
    game.lastInvestigationMonth = game.month;
    return game;
}
