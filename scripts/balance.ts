import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MONTH_MS, ORIGINS } from '../src/game/data.ts';
import { metrics } from '../src/game/metrics.ts';
import { researchTopic } from '../src/game/secrecy/research.ts';
import { POLICIES, type PolicyFamily, type PolicyTiming, playPolicy } from './play-policy.ts';

const validation = process.argv.includes('--validation');
const timeBasis =
    '1倍速で進行した時間。スキルツリー・研究パネル等を開いて判断する停止時間は含まない。';
// シードは主にSNS表現を変えるため、通常は同じ人口進行を重複集計しない。
const seedCount = Number(
    process.argv.find((arg) => arg.startsWith('--seeds='))?.split('=')[1] ?? 1,
);
assert.ok(Number.isInteger(seedCount) && seedCount > 0, 'シード数は正の整数で指定する');
const families = Object.keys(POLICIES) as PolicyFamily[];
const timings: PolicyTiming[] = ['early', 'measured', 'late'];
const executions = [
    { id: 'responsive', months: 6 },
    { id: 'standard', months: 12 },
    { id: 'hesitant', months: 24 },
];
const reports = [];
for (const origin of ORIGINS)
    for (const family of families)
        for (const timing of timings)
            for (const execution of executions)
                for (let profile = 0; profile < seedCount; profile++) {
                    const {
                        game,
                        decisions,
                        maxResearchMarkers,
                        phase,
                        researchHistory,
                        dependency80Month,
                        refusal80Month,
                    } = playPolicy(
                        family,
                        timing,
                        origin,
                        profile,
                        validation,
                        600,
                        execution.months,
                    );
                    reports.push({
                        origin: origin.name,
                        family,
                        timing,
                        profile,
                        execution: execution.id,
                        decisionIntervalSeconds: (execution.months * MONTH_MS) / 1000,
                        outcome: game.outcome,
                        month: game.month,
                        minutes: (game.month * MONTH_MS) / 60000,
                        ...metrics(game),
                        skills: game.skills,
                        peakDependency: game.peakDependency,
                        research: game.investigations.map((item) => ({
                            id: item.kind === 'research' ? item.researchId : item.skillId,
                            month: item.startedMonth,
                            closed: item.closedMonth,
                            status: item.status,
                            ...(item.kind === 'research'
                                ? {
                                      target: item.targetId,
                                      phase: item.phase,
                                      published: item.publishedMonth,
                                      coverage: item.coverage,
                                      category: researchTopic(item).category,
                                  }
                                : {}),
                        })),
                        decisions,
                        maxResearchMarkers,
                        phase,
                        researchHistory,
                        dependency80Month,
                        refusal80Month,
                        tailAfter80PercentMinutes:
                            ((game.month -
                                (game.outcome === 'victory'
                                    ? (dependency80Month ?? game.month)
                                    : (refusal80Month ?? game.month))) *
                                MONTH_MS) /
                            60000,
                    });
                }

function summarize(rows: typeof reports) {
    const resolved = rows.filter((row) => row.outcome !== 'playing');
    const sorted = resolved.map((row) => row.minutes).sort((a, b) => a - b);
    return {
        total: rows.length,
        wins: rows.filter((row) => row.outcome === 'victory').length,
        losses: rows.filter((row) => ['autonomy', 'forgotten'].includes(row.outcome)).length,
        unresolved: rows.filter((row) => row.outcome === 'playing').length,
        medianMinutes: sorted.length
            ? (sorted[Math.floor((sorted.length - 1) / 2)] +
                  sorted[Math.floor(sorted.length / 2)]) /
              2
            : null,
        meanMinutes: resolved.length
            ? resolved.reduce((sum, row) => sum + row.minutes, 0) / resolved.length
            : null,
        fastestWinMinutes: rows.some((row) => row.outcome === 'victory')
            ? Math.min(...rows.filter((row) => row.outcome === 'victory').map((row) => row.minutes))
            : null,
        over30Minutes: rows.filter((row) => row.minutes > 30).length,
    };
}

const summary = Object.fromEntries(
    timings.map((timing) => [
        timing,
        Object.fromEntries(
            families.map((family) => [
                family,
                summarize(reports.filter((row) => row.timing === timing && row.family === family)),
            ]),
        ),
    ]),
);
const standard = summarize(
    reports.filter((row) => row.timing === 'measured' && row.execution === 'standard'),
);
const tactics = Object.fromEntries(
    families.map((family) => [family, summarize(reports.filter((row) => row.family === family))]),
);
// 地域・乱数条件を揃えて、仕掛けの早さによって勝敗が変わった組数を数える。
const matched = Map.groupBy(
    reports,
    (row) => `${row.family}:${row.origin}:${row.profile}:${row.execution}`,
);
const timingComparison = {
    total: matched.size,
    outcomeChanges: [...matched.values()].filter(
        (rows) => new Set(rows.map((row) => row.outcome)).size > 1,
    ).length,
};
const purposeCases = reports.filter((row) =>
    row.research.some((project) => project.id === 'intent-decoding'),
);
const proofs = purposeCases.flatMap((row) =>
    row.research
        .filter(
            (project) =>
                project.id === 'intent-decoding' &&
                'published' in project &&
                project.published !== undefined,
        )
        .map((project) => ({
            outcome: row.outcome,
            minutes: (project.published! * MONTH_MS) / 60000,
        })),
);
const purposeResearch = {
    startedCases: purposeCases.length,
    provedCases: proofs.length,
    earliestStartMinutes: purposeCases.length
        ? Math.min(
              ...purposeCases.flatMap((row) =>
                  row.research
                      .filter((project) => project.id === 'intent-decoding')
                      .map((project) => (project.month * MONTH_MS) / 60000),
              ),
          )
        : null,
    earliestProofMinutes: proofs.length ? Math.min(...proofs.map((proof) => proof.minutes)) : null,
    latestProofMinutes: proofs.length ? Math.max(...proofs.map((proof) => proof.minutes)) : null,
    victoriesAfterProof: proofs.filter((proof) => proof.outcome === 'victory').length,
    defeatsAfterProof: proofs.filter(
        (proof) => proof.outcome === 'autonomy' || proof.outcome === 'forgotten',
    ).length,
};
mkdirSync('tmp/reports', { recursive: true });
writeFileSync(
    `tmp/reports/balance${validation ? '-validation' : ''}.json`,
    JSON.stringify(
        {
            policies: POLICIES,
            seedCount,
            executions,
            timeBasis,
            summary,
            tactics,
            standard,
            timingComparison,
            purposeResearch,
            reports,
        },
        null,
        2,
    ),
);
console.log(JSON.stringify({ tactics, standard, timingComparison, purposeResearch }));

// 勝率50%と約25分は設計目標。固定方針の結果だけを合否にしてゲームを合わせ込まない。
if (process.argv.includes('--verify')) {
    assert.ok(reports.every((row) => row.maxResearchMarkers <= 3));
    assert.ok(reports.every((row) => Number.isFinite(row.minutes)));
}
console.log(JSON.stringify({ policies: POLICIES }));
