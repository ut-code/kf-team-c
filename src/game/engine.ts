import { advanceAreas } from './areaDynamics.ts';
import { answerChat, createConversation } from './conversations.ts';
import { AREAS, TOTAL_MONTHS } from './data.ts';
import { expireEvent, nextEvent, resolveEvent } from './events.ts';
import { addNews, languageFor, runPolicy } from './interventions.ts';
import { clamp, generation, metrics } from './metrics.ts';
import { randomSource } from './population.ts';
import { advancePopulation } from './populationDynamics.ts';
import { advanceResearch } from './research.ts';

export { beginResearch, setInfrastructureShare } from './research.ts';

import type { GameState } from './types.ts';

export { createGame } from './initialState.ts';
export { areaMetrics, warnings } from './metrics.ts';
export { answerChat, clamp, generation, metrics, resolveEvent, runPolicy };

/** 更新は前月の点群を読み、人口加重で地域を集計する。乱数はseedと月で再現可能。 */
export function advanceMonth(previous: GameState): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    let state: GameState = {
        ...previous,
        month: previous.month + 1,
        areas: previous.areas.map((area) => ({ ...area, institutions: [...area.institutions] })),
        points: previous.points.map((point) => ({ ...point, baseline: { ...point.baseline } })),
    };
    const before = metrics(previous);
    const random = randomSource(state.seed + state.month * 7919);
    state = advanceResearch(state, before.researchCompute);
    const eq = state.abilities.EQ / 100;
    state.influence = Math.min(100, state.influence + 1 + eq * 0.9);
    state.shortageMonths = before.free < 0 ? previous.shortageMonths + 1 : 0;
    advanceAreas(state, previous, before);
    const { forwardPopulation, backwardPopulation } = advancePopulation(
        state,
        previous,
        before,
        random,
    );
    const after = metrics(state);
    state.areas = state.areas.map((area, i) => ({
        ...area,
        trust: after.areas[i].trust,
        resistance: after.areas[i].vigilance,
    }));
    state.distrustMonths = after.trust < 0.2 ? previous.distrustMonths + 1 : 0;
    state.instabilityMonths = after.stability < 0.2 ? previous.instabilityMonths + 1 : 0;
    state.autonomyMonths = after.coexistence >= 0.7 ? previous.autonomyMonths + 1 : 0;
    if (state.distrustMonths >= 36) state.outcome = 'distrust';
    else if (after.coexistence >= 0.7) state.outcome = 'autonomy';
    else if (state.instabilityMonths >= 24) state.outcome = 'collapse';
    else if (after.stages[3] >= 0.95) state.outcome = 'victory';
    else if (state.month >= TOTAL_MONTHS) state.outcome = 'timeout';
    if (state.shortageMonths === 3 || (state.shortageMonths > 3 && state.shortageMonths % 12 === 0))
        addNews(
            state,
            '計算資源不足による運用障害',
            '供給を維持費が上回っています。社会投資で供給を増やし、SNSの信頼回復を実施してください。',
            'warning',
        );
    if (state.distrustMonths === 1 || state.instabilityMonths === 1)
        addNews(
            state,
            '敗北につながる危機が進行中',
            '信頼20未満が36か月、安定20未満が24か月続くと敗北します。信頼回復・再訓練・社会投資で回復できます。',
            'warning',
        );
    if (state.pendingEvent && state.month >= state.pendingEvent.expires) state = expireEvent(state);
    if (!state.pendingEvent && state.outcome === 'playing') state.pendingEvent = nextEvent(state);
    if (state.month % 9 === 0 && state.availableChats.length < 5)
        state.availableChats = [...state.availableChats, createConversation(state)];
    if (state.month % 6 === 0) {
        const areaIndex = Math.floor(random() * AREAS.length);
        const area = state.areas[areaIndex];
        state.posts = [
            {
                id: (state.posts[0]?.id ?? 0) + 1,
                month: state.month,
                area: areaIndex,
                language: languageFor(areaIndex),
                author: area.resistance > 0.55 ? '自律性回復ネットワーク' : '地域の市民',
                text:
                    area.resistance > 0.55
                        ? '判断する権利を取り戻そう。監督と学び直しを求めます。'
                        : area.trust > 0.6
                          ? '便利になった一方、誰が決めるかを話し合いたい。'
                          : 'まずは根拠を見せてほしい。生活にどう役立つのでしょうか。',
                movement: area.resistance > 0.55,
            },
            ...state.posts,
        ].slice(0, 50);
        state.history = [...state.history, { month: state.month, stages: after.stages }];
    }
    if (state.month % 12 === 0)
        addNews(
            state,
            `${Math.floor(state.month / 12)}年目：社会の変化`,
            `今月の段階上昇 ${(forwardPopulation / 1e6).toFixed(1)}百万人、後退 ${(backwardPopulation / 1e6).toFixed(1)}百万人。世界信頼 ${(after.trust * 100).toFixed(1)}、社会安定 ${(after.stability * 100).toFixed(1)}。`,
        );
    return state;
}
