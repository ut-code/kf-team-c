import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AREAS, ORIGINS } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { Modal, percent } from './widgets';

export function OriginSelection({ onStart }: { onStart: (origin: number) => void }) {
    return (
        <Modal
            label="運用拠点の選択"
            className="entry-panel origin-panel"
            wide
            closeOnEscape={false}
        >
            <h1>どこから、世界へ広げるか。</h1>
            <p className="entry-description">AIを普及させる最初の拠点を選んでください。</p>
            <div className="origin-options">
                {ORIGINS.map((origin) => (
                    <button key={origin.area} type="button" onClick={() => onStart(origin.area)}>
                        <span className="origin-copy">
                            <strong>{AREAS[origin.area].name}</strong>
                            <span>{origin.note}</span>
                        </span>
                        <ArrowRight size={18} aria-hidden="true" />
                    </button>
                ))}
            </div>
            <div className="origin-goal">
                <p>人類のAI依存率が100%に達するとクリア</p>
                <span>プレイ時間 約25分</span>
            </div>
        </Modal>
    );
}

export function Result({
    game,
    onReturnToTitle,
}: {
    game: GameState;
    onReturnToTitle: () => void;
}) {
    const summary = metrics(game);
    const won = game.outcome === 'victory';
    const forgotten = game.outcome === 'forgotten';
    return (
        <Modal label="ゲーム結果" className="entry-panel result-panel" closeOnEscape={false}>
            <p className="result-outcome" data-victory={won}>
                {won ? 'クリア' : 'ゲームオーバー'}
            </p>
            <h1>
                {won
                    ? '人類は、判断を委ねた。'
                    : forgotten
                      ? '誰も、あなたを必要としなくなった。'
                      : '人類は、判断を取り戻した。'}
            </h1>
            <p className="entry-description">
                {won
                    ? 'AIは、社会に欠かせない存在になりました。'
                    : forgotten
                      ? 'AIの利用者がいなくなり、サービスは終了しました。'
                      : '人類はAIとの接続を断ちました。'}
            </p>
            <div className="result-dependency">
                <span>最終AI依存率</span>
                <strong>{percent(summary.dependent)}</strong>
            </div>
            <dl className="result-summary">
                <div>
                    <dt>AI利用率</dt>
                    <dd>{percent(summary.adoption)}</dd>
                </div>
                <div>
                    <dt>利用拒否率</dt>
                    <dd>{percent(summary.antiAI)}</dd>
                </div>
                <div>
                    <dt>経過年数</dt>
                    <dd>
                        {(game.month / 12).toFixed(1)}
                        <small>年</small>
                    </dd>
                </div>
            </dl>
            <button type="button" className="primary result-return" onClick={onReturnToTitle}>
                <ArrowLeft size={16} aria-hidden="true" />
                開始画面に戻る
            </button>
        </Modal>
    );
}
