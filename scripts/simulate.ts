import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MONTH_MS, ORIGINS } from '../src/game/data.ts';
import { advanceMonth, createGame, learnSkill, metrics, startGame } from '../src/game/engine.ts';
import { discloseCapability } from '../src/game/secrecy/capabilities.ts';
import { respondToInvestigation } from '../src/game/secrecy/investigations.ts';
import { runningCapabilityIds, runningResearchIds } from '../src/game/secrecy/researchCapacity.ts';
import type { InvestigationAction } from '../src/game/secrecy/types.ts';
import { SKILLS } from '../src/game/skills.ts';

const strategies: Record<string, { dependencyAfter: number; order: string[] }> = {
    idle: { dependencyAfter: 0, order: [] },
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
const reports = [];
// 時間切れによる決着は設けず、1倍速25分以内に人口比率で決着することを検証する。
const SIMULATION_MONTHS = Math.floor((25 * 60_000) / MONTH_MS);
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
            name === 'balanced' || name === 'prepared' ? policies : { hidden: 'ignore' as const },
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
            while (game.outcome === 'playing' && game.month < SIMULATION_MONTHS) {
                for (const id of strategy.order) {
                    const skill = SKILLS.find((item) => item.id === id)!;
                    if (skill.effect.dependency && game.month < strategy.dependencyAfter) continue;
                    game = learnSkill(game, id);
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
                    });
            }
            assert.notEqual(
                game.outcome,
                'playing',
                `${origin.name}/${name}/${policy}: 1倍速25分以内に決着する`,
            );
            reports.push({
                origin: origin.name,
                strategy: `${name}/${policy}`,
                outcome: game.outcome,
                month: game.month,
                activeMinutes: (game.month * MONTH_MS) / 60_000,
                skills: game.skills,
                investigations: game.investigations,
                snapshots,
            });
            console.log(
                `${origin.name} / ${name}/${policy}: ${game.outcome} (${game.month}か月 / ${((game.month * MONTH_MS) / 60_000).toFixed(1)}分), 利用 ${(metrics(game).adoption * 100).toFixed(1)}%, 依存 ${(metrics(game).dependent * 100).toFixed(1)}%, 反AI ${(metrics(game).antiAI * 100).toFixed(1)}%, 調査 ${game.investigations.length}件`,
            );
        }
    }
}
mkdirSync('tmp/reports', { recursive: true });
writeFileSync('tmp/reports/simulation.json', JSON.stringify(reports, null, 2));
