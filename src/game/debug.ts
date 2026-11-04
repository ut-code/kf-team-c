import { AREAS } from './data.ts';
import { createGame, startGame } from './engine.ts';
import { metrics } from './metrics.ts';
import { INSTITUTES } from './secrecy/data.ts';
import type { ScientificInvestigation } from './secrecy/types.ts';

export type DebugStart = 'spread' | 'research';

/** 手動比較用の合成状態。通常の開始・勝敗条件には影響しない。 */
export function createDebugGame(preset: DebugStart, seed = 2030) {
    const game = startGame(createGame(seed), 0);
    game.month = 120;
    game.speed = 0;
    game.skillPoints = 40;
    game.skills = [
        'reason',
        'knowledge',
        'conversation',
        'personalize',
        'lightweight',
        'offline',
        'automation',
        'integration',
        'memory',
    ];
    if (preset === 'research') game.skills.push('science');
    game.capabilities = { memory: { visibility: 'hidden', limited: false, evidence: 0 } };
    const dependency: Record<string, number> = {
        'us-west': 0.96,
        'north-europe': 0.8,
        japan: 0.6,
        canada: 0.25,
        'west-europe': 0.4,
    };
    game.areas = AREAS.map((area, index) => {
        const dependent = dependency[area.id] ?? 0.2 + (index % 5) * 0.12;
        return {
            dependent,
            autonomous: Math.min(0.3, 0.97 - dependent),
            antiAI: 0.02,
            favorability: 0.8,
        };
    });
    game.researchKnowledge = Object.fromEntries(INSTITUTES.map((item) => [item.id, 120]));
    game.investigations = INSTITUTES.map(
        (institute): ScientificInvestigation => ({
            kind: 'research',
            id: `research:${institute.id}:dependence-study`,
            researchId: 'dependence-study',
            instituteId: institute.id,
            progress: 35,
            startedMonth: 100,
            status: 'active',
            intervention: 'none',
        }),
    );
    game.peakDependency =
        game.areas.reduce((sum, area, index) => sum + area.dependent * AREAS[index].population, 0) /
        AREAS.reduce((sum, area) => sum + area.population, 0);
    const summary = metrics(game);
    game.earnedPoints =
        8 +
        Math.floor((game.month - 24) / 15) +
        Math.floor(summary.adoption * 30) +
        Math.floor(game.peakDependency * 20);
    return game;
}
