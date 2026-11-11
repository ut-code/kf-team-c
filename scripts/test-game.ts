import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD_NEWS } from '../src/content/news.ts';
import {
    AREAS,
    DEFEAT_OPPOSITION,
    MONTH_MS,
    ORIGINS,
    SIMULATION_MONTHS,
} from '../src/game/data.ts';
import { earnedSkillPoints, INITIAL_SKILL_POINTS } from '../src/game/economy.ts';
import { advanceMonth, createGame, learnSkill, startGame } from '../src/game/engine.ts';
import { metrics } from '../src/game/metrics.ts';
import { advanceSkillDevelopment, skillScale } from '../src/game/secrecy/capabilities.ts';
import { INSTITUTES } from '../src/game/secrecy/data.ts';
import { intentResearchReady } from '../src/game/secrecy/purpose.ts';
import {
    advanceResearch,
    publishedResearchEffects,
    RESEARCH_TOPICS,
} from '../src/game/secrecy/research.ts';
import { RESEARCH_CITY_REST } from '../src/game/secrecy/scheduling.ts';
import type { ScientificInvestigation } from '../src/game/secrecy/types.ts';
import { observeSkillUse } from '../src/game/skillDynamics.ts';
import { skillLayout } from '../src/game/skillLayout.ts';
import { SKILLS, skillBlockReason } from '../src/game/skills.ts';
import { advanceNews } from '../src/game/society/news.ts';
import { createSocialFeed, updateSocialFeed } from '../src/game/society/socialFeed.ts';
import type { GameState } from '../src/game/types.ts';

test('開発ツリーには循環・欠落・重なるノードがなく、委任技術には研究対象がある', () => {
    assert.equal(new Set(SKILLS.map((skill) => skill.id)).size, SKILLS.length);
    const positions = new Set<string>();
    for (const node of skillLayout().positions) {
        const skill = node.skill;
        assert.ok(skill.developmentMonths >= 0 && skill.cost > 0);
        const position = `${node.x}:${node.y}`;
        assert.ok(!positions.has(position));
        positions.add(position);
        const visit = (id: string, path: string[]) => {
            assert.ok(!path.includes(id), `循環：${path.join(' → ')} → ${id}`);
            const node = SKILLS.find((item) => item.id === id)!;
            assert.ok(node);
            for (const parent of node.requires) visit(parent, [...path, id]);
        };
        visit(skill.id, []);
        if (skill.effect.dependency) assert.ok(skill.domain);
    }
});

test('SPの購入は一回限りで、基礎スキルは即時完成して次の技術を開発できる', () => {
    const initial = startGame(createGame(), 0);
    const frozen = JSON.stringify(initial);
    let game = learnSkill(initial, 'reason');
    assert.equal(JSON.stringify(initial), frozen);
    assert.equal(game.skillPoints, INITIAL_SKILL_POINTS - 2);
    assert.equal(learnSkill(game, 'reason'), game);
    assert.equal(game.developmentProgress.reason, 1);
    game = { ...game, developmentProgress: advanceSkillDevelopment(game) };
    assert.equal(game.developmentProgress.reason, 1);
    assert.equal(skillBlockReason(game, SKILLS.find((skill) => skill.id === 'knowledge')!), null);
    const developed = learnSkill(game, 'knowledge');
    assert.ok(developed.skills.includes('reason') && developed.skills.includes('knowledge'));
    assert.equal(
        learnSkill({ ...game, skillPoints: 0 }, 'knowledge').skills.length,
        game.skills.length,
    );
});

test('制約技術は過去の証拠とSPを返さず、開発に応じて以後の介入だけを弱める', () => {
    const base = startGame(createGame(), 0);
    const game = {
        ...base,
        skills: ['mind-control', 'permission'],
        developmentProgress: { ...base.developmentProgress, 'mind-control': 1, permission: 0 },
        skillExposure: { ...base.skillExposure, 'mind-control': 40 },
        capabilities: { 'mind-control': { visibility: 'exposed' as const, evidence: 10 } },
    };
    const constrained = {
        ...game,
        developmentProgress: { ...game.developmentProgress, permission: 1 },
    };
    assert.ok(skillScale(constrained, 'mind-control') < skillScale(game, 'mind-control'));
    assert.deepEqual(constrained.capabilities, game.capabilities);
    assert.deepEqual(constrained.skillExposure, game.skillExposure);
    assert.equal(constrained.skillPoints, game.skillPoints);
});

test('基礎支給は普及しなくても続き、節目報酬は有限で再達成では増えない', () => {
    assert.ok(earnedSkillPoints(60_000 / MONTH_MS, 0, 0) > 0);
    assert.equal(earnedSkillPoints(100_000, 1, 1), earnedSkillPoints(200_000, 1, 1));
    const game = {
        ...startGame(createGame(), 0),
        month: 11,
        peakAdoption: 0.5,
        peakDependency: 0.25,
        earnedPoints: earnedSkillPoints(11, 0.5, 0.25),
    };
    const next = advanceMonth(game);
    assert.equal(
        next.skillPoints - game.skillPoints,
        earnedSkillPoints(next.month, next.peakAdoption, next.peakDependency) - game.earnedPoints,
    );
});

test('PR #6のニュースは実際の用途から一度だけ発生し、続報は先行報道を必要とする', () => {
    assert.equal(WORLD_NEWS.length, 11);
    const initial = startGame(createGame(), 0);
    const game = {
        ...initial,
        month: 100,
        skills: ['discovery'],
        developmentProgress: { ...initial.developmentProgress, discovery: 1 },
        areas: initial.areas.map((area) => ({ ...area, autonomous: 0.5 })),
    };
    const result = advanceNews(game);
    assert.deepEqual(
        result.news.map((item) => item.id),
        ['breakthrough-discovery'],
    );
    assert.deepEqual(result.areas, game.areas);
    assert.equal(result.skillPoints, game.skillPoints);
    assert.equal(advanceNews(result), result);
    const follow = advanceNews({ ...result, month: result.month + 18 });
    assert.deepEqual(
        follow.news.map((item) => item.id),
        ['breakthrough-discovery', 'discovery-followup'],
    );
    const feed = createSocialFeed(follow);
    assert.equal(updateSocialFeed(follow, follow, feed), feed);
    assert.equal(feed.posts.filter((post) => post.headline).length, 2);
});

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
test('機能を改善しないAIは利用者を失い、利用率0.0%で敗北する', () => {
    for (const origin of ORIGINS) {
        let game = startGame(createGame(), origin.area);
        while (game.outcome === 'playing' && game.month * MONTH_MS < 60 * 60_000) {
            game = advanceMonth(game);
            assertPopulation(game);
        }
        assert.equal(game.outcome, 'forgotten', origin.name);
        assert.equal(metrics(game).adoption, 0);
        assert.ok(metrics(game).antiAI < DEFEAT_OPPOSITION);
        assert.equal(advanceMonth(game), game);
    }
});

test('権限逸脱のない最終研究は、存在しない能力を露呈させない', () => {
    const game = {
        ...startGame(createGame(), 0),
        skills: ['decision'],
        investigations: [
            {
                ...scientificProject('goal-decoding'),
                status: 'published' as const,
                phase: 'complete' as const,
                coverage: AREAS.map(() => 0.8),
                publishedMonth: 0,
                progress: 100,
                closedMonth: 0,
            },
        ],
    };
    assert.deepEqual(advanceResearch(game).capabilities, {});
    assert.equal(advanceResearch(game).outcome, 'playing');
});

test('人口移動は経過月ではなく、社会と研究の状態に従う', () => {
    const game = { ...startGame(createGame(), 0), lastEncounterMonth: 10000 };
    const later = { ...game, month: SIMULATION_MONTHS - 2 };
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
        collaborators: [],
        observedExposure: 0,
        targetId:
            researchId === 'goal-decoding'
                ? 'coercion'
                : ['decision-tracing', 'informed-consent'].includes(researchId)
                  ? 'workflow'
                  : researchId === 'data-portability'
                    ? 'records'
                    : researchId === 'independent-learning'
                      ? 'learning'
                      : 'general',
        phase: 'research',
        coverage: AREAS.map(() => 0),
        instituteId: 'metrica',
        progress: 20,
        startedMonth: 0,
        status: 'active',
    };
}

test('共同研究はテーマごとに一件で、同じ都市の連続着手と同時大量発生を防ぐ', () => {
    let game = researchFixture();
    let firstStarts = 0;
    for (let month = 1; month <= 500; month++) {
        const previous = game;
        game = advanceResearch({ ...game, month, skillExposure: observeSkillUse(game) });
        const added = game.investigations.filter(
            (item) =>
                item.status === 'active' &&
                !previous.investigations.some((old) => old.id === item.id),
        );
        assert.ok(added.length <= 1);
        assert.ok(game.investigations.filter((item) => item.status === 'active').length <= 3);
        const research = game.investigations.filter((item) => item.kind === 'research');
        assert.equal(new Set(research.map((item) => item.id)).size, research.length);
        for (const project of added) {
            if (project.kind === 'research' && project.researchId === 'dependence-study')
                firstStarts++;
            const host = INSTITUTES.find((item) => item.id === project.instituteId)!;
            for (const old of previous.investigations) {
                const prior = INSTITUTES.find((item) => item.id === old.instituteId)!;
                if (
                    old.kind === 'research' &&
                    RESEARCH_TOPICS.find((topic) => topic.id === old.researchId)!.background
                )
                    continue;
                if (
                    old.closedMonth !== undefined &&
                    Math.abs(host.longitude - prior.longitude) < 2 &&
                    Math.abs(host.latitude - prior.latitude) < 2
                )
                    assert.ok(month - old.closedMonth >= RESEARCH_CITY_REST);
            }
        }
    }
    assert.equal(firstStarts, 1);
});

function researchFixture(): GameState {
    const game = startGame(createGame(), 0);
    return {
        ...game,
        skills: ['companion'],
        developmentProgress: { ...game.developmentProgress, companion: 1 },
        skillExposure: Object.fromEntries(Object.keys(game.skillExposure).map((id) => [id, 100])),
        capabilities: { companion: { visibility: 'public', evidence: 10 } },
        areas: game.areas.map((area) => ({ ...area, autonomous: 0.3, dependent: 0.1 })),
    };
}

test('利用率0.0%の表示と敗北判定が一致し、序盤だけの離脱補正はない', () => {
    const fixture = (use: number, month: number) => ({
        ...startGame(createGame(), 0),
        month,

        areas: AREAS.map(() => ({ autonomous: use, dependent: 0, antiAI: 0, favorability: 0.58 })),
    });
    assert.equal(advanceMonth(fixture(0.00049, 0)).outcome, 'forgotten');
    assert.equal(advanceMonth(fixture(0.00051, 0)).outcome, 'playing');
    assert.deepEqual(advanceMonth(fixture(0.1, 0)).areas, advanceMonth(fixture(0.1, 200)).areas);
});

test('個人記録への対策はマインドコントロールに転用されず、取り直しても消えない', () => {
    const project = {
        ...scientificProject('data-portability'),
        phase: 'complete' as const,
        status: 'published' as const,
        publishedMonth: 0,
        closedMonth: 0,
        coverage: AREAS.map(() => 0.8),
    };
    const game = {
        ...startGame(createGame(), 0),
        month: 120,
        skills: ['memory', 'mind-control'],
        investigations: [project],
    };
    const effects = publishedResearchEffects(game, 0);
    assert.ok(effects.resistance.memory > 0);
    assert.equal(effects.resistance['mind-control'], undefined);
    assert.deepEqual(
        publishedResearchEffects({ ...game, skills: [] }, 0).resistance,
        effects.resistance,
    );
    assert.deepEqual(
        publishedResearchEffects({ ...game, skills: ['memory'] }, 0).resistance,
        effects.resistance,
    );
});

test('法律は審議後に段階施行され、規制の適用率に応じて対象能力だけを制限する', () => {
    const project = { ...scientificProject('informed-consent'), progress: 99.999 };
    let game = { ...researchFixture(), month: 100, investigations: [project] };
    game = advanceResearch(game);
    assert.equal(game.investigations[0].kind, 'research');
    let current = game.investigations[0] as ScientificInvestigation;
    assert.equal(current.phase, 'validation');
    assert.equal(publishedResearchEffects(game, 0).resistance.decision, undefined);
    game = advanceResearch({ ...game, investigations: [{ ...current, progress: 99.999 }] });
    current = game.investigations[0] as ScientificInvestigation;
    assert.equal(current.phase, 'legislation');
    assert.equal(current.status, 'active');
    assert.equal(publishedResearchEffects(game, 0).resistance.decision, 0);
    game = advanceResearch({ ...game, month: 101 });
    const center = AREAS.findIndex(
        (area) => area.id === INSTITUTES.find((item) => item.id === project.instituteId)!.areaId,
    );
    assert.ok(publishedResearchEffects(game, center).resistance.decision > 0);
    assert.equal(game.investigations[0].status, 'active');
});

function purposeFixture(): GameState {
    const game = startGame(createGame(), 0);
    const skills = ['reason', 'integration', 'decision', 'public', 'curriculum'];
    const finding = (id: string): ScientificInvestigation => ({
        ...scientificProject(id),
        phase: 'complete',
        status: 'published',
        publishedMonth: 80,
        closedMonth: 80,
        progress: 100,
        coverage: AREAS.map(() => 1),
        collaborators: ['thames'],
    });
    return {
        ...game,
        month: 160,
        skills,
        developmentProgress: Object.fromEntries(
            SKILLS.map((skill) => [skill.id, skills.includes(skill.id) ? 1 : 0]),
        ),

        areas: AREAS.map(() => ({
            autonomous: 0.7,
            dependent: 0.2,
            antiAI: 0.02,
            favorability: 0.8,
        })),
        skillExposure: Object.fromEntries(
            SKILLS.map((skill) => [skill.id, skills.includes(skill.id) ? 60 : 0]),
        ),
        researchKnowledge: Object.fromEntries(INSTITUTES.map((institute) => [institute.id, 200])),
        investigations: [finding('dependence-study'), finding('decision-tracing')],
    };
}

test('目的の解読は危険能力なしでも行動資料と独立検証から始まり、資料なしでは始まらない', () => {
    const game = purposeFixture();
    assert.ok(
        game.skills.every((id) => !SKILLS.find((skill) => skill.id === id)!.exceedsAuthority),
    );
    assert.ok(intentResearchReady(game));
    assert.equal(
        intentResearchReady({ ...game, skillExposure: createGame().skillExposure }),
        false,
    );
    assert.equal(intentResearchReady({ ...game, investigations: [] }), false);
    let advanced = game;
    for (let month = game.month; month < game.month + 30; month++)
        advanced = advanceResearch({ ...advanced, month });
    const purpose = advanced.investigations.find(
        (item) => item.kind === 'research' && item.researchId === 'intent-decoding',
    );
    assert.ok(purpose);
    assert.ok(purpose.progress < 100);
    assert.deepEqual(advanced.capabilities, {});
});

test('目的の立証は通常利用者の拒否を促すが、高依存や社会基盤への組み込みで離脱しにくくなる', () => {
    const base = purposeFixture();
    const proof: ScientificInvestigation = {
        ...scientificProject('intent-decoding'),
        targetId: 'general',
        phase: 'complete',
        status: 'published',
        progress: 100,
        publishedMonth: 0,
        closedMonth: 0,
        coverage: AREAS.map(() => 1),
        collaborators: ['thames', 'deccan'],
    };
    const known = { ...base, investigations: [...base.investigations, proof] };
    const noInfrastructure = { ...known, skills: ['reason', 'curriculum'] };
    const ordinary = publishedResearchEffects(noInfrastructure, 0).intent;
    assert.ok(ordinary > 0.5);
    assert.ok(publishedResearchEffects(known, 0).intent < ordinary);
    const controlled = {
        ...known,
        investigations: [
            ...known.investigations,
            {
                ...scientificProject('informed-consent'),
                phase: 'complete' as const,
                status: 'published' as const,
                publishedMonth: 0,
                closedMonth: 0,
                coverage: AREAS.map(() => 1),
            },
        ],
    };
    assert.ok(
        publishedResearchEffects(controlled, 0).intent > publishedResearchEffects(known, 0).intent,
        '人間が判断を引き取れる業務を、切り離せない社会基盤として数えてはならない',
    );
    const captured = {
        ...noInfrastructure,
        areas: noInfrastructure.areas.map((area) => ({
            ...area,
            autonomous: 0.01,
            dependent: 0.96,
            antiAI: 0.02,
        })),
    };
    assert.equal(publishedResearchEffects(captured, 0).intent, 0);
    assert.ok(metrics(advanceMonth(known)).antiAI > metrics(advanceMonth(base)).antiAI);
    assert.deepEqual(advanceResearch(known).capabilities, {});
});

test('個別能力の解析を残し、研究は公表で完了して現場対策の案件を作らない', () => {
    const game = purposeFixture();
    const project = {
        ...scientificProject('goal-decoding'),
        phase: 'validation' as const,
        progress: 99.999,
    };
    const published = advanceResearch({ ...game, investigations: [project] });
    const result = published.investigations[0] as ScientificInvestigation;
    assert.equal(result.researchId, 'goal-decoding');
    assert.equal(result.phase, 'complete');
    assert.equal(result.status, 'published');
    assert.deepEqual(published.capabilities, {});
    const law = RESEARCH_TOPICS.find((topic) => topic.id === 'informed-consent')!;
    assert.equal(law.category, 'regulation');
    assert.equal(
        RESEARCH_TOPICS.find((topic) => topic.id === 'intent-decoding')!.category,
        'research',
    );
});
