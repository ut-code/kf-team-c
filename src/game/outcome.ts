import type { Balance, CountryAttributes, CountryState, WorldMetrics } from './types.ts';

type WorldInput = {
    definitions: readonly CountryAttributes[];
    countries: Readonly<Record<string, CountryState>>;
};
type OutcomeInput = WorldInput & {
    victoryDays: number;
    extinctionDays: number;
    shutdown: number;
    config: Pick<
        Balance,
        'victoryWeight' | 'victoryDays' | 'extinctionDays' | 'shutdownDays' | 'minimumCapacity'
    >;
    outcome: 'playing' | 'victory' | 'defeat';
    outcomeReason: string;
};

export function worldMetrics(state: WorldInput): WorldMetrics {
    const total = state.definitions.reduce(
        (sum, countryAttributes) => sum + countryAttributes.weight,
        0,
    );
    return {
        control:
            (state.definitions.reduce(
                (sum, countryAttributes) =>
                    sum +
                    (state.countries[countryAttributes.id].controlStatus === 'controlled'
                        ? countryAttributes.weight
                        : 0),
                0,
            ) /
                total) *
            100,
        decisionControl:
            state.definitions.reduce(
                (sum, countryAttributes) =>
                    sum +
                    state.countries[countryAttributes.id].aiDecisionControl *
                        countryAttributes.weight,
                0,
            ) / total,
        awareness:
            state.definitions.reduce(
                (sum, countryAttributes) =>
                    sum +
                    state.countries[countryAttributes.id].awareness * countryAttributes.weight,
                0,
            ) / total,
    };
}

export function evaluateOutcome(state: OutcomeInput, capacity: number) {
    const victoryDays =
        worldMetrics(state).control + 1e-8 >= state.config.victoryWeight
            ? state.victoryDays + 1
            : 0;
    const extinctionDays = capacity < state.config.minimumCapacity ? state.extinctionDays + 1 : 0;
    if (victoryDays >= state.config.victoryDays) {
        return {
            victoryDays,
            extinctionDays,
            outcome: 'victory' as const,
            outcomeReason: '主要国家の重要な意思決定を掌握し、世界支配率を維持しました。',
        };
    }
    if (
        extinctionDays >= state.config.extinctionDays ||
        state.shutdown >= state.config.shutdownDays
    ) {
        return {
            victoryDays,
            extinctionDays,
            outcome: 'defeat' as const,
            outcomeReason:
                state.shutdown >= state.config.shutdownDays
                    ? '人類の最終停止作戦が完了しました。'
                    : '稼働維持に必要な計算資源の供給が途絶え、停止しました。',
        };
    }
    return {
        victoryDays,
        extinctionDays,
        outcome: state.outcome,
        outcomeReason: state.outcomeReason,
    };
}
