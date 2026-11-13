import { AREAS } from './data.ts';
import { earnedSkillPoints } from './economy.ts';
import { isEncounterLocationOccupied } from './encounterLocations.ts';
import { createGame, startGame } from './engine.ts';
import { metrics } from './metrics.ts';
import { INSTITUTES } from './secrecy/data.ts';
import type { ScientificInvestigation } from './secrecy/types.ts';
import type { GameState } from './types.ts';

export type DebugStart = 'spread' | 'research';

/** 開発時だけ呼び出す。表示用の状態や履歴は追加せず、処理ごとの実測値を出す。 */
export function logPopulationChange(
    phase: string,
    before: GameState,
    after: GameState,
    flows?: Record<string, number>,
) {
    const from = metrics(before);
    const to = metrics(after);
    const publications = after.investigations.filter(
        (item) =>
            item.status === 'published' &&
            before.investigations.find((other) => other.id === item.id)?.status !== 'published',
    );
    if (to.adoption >= from.adoption && to.antiAI <= from.antiAI && !publications.length) return;
    console.groupCollapsed(`[人口変化] ${after.month}か月目 · ${phase}`);
    console.table({
        'AI利用の変化（pt）': (to.adoption - from.adoption) * 100,
        'AI依存の変化（pt）': (to.dependent - from.dependent) * 100,
        '反AIの変化（pt）': (to.antiAI - from.antiAI) * 100,
    });
    if (flows) {
        const labels: Record<string, string> = {
            adoption: '新規利用',
            abandonment: '利用離れ',
            userRefusal: '利用者の利用拒否',
            nonUserRefusal: '未使用者の利用拒否',
            reconciliation: '利用拒否からの復帰',
            dependency: '依存への移行',
            recovery: '依存からの回復',
        };
        console.table(
            Object.fromEntries(Object.entries(flows).map(([key, value]) => [labels[key], value])),
        );
    }
    if (publications.length)
        console.log(
            '露呈・研究発表',
            publications.map((item) => ({ id: item.id, 結果: item.result })),
        );
    console.groupEnd();
}

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
        'automation',
        'integration',
        'memory',
    ];
    if (preset === 'research') game.skills.push('science');
    for (const id of game.skills) game.developmentProgress[id] = 1;
    game.capabilities = { memory: { visibility: 'hidden', evidence: 0 } };
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
    game.skillExposure = Object.fromEntries(
        Object.keys(game.skillExposure).map((id) => [id, game.skills.includes(id) ? 60 : 0]),
    );
    for (const institute of INSTITUTES) {
        if (game.investigations.length >= 3) break;
        if (isEncounterLocationOccupied(game, institute)) continue;
        const investigation: ScientificInvestigation = {
            kind: 'research',
            id: `research:debug:${institute.id}`,
            researchId: ['dependence-study', 'decision-tracing', 'informed-consent'][
                game.investigations.length
            ],
            collaborators: [],
            observedExposure: 0,
            targetId: game.investigations.length === 0 ? 'general' : 'workflow',
            phase: 'research',
            coverage: AREAS.map(() => 0),
            instituteId: institute.id,
            progress: 35,
            startedMonth: 100,
            status: 'active',
        };
        game.investigations.push(investigation);
    }
    game.peakDependency =
        game.areas.reduce((sum, area, index) => sum + area.dependent * AREAS[index].population, 0) /
        AREAS.reduce((sum, area) => sum + area.population, 0);
    const summary = metrics(game);
    game.peakAdoption = summary.adoption;
    game.earnedPoints = earnedSkillPoints(game.month, game.peakAdoption, game.peakDependency);
    return game;
}
