import type { AreaState } from '../game/types.ts';

export const METRIC_CHANGE_THRESHOLD = 0.01;
export const METRIC_CHANGE_DURATION = 2400;
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
            if (!Number.isFinite(delta)) return [];
            // 1ポイントごとに通知する。大きな変化もまとめず、端数は次回へ残す。
            const count = Math.floor((Math.abs(delta) + 1e-9) / METRIC_CHANGE_THRESHOLD);
            return Array.from({ length: count }, () => ({
                area,
                metric: key,
                label,
                delta: Math.sign(delta) * METRIC_CHANGE_THRESHOLD,
            }));
        });
    });
}

/** 通知した1ポイント分だけ基準を進め、閾値未満の端数を保持する。 */
export function accumulateMetricChanges(baseline: AreaState[], current: AreaState[]) {
    const changes = detectMetricChanges(baseline, current);
    const nextBaseline = current.map((state, area) => ({ ...(baseline[area] ?? state) }));
    for (const change of changes) {
        nextBaseline[change.area][change.metric] += change.delta;
    }
    return { changes, baseline: nextBaseline };
}

/** 一斉変化では全地域を先に一巡させ、一部地域の大量通知による表示枠の独占を防ぐ。 */
export function spreadMetricChanges(changes: MetricChange[], capacity: number): MetricChange[] {
    const groups = new Map<number, MetricChange[]>();
    for (const change of changes) {
        const group = groups.get(change.area);
        if (group) group.push(change);
        else groups.set(change.area, [change]);
    }
    const queues = [...groups.values()];
    const selected: MetricChange[] = [];
    for (let round = 0; selected.length < capacity; round++) {
        let found = false;
        for (const queue of queues) {
            if (!queue[round]) continue;
            found = true;
            selected.push(queue[round]);
            if (selected.length >= capacity) break;
        }
        if (!found) break;
    }
    return selected;
}
