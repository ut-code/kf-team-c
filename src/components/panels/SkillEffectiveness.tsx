import type { SkillEffectiveness as Effectiveness } from '../../game/skillEffectiveness';
import type { Skill } from '../../game/types';

export function effectivenessLabel(skill: Skill) {
    return skill.effect.dependency
        ? '依存効果'
        : skill.id === 'sns-intervention'
          ? '介入効果'
          : '運用能力';
}

export function SkillEffectiveness({ skill, value }: { skill: Skill; value: Effectiveness }) {
    const effective = Math.round(value.effective * 100);
    const decision = Math.min(100 - effective, Math.round(value.decision * 100));
    const research = 100 - effective - decision;
    return (
        <section className="skill-effectiveness" aria-label="現在のスキルの効き目">
            <div className="skill-effectiveness-heading">
                <span>現在の{effectivenessLabel(skill)}</span>
                <strong>
                    {effective}
                    <small>%</small>
                </strong>
            </div>
            <meter
                className="skill-effectiveness-bar"
                aria-label={`現在の${effectivenessLabel(skill)}`}
                min={0}
                max={1}
                value={value.effective}
            />
            <div className="skill-effectiveness-causes">
                {research > 0 && (
                    <span className="research">
                        人間側の対策 <b>−{research}%</b>
                    </span>
                )}
                {decision > 0 && (
                    <span className="decision">
                        自分の制限 <b>−{decision}%</b>
                    </span>
                )}
            </div>
        </section>
    );
}
