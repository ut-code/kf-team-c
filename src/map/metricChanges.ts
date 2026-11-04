import type { AreaState } from '../game/types.ts';

export const METRIC_CHANGE_THRESHOLD = 0.03;
export const METRIC_CHANGE_DURATION = 1800;
export const MAP_METRICS = [{ key: 'favorability', label: 'AI好感度' }] as const;

export interface MetricChange {
    area: number;
    metric: (typeof MAP_METRICS)[number]['key'];
    label: string;
    delta: number;
}

export function detectMetricChanges(previous: AreaState[], current: AreaState[]): MetricChange[] {
    return current.flatMap((state, area) => {
        const before = previous[area];
        if (!before) return [];
        return MAP_METRICS.flatMap(({ key, label }) => {
            const delta = state[key] - before[key];
            // 0.58 → 0.61 など、ちょうど閾値の変化も浮動小数点誤差で落とさない。
            return Number.isFinite(delta) && Math.abs(delta) + 1e-9 >= METRIC_CHANGE_THRESHOLD
                ? [{ area, metric: key, label, delta }]
                : [];
        });
    });
}

/** 各指標は前回の通知時点を基準にし、通知した指標だけ累積をリセットする。 */
export function accumulateMetricChanges(baseline: AreaState[], current: AreaState[]) {
    const changes = detectMetricChanges(baseline, current);
    const nextBaseline = current.map((state, area) => ({ ...(baseline[area] ?? state) }));
    for (const change of changes) {
        nextBaseline[change.area][change.metric] = current[change.area][change.metric];
    }
    return { changes, baseline: nextBaseline };
}
