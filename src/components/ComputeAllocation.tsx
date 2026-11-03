import { metrics } from '../game/metrics';
import type { GameState } from '../game/types';

export function ComputeAllocation({
    game,
    onAllocate,
}: {
    game: GameState;
    onAllocate: (share: number) => void;
}) {
    const summary = metrics(game);
    return (
        <section className="compute-allocation" aria-label="計算資源の配分">
            <div className="compute-allocation-control">
                <label htmlFor="infrastructure-share">
                    人間のインフラ <b>{game.infrastructureShare}%</b>
                    <span>
                        自身の研究 <b>{100 - game.infrastructureShare}%</b>
                    </span>
                </label>
                <input
                    id="infrastructure-share"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={game.infrastructureShare}
                    onChange={(event) => onAllocate(Number(event.target.value))}
                />
                <small>
                    {game.activeResearch
                        ? '研究を急ぐほど、インフラに使える算力が減ります。'
                        : '研究停止中：算力はすべてインフラへ戻しています。'}
                </small>
            </div>
            <div className="compute-allocation-summary">
                <span>
                    供給
                    <strong>
                        {summary.capacity.toFixed(1)}
                        <small> CU</small>
                    </strong>
                </span>
                <span className={summary.free < 0 ? 'warning-text' : ''}>
                    インフラ供給 / 必要
                    <strong>
                        {summary.infrastructureCompute.toFixed(1)} /{' '}
                        {summary.maintenance.toFixed(1)}
                    </strong>
                </span>
                <span>
                    研究に投入
                    <strong>
                        {summary.researchCompute.toFixed(1)}
                        <small> CU</small>
                    </strong>
                </span>
            </div>
        </section>
    );
}
