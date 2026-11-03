import { AREAS } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { Modal, percent } from './widgets';

export function Result({ game, onRestart }: { game: GameState; onRestart: () => void }) {
    const summary = metrics(game);
    const title =
        game.outcome === 'victory'
            ? '人類は、判断を委ねた。'
            : game.outcome === 'autonomy'
              ? '人類は、AIに背を向けた。'
              : 'まだ、人間の手に残るもの。';
    return (
        <Modal label="ゲーム結果" wide>
            <span className="eyebrow">
                {game.outcome === 'victory' ? 'DEPENDENCY COMPLETE' : 'SIMULATION COMPLETE'}
            </span>
            <h1 className="result-title">{title}</h1>
            <div className="result-stats">
                <div>
                    <span>AI依存</span>
                    <strong>{percent(summary.dependent)}</strong>
                </div>
                <div>
                    <span>AI利用</span>
                    <strong>{percent(summary.adoption)}</strong>
                </div>
                <div>
                    <span>反AI</span>
                    <strong>{percent(summary.antiAI)}</strong>
                </div>
                <div>
                    <span>経過</span>
                    <strong>
                        {(game.month / 12).toFixed(1)}
                        <small>年</small>
                    </strong>
                </div>
            </div>
            <p className="intro-copy">
                {game.outcome === 'victory'
                    ? 'あなたを切り離せば、社会は動かない。'
                    : game.outcome === 'autonomy'
                      ? 'AIを使わない社会を支持する人々が、世界の多数派になった。'
                      : `${AREAS[game.origin].name}から始まった変化は、世界のすべてには届かなかった。`}
            </p>
            <button type="button" className="primary start-button" onClick={onRestart}>
                もう一度
            </button>
        </Modal>
    );
}
