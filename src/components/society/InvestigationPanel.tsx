import { Eye, FlaskConical, Handshake, Pause, X } from 'lucide-react';
import { CAPABILITIES } from '../../game/secrecy/data';
import {
    instituteFor,
    investigationRate,
    regionalDependency,
    regionalDependencyMetrics,
} from '../../game/secrecy/investigations';
import { researchTopic } from '../../game/secrecy/research';
import { researchCapacity } from '../../game/secrecy/researchCapacity';
import { SKILLS } from '../../game/skills';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { Modal, population } from '../widgets';

export function InvestigationPanel({
    game,
    id,
    onClose,
    anchor,
}: {
    game: GameState;
    id: string;
    onClose: () => void;
    anchor?: { x: number; y: number };
}) {
    const investigation = game.investigations.find((item) => item.id === id);
    if (!investigation) return null;
    const institute = instituteFor(investigation);
    const topic = investigation.kind === 'research' ? researchTopic(investigation) : null;
    const name =
        investigation.kind === 'capability'
            ? SKILLS.find((item) => item.id === investigation.skillId)!.name
            : topic!.name;
    const question =
        investigation.kind === 'capability'
            ? CAPABILITIES[investigation.skillId].question
            : topic!.question;
    const active = investigation.status === 'active';
    const rate = investigationRate(game, investigation);
    const capacity = researchCapacity(game, institute.id);
    const speed = rate / investigationRate(game, investigation, true);
    const remaining = rate > 0 ? Math.ceil((100 - investigation.progress) / rate) : null;
    const pressure = Math.round(regionalDependency(game, investigation) * 100);
    const surrounding = regionalDependencyMetrics(game, investigation);
    const intervene = (action: 'disclose' | 'restrict' | 'partnership' | 'pressure') =>
        useGameStore.getState().investigate(id, action);
    return (
        <Modal modal={false} label={institute.name} onClose={onClose} anchor={anchor}>
            <div className="investigation-panel">
                <div className="society-heading">
                    <div className="contact-heading">
                        <FlaskConical size={28} />
                        <div>
                            <span className="eyebrow">
                                {institute.specialty} · {name}
                            </span>
                            <h2>{institute.name}</h2>
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
                <p className="investigation-question">{question}</p>
                <div className="investigation-progress">
                    <label htmlFor="investigation-progress">
                        {active
                            ? remaining === null
                                ? capacity === 0
                                    ? '研究停止'
                                    : '研究待機中'
                                : `公表まで約${remaining}か月`
                            : investigation.status === 'published'
                              ? '調査結果を公表'
                              : '対応済み'}
                    </label>
                    <strong>{Math.floor(investigation.progress)}%</strong>
                    <progress
                        id="investigation-progress"
                        value={investigation.progress}
                        max={100}
                    />
                </div>
                {active && (
                    <details className="research-speed">
                        <summary title="AI利用は研究を助けますが、高依存では独立した検証能力が低下します。研究支援の習得で両方の効果が強まります。">
                            研究速度 {rate === 0 ? 0 : Math.max(1, Math.round(speed * 100))}%
                        </summary>
                        <small>
                            AI利用は研究を助けますが、高依存では独立した検証能力が低下します。研究支援の習得で両方の効果が強まります。100%は研究支援・依存・介入の影響がない状態です。
                        </small>
                    </details>
                )}
                {active && (
                    <p className="investigation-warning">
                        {topic
                            ? topic.resistance >= 8
                                ? '権限逸脱能力があれば独自目的が立証され、秘匿能力が露呈します。依存と公知の権限逸脱に応じて反発が続き、好感度が高いほど軽減されます。'
                                : '成果は共有され、実際の依存に応じて警戒が広がります。依存がなければ反発は生じません。'
                            : '露呈すると、能力への恐怖と隠蔽への不信が広がる。'}
                    </p>
                )}
                {investigation.result && <p className="encounter-result">{investigation.result}</p>}
                {active && (
                    <div className="investigation-actions">
                        {!topic && (
                            <>
                                <button type="button" onClick={() => intervene('disclose')}>
                                    <Eye size={18} />
                                    <span>
                                        <strong>正直に開示</strong>
                                        <small>能力への警戒は残る · 隠蔽の発覚を回避</small>
                                    </span>
                                </button>
                                <button type="button" onClick={() => intervene('restrict')}>
                                    <Pause size={18} />
                                    <span>
                                        <strong>機能を制限</strong>
                                        <small>調査を中断 · この研究の効果を20%に</small>
                                    </span>
                                </button>
                            </>
                        )}
                        {topic && (
                            <p className="investigation-warning">
                                {topic.resistance >= 8
                                    ? '独立再現により、圧力・共同検証の遅延効果は小さい。'
                                    : '能力を公開・制限しても、この研究は終了しない。'}
                            </p>
                        )}
                        {investigation.intervention === 'none' && (
                            <>
                                <button
                                    type="button"
                                    disabled={game.skillPoints < 2}
                                    onClick={() => intervene('partnership')}
                                >
                                    <Handshake size={18} />
                                    <span>
                                        <strong>共同検証 · 2 SP</strong>
                                        <small>
                                            {topic
                                                ? '検証協力で進行を遅らせる · 成果は消せない'
                                                : game.skills.includes('privacy')
                                                  ? '保護された検証環境で調査を遅らせる'
                                                  : '現地導入↑ · 情報保護なしでは調査も加速'}
                                        </small>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    disabled={game.skillPoints < 2}
                                    onClick={() => intervene('pressure')}
                                >
                                    <FlaskConical size={18} />
                                    <span>
                                        <strong>周辺企業から圧力 · 2 SP</strong>
                                        <small>
                                            周辺依存 {pressure}%（
                                            {population(surrounding.dependent)}） ·{' '}
                                            {topic?.resistance === 8
                                                ? '独立再現により遅延効果は小さい'
                                                : pressure >= 30
                                                  ? '遅延効果 大'
                                                  : '遅延効果 小'}
                                            {!topic && ' · 発覚時の不信↑'}
                                        </small>
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
