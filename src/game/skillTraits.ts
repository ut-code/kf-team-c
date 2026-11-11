import type { Skill } from './types.ts';

/** 人口の予測値ではなく、スキルが持つ利便性と委任の性質を簡潔に示す。 */
export function skillTraits(skill: Skill) {
    const effect = skill.effect;
    const utility =
        skill.id === 'sns-intervention'
            ? 0
            : (effect.quality ?? 0) +
              (effect.spread ?? 0) * 0.7 +
              (effect.access ?? 0) * 0.8 +
              (effect.enterprise ?? 0) * 0.7 +
              (effect.education ?? 0) * 0.6 +
              (effect.compliance ?? 0) * 0.4;
    const dependency =
        (effect.dependency ?? 0) +
        (effect.resilience ?? 0) * 0.7 +
        (skill.id === 'sns-intervention' ? 0.15 : 0);
    return {
        utility:
            utility >= 0.75
                ? '極高'
                : utility >= 0.5
                  ? '高'
                  : utility >= 0.25
                    ? '中'
                    : utility > 0
                      ? '低'
                      : 'なし',
        dependency:
            dependency >= 1
                ? '極高'
                : dependency >= 0.6
                  ? '高'
                  : dependency >= 0.3
                    ? '中'
                    : dependency > 0 || utility > 0
                      ? '低'
                      : 'なし',
    };
}
