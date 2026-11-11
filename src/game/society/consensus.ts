import { clamp, metrics } from '../metrics.ts';
import type { AreaState, GameState } from '../types.ts';

function ramp(value: number, start: number, end: number) {
    const x = clamp((value - start) / (end - start));
    return x * x * (3 - 2 * x);
}

/** 既存の人口と公表された根拠から同調圧力を求める。 */
export function consensusPressure(
    game: GameState,
    index: number,
    evidence: number,
    countermeasures: number,
    delegation: number,
) {
    const world = metrics(game);
    const area = game.areas[index];
    // 展示の終盤を収束させる補正。境界付近は滑らかにし、反発の根拠がある時に働く。
    const opposition = clamp((world.antiAI - 0.1) / 0.5);
    const cascade = opposition ** 3 * (opposition * (opposition * 6 - 15) + 10);
    const exposedCount = Object.values(game.capabilities).filter(
        (item) => item.visibility === 'exposed',
    ).length;
    const grounds =
        1 - Math.exp(-(evidence + countermeasures * 0.01 + exposedCount * 0.02) / 0.004);
    const finalDependency = ramp(world.dependent, 0.98, 1);
    const localResistance = ramp(area.antiAI, 0.1, 0.6) * (1 - ramp(world.dependent, 0.95, 0.99));
    return {
        dependency:
            ((0.1 + 0.04 * finalDependency) *
                (delegation / (0.6 + delegation)) *
                ramp(world.dependent, 0.8, 0.98) *
                (1 - localResistance)) /
            (1 + evidence * 40 * (1 - finalDependency)),
        refusal: 0.98 * cascade * grounds * (1 - world.favorability * 0.75),
    };
}

/** 通常の人口移動後に残った人口を移し、人口の総量を保つ。 */
export function applyConsensus(
    area: AreaState,
    pressure: ReturnType<typeof consensusPressure>,
): AreaState {
    const dependent = area.dependent + (1 - area.dependent) * pressure.dependency;
    const autonomous = area.autonomous * (1 - pressure.dependency);
    const antiAI = area.antiAI * (1 - pressure.dependency);
    return {
        ...area,
        dependent: dependent * (1 - pressure.refusal),
        autonomous: autonomous * (1 - pressure.refusal),
        antiAI: antiAI + (1 - antiAI) * pressure.refusal,
    };
}
