import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MONTH_MS, ORIGINS } from '../src/game/data.ts';
import { advanceMonth, createGame, learnSkill, metrics, startGame } from '../src/game/engine.ts';
import { discloseCapability } from '../src/game/secrecy/capabilities.ts';
import { respondToInvestigation } from '../src/game/secrecy/investigations.ts';
import { SKILLS } from '../src/game/skills.ts';
import { strategies } from './play-strategies.ts';

// Fixed, inspectable bounded-rational policies, not an estimated human win rate.
// Each has a distinct core; responses are based on visible population and investigations.
const families = {
    industry: [...strategies.rush.order, 'sns-intervention', 'memory', 'companion', 'mind-control'],
    trust: [
        ...strategies.audit.order.filter((id) => !['autonomous', 'backbone'].includes(id)),
        'tutor',
        'curriculum',
    ],
    emotion: [
        'conversation',
        'personalize',
        'memory',
        'companion',
        'reason',
        'knowledge',
        'science',
        'lightweight',
        'offline',
        'mobile',
        'verification',
        'audit',
        'privacy',
        'sns-intervention',
        'mind-control',
        'automation',
        'integration',
        'platform',
        'public',
        'distributed',
    ],
};
const validation = process.argv.includes('--validation');
const reports = [];
for (const origin of ORIGINS)
    for (const [family, order] of Object.entries(families)) {
        for (let profile = 0; profile < 4; profile++) {
            let game = startGame(createGame(2030 + profile + (validation ? 100 : 0)), origin.area);
            for (let n = 0; n < 960 && game.outcome === 'playing'; n++) {
                const world = metrics(game);
                if (n % (3 + profile * 2 + (validation ? 1 : 0)) === 0) {
                    // Low-to-moderate caution, preserving each family's chosen investment path.
                    const priority =
                        world.antiAI > [0.02, 0.05, 0.08, 0.12][profile]
                            ? [
                                  'sns-intervention',
                                  ...(family === 'emotion' ? ['mind-control'] : []),
                                  ...order,
                              ]
                            : order;
                    for (const id of priority) {
                        const skill = SKILLS.find((item) => item.id === id)!;
                        if (
                            skill.effect.dependency &&
                            world.adoption < [0.03, 0.08, 0.15, 0.25][profile]
                        )
                            continue;
                        if (
                            game.skillPoints < 3 &&
                            game.investigations.some((item) => item.status === 'active')
                        )
                            continue;
                        const next = learnSkill(game, id);
                        if (next !== game) {
                            game = next;
                            break;
                        }
                    }
                    for (const item of game.investigations) {
                        if (item.status !== 'active' || item.progress < 25 + profile * 15) continue;
                        if (family === 'trust' && item.kind === 'capability')
                            game = discloseCapability(game, item.skillId);
                        else
                            game = respondToInvestigation(
                                game,
                                item.id,
                                family === 'industry' ? 'pressure' : 'partnership',
                            );
                    }
                }
                game = advanceMonth(game);
                for (const area of game.areas) {
                    assert.ok(Number.isFinite(area.antiAI));
                    assert.ok(Math.min(area.autonomous, area.dependent, area.antiAI) >= -1e-10);
                    assert.ok(area.autonomous + area.dependent + area.antiAI <= 1 + 1e-10);
                }
            }
            reports.push({
                origin: origin.name,
                family,
                profile,
                outcome: game.outcome,
                month: game.month,
                minutes: (game.month * MONTH_MS) / 60000,
                ...metrics(game),
                skills: game.skills,
            });
        }
    }
const summary = Object.fromEntries(
    Object.keys(families).map((family) => {
        const rows = reports.filter((row) => row.family === family);
        return [
            family,
            {
                total: rows.length,
                wins: rows.filter((row) => row.outcome === 'victory').length,
                losses: rows.filter((row) => ['autonomy', 'forgotten'].includes(row.outcome))
                    .length,
                unresolved: rows.filter((row) => row.outcome === 'playing').length,
            },
        ];
    }),
);
mkdirSync('tmp/reports', { recursive: true });
writeFileSync(
    validation ? 'tmp/reports/balance-validation.json' : 'tmp/reports/balance.json',
    JSON.stringify({ summary, reports }, null, 2),
);
console.log(JSON.stringify(summary));

const winRate = reports.filter((row) => row.outcome === 'victory').length / reports.length;
const unresolved = reports.filter((row) => row.outcome === 'playing').length / reports.length;
if (process.argv.includes('--verify')) {
    assert.ok(winRate >= 0.4 && winRate <= 0.6, `Representative bot win rate ${winRate}`);
    assert.ok(unresolved <= 0.05, `Unresolved fraction ${unresolved}`);
    for (const family of Object.values(summary))
        assert.ok(family.wins > 0, 'Every distinct investment path must retain wins');
}
