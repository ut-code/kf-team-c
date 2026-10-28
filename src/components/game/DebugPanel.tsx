import { useState } from 'react';
import type { Balance, GameState, Metric } from '../../game/types.ts';
import type { Country } from '../../map/types';
import { useGameStore } from '../../state/gameStore';
import { Button, Input, Select } from '../ui/Controls';
import { METRIC_LABELS, number, ValueRow } from './controls';

export function DebugPanel({
    game,
    countries,
    selected,
    onRestart,
}: {
    game: GameState;
    countries: Country[];
    selected: string | null;
    onRestart: () => void;
}) {
    const dispatch = useGameStore((state) => state.dispatch);
    const [metric, setMetric] = useState<Metric>('aiInfiltration');
    const [value, setValue] = useState(75);
    const [seed, setSeed] = useState(game.seed);
    const settings: [keyof Balance, string, number][] = [
        ['secondsPerTick', '秒 / 日', 0.1],
        ['infiltrationSpeed', '浸透係数', 0.005],
        ['spillover', '波及係数', 0.001],
    ];
    return (
        <>
            <h2>設定</h2>
            <Button type="button" onClick={() => useGameStore.getState().step()}>
                1日進める
            </Button>
            {settings.map(([key, label, step]) => (
                <label key={key} htmlFor={`setting-${key}`}>
                    {label}
                    <Input
                        id={`setting-${key}`}
                        type="number"
                        min={step}
                        step={step}
                        value={game.config[key]}
                        onChange={(event) =>
                            dispatch({ type: 'config', key, value: Number(event.target.value) })
                        }
                    />
                </label>
            ))}
            <ValueRow
                label="停止作戦"
                value={`${number(game.shutdown)} / ${game.config.shutdownDays}`}
            />
            <h3>開発操作</h3>
            <small>
                {selected
                    ? game.definitions.find((item) => item.id === selected)!.name
                    : '対象国未選択'}
            </small>
            <Select
                aria-label="編集する数値"
                value={metric}
                onChange={(event) => setMetric(event.target.value as Metric)}
            >
                {(Object.keys(METRIC_LABELS) as Metric[]).map((key) => (
                    <option key={key} value={key}>
                        {METRIC_LABELS[key]}
                    </option>
                ))}
            </Select>
            <Input
                aria-label="開発用の数値"
                type="number"
                min={0}
                max={100}
                value={value}
                onChange={(event) => setValue(Number(event.target.value))}
            />
            <Button
                type="button"
                disabled={!selected}
                onClick={() =>
                    dispatch({ type: 'debug-country', country: selected!, metric, value })
                }
            >
                状態を変更
            </Button>
            <h3>再開始</h3>
            <label htmlFor="restart-seed">
                シード
                <Input
                    id="restart-seed"
                    aria-label="乱数シード"
                    type="number"
                    value={seed}
                    onChange={(event) => setSeed(Number(event.target.value))}
                />
            </label>
            <Button
                type="button"
                onClick={() => {
                    useGameStore.getState().initialize(countries, seed);
                    onRestart();
                }}
            >
                最初から
            </Button>
            <h3>履歴</h3>
            {[...game.logs].reverse().map((entry) => (
                <p key={JSON.stringify(entry)}>
                    <small>
                        {entry.tick}日・{entry.source}
                    </small>
                    {entry.message}
                </p>
            ))}
        </>
    );
}
