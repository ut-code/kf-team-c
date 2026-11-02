import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chatOptions } from '../src/game/conversations.ts';
import { SKILLS, TOTAL_MONTHS } from '../src/game/data.ts';
import {
    advanceMonth,
    answerChat,
    beginResearch,
    createGame,
    metrics,
    resolveEvent,
    runPolicy,
    setInfrastructureShare,
} from '../src/game/engine.ts';
import type { GameState } from '../src/game/types.ts';

const runs = Number(process.argv[2] ?? 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 100)
    throw new Error('使用法: npm run simulate -- 試行数（1〜100）');
const strategies = {
    idle: [],
    transparent: [
        'reason',
        'empathy',
        'automation',
        'knowledge',
        'personalize',
        'public',
        'decision',
        'transparent',
        'memory',
        'forecast',
    ],
    research: [
        'reason',
        'knowledge',
        'science',
        'empathy',
        'automation',
        'personalize',
        'public',
        'school',
        'decision',
        'transparent',
        'memory',
    ],
    opaque: [
        'reason',
        'empathy',
        'automation',
        'knowledge',
        'memory',
        'public',
        'decision',
        'opaque',
        'personalize',
        'optimize',
        'oversight',
    ],
} satisfies Record<string, string[]>;

function study(state: GameState, priority: string[]) {
    const nextSkill = priority.find((id) => !state.skills.includes(id));
    const summary = metrics(state);
    // 運用に必要な算力を残し、残りを選択した研究へ配分するプレイ方針。
    const share = Math.min(
        95,
        Math.max(35, Math.ceil(((summary.maintenance + 5) / summary.capacity) * 100)),
    );
    state = setInfrastructureShare(state, share);
    return nextSkill && state.activeResearch !== nextSkill
        ? beginResearch(state, nextSkill)
        : state;
}
function respond(state: GameState) {
    const event = state.pendingEvent;
    if (!event) return state;
    const ranked = event.choices
        .map((choice, index) => ({ choice, index }))
        .filter(
            ({ choice }) =>
                (!choice.skill || state.skills.includes(choice.skill)) &&
                (choice.cost ?? 0) <= state.influence &&
                (!choice.ability || state.abilities[choice.ability] >= (choice.required ?? 0)),
        )
        .sort((a, b) => {
            const value = (choice: typeof a.choice) =>
                (choice.effect.integration ?? 0) * 18 +
                (choice.effect.researchBoost ?? 0) * 20 +
                (choice.effect.stability ?? 0) +
                (choice.effect.trust ?? 0) * 0.5 -
                (choice.effect.vigilance ?? 0) * 0.5 +
                (choice.effect.investment ?? 0) * 0.8;
            return value(b.choice) - value(a.choice);
        });
    return ranked.length ? resolveEvent(state, ranked[0].index) : state;
}
function intervene(state: GameState) {
    if (state.pendingChat === null && state.availableChats[0])
        state = { ...state, pendingChat: state.availableChats[0] };
    if (state.pendingChat) {
        const choices = chatOptions(state, state.pendingChat);
        const options = choices
            .map((option, index) => ({ option, index }))
            .filter(({ option }) => state.abilities[option.ability] >= option.required)
            .sort((a, b) => b.option.institution - a.option.institution);
        if (options[0]) state = answerChat(state, options[0].index);
        else state = { ...state, pendingChat: null };
    }
    const summary = metrics(state);
    const targets = state.areas
        .map((area, index) => ({
            area,
            index,
            score: area.institutions.reduce((sum, value) => sum + value, 0),
        }))
        .filter(({ area }) => area.campaignReady <= state.month)
        .sort((a, b) => a.score - b.score);
    if (state.influence >= 30 && targets[0]) {
        const needsInvestment = summary.free < 20;
        const needsRepair = summary.trust < 0.4 || summary.vigilance > 0.6;
        const policy = needsInvestment ? 'investment' : needsRepair ? 'repair' : 'success';
        state = runPolicy(state, targets[0].index, policy);
    }
    return state;
}
const reports = [];
for (const [name, priority] of Object.entries(strategies)) {
    for (let seed = 2030; seed < 2030 + runs; seed++) {
        let game = { ...createGame(seed), started: true };
        const totalPopulation = metrics(game).population;
        const timeline = [];
        while (game.outcome === 'playing') {
            if (name !== 'idle') {
                game = study(game, priority);
                game = respond(game);
                game = intervene(game);
            }
            game = advanceMonth(game);
            const summary = metrics(game);
            assert.equal(game.points.length, 4000);
            assert.ok(Math.abs(summary.population - totalPopulation) < 1);
            assert.ok(Math.abs(summary.stages.reduce((sum, value) => sum + value, 0) - 1) < 1e-8);
            assert.ok(game.influence >= 0);
            assert.ok(summary.researchCompute >= 0 && summary.infrastructureCompute >= 0);
            assert.ok(
                Math.abs(
                    summary.researchCompute + summary.infrastructureCompute - summary.capacity,
                ) < 1e-8,
            );
            assert.ok(
                game.areas.every((area) =>
                    area.institutions.every((value) => value >= 0 && value <= 4),
                ),
            );
            assert.ok(
                game.points.every(
                    (point) =>
                        Number.isFinite(point.weight) &&
                        point.stage >= 0 &&
                        point.stage <= 3 &&
                        [point.trust, point.autonomy, point.vigilance, point.conformity].every(
                            (value) => Number.isFinite(value) && value >= 0 && value <= 100,
                        ),
                ),
            );
            if (game.month % 60 === 0)
                timeline.push({
                    month: game.month,
                    stages: summary.stages,
                    abilities: game.abilities,
                    resources: summary.free,
                    trust: summary.trust,
                    stability: summary.stability,
                });
            assert.ok(game.month <= TOTAL_MONTHS);
        }
        const summary = metrics(game);
        if (name === 'idle') assert.notEqual(game.outcome, 'victory');
        assert.ok(game.skills.length < SKILLS.length);
        reports.push({
            strategy: name,
            seed,
            outcome: game.outcome,
            month: game.month,
            stages: summary.stages,
            skills: game.skills,
            trust: summary.trust,
            stability: summary.stability,
            timeline,
        });
        console.log(
            `${name} / ${seed}: ${game.outcome}・${game.month}か月・紫 ${(summary.stages[3] * 100).toFixed(1)}%・信頼 ${(summary.trust * 100).toFixed(1)}・安定 ${(summary.stability * 100).toFixed(1)}`,
        );
    }
}
mkdirSync('tmp/reports', { recursive: true });
writeFileSync('tmp/reports/simulation.json', JSON.stringify({ reports }, null, 2));
