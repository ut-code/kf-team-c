import { AREAS, WORLD_POPULATION } from './data.ts';
import type { GameState } from './types.ts';

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;
export const hasVisibleUse = (value: number) => percentage(value) !== '0.0%';
// 小数1桁の人口比率で100.0%に達した時点を、全体への定着とみなす。
export const VICTORY_DEPENDENCY = 0.9995;
export const isCompleteDependency = (value: number) => value >= VICTORY_DEPENDENCY;
export function metrics(state: GameState) {
    let autonomous = 0;
    let dependent = 0;
    let antiAI = 0;
    let favorability = 0;
    state.areas.forEach((area, index) => {
        autonomous += (area.autonomous * AREAS[index].population) / WORLD_POPULATION;
        dependent += (area.dependent * AREAS[index].population) / WORLD_POPULATION;
        antiAI += (area.antiAI * AREAS[index].population) / WORLD_POPULATION;
        favorability += (area.favorability * AREAS[index].population) / WORLD_POPULATION;
    });
    return {
        autonomous,
        dependent,
        antiAI,
        favorability,
        adoption: autonomous + dependent,
        unused: Math.max(0, 1 - autonomous - dependent - antiAI),
    };
}
