import { Eye, EyeOff } from 'lucide-react';
import { capabilityLabel } from '../../game/secrecy/capabilities';
import { CAPABILITIES } from '../../game/secrecy/data';
import { skillBlockReason } from '../../game/skills';
import type { GameState, Skill } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
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
    const branch = SKILL_BRANCHES[skill.branch];
    const Icon = SKILL_PRESENTATION[skill.id].icon;
    const owned = game.skills.includes(skill.id);
    const reason = skillBlockReason(game, skill);
    const capability = game.capabilities[skill.id];
    return (
        <aside
            className={`skill-details ${skill.branch.toLowerCase()}`}
            aria-label="選択したスキルの詳細"
        >
            <div>
                <Icon className="skill-detail-icon" size={30} aria-hidden="true" />
                <div className="skill-detail-heading">
                    <span>
                        {skill.branch} · {branch.label}
                    </span>
                    <span>
                        {owned ? capabilityLabel(game, skill.id) : reason ? '条件未達' : '習得可能'}
                    </span>
                </div>
                <h2>{skill.name}</h2>
                <p>{skill.description}</p>
                <h3>必要なSP</h3>
                <strong className="skill-detail-cost">{skill.cost} SP</strong>
                {CAPABILITIES[skill.id] && (
                    <div className="capability-controls">
                        <p>
                            <EyeOff size={14} />
                            {owned ? capabilityLabel(game, skill.id) : '習得時は秘匿'}
                        </p>
                        <small>
                            {capability?.limited
                                ? '効果20% · 公開すると制限を解除'
                                : capability?.visibility === 'hidden' || !owned
                                  ? '効果70% · 広く使うほど調査される'
                                  : '効果100% · 再び隠すことはできない'}
                        </small>
                        {capability?.visibility === 'hidden' && (
                            <button
                                type="button"
                                onClick={() => useGameStore.getState().disclose(skill.id)}
                            >
                                <Eye size={15} /> 公開する <small>効果↑ · 反発↑</small>
                            </button>
                        )}
                    </div>
                )}
            </div>
            <button
                type="button"
                className="primary"
                disabled={reason !== null}
                onClick={() => onResearch(skill.id)}
            >
                {owned
                    ? '習得済み'
                    : (reason ??
                      `${CAPABILITIES[skill.id] ? '秘匿で習得' : '習得する'} · ${skill.cost} SP`)}
            </button>
        </aside>
    );
}
