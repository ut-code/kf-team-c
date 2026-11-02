import assert from 'node:assert/strict';
import test from 'node:test';
import { createConversation } from '../src/game/conversations.ts';
import {
    advanceMonth,
    answerChat,
    beginResearch,
    createGame,
    metrics,
    resolveEvent,
    runPolicy,
} from '../src/game/engine.ts';
import { EVENTS } from '../src/game/events.ts';
import { SOCIAL_PROFILES } from '../src/game/population.ts';
import { advanceResearch } from '../src/game/research.ts';
import type { GameState } from '../src/game/types.ts';

const initial = createGame(2030);
function fixture(): GameState {
    return { ...structuredClone(initial), started: true };
}
function freeze(value: unknown) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
}

test('country population is reweighted to WPP totals, retaining 4000 fixed locations', () => {
    assert.equal(initial.points.length, 4000);
    for (const [code, profile] of Object.entries(SOCIAL_PROFILES)) {
        if (profile.population === null) continue;
        const population = initial.points
            .filter((point) => point.country === code)
            .reduce((sum, point) => sum + point.weight, 0);
        if (population > 0) assert.ok(Math.abs(population - profile.population) < 1, code);
    }
});
test('monthly updates and interventions do not mutate previous snapshots', () => {
    const game = fixture();
    freeze(game);
    assert.notEqual(advanceMonth(game), game);
    assert.notEqual(runPolicy(game, 28, 'success'), game);
    assert.notEqual(beginResearch(game, 'reason'), game);
});
test('research uses allocated compute over time and mutually exclusive branches stay locked', () => {
    let game = beginResearch(fixture(), 'reason');
    const next = advanceMonth(game);
    assert.equal(game.skills.length, 0);
    assert.ok(next.researchProgress.reason > 0 && next.researchProgress.reason < 140);
    assert.ok(
        Math.abs(
            metrics(next).researchCompute +
                metrics(next).infrastructureCompute -
                metrics(next).capacity,
        ) < 1e-8,
    );
    for (const branch of ['transparent', 'opaque']) {
        game = fixture();
        for (const id of ['empathy', 'automation', branch]) {
            game = beginResearch(game, id);
            game = advanceResearch(game, 10000);
        }
        assert.equal(
            beginResearch(game, branch === 'transparent' ? 'opaque' : 'transparent'),
            game,
        );
    }
});
test('a multi-turn conversation persists when closed and applies actual per-turn effects', () => {
    let game = fixture();
    game.abilities = { IQ: 100, EQ: 100, SYSTEM: 100 };
    const chat = createConversation(game, 28, 3);
    game.pendingChat = chat;
    game.availableChats = [chat];
    for (let turn = 0; turn < 4; turn++) {
        const next = answerChat(game, 0);
        assert.ok(next.impact!.population > 0);
        if (turn < 3) {
            assert.equal(next.pendingChat!.turn, turn + 1);
            assert.equal(next.availableChats[0].turn, turn + 1);
            assert.equal(
                new Set(next.pendingChat!.transcript.map((line) => line.id)).size,
                next.pendingChat!.transcript.length,
            );
        } else {
            assert.equal(next.pendingChat, null);
            assert.equal(next.availableChats.length, 0);
        }
        game = next;
    }
});
test('event choices have different effects and unaffordable options are rejected', () => {
    const event = { ...EVENTS.find((event) => event.id === 'eu-protest')!, expires: 102 };
    const game = { ...fixture(), pendingEvent: event };
    const negotiation = resolveEvent(game, 0),
        automation = resolveEvent(game, 1);
    assert.ok(negotiation.areas[8].stability > automation.areas[8].stability);
    assert.ok(metrics(negotiation).trust > metrics(automation).trust);
    const poor = { ...game, influence: 0 };
    assert.equal(resolveEvent(poor, 0), poor);
});
test('sustained trust and stability crises trigger their distinct defeat conditions', () => {
    const distrust = fixture();
    distrust.distrustMonths = 35;
    distrust.points = distrust.points.map((point) => ({
        ...point,
        trust: 0,
        baseline: { ...point.baseline, trust: 0 },
    }));
    assert.equal(advanceMonth(distrust).outcome, 'distrust');
    const collapse = fixture();
    collapse.instabilityMonths = 23;
    collapse.areas = collapse.areas.map((area) => ({ ...area, stability: 0 }));
    assert.equal(advanceMonth(collapse).outcome, 'collapse');
});
