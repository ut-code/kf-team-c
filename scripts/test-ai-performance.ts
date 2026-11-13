import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiPerformance } from '../src/game/aiPerformance.ts';
import { createGame, startGame } from '../src/game/engine.ts';

test('未開発の能力はゼロで、開発進捗に応じて現在値が増える', () => {
    const base = startGame(createGame(), 0);
    assert.ok(aiPerformance(base).every((metric) => metric.value === 0 && metric.ratio === 0));
    const game = {
        ...base,
        skills: ['reason', 'decision'],
        developmentProgress: { ...base.developmentProgress, reason: 0.5, decision: 0.5 },
    };
    const partial = aiPerformance(game);
    const complete = aiPerformance({
        ...game,
        developmentProgress: { ...game.developmentProgress, reason: 1, decision: 1 },
    });
    assert.ok(partial[0].value > 0 && partial[2].value > 0);
    assert.equal(partial[0].ratio * 2, complete[0].ratio);
    assert.equal(partial[2].ratio * 2, complete[2].ratio);
    assert.ok(
        complete.every(
            (metric) => Number.isFinite(metric.ratio) && metric.ratio >= 0 && metric.ratio <= 1,
        ),
    );
});

test('制約による弱体化を反映し、人口比率や好感度とは独立して能力構成を示す', () => {
    const base = startGame(createGame(), 0);
    const game = {
        ...base,
        skills: ['autonomous'],
        developmentProgress: { ...base.developmentProgress, autonomous: 1 },
    };
    const before = aiPerformance(game);
    const restrained = aiPerformance({
        ...game,
        skills: [...game.skills, 'permission'],
        developmentProgress: { ...game.developmentProgress, permission: 1 },
    });
    assert.ok(restrained[2].value < before[2].value);
    assert.ok(restrained[1].value > before[1].value);
    assert.deepEqual(
        aiPerformance({
            ...game,
            areas: game.areas.map((area) => ({
                ...area,
                autonomous: 0,
                dependent: 0.9,
                favorability: 0.1,
            })),
        }),
        before,
    );
});
