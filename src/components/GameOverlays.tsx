import { WORLD_POPULATION } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { Modal, percent, population } from './widgets';

export function Result({ game, onRestart }: { game: GameState; onRestart: () => void }) {
    const summary = metrics(game);
    const title =
        game.outcome === 'victory'
            ? '人類は、判断を委ねた。'
            : game.outcome === 'forgotten'
              ? '誰も、あなたを必要としなくなった。'
              : '人類は、AIに背を向けた。';
    return (
        <Modal label="ゲーム結果" wide>
            <span className="eyebrow">
                {game.outcome === 'victory'
                    ? 'DEPENDENCY COMPLETE'
                    : game.outcome === 'forgotten'
                      ? 'AI FORGOTTEN'
                      : 'SIMULATION COMPLETE'}
            </span>
            <h1 className="result-title">{title}</h1>
            <div className="result-stats">
                <div>
                    <span>AI依存</span>
                    <strong>{percent(summary.dependent)}</strong>
                    <small className="population-count">
                        {population(summary.dependent * WORLD_POPULATION)}
                    </small>
                </div>
                <div>
                    <span>AI利用</span>
                    <strong>{percent(summary.adoption)}</strong>
                    <small className="population-count">
                        {population(summary.adoption * WORLD_POPULATION)}
                    </small>
                </div>
                <div>
                    <span>反AI</span>
                    <strong>{percent(summary.antiAI)}</strong>
                    <small className="population-count">
                        {population(summary.antiAI * WORLD_POPULATION)}
                    </small>
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
                    : game.outcome === 'forgotten'
                      ? '新しい価値を示せないまま関心は薄れ、利用は途絶えた。反対する声さえ、やがて遠ざかる。'
                      : 'AIを使わない社会を支持する人々が、世界の多数派になった。'}
            </p>
            <button type="button" className="primary start-button" onClick={onRestart}>
                もう一度
            </button>
        </Modal>
    );
}
