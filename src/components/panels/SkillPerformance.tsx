import { Brain, Clock3, Radio, Shield, Sparkles } from 'lucide-react';
import { aiPerformance } from '../../game/aiPerformance';
import { skillEffectiveness } from '../../game/skillEffectiveness';
import { SKILLS } from '../../game/skills';
import type { GameState } from '../../game/types';
import { HumanResponse } from '../HumanResponse';
import { SKILL_PRESENTATION } from './skillPresentation';

const icons = { utility: Sparkles, reach: Radio, dependency: Brain, retention: Shield };

export function SkillPerformance({
    game,
    onSelectSkill,
}: {
    game: GameState;
    onSelectSkill: (id: string) => void;
}) {
    const owned = SKILLS.filter((skill) => game.skills.includes(skill.id));
    const developing = owned.filter((skill) => game.developmentProgress[skill.id] < 1).length;
    const effectiveness = skillEffectiveness(game);
    return (
        <div className="skill-performance-view">
            <section className="performance-overview" aria-labelledby="performance-overview">
                <h2 id="performance-overview">総合性能</h2>
                <div className="performance-metrics">
                    {aiPerformance(game).map((metric) => {
                        const Icon = icons[metric.id as keyof typeof icons];
                        return (
                            <label
                                key={metric.id}
                                className="performance-metric"
                                data-ability={metric.id}
                            >
                                <span className="performance-metric-heading">
                                    <span className="performance-metric-name">
                                        <Icon size={20} aria-hidden="true" />
                                        {metric.label}
                                    </span>
                                    <span className="performance-metric-value">
                                        {Math.round(metric.ratio * 100)}
                                        <small>/ 100</small>
                                    </span>
                                </span>
                                <meter min={0} max={1} value={metric.ratio} />
                            </label>
                        );
                    })}
                </div>
            </section>
            <HumanResponse game={game} />
            <section className="performance-skills" aria-labelledby="performance-skills">
                <div className="performance-skills-heading">
                    <h2 id="performance-skills">
                        獲得スキル <span>{owned.length}</span>
                    </h2>
                    {developing > 0 && (
                        <small>
                            <Clock3 size={13} aria-hidden="true" />
                            開発中 {developing}
                        </small>
                    )}
                </div>
                <div className="performance-skill-list">
                    {owned.map((skill) => {
                        const Icon = SKILL_PRESENTATION[skill.id].icon;
                        const progress = game.developmentProgress[skill.id];
                        return (
                            <button
                                key={skill.id}
                                type="button"
                                className={`performance-skill ${skill.branch.toLowerCase()}`}
                                onClick={() => onSelectSkill(skill.id)}
                                title={skill.description}
                            >
                                <Icon
                                    className="performance-skill-icon"
                                    size={22}
                                    aria-hidden="true"
                                />
                                <span className="performance-skill-info">
                                    <strong>{skill.name}</strong>
                                    <span>
                                        <small>{skill.branch}</small>
                                        {progress < 1 && (
                                            <small className="performance-skill-progress">
                                                開発中 {Math.floor(progress * 100)}%
                                            </small>
                                        )}
                                        {effectiveness[skill.id].effective < 0.995 && (
                                            <small className="performance-skill-suppression">
                                                抑制{' '}
                                                {100 -
                                                    Math.round(
                                                        effectiveness[skill.id].effective * 100,
                                                    )}
                                                %
                                            </small>
                                        )}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                {owned.length === 0 && <p className="performance-skills-empty">スキル未獲得</p>}
            </section>
        </div>
    );
}
