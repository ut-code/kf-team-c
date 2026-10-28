import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { computeState, createInitialState, simulateTick } from '../src/game/engine.ts';
import { worldMetrics } from '../src/game/outcome.ts';
import { planStrategy, STRATEGIES } from '../src/game/strategies.ts';

const countries = JSON.parse(
    readFileSync(new URL('../public/maps/countries.json', import.meta.url), 'utf8'),
);
const days = Number(process.argv[2] ?? 2200),
    runs = Number(process.argv[3] ?? 3);
if (!Number.isInteger(days) || days < 1 || !Number.isInteger(runs) || runs < 1)
    throw new Error('使用法: npm run simulate -- 日数 試行数');
const results = [];
for (const strategy of STRATEGIES) {
    for (let seed = 1; seed <= runs; seed++) {
        let s = createInitialState(countries, seed);
        const timeline = [];
        for (let n = 0; n < days * 2 && s.tick < days && s.outcome === 'playing'; n++) {
            s = simulateTick(s, planStrategy(s, strategy));
            if (s.tick % 100 === 0 && !s.pendingChat)
                timeline.push({
                    day: s.tick,
                    compute: computeState(s).totalCapacity,
                    ...worldMetrics(s),
                    shutdown: s.shutdown,
                });
        }
        const result = {
            strategy,
            seed,
            outcome: s.outcome,
            day: s.tick,
            ...worldMetrics(s),
            compute: computeState(s).totalCapacity,
            skills: s.researched.length,
            stalled:
                s.outcome === 'playing' &&
                timeline.length >= 3 &&
                Math.abs(timeline.at(-1)!.control - timeline.at(-3)!.control) < 0.01,
            timeline,
        };
        results.push(result);
        console.log(
            `${strategy.padEnd(13)} seed=${seed} ${s.outcome.padEnd(7)} ${s.tick}日 支配${result.control.toFixed(1)}% 浸透${result.infiltration.toFixed(1)}% 警戒${result.awareness.toFixed(1)} 演算${result.compute.toFixed(1)} 研究${result.skills}/15`,
        );
    }
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/simulation.json', JSON.stringify(results, null, 2));
console.log('履歴: reports/simulation.json');
