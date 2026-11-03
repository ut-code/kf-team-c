import type { metrics } from '../../game/engine';
import { percent } from '../widgets';

export function WorldStats({ summary }: { summary: ReturnType<typeof metrics> }) {
    return (
        <section className="compact-stats glass" aria-label="世界の重要指標">
            <div className="domination-stat">
                <span>構造的依存</span>
                <strong>{percent(summary.stages[3])}</strong>
            </div>
            <div>
                <span>AI利用</span>
                <strong>{percent(summary.adoption)}</strong>
            </div>
            <div>
                <span>信頼</span>
                <strong>{percent(summary.trust)}</strong>
            </div>
            <div className={summary.coexistence >= 0.5 ? 'warning-text' : ''}>
                <span>自律回復制度</span>
                <strong>{percent(summary.coexistence)}</strong>
            </div>
            <div className={summary.stability < 0.3 ? 'warning-text' : ''}>
                <span>社会安定</span>
                <strong>{percent(summary.stability)}</strong>
            </div>
            <div
                className={summary.maintenance > summary.capacity ? 'warning-text' : ''}
                title={`供給 ${summary.capacity.toFixed(0)} − 維持 ${summary.maintenance.toFixed(0)}`}
            >
                <span>運用余力</span>
                <strong>{summary.free.toFixed(0)}</strong>
            </div>
        </section>
    );
}
