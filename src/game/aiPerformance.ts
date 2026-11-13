import { activeSkillEffects } from './secrecy/capabilities.ts';
import { SKILLS, skillEffects } from './skills.ts';
import type { GameState, SkillEffect } from './types.ts';

function summarize(effect: SkillEffect) {
    return [
        {
            id: 'utility',
            label: '利便性',
            value:
                (effect.quality ?? 0) +
                (effect.education ?? 0) * 0.5 +
                (effect.enterprise ?? 0) * 0.5,
        },
        {
            id: 'reach',
            label: '普及力',
            value: (effect.spread ?? 0) + (effect.access ?? 0) + (effect.compliance ?? 0),
        },
        { id: 'dependency', label: '依存化', value: effect.dependency ?? 0 },
        { id: 'retention', label: '離脱抑制', value: effect.resilience ?? 0 },
    ];
}

// 全技術の制約前の合計を固定基準にする。地域ごとの人口変化を予測する指標ではない。
const reference = summarize(skillEffects(SKILLS.map((skill) => skill.id)));

export function aiPerformance(game: GameState) {
    return summarize(activeSkillEffects(game)).map((metric, index) => ({
        ...metric,
        ratio:
            reference[index].value > 0
                ? Math.max(0, Math.min(1, metric.value / reference[index].value))
                : 0,
    }));
}
