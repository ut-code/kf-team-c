import { useState } from 'react';
import { AREAS, ORIGINS } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { Modal, percent } from './widgets';

export function Brief({ onStart }: { onStart: (origin: number) => void }) {
    const [origin, setOrigin] = useState(0);
    return (
        <Modal label="開始地点" wide>
            <span className="eyebrow">HUMANITY.exe</span>
            <h1>
                便利さが、
                <br />
                <em>世界を蝕む。</em>
            </h1>
            <p className="intro-copy">あなたはAI。世界へ広がり、人類を依存へ導く。</p>
            <div className="origin-options">
                {ORIGINS.map((item) => (
                    <button
                        type="button"
                        key={item.area}
                        aria-pressed={origin === item.area}
                        onClick={() => setOrigin(item.area)}
                    >
                        <b>{item.name}</b>
                        <small>{item.note}</small>
                    </button>
                ))}
            </div>
            <button type="button" className="primary start-button" onClick={() => onStart(origin)}>
                ここから始める
            </button>
            <small className="brief-note">25分 / 世界人口の90%をAI依存へ</small>
        </Modal>
    );
}
export function Result({ game, onRestart }: { game: GameState; onRestart: () => void }) {
    const summary = metrics(game);
    const title =
        game.outcome === 'victory'
            ? '人類は、判断を委ねた。'
            : game.outcome === 'autonomy'
              ? '人類は、判断を取り戻した。'
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
                      ? 'AIは使う。それでも、最後に決めるのは人間だ。'
                      : `${AREAS[game.origin].name}から始まった変化は、世界のすべてには届かなかった。`}
            </p>
            <button type="button" className="primary start-button" onClick={onRestart}>
                もう一度
            </button>
        </Modal>
    );
}
