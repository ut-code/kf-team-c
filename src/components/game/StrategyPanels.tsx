import { useState } from 'react';
import { FACILITIES, FACILITY_BY_ID, SKILLS, SNS } from '../../game/data.ts';
import { computeState, facilityCapacity, researchAllowed } from '../../game/engine.ts';
import type { GameState } from '../../game/types.ts';
import styles from '../GameApp.module.css';
import { Button } from '../ui/Controls';
import { Allocation, METRIC_LABELS, number, ValueRow } from './controls';

export function ResearchPanel({ game }: { game: GameState }) {
    const [selected, setSelected] = useState('intrusion');
    const skill = SKILLS.find((item) => item.id === selected)!;
    const researched = game.researched.includes(skill.id);
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
                                data-complete={game.researched.includes(item.id)}
                                aria-pressed={selected === item.id}
                                onClick={() => setSelected(item.id)}
                            >
                                <span>{item.name}</span>
                                <small>
                                    {game.researched.includes(item.id)
                                        ? '研究済み'
                                        : `${number(Math.min(item.work, game.researchProgress[item.id] ?? 0))} / ${item.work}`}
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
                {!researched && researchAllowed(game, skill.id) && (
                    <Allocation key={skill.id} game={game} kind="research" target={skill.id} />
                )}
            </section>
        </>
    );
}
export function ComputePanel({ game }: { game: GameState }) {
    const compute = computeState(game);
    return (
        <>
            <h2>計算資源</h2>
            <div className={styles.stats}>
                <ValueRow label="総量" value={number(compute.totalCapacity)} />
                <ValueRow label="割当済み" value={number(compute.allocatedCapacity)} />
                <ValueRow label="利用可能" value={number(compute.availableCapacity)} />
            </div>
            {game.shortage && <p role="alert">計算資源不足</p>}
            <h3>作戦配分</h3>
            {game.operations.map((operation) => (
                <section className={styles.operation} key={operation.id}>
                    <strong>
                        {SKILLS.find((item) => item.id === operation.target)?.name ??
                            FACILITY_BY_ID[operation.target]?.name ??
                            game.definitions.find((item) => item.id === operation.target)?.name ??
                            SNS.find((item) => item.id === operation.target)?.name}
                    </strong>
                    <small>{operation.active ? '稼働中' : '資源不足で停止'}</small>
                    <Allocation
                        game={game}
                        kind={operation.kind}
                        target={operation.target}
                        country={operation.country}
                        minimum={
                            operation.kind === 'sns'
                                ? SNS.find((item) => item.id === operation.target)!.capacity
                                : 1
                        }
                    />
                </section>
            ))}
            <h3>供給拠点</h3>
            {FACILITIES.filter((item) => facilityCapacity(game, item.id) > 0).map((item) => (
                <ValueRow
                    key={item.id}
                    label={item.name}
                    value={number(facilityCapacity(game, item.id))}
                />
            ))}
        </>
    );
}
export function SnsPanel({ game, country }: { game: GameState; country: string | null }) {
    return (
        <>
            <h2>SNS</h2>
            <div className={styles.targetName}>
                {country
                    ? game.definitions.find((item) => item.id === country)!.name
                    : '対象国未選択'}
            </div>
            {SNS.map((action) => (
                <section className={styles.operation} key={action.id}>
                    <h3>{action.name}</h3>
                    <ValueRow label="必要資源" value={action.capacity} />
                    <ValueRow label="期間" value={`${action.duration}日`} />
                    <small>
                        {action.effects
                            .map(
                                (effect) =>
                                    `${METRIC_LABELS[effect.metric]}：${effect.amount > 0 ? '+' : ''}${effect.amount}/日`,
                            )
                            .join('　')}
                    </small>
                    {game.researched.includes(action.skill) && country ? (
                        <Allocation
                            key={`${action.id}-${country}`}
                            game={game}
                            kind="sns"
                            target={action.id}
                            country={country}
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
