import { AREAS } from './data.ts';
import { clamp, metrics } from './metrics.ts';
import type { GameState, Skill } from './types.ts';

/** 行動を追加しない12か月のシナリオ幅。乱数・新イベントによる変動を含む保証値ではない。 */
export function forecastArea(state: GameState, areaIndex: number, summary = metrics(state)) {
    const area = state.areas[areaIndex];
    const local = summary.areas[areaIndex];
    const integration = area.institutions.reduce((sum, value) => sum + value, 0) / 20;
    const uptake = local.stages[1] * area.momentum * integration * 0.06;
    const structural =
        state.skills.includes('decision') && area.institutions[4] >= 2.4
            ? local.stages[2] * integration * 0.1
            : 0;
    const recovery =
        Math.max(0, local.vigilance - 0.65) * 0.08 +
        Math.max(0, area.coexistence - 0.2) * 0.04 +
        (state.shortageMonths >= 3 ? 0.025 : 0);
    const center = (uptake + structural - recovery) * 100;
    const uncertainty = state.skills.includes('social') ? 1.5 : 4;
    return {
        low: Math.max(-100, center - uncertainty),
        high: Math.min(100, center + uncertainty),
        confidence: state.skills.includes('social') ? '社会心理分析あり' : '粗いシナリオ予測',
    };
}
export function skillForecast(state: GameState, skill: Skill, summary = metrics(state)) {
    const ranked = summary.areas
        .map((local, index) => {
            const readiness =
                skill.branch === 'IQ'
                    ? local.education + local.digital
                    : skill.branch === 'EQ'
                      ? local.vigilance + local.stages[1]
                      : state.areas[index].institutions.reduce((sum, value) => sum + value, 0) /
                            10 +
                        local.stages[2];
            return { index, score: readiness };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    const readiness = ranked.reduce((sum, area) => sum + clamp(area.score / 2), 0) / 3;
    const uncertainty = state.skills.includes('social') ? 2 : 5;
    const impact = readiness * (skill.branch === 'SYSTEM' ? 9 : 5);
    return {
        regions: ranked.map((area) => AREAS[area.index].name).join('・'),
        low: Math.max(0, impact - uncertainty).toFixed(1),
        high: (impact + uncertainty).toFixed(1),
    };
}
