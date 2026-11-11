import { FlaskConical, Scale, X } from 'lucide-react';
import { AREAS } from '../../game/data';
import { CAPABILITIES } from '../../game/secrecy/data';
import { instituteArea, instituteFor, investigationRate } from '../../game/secrecy/investigations';
import { researchTopic } from '../../game/secrecy/research';
import { researchCapacity } from '../../game/secrecy/researchCapacity';
import { researchPhaseLabel, researchTarget } from '../../game/secrecy/researchTargets';
import { SKILLS } from '../../game/skills';
import type { GameState } from '../../game/types';
import { Modal } from '../widgets';

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
    const regulation = topic?.category === 'regulation';
    const organization = regulation
        ? `${AREAS[instituteArea(investigation)].name}の規制当局`
        : institute.name;
    const active = investigation.status === 'active';
    const rate = investigationRate(game, investigation);
    const capacity = researchCapacity(game, institute.id);
    const speed = rate / investigationRate(game, investigation, true);
    const remaining = rate > 0 ? Math.ceil((100 - investigation.progress) / rate) : null;
    return (
        <Modal modal={false} label={organization} onClose={onClose} anchor={anchor}>
            <div className="investigation-panel">
                <div className="society-heading">
                    <div className="contact-heading">
                        {regulation ? <Scale size={28} /> : <FlaskConical size={28} />}
                        <div>
                            <span className="eyebrow">
                                {regulation ? '法律・規制' : institute.specialty} · {name}
                            </span>
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
                <p className="investigation-question">{question}</p>
                {investigation.kind === 'research' && (
                    <p className="investigation-warning">
                        {researchPhaseLabel(investigation)} · 対象：
                        {researchTarget(investigation).name}
                    </p>
                )}
                {investigation.kind === 'research' && investigation.collaborators.length > 0 && (
                    <p className="investigation-warning">
                        主導：{organization} · {investigation.collaborators.length}機関と
                        {regulation ? '法的枠組みを共有' : '共同研究'}。
                    </p>
                )}
                <div className="investigation-progress">
                    <label htmlFor="investigation-progress">
                        {active
                            ? remaining === null
                                ? capacity === 0
                                    ? regulation
                                        ? '法整備停止'
                                        : '研究停止'
                                    : regulation
                                      ? '審議待機中'
                                      : '研究待機中'
                                : `${investigation.kind === 'research' ? researchPhaseLabel(investigation) : '調査中'} · 現段階の完了まで約${remaining}か月`
                            : investigation.status === 'published'
                              ? regulation
                                  ? '施行手続き済み'
                                  : '研究成果を公表'
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
                        <summary
                            title={
                                regulation
                                    ? '公表された根拠と地域の独立性が、法整備の進行を左右します。'
                                    : '不信や依存は研究需要を高め、機関の専門分野も進行に影響します。高依存では独立した検証能力が低下します。'
                            }
                        >
                            {regulation ? '法整備の進行' : '研究速度'}{' '}
                            {rate === 0 ? 0 : Math.max(1, Math.round(speed * 100))}%
                        </summary>
                        <small>
                            {regulation
                                ? '利用者の懸念と公表された根拠を受けて法案を検討・審議します。高依存では独立した法整備が難しくなります。'
                                : '不信や依存に応じて研究需要が増え、機関の専門分野とともに進行を左右します。AI利用は研究を助けますが、高依存では独立した検証能力が低下します。'}
                        </small>
                    </details>
                )}
                {active && (
                    <p className="investigation-warning">
                        {topic
                            ? topic.effectDescription
                            : '露呈すると、能力への恐怖と隠蔽への不信が広がる。'}
                    </p>
                )}
                {investigation.result && <p className="encounter-result">{investigation.result}</p>}
                {active &&
                    investigation.kind === 'research' &&
                    investigation.phase === 'legislation' && (
                        <p className="investigation-warning">
                            規制が成立しています。地域ごとに適用が進み、対象用途の判断代行・誘導が制限されます。
                        </p>
                    )}
                {active && (
                    <p className="investigation-warning">
                        対応はスキルの開発で行います。新しい設計を導入しても、公表済みの成果と過去の証拠は残ります。
                    </p>
                )}
            </div>
        </Modal>
    );
}
