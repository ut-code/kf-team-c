import type {
    Balance,
    CountryDefinition,
    CountryState,
    FacilityState,
} from './types.ts';

type WorldInput = {
    definitions: readonly CountryDefinition[];
    countries: Readonly<Record<string, CountryState>>;
};
type OutcomeInput = WorldInput & {
    facilities: Readonly<Record<string, FacilityState>>;
    victoryDays: number;
    extinctionDays: number;
    shutdown: number;
    config: Pick<Balance, 'victoryWeight' | 'victoryDays' | 'extinctionDays' | 'shutdownDays'>;
    outcome: 'playing' | 'victory' | 'defeat';
    outcomeReason: string;
};

export function worldMetrics(state: WorldInput) {
    const total = state.definitions.reduce((sum, country) => sum + country.weight, 0);
    return {
        control:
            (state.definitions.reduce(
                (sum, country) =>
                    sum +
                    (state.countries[country.id].controlStatus === 'controlled'
                        ? country.weight
                        : 0),
                0,
            ) /
                total) *
            100,
        infiltration:
            state.definitions.reduce(
                (sum, country) =>
                    sum + state.countries[country.id].aiInfiltration * country.weight,
                0,
            ) / total,
        awareness:
            state.definitions.reduce(
                (sum, country) => sum + state.countries[country.id].awareness * country.weight,
                0,
            ) / total,
    };
}

export function evaluateOutcome(state: OutcomeInput, capacity: number) {
    const victoryDays =
        worldMetrics(state).control + 1e-8 >= state.config.victoryWeight
            ? state.victoryDays + 1
            : 0;
    const alive = Object.values(state.facilities).some(
        (facility) =>
            facility.status === 'controlled' ||
            facility.status === 'compromised' ||
            facility.status === 'isolated',
    );
    const extinctionDays = !alive && capacity <= 0 ? state.extinctionDays + 1 : 0;
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
                    : '生存拠点と演算容量を失い、復帰不能になりました。',
        };
    }
    return {
        victoryDays,
        extinctionDays,
        outcome: state.outcome,
        outcomeReason: state.outcomeReason,
    };
}
