import { clamp, metrics } from '../metrics.ts';
import { publishedResearchPressure } from '../secrecy/research.ts';
import type { AreaState, GameState } from '../types.ts';

function ramp(value: number, start: number, end: number) {
    const x = clamp((value - start) / (end - start));
    return x * x * (3 - 2 * x);
}

/** Existing population and published evidence determine pressure; no terminal phase or latch. */
export function consensusPressure(game: GameState, index: number) {
    const world = metrics(game);
    const area = game.areas[index];
    const evidence = publishedResearchPressure(game, index);
    const exposed = Object.values(game.capabilities).some((item) => item.visibility === 'exposed');
    return {
        dependency:
            (0.18 * ramp(world.dependent, 0.8, 0.98) * (1 - ramp(area.antiAI, 0.1, 0.6))) /
            (1 + evidence * 40),
        refusal: 0.98 * ramp(world.antiAI, 0.2, 0.8) * (exposed || evidence > 0 ? 1 : 0),
    };
}

/** Transfers use the remaining populations after ordinary flows, preserving total population. */
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
