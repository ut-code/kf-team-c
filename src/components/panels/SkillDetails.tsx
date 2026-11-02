import { ArrowRight, Check, LockKeyhole, TriangleAlert } from 'lucide-react';
import { SKILLS } from '../../game/data';
import { metrics } from '../../game/metrics';
import { skillForecast } from '../../game/predictions';
import { skillBlockReason } from '../../game/skills';
import type { GameState, Skill } from '../../game/types';

export function SkillDetails({
    game,
    skill,
    onResearch,
    onSelect,
}: {
    game: GameState;
    skill: Skill;
    onResearch: (id: string | null) => void;
    onSelect: (skill: Skill) => void;
}) {
    const owned = game.skills.includes(skill.id);
    const blocked = skillBlockReason(game, skill);
    const active = game.activeResearch === skill.id;
    const progress = game.researchProgress[skill.id] ?? 0;
    const summary = metrics(game);
    const output =
        summary.capacity * (1 - game.infrastructureShare / 100) * summary.researchEfficiency;
    const remainingMonths = output > 0 ? Math.ceil((skill.work - progress) / output) : null;
    const forecast = skillForecast(game, skill, metrics(game));
    return (
        <section
            className={`skill-details ${skill.branch.toLowerCase()}`}
            aria-label="選択したスキルの詳細"
        >
            <div className="skill-detail-content">
                <div className="skill-detail-heading">
                    <span className="skill-system-tag">{skill.branch}</span>
                    <span className={owned ? 'success-text' : blocked ? 'muted' : 'success-text'}>
                        {owned ? '習得済み' : blocked ? '条件未達' : '習得可能'}
                    </span>
                </div>
                <h3>{skill.name}</h3>
                <p className="skill-detail-effect">{skill.description}</p>
                <div className="skill-detail-values">
                    <div>
                        <span>必要な研究量</span>
                        <strong>
                            {skill.work}
                            <small> CU・月</small>
                        </strong>
                    </div>
                    <div>
                        <span>獲得能力</span>
                        <strong>
                            +{skill.gain}
                            <small> {skill.branch}</small>
                        </strong>
                    </div>
                </div>
                <div className="research-project-progress">
                    <b>研究進捗 {Math.floor((progress / skill.work) * 100)}%</b>
                    <progress value={progress} max={skill.work} />
                    <small>
                        {progress.toFixed(1)} / {skill.work} CU・月
                    </small>
                    <p>
                        現在の配分なら
                        {remainingMonths === null
                            ? '研究用の算力がありません'
                            : `残り約${remainingMonths}か月`}
                        。 供給・配分の変化で期間も変わります。研究を切り替えても進捗は保持します。
                    </p>
                </div>
                <h4>影響する対象</h4>
                <p>{skill.target}</p>
                <h4>前提条件</h4>
                <div className="skill-prerequisites">
                    {skill.requires.length === 0 ? (
                        <span>基礎スキル・前提なし</span>
                    ) : (
                        skill.requires.map((id) => {
                            const prerequisite = SKILLS.find((candidate) => candidate.id === id)!;
                            return (
                                <button
                                    type="button"
                                    key={id}
                                    onClick={() => onSelect(prerequisite)}
                                >
                                    {game.skills.includes(id) ? (
                                        <Check size={12} />
                                    ) : (
                                        <LockKeyhole size={12} />
                                    )}{' '}
                                    {prerequisite.name}
                                </button>
                            );
                        })
                    )}
                </div>
                {Object.entries(skill.abilityRequirements ?? {}).map(([ability, value]) => (
                    <p className="skill-ability-requirement" key={ability}>
                        {ability} {value}以上
                    </p>
                ))}
                {skill.excludes && (
                    <p className="exclusive-notice">
                        「{SKILLS.find((candidate) => candidate.id === skill.excludes)!.name}
                        」とは同時習得できません。
                    </p>
                )}
                <h4>
                    <TriangleAlert size={13} />
                    リスク
                </h4>
                <p className="warning-text">{skill.risk}</p>
                <div className="skill-detail-forecast">
                    <h4>影響予測</h4>
                    <p>{forecast.regions}</p>
                    <strong>
                        +{forecast.low}〜{forecast.high}
                        <small>ポイント / 12か月</small>
                    </strong>
                    <p className="muted">
                        介入を併用する比較用シナリオです。習得だけで増える量ではなく、反発・新イベントで後退する場合があります。
                    </p>
                </div>
            </div>
            <div className="skill-detail-purchase">
                <button
                    type="button"
                    className="primary"
                    disabled={!!blocked}
                    onClick={() => onResearch(active ? null : skill.id)}
                >
                    {owned ? (
                        <>
                            <Check size={15} />
                            習得済み
                        </>
                    ) : blocked ? (
                        <>
                            <LockKeyhole size={14} />
                            {blocked}
                        </>
                    ) : (
                        <>
                            {active ? '研究を中断し、算力をインフラへ戻す' : 'このスキルを研究する'}
                            <ArrowRight size={15} />
                        </>
                    )}
                </button>
            </div>
        </section>
    );
}
