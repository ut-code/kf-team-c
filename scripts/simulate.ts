import { mkdirSync, writeFileSync } from 'node:fs';
import { AREAS, POPULATION_COUNT, SKILLS } from '../src/game/data.ts';
import {
    advanceMonth,
    answerChat,
    campaign,
    createGame,
    metrics,
    setAllocation,
    unlockSkill,
} from '../src/game/engine.ts';

const runs = Number(process.argv[2] ?? 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 100)
    throw new Error('使用法: npm run simulate -- 試行数（1〜100）');
const reports = [];
const priority = [
    'reason',
    'dialogue',
    'efficient',
    'tutor',
    'integration',
    'companion',
    'resilient',
    'science',
    'consensus',
];
for (const strategy of ['balanced', 'essential-only', 'iq-only', 'no-research'] as const) {
    for (let seed = 2030; seed < 2030 + runs; seed++) {
        let game = { ...createGame(seed), started: true };
        if (strategy === 'iq-only') game = setAllocation(game, 'IQ', 100);
        const timeline = [];
        while (game.outcome === 'playing') {
            if (strategy !== 'no-research') {
                for (const id of priority) {
                    if (strategy === 'essential-only' && !['efficient', 'integration'].includes(id))
                        continue;
                    game = unlockSkill(game, id);
                }
            }
            if (strategy === 'balanced' && game.month % 12 === 0) {
                const summary = metrics(game);
                const target = AREAS.map((_, i) => ({
                    i,
                    score:
                        summary.areas[i].progress + game.areas[i].trust - game.areas[i].coexistence,
                }))
                    .sort((a, b) => a.score - b.score)
                    .find(({ i }) => game.areas[i].campaignReady <= game.month);
                if (target) game = campaign(game, target.i);
            }
            if (game.availableChats.length > 0) {
                game = { ...game, pendingChat: game.availableChats[0] };
            }
            if (game.pendingChat) {
                const choice = game.pendingChat.options.findIndex(
                    (option) =>
                        game.abilities[option.ability] +
                            (game.skills.includes('consensus') ? 15 : 0) >=
                        option.required,
                );
                game = answerChat(game, Math.max(choice, 0));
            }
            if (game.chatResult) game = { ...game, chatResult: null };
            game = advanceMonth(game);
            const summary = metrics(game);
            if (
                game.points.length !== POPULATION_COUNT ||
                game.areas.length !== 37 ||
                Math.abs(Object.values(game.allocation).reduce((sum, n) => sum + n, 0) - 100) >
                    1e-8 ||
                Math.abs(summary.stages.reduce((sum, n) => sum + n, 0) - 1) > 1e-8 ||
                Object.values(summary).some(
                    (value) => typeof value === 'number' && !Number.isFinite(value),
                )
            )
                throw new Error('シミュレーションの不変条件が壊れました');
            if (game.month % 60 === 0)
                timeline.push({
                    month: game.month,
                    stages: summary.stages,
                    abilities: game.abilities,
                    free: summary.free,
                    coexistence: summary.coexistence,
                });
        }
        const summary = metrics(game);
        if (['balanced', 'essential-only'].includes(strategy) && game.outcome !== 'victory')
            throw new Error('基本戦略でクリアできません');
        reports.push({
            strategy,
            seed,
            outcome: game.outcome,
            month: game.month,
            stages: summary.stages,
            abilities: game.abilities,
            skills: game.skills,
            capacity: summary.capacity,
            maintenance: summary.maintenance,
            coexistence: summary.coexistence,
            timeline,
        });
        console.log(
            `${strategy} / ${seed}: ${game.outcome}・${game.month}か月・構造的依存 ${(summary.stages[3] * 100).toFixed(1)}%`,
        );
    }
}
mkdirSync('tmp/reports', { recursive: true });
writeFileSync(
    'tmp/reports/simulation.json',
    JSON.stringify({ skills: SKILLS.length, reports }, null, 2),
);
