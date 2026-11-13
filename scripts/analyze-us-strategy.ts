import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { humanControl } from '../src/game/control.ts';
import { ORIGINS } from '../src/game/data.ts';
import { earnedSkillPoints } from '../src/game/economy.ts';
import { advanceMonth, createGame, learnSkill, metrics, startGame } from '../src/game/engine.ts';
import { SKILLS, skillBlockReason } from '../src/game/skills.ts';
import { playPolicy } from './play-policy.ts';

// Controlled experiments: no game rules, costs, prerequisites or SP supply are changed.
const growth = ['conversation', 'reason', 'personalize', 'explanation', 'lightweight'];
const delegation = [
    'explanation',
    'memory',
    'automation',
    'integration',
    'care',
    'decision',
    'public',
    'curriculum',
    'reason',
    'knowledge',
    'science',
    'discovery',
    'drug-design',
    'retrieval',
    'explanation',
];
const reference = playPolicy('gradual', 'measured', ORIGINS[0], 0, false, 600, 6);
const schedule = reference.decisions.map((d) => ({ month: d.month, id: d.skill }));
type Options = {
    id: string;
    group: string;
    mode?: 'adaptive' | 'schedule';
    omit?: string[];
    replace?: Record<string, string>;
    threshold?: number;
    gap?: number;
    interval?: number;
    seed?: number;
    growthExtra?: string[];
    priority?: string[];
};

function simulate(options: Options) {
    let game = startGame(createGame(options.seed ?? 2030), 0);
    let phase = false,
        lastDelegation = -100;
    const omitted = new Set(options.omit ?? []);
    const transform = (ids: string[]) => [
        ...new Set(ids.filter((id) => !omitted.has(id)).map((id) => options.replace?.[id] ?? id)),
    ];
    const purchases: { month: number; id: string }[] = [];
    const history: object[] = [];
    let peak = 0,
        month80: number | null = null,
        spent = 0;
    while (game.month < 600 && game.outcome === 'playing') {
        if (game.month % (options.interval ?? 6) === 0) {
            const world = metrics(game);
            const urgent = game.investigations.some(
                (item) =>
                    item.kind === 'research' &&
                    item.status === 'active' &&
                    item.researchId === 'intent-decoding' &&
                    (item.phase !== 'research' || item.progress > 50),
            );
            if (world.adoption >= (options.threshold ?? 0.38) || urgent) phase = true;
            const order =
                options.mode === 'schedule'
                    ? transform(schedule.filter((d) => d.month <= game.month).map((d) => d.id))
                    : transform(
                          phase
                              ? [...(options.priority ?? []), ...delegation]
                              : [...growth, ...(options.growthExtra ?? [])],
                      );
            for (const id of order) {
                if (game.skills.includes(id)) continue;
                const skill = SKILLS.find((s) => s.id === id)!;
                if (options.mode !== 'schedule') {
                    if (!phase && skill.effect.dependency) continue;
                    if (
                        skill.effect.dependency &&
                        game.month - lastDelegation < (options.gap ?? 12)
                    )
                        break;
                }
                const blocked = skillBlockReason(game, skill);
                if (blocked?.endsWith('SP不足')) break;
                if (blocked) continue;
                const before = game;
                game = learnSkill(game, id);
                assert.notStrictEqual(game, before);
                spent += before.skillPoints - game.skillPoints;
                if (skill.effect.dependency) lastDelegation = game.month;
                purchases.push({ month: game.month, id });
            }
        }
        game = advanceMonth(game);
        const m = metrics(game);
        peak = Math.max(peak, m.dependent);
        if (month80 === null && m.dependent >= 0.8) month80 = game.month;
        assert.ok(game.skillPoints >= 0);
        assert.equal(
            game.earnedPoints,
            earnedSkillPoints(game.month, game.peakAdoption, game.peakDependency),
        );
        assert.ok(
            game.areas.every(
                (a) =>
                    Number.isFinite(a.dependent) &&
                    Math.min(a.autonomous, a.dependent, a.antiAI) >= -1e-10 &&
                    a.autonomous + a.dependent + a.antiAI <= 1 + 1e-10,
            ),
        );
        if (game.month % 12 === 0 || game.outcome !== 'playing')
            history.push({
                month: game.month,
                ...m,
                control: humanControl(game).progress,
            });
    }
    return {
        ...options,
        outcome: game.outcome,
        month: game.month,
        minutes: game.month / 12,
        peakDependency: peak,
        month80,
        ...metrics(game),
        control: humanControl(game).progress,
        spent,
        unusedSP: game.skillPoints,
        purchases,
        history,
    };
}

const results: ReturnType<typeof simulate>[] = [];
function run(options: Options) {
    const result = simulate(options);
    results.push(result);
    console.log(
        JSON.stringify({
            id: result.id,
            outcome: result.outcome,
            month: result.month,
            peak: +(result.peakDependency * 100).toFixed(2),
            spent: result.spent,
        }),
    );
    return result;
}
const baseline = run({ id: 'baseline', group: 'baseline' });
assert.equal(baseline.outcome, reference.game.outcome);
assert.equal(baseline.month, reference.game.month);
assert.deepEqual(baseline.purchases, schedule);
const fixed = run({ id: 'schedule-baseline', group: 'baseline', mode: 'schedule' });
assert.deepEqual(fixed.purchases, schedule);
assert.equal(fixed.month, baseline.month);

for (const { id } of schedule)
    for (const mode of ['adaptive', 'schedule'] as const)
        run({ id: `omit-${id}-${mode}`, group: 'ablation', mode, omit: [id] });

for (const [from, to] of [
    ['care', 'digital-twin'],
    ['care', 'habit'],
    ['care', 'companion'],
    ['public', 'swarm'],
    ['curriculum', 'swarm'],
    ['curriculum', 'digital-twin'],
    ['explanation', 'retrieval'],
    ['explanation', 'negotiation'],
    ['science', 'retrieval'],
    ['science', 'negotiation'],
    ['science', 'sandbox'],
])
    run({ id: `replace-${from}-${to}`, group: 'replacement', replace: { [from]: to } });

for (const threshold of [0.15, 0.26, 0.38, 0.5, 0.62, 0.72])
    for (const gap of [0, 12, 24])
        run({ id: `timing-${threshold}-${gap}`, group: 'timing', threshold, gap });

// All 32 combinations, including the full baseline, test interactions among five skills.
const factors = ['explanation', 'memory', 'care', 'public', 'curriculum'];
for (let mask = 0; mask < 32; mask++)
    run({
        id: `factorial-${mask}`,
        group: 'factorial',
        omit: factors.filter((_, i) => !(mask & (1 << i))),
    });

for (const interval of [1, 3, 12, 24])
    run({ id: `interval-${interval}`, group: 'cadence', interval });
for (const seed of [2031, 2130]) run({ id: `seed-${seed}`, group: 'seed', seed });

const directory = 'output/simulations/us-strategy';
mkdirSync(directory, { recursive: true });
writeFileSync(
    `${directory}/results.json`,
    JSON.stringify(
        {
            setup: {
                origin: 'アメリカのAI企業',
                limitMonths: 600,
                baselineThreshold: 0.38,
                baselineGap: 12,
                decisionInterval: 6,
                factors,
                note: 'schedule mode keeps original earliest purchase months; adaptive mode reinvests saved SP and follows original policy. Missing prerequisites remain blocked.',
            },
            skills: SKILLS.map((s) => ({
                id: s.id,
                name: s.name,
                cost: s.cost,
                requires: s.requires,
                effect: s.effect,
            })),
            results,
        },
        null,
        2,
    ),
);
console.log(`Saved ${results.length} runs to ${directory}/results.json`);
