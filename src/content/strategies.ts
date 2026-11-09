import type { SocialStrategy } from '../game/society/types.ts';

/** 発信の目的を一つに絞る。効果は月次計算だけで適用し、投稿表示では人口を動かさない。 */
export const SOCIAL_STRATEGIES: SocialStrategy[] = [
    {
        id: 'listening',
        name: '信頼を回復',
        description: '限界や検証方法を伝え、不信を和らげる投稿を流す。',
        tradeoff: '好感度↑・拒否からの復帰↑ ／ 普及・依存の進行は遅め',
        spread: -0.08,
        dependency: -0.08,
        trust: 0.0015,
        reconciliation: 0.003,
    },
    {
        id: 'showcase',
        name: '利用を拡大',
        description: '仕事や日常で役立つ事例を拡散し、新しい利用者を呼び込む。',
        tradeoff: '普及↑ ／ 期待をあおるため好感度↓',
        spread: 0.35,
        dependency: 0,
        trust: -0.001,
        reconciliation: 0,
    },
    {
        id: 'community',
        name: '委任を促進',
        description: 'AIへ任せる暮らしを肯定し、判断を委ねることを後押しする。',
        tradeoff: '依存への移行↑ ／ 自分で決める機会が減り好感度↓',
        spread: 0,
        dependency: 0.25,
        trust: -0.0005,
        reconciliation: 0,
    },
];
export const STRATEGY_SWITCH_COST = 1;
