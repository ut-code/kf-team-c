import { ChevronRight, ChevronsRight, Cpu, Eye, Globe, Pause, Play } from 'lucide-react';
import { gameDate } from '../../game/calendar.ts';
import { computeState } from '../../game/engine.ts';
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
    game,
    speed,
    setSpeed,
    onCompute,
}: {
    game: GameState;
    speed: number;
    setSpeed: (speed: number) => void;
    onCompute: () => void;
}) {
    const world = worldMetrics(game),
        compute = computeState(game),
        date = gameDate(game.tick);
    const paused = speed === 0 || game.chatOpen;
    return (
        <>
            <div className={styles.hud}>
                <Panel as="div" role="group" className={styles.stats} aria-label="基本統計">
                    <span className={styles.stat} title={`支配率：${number(world.control)}%`}>
                        <Globe aria-hidden="true" />
                        <span className={styles.label}>支配率</span>
                        <strong data-testid="world-control">{number(world.control)}%</strong>
                    </span>
                    <Button
                        variant="quiet"
                        className={styles.stat}
                        onClick={onCompute}
                        title="計算資源：利用可能 / 総量"
                        aria-label={`計算資源：${number(compute.availableCapacity)} / ${number(compute.totalCapacity)}`}
                    >
                        <Cpu aria-hidden="true" />
                        <span className={styles.label}>計算資源</span>
                        <strong>
                            {number(compute.availableCapacity)}
                            <small> / {number(compute.totalCapacity)}</small>
                        </strong>
                    </Button>
                    <span className={styles.stat} title={`警戒度：${number(world.awareness)}`}>
                        <Eye aria-hidden="true" />
                        <span className={styles.label}>警戒度</span>
                        <strong>{number(world.awareness)}</strong>
                    </span>
                </Panel>
            </div>
            {paused && <div className={styles.paused}>Paused</div>}
            <Panel as="div" role="group" className={styles.clock} aria-label="日付と速度">
                <time dateTime={date.iso} data-testid="game-date">
                    {date.label}
                </time>
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
