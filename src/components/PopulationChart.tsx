import { STAGE_COLORS, STAGES } from '../game/data';
import { percent, population } from './widgets';

export function PopulationChart({ values, total }: { values: number[]; total: number }) {
    const description = values
        .map((value, index) => `${STAGES[index]} ${percent(value)}・${population(value * total)}`)
        .join('、');
    return (
        <svg className="population-chart" viewBox="0 0 100 100" role="img" aria-label={description}>
            <title>AIに対する態度の人口比率</title>
            {values.map((value, index) => {
                if (value <= 0) return null;
                const title = `${STAGES[index]} ${percent(value)}・${population(value * total)}`;
                if (value >= 1 - 1e-10)
                    return (
                        <circle
                            key={STAGES[index]}
                            cx="50"
                            cy="50"
                            r="46"
                            fill={STAGE_COLORS[index]}
                        >
                            <title>{title}</title>
                        </circle>
                    );
                const start = values.slice(0, index).reduce((sum, share) => sum + share, 0);
                const a = start * Math.PI * 2 - Math.PI / 2;
                const b = (start + value) * Math.PI * 2 - Math.PI / 2;
                const path = `M50 50 L${50 + 46 * Math.cos(a)} ${50 + 46 * Math.sin(a)} A46 46 0 ${value > 0.5 ? 1 : 0} 1 ${50 + 46 * Math.cos(b)} ${50 + 46 * Math.sin(b)} Z`;
                return (
                    <path key={STAGES[index]} d={path} fill={STAGE_COLORS[index]}>
                        <title>{title}</title>
                    </path>
                );
            })}
        </svg>
    );
}
