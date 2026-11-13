import { Search, X } from 'lucide-react';
import { controlResearchOversight } from '../../game/control';
import { AREAS } from '../../game/data';
import { CAPABILITIES } from '../../game/secrecy/data';
import { instituteArea, instituteFor, investigationRate } from '../../game/secrecy/investigations';
import { researchTopic } from '../../game/secrecy/research';
import { researchImpact } from '../../game/secrecy/researchImpact';
import {
    researchHasFindings,
    researchPhaseLabel,
    researchTarget,
} from '../../game/secrecy/researchTargets';
import { SKILLS } from '../../game/skills';
import type { GameState } from '../../game/types';
import { Modal } from '../widgets';
import { InvestigationResponses } from './InvestigationResponses';
import { ResearchProgress } from './ResearchProgress';
import { researchEffectLabels, researchPresentation } from './researchPresentation';

export function InvestigationPanel({
    game,
    id,
    onClose,
    onOpenSkill,
}: {
    game: GameState;
    id: string;
    onClose: () => void;
    onOpenSkill: (id?: string) => void;
}) {
    const project = game.investigations.find((item) => item.id === id);
    if (!project) return null;
    const scientific = project.kind === 'research' ? project : null;
    const topic = scientific ? researchTopic(scientific) : null;
    const regulation = topic?.category === 'regulation';
    const presentation = scientific
        ? researchPresentation(scientific)
        : { Icon: Search, label: '能力の調査', color: 'var(--warning)' };
    const Icon = presentation.Icon;
    const institute = instituteFor(project);
    const organization = regulation
        ? `${AREAS[instituteArea(project)].name}の規制当局`
        : institute.name;
    const name =
        project.kind === 'research'
            ? researchTopic(project).name
            : SKILLS.find((skill) => skill.id === project.skillId)!.name;
    const active = project.status === 'active';
    const findings = scientific ? researchHasFindings(scientific) : !active;
    const impact = scientific ? researchImpact(game, scientific) : null;
    const effects = scientific
        ? researchEffectLabels(scientific)
        : ['権限を超えた介入が明らかになり、利用拒否が広がる'];
    return (
        <Modal modal={false} label={name} onClose={onClose} mapLocation={institute}>
            <div className="investigation-panel">
                <div className="society-heading">
                    <div className="contact-heading">
                        <Icon size={28} style={{ color: presentation.color }} />
                        <div>
                            <span className="eyebrow">{presentation.label}</span>
                            <h2>{organization}</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="閉じる"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>
                <h2 className="investigation-title">{name}</h2>
                <p className="investigation-question">
                    {project.kind === 'research'
                        ? researchTopic(project).question
                        : CAPABILITIES[project.skillId].question}
                </p>
                {scientific && (
                    <p className="investigation-target">対象：{researchTarget(scientific).name}</p>
                )}
                <div className="investigation-progress">
                    <span>
                        {scientific
                            ? researchPhaseLabel(scientific)
                            : active
                              ? '調査中'
                              : '調査結果を公表済み'}
                    </span>
                    {active && !findings && (
                        <>
                            <small>
                                {regulation ? '成立まで' : '公表まで'}
                                {investigationRate(game, project) === 0 ? '・進行停止中' : ''}
                            </small>
                            <ResearchProgress
                                id="investigation-progress"
                                project={project}
                                label={regulation ? '法案成立までの全体進捗' : '公表までの全体進捗'}
                            />
                        </>
                    )}
                </div>
                <InvestigationResponses game={game} project={project} onClose={onClose} />
                <section
                    className="research-impact investigation-findings"
                    aria-label="研究による効果"
                >
                    <h3>
                        {findings
                            ? regulation
                                ? '成立後の効果'
                                : '公表後の効果'
                            : regulation
                              ? '成立すると'
                              : '公表されると'}
                    </h3>
                    <ul className="research-effects">
                        {effects.map((effect) => (
                            <li key={effect}>
                                <Icon
                                    size={16}
                                    style={{ color: presentation.color }}
                                    aria-hidden="true"
                                />
                                <span>{effect}</span>
                            </li>
                        ))}
                    </ul>
                    {impact &&
                        scientific &&
                        ((controlResearchOversight(topic!.id) > 0 &&
                            topic!.id !== 'managed-deployment') ||
                            impact.strength > 0 ||
                            topic!.effects.recovery ||
                            topic!.effects.alternatives) && (
                            <>
                                {findings ? (
                                    <p className="research-application">
                                        {regulation ? '現在の施行率' : '現在の適用率'}{' '}
                                        <strong>{Math.round(impact.coverage * 100)}%</strong>
                                        <small>人口で重み付けした世界平均</small>
                                    </p>
                                ) : (
                                    <p className="investigation-warning">
                                        {regulation ? '成立後' : '公表後'}
                                        、導入された地域から効果が現れます。
                                    </p>
                                )}
                                <div className="research-target-skills">
                                    {impact.skills.map((skill) => (
                                        <button
                                            type="button"
                                            key={skill.id}
                                            onClick={() => onOpenSkill(skill.id)}
                                        >
                                            {skill.name}
                                        </button>
                                    ))}
                                </div>
                                {impact.targeted && impact.skills.length === 0 && (
                                    <p className="investigation-warning">
                                        対象となるスキルは未取得です。
                                    </p>
                                )}
                            </>
                        )}
                </section>
            </div>
        </Modal>
    );
}
