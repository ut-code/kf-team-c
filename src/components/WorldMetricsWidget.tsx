import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { useContinuousValue } from './ContinuousProgress';
import { percent } from './widgets';

export function WorldMetricsWidget({
    values,
    paused,
    expanded,
    onToggle,
    countermeasureProgress,
    nextCountermeasureProgress,
    countermeasuresOpen,
    onCountermeasures,
}: {
    values: { adoption: number; dependent: number; antiAI: number };
    paused: boolean;
    expanded: boolean;
    onToggle: () => void;
    countermeasureProgress: number | null;
    nextCountermeasureProgress: number;
    countermeasuresOpen: boolean;
    onCountermeasures: () => void;
}) {
    const protection = useContinuousValue(countermeasureProgress ?? 0, nextCountermeasureProgress);
    return (
        <div className="world-metrics-widget">
            <button
                type="button"
                className="world-hud glass"
                aria-label="世界全体の状態を表示"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls="population-details"
            >
                <span className="world-number">
                    <span>AI利用</span>
                    <strong>{percent(values.adoption)}</strong>
                </span>
                <span className="world-number dependency-number" title="世界のAI依存率100%で勝利">
                    <span>AI依存 / 100%</span>
                    <strong>{percent(values.dependent)}</strong>
                </span>
                <span className="world-number opposition-number" title="世界の利用拒否率100%で敗北">
                    <span>利用拒否 / 100%</span>
                    <strong>{percent(values.antiAI)}</strong>
                </span>
            </button>
            {paused && (
                <span className="pause-label" role="status">
                    Paused
                </span>
            )}
            {countermeasureProgress !== null && (
                <button
                    type="button"
                    className="countermeasure-trigger glass"
                    aria-label="人間による制御の詳細"
                    title="100%で人間の管理下に置かれ、敗北"
                    aria-expanded={countermeasuresOpen}
                    onClick={onCountermeasures}
                >
                    <span>
                        <ShieldCheck size={15} />
                        人間による制御
                    </span>
                    <strong>
                        {countermeasureProgress >= 0.75 && (
                            <TriangleAlert size={13} aria-label="人間による制御が完成間近です" />
                        )}
                        {Math.floor(protection * 100)}%
                    </strong>
                    <progress aria-label="制御技術の完成度" max={1} value={protection} />
                </button>
            )}
        </div>
    );
}
