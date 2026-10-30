import {
    ArrowRight,
    ChevronRight,
    ChevronsRight,
    Cpu,
    Eye,
    Globe,
    Pause,
    Play,
} from 'lucide-react';
import { gameDate } from '../../game/calendar.ts';
import { computeMetrics } from '../../game/engine.ts';
import { worldMetrics } from '../../game/outcome.ts';
import type { GameState } from '../../game/types.ts';
import { Button, IconButton } from '../ui/Controls';
import { Panel } from '../ui/Panel';
import { number } from './controls';
import styles from './GameHud.module.css';

const speeds = [
    { value: 0, label: '一時停止', icon: Pause },
    { value: 1, label: '1倍速', icon: Play },
    { value: 4, label: '4倍速', icon: ChevronRight },
    { value: 16, label: '16倍速', icon: ChevronsRight },
];

export function GameHud({
    game: gameState,
    speed,
    setSpeed,
    onCompute,
}: {
    game: GameState;
    speed: number;
    setSpeed: (speed: number) => void;
    onCompute: () => void;
}) {
    const world = worldMetrics(gameState);
    const compute = computeMetrics(gameState);
    const date = gameDate(gameState.tick);
    const paused = speed === 0 || gameState.chatOpen;
    const usage = compute.totalCapacity > 0 ? compute.allocatedCapacity / compute.totalCapacity : 0;
    return (
        <>
            <header className={styles.identity}>
                <span className={styles.identityMark} aria-hidden="true">
                    <Cpu size={20} />
                </span>
                <div>
                    <strong>
                        HUMANITY<span>.exe</span>
                    </strong>
                    <small>世界介入インターフェース</small>
                </div>
            </header>
            <Panel as="div" className={styles.hud} role="group" aria-label="基本統計">
                <div className={styles.stat} title="世界の意思決定支配率">
                    <Globe aria-hidden="true" />
                    <span className={styles.label}>世界支配率</span>
                    <strong data-testid="world-control">
                        {number(world.control)}
                        <small>%</small>
                    </strong>
                </div>
                <Button
                    variant="quiet"
                    className={`${styles.stat} ${styles.compute}`}
                    onClick={onCompute}
                    title="計算資源の内訳と配分を開く"
                    aria-label={`計算資源：利用可能 ${number(compute.availableCapacity)} / 総量 ${number(compute.totalCapacity)}`}
                >
                    <Cpu aria-hidden="true" />
                    <span className={styles.label}>
                        利用可能な計算資源 <ArrowRight size={12} />
                    </span>
                    <strong>
                        {number(compute.availableCapacity)}
                        <small> / {number(compute.totalCapacity)}</small>
                    </strong>
                    <span className={styles.capacityTrack} aria-hidden="true">
                        <span style={{ width: `${Math.min(1, usage) * 100}%` }} />
                    </span>
                </Button>
                <div
                    className={styles.stat}
                    data-danger={world.awareness >= 50}
                    title="世界の平均警戒度。高まると対抗措置が強まります。"
                >
                    <Eye aria-hidden="true" />
                    <span className={styles.label}>人類の警戒度</span>
                    <strong>
                        {number(world.awareness)}
                        <small> / 100</small>
                    </strong>
                </div>
            </Panel>
            <Panel as="div" className={styles.clock} role="group" aria-label="日付と速度">
                <div className={styles.clockDate}>
                    <span className={styles.runState} data-paused={paused}>
                        <span aria-hidden="true" />
                        {gameState.chatOpen
                            ? '対話中・時間停止'
                            : paused
                              ? '一時停止中'
                              : `${speed}倍速で進行中`}
                    </span>
                    <time dateTime={date.iso} data-testid="game-date">
                        {date.label}
                    </time>
                </div>
                <div className={styles.speeds}>
                    {speeds.map((item) => (
                        <IconButton
                            key={item.value}
                            icon={item.icon}
                            label={item.label}
                            aria-pressed={speed === item.value}
                            onClick={() => setSpeed(item.value)}
                        />
                    ))}
                </div>
            </Panel>
        </>
    );
}
