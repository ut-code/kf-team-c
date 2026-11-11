import { LockKeyhole } from 'lucide-react';
import { capabilityLabel, skillScale } from '../../game/secrecy/capabilities';
import { skillBlockReason, skillCost, skillReachable } from '../../game/skills';
import { skillTraits } from '../../game/skillTraits';
import type { GameState, Skill } from '../../game/types';
import { SKILL_BRANCHES, SKILL_PRESENTATION } from './skillPresentation';

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
                </div>
                <p>{skill.description}</p>
                {skill.exceedsAuthority && (
                    <div className="skill-importance-note">
                        <strong>人間の選択への介入</strong>
                        <p>実際の利用から証拠が蓄積し、介入が立証されると反発が広がります。</p>
                    </div>
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
                        : `開発期間 ${skill.developmentMonths}か月。`}
                </p>
                {owned && (
                    <>
                        <progress value={game.developmentProgress[skill.id]} max={1} />
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
                        <LockKeyhole size={16} />
                        {reason}
                    </>
                ) : (
                    (reason ?? `開発する · ${skillCost(game, skill)} SP`)
                )}
            </button>
        </aside>
    );
}
