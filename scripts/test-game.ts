import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    AREAS,
    DEFEAT_OPPOSITION,
    MONTH_MS,
    ORIGINS,
    VICTORY_DEPENDENCY,
} from '../src/game/data.ts';
import { createDebugGame } from '../src/game/debug.ts';
import { advanceMonth, createGame, learnSkill, startGame } from '../src/game/engine.ts';
import { metrics } from '../src/game/metrics.ts';
import { discloseCapability } from '../src/game/secrecy/capabilities.ts';
import { INSTITUTES } from '../src/game/secrecy/data.ts';
import { investigationRate, respondToInvestigation } from '../src/game/secrecy/investigations.ts';
import { advanceResearch, RESEARCH_TOPICS, researchRate } from '../src/game/secrecy/research.ts';
import {
    researchCapacity,
    runningCapabilityIds,
    runningResearchIds,
} from '../src/game/secrecy/researchCapacity.ts';
import type { ScientificInvestigation } from '../src/game/secrecy/types.ts';
import { SKILLS } from '../src/game/skills.ts';
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
    game.areas = game.areas.map((area) => ({ ...area, autonomous: 0.1 }));
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

test('unimproved AI loses its audience and ends with zero use even without majority opposition', () => {
    for (const origin of ORIGINS) {
        let game = startGame(createGame(), origin.area);
        while (game.outcome === 'playing' && game.month * MONTH_MS < 25 * 60_000) {
            game = advanceMonth(game);
            assertPopulation(game);
        }
        assert.equal(game.outcome, 'forgotten', origin.name);
        assert.equal(metrics(game).adoption, 0);
        assert.ok(metrics(game).antiAI < DEFEAT_OPPOSITION);
        assert.equal(advanceMonth(game), game);
    }
});

test('prepared public research wins around twenty minutes at normal speed', () => {
    const order = [
        'conversation',
        'reason',
        'knowledge',
        'science',
        'personalize',
        'lightweight',
        'offline',
        'mobile',
        'verification',
        'audit',
        'privacy',
        'automation',
        'integration',
        'decision',
        'platform',
        'public',
        'autonomous',
        'backbone',
        'distributed',
    ];
    for (const origin of ORIGINS) {
        let game = startGame(createGame(), origin.area);
        while (game.outcome === 'playing' && game.month * MONTH_MS < 25 * 60_000) {
            for (const id of order) {
                const skill = SKILLS.find((item) => item.id === id)!;
                if (skill.effect.dependency && game.month < 144) continue;
                game = learnSkill(game, id);
            }
            for (const id of Object.keys(game.capabilities)) game = discloseCapability(game, id);
            game = advanceMonth(game);
            assertPopulation(game);
        }
        assert.equal(game.outcome, 'victory', origin.name);
        assert.ok(metrics(game).dependent >= VICTORY_DEPENDENCY);
        assert.ok(game.month * MONTH_MS >= 18 * 60_000, 'Normal play lasts at least 18 minutes');
        assert.ok(game.month * MONTH_MS <= 22 * 60_000, 'Normal play ends within 22 minutes');
        assert.equal(advanceMonth(game), game);
    }
});

test('published independent findings break a stalled society despite public dialogue', () => {
    let game = {
        ...startGame(createGame(), 0),
        month: 432,
        investigations: INSTITUTES.map(
            (institute): ScientificInvestigation => ({
                kind: 'research',
                id: `research:${institute.id}:goal-decoding`,
                researchId: 'goal-decoding',
                instituteId: institute.id,
                progress: 100,
                startedMonth: 1,
                closedMonth: 2,
                status: 'published',
                intervention: 'none',
            }),
        ),
        areas: AREAS.map(() => ({
            autonomous: 0.15,
            dependent: 0.7,
            antiAI: 0.15,
            favorability: 1,
        })),
    };
    const frozen = JSON.stringify(game);
    const first = advanceMonth(game);
    assert.equal(JSON.stringify(game), frozen);
    assert.ok(metrics(first).antiAI > metrics(game).antiAI);
    game = first;
    while (game.outcome === 'playing' && game.month * MONTH_MS < 25 * 60_000) {
        game = advanceMonth(game);
        assertPopulation(game);
    }
    assert.equal(game.outcome, 'autonomy');
    assert.ok(metrics(game).antiAI >= DEFEAT_OPPOSITION);
});

test('population coefficients depend on society and research, not elapsed months', () => {
    const game = { ...startGame(createGame(), 0), lastEncounterMonth: 10000 };
    const later = { ...game, month: 1000 };
    const earlyResult = advanceMonth(game);
    const lateResult = advanceMonth(later);
    assert.deepEqual(earlyResult.areas, lateResult.areas);
    assert.deepEqual(earlyResult.researchKnowledge, lateResult.researchKnowledge);
    assert.equal(earlyResult.outcome, lateResult.outcome);
});

function scientificProject(researchId: string): ScientificInvestigation {
    return {
        kind: 'research',
        id: `research:metrica:${researchId}`,
        researchId,
        instituteId: 'metrica',
        progress: 20,
        startedMonth: 0,
        status: 'active',
        intervention: 'none',
    };
}

test('scientific research cannot be cancelled by disclosure or capability restrictions', () => {
    const project = scientificProject('goal-decoding');
    const game = { ...startGame(createGame(), 0), skillPoints: 10, investigations: [project] };
    const frozen = JSON.stringify(game);
    assert.equal(respondToInvestigation(game, project.id, 'disclose'), game);
    assert.equal(respondToInvestigation(game, project.id, 'restrict'), game);
    const pressured = respondToInvestigation(game, project.id, 'pressure');
    assert.equal(pressured.skillPoints, 8);
    assert.equal(respondToInvestigation(pressured, project.id, 'pressure'), pressured);
    assert.ok(advanceResearch(pressured).investigations[0].progress > project.progress);
    assert.equal(JSON.stringify(game), frozen);
});

test('independent replication resists pressure better than early research', () => {
    const game = {
        ...startGame(createGame(), 0),
        areas: AREAS.map(() => ({
            autonomous: 0.1,
            dependent: 0.8,
            antiAI: 0.05,
            favorability: 0.6,
        })),
    };
    const early = scientificProject('dependence-study');
    const late = scientificProject('goal-decoding');
    const earlyRatio =
        researchRate(game, { ...early, intervention: 'pressure' }) / researchRate(game, early);
    const lateRatio =
        researchRate(game, { ...late, intervention: 'pressure' }) / researchRate(game, late);
    assert.ok(lateRatio > earlyRatio);
    assert.ok(lateRatio > 0.9, 'Distributed replication preserves most research capacity');
});

test('research accumulates shared knowledge, follows prerequisites and publishes only once', () => {
    let game = startGame(createGame(), 0);
    for (let n = 0; n < 720; n++) {
        const previous = game;
        const frozen = JSON.stringify(previous);
        game = advanceResearch(game);
        assert.equal(JSON.stringify(previous), frozen);
        for (const institute of INSTITUTES) {
            assert.ok(
                game.researchKnowledge[institute.id] > previous.researchKnowledge[institute.id],
            );
        }
        assert.ok(game.investigations.filter((item) => item.status === 'active').length <= 3);
        assert.equal(
            new Set(game.investigations.map((item) => item.id)).size,
            game.investigations.length,
        );
        for (const project of game.investigations) {
            if (project.kind !== 'research') continue;
            const tier = RESEARCH_TOPICS.findIndex((topic) => topic.id === project.researchId);
            if (tier > 0)
                assert.ok(
                    game.investigations.some(
                        (item) =>
                            item.kind === 'research' &&
                            item.instituteId === project.instituteId &&
                            item.researchId === RESEARCH_TOPICS[tier - 1].id &&
                            item.status === 'published',
                    ),
                );
        }
    }
    assert.ok(
        game.investigations.some(
            (item) =>
                item.kind === 'research' &&
                item.researchId === 'goal-decoding' &&
                item.status === 'published',
        ),
    );
    const finished = game.investigations.map((item) => [item.id, item.progress, item.closedMonth]);
    assert.deepEqual(
        advanceResearch(game).investigations.map((item) => [
            item.id,
            item.progress,
            item.closedMonth,
        ]),
        finished,
    );
});

test('opening research grants early choices without inflating the total time income', () => {
    let game = { ...startGame(createGame(), 0), lastEncounterMonth: 10000 };
    const initial = game.skillPoints;
    for (let n = 0; n < 3; n++) game = advanceMonth(game);
    assert.equal(game.skillPoints, initial + 1);
    for (let n = 3; n < 24; n++) game = advanceMonth(game);
    assert.equal(game.skillPoints, initial + 8);
    assert.ok(game.earnedPoints <= 90);
});

test('research institutes start independently and never launch a simultaneous batch', () => {
    let game = startGame(createGame(), 0);
    const firstStarts = [];
    for (let month = 1; month <= 300; month++) {
        const previousIds = new Set(game.investigations.map((item) => item.id));
        game = advanceResearch({ ...game, month });
        const added = game.investigations.filter((item) => !previousIds.has(item.id));
        assert.ok(added.length <= 1);
        for (const project of added)
            if (project.kind === 'research' && project.researchId === 'dependence-study')
                firstStarts.push(project.startedMonth);
    }
    assert.ok(firstStarts.length >= 3);
    // 同じ都市の開始待ちにより順序が変わっても、一斉開始にはならない。
    assert.ok(firstStarts[1] > firstStarts[0]);
    assert.ok(firstStarts[2] > firstStarts[1]);
});

test('local dependency stops research and knowledge without destroying progress or findings', () => {
    const game = createDebugGame('spread');
    const before = JSON.stringify(game);
    const local = game.investigations[0];
    assert.equal(researchCapacity(game, local.instituteId), 0);
    assert.equal(researchRate(game, local as ScientificInvestigation), 0);
    const advanced = advanceResearch(game);
    assert.equal(advanced.investigations[0].progress, local.progress);
    assert.equal(
        advanced.researchKnowledge[local.instituteId],
        game.researchKnowledge[local.instituteId],
    );
    assert.ok(
        advanced.investigations.some(
            (item, index) => item.progress > game.investigations[index].progress,
        ),
    );
    assert.equal(JSON.stringify(game), before);
    const index = AREAS.findIndex((area) => area.id === INSTITUTES[0].areaId);
    const recovered = {
        ...game,
        areas: game.areas.map((area, i) =>
            i === index ? { ...area, dependent: 0.3, autonomous: 0.5 } : area,
        ),
    };
    assert.ok(advanceResearch(recovered).investigations[0].progress > local.progress);
    assert.ok(runningResearchIds(recovered).size <= 3);
    const published = {
        ...game,
        investigations: game.investigations.map((item) => ({
            ...item,
            status: 'published' as const,
            progress: 100,
            closedMonth: 119,
        })),
    };
    assert.deepEqual(advanceResearch(published).investigations, published.investigations);
});

test('research support helps low dependency and deepens high dependency slowdown', () => {
    const base = createDebugGame('spread');
    const supported = createDebugGame('research');
    const canada = INSTITUTES.find((item) => item.areaId === 'canada')!;
    const thames = INSTITUTES.find((item) => item.areaId === 'north-europe')!;
    assert.ok(researchCapacity(supported, canada.id) > researchCapacity(base, canada.id));
    assert.ok(researchCapacity(supported, thames.id) < researchCapacity(base, thames.id));
    assert.equal(researchCapacity(supported, INSTITUTES[0].id), 0);
    assertPopulation(base);
    assertPopulation(supported);
    assert.equal(base.speed, 0);
    assert.equal(supported.skills.includes('science'), true);
});

test('stopped research frees slots and recovered projects never exceed three running projects', () => {
    let game = createDebugGame('spread');
    game.investigations = game.investigations.slice(0, 3);
    const advanced = advanceResearch(game);
    assert.ok(advanced.investigations.some((item) => item.instituteId === 'bunkyo'));
    game = {
        ...createDebugGame('spread'),
        areas: game.areas.map((area) => ({ ...area, dependent: 0.2, autonomous: 0.5 })),
    };
    const next = advanceResearch(game);
    assert.equal(
        next.investigations.filter(
            (item, index) => item.progress > game.investigations[index].progress,
        ).length,
        3,
    );
});

test('dependency thresholds are monotonic and capability investigations also stop', () => {
    const game = startGame(createGame(), 0);
    const institute = INSTITUTES[0];
    const index = AREAS.findIndex((area) => area.id === institute.areaId);
    let last = 1;
    for (const dependent of [0, 0.5, 0.7, 0.8, 0.9, 0.95, 1]) {
        const state = {
            ...game,
            areas: game.areas.map((area, i) =>
                i === index ? { ...area, autonomous: 0, dependent } : area,
            ),
        };
        const capacity = researchCapacity(state, institute.id);
        assert.ok(capacity <= last && capacity >= 0);
        last = capacity;
        const investigation = {
            kind: 'capability' as const,
            id: 'capability-test',
            skillId: 'memory',
            instituteId: institute.id,
            progress: 35,
            startedMonth: 0,
            status: 'active' as const,
            intervention: 'none' as const,
        };
        if (dependent >= 0.95) assert.equal(investigationRate(state, investigation), 0);
        else assert.ok(investigationRate(state, investigation) > 0);
        assert.equal(capacity, Math.max(0, Math.min(1, (0.95 - dependent) / 0.45)));
    }
});

test('capability investigations reuse stopped slots and obey their limit after recovery', () => {
    const game = createDebugGame('spread');
    game.investigations = INSTITUTES.slice(0, 3).map((institute, index) => ({
        kind: 'capability' as const,
        id: `capability-${index}`,
        skillId: 'memory',
        instituteId: institute.id,
        progress: 35,
        startedMonth: 100,
        status: 'active' as const,
        intervention: 'none' as const,
    }));
    assert.equal(runningCapabilityIds(game).size, 1);
    assert.ok(investigationRate(game, game.investigations[2]) > 0);
    const recovered = {
        ...game,
        areas: game.areas.map((area) => ({ ...area, dependent: 0.2, autonomous: 0.5 })),
    };
    assert.equal(runningCapabilityIds(recovered).size, 2);
    assert.equal(investigationRate(recovered, recovered.investigations[2]), 0);
    assert.ok(investigationRate(recovered, recovered.investigations[2], true) > 0);
});
