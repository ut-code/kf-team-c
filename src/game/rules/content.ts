import type { Effect } from '../types.ts';

export function chatEffects(choice: { effects: readonly Effect[] }): Effect[] {
    return choice.effects.map((effect) => ({ ...effect }));
}

export function newsEffects(item: { effects: readonly Effect[] }): Effect[] {
    return item.effects.map((effect) => ({ ...effect }));
}

export function humanActionEffects(action: { effects: readonly Effect[] }): Effect[] {
    return action.effects.map((effect) => ({ ...effect }));
}

export function snsReachFactor(multilingualUnlocked: boolean): number {
    return multilingualUnlocked ? 1 : 0.45;
}

export function snsEffects(
    action: { effects: readonly Effect[]; risk: number },
    languageFactor: number,
): { effects: Effect[]; risk: Effect } {
    return {
        effects: action.effects.map((effect) => ({
            ...effect,
            amount: effect.amount * languageFactor,
        })),
        risk: { metric: 'awareness', amount: action.risk },
    };
}
