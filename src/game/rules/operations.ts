import type { Effect } from '../types.ts';

export function hackProgress(capacity: number, difficulty: number): number {
    return capacity / difficulty;
}

export function hackExposureChange(
    capacity: number,
    exposurePerCapacity: number,
    stealthBonus: number,
): number {
    return capacity * exposurePerCapacity * (1 - stealthBonus);
}

export function hackAwarenessEffect(
    capacity: number,
    awarenessPerCapacity: number,
    stealthBonus: number,
): Effect {
    return {
        countryStateKey: 'awareness',
        amount: capacity * awarenessPerCapacity * (1 - stealthBonus),
    };
}

export function upgradeProgress(capacity: number, connectedSemiconductors: number): number {
    return capacity * (1 + connectedSemiconductors * 0.15);
}

export function researchFacilityBoost(research: number, infrastructure: number): number {
    return (research * infrastructure) / 100;
}

export function researchProgress(
    capacity: number,
    speed: number,
    researchBonus: number,
    facilityBoost: number,
): number {
    return capacity * speed * (researchBonus + facilityBoost);
}
