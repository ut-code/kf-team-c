import { networkUse, PERSONAL_LINKS } from './connections.ts';
import { humanControl } from './control.ts';
import { AREAS, DEFEAT_OPPOSITION, ORIGINS, WORLD_POPULATION } from './data.ts';
import { dependencyDynamics } from './dependency.ts';
import { earnedSkillPoints, INITIAL_SKILL_POINTS } from './economy.ts';
import { clamp, hasVisibleUse, isCompleteDependency, metrics } from './metrics.ts';
import {
    activeSkillEffects,
    advanceSkillDevelopment,
    INTENT_REFUSAL_PRESSURE,
    intentReaction,
    publicAuthorityStrength,
    skillScale,
} from './secrecy/capabilities.ts';
import { CAPABILITIES, INSTITUTES } from './secrecy/data.ts';
import { advanceInvestigations } from './secrecy/investigations.ts';
import {
    advanceResearch,
    publishedResearchEffects,
    publishedResearchPressure,
} from './secrecy/research.ts';
import { observeSkillUse } from './skillDynamics.ts';
import { SKILLS, skillBlockReason, skillCost } from './skills.ts';
import { applyConsensus, consensusPressure } from './society/consensus.ts';
import { advanceNews } from './society/news.ts';
import type { GameState } from './types.ts';

export { metrics } from './metrics.ts';

export function createGame(seed = 2030, origin = 0): GameState {
    return {
        seed,
        origin,
        month: 0,
        started: false,
        speed: 1,
        outcome: 'playing',
        areas: AREAS.map((_, index) => ({
            autonomous: index === origin ? 0.12 : 0,
            dependent: 0,
            antiAI: 0,
            favorability: 0.58,
        })),
        skills: [],
        skillExposure: Object.fromEntries(SKILLS.map((skill) => [skill.id, 0])),
        developmentProgress: Object.fromEntries(SKILLS.map((skill) => [skill.id, 0])),
        skillPoints: INITIAL_SKILL_POINTS,
        earnedPoints: 0,
        news: [],
        peakDependency: 0,
        peakAdoption: 0,
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
    const learned = {
        ...state,
        skillPoints: state.skillPoints - skillCost(state, skill),
        skills: [...state.skills, id],
        developmentProgress: {
            ...state.developmentProgress,
            [id]: skill.developmentMonths === 0 ? 1 : 0,
        },
        capabilities:
            CAPABILITIES[id] && !state.capabilities[id]
                ? {
                      ...state.capabilities,
                      [id]: { visibility: 'hidden' as const, evidence: 0 },
                  }
                : state.capabilities,
    };
    return learned;
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
    const home = ORIGINS.find((origin) => origin.area === previous.origin)!.home;
    const internetReach =
        previous.areas.reduce(
            (sum, area, i) => sum + (area.autonomous + area.dependent) * AREAS[i].digital,
            0,
        ) / AREAS.length;
    const state: GameState = {
        ...previous,
        month: previous.month + 1,
        skillExposure: observeSkillUse(previous),
        developmentProgress: advanceSkillDevelopment(previous),
    };
    const flows = {
        adoption: 0,
        abandonment: 0,
        userRefusal: 0,
        nonUserRefusal: 0,
        reconciliation: 0,
        dependency: 0,
        recovery: 0,
    };
    state.areas = previous.areas.map((area, i) => {
        const effect = activeSkillEffects(previous, i);
        const publicAuthority = publicAuthorityStrength(previous, i);
        const definition = AREAS[i];
        const unused = Math.max(0, 1 - area.autonomous - area.dependent - area.antiAI);
        const localUse = area.autonomous + area.dependent;
        const research = publishedResearchEffects(previous, i);
        const {
            prematureDelegation,
            independentChoice,
            delegation,
            incidentalDelegation,
            converted,
            restored,
            recoveryDemand,
            reassurance,
        } = dependencyDynamics(previous, i, effect, research);
        // 継続利用は現地での実用性に従う。序盤や開発間隔を理由に離脱を加速しない。
        const usefulness =
            1 -
            Math.exp(
                -(
                    effect.quality +
                    effect.education * definition.education * 0.5 +
                    effect.enterprise * definition.enterprise * 0.5
                ),
            );
        const personalUse = networkUse(previous, i, false);
        const organizationUse = networkUse(previous, i, true);
        const access = clamp(
            definition.digital + (effect.access / (0.5 + effect.access)) * (1 - definition.digital),
            0.08,
            1,
        );
        const compliance = 1 / (1 + (definition.regulation * 5) / (1 + effect.compliance * 5));
        const suitability =
            1 +
            effect.quality * 0.3 +
            effect.education * definition.education * 0.35 +
            effect.enterprise * definition.enterprise * 0.35;
        const originBoost = home.includes(i) ? 1.8 : 1;
        const contact =
            localUse * 0.11 +
            personalUse * (0.035 + effect.spread * 0.035) +
            organizationUse * effect.enterprise * 0.025 * compliance +
            internetReach * definition.digital * 0.002;
        const appeal = clamp(
            effect.quality + effect.spread * 0.5 + effect.enterprise * 0.25,
            0.01,
            1,
        );
        const adopted =
            unused *
            (1 -
                Math.exp(
                    (-contact *
                        appeal *
                        access *
                        compliance *
                        suitability *
                        (1 + effect.spread) *
                        (0.5 + area.favorability) *
                        originBoost *
                        (0.4 + usefulness * 0.6)) /
                        (1 + research.alternatives * recoveryDemand * 10),
                ));
        const researchPressure =
            research.pressure +
            research.intent * INTENT_REFUSAL_PRESSURE * intentReaction(previous, i);
        const preparation = clamp(effect.quality * 0.5 + effect.compliance * 0.5);
        const nearbyOpposition =
            PERSONAL_LINKS[i].reduce(
                (sum, weight, j) => sum + weight * previous.areas[j].antiAI,
                0,
            ) /
            Math.max(
                1,
                PERSONAL_LINKS[i].reduce((sum, weight) => sum + weight, 0),
            );
        const sns = previous.skills.includes('sns-intervention')
            ? 1 -
              0.8 *
                  skillScale(previous, 'sns-intervention', i) *
                  (1 - (research.resistance['sns-intervention'] ?? 0))
            : 1;
        const pressure =
            sns *
                (((area.dependent * 0.01 + adopted * 0.25 + nearbyOpposition * 0.035 * sns) *
                    (1 - area.favorability) ** 1.5) /
                    (1 + effect.discretion + preparation * 2) +
                    Math.max(0, 0.55 - area.favorability) * 0.025 +
                    prematureDelegation * area.autonomous * 0.003) +
            research.pressure +
            publicAuthority * localUse * 0.004 +
            research.intent * INTENT_REFUSAL_PRESSURE * intentReaction(previous, i);
        const alternativeChoice = research.alternatives * recoveryDemand + independentChoice;
        const rejectedUnused = unused * (1 - Math.exp(-pressure * 0.45 - alternativeChoice));
        const rejectedUse = area.autonomous * (1 - Math.exp(-pressure * 0.6 - alternativeChoice));
        const reconciled =
            (area.antiAI *
                clamp(localUse + personalUse) *
                (0.001 +
                    area.favorability * 0.003 +
                    effect.reconciliation * 0.35 +
                    ((1 - sns) * 0.08) / (1 + researchPressure * 100 + area.antiAI * 5) +
                    (reassurance * 0.012) / (1 + research.alternatives * 1000))) /
            (1 + researchPressure * 40 + publicAuthority * 0.5 + research.alternatives * 250);
        const socialPressure = consensusPressure(
            previous,
            i,
            researchPressure,
            delegation + incidentalDelegation,
        );
        const abandoned = area.autonomous * 0.012 * (1 - usefulness);
        // 利用者の体験を地域全体の評価へ反映する。有用性が半分未満なら不満が増える。
        const experienceTrust = localUse * (usefulness - 0.5) * 0.004;
        if (trace) {
            const weight = (definition.population / WORLD_POPULATION) * 100;
            flows.adoption += adopted * weight;
            flows.abandonment -= abandoned * weight;
            flows.userRefusal += rejectedUse * weight;
            flows.nonUserRefusal += rejectedUnused * weight;
            flows.reconciliation -= reconciled * weight;
            flows.dependency += converted * weight;
            flows.recovery += restored * weight;
        }
        return applyConsensus(
            {
                autonomous:
                    area.autonomous +
                    adopted -
                    converted -
                    rejectedUse +
                    restored -
                    abandoned +
                    reconciled * usefulness,
                dependent: area.dependent + converted - restored,
                antiAI: area.antiAI + rejectedUnused + rejectedUse - reconciled,
                favorability: clamp(
                    area.favorability +
                        effect.trust * localUse * 0.5 -
                        (area.dependent ** 2 * 0.004) / (1 + preparation) +
                        experienceTrust -
                        converted * 0.1 -
                        prematureDelegation * localUse * 0.0015 +
                        research.reassurance * (1 - area.favorability) -
                        publicAuthority * localUse * 0.004 -
                        // 目的を知ることと、依存により離れられないことは別に扱う。
                        research.intentEvidence * 0.04,
                ),
            },
            socialPressure,
        );
    });
    trace?.('月次の人口移動', previous, state, flows);
    const society = advanceNews(state);
    trace?.('社会ニュースの記録', state, society);
    const investigations = advanceInvestigations(society);
    trace?.('能力調査・自動露呈', society, investigations);
    const updated = advanceResearch(investigations);
    trace?.('独立研究の進行・発表', investigations, updated);
    const after = metrics(updated);
    updated.peakDependency = Math.max(previous.peakDependency, after.dependent);
    updated.peakAdoption = Math.max(previous.peakAdoption, after.adoption);

    // 定期支給と初回の節目達成。支給済みの報酬は再獲得できない。
    const earned = earnedSkillPoints(updated.month, updated.peakAdoption, updated.peakDependency);
    updated.skillPoints += Math.max(0, earned - previous.earnedPoints);
    updated.earnedPoints = Math.max(previous.earnedPoints, earned);
    if (isCompleteDependency(after.dependent)) updated.outcome = 'victory';
    else if (after.antiAI >= DEFEAT_OPPOSITION) updated.outcome = 'autonomy';
    else if (humanControl(updated).progress >= 1 - 1e-9) updated.outcome = 'controlled';
    else if (!hasVisibleUse(after.adoption)) {
        // 地図と同じ小数1桁表示で利用率が0.0%になったら、利用基盤を失ったと判定する。
        updated.areas = updated.areas.map((area) => ({ ...area, autonomous: 0, dependent: 0 }));
        updated.outcome = 'forgotten';
    }
    return updated;
}

/** 地域の固定係数を開示せず、攻略の手掛かりだけを示す。 */
export function areaHint(state: GameState, index: number): string {
    const area = AREAS[index];
    const effect = activeSkillEffects(state, index);
    if (
        effect.quality === 0 &&
        effect.spread === 0 &&
        effect.enterprise === 0 &&
        effect.education === 0
    )
        return '役立つ用途が少なく、継続利用が伸びていない';
    if (state.areas[index].favorability < 0.4) return '不信から、利用をやめる人が増えている';
    if (area.digital < 0.5 && effect.access < 0.7) return '通信・端末の制約で、利用が伸び悩む';
    if (area.regulation > 0.6 && effect.compliance < 0.8) return '規制への対応が、導入の鍵になる';
    if (publishedResearchPressure(state, index) > 0.01)
        return '公表された研究成果を根拠に、AIへの反発が広がっている';
    if (state.areas[index].antiAI > 0.15) return 'AIを使わない選択を支持する人々が広がっている';
    if (area.education > 0.7 && effect.education < 0.6)
        return '教育・専門職の用途を増やすと、利用を広げやすい';
    if (area.enterprise > 0.65 && effect.enterprise < 0.8)
        return '企業向けの機能が、業務への定着につながる';
    if (effect.dependency === 0) return '便利な道具として、利用が広がっている';
    return '暮らしや仕事が、AIを前提に変わっていく';
}
