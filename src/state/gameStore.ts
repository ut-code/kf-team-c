import { create } from 'zustand';
import { applyAction, createInitialState, simulateTick } from '../game/engine.ts';
import type { Action, GameState } from '../game/types.ts';

interface GameStore {
    game: GameState | null;
    speed: number;
    initialize: (countries: { id: string; name: string }[], seed?: number) => void;
    dispatch: (action: Action) => void;
    step: () => void;
    setSpeed: (speed: number) => void;
}
export const useGameStore = create<GameStore>((set) => ({
    game: null,
    speed: 0,
    initialize: (countries, seed = 42) =>
        set({ game: createInitialState(countries, seed), speed: 0 }),
    dispatch: (action) => set((s) => (s.game ? { game: applyAction(s.game, action) } : {})),
    step: () => set((s) => (s.game ? { game: simulateTick(s.game) } : {})),
    setSpeed: (speed) => set({ speed }),
}));
