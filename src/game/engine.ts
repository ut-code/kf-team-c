import { AREAS, ORIGINS, TOTAL_MONTHS } from './data.ts';
import { clamp, metrics } from './metrics.ts';
import { SKILLS, skillBlockReason, skillEffects } from './skills.ts';
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
            autonomous: index === origin ? 0.08 : 0,
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
    return { ...state, skillPoints: state.skillPoints - skill.cost, skills: [...state.skills, id] };
}

/** 地域の集計人口だけを更新する。すべての地域は同じ前月の状態を参照する。 */
export function advanceMonth(previous: GameState): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    const effect = skillEffects(previous.skills);
    const strategy = socialStrategy(previous.socialStrategy);
    const home = ORIGINS.find((origin) => origin.area === previous.origin)!.home;
    const internetReach =
        previous.areas.reduce(
            (sum, area, i) => sum + (area.autonomous + area.dependent) * AREAS[i].digital,
            0,
        ) / AREAS.length;
    const state: GameState = { ...previous, month: previous.month + 1 };
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
        const adopted =
            unused *
            (1 -
                Math.exp(
                    -contact *
                        access *
                        compliance *
                        suitability *
                        (1 + effect.spread) *
                        (1 + strategy.spread) *
                        (0.5 + area.favorability) *
                        originBoost,
                ));
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
                        0.018 *
                        independence *
                        (1 + strategy.dependency) *
                        (1 - area.antiAI * 0.6),
                ));
        const pressure =
            ((area.dependent * 0.01 + adopted * 0.25 + nearbyOpposition * 0.012) *
                (1 - area.favorability) ** 1.5) /
                (1 + effect.discretion) +
            Math.max(0, 0.5 - area.favorability) * 0.006;
        const rejectedUnused = unused * pressure * 0.45;
        const rejectedUse = area.autonomous * pressure * 0.6;
        const rejectedDependency = (area.dependent * pressure * 0.15) / (1 + effect.resilience);
        const reconciled =
            area.antiAI * (0.001 + area.favorability * 0.003 + strategy.reconciliation);
        const restored = (area.dependent * area.antiAI * 0.015) / (1 + effect.resilience);
        return {
            autonomous: area.autonomous + adopted - converted - rejectedUse + restored,
            dependent: area.dependent + converted - restored - rejectedDependency,
            antiAI: area.antiAI + rejectedUnused + rejectedUse + rejectedDependency - reconciled,
            favorability: clamp(
                area.favorability +
                    strategy.trust +
                    (0.58 - area.favorability) * 0.006 -
                    area.dependent * 0.0015 +
                    effect.quality * 0.0003,
            ),
        };
    });
    const updated = advanceSociety(state);
    const after = metrics(updated);
    updated.peakDependency = Math.max(previous.peakDependency, after.dependent);

    // 時間での収入に、初めて獲得した普及・依存の節目を加算。回復との往復では稼げない。
    const earned =
        Math.floor(updated.month / 8) +
        Math.floor(after.adoption * 30) +
        Math.floor(updated.peakDependency * 35);
    updated.skillPoints += Math.max(0, earned - previous.earnedPoints);
    updated.earnedPoints = Math.max(previous.earnedPoints, earned);
    if (after.dependent >= 0.9) updated.outcome = 'victory';
    else if (after.antiAI >= 0.65) updated.outcome = 'autonomy';
    else if (updated.month >= TOTAL_MONTHS) updated.outcome = 'timeout';
    return updated;
}

/** 地域の固定係数を開示せず、攻略の手掛かりだけを示す。 */
export function areaHint(state: GameState, index: number): string {
    const area = AREAS[index];
    const effect = skillEffects(state.skills);
    if (area.digital < 0.5 && effect.access < 0.7) return '通信・端末の制約で、利用が伸び悩む';
    if (area.regulation > 0.6 && effect.compliance < 0.8) return '規制への対応が、導入の鍵になる';
    if (state.areas[index].antiAI > 0.15) return 'AIを使わない選択を支持する人々が広がっている';
    if (effect.dependency === 0) return '便利な道具として、利用が広がっている';
    return '暮らしや仕事が、AIを前提に変わっていく';
}
