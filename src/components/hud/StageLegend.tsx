import { STAGE_COLORS, STAGES } from '../../game/data';

export function StageLegend() {
    return (
        <div className="map-legend glass">
            {STAGES.map((label, i) => (
                <span key={label}>
                    <i style={{ background: STAGE_COLORS[i] }} />
                    {label}
                </span>
            ))}
        </div>
    );
}
