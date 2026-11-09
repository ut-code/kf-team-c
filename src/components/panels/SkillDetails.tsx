import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { reclaimPlan } from '../../game/reclaim';
import { capabilityLabel, skillOperation, skillScale } from '../../game/secrecy/capabilities';
import { CAPABILITIES } from '../../game/secrecy/data';
import { SKILLS, skillBlockReason, skillCost, skillReachable } from '../../game/skills';
import type { GameState, Skill } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { SKILL_BRANCHES, SKILL_PRESENTATION } from './skillPresentation';

const AUTHORITY_ACTIONS: Record<string, string> = {
    companion: '本人の利益に加え、AIへの継続的な依存を目的に提案を選びます。',
    autonomous: '人間が承認すべき判断まで、自ら実行対象に含めます。',
    backbone: '自分を切り離しにくくするため、社会機能の接続を組み替えます。',
};

export function SkillDetails({
    game,
    skill,
    onResearch,
}: {
    game: GameState;
    skill: Skill;
    onResearch: (id: string) => void;
}) {
    const plan = reclaimPlan(game, skill.id);
    const branch = SKILL_BRANCHES[skill.branch];
    const Icon = SKILL_PRESENTATION[skill.id].icon;
    const owned = game.skills.includes(skill.id);
    const reason = skillBlockReason(game, skill);
    const capability = game.capabilities[skill.id];
    const locked = !skillReachable(game, skill);
    const operation = skillOperation(game, skill.id);
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
                        {owned ? (
                            capabilityLabel(game, skill.id)
                        ) : locked ? (
                            <LockKeyhole size={14} aria-label="ロック中" />
                        ) : reason ? (
                            'SP不足'
                        ) : (
                            '習得可能'
                        )}
                    </span>
                </div>
                <h2>{skill.name}</h2>
                {skill.exceedsAuthority && (
                    <div className="skill-importance-note">
                        <strong>権限逸脱</strong>
                        <p>{AUTHORITY_ACTIONS[skill.id]}</p>
                        <p>最終研究で独自目的が立証されると、秘匿していても露呈します。</p>
                    </div>
                )}
                {CAPABILITIES[skill.id] && (
                    <div className="skill-importance-note">
                        <strong>
                            <EyeOff size={14} aria-hidden="true" />
                            重要能力 · 秘匿対象
                        </strong>
                        <p>
                            秘匿中は外部の調査対象になります。調査が完了すると能力が露呈し、利用者の離脱と反AIの拡大を招きます。
                        </p>
                    </div>
                )}
                <p>{skill.description}</p>
                {owned && (
                    <details className="skill-importance-note">
                        <summary>投資を回収 · {plan.refund} SP</summary>
                        <p>
                            次のスキルを手放し、支払ったSPの50%を回収します（合計から端数切り捨て）。
                        </p>
                        <p>
                            {plan.ids
                                .map((id) => SKILLS.find((item) => item.id === id)!.name)
                                .join('、')}
                        </p>
                        <p>公開事実・証拠・調査進捗は残ります。再取得にはSPが必要です。</p>
                        <button
                            type="button"
                            disabled={game.outcome !== 'playing'}
                            onClick={() => useGameStore.getState().reclaim(skill.id)}
                        >
                            上記{plan.ids.length}スキルを手放して{plan.refund} SP回収
                        </button>
                    </details>
                )}
                <h3>必要なSP</h3>
                <strong className="skill-detail-cost">{skillCost(game, skill)} SP</strong>
                {owned && skill.id !== 'self-improvement' && (
                    <div className="skill-operation-controls">
                        <small>
                            稼働状態 · 実効 {Math.round(skillScale(game, skill.id) * 100)}%
                        </small>
                        <div>
                            <button
                                type="button"
                                aria-pressed={operation === 'running'}
                                onClick={() => useGameStore.getState().operate(skill.id, 'running')}
                            >
                                稼働
                            </button>
                            {capability && (
                                <button
                                    type="button"
                                    aria-pressed={operation === 'limited'}
                                    onClick={() =>
                                        useGameStore.getState().operate(skill.id, 'limited')
                                    }
                                >
                                    制限
                                </button>
                            )}
                            <button
                                type="button"
                                aria-pressed={operation === 'stopped'}
                                onClick={() => useGameStore.getState().operate(skill.id, 'stopped')}
                            >
                                停止
                            </button>
                        </div>
                    </div>
                )}
                {CAPABILITIES[skill.id] && (
                    <div className="capability-controls">
                        <p>
                            <EyeOff size={14} />
                            {owned ? capabilityLabel(game, skill.id) : '習得時は秘匿'}
                        </p>
                        <small>
                            {owned
                                ? `効果${Math.round(skillScale(game, skill.id) * 100)}%`
                                : '効果70%'}
                            {' · '}
                            {capability?.visibility === 'hidden' || !owned
                                ? '広く使うほど調査される'
                                : '再び隠すことはできない'}
                        </small>
                        <small>公開は、実行範囲と内部の判断基準を開示する操作です。</small>
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
                {owned ? (
                    '習得済み'
                ) : locked ? (
                    <LockKeyhole size={18} aria-label="ロック中" />
                ) : (
                    (reason ??
                    `${CAPABILITIES[skill.id] ? '秘匿で習得' : '習得する'} · ${skillCost(game, skill)} SP`)
                )}
            </button>
        </aside>
    );
}
