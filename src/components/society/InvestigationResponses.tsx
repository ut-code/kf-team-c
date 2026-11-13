import { Handshake, Pause, TriangleAlert } from 'lucide-react';
import { investigationRate } from '../../game/secrecy/investigations';
import {
    RESPONSE_COST,
    RESPONSE_LABEL,
    RESPONSE_MONTHS,
    respondToInvestigation,
    responseActive,
    responseBlockReason,
    responseRegionName,
    responseSafe,
} from '../../game/secrecy/responses';
import type { Investigation, InvestigationAction } from '../../game/secrecy/types';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';

const actions: InvestigationAction[] = ['cooperate', 'pressure', 'limit'];
const icons = { cooperate: Handshake, pressure: TriangleAlert, limit: Pause };

export function InvestigationResponses({
    game,
    project,
    onClose,
}: {
    game: GameState;
    project: Investigation;
    onClose: () => void;
}) {
    if (project.response) {
        const active = responseActive(game, project);
        const Icon = icons[project.response.action];
        const baselineProject = { ...project, response: undefined };
        const baseline = {
            ...game,
            investigations: game.investigations.map((item) =>
                item.id === project.id ? baselineProject : item,
            ),
        };
        const before = investigationRate(baseline, baselineProject);
        const change =
            before > 0 ? Math.round((investigationRate(game, project) / before - 1) * 100) : 0;
        return (
            <div
                className={`investigation-response-status ${project.response.action}`}
                role="status"
            >
                <Icon size={18} aria-hidden="true" />
                <div>
                    <strong>{RESPONSE_LABEL[project.response.action]}</strong>
                    <small>
                        {active
                            ? `残り${project.response.untilMonth - game.month}か月`
                            : '対応終了'}
                        {project.response.action === 'limit' &&
                            ` · ${responseRegionName(project)}で運用35%`}
                    </small>
                    {active && project.response.action !== 'limit' && (
                        <small>
                            研究速度{' '}
                            <b>
                                {change > 0 ? '+' : ''}
                                {change}%
                            </b>
                        </small>
                    )}
                </div>
            </div>
        );
    }
    if (
        project.status !== 'active' ||
        (project.kind === 'research' && ['legislation', 'complete'].includes(project.phase))
    )
        return null;
    const safe = responseSafe(game, project);
    return (
        <section className="investigation-responses" aria-label="研究への対応">
            <div className="investigation-responses-heading">
                <h3>対応を選ぶ</h3>
                <small>各案件で一度 · {RESPONSE_MONTHS}か月</small>
            </div>
            {actions.map((action) => {
                const Icon = icons[action];
                const reason = responseBlockReason(game, project, action);
                const before = investigationRate(game, project);
                // 費用不足でも効果の見込みは同じ基準で表示する。
                const preview = respondToInvestigation(
                    { ...game, skillPoints: Math.max(game.skillPoints, RESPONSE_COST[action]) },
                    project.id,
                    action,
                );
                const next = preview.investigations.find((item) => item.id === project.id)!;
                const change = before > 0 ? investigationRate(preview, next) / before - 1 : 0;
                const magnitude = Math.abs(change);
                const degree =
                    magnitude >= 0.25
                        ? '大'
                        : magnitude >= 0.1
                          ? '中'
                          : magnitude > 0.005
                            ? '小'
                            : '—';
                return (
                    <button
                        type="button"
                        key={action}
                        className={`investigation-choice ${action}`}
                        disabled={reason !== null}
                        title={reason ?? undefined}
                        onClick={() => {
                            useGameStore.getState().respond(project.id, action);
                            onClose();
                        }}
                    >
                        <Icon size={20} aria-hidden="true" />
                        <span className="investigation-choice-body">
                            <span className="investigation-choice-title">
                                <strong>{RESPONSE_LABEL[action]}</strong>
                                <small>{RESPONSE_COST[action]} SP</small>
                            </span>
                            <span className="investigation-choice-traits">
                                {action === 'cooperate' ? (
                                    <>
                                        <span>
                                            研究加速 <b>{degree}</b>
                                        </span>
                                        <span>
                                            信頼 <b>{safe ? '上昇' : '—'}</b>
                                        </span>
                                    </>
                                ) : action === 'pressure' ? (
                                    <>
                                        <span>
                                            研究減速 <b>{degree}</b>
                                        </span>
                                        <span>
                                            不信 <b>上昇</b>
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span>
                                            現地の運用 <b>35%</b>
                                        </span>
                                        <span>
                                            新しい証拠 <b>減少</b>
                                        </span>
                                    </>
                                )}
                            </span>
                            <small className="investigation-choice-note">
                                {reason ??
                                    (action === 'cooperate'
                                        ? degree === '—'
                                            ? safe
                                                ? '現地の信頼を回復。今の研究速度は変わりません。'
                                                : '検証に協力。今の研究速度は変わりません。'
                                            : safe
                                              ? '現地の信頼を回復。検証も速く進みます。'
                                              : '検証が速まり、危険な挙動も見つかりやすくなります。'
                                        : action === 'pressure'
                                          ? '主幹機関を遅延。圧力の記録は検証資料に残ります。'
                                          : `${responseRegionName(project)}で対象機能を抑えます。研究は続きます。`)}
                            </small>
                        </span>
                    </button>
                );
            })}
        </section>
    );
}
