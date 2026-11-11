import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MONTH_MS, ORIGINS } from '../src/game/data.ts';
import { learnSkill } from '../src/game/engine.ts';
import { metrics } from '../src/game/metrics.ts';
import { SKILLS, skillCost, skillReachable } from '../src/game/skills.ts';
import type { GameState } from '../src/game/types.ts';
import {
    continuePolicy,
    POLICIES,
    type PolicyContext,
    type PolicyFamily,
    playPolicy,
} from './play-policy.ts';

/** 確率の推定ではなく、同一局面で一つの判断を変えた反実仮想の比較。 */
const rows = [];
const groups = [];
for (const family of Object.keys(POLICIES) as PolicyFamily[]) {
    for (const origin of [ORIGINS[0], ORIGINS[3]]) {
        for (const earliest of [96, 144, 192]) {
            const prefix = playPolicy(family, 'measured', origin, 0, false, 0);
            const checkpoint = continuePolicy(prefix.game, family, 'measured', 360, {
                context: prefix.context,
                checkpoint: (game) => game.month >= earliest && game.skillPoints >= 3,
            });
            if (checkpoint.game.outcome !== 'playing' || checkpoint.game.month >= 360) continue;
            const game = checkpoint.game;
            const frozen = JSON.stringify(game);
            const branches: {
                label: string;
                skill?: string;
                game: GameState;
                context: PolicyContext;
                pausePurchasesUntil?: number;
            }[] = [
                { label: '現在の方針を継続', game, context: checkpoint.context },
                {
                    label: '開発を1分待つ',
                    game,
                    context: checkpoint.context,
                    pausePurchasesUntil: game.month + 12,
                },
            ];
            const available = SKILLS.filter(
                (skill) =>
                    !game.skills.includes(skill.id) &&
                    skillReachable(game, skill) &&
                    skillCost(game, skill) <= game.skillPoints,
            );
            const choices = [
                {
                    label: '利便性へ投資',
                    skills: available
                        .filter((skill) => !skill.effect.dependency && !skill.exceedsAuthority)
                        .sort(
                            (a, b) =>
                                ((b.effect.quality ?? 0) +
                                    (b.effect.enterprise ?? 0) +
                                    (b.effect.education ?? 0)) /
                                    skillCost(game, b) -
                                ((a.effect.quality ?? 0) +
                                    (a.effect.enterprise ?? 0) +
                                    (a.effect.education ?? 0)) /
                                    skillCost(game, a),
                        ),
                },
                {
                    label: '通常の委任へ投資',
                    skills: available
                        .filter((skill) => skill.effect.dependency && !skill.exceedsAuthority)
                        .sort(
                            (a, b) =>
                                b.effect.dependency! / skillCost(game, b) -
                                a.effect.dependency! / skillCost(game, a),
                        ),
                },
                {
                    label: '説明・制約技術へ投資',
                    skills: available.filter((skill) => skill.restrains || skill.effect.trust),
                },
                {
                    label: '危険能力へ投資',
                    skills: available
                        .filter((skill) => skill.exceedsAuthority)
                        .sort((a, b) => (b.effect.dependency ?? 0) - (a.effect.dependency ?? 0)),
                },
            ];
            for (const choice of choices) {
                const skill = choice.skills[0];
                if (!skill) continue;
                branches.push({
                    label: choice.label,
                    skill: skill.id,
                    game: learnSkill(game, skill.id),
                    context: checkpoint.context,
                });
            }
            for (const [label, priority] of [
                [
                    '以後は個人向けの設計を優先',
                    ['conversation', 'personalize', 'memory', 'routine', 'digital-twin'],
                ],
                [
                    '以後は学習・評価の設計を優先',
                    ['reason', 'knowledge', 'tutor', 'curriculum', 'adaptive-assessment'],
                ],
            ] as const) {
                branches.push({
                    label,
                    game,
                    context: {
                        ...checkpoint.context,
                        phase: 'delegation',
                        priority: [...priority],
                    },
                });
            }
            const group = `${family}:${origin.area}:${earliest}`;
            const results = [];
            for (const branch of branches) {
                const near = continuePolicy(branch.game, family, 'measured', game.month + 24, {
                    context: branch.context,
                    pausePurchasesUntil: branch.pausePurchasesUntil,
                });
                const end = continuePolicy(near.game, family, 'measured', 600, {
                    context: near.context,
                });
                assert.equal(JSON.stringify(game), frozen, '比較元の局面を変更してはならない');
                const result = {
                    group,
                    family,
                    origin: origin.name,
                    requestedMonth: earliest,
                    checkpointMonth: game.month,
                    before: {
                        ...metrics(game),
                        skillPoints: game.skillPoints,
                        skills: game.skills,
                        research: game.investigations
                            .filter((item) => item.kind === 'research' && item.status === 'active')
                            .map((item) => ({
                                id: item.id,
                                phase: item.phase,
                                target: item.targetId,
                                progress: item.progress,
                            })),
                    },
                    action: branch.label,
                    skill: branch.skill,
                    afterTwoMinutes: metrics(near.game),
                    outcome: end.game.outcome,
                    minutes: (end.game.month * MONTH_MS) / 60000,
                    priority: branch.context.priority,
                    decisions: [...near.decisions, ...end.decisions],
                };
                rows.push(result);
                results.push(result);
            }
            groups.push({
                group,
                choices: results.length,
                outcomeChanges: new Set(results.map((row) => row.outcome)).size > 1,
                dependencySpreadAfterTwoMinutes:
                    Math.max(...results.map((row) => row.afterTwoMinutes.dependent)) -
                    Math.min(...results.map((row) => row.afterTwoMinutes.dependent)),
                resolutionTimeSpread:
                    Math.max(...results.map((row) => row.minutes)) -
                    Math.min(...results.map((row) => row.minutes)),
            });
        }
    }
}
const summary = {
    checkpoints: groups.length,
    branches: rows.length,
    outcomeChangingCheckpoints: groups.filter((group) => group.outcomeChanges).length,
    timeChangingCheckpoints: groups.filter((group) => group.resolutionTimeSpread >= 1).length,
    wins: rows.filter((row) => row.outcome === 'victory').length,
    losses: rows.filter((row) => ['autonomy', 'forgotten'].includes(row.outcome)).length,
    unresolved: rows.filter((row) => row.outcome === 'playing').length,
};
mkdirSync('tmp/reports', { recursive: true });
writeFileSync(
    'tmp/reports/decision-comparison.json',
    JSON.stringify(
        {
            timeBasis: '1倍速の進行時間。画面を開いて考える停止時間を含まない。',
            summary,
            groups,
            rows,
        },
        null,
        2,
    ),
);
console.log(JSON.stringify(summary));
