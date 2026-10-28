import type { GameEvent, GameState } from './types.ts';

/** 描画時刻を持たない連番付きイベント。表示・消去時間はUIが管理する。 */
export function publishEvent(
    state: GameState,
    kind: GameEvent['kind'],
    title: string,
    message: string,
    country?: string,
) {
    state.events.push({ id: state.nextEvent++, tick: state.tick, kind, title, message, country });
    state.events = state.events.slice(-200);
}
