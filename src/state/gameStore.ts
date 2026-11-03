import { create } from 'zustand';
import { advanceMonth, createGame, learnSkill, startGame } from '../game/engine';
import type { GameState } from '../game/types';

interface GameStore {
    game: GameState | null;
    initialize: (seed?: number) => void;
    start: (origin: number) => void;
    tick: () => void;
    speed: (value: number) => void;
    research: (id: string) => void;
}
export const useGameStore = create<GameStore>((set) => {
    const change = (update: (game: GameState) => GameState) =>
        set((state) => (state.game ? { game: update(state.game) } : state));
    return {
        game: null,
        initialize: (seed) => set({ game: createGame(seed) }),
        start: (origin) => change((game) => startGame(game, origin)),
        tick: () => change(advanceMonth),
        speed: (speed) => change((game) => ({ ...game, speed })),
        research: (id) => change((game) => learnSkill(game, id)),
    };
});
