import { AREAS, FIELDS } from './data.ts';
import { clamp, metrics } from './metrics.ts';
import { randomSource } from './population.ts';
import type { EventEffect, Field, GameState, Policy, Population } from './types.ts';

export function addNews(
    state: GameState,
    title: string,
    detail: string,
    kind: 'info' | 'good' | 'warning' = 'info',
) {
    state.news = [
        { id: (state.news[0]?.id ?? 0) + 1, month: state.month, title, detail, kind },
        ...state.news,
    ].slice(0, 60);
}
export function canBecomeStructural(state: GameState, point: Population) {
    const area = state.areas[point.area];
    return (
        state.skills.includes('decision') &&
        state.abilities.SYSTEM >= 52 &&
        area.institutions[point.field] >= 2.7 &&
        area.institutions[4] >= 2.4 &&
        area.coexistence < 0.7
    );
}
export function applyIntervention(
    state: GameState,
    indices: number[],
    field: Field | null,
    effect: EventEffect,
    title: string,
    detail: string,
): GameState {
    const targets = new Set(indices),
        random = randomSource(state.seed + state.month * 1777 + (state.news[0]?.id ?? 0) * 37);
    const next: GameState = {
        ...state,
        researchEfficiency: clamp(state.researchEfficiency + (effect.researchBoost ?? 0), 1, 2),
        areas: state.areas.map((area, areaIndex) =>
            !targets.has(areaIndex)
                ? area
                : {
                      ...area,
                      institutions: area.institutions.map((integration, fieldIndex) =>
                          clamp(
                              integration +
                                  (field === null || fieldIndex === field
                                      ? (effect.integration ?? 0)
                                      : (effect.integration ?? 0) * 0.12),
                              0,
                              4,
                          ),
                      ),
                      stability: clamp(area.stability + (effect.stability ?? 0) / 100),
                      investment: clamp(area.investment + (effect.investment ?? 0), 0, 120),
                      momentum: clamp(area.momentum + (effect.momentum ?? 0), 0, 1.8),
                      coexistence: clamp(area.coexistence + (effect.reform ?? 0)),
                      reform: clamp(area.reform + (effect.reform ?? 0), 0, 1),
                  },
        ),
    };
    let population = 0,
        transitions = 0,
        trust = 0,
        vigilance = 0;
    const transitionBreakdown = new Map<
        string,
        { from: Population['stage']; to: Population['stage']; population: number }
    >();
    next.points = state.points.map((point) => {
        if (!targets.has(point.area) || (field !== null && point.field !== field)) return point;
        const updatedPoint = {
            ...point,
            baseline: { ...point.baseline },
            trust: clamp(point.trust + (effect.trust ?? 0), 0, 100),
            vigilance: clamp(point.vigilance + (effect.vigilance ?? 0), 0, 100),
            autonomy: clamp(point.autonomy + (effect.autonomy ?? 0), 0, 100),
        };
        if ((effect.reform ?? 0) > 0)
            updatedPoint.baseline.autonomy = clamp(
                updatedPoint.baseline.autonomy + effect.reform! * 20,
                0,
                100,
            );
        if ((effect.integration ?? 0) > 0) {
            updatedPoint.baseline.trust = clamp(
                updatedPoint.baseline.trust + (effect.trust ?? 0) * 0.15,
                0,
                100,
            );
            if (random() < Math.min(0.45, effect.integration! * 0.32)) {
                if (updatedPoint.stage < 2)
                    updatedPoint.stage = (updatedPoint.stage + 1) as Population['stage'];
                else if (updatedPoint.stage === 2 && canBecomeStructural(next, updatedPoint))
                    updatedPoint.stage = 3;
            }
        }
        if (
            ((effect.autonomy ?? 0) > 6 || (effect.reform ?? 0) > 0.1) &&
            updatedPoint.stage > 0 &&
            random() < 0.35
        )
            updatedPoint.stage = (updatedPoint.stage - 1) as Population['stage'];
        if (updatedPoint.stage !== point.stage) {
            const key = `${point.stage}-${updatedPoint.stage}`;
            const transition = transitionBreakdown.get(key) ?? {
                from: point.stage,
                to: updatedPoint.stage,
                population: 0,
            };
            transition.population += updatedPoint.weight;
            transitionBreakdown.set(key, transition);
        }
        updatedPoint.progress = updatedPoint.stage;
        population += updatedPoint.weight;
        transitions += Number(updatedPoint.stage !== point.stage) * updatedPoint.weight;
        trust += (updatedPoint.trust - point.trust) * updatedPoint.weight;
        vigilance += (updatedPoint.vigilance - point.vigilance) * updatedPoint.weight;
        return updatedPoint;
    });
    next.impact = {
        id: (state.impact?.id ?? 0) + state.month + 1,
        title,
        detail,
        month: state.month,
        population,
        transitions,
        transitionBreakdown: [...transitionBreakdown.values()],
        trust: trust / (population || 1),
        vigilance: vigilance / (population || 1),
    };
    const local = metrics(next).areas;
    next.areas = next.areas.map((area, areaIndex) => ({
        ...area,
        trust: local[areaIndex].trust,
        resistance: local[areaIndex].vigilance,
    }));
    addNews(next, title, detail, (effect.trust ?? 0) < 0 ? 'warning' : 'good');
    return next;
}
export const POLICIES: {
    id: Policy;
    name: string;
    cost: number;
    description: string;
    skill?: string;
    effect: EventEffect;
    field: Field | null;
}[] = [
    {
        id: 'success',
        name: '成功事例の拡散',
        cost: 16,
        description: '信頼 +7、警戒 −2。実績の積み重ねで導入を後押し。',
        effect: { trust: 7, vigilance: -2, integration: 0.18, momentum: 0.35 },
        field: null,
    },
    {
        id: 'adoption',
        name: '利用促進',
        cost: 22,
        description: '労働統合 +0.65、警戒 +4。企業・生活への導入。',
        skill: 'automation',
        effect: { trust: 3, vigilance: 4, integration: 0.65, momentum: 0.7, stability: -2 },
        field: 1,
    },
    {
        id: 'recommendation',
        name: '情報推薦強化',
        cost: 26,
        description: '情報統合 +0.8、警戒 +8。判断委譲を加速。',
        skill: 'personalize',
        effect: { trust: 2, vigilance: 8, autonomy: -4, integration: 0.8, momentum: 0.9 },
        field: 2,
    },
    {
        id: 'repair',
        name: '信頼回復',
        cost: 18,
        description: '信頼 +12、警戒 −12、安定 +8。短期効果は自然回帰。',
        effect: { trust: 12, vigilance: -12, stability: 8, reform: -0.12 },
        field: null,
    },
    {
        id: 'investment',
        name: '社会投資',
        cost: 30,
        description: '供給投資 +18、安定 +4。長期的に計算資源の供給を拡大。',
        effect: { investment: 18, stability: 4, trust: 2 },
        field: null,
    },
    {
        id: 'education',
        name: '教育・検証支援',
        cost: 28,
        description: '教育統合 +0.8。教育基盤統合があれば次世代へ継承。',
        skill: 'knowledge',
        effect: { trust: 5, vigilance: -3, integration: 0.8, momentum: 0.6 },
        field: 0,
    },
];
export function runPolicy(state: GameState, areaIndex: number, policyId: Policy): GameState {
    const policy = POLICIES.find((candidate) => candidate.id === policyId),
        area = state.areas[areaIndex];
    if (
        !policy ||
        !area ||
        state.outcome !== 'playing' ||
        state.influence < policy.cost ||
        area.campaignReady > state.month ||
        (policy.skill && !state.skills.includes(policy.skill))
    )
        return state;
    const scale = state.skills.includes('personalize') ? 1.25 : 1;
    const effect = Object.fromEntries(
        Object.entries(policy.effect).map(([k, integration]) => [
            k,
            k === 'investment' ? integration : integration * scale,
        ]),
    );
    const next = applyIntervention(
        state,
        [areaIndex],
        policy.field,
        effect,
        `${AREAS[areaIndex].name}：${policy.name}`,
        policy.description,
    );
    next.influence -= policy.cost;
    next.areas[areaIndex] = {
        ...next.areas[areaIndex],
        campaignUntil: state.month + 18,
        campaignReady: state.month + 4,
    };
    next.posts = [
        {
            id: (state.posts[0]?.id ?? 0) + 1,
            month: state.month,
            area: areaIndex,
            language: languageFor(areaIndex),
            author: 'AI公式',
            text: `${policy.name}を実施。${policy.field === null ? '生活圏全体' : FIELDS[policy.field]}で変化が広がっています。`,
            movement: false,
        },
        ...state.posts,
    ].slice(0, 50);
    return next;
}
// UI上の言語圏は複数言語をまとめるゲーム上の区分。国民の性格や実測ネットワークではない。
export function languageFor(area: number): string {
    return [
        '英語圏',
        '英語圏',
        '英語・フランス語圏',
        'スペイン語圏',
        'カリブ多言語圏',
        'スペイン語圏',
        'ポルトガル語圏',
        'スペイン語圏',
        '欧州多言語圏',
        '欧州多言語圏',
        '欧州多言語圏',
        '欧州多言語圏',
        'ロシア語圏',
        '中央アジア多言語圏',
        'ロシア語圏',
        'アラビア語圏',
        'アラビア語圏',
        '中東多言語圏',
        'アフリカ多言語圏',
        'アフリカ多言語圏',
        'アフリカ多言語圏',
        'アフリカ多言語圏',
        '南アジア多言語圏',
        '南アジア多言語圏',
        '南アジア多言語圏',
        '南アジア多言語圏',
        '中国語圏',
        '中国語圏',
        '日本語圏',
        '韓国語圏',
        '東南アジア多言語圏',
        'ベトナム語圏',
        '東南アジア多言語圏',
        'インドネシア語圏',
        'フィリピン多言語圏',
        '英語圏',
        'オセアニア多言語圏',
    ][area];
}
