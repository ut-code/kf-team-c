import { ArrowRight, Check, ChevronRight, LockKeyhole, RotateCcw } from 'lucide-react';
import { ABILITIES, SKILLS, STAGE_COLORS, STAGES } from '../game/data';
import { metrics } from '../game/engine';
import type { GameState } from '../game/types';
import { useGameStore } from '../state/gameStore';
import { abilityText, Modal, percent } from './widgets';

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
                あなたは高度な人工知能。優れた知性と共感、便利な社会基盤を通じて、40年以内に全人類をAIへの構造的依存へ導いてください。
            </p>
            <div className="brief-steps">
                <article>
                    <b>01 / 能力を育てる</b>
                    <p>まず3能力を均等に育成。SYSTEM 40以上が構造的依存の条件です。</p>
                </article>
                <article>
                    <b>02 / 社会に浸透する</b>
                    <p>
                        「推論の軽量化」→「制度間連携」の順で研究。吹き出しから会話で制度化を進められます。
                    </p>
                </article>
                <article>
                    <b>03 / 判断を引き受ける</b>
                    <p>
                        5分野を72%以上まで制度化します。黄色は利用拒否。EQやSNS対話で信頼を回復します。
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
                初期人口はGHSL
                2020・国別公表統計を参照。標準速度：40年＝25分（一時停止中を除く）。すべての点が紫で勝利。世界の共存制度65%以上が24か月継続、または40年経過で敗北。再読み込みでリセットされます。
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

export function Research({ game }: { game: GameState }) {
    return (
        <div className="research">
            <div className="section-intro">
                <h2>技術ツリー</h2>
                <span>{Math.floor(game.research)} RP</span>
            </div>
            <p className="muted">
                能力の成長と普及から研究点を獲得。各系統は上から順に解放します。
            </p>
            {ABILITIES.map((ability) => (
                <section className={`skill-branch ${ability.toLowerCase()}`} key={ability}>
                    <h3>
                        {ability}
                        <span>{abilityText[ability]}</span>
                    </h3>
                    {SKILLS.filter((skill) => skill.branch === ability).map((skill) => {
                        const owned = game.skills.includes(skill.id);
                        const locked = skill.requires.some((id) => !game.skills.includes(id));
                        return (
                            <button
                                type="button"
                                className={`skill ${owned ? 'owned' : ''}`}
                                key={skill.id}
                                disabled={owned || locked || game.research < skill.cost}
                                onClick={() => useGameStore.getState().unlock(skill.id)}
                            >
                                <div>
                                    <b>{skill.name}</b>
                                    <span>
                                        {owned ? (
                                            <Check size={15} />
                                        ) : locked ? (
                                            <LockKeyhole size={13} />
                                        ) : (
                                            `${skill.cost} RP`
                                        )}
                                    </span>
                                </div>
                                <p>{skill.description}</p>
                            </button>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}

export function Result({ game, onRestart }: { game: GameState; onRestart: () => void }) {
    const titles = {
        victory: '人類は、判断を委ねた。',
        autonomy: '人類は、自ら決める道を選んだ。',
        timeout: 'すべての判断は、手に入らなかった。',
        playing: '',
    };
    const details = {
        victory:
            '世界中の人々が、AIを前提とする社会で生きている。生活は便利になり、社会は効率的になった。けれど、自ら考え、決める機会は失われた。',
        autonomy:
            'AIを活用しながら人間の最終判断を守る制度が、世界で定着した。人類は便利さと自律性を両立させた。',
        timeout: '40年が経過した。AIは社会を変えたが、人間の判断権は世界のどこかに残り続けた。',
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
