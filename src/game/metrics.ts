import type { CountryMetrics, CountryState } from './types.ts';

type DefenseInput = Pick<
    CountryState,
    'aiDefenseTechnology' | 'economy' | 'governmentCapacity' | 'awareness' | 'aiDecisionControl'
>;

/** 技術の蓄積と、現在の資源・行政・警戒・意思決定の自立性から防御の実効性を算出する。保存はしない。 */
export function countryMetrics(countryState: DefenseInput): CountryMetrics {
    return {
        aiDefenseEffectiveness:
            countryState.aiDefenseTechnology *
            Math.sqrt((countryState.economy / 100) * (countryState.governmentCapacity / 100)) *
            (0.5 + (0.5 * countryState.awareness) / 100) *
            (1 - countryState.aiDecisionControl / 110),
    };
}
