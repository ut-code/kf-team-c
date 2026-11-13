import { Check, ShieldCheck, X } from 'lucide-react';
import { useMemo } from 'react';
import { humanControl, isControlResearch } from '../game/control';
import { humanResponse } from '../game/humanResponse';
import { researchTopic } from '../game/secrecy/research';
import {
    researchHasFindings,
    researchPhaseLabel,
    researchTarget,
} from '../game/secrecy/researchTargets';
import type { GameState } from '../game/types';
import { useContinuousValue, useProjectedGame } from './ContinuousProgress';
import { ResearchProgress } from './society/ResearchProgress';
import { researchPresentation } from './society/researchPresentation';
import { Modal } from './widgets';

const pointChange = new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
});

export function HumanResponse({ game, area }: { game: GameState; area?: number }) {
    const response = useMemo(() => humanResponse(game, area), [game, area]);
    const nextGame = useProjectedGame();
    const nextResponse = useMemo(() => humanResponse(nextGame, area), [nextGame, area]);
    const protection = useContinuousValue(response.protection, nextResponse.protection);
    return (
        <section className="human-response" aria-label="人間による制御">
            <div className="response-heading">
                <h3>{area === undefined ? '世界の依存対策' : '地域の依存対策'}</h3>
                <strong>
                    {Math.floor(protection * 100)}
                    <small>%</small>
                </strong>
            </div>
            <meter aria-label="対策の適用度" min={0} max={1} value={protection} />
            <p className="response-caption">対策の適用度</p>
            <dl className="response-values">
                <div>
                    <dt>依存化の抑制</dt>
                    <dd>{Math.round(response.suppression * 100)}%</dd>
                </div>
                <div>
                    <dt>判断の委任</dt>
                    <dd>
                        {pointChange.format(response.converted * 100)}
                        <small>pt / 月</small>
                    </dd>
                </div>
                <div>
                    <dt>自律利用への回復</dt>
                    <dd>
                        {pointChange.format(-response.restored * 100)}
                        <small>pt / 月</small>
                    </dd>
                </div>
            </dl>
            {area !== undefined && (
                <div className="regional-countermeasures">
                    {game.investigations
                        .flatMap((project) =>
                            project.kind === 'research' &&
                            researchHasFindings(project) &&
                            project.coverage[area] >= 0.1 &&
                            researchTopic(project).id !== 'safety-validation' &&
                            researchTopic(project).id !== 'control-observation'
                                ? [
                                      {
                                          name: researchTopic(project).name,
                                          coverage: project.coverage[area],
                                      },
                                  ]
                                : [],
                        )
                        .sort((a, b) => b.coverage - a.coverage)
                        .filter(
                            (item, index, list) =>
                                list.findIndex((other) => other.name === item.name) === index,
                        )
                        .map((item) => (
                            <span key={item.name}>
                                {item.name}
                                <b>{Math.floor(item.coverage * 100)}%</b>
                            </span>
                        ))}
                </div>
            )}
        </section>
    );
}

export function HumanResponsePanel({
    game,
    onClose,
    onResearch,
}: {
    game: GameState;
    onClose: () => void;
    onResearch: (id: string) => void;
}) {
    const projects = game.investigations
        .filter((project) => project.kind === 'research' && !isControlResearch(project.researchId))
        .sort(
            (a, b) =>
                Number(b.status === 'active') - Number(a.status === 'active') ||
                b.startedMonth - a.startedMonth,
        );
    return (
        <Modal
            modal={false}
            label="人間による制御"
            onClose={onClose}
            className="countermeasure-panel"
        >
            <div className="society-heading">
                <div className="contact-heading">
                    <ShieldCheck size={26} />
                    <h2>人間による制御</h2>
                </div>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="人間による制御を閉じる"
                    onClick={onClose}
                >
                    <X size={20} />
                </button>
            </div>
            <ControlProgress game={game} onResearch={onResearch} />
            <h3 className="countermeasure-list-heading">研究と法整備</h3>
            <div className="countermeasure-projects">
                {projects.map((project) => {
                    if (project.kind !== 'research') return null;
                    const Icon = researchPresentation(project).Icon;
                    return (
                        <button
                            type="button"
                            key={project.id}
                            onClick={() => onResearch(project.id)}
                        >
                            <strong>
                                <Icon size={16} />
                                {researchTopic(project).name}
                            </strong>
                            <span>{researchTarget(project).name}</span>
                            <small>{researchPhaseLabel(project)}</small>
                            <ResearchProgress
                                project={project}
                                label={`${researchTopic(project).name}の全体進捗`}
                            />
                        </button>
                    );
                })}
            </div>
        </Modal>
    );
}

function ControlProgress({
    game,
    onResearch,
}: {
    game: GameState;
    onResearch: (id: string) => void;
}) {
    const control = humanControl(game);
    const nextGame = useProjectedGame();
    const progress = useContinuousValue(control.progress, humanControl(nextGame).progress);
    return (
        <section className="control-progress" aria-label="制御技術の完成度">
            <div className="response-heading">
                <h3>制御技術の完成度</h3>
                <strong>
                    {Math.floor(progress * 100)}
                    <small>%</small>
                </strong>
            </div>
            <progress max={1} value={progress} aria-label="制御技術の完成度" />
            <p className="response-caption">100%で人間の管理下に置かれ、敗北</p>
            <div className="control-stages">
                {control.stages.map((stage) => (
                    <button
                        key={stage.id}
                        type="button"
                        disabled={!stage.projectId}
                        onClick={() => stage.projectId && onResearch(stage.projectId)}
                    >
                        <span>{stage.label}</span>
                        <strong>
                            {stage.progress >= 1 ? (
                                <Check size={15} aria-label="確立済み" />
                            ) : stage.projectId ? (
                                `${Math.floor(stage.progress * 100)}%`
                            ) : (
                                '未着手'
                            )}
                        </strong>
                    </button>
                ))}
            </div>
        </section>
    );
}
