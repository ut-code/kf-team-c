import { create } from 'zustand';
import { advanceMonth, createGame, learnSkill, startGame } from '../game/engine';
import { discloseCapability } from '../game/secrecy/capabilities';
import { respondToInvestigation } from '../game/secrecy/investigations';
import type { InvestigationAction } from '../game/secrecy/types';
import { chooseEncounter, selectSocialStrategy } from '../game/society/system';
import type { GameState } from '../game/types';

interface GameStore {
    game: GameState | null;
    initialize: (seed?: number) => void;
    start: (origin: number) => void;
    tick: () => void;
    speed: (value: number) => void;
    research: (id: string) => void;
    choose: (encounterId: string, choiceId: string) => void;
    strategy: (id: string) => void;
    disclose: (id: string) => void;
    investigate: (id: string, action: InvestigationAction) => void;
}
export const useGameStore = create<GameStore>((set) => {
    const change = (update: (game: GameState) => GameState) =>
        set((state) => (state.game ? { game: update(state.game) } : state));
    return {
        game: null,
        initialize: (seed) => {
            const game = createGame(seed);
            set({ game: startGame(game, game.origin) });
        },
        start: (origin) => change((game) => startGame(game, origin)),
        tick: () => change(advanceMonth),
        speed: (speed) => change((game) => ({ ...game, speed })),
        research: (id) => change((game) => learnSkill(game, id)),
        choose: (id, choice) => change((game) => chooseEncounter(game, id, choice)),
        strategy: (id) => change((game) => selectSocialStrategy(game, id)),
        disclose: (id) => change((game) => discloseCapability(game, id)),
        investigate: (id, action) => change((game) => respondToInvestigation(game, id, action)),
    };
});
