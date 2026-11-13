import { LockKeyhole, TriangleAlert } from 'lucide-react';
import { capabilityLabel, skillScale } from '../../game/secrecy/capabilities';
import { skillSuppression } from '../../game/secrecy/researchImpact';
import { SKILLS, skillBlockReason, skillCost, skillReachable } from '../../game/skills';
import { skillTraits } from '../../game/skillTraits';
import type { GameState, Skill } from '../../game/types';
import { SKILL_BRANCHES, SKILL_PRESENTATION } from './skillPresentation';

const SKILL_NAMES = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill.name]));

export function SkillDetails({
    game,
    skill,
    onResearch,
}: {
    game: GameState;
    skill: Skill;
    onResearch: (id: string) => void;
}) {
    const owned = game.skills.includes(skill.id);
    const locked = !skillReachable(game, skill);
    const reason = skillBlockReason(game, skill);
    const traits = skillTraits(skill);
    const suppression = owned ? skillSuppression(game, [skill]) : 0;
    const Icon = SKILL_PRESENTATION[skill.id].icon;
    return (
        <aside
            className={`skill-details ${skill.branch.toLowerCase()}`}
            aria-label="選択したスキルの詳細"
        >
            <div>
                <Icon className="skill-detail-icon" size={30} aria-hidden="true" />
                <div className="skill-detail-heading">
                    <span>{SKILL_BRANCHES[skill.branch].label}</span>
                    <span>
                        {owned ? capabilityLabel(game, skill.id) : locked ? '未解放' : '開発可能'}
                    </span>
                </div>
                <h2>{skill.name}</h2>
                <div className="skill-traits">
                    <span title="用途を増やし、利用の手間を減らす力">
                        利便性 <strong>{traits.utility}</strong>
                    </span>
                    <span title="判断・記憶・仕事をAIへ委ね、離れにくくする力">
                        依存性 <strong>{traits.dependency}</strong>
                    </span>
                    <span title="継続利用によって信頼を育てる効果。暴露による低下は別に発生します。">
                        信頼度 <strong>{traits.trust}</strong>
                    </span>
                    {skill.exceedsAuthority && (
                        <span className="harmful-trait">
                            <TriangleAlert size={13} />
                            有害な介入
                        </span>
                    )}
                </div>
                <p>{skill.description}</p>
                {suppression >= 0.01 && (
                    <p className="skill-countermeasure">
                        人間側の対策で効果を{Math.round(suppression * 100)}%抑制
                    </p>
                )}
                {skill.exceedsAuthority && (
                    <div className="skill-importance-note">
                        <p>介入の証拠が蓄積し、暴露されると信頼が大きく低下します。</p>
                    </div>
                )}
                {skill.restrains && (
                    <dl className="skill-restraints">
                        {Object.entries(skill.restrains).map(([id, restraint]) => (
                            <div key={id}>
                                <dt>{SKILL_NAMES[id]}</dt>
                                <dd>{Math.round(restraint * 100)}%抑制</dd>
                            </div>
                        ))}
                    </dl>
                )}
                <div className="skill-detail-cost">
                    <span>コスト</span>
                    <strong>
                        {skillCost(game, skill)}
                        <small>SP</small>
                    </strong>
                </div>
                <p>
                    {skill.developmentMonths === 0
                        ? '即時に開発が完了します。'
                        : `開発期間 ${skill.developmentMonths}か月`}
                </p>
                {owned && (
                    <>
                        {game.developmentProgress[skill.id] < 1 && (
                            <progress
                                aria-label="スキルの開発進捗"
                                value={game.developmentProgress[skill.id]}
                                max={1}
                            />
                        )}
                        <p>
                            {capabilityLabel(game, skill.id)}
                            {skillScale(game, skill.id) < game.developmentProgress[skill.id] &&
                                ' · 制約技術で挙動を抑制中'}
                        </p>
                    </>
                )}
            </div>
            <button
                type="button"
                className="primary"
                disabled={reason !== null}
                onClick={() => onResearch(skill.id)}
            >
                {owned ? (
                    capabilityLabel(game, skill.id)
                ) : locked ? (
                    <>
                        <LockKeyhole className="skill-detail-lock" size={16} aria-hidden="true" />
                        <span>{reason}</span>
                    </>
                ) : (
                    (reason ?? `開発する · ${skillCost(game, skill)} SP`)
                )}
            </button>
        </aside>
    );
}
