import { create } from 'zustand';
import {
    advanceMonth,
    answerChat,
    campaign,
    createGame,
    setAllocation,
    unlockSkill,
} from '../game/engine';
import type { Ability, Field, GameState } from '../game/types';

interface GameStore {
    game: GameState | null;
    initialize: (seed?: number) => void;
    start: () => void;
    tick: () => void;
    speed: (value: number) => void;
    allocate: (ability: Ability, value: number) => void;
    focus: (field: Field) => void;
    unlock: (id: string) => void;
    campaign: (area: number) => void;
    answer: (option: number) => void;
    openChat: (id: number) => void;
    closeChat: () => void;
    dismissChat: () => void;
}

export const useGameStore = create<GameStore>((set) => {
    const change = (update: (game: GameState) => GameState) =>
        set((state) => (state.game ? { game: update(state.game) } : state));
    return {
        game: null,
        initialize: (seed) => set({ game: createGame(seed) }),
        start: () => change((game) => ({ ...game, started: true })),
        tick: () => change(advanceMonth),
        speed: (speed) => change((game) => ({ ...game, speed })),
        allocate: (ability, value) => change((game) => setAllocation(game, ability, value)),
        focus: (focus) => change((game) => ({ ...game, focus })),
        unlock: (id) => change((game) => unlockSkill(game, id)),
        campaign: (area) => change((game) => campaign(game, area)),
        answer: (option) => change((game) => answerChat(game, option)),
        openChat: (id) =>
            change((game) => ({
                ...game,
                pendingChat: game.availableChats.find((chat) => chat.id === id) ?? null,
                chatResult: null,
            })),
        closeChat: () => change((game) => ({ ...game, pendingChat: null })),
        dismissChat: () => change((game) => ({ ...game, chatResult: null })),
    };
});
