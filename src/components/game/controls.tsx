import { X } from 'lucide-react';
import { useId, useState } from 'react';
import flags from '../../game/data/ui/flags.json';
import { computeMetrics } from '../../game/engine';
import type { CountryStateKey, GameState, Operation } from '../../game/types.ts';
import { useGameStore } from '../../state/gameStore';
import styles from '../GameApp.module.css';
import { Button, IconButton, Input, Select } from '../ui/Controls';

export const COUNTRY_STATE_LABELS: Record<CountryStateKey, string> = {
    infrastructure: 'インフラ',
    economy: '経済',
    governmentCapacity: '行政能力',
    aiDefenseTechnology: '対AI技術水準',
    aiExpectation: 'AIへの期待',
    awareness: '警戒度',
    aiDependency: 'AI依存度',
    aiDecisionControl: '意思決定支配',
};
export const STATUS_LABELS = {
    free: '未支配',
    influenced: '介入中',
    controlled: '掌握済み',
    untouched: '未侵入',
    infiltrating: '侵入中',
    compromised: '限定アクセス',
    isolated: '隔離中',
};
export const number = (value: number) => value.toFixed(1);
const operationLabels: Record<Operation['kind'], string> = {
    hack: '施設侵入',
    research: '研究',
    influence: '意思決定介入',
    defense: '監視・防衛',
    service: '公共サービス',
    sns: 'SNS作戦',
    upgrade: '設備増強',
    restore: '隔離復旧',
};

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
    game: gameState,
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
    const operation = gameState.operations.find((op) => op.kind === kind && op.target === target);
    const [capacity, setCapacity] = useState(String(operation?.capacity ?? Math.max(4, minimum)));
    const [priority, setPriority] = useState(operation?.priority ?? 50);
    const [feedback, setFeedback] = useState('');
    const dispatch = useGameStore((state) => state.dispatch);
    const available =
        computeMetrics(gameState).availableCapacity + (operation?.active ? operation.capacity : 0);
    const requested = Number(capacity);
    const error =
        !capacity.trim() || !Number.isFinite(requested) || requested < minimum || requested > 10000
            ? `${minimum}〜10000の数値を入力してください。`
            : requested > available + 1e-8
              ? `計算資源が${number(requested - available)}不足しています。他の配分を減らすか、供給を増やしてください。`
              : '';
    return (
        <div className={styles.allocationBox} data-allocation={`${kind}-${target}`}>
            <div className={styles.allocationStatus}>
                <strong data-active={operation?.active ?? true}>
                    {operation
                        ? operation.active
                            ? '稼働中'
                            : '供給不足で停止'
                        : '新しい資源配分'}
                </strong>
                <span>配分可能 {number(available)}</span>
            </div>
            <div className={styles.allocation}>
                <label htmlFor={`${fieldId}-capacity`}>
                    配分量
                    <Input
                        id={`${fieldId}-capacity`}
                        aria-label={`${operationLabels[kind]}の計算資源`}
                        aria-describedby={`${fieldId}-hint`}
                        aria-invalid={Boolean(error)}
                        type="number"
                        min={minimum}
                        max={10000}
                        step="any"
                        value={capacity}
                        onChange={(event) => {
                            setCapacity(event.target.value);
                            setFeedback('');
                        }}
                    />
                </label>
                <label htmlFor={`${fieldId}-priority`}>
                    優先度
                    <Select
                        id={`${fieldId}-priority`}
                        aria-label={`${operationLabels[kind]}の優先度`}
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
                    className={styles.allocationSubmit}
                    disabled={Boolean(error)}
                    onClick={() => {
                        dispatch({ type: 'allocate', kind, target, capacity: requested, priority });
                        const updated = useGameStore.getState().game!;
                        const applied = updated.operations.find(
                            (op) => op.kind === kind && op.target === target,
                        );
                        const lastLog = updated.logs.at(-1);
                        setFeedback(
                            applied?.capacity === requested && applied.priority === priority
                                ? '配分を反映しました。時間を進めると作戦が進行します。'
                                : (lastLog?.message ?? ''),
                        );
                    }}
                >
                    {operation ? '変更を反映' : '配分して開始'}
                </Button>
                {operation && (
                    <Button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'cancel', id: operation.id });
                            setFeedback('作戦を中止し、計算資源を解放しました。');
                        }}
                    >
                        中止
                    </Button>
                )}
            </div>
            <p
                id={`${fieldId}-hint`}
                className={styles.allocationHint}
                data-invalid={Boolean(error)}
                aria-live="polite"
            >
                {error || feedback || '優先度が高い作戦から、供給される資源を確保します。'}
            </p>
        </div>
    );
}
export function ValueRow({ label, value }: { label: string; value: string | number }) {
    return (
        <div className={styles.valueRow}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}
