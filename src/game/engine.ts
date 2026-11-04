import { AREAS, DEFEAT_OPPOSITION, ORIGINS, VICTORY_DEPENDENCY, WORLD_POPULATION } from './data.ts';
import { clamp, metrics } from './metrics.ts';
import { activeSkillEffects } from './secrecy/capabilities.ts';
import { CAPABILITIES, INSTITUTES } from './secrecy/data.ts';
import { advanceInvestigations } from './secrecy/investigations.ts';
import { advanceResearch, publishedResearchPressure } from './secrecy/research.ts';
import { SKILLS, skillBlockReason } from './skills.ts';
import { socialStrategy } from './society/strategies.ts';
import { advanceSociety } from './society/system.ts';
import type { GameState } from './types.ts';

export { metrics } from './metrics.ts';

/** 地理的近接は経済交流の近似。国外への普及はこれとは独立してインターネットでも起こる。 */
const ties = AREAS.map((area, i) =>
    AREAS.map((other, j) => {
        if (i === j) return 0;
        const latitude = ((area.latitude + other.latitude) * Math.PI) / 360;
        const longitude = Math.min(
            Math.abs(area.longitude - other.longitude),
            360 - Math.abs(area.longitude - other.longitude),
        );
        const distance = Math.hypot(longitude * Math.cos(latitude), area.latitude - other.latitude);
        return Math.exp(-distance / 16) * (area.region === other.region ? 1.6 : 1);
    }),
);

export function createGame(seed = 2030, origin = 0): GameState {
    return {
        seed,
        origin,
        month: 0,
        started: false,
        speed: 1,
        outcome: 'playing',
        areas: AREAS.map((_, index) => ({
            autonomous: index === origin ? 0.16 : 0,
            dependent: 0,
            antiAI: 0,
            favorability: 0.58,
        })),
        skills: [],
        skillPoints: 5,
        earnedPoints: 0,
        socialStrategy: 'listening',
        encounters: [],
        lastEncounterMonth: -2,
        peakDependency: 0,
        capabilities: {},
        investigations: [],
        lastInvestigationMonth: -18,
        researchKnowledge: Object.fromEntries(INSTITUTES.map((institute) => [institute.id, 0])),
    };
}
export function startGame(state: GameState, origin: number): GameState {
    if (state.started || !ORIGINS.some((item) => item.area === origin)) return state;
    return { ...createGame(state.seed, origin), started: true };
}
export function learnSkill(state: GameState, id: string): GameState {
    const skill = SKILLS.find((item) => item.id === id);
    if (!state.started || state.outcome !== 'playing' || !skill || skillBlockReason(state, skill))
        return state;
    return {
        ...state,
        skillPoints: state.skillPoints - skill.cost,
        skills: [...state.skills, id],
        capabilities: CAPABILITIES[id]
            ? { ...state.capabilities, [id]: { visibility: 'hidden', limited: false, evidence: 0 } }
            : state.capabilities,
    };
}

/** 地域の集計人口だけを更新する。すべての地域は同じ前月の状態を参照する。 */
export function advanceMonth(
    previous: GameState,
    trace?: (
        phase: string,
        before: GameState,
        after: GameState,
        flows?: Record<string, number>,
    ) => void,
): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    const effect = activeSkillEffects(previous);
    const strategy = socialStrategy(previous.socialStrategy);
    const home = ORIGINS.find((origin) => origin.area === previous.origin)!.home;
    const internetReach =
        previous.areas.reduce(
            (sum, area, i) => sum + (area.autonomous + area.dependent) * AREAS[i].digital,
            0,
        ) / AREAS.length;
    const state: GameState = { ...previous, month: previous.month + 1 };
    const flows = {
        新規利用: 0,
        利用離れ: 0,
        利用者の反AI化: 0,
        未使用者の反AI化: 0,
        反AIからの回復: 0,
        依存への移行: 0,
    };
    state.areas = previous.areas.map((area, i) => {
        const definition = AREAS[i];
        const unused = Math.max(0, 1 - area.autonomous - area.dependent - area.antiAI);
        const localUse = area.autonomous + area.dependent;
        const nearbyUse =
            ties[i].reduce(
                (sum, weight, j) =>
                    sum + weight * (previous.areas[j].autonomous + previous.areas[j].dependent),
                0,
            ) /
            Math.max(
                1,
                ties[i].reduce((a, b) => a + b, 0),
            );
        const access = clamp(
            definition.digital + effect.access * (1 - definition.digital),
            0.08,
            1,
        );
        const compliance = 1 / (1 + (definition.regulation * 3) / (1 + effect.compliance * 4));
        const suitability =
            1 +
            effect.quality * 0.3 +
            effect.education * definition.education * 0.35 +
            effect.enterprise * definition.enterprise * 0.35;
        const originBoost = home.includes(i) ? 1.8 : 1;
        const contact =
            localUse * 0.035 + nearbyUse * 0.014 + internetReach * definition.digital * 0.025;
        const appeal = clamp(
            effect.quality + effect.spread * 0.5 + effect.enterprise * 0.25,
            0.1,
            1,
        );
        const adopted =
            unused *
            (1 -
                Math.exp(
                    -contact *
                        appeal *
                        access *
                        compliance *
                        suitability *
                        (1 + effect.spread) *
                        (1 + strategy.spread) *
                        (0.5 + area.favorability) *
                        originBoost,
                ));
        const researchPressure = publishedResearchPressure(previous, i);
        const preparation = clamp(effect.quality * 0.5 + effect.compliance * 0.5);
        const independence = 1 / (1 + definition.education * 0.8 + definition.regulation * 0.6);
        const nearbyOpposition =
            ties[i].reduce((sum, weight, j) => sum + weight * previous.areas[j].antiAI, 0) /
            Math.max(
                1,
                ties[i].reduce((sum, weight) => sum + weight, 0),
            );
        const converted =
            area.autonomous *
            (1 -
                Math.exp(
                    -effect.dependency *
                        0.014 *
                        independence *
                        (1 + strategy.dependency) *
                        (1 - area.antiAI * 0.6),
                ));
        const pressure =
            ((area.dependent * 0.01 + adopted * 0.25 + nearbyOpposition * 0.012) *
                (1 - area.favorability) ** 1.5) /
                (1 + effect.discretion + preparation * 2) +
            Math.max(0, 0.55 - area.favorability) * 0.025 +
            researchPressure;
        const rejectedUnused = unused * pressure * 0.45;
        const rejectedUse = area.autonomous * pressure * 0.6;
        const rejectedDependency =
            (area.dependent * pressure * (0.15 + clamp(researchPressure * 20) * 0.85)) /
            (1 + effect.resilience);
        const reconciled =
            (area.antiAI *
                (0.001 +
                    area.favorability * 0.003 +
                    strategy.reconciliation +
                    preparation * 0.008)) /
            (1 + researchPressure * 80);
        const restored = (area.dependent * area.antiAI * 0.015) / (1 + effect.resilience);
        const usefulness = clamp(
            effect.quality * 0.65 +
                effect.education * definition.education * 0.35 +
                effect.enterprise * definition.enterprise * 0.35,
        );
        const abandoned = area.autonomous * (0.001 + (1 - usefulness) * 0.035);
        // 利用者の体験を地域全体の評価へ反映する。有用性が半分未満なら不満が増える。
        const experienceTrust = localUse * (usefulness - 0.5) * 0.004;
        if (trace) {
            const weight = (definition.population / WORLD_POPULATION) * 100;
            flows.新規利用 += adopted * weight;
            flows.利用離れ -= abandoned * weight;
            flows.利用者の反AI化 += (rejectedUse + rejectedDependency) * weight;
            flows.未使用者の反AI化 += rejectedUnused * weight;
            flows.反AIからの回復 -= reconciled * weight;
            flows.依存への移行 += converted * weight;
        }
        return {
            autonomous: area.autonomous + adopted - converted - rejectedUse + restored - abandoned,
            dependent: area.dependent + converted - restored - rejectedDependency,
            antiAI: area.antiAI + rejectedUnused + rejectedUse + rejectedDependency - reconciled,
            favorability: clamp(
                area.favorability +
                    strategy.trust * localUse -
                    area.dependent * (0.001 + (1 - preparation) * 0.003) +
                    experienceTrust -
                    converted * (1 - preparation) * 0.2,
            ),
        };
    });
    trace?.('月次の人口移動', previous, state, flows);
    const society = advanceSociety(state);
    trace?.('イベント・チャットの自動処理', state, society);
    const investigations = advanceInvestigations(society);
    trace?.('能力調査・自動露呈', society, investigations);
    const updated = advanceResearch(investigations);
    trace?.('独立研究の進行・発表', investigations, updated);
    const after = metrics(updated);
    updated.peakDependency = Math.max(previous.peakDependency, after.dependent);

    // 時間での収入に、初めて獲得した普及・依存の節目を加算。回復との往復では稼げない。
    const earned =
        Math.min(
            40,
            Math.min(8, Math.floor(updated.month / 3)) +
                Math.floor(Math.max(0, updated.month - 24) / 15),
        ) +
        Math.floor(after.adoption * 30) +
        Math.floor(updated.peakDependency * 20);
    updated.skillPoints += Math.max(0, earned - previous.earnedPoints);
    updated.earnedPoints = Math.max(previous.earnedPoints, earned);
    if (after.dependent >= VICTORY_DEPENDENCY) updated.outcome = 'victory';
    else if (after.antiAI >= DEFEAT_OPPOSITION) updated.outcome = 'autonomy';
    else if (after.adoption * WORLD_POPULATION < 0.001) {
        // 世界全体で利用者が千人未満になったサービスは運用を終える。
        updated.areas = updated.areas.map((area) => ({ ...area, autonomous: 0, dependent: 0 }));
        updated.outcome = 'forgotten';
    }
    return updated;
}

/** 地域の固定係数を開示せず、攻略の手掛かりだけを示す。 */
export function areaHint(state: GameState, index: number): string {
    const area = AREAS[index];
    const effect = activeSkillEffects(state);
    if (effect.quality === 0 && effect.spread === 0 && effect.enterprise === 0)
        return '新しい用途が見つからず、利用者の関心が薄れている';
    if (state.areas[index].favorability < 0.4) return '不信から、利用をやめる人が増えている';
    if (area.digital < 0.5 && effect.access < 0.7) return '通信・端末の制約で、利用が伸び悩む';
    if (area.regulation > 0.6 && effect.compliance < 0.8) return '規制への対応が、導入の鍵になる';
    if (publishedResearchPressure(state, index) > 0.01)
        return '公表された研究成果を根拠に、AIへの反発が広がっている';
    if (state.areas[index].antiAI > 0.15) return 'AIを使わない選択を支持する人々が広がっている';
    if (effect.dependency === 0) return '便利な道具として、利用が広がっている';
    return '暮らしや仕事が、AIを前提に変わっていく';
}
