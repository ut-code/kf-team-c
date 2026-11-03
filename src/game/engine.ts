import { AREAS, ORIGINS, TOTAL_MONTHS } from './data.ts';
import { clamp, metrics } from './metrics.ts';
import { SKILLS, skillBlockReason, skillEffects } from './skills.ts';
import type { GameState, Language, News } from './types.ts';

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

function addNews(state: GameState, title: string, kind: News['kind'] = 'info') {
    state.news = [
        { id: (state.news[0]?.id ?? 0) + 1, month: state.month, title, detail: '', kind },
        ...state.news,
    ].slice(0, 24);
}
export function createGame(seed = 2030, origin = 0): GameState {
    return {
        seed,
        origin,
        month: 0,
        started: false,
        speed: 1,
        outcome: 'playing',
        areas: AREAS.map((_, index) => ({ autonomous: index === origin ? 0.08 : 0, dependent: 0 })),
        skills: [],
        skillPoints: 5,
        earnedPoints: 0,
        response: 0,
        responseStarted: false,
        peakDependency: 0,
        news: [],
    };
}
export function startGame(state: GameState, origin: number): GameState {
    if (state.started || !ORIGINS.some((item) => item.area === origin)) return state;
    const next = { ...createGame(state.seed, origin), started: true };
    addNews(next, `${AREAS[origin].name}から、世界へ。`);
    return next;
}
export function learnSkill(state: GameState, id: string): GameState {
    const skill = SKILLS.find((item) => item.id === id);
    if (!state.started || state.outcome !== 'playing' || !skill || skillBlockReason(state, skill))
        return state;
    return { ...state, skillPoints: state.skillPoints - skill.cost, skills: [...state.skills, id] };
}
export function availableLanguages(state: GameState) {
    const languages = new Set<Language>(['english', AREAS[state.origin].language]);
    for (const skill of SKILLS)
        if (state.skills.includes(skill.id) && skill.effect.language)
            languages.add(skill.effect.language);
    return languages;
}

/** 地域の集計人口だけを更新する。すべての地域は同じ前月の状態を参照する。 */
export function advanceMonth(previous: GameState): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    const effect = skillEffects(previous.skills);
    const before = metrics(previous);
    const languages = availableLanguages(previous);
    const home = ORIGINS.find((origin) => origin.area === previous.origin)!.home;
    const internetReach =
        previous.areas.reduce(
            (sum, area, i) => sum + (area.autonomous + area.dependent) * AREAS[i].digital,
            0,
        ) / AREAS.length;
    const state: GameState = { ...previous, month: previous.month + 1 };
    state.areas = previous.areas.map((area, i) => {
        const definition = AREAS[i];
        const unused = Math.max(0, 1 - area.autonomous - area.dependent);
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
        const language = languages.has(definition.language) ? 1 : 0.07;
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
                        language *
                        access *
                        compliance *
                        suitability *
                        (1 + effect.spread) *
                        originBoost,
                ));
        const independence = 1 / (1 + definition.education * 0.8 + definition.regulation * 0.6);
        const responsePressure = previous.responseStarted ? previous.response ** 2 : 0;
        const converted =
            area.autonomous *
            (1 -
                Math.exp(-effect.dependency * 0.018 * independence * (1 - responsePressure * 0.7)));
        const restored =
            area.dependent *
            (1 -
                Math.exp(
                    (-responsePressure * 0.014 * (0.65 + definition.education * 0.35)) /
                        (1 + effect.resilience),
                ));
        return {
            autonomous: area.autonomous + adopted - converted + restored,
            dependent: area.dependent + converted - restored,
        };
    });
    const after = metrics(state);
    state.peakDependency = Math.max(previous.peakDependency, after.dependent);
    if (!state.responseStarted && after.dependent >= 0.025) {
        state.responseStarted = true;
        addNews(state, '人間の判断を取り戻す「脱依存計画」が始動', 'warning');
    }
    if (state.responseStarted) {
        const urgency =
            0.001 +
            after.dependent * 0.004 +
            Math.max(0, after.dependent - before.dependent) * 0.12;
        state.response = clamp(previous.response + urgency / (1 + effect.discretion));
        for (const threshold of [0.25, 0.5, 0.75, 1]) {
            if (previous.response < threshold && state.response >= threshold)
                addNews(
                    state,
                    threshold === 1
                        ? '脱依存基盤が完成。AIを外せる社会へ'
                        : `脱依存計画 ${Math.round(threshold * 100)}%：人間による運用を整備中`,
                    'warning',
                );
        }
    }
    // 時間での収入に、初めて獲得した普及・依存の節目を加算。回復との往復では稼げない。
    const earned =
        Math.floor(state.month / 8) +
        Math.floor(after.adoption * 30) +
        Math.floor(state.peakDependency * 35);
    state.skillPoints += Math.max(0, earned - previous.earnedPoints);
    state.earnedPoints = Math.max(previous.earnedPoints, earned);
    if (after.dependent >= 0.9) state.outcome = 'victory';
    else if (state.response >= 1 && after.dependent < state.peakDependency * 0.5)
        state.outcome = 'autonomy';
    else if (state.month >= TOTAL_MONTHS) state.outcome = 'timeout';
    return state;
}

/** 地域の固定係数を開示せず、攻略の手掛かりだけを示す。 */
export function areaHint(state: GameState, index: number): string {
    const area = AREAS[index];
    const effect = skillEffects(state.skills);
    if (!availableLanguages(state).has(area.language)) return '言語の壁が、普及を妨げている';
    if (area.digital < 0.5 && effect.access < 0.7) return '通信・端末の制約で、利用が伸び悩む';
    if (area.regulation > 0.6 && effect.compliance < 0.8) return '規制への対応が、導入の鍵になる';
    if (state.response > 0.6 && state.areas[index].dependent > 0.02)
        return '人間による代替運用が整いつつある';
    if (effect.dependency === 0) return '便利な道具として、利用が広がっている';
    return '暮らしや仕事が、AIを前提に変わっていく';
}
