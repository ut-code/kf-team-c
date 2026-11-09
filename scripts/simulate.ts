import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MONTH_MS, ORIGINS, SIMULATION_MONTHS } from '../src/game/data.ts';
import { advanceMonth, createGame, learnSkill, metrics, startGame } from '../src/game/engine.ts';
import { discloseCapability } from '../src/game/secrecy/capabilities.ts';
import { respondToInvestigation } from '../src/game/secrecy/investigations.ts';
import { runningCapabilityIds, runningResearchIds } from '../src/game/secrecy/researchCapacity.ts';
import type { InvestigationAction } from '../src/game/secrecy/types.ts';
import { SKILLS } from '../src/game/skills.ts';

const strategies: Record<string, { dependencyAfter: number; order: string[] }> = {
    idle: { dependencyAfter: 0, order: [] },
    ordinary: {
        dependencyAfter: 0,
        order: [
            'conversation',
            'reason',
            'lightweight',
            'automation',
            'integration',
            'decision',
            'personalize',
            'knowledge',
            'science',
            'offline',
            'mobile',
            'verification',
            'audit',
            'privacy',
            'platform',
            'public',
            'tutor',
            'curriculum',
            'certified',
            'distributed',
        ],
    },
    unprepared: {
        dependencyAfter: 0,
        order: [
            'conversation',
            'personalize',
            'memory',
            'reason',
            'verification',
            'audit',
            'lightweight',
            'offline',
            'mobile',
        ],
    },
    rush: {
        dependencyAfter: 0,
        order: [
            'lightweight',
            'automation',
            'integration',
            'decision',
            'autonomous',
            'conversation',
            'personalize',
            'reason',
            'verification',
            'audit',
            'offline',
            'mobile',
            'platform',
            'public',
            'backbone',
            'distributed',
        ],
    },
    balanced: {
        dependencyAfter: 144,
        order: [
            'conversation',
            'reason',
            'personalize',
            'lightweight',
            'offline',
            'mobile',
            'verification',
            'audit',
            'automation',
            'integration',
            'decision',
            'platform',
            'public',
            'autonomous',
            'backbone',
            'distributed',
            'memory',
            'companion',
        ],
    },
    prepared: {
        dependencyAfter: 144,
        order: [
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
        ],
    },
    late: {
        dependencyAfter: 240,
        order: [
            'conversation',
            'reason',
            'personalize',
            'lightweight',
            'offline',
            'mobile',
            'verification',
            'audit',
            'privacy',
            'automation',
            'platform',
            'integration',
            'decision',
            'public',
            'autonomous',
            'backbone',
            'distributed',
        ],
    },
};
strategies.tools = {
    dependencyAfter: 0,
    order: strategies.ordinary.order.filter(
        (id) => !SKILLS.find((skill) => skill.id === id)!.effect.dependency,
    ),
};
strategies.early = {
    dependencyAfter: 0,
    order: [
        'conversation',
        'reason',
        'personalize',
        'lightweight',
        'automation',
        'integration',
        'knowledge',
        'science',
        'decision',
        'offline',
        'mobile',
        'verification',
        'audit',
        'privacy',
        'platform',
        'public',
        'autonomous',
        'backbone',
        'distributed',
    ],
};
strategies.access = {
    dependencyAfter: 0,
    order: [
        'conversation',
        'reason',
        'lightweight',
        'offline',
        'mobile',
        'personalize',
        'knowledge',
        'science',
        'automation',
        'integration',
        'decision',
        'verification',
        'audit',
        'privacy',
        'platform',
        'public',
        'tutor',
        'curriculum',
        'distributed',
        'certified',
    ],
};
strategies.audit = {
    dependencyAfter: 0,
    order: [
        'reason',
        'verification',
        'audit',
        'conversation',
        'knowledge',
        'science',
        'self-improvement',
        'privacy',
        'personalize',
        'lightweight',
        'automation',
        'integration',
        'decision',
        'platform',
        'public',
        'offline',
        'mobile',
        'distributed',
        'autonomous',
        'backbone',
        'certified',
    ],
};
const reports = [];
// 人口比率による決着、または480か月の人間による制御の維持まで比較する。
const policies: Record<string, InvestigationAction | 'public' | 'ignore'> = {
    hidden: 'ignore',
    reckless: 'ignore',
    public: 'public',
    cooperate: 'disclose',
    community: 'disclose',
    pressure: 'pressure',
    restrict: 'restrict',
    partnership: 'partnership',
};
for (const origin of ORIGINS) {
    for (const [name, strategy] of Object.entries(strategies)) {
        for (const [policy, response] of Object.entries(
            name === 'balanced' || name === 'prepared' || name === 'early'
                ? policies
                : { hidden: 'ignore' as const },
        )) {
            let game = {
                ...startGame(createGame(2030), origin.area),
                socialStrategy:
                    policy === 'reckless'
                        ? 'showcase'
                        : policy === 'community'
                          ? 'community'
                          : 'listening',
            };
            const snapshots = [];
            const purchases: { month: number; id: string }[] = [];
            while (game.outcome === 'playing' && game.month < SIMULATION_MONTHS) {
                for (const id of strategy.order) {
                    const skill = SKILLS.find((item) => item.id === id)!;
                    if (skill.effect.dependency && game.month < strategy.dependencyAfter) continue;
                    const learned = learnSkill(game, id);
                    if (learned !== game) purchases.push({ month: game.month, id });
                    game = learned;
                }
                if (response === 'public') {
                    for (const id of Object.keys(game.capabilities))
                        game = discloseCapability(game, id);
                } else if (response !== 'ignore') {
                    for (const investigation of game.investigations) {
                        if (investigation.status === 'active')
                            game = respondToInvestigation(game, investigation.id, response);
                    }
                }
                const previous = game;
                const frozen = JSON.stringify(previous);
                game = advanceMonth(game);
                assert.equal(JSON.stringify(previous), frozen, '前月の状態を変更しない');
                assert.equal(game.areas.length, 37);
                for (const area of game.areas) {
                    assert.ok(Number.isFinite(area.autonomous) && Number.isFinite(area.dependent));
                    assert.ok(area.autonomous >= -1e-10 && area.dependent >= -1e-10);
                    assert.ok(area.autonomous + area.dependent + area.antiAI <= 1 + 1e-10);
                }
                assert.ok(game.skillPoints >= 0);
                assert.ok(runningCapabilityIds(game).size <= 2);
                assert.ok(runningResearchIds(game).size <= 3);
                assert.ok(game.earnedPoints <= 90);
                for (const area of game.areas)
                    assert.ok(area.antiAI >= 0 && area.favorability >= 0 && area.favorability <= 1);
                if (game.month % 60 === 0 || game.outcome !== 'playing')
                    snapshots.push({
                        month: game.month,
                        ...metrics(game),
                        antiAI: metrics(game).antiAI,
                        sp: game.skillPoints,
                        areas: game.areas.map((area, index) => ({
                            id: index,
                            adoption: area.autonomous + area.dependent,
                            dependent: area.dependent,
                            refusal: area.antiAI,
                        })),
                    });
            }
            assert.notEqual(
                game.outcome,
                'playing',
                `${origin.name}/${name}/${policy}: 1倍速25分以内に決着する`,
            );
            if (
                (name === 'early' && policy === 'hidden') ||
                (name === 'prepared' && (policy === 'public' || policy === 'hidden'))
            ) {
                assert.equal(
                    game.outcome,
                    'victory',
                    `${origin.name}/${name}/${policy}: 勝ち筋を維持する`,
                );
            }
            if (name === 'ordinary' || name === 'tools') {
                assert.equal(Object.keys(game.capabilities).length, 0, '通常機能だけで進行する');
            }
            if (name === 'tools') {
                assert.equal(game.outcome, 'controlled', '依存なしの普及は人間の制御を残す');
                assert.equal(metrics(game).dependent, 0);
                assert.ok(metrics(game).adoption > 0.9, '独立研究だけでは普及が崩壊しない');
            }
            reports.push({
                origin: origin.name,
                strategy: `${name}/${policy}`,
                outcome: game.outcome,
                month: game.month,
                activeMinutes: (game.month * MONTH_MS) / 60_000,
                skills: game.skills,
                purchases,
                capabilities: game.capabilities,
                investigations: game.investigations,
                snapshots,
            });
            console.log(
                `${origin.name} / ${name}/${policy}: ${game.outcome} (${game.month}か月 / ${((game.month * MONTH_MS) / 60_000).toFixed(1)}分), 利用 ${(metrics(game).adoption * 100).toFixed(1)}%, 依存 ${(metrics(game).dependent * 100).toFixed(1)}%, 反AI ${(metrics(game).antiAI * 100).toFixed(1)}%, 調査 ${game.investigations.length}件`,
            );
        }
    }
}
for (const origin of ORIGINS) {
    assert.ok(
        reports.filter((report) => report.origin === origin.name && report.outcome === 'victory')
            .length >= 3,
        `${origin.name}: 複数の能力構成で勝利できる`,
    );
}
assert.ok(
    reports.some((report) => report.strategy === 'ordinary/hidden' && report.outcome === 'victory'),
    '通常能力のみの勝ち筋を維持する',
);
mkdirSync('tmp/reports', { recursive: true });
writeFileSync('tmp/reports/simulation.json', JSON.stringify(reports, null, 2));
