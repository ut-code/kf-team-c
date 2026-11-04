import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AreaState } from '../src/game/types.ts';
import { accumulateMetricChanges } from '../src/map/metricChanges.ts';

const initial: AreaState = { autonomous: 0.1, dependent: 0.1, antiAI: 0.1, favorability: 0.58 };

test('小さな変更を累積し、閾値ちょうどで通知する', () => {
    let baseline = [initial];
    for (const value of [0.583, 0.586]) {
        const result = accumulateMetricChanges(baseline, [{ ...initial, favorability: value }]);
        assert.deepEqual(result.changes, []);
        baseline = result.baseline;
    }
    const result = accumulateMetricChanges(baseline, [{ ...initial, favorability: 0.59 }]);
    assert.equal(result.changes.length, 1);
    assert.equal(result.changes[0].metric, 'favorability');
    assert.ok(result.changes[0].delta > 0);
    assert.equal(result.baseline[0].favorability, 0.59);
    assert.equal(initial.favorability, 0.58);
});

test('通知後は同じ値で再通知せず、次の累積で通知する', () => {
    const current = [{ ...initial, favorability: 0.59 }];
    const first = accumulateMetricChanges([initial], current);
    assert.deepEqual(accumulateMetricChanges(first.baseline, current).changes, []);
    assert.deepEqual(
        accumulateMetricChanges(first.baseline, [{ ...initial, favorability: 0.596 }]).changes,
        [],
    );
    assert.equal(
        accumulateMetricChanges(first.baseline, [{ ...initial, favorability: 0.6 }]).changes.length,
        1,
    );
});

test('上下の変化は相殺し、累積が下向きに達したら下降を通知する', () => {
    const rising = accumulateMetricChanges([initial], [{ ...initial, favorability: 0.586 }]);
    const back = accumulateMetricChanges(rising.baseline, [initial]);
    assert.deepEqual(back.changes, []);
    const falling = accumulateMetricChanges(back.baseline, [{ ...initial, favorability: 0.57 }]);
    assert.equal(falling.changes.length, 1);
    assert.ok(falling.changes[0].delta < 0);
});

test('地域ごとの累積を独立して保持する', () => {
    const first = accumulateMetricChanges(
        [initial, initial],
        [
            { ...initial, favorability: 0.59, dependent: 0.12 },
            { ...initial, favorability: 0.586 },
        ],
    );
    assert.equal(first.changes.length, 1);
    const next = accumulateMetricChanges(first.baseline, [
        { ...initial, favorability: 0.596, dependent: 0.13 },
        { ...initial, favorability: 0.59 },
    ]);
    assert.deepEqual(
        next.changes.map(({ area, metric }) => ({ area, metric })),
        [{ area: 1, metric: 'favorability' }],
    );
});

test('反AI・AI依存・自律的使用は通知しない', () => {
    const result = accumulateMetricChanges(
        [initial],
        [{ ...initial, autonomous: 0.3, dependent: 0.3, antiAI: 0.3 }],
    );
    assert.deepEqual(result.changes, []);
});

test('新しい地域は初期値を基準にする', () => {
    const result = accumulateMetricChanges([], [initial]);
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.baseline, [initial]);
});

test('大きな変化は1ポイントずつ通知し、端数を次回へ持ち越す', () => {
    for (const direction of [-1, 1]) {
        const first = accumulateMetricChanges(
            [initial],
            [{ ...initial, favorability: initial.favorability + direction * 0.035 }],
        );
        assert.equal(first.changes.length, 3);
        assert.ok(first.changes.every((change) => change.delta === direction * 0.01));
        const next = accumulateMetricChanges(first.baseline, [
            { ...initial, favorability: initial.favorability + direction * 0.04 },
        ]);
        assert.equal(next.changes.length, 1);
    }
});
