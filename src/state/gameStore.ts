import { create } from 'zustand';
import { createDebugGame, type DebugStart, logPopulationChange } from '../game/debug';
import { advanceMonth, createGame, learnSkill, startGame } from '../game/engine';
import {
    createNotifications,
    type NotificationState,
    updateNotifications,
} from '../game/notifications';
import {
    createSocialFeed,
    emptySocialFeed,
    type SocialFeedState,
    updateSocialFeed,
} from '../game/society/socialFeed';
import type { GameState } from '../game/types';

interface GameStore {
    game: GameState | null;
    session: number;
    notifications: NotificationState;
    socialFeed: SocialFeedState;
    dismissNotification: (id: string) => void;
    initialize: (seed?: number) => void;
    start: (origin: number) => void;
    initializeDebug: (preset: DebugStart) => void;
    tick: () => void;
    speed: (value: number) => void;
    research: (id: string) => void;
}
export const useGameStore = create<GameStore>((set) => {
    const change = (update: (game: GameState) => GameState) =>
        set((state) => {
            if (!state.game) return state;
            const game = update(state.game);
            if (game === state.game) return state;
            return {
                game,
                socialFeed: state.game.started
                    ? updateSocialFeed(state.game, game, state.socialFeed)
                    : createSocialFeed(game),
                notifications: state.game.started
                    ? updateNotifications(state.game, game, state.notifications)
                    : createNotifications(game),
            };
        });
    return {
        game: null,
        session: 0,
        notifications: { items: [], seen: new Set() },
        socialFeed: emptySocialFeed(),
        dismissNotification: (id) =>
            set((state) => ({
                notifications: {
                    ...state.notifications,
                    items: state.notifications.items.filter((item) => item.id !== id),
                },
            })),
        initialize: (seed) => {
            const game = createGame(seed);
            const debug = new URLSearchParams(window.location.search).get('debug');
            const initial =
                import.meta.env.DEV && (debug === 'spread' || debug === 'research')
                    ? createDebugGame(debug, seed)
                    : game;
            set((state) => ({
                session: state.session + 1,
                game: initial,
                socialFeed: createSocialFeed(initial),
                notifications: createNotifications(initial),
            }));
        },
        initializeDebug: (preset) => {
            if (import.meta.env.DEV) {
                const game = createDebugGame(preset);
                set((state) => ({
                    game,
                    socialFeed: createSocialFeed(game),
                    session: state.session + 1,
                    notifications: createNotifications(game),
                }));
            }
        },
        start: (origin) => change((game) => startGame(game, origin)),
        tick: () =>
            change((game) =>
                advanceMonth(game, import.meta.env.DEV ? logPopulationChange : undefined),
            ),
        speed: (speed) => change((game) => ({ ...game, speed })),
        research: (id) => change((game) => learnSkill(game, id)),
    };
});
