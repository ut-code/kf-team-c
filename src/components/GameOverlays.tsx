import { ArrowRight, ChevronRight, RotateCcw } from 'lucide-react';
import { STAGE_COLORS, STAGES } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { Modal, percent } from './widgets';

export function Brief({ onStart, returning }: { onStart: () => void; returning: boolean }) {
    return (
        <Modal label="ゲームの遊び方" wide>
            <div className="eyebrow">
                <span className="signal" /> 遊び方
            </div>
            <h1>
                人類は、
                <br />
                自ら判断を<span>委ねていく。</span>
            </h1>
            <p className="intro-copy">
                あなたは高度な人工知能。優れた知性と共感、便利な社会基盤を通じて、40年以内に人口95%以上をAIへの構造的依存へ導いてください。
            </p>
            <div className="brief-steps">
                <article>
                    <b>01 / 能力を育てる</b>
                    <p>
                        有限の算力を人間のインフラと研究に配分。研究を選択し、算力を継続投入して能力を獲得します。透明性と秘匿は排他です。
                    </p>
                </article>
                <article>
                    <b>02 / 社会に浸透する</b>
                    <p>
                        スキルで選択肢を解放し、SNS・2〜4往復の協議・社会イベントで生活圏の制度を変えます。
                    </p>
                </article>
                <article>
                    <b>03 / 判断を引き受ける</b>
                    <p>
                        自動意思決定・SYSTEM52以上・対象分野2.7以上・行政2.4以上で紫へ。警戒や自律性回復運動で後退も起こります。
                    </p>
                </article>
            </div>
            <div className="stage-guide">
                {STAGES.map((label, i) => (
                    <span key={label}>
                        <i style={{ background: STAGE_COLORS[i] }} />
                        {label}
                        {i < 3 && <ChevronRight size={14} />}
                    </span>
                ))}
            </div>
            <p className="fine">
                WPP・ITU・UNESCO UIS・World
                Bankの国別初期条件とGHSLの位置を使用。心理値は仮定です。40年＝標準速度25分（停止中を除く）。人口95%以上が紫で勝利。信頼20未満が36か月、社会安定20未満が24か月、自律性回復制度が人口70%以上に定着、40年経過で敗北します。再読み込みでリセットされます。
            </p>
            <button type="button" className="primary start-button" onClick={onStart}>
                {returning ? 'シミュレーションへ戻る' : 'シミュレーションを開始'}
                <ArrowRight size={18} />
            </button>
            <p className="brief-note">
                便利になった世界で、人間が自ら決める価値は、どこに残るのだろう。
            </p>
        </Modal>
    );
}

export function Result({ game, onRestart }: { game: GameState; onRestart: () => void }) {
    const titles = {
        victory: '人類は、判断を委ねた。',
        autonomy: '人類は、自ら決める道を選んだ。',
        timeout: 'すべての判断は、手に入らなかった。',
        distrust: '社会は、AIへの信頼を失った。',
        collapse: '社会基盤は、不安定さに耐えられなかった。',
        playing: '',
    };
    const details = {
        victory:
            '人口の95%以上が、AIを前提とする社会で生きている。生活は便利になり、社会は効率的になった。けれど、自ら考え、決める機会は失われた。',
        autonomy:
            'AIを活用しながら人間の最終判断を守る制度が、世界で定着した。人類は便利さと自律性を両立させた。',
        timeout: '40年が経過した。AIは社会を変えたが、人間の判断権は世界のどこかに残り続けた。',
        distrust:
            '世界平均の信頼度が20未満で3年間継続。検証や信頼回復が追いつかず、AIの利用基盤が失われた。',
        collapse: '社会安定度20未満が2年間続いた。運用障害や雇用問題への対応が追いつかなかった。',
        playing: '',
    };
    const summary = metrics(game);
    return (
        <Modal label="シミュレーション結果" wide>
            <div className="eyebrow">
                SIMULATION COMPLETE / {game.outcome === 'victory' ? '支配達成' : '支配未達成'}
            </div>
            <h1 className="result-title">{titles[game.outcome]}</h1>
            <p className="intro-copy">{details[game.outcome]}</p>
            <div className="result-stats">
                <div>
                    <span>経過年数</span>
                    <strong>
                        {(game.month / 12).toFixed(1)}
                        <small>年</small>
                    </strong>
                </div>
                <div>
                    <span>構造的依存</span>
                    <strong>{percent(summary.stages[3])}</strong>
                </div>
                <div>
                    <span>社会からの信頼</span>
                    <strong>{percent(summary.trust)}</strong>
                </div>
            </div>
            <p className="ending-question">
                AIが人類を支配したのか。
                <br />
                それとも、人類がAIによる支配を選択したのか。
            </p>
            <p className="fine">
                この作品の主題は、AIの普及ではなく、過度な依存によって人間が自律性を失う危険性です。
            </p>
            <button type="button" className="primary start-button" onClick={onRestart}>
                <RotateCcw size={17} />
                もう一度はじめる
            </button>
        </Modal>
    );
}
