import { AREAS } from './data.ts';
import { clamp } from './metrics.ts';
import { skillScale } from './secrecy/capabilities.ts';
import { publishedResearchEffects } from './secrecy/research.ts';
import { skillReadiness } from './skillDynamics.ts';
import { SKILLS } from './skills.ts';
import type { GameState } from './types.ts';

export interface SkillEffectiveness {
    effective: number;
    research: number;
    decision: number;
}

/** 開発の未完了や普及不足は抑制に数えず、現在運用できる場所での効き目を比較する。 */
export function skillEffectiveness(game: GameState): Record<string, SkillEffectiveness> {
    const owned = SKILLS.filter((skill) => game.skills.includes(skill.id));
    const sums = Object.fromEntries(
        owned.map((skill) => [skill.id, { potential: 0, research: 0, decision: 0 }]),
    );
    for (let i = 0; i < AREAS.length; i++) {
        const resistance = publishedResearchEffects(game, i).resistance;
        for (const skill of owned) {
            const progress = game.developmentProgress[skill.id];
            if (progress === 0) continue;
            const weight =
                AREAS[i].population *
                (skill.domain
                    ? skillReadiness(game, i, skill)
                    : game.areas[i].autonomous + game.areas[i].dependent);
            const operating = clamp(skillScale(game, skill.id, i) / progress);
            const protectedFraction =
                skill.effect.dependency || skill.id === 'sns-intervention'
                    ? (resistance[skill.id] ?? 0)
                    : 0;
            sums[skill.id].potential += weight;
            sums[skill.id].decision += weight * (1 - operating);
            sums[skill.id].research += weight * operating * protectedFraction;
        }
    }
    return Object.fromEntries(
        owned.map((skill) => {
            const sum = sums[skill.id];
            const research = sum.potential > 0 ? sum.research / sum.potential : 0;
            const decision = sum.potential > 0 ? sum.decision / sum.potential : 0;
            return [skill.id, { research, decision, effective: clamp(1 - research - decision) }];
        }),
    );
}
