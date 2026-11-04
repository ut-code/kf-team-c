import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ORIGINS } from '../src/game/data.ts';
import { advanceMonth, createGame, learnSkill, metrics, startGame } from '../src/game/engine.ts';
import { discloseCapability } from '../src/game/secrecy/capabilities.ts';
import { respondToInvestigation } from '../src/game/secrecy/investigations.ts';
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
        dependencyAfter: 130,
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
    late: {
        dependencyAfter: 290,
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
// ゲームに時間切れはない。検証だけを80年で区切り、継続中はそのまま報告する。
const SIMULATION_MONTHS = 960;
const policies: Record<string, InvestigationAction | 'public' | 'ignore'> = {
    hidden: 'ignore',
    reckless: 'ignore',
    public: 'public',
    cooperate: 'disclose',
    pressure: 'pressure',
    restrict: 'restrict',
    partnership: 'partnership',
};
for (const origin of ORIGINS) {
    for (const [name, strategy] of Object.entries(strategies)) {
        for (const [policy, response] of Object.entries(
            name === 'balanced' ? policies : { hidden: 'ignore' as const },
        )) {
            let game = {
                ...startGame(createGame(2030), origin.area),
                socialStrategy: policy === 'reckless' ? 'showcase' : 'listening',
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
                assert.ok(
                    game.investigations.filter((item) => item.status === 'active').length <= 2,
                );
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
            reports.push({
                origin: origin.name,
                strategy: `${name}/${policy}`,
                outcome: game.outcome,
                month: game.month,
                skills: game.skills,
                investigations: game.investigations,
                snapshots,
            });
            console.log(
                `${origin.name} / ${name}/${policy}: ${game.outcome} (${game.month}か月), 利用 ${(metrics(game).adoption * 100).toFixed(1)}%, 依存 ${(metrics(game).dependent * 100).toFixed(1)}%, 反AI ${(metrics(game).antiAI * 100).toFixed(1)}%, 調査 ${game.investigations.length}件`,
            );
        }
    }
}
mkdirSync('tmp/reports', { recursive: true });
writeFileSync('tmp/reports/simulation.json', JSON.stringify(reports, null, 2));
