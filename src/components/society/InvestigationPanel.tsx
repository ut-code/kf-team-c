import { Eye, FlaskConical, Handshake, Pause, X } from 'lucide-react';
import { CAPABILITIES } from '../../game/secrecy/data';
import {
    instituteArea,
    instituteFor,
    investigationRate,
    regionalDependency,
} from '../../game/secrecy/investigations';
import { SKILLS } from '../../game/skills';
import type { GameState } from '../../game/types';
import { useGameStore } from '../../state/gameStore';
import { Modal } from '../widgets';

export function InvestigationPanel({
    game,
    id,
    onClose,
}: {
    game: GameState;
    id: string;
    onClose: () => void;
}) {
    const investigation = game.investigations.find((item) => item.id === id);
    if (!investigation) return null;
    const institute = instituteFor(investigation);
    const skill = SKILLS.find((item) => item.id === investigation.skillId)!;
    const capability = CAPABILITIES[investigation.skillId];
    const active = investigation.status === 'active';
    const remaining = Math.ceil(
        (100 - investigation.progress) / investigationRate(game, investigation),
    );
    const area = game.areas[instituteArea(investigation)];
    const pressure = Math.round(regionalDependency(game, investigation) * 100);
    const intervene = (action: 'disclose' | 'restrict' | 'partnership' | 'pressure') =>
        useGameStore.getState().investigate(id, action);
    return (
        <Modal label={institute.name} onClose={onClose}>
            <div className="investigation-panel">
                <div className="society-heading">
                    <div className="contact-heading">
                        <FlaskConical size={28} />
                        <div>
                            <span className="eyebrow">
                                {institute.specialty} · {skill.name}
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
                <p className="investigation-question">{capability.question}</p>
                <div className="investigation-progress">
                    <label htmlFor="investigation-progress">
                        {active
                            ? `公表まで約${remaining}か月`
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
                    <p className="investigation-warning">
                        露呈すると、能力への恐怖と隠蔽への不信が広がる。
                    </p>
                )}
                {investigation.result && <p className="encounter-result">{investigation.result}</p>}
                {active && (
                    <div className="investigation-actions">
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
                                            {game.skills.includes('privacy')
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
                                            周辺依存 {pressure}% ·{' '}
                                            {pressure >= 30 ? '遅延効果 大' : '遅延効果 小'} ·
                                            発覚時の不信↑
                                        </small>
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                )}
                {active && (
                    <small className="investigation-context">
                        現地AI利用 {Math.round((area.autonomous + area.dependent) * 100)}% ·
                        利用が広がるほど調査材料も増える
                    </small>
                )}
            </div>
        </Modal>
    );
}
