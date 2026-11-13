import type { ResearchEffects } from '../content/research.ts';
import { AREAS } from './data.ts';
import { clamp, metrics } from './metrics.ts';
import { INTENT_REFUSAL_PRESSURE, intentReaction, skillScale } from './secrecy/capabilities.ts';
import { deployedDependency } from './skillDynamics.ts';
import { SKILLS } from './skills.ts';
import type { GameState, SkillEffect } from './types.ts';

/** 人口移動と表示が同じ計算を使い、対策による抑制を能力値と区別する。 */
export function dependencyDynamics(
    game: GameState,
    index: number,
    effect: Required<SkillEffect>,
    research: ResearchEffects,
) {
    const area = game.areas[index];
    const definition = AREAS[index];
    const use = area.autonomous + area.dependent;
    const deployed = deployedDependency(game, index);
    const protectedDeployment = deployedDependency(game, index, research.resistance);
    const potential = deployed.work + deployed.personal + deployed.learning;
    const effective =
        protectedDeployment.work + protectedDeployment.personal + protectedDeployment.learning;
    const prematureDelegation = Math.max(0, effect.dependency - potential);
    const independentChoice = (0.006 * (potential - effective)) / (1 + potential);
    // 信頼は合意のある委任を支える。強制的な介入や人間側の対策には効かない。
    const acceptance = clamp((area.favorability - 0.55) / 0.35);
    const delegation =
        protectedDeployment.work * (0.85 + 0.3 * clamp(effect.compliance / 1.2)) +
        protectedDeployment.personal +
        protectedDeployment.learning +
        protectedDeployment.consensual * acceptance * 0.35;
    const incidentalDelegation =
        use *
        clamp(0.05 + effect.quality * 0.3 + effect.enterprise * 0.2 + effect.education * 0.1) *
        0.12;
    const independence = 1 / (1 + definition.education * 0.8 + definition.regulation * 0.6);
    const converted =
        area.autonomous *
        (1 -
            Math.exp(
                -(delegation + incidentalDelegation) *
                    0.03 *
                    independence *
                    (1 - area.antiAI * 0.6) *
                    (1 - research.oversight),
            ));
    const independentSociety = 1 - metrics(game).dependent;
    // 外部に人間の運用体制が残るほど、利用拒否の広がった地域で代替と回復を支援できる。
    const recoveryDemand =
        (1 + area.antiAI * independentSociety ** 2 * 512) *
        clamp(0.15 + area.dependent * 0.35 + area.antiAI * 0.5 + (1 - area.favorability) * 0.3);
    const reassurance = clamp(
        effect.quality * 0.2 +
            effect.education * definition.education * 0.2 +
            effect.compliance * (0.25 + definition.regulation * 0.25) +
            effect.discretion * 0.5,
    );
    const socialSupport = 1 - clamp((area.dependent - 0.85) / 0.13) * area.dependent;
    const resilience = SKILLS.reduce(
        (sum, skill) =>
            sum +
            (skill.effect.resilience ?? 0) *
                skillScale(game, skill.id) *
                (1 - (research.resistance[skill.id] ?? 0)),
        0,
    );
    const pressure =
        research.pressure + research.intent * INTENT_REFUSAL_PRESSURE * intentReaction(game);
    const recoveryRate =
        // 回復支援の導入率には運用能力を織り込み済み。現地の高依存で二重に抑えない。
        ((0.0008 + pressure * 0.4 + area.antiAI * reassurance * 0.006) * socialSupport +
            (research.recovery + research.alternatives) * recoveryDemand * independentSociety) /
        (1 + resilience);
    const restored = area.dependent * (1 - Math.exp(-recoveryRate));
    return {
        potential,
        effective,
        prematureDelegation,
        independentChoice,
        delegation,
        incidentalDelegation,
        converted,
        restored,
        recoveryDemand,
        reassurance,
    };
}
