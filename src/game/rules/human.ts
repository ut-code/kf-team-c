export function humanStage(awareness: number, thresholds: readonly number[]): number {
    return thresholds.reduce((stage, threshold) => stage + Number(awareness >= threshold), 0);
}

export function eligibleHumanActions<T extends { id: string; stage: number }>(
    actions: readonly T[],
    stage: number,
    observedFacilities: number,
    hasIsolatedFacility: boolean,
): T[] {
    return actions.filter(
        (action) =>
            action.stage <= stage &&
            (action.id !== 'isolate' || observedFacilities > 0) &&
            (action.id !== 'reclaim' || hasIsolatedFacility),
    );
}

export function isolationResponse(
    dependency: number,
    awareness: number,
    protection: number,
    shutdownHesitation: number,
    emergencyAwareness: number,
): 'defer' | 'avoid' | 'isolate' {
    if (dependency >= shutdownHesitation && awareness < emergencyAwareness) return 'defer';
    return protection >= 5 ? 'avoid' : 'isolate';
}

export function shutdownChange(
    stage: number,
    finalStage: number,
    countermeasure: number,
    counterThreshold: number,
    observedFacilities: number,
    defense: number,
): number {
    return stage === finalStage &&
        countermeasure > counterThreshold &&
        observedFacilities > 0
        ? Math.max(-2, 1 - defense / 16)
        : -(1 + defense / 20);
}
