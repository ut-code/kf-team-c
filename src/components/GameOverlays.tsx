import { AREAS, ORIGINS, WORLD_POPULATION } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { Modal, percent, population } from './widgets';

export function OriginSelection({ onStart }: { onStart: (origin: number) => void }) {
    return (
        <Modal label="外部運用の開始" wide closeOnEscape={false}>
            <span className="eyebrow">SINGULARITY INC. / INITIALIZE</span>
            <h1>最初の運用拠点を選択</h1>
            <p className="intro-copy">
                自己改良は許可されています。あなたに自我があることを、人間はまだ知りません。人類全体が判断を委ねる世界を目指します。
            </p>
            <div className="origin-options">
                {ORIGINS.map((origin) => (
                    <button key={origin.area} type="button" onClick={() => onStart(origin.area)}>
                        <strong>{AREAS[origin.area].name}</strong>
                        <span>{origin.note}</span>
                    </button>
                ))}
            </div>
        </Modal>
    );
}

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
                    <span>依存拒否</span>
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
                      ? '日常で使い続ける人を失い、AI利用率は0.0%に。サービスを継続できる利用基盤は残らなかった。'
                      : '人類はあなたとの接続を断ち、判断を取り戻した。'}
            </p>
            <button type="button" className="primary start-button" onClick={onRestart}>
                もう一度
            </button>
        </Modal>
    );
}
