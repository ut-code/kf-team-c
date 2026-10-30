import type { Effect, FacilityState } from '../types.ts';

export function facilityCapacityValue(input: {
    capacity: number;
    level: number;
    infrastructure: number;
    modeMultiplier: number;
    accessMultiplier: number;
    expansion: number;
    computeBonus: number;
}): number {
    return (
        input.capacity *
        input.level *
        (input.infrastructure / 100) *
        input.modeMultiplier *
        input.accessMultiplier *
        (1 + input.expansion) *
        input.computeBonus
    );
}

export function hackDifficultyValue(
    tier: number,
    countermeasure: number,
    awareness: number,
    hackBonus: number,
): number {
    return (tier * (1 + countermeasure / 65 + awareness / 200)) / hackBonus;
}

export function facilityRisk(
    modeRisk: number,
    stealthBonus: number,
    order: FacilityState['order'],
    concealMultiplier: number,
): number {
    return modeRisk * (1 - stealthBonus) * (order === 'conceal' ? concealMultiplier : 1);
}

export function facilityExposure(
    exposure: number,
    risk: number,
    defense: number,
    mode: FacilityState['mode'],
    rates: {
        exposurePerRisk: number;
        defenseExposureReduction: number;
        stealthExposureReduction: number;
    },
): number {
    return (
        exposure +
        risk * rates.exposurePerRisk -
        defense * rates.defenseExposureReduction -
        (mode === 'stealth' ? rates.stealthExposureReduction : 0)
    );
}

export function facilitySupportEffect(
    effect: Effect,
    accessMultiplier: number,
    infrastructure: number,
    decisionUnlocked: boolean,
    targetAccessible: boolean,
): Effect | null {
    if (effect.countryStateKey === 'aiDecisionControl' && (!decisionUnlocked || !targetAccessible))
        return null;
    return { ...effect, amount: effect.amount * accessMultiplier * (infrastructure / 100) };
}

export function facilityDisruptEffects(
    effects: readonly (Effect & { label: string })[],
): (Effect & { source: string })[] {
    return effects.map(({ label, ...effect }) => ({ ...effect, source: label }));
}
