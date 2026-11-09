import { DEFEAT_OPPOSITION, VICTORY_DEPENDENCY } from '../game/data';
import { percent } from './widgets';

export function WorldMetricsWidget({
    values,
    paused,
    expanded,
    onToggle,
}: {
    values: { adoption: number; dependent: number; antiAI: number };
    paused: boolean;
    expanded: boolean;
    onToggle: () => void;
}) {
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
                <span
                    className="world-number dependency-number"
                    title={`AI依存 ${VICTORY_DEPENDENCY * 100}%で勝利`}
                >
                    <span>AI依存 / {VICTORY_DEPENDENCY * 100}%</span>
                    <strong>{percent(values.dependent)}</strong>
                </span>
                <span
                    className="world-number opposition-number"
                    title={`依存拒否 ${DEFEAT_OPPOSITION * 100}%で敗北`}
                >
                    <span>依存拒否 / {DEFEAT_OPPOSITION * 100}%</span>
                    <strong>{percent(values.antiAI)}</strong>
                </span>
            </button>
            {paused && (
                <span className="pause-label" role="status">
                    Paused
                </span>
            )}
        </div>
    );
}
