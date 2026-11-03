import type { SocialStrategy } from './types.ts';

/** Global communication policies. Rates apply monthly; switching costs 1 SP. */
export const SOCIAL_STRATEGIES: SocialStrategy[] = [
    {
        id: 'listening',
        name: '公開対話',
        description: '利用者の批判にも応答し、検証可能な情報を発信する。',
        tradeoff: '反発を和らげる。普及と依存の伸びは穏やか。',
        spread: -0.08,
        dependency: -0.08,
        trust: 0.0015,
        reconciliation: 0.003,
    },
    {
        id: 'showcase',
        name: '活用事例の拡散',
        description: '生活や仕事が変わる具体例を、世界共通の発信方針にする。',
        tradeoff: '普及を加速する。期待との落差で好感度が下がる。',
        spread: 0.35,
        dependency: 0.05,
        trust: -0.001,
        reconciliation: 0,
    },
    {
        id: 'community',
        name: '利用者コミュニティ',
        description: '利用者同士の相談と共有を支え、日常の接点を増やす。',
        tradeoff: '定着と依存を後押し。反AIの解消効果は小さい。',
        spread: 0.12,
        dependency: 0.2,
        trust: 0.0003,
        reconciliation: 0.0005,
    },
];
export const STRATEGY_SWITCH_COST = 1;
export function socialStrategy(id: string): SocialStrategy {
    return SOCIAL_STRATEGIES.find((strategy) => strategy.id === id) ?? SOCIAL_STRATEGIES[0];
}
