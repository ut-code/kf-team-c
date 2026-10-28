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
    return (
        <>
            <h2>技術研究</h2>
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
                                aria-pressed={selected === item.id}
                                onClick={() => setSelected(item.id)}
                            >
                                <span>{item.name}</span>
                                <small>
                                    {gameState.researched.includes(item.id)
                                        ? '研究済み'
                                        : `${number(Math.min(item.work, gameState.researchProgress[item.id] ?? 0))} / ${item.work}`}
                                </small>
                            </Button>
                        ))}
                    </section>
                ))}
            </div>
            <section className={styles.researchDetail} data-research-detail={skill.id}>
                <h3>{skill.name}</h3>
                <p>{skill.description}</p>
                <small>
                    前提研究：
                    {skill.prerequisites
                        .map((id) => SKILLS.find((item) => item.id === id)!.name)
                        .join('・') || 'なし'}
                </small>
                {!researched && researchAllowed(gameState, skill.id) && (
                    <Allocation key={skill.id} game={gameState} kind="research" target={skill.id} />
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
            <div className={styles.stats}>
                <ValueRow label="総量" value={number(compute.totalCapacity)} />
                <ValueRow label="割当済み" value={number(compute.allocatedCapacity)} />
                <ValueRow label="利用可能" value={number(compute.availableCapacity)} />
            </div>
            {gameState.shortage && <p role="alert">計算資源不足</p>}
            <h3>作戦配分</h3>
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
                        <small>
                            必要研究：{SKILLS.find((item) => item.id === action.skill)!.name}
                        </small>
                    )}
                </section>
            ))}
        </>
    );
}
