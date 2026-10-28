import type { GameState } from './types.ts';

export function worldMetrics(state: GameState) {
    const total = state.definitions.reduce((n, c) => n + c.weight, 0);
    return {
        control:
            (state.definitions.reduce(
                (n, c) => n + (state.countries[c.id].controlStatus === 'controlled' ? c.weight : 0),
                0,
            ) /
                total) *
            100,
        infiltration:
            state.definitions.reduce(
                (n, c) => n + state.countries[c.id].aiInfiltration * c.weight,
                0,
            ) / total,
        awareness:
            state.definitions.reduce((n, c) => n + state.countries[c.id].awareness * c.weight, 0) /
            total,
    };
}

/** 勝利の維持期間と、実際の拠点喪失・停止作戦による敗北を独立して判定する。 */
export function evaluateOutcome(state: GameState, capacity: number) {
    state.victoryDays =
        worldMetrics(state).control + 1e-8 >= state.config.victoryWeight
            ? state.victoryDays + 1
            : 0;
    const alive = Object.values(state.facilities).some(
        (f) => f.status === 'controlled' || f.status === 'compromised' || f.status === 'isolated',
    );
    state.extinctionDays = !alive && capacity <= 0 ? state.extinctionDays + 1 : 0;
    if (state.victoryDays >= state.config.victoryDays) {
        state.outcome = 'victory';
        state.outcomeReason = '主要国家の重要な意思決定を掌握し、世界支配率を維持しました。';
    } else if (
        state.extinctionDays >= state.config.extinctionDays ||
        state.shutdown >= state.config.shutdownDays
    ) {
        state.outcome = 'defeat';
        state.outcomeReason =
            state.shutdown >= state.config.shutdownDays
                ? '人類の最終停止作戦が完了しました。'
                : '生存拠点と演算容量を失い、復帰不能になりました。';
    }
}
