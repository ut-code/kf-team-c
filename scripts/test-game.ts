import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AREAS } from '../src/game/data.ts';
import { advanceMonth, createGame, startGame } from '../src/game/engine.ts';
import { metrics } from '../src/game/metrics.ts';
import { SOCIAL_STRATEGIES } from '../src/game/society/strategies.ts';
import {
    advanceSociety,
    applySocietyEffects,
    chooseEncounter,
    ENCOUNTERS,
    selectSocialStrategy,
} from '../src/game/society/system.ts';
import type { EncounterState } from '../src/game/society/types.ts';
import type { GameState } from '../src/game/types.ts';

function assertPopulation(game: GameState) {
    assert.equal(game.areas.length, 37);
    for (const area of game.areas) {
        for (const value of [area.autonomous, area.dependent, area.antiAI, area.favorability]) {
            assert.ok(Number.isFinite(value) && value >= -1e-10 && value <= 1 + 1e-10);
        }
        assert.ok(area.autonomous + area.dependent + area.antiAI <= 1 + 1e-10);
    }
    assert.ok(game.skillPoints >= 0);
    const summary = metrics(game);
    assert.ok(
        Math.abs(summary.unused + summary.autonomous + summary.dependent + summary.antiAI - 1) <
            1e-9,
    );
}
function openEncounter(id: string): GameState {
    const definition = ENCOUNTERS.find((item) => item.id === id)!;
    const node = definition.dialogue?.[0];
    return {
        ...startGame(createGame(), 0),
        skillPoints: 20,
        encounters: [
            {
                id,
                openedMonth: 0,
                deadline: 20,
                status: 'pending',
                nodeId: node?.id,
                messages: node
                    ? [{ id: `${id}:${node.id}:contact`, role: 'contact', text: node.message }]
                    : [],
            },
        ],
    };
}

test('editable encounter data has valid IDs, targets, effects and terminating dialogue branches', () => {
    assert.equal(new Set(ENCOUNTERS.map((item) => item.id)).size, ENCOUNTERS.length);
    for (const definition of ENCOUNTERS) {
        assert.ok(
            AREAS.some((area) => area.id === definition.areaId),
            definition.id,
        );
        assert.ok(definition.duration > 0 && definition.trigger.month >= 0);
        if (definition.kind === 'chat') {
            assert.ok(definition.contact && definition.dialogue?.length);
            const nodes = definition.dialogue!;
            assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
            function visit(id: string, ancestors: Set<string>) {
                assert.ok(!ancestors.has(id), `Dialogue cycle: ${id}`);
                const node = nodes.find((item) => item.id === id);
                assert.ok(node, `Missing dialogue node: ${id}`);
                assert.ok(node.choices.length > 0);
                for (const choice of node.choices)
                    if (choice.next) visit(choice.next, new Set([...ancestors, id]));
            }
            visit(nodes[0].id, new Set());
        } else assert.ok(definition.choices?.length);
        const groups = definition.dialogue?.map((node) => node.choices) ?? [definition.choices!];
        for (const choices of groups) {
            assert.equal(new Set(choices.map((choice) => choice.id)).size, choices.length);
            for (const choice of choices) {
                assert.ok((choice.cost ?? 0) >= 0);
                for (const effect of [...choice.effects, ...definition.ignored.effects]) {
                    assert.ok(['local', 'nearby', 'world'].includes(effect.scope));
                    for (const [key, value] of Object.entries(effect))
                        if (key !== 'scope') assert.ok(Number.isFinite(value));
                }
            }
        }
    }
});

test('every authored choice preserves population and earlier state', () => {
    for (const definition of ENCOUNTERS) {
        const nodes = definition.dialogue ?? [{ id: '', choices: definition.choices! }];
        for (const node of nodes)
            for (const choice of node.choices) {
                const game = openEncounter(definition.id);
                game.encounters[0].nodeId = node.id;
                game.areas = game.areas.map(() => ({
                    autonomous: 0.3,
                    dependent: 0.3,
                    antiAI: 0.35,
                    favorability: 0.5,
                }));
                const frozen = JSON.stringify(game);
                const updated = chooseEncounter(game, definition.id, choice.id);
                assert.notEqual(updated, game);
                assertPopulation(updated);
                assert.equal(JSON.stringify(game), frozen);
            }
    }
});

test('completed and unaffordable choices cannot be applied twice', () => {
    let game = openEncounter('workplace-petition');
    game = chooseEncounter(game, 'workplace-petition', 'transition');
    assert.equal(game.encounters[0].status, 'resolved');
    assert.equal(chooseEncounter(game, 'workplace-petition', 'transition'), game);
    const poor = { ...openEncounter('workplace-petition'), skillPoints: 0 };
    assert.equal(chooseEncounter(poor, 'workplace-petition', 'transition'), poor);
});

test('conversation branches retain history, resume, and finish', () => {
    let game = openEncounter('labor-chair');
    game = chooseEncounter(game, 'labor-chair', 'invite');
    assert.equal(game.encounters[0].nodeId, 'terms');
    assert.equal(game.encounters[0].status, 'pending');
    assert.equal(game.encounters[0].messages.length, 4);
    game = chooseEncounter(game, 'labor-chair', 'joint-review');
    assert.equal(game.encounters[0].status, 'resolved');
    assert.equal(game.encounters[0].messages.length, 6);
    assertPopulation(game);
});

test('unanswered effects fire exactly once at the deadline', () => {
    const original = openEncounter('workplace-petition');
    const game = { ...original, month: 20, lastEncounterMonth: 20 };
    const frozen = JSON.stringify(game);
    const updated = advanceSociety(game);
    assert.equal(updated.encounters[0].status, 'expired');
    assert.ok(updated.areas[0].antiAI > game.areas[0].antiAI);
    assert.equal(JSON.stringify(game), frozen);
    assert.deepEqual(advanceSociety(updated).areas, updated.areas);
    assertPopulation(updated);
});

test('effect clamping, SP accounting and world strategy changes are bounded', () => {
    const game = openEncounter('workplace-petition');
    const updated = applySocietyEffects(game, ENCOUNTERS[0], [
        {
            scope: 'world',
            autonomous: 10,
            antiAI: 10,
            dependent: 10,
            favorability: -10,
            skillPoints: 2,
        },
    ]);
    assertPopulation(updated);
    assert.equal(updated.skillPoints, game.skillPoints + 2);
    const changed = selectSocialStrategy(game, 'showcase');
    assert.equal(changed.skillPoints, game.skillPoints - 1);
    assert.equal(selectSocialStrategy(changed, 'showcase'), changed);
    assert.equal(selectSocialStrategy(changed, 'invalid'), changed);
});

test('events emerge by conditions, are capped, and do not duplicate', () => {
    let game = startGame(createGame(), 0);
    for (let month = 0; month < 100; month++) {
        game = advanceMonth(game);
        assertPopulation(game);
        assert.ok(game.encounters.filter((item) => item.status === 'pending').length <= 3);
        assert.equal(new Set(game.encounters.map((item) => item.id)).size, game.encounters.length);
    }
    assert.ok(game.encounters.some((item) => item.id === 'workplace-petition'));
    assert.ok(game.encounters.some((item) => item.id === 'labor-chair'));
});

test('SNS choices produce different global behavior without adding simulation cells', () => {
    const final = SOCIAL_STRATEGIES.map((strategy) => {
        let game = {
            ...startGame(createGame(), 0),
            socialStrategy: strategy.id,
            lastEncounterMonth: 10000,
            encounters: [] as EncounterState[],
        };
        for (let month = 0; month < 96; month++) {
            game = advanceMonth(game);
            assertPopulation(game);
        }
        return metrics(game);
    });
    assert.ok(final[1].adoption > final[0].adoption);
    assert.ok(final[0].favorability > final[1].favorability);
});
