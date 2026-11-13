import { ShieldCheck, X } from 'lucide-react';
import { useMemo } from 'react';
import { humanResponse } from '../game/humanResponse';
import { researchTopic } from '../game/secrecy/research';
import { researchPhaseLabel, researchTarget } from '../game/secrecy/researchTargets';
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
        <section className="human-response" aria-label="人間側の対策">
            <div className="response-heading">
                <h3>人間側の対策</h3>
                <strong>
                    {Math.floor(protection * 100)}
                    <small>%</small>
                </strong>
            </div>
            <meter aria-label="依存対策の浸透度" min={0} max={1} value={protection} />
            <p className="response-caption">依存対策の浸透度</p>
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
        .filter((project) => project.kind === 'research')
        .sort(
            (a, b) =>
                Number(b.status === 'active') - Number(a.status === 'active') ||
                b.startedMonth - a.startedMonth,
        );
    return (
        <Modal
            modal={false}
            label="人間側の対策"
            onClose={onClose}
            className="countermeasure-panel"
        >
            <div className="society-heading">
                <div className="contact-heading">
                    <ShieldCheck size={26} />
                    <h2>人間側の対策</h2>
                </div>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="人間側の対策を閉じる"
                    onClick={onClose}
                >
                    <X size={20} />
                </button>
            </div>
            <p className="countermeasure-intro">
                通常利用に重なる斜線が濃いほど、その地域の対策が進んでいます。対策は依存化を妨げますが、すでにAIへ判断を委ねた人々には効きにくくなります。
            </p>
            <HumanResponse game={game} />
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
