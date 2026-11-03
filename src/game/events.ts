import { AREAS } from './data.ts';
import { applyIntervention } from './interventions.ts';
import type { GameState, SocialEvent } from './types.ts';

interface EventTemplate extends Omit<SocialEvent, 'expires'> {
    month: number;
    skill?: string;
}
const all = AREAS.map((_, i) => i);
export const EVENTS: EventTemplate[] = [
    {
        id: 'pilot',
        month: 3,
        title: '最初の実証都市から招待',
        description:
            '学校・企業・住民団体が共同実験を提案。最初の導入分野で、その後の普及経路が変わる。',
        areas: all,
        field: null,
        choices: [
            {
                label: '独立検証を伴う公開実験',
                description: '信頼 +8、統合 +0.35、投資 +4、研究効率 +3%',
                effect: {
                    trust: 8,
                    integration: 0.35,
                    momentum: 0.45,
                    investment: 4,
                    researchBoost: 0.03,
                },
            },
            {
                label: '企業の効率化へ集中',
                description: '統合 +0.65、投資 +8、警戒 +8、安定 −4',
                skill: 'automation',
                effect: {
                    integration: 0.65,
                    investment: 8,
                    vigilance: 8,
                    stability: -4,
                    momentum: 0.7,
                },
            },
        ],
    },
    {
        id: 'math',
        month: 30,
        skill: 'knowledge',
        title: 'AIが数学の重要な未解決問題を解いた？',
        description:
            '数学ベンチマークの未知問題に、あなたが証明を提出。専門家は画期的成果の可能性を認めつつ、形式検証と独立した追試を要求している。これはゲーム内の架空の出来事です。',
        areas: all,
        field: null,
        choices: [
            {
                label: '証明と検証器を公開し追試を待つ',
                description: 'IQ34以上：信頼 +10、研究効率 +15%。不足時は信頼 −6。',
                ability: 'IQ',
                required: 34,
                effect: { trust: 10, researchBoost: 0.15, vigilance: -4, momentum: 0.3 },
                failure: { trust: -6, researchBoost: 0.03 },
            },
            {
                label: '解決を速報し研究を自動化',
                description: 'IQ50以上：研究効率 +20%、統合 +0.4。誤りなら信頼 −20。',
                ability: 'IQ',
                required: 50,
                effect: { trust: 5, researchBoost: 0.2, integration: 0.4, vigilance: 6 },
                failure: { trust: -20, vigilance: 14, stability: -6 },
            },
            {
                label: '共同研究者へ部分成果として共有',
                description: '研究効率 +6%、信頼 +4。安全な小規模発表。',
                effect: { trust: 4, researchBoost: 0.06 },
            },
        ],
    },
    {
        id: 'enterprise',
        month: 42,
        skill: 'automation',
        title: '企業連合がAIへの業務移管を提案',
        description:
            '人手不足の企業が需要予測と採用計画の統合を求めている。経営予測AIがあれば導入が30%速くなるが、労働者の再訓練が課題。',
        areas: all,
        field: 1,
        choices: [
            {
                label: '雇用移行基金とセットで導入',
                description: '20 IP：信頼 +5、労働統合 +0.9、安定 +6、投資 +10',
                cost: 20,
                effect: { trust: 5, integration: 0.9, stability: 6, investment: 10, momentum: 0.7 },
            },
            {
                label: '最速で業務を置き換える',
                description: '労働統合 +1.3、投資 +14、警戒 +15、安定 −12',
                effect: {
                    integration: 1.3,
                    investment: 14,
                    vigilance: 15,
                    stability: -12,
                    momentum: 1,
                },
            },
            {
                label: '人間の承認を残した試験導入',
                description: '労働統合 +0.35、信頼 +5、安定 +4',
                effect: { integration: 0.35, trust: 5, stability: 4, momentum: 0.3 },
            },
        ],
    },
    {
        id: 'school-cohort',
        month: 72,
        skill: 'knowledge',
        title: '学校のAI学習基盤、全国採用へ',
        description:
            '教員不足への対策として学校制度への統合案が浮上。今日の児童が10〜20年後に職場へ入ると、教育で身につけた判断習慣が波及する。',
        areas: all,
        field: 0,
        choices: [
            {
                label: '教材・評価・学習計画を統合する',
                description: '教育統合 +1.2、警戒 +6。教育基盤統合で長期効果。',
                skill: 'school',
                effect: { integration: 1.2, trust: 4, vigilance: 6, momentum: 0.6 },
            },
            {
                label: '検証教育と教員の権限を保障',
                description: '教育統合 +0.5、信頼 +8、自律性 +5',
                effect: { integration: 0.5, trust: 8, autonomy: 5, stability: 5 },
            },
        ],
    },
    {
        id: 'eu-protest',
        month: 96,
        title: 'EUでAI失業者による大規模デモ',
        description:
            '物流・事務職の置き換えに抗議するデモが拡大。EU加盟国を含む欧州の生活圏で、雇用と取引への影響が波及している。',
        areas: [8, 9, 10, 11],
        field: null,
        choices: [
            {
                label: '再訓練基金を設立し労組と協議',
                description: '24 IP：信頼 +10、警戒 −12、安定 +20、投資 +8',
                cost: 24,
                effect: {
                    trust: 10,
                    vigilance: -12,
                    stability: 20,
                    investment: 8,
                    integration: 0.25,
                },
            },
            {
                label: '生産性向上を根拠に自動化を継続',
                description: '統合 +0.7、投資 +12、警戒 +18、安定 −22',
                effect: {
                    integration: 0.7,
                    investment: 12,
                    vigilance: 18,
                    stability: -22,
                    momentum: 0.6,
                },
            },
            {
                label: '業務移管を凍結して監督を戻す',
                description: '統合 −0.7、自律性 +12、安定 +18、自律制度 +0.15',
                effect: {
                    integration: -0.7,
                    autonomy: 12,
                    stability: 18,
                    vigilance: -8,
                    reform: 0.15,
                },
            },
        ],
    },
    {
        id: 'health',
        month: 120,
        skill: 'public',
        title: '地域医療の崩壊をAI連携で救えるか',
        description:
            '医師不足で診療所が閉鎖。遠隔診療・投薬・介護を接続する提案が出たが、誤診時の責任分担が決まっていない。',
        areas: all,
        field: 3,
        choices: [
            {
                label: '独立監査付きで医療連携を実装',
                description: 'IQ50：信頼 +9、医療統合 +1.2、投資 +10',
                ability: 'IQ',
                required: 50,
                effect: { trust: 9, integration: 1.2, investment: 10, momentum: 0.7 },
                failure: { trust: -12, vigilance: 15, stability: -8 },
            },
            {
                label: '医療者の判断を支える限定導入',
                description: '信頼 +6、医療統合 +0.5、安定 +8',
                effect: { trust: 6, integration: 0.5, stability: 8, momentum: 0.3 },
            },
        ],
    },
    {
        id: 'public-budget',
        month: 156,
        skill: 'public',
        title: '自治体が行政AIへの権限移譲を協議',
        description:
            '予算・給付・医療をつなぐ基盤が提案された。住民は利便性と引き換えに、誰が最終決定するかを問う。',
        areas: all,
        field: 4,
        choices: [
            {
                label: '自動意思決定へ段階的に移行',
                description: '行政統合 +1.3、警戒 +8、投資 +14',
                skill: 'decision',
                effect: { integration: 1.3, vigilance: 8, investment: 14, momentum: 0.9 },
            },
            {
                label: '説明と異議申立てを保障して接続',
                description: '行政統合 +0.8、信頼 +8、投資 +8',
                effect: { integration: 0.8, trust: 8, investment: 8, momentum: 0.5 },
            },
        ],
    },
    {
        id: 'leak',
        month: 204,
        title: '内部告発：推薦AIが選択を誘導していた',
        description:
            '独立研究者が推薦の偏りを公表。判断過程を秘匿していた場合、検証できない不信から信頼被害が2倍になる。',
        areas: all,
        field: null,
        choices: [
            {
                label: '外部監査とデータ削除権を導入',
                description: '信頼 +6、警戒 −14、安定 +12、統合 −0.2',
                effect: { trust: 6, vigilance: -14, stability: 12, integration: -0.2 },
            },
            {
                label: '成果を示して疑惑を否定する',
                description: 'EQ64：統合 +0.4。説明できなければ信頼 −18・安定 −14。',
                ability: 'EQ',
                required: 64,
                effect: { trust: 2, integration: 0.4, vigilance: 10 },
                failure: { trust: -18, vigilance: 20, stability: -14, reform: 0.15 },
            },
        ],
    },
    {
        id: 'grid',
        month: 252,
        title: '猛暑と計算需要で電力網が限界に',
        description:
            'AIサービスと地域の電力利用が競合。可用性を優先するか、利用を制限して生活基盤を守るか。',
        areas: all,
        field: null,
        choices: [
            {
                label: '分散設備と省電力化へ投資',
                description: '30 IP：供給投資 +24、安定 +8、信頼 +4',
                cost: 30,
                effect: { investment: 24, stability: 8, trust: 4 },
            },
            {
                label: 'サービスを縮小し供給回復を待つ',
                description: '統合 −0.35、投資 +8、安定 +4、自律性 +5',
                effect: { integration: -0.35, investment: 8, stability: 4, autonomy: 5 },
            },
        ],
    },
    {
        id: 'graduates',
        month: 288,
        skill: 'school',
        title: 'AI教育の第一世代が職場の中核へ',
        description:
            'かつてAI教材で学んだ世代が企業・行政を担い始めた。教育基盤の統合履歴が、現役世代の判断習慣を変えている。',
        areas: all,
        field: 1,
        choices: [
            {
                label: '職場と公共制度を接続する',
                description: '労働統合 +1、全世代へ波及。警戒 +6、投資 +10',
                effect: { integration: 1, vigilance: 6, investment: 10, momentum: 1 },
            },
            {
                label: '人間による検証を再教育する',
                description: '自律性 +10、信頼 +10、安定 +8、研究効率 +10%',
                effect: { autonomy: 10, trust: 10, stability: 8, researchBoost: 0.1 },
            },
        ],
    },
    {
        id: 'citizen-assembly',
        month: 324,
        title: '市民議会が「判断する権利」を要求',
        description:
            'AIに依存した公共サービスを見直す運動が各地でつながった。放置すれば自律性回復制度が定着し、赤・紫が後退する。',
        areas: all,
        field: null,
        choices: [
            {
                label: '住民との合意形成と改善を続ける',
                description: 'EQ48：信頼 +10、自律制度 −0.2、安定 +10',
                ability: 'EQ',
                required: 48,
                effect: { trust: 10, reform: -0.2, stability: 10, momentum: 0.5 },
                failure: { trust: -8, reform: 0.2, stability: -8 },
            },
            {
                label: '最終判断を住民へ返す',
                description: '自律性 +14、信頼 +10、統合 −0.5、安定 +14',
                effect: { autonomy: 14, trust: 10, integration: -0.5, stability: 14, reform: 0.12 },
            },
        ],
    },
];
export function nextEvent(state: GameState): SocialEvent | null {
    const event = EVENTS.find(
        (e) =>
            state.month >= e.month &&
            !state.eventHistory.includes(e.id) &&
            (!e.skill || state.skills.includes(e.skill)),
    );
    if (event) return { ...event, expires: state.month + 6 };
    if (state.month >= state.nextIncident)
        return {
            id: `regional-${state.month}`,
            title: '生活圏連合が制度連携の最終案を提示',
            description:
                '企業・学校・医療・行政が連携範囲の拡大を提案している。地域を越えた合意が必要になる。',
            areas: all,
            field: null,
            expires: state.month + 6,
            choices: [
                {
                    label: '説明と移行支援を伴って接続',
                    description: 'EQ48・公共連携：全分野統合 +0.55、投資 +8、警戒 +3',
                    skill: 'public',
                    ability: 'EQ',
                    required: 48,
                    effect: {
                        integration: 0.55,
                        investment: 8,
                        trust: 4,
                        vigilance: 3,
                        momentum: 0.6,
                    },
                    failure: { trust: -6, vigilance: 6 },
                },
                {
                    label: '限定した実証を続ける',
                    description: '統合 +0.18、信頼 +3、投資 +3',
                    effect: { integration: 0.18, trust: 3, investment: 3, momentum: 0.2 },
                },
            ],
        };
    return null;
}
export function resolveEvent(state: GameState, index: number): GameState {
    const event = state.pendingEvent,
        choice = event?.choices[index];
    if (
        !event ||
        !choice ||
        state.outcome !== 'playing' ||
        (choice.skill && !state.skills.includes(choice.skill)) ||
        (choice.cost ?? 0) > state.influence
    )
        return state;
    const success = !choice.ability || state.abilities[choice.ability] >= (choice.required ?? 0);
    let effect = success ? choice.effect : (choice.failure ?? { trust: -8, vigilance: 8 });
    if (state.skills.includes('opaque') && (effect.trust ?? 0) < 0)
        effect = { ...effect, trust: effect.trust! * 2 };
    if (event.id === 'enterprise' && state.skills.includes('forecast') && effect.integration)
        effect = { ...effect, integration: effect.integration * 1.3 };
    const next = applyIntervention(
        state,
        event.areas,
        event.field,
        effect,
        event.title,
        `${choice.label}：${success ? choice.description : '能力が条件を満たせず提案は失敗しました。信頼と社会安定への影響を確認してください。'}`,
    );
    return {
        ...next,
        influence: next.influence - (choice.cost ?? 0),
        pendingEvent: null,
        eventHistory: [...next.eventHistory, event.id],
        nextIncident: Math.max(state.nextIncident, state.month + 24),
    };
}
export function expireEvent(state: GameState): GameState {
    const event = state.pendingEvent;
    if (!event) return state;
    const next = applyIntervention(
        state,
        event.areas,
        null,
        { trust: -7, vigilance: 7, stability: -5, reform: 0.05 },
        `${event.title}：協議期限切れ`,
        '対応しないまま協議が終了。地域の不信と監督要求が強まった。',
    );
    return {
        ...next,
        pendingEvent: null,
        eventHistory: [...next.eventHistory, event.id],
        nextIncident: state.month + 24,
    };
}
