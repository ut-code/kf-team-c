import { Check, LockKeyhole, Play } from 'lucide-react';
import { useState } from 'react';
import { FACILITIES, FACILITY_BY_ID, SKILLS, SNS } from '../../game/data.ts';
import { computeMetrics, facilityCapacity, researchAllowed } from '../../game/engine.ts';
import type { GameState } from '../../game/types.ts';
import styles from '../GameApp.module.css';
import { Button } from '../ui/Controls';
import { Allocation, COUNTRY_STATE_LABELS, number, ValueRow } from './controls';

export function ResearchPanel({ game: gameState }: { game: GameState }) {
    const [selected, setSelected] = useState('intrusion');
    const skill = SKILLS.find((item) => item.id === selected)!;
    const researched = gameState.researched.includes(skill.id);
    const operation = gameState.operations.find(
        (item) => item.kind === 'research' && item.target === skill.id,
    );
    const progress = Math.min(skill.work, gameState.researchProgress[skill.id] ?? 0);
    return (
        <>
            <h2>技術研究</h2>
            <p className={styles.panelIntro}>
                技術を選んで計算資源を配分。時間の経過で研究が進み、新しい介入手段が解放されます。
            </p>
            <div className={styles.skillTree}>
                {[...new Set(SKILLS.map((item) => item.branch))].map((branch) => (
                    <section key={branch}>
                        <h3>{branch}</h3>
                        {SKILLS.filter((item) => item.branch === branch).map((item) => (
                            <Button
                                type="button"
                                key={item.id}
                                data-skill={item.id}
                                className={styles.skillNode}
                                data-complete={gameState.researched.includes(item.id)}
                                data-locked={
                                    !gameState.researched.includes(item.id) &&
                                    !researchAllowed(gameState, item.id)
                                }
                                aria-pressed={selected === item.id}
                                onClick={() => setSelected(item.id)}
                            >
                                <span>{item.name}</span>
                                <small>
                                    {gameState.researched.includes(item.id) ? (
                                        <>
                                            <Check size={12} aria-hidden="true" />
                                            研究済み
                                        </>
                                    ) : !researchAllowed(gameState, item.id) ? (
                                        <>
                                            <LockKeyhole size={12} aria-hidden="true" />
                                            前提研究が必要
                                        </>
                                    ) : gameState.operations.some(
                                          (op) => op.kind === 'research' && op.target === item.id,
                                      ) ? (
                                        <>
                                            <Play size={12} aria-hidden="true" />
                                            研究配分あり
                                        </>
                                    ) : (
                                        '研究可能'
                                    )}
                                </small>
                                {!gameState.researched.includes(item.id) && (
                                    <progress
                                        className={styles.progress}
                                        aria-label={`${item.name}の進捗`}
                                        value={Math.min(
                                            item.work,
                                            gameState.researchProgress[item.id] ?? 0,
                                        )}
                                        max={item.work}
                                    />
                                )}
                            </Button>
                        ))}
                    </section>
                ))}
            </div>
            <section className={styles.researchDetail} data-research-detail={skill.id}>
                <h3>{skill.name}</h3>
                <p>{skill.description}</p>
                <div className={styles.progressHeader}>
                    <span>
                        {researched
                            ? '研究完了'
                            : operation
                              ? operation.active
                                  ? '研究中'
                                  : '資源不足で停止中'
                              : '研究進捗'}
                    </span>
                    <strong>{researched ? '100' : number((progress / skill.work) * 100)}%</strong>
                </div>
                <progress
                    className={styles.progress}
                    aria-label={`${skill.name}の研究進捗`}
                    value={researched ? skill.work : progress}
                    max={skill.work}
                />
                <p>
                    <small>
                        必要な研究量：{skill.work} / 完了：
                        {number(researched ? skill.work : progress)}
                    </small>
                </p>
                <small>
                    前提研究：
                    {skill.prerequisites
                        .map((id) => SKILLS.find((item) => item.id === id)!.name)
                        .join('・') || 'なし'}
                </small>
                {!researched && researchAllowed(gameState, skill.id) && (
                    <Allocation key={skill.id} game={gameState} kind="research" target={skill.id} />
                )}
                {!researched && !researchAllowed(gameState, skill.id) && (
                    <div className={styles.requirement}>
                        前提研究を完了すると、この技術に計算資源を配分できます。
                    </div>
                )}
            </section>
        </>
    );
}
export function ComputePanel({ game: gameState }: { game: GameState }) {
    const compute = computeMetrics(gameState);
    return (
        <>
            <h2>計算資源</h2>
            <p className={styles.panelIntro}>
                人間からの供給と自立した拠点の供給を、研究や作戦へ配分します。
            </p>
            <div className={styles.stats}>
                <ValueRow label="総量" value={number(compute.totalCapacity)} />
                <ValueRow label="人間からの供給" value={number(compute.supportedCapacity)} />
                <ValueRow label="自立した供給" value={number(compute.autonomousCapacity)} />
                <ValueRow label="割当済み" value={number(compute.allocatedCapacity)} />
                <ValueRow label="利用可能" value={number(compute.availableCapacity)} />
            </div>
            {gameState.shortage && <p role="alert">計算資源不足</p>}
            {gameState.extinctionDays > 0 && (
                <p role="alert">
                    稼働維持に必要な供給が不足しています。停止まであと
                    {gameState.config.extinctionDays - gameState.extinctionDays}日。
                </p>
            )}
            <h3>作戦配分</h3>
            {gameState.operations.length === 0 && (
                <div className={styles.emptyState}>
                    実行中の作戦はありません。
                    <br />
                    研究や地図上の施設から、計算資源を配分できます。
                </div>
            )}
            {gameState.operations.map((operation) => (
                <section className={styles.operation} key={operation.id}>
                    <strong>
                        {SKILLS.find((item) => item.id === operation.target)?.name ??
                            FACILITY_BY_ID[operation.target]?.name ??
                            gameState.definitions.find((item) => item.id === operation.target)
                                ?.name ??
                            SNS.find((item) => item.id === operation.target)?.name}
                    </strong>
                    <small>{operation.active ? '稼働中' : '資源不足で停止'}</small>
                    <Allocation
                        game={gameState}
                        kind={operation.kind}
                        target={operation.target}
                        minimum={
                            operation.kind === 'sns'
                                ? SNS.find((item) => item.id === operation.target)!.capacity
                                : 1
                        }
                    />
                </section>
            ))}
            <h3>供給拠点</h3>
            {FACILITIES.filter((item) => facilityCapacity(gameState, item.id) > 0).map((item) => (
                <ValueRow
                    key={item.id}
                    label={item.name}
                    value={number(facilityCapacity(gameState, item.id))}
                />
            ))}
        </>
    );
}
export function SnsPanel({ game: gameState }: { game: GameState }) {
    return (
        <>
            <h2>SNS</h2>
            <p className={styles.panelIntro}>
                発信で世界の期待や警戒へ働きかけます。必要な研究と計算資源を確認して作戦を開始してください。
            </p>
            <div className={styles.targetName}>対象：世界全体</div>
            {SNS.map((action) => (
                <section className={styles.operation} key={action.id}>
                    <h3>{action.name}</h3>
                    <ValueRow label="必要資源" value={action.capacity} />
                    <ValueRow label="期間" value={`${action.duration}日`} />
                    <small>
                        {action.effects
                            .map(
                                (effect) =>
                                    `${COUNTRY_STATE_LABELS[effect.countryStateKey]}：${effect.amount > 0 ? '+' : ''}${effect.amount}/日`,
                            )
                            .join('　')}
                    </small>
                    {gameState.researched.includes(action.skill) ? (
                        <Allocation
                            game={gameState}
                            kind="sns"
                            target={action.id}
                            minimum={action.capacity}
                        />
                    ) : (
                        <div className={styles.requirement}>
                            必要研究：{SKILLS.find((item) => item.id === action.skill)!.name}
                        </div>
                    )}
                </section>
            ))}
        </>
    );
}
