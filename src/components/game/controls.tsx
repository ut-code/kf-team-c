import { X } from 'lucide-react';
import { useId, useState } from 'react';
import flags from '../../game/data/ui/flags.json';
import type { GameState, Metric, Operation } from '../../game/types.ts';
import { useGameStore } from '../../state/gameStore';
import styles from '../GameApp.module.css';
import { Button, IconButton, Input, Select } from '../ui/Controls';

export const METRIC_LABELS: Record<Metric, string> = {
    infrastructure: 'インフラ',
    economy: '経済',
    politicalControl: '政治的統制',
    aiInfiltration: '浸透度',
    aiDecisionControl: '意思決定支配',
    aiCountermeasure: '対AI能力',
    aiAcceptance: 'AI受容度',
    aiAdoption: 'AI導入率',
    aiDependency: 'AI依存度',
    awareness: '警戒度',
};
export const STATUS_LABELS = {
    free: '未支配',
    infiltrated: '浸透中',
    controlled: '掌握済み',
    untouched: '未侵入',
    infiltrating: '侵入中',
    compromised: '限定アクセス',
    isolated: '隔離中',
};
export const number = (value: number) => value.toFixed(1);

export function CountryFlag({ id, name }: { id: string; name: string }) {
    const source = (flags as Record<string, string>)[id];
    return source ? <img className={styles.flag} src={source} alt={`${name}の国旗`} /> : null;
}
export function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <IconButton
            icon={X}
            label="閉じる"
            tone="accent"
            className={styles.close}
            onClick={onClick}
        />
    );
}
export function Allocation({
    game,
    kind,
    target,
    minimum = 1,
}: {
    game: GameState;
    kind: Operation['kind'];
    target: string;
    minimum?: number;
}) {
    const fieldId = useId();
    const operation = game.operations.find((op) => op.kind === kind && op.target === target);
    const [capacity, setCapacity] = useState(operation?.capacity ?? Math.max(4, minimum));
    const [priority, setPriority] = useState(operation?.priority ?? 50);
    const dispatch = useGameStore((state) => state.dispatch);
    return (
        <div className={styles.allocation} data-allocation={`${kind}-${target}`}>
            <label htmlFor={`${fieldId}-capacity`}>
                配分量
                <Input
                    id={`${fieldId}-capacity`}
                    aria-label={`${kind}-${target}-計算資源`}
                    type="number"
                    min={minimum}
                    max={10000}
                    value={capacity}
                    onChange={(event) => setCapacity(Number(event.target.value))}
                />
            </label>
            <label htmlFor={`${fieldId}-priority`}>
                優先度
                <Select
                    id={`${fieldId}-priority`}
                    aria-label={`${kind}-${target}-優先度`}
                    value={priority}
                    onChange={(event) => setPriority(Number(event.target.value))}
                >
                    <option value={90}>高</option>
                    <option value={50}>中</option>
                    <option value={10}>低</option>
                </Select>
            </label>
            <Button
                type="button"
                onClick={() =>
                    dispatch({ type: 'allocate', kind, target, capacity, priority })
                }
            >
                {operation ? '変更' : '実行'}
            </Button>
            {operation && (
                <Button
                    type="button"
                    onClick={() => dispatch({ type: 'cancel', id: operation.id })}
                >
                    中止
                </Button>
            )}
        </div>
    );
}
export function ValueRow({ label, value }: { label: string; value: string | number }) {
    return (
        <div className={styles.valueRow}>
            <span>{label}：</span>
            <strong>{value}</strong>
        </div>
    );
}
