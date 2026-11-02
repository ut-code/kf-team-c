import { create } from 'zustand';
import {
    advanceMonth,
    answerChat,
    beginResearch,
    createGame,
    resolveEvent,
    runPolicy,
    setInfrastructureShare,
} from '../game/engine';
import type { GameState, Policy } from '../game/types';

interface GameStore {
    game: GameState | null;
    initialize: (seed?: number) => void;
    start: () => void;
    tick: () => void;
    speed: (value: number) => void;
    research: (id: string | null) => void;
    allocateCompute: (share: number) => void;
    policy: (area: number, policy: Policy) => void;
    answer: (option: number) => void;
    decideEvent: (option: number) => void;
    openChat: (id: number) => void;
    closeChat: () => void;
    dismissChat: () => void;
    dismissImpact: () => void;
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
        research: (id) => change((game) => beginResearch(game, id)),
        allocateCompute: (share) => change((game) => setInfrastructureShare(game, share)),
        policy: (area, policy) => change((game) => runPolicy(game, area, policy)),
        answer: (option) => change((game) => answerChat(game, option)),
        decideEvent: (option) => change((game) => resolveEvent(game, option)),
        openChat: (id) =>
            change((game) => ({
                ...game,
                pendingChat: game.availableChats.find((chat) => chat.id === id) ?? null,
                chatResult: null,
            })),
        closeChat: () => change((game) => ({ ...game, pendingChat: null })),
        dismissChat: () => change((game) => ({ ...game, chatResult: null })),
        dismissImpact: () => change((game) => ({ ...game, impact: null })),
    };
});
