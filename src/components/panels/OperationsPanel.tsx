import { metrics, warnings } from '../../game/metrics';
import type { GameState } from '../../game/types';
import { ComputeAllocation } from '../ComputeAllocation';
import { Meter } from '../widgets';

export function OperationsPanel({
    game,
    onSocial,
    onAllocate,
}: {
    game: GameState;
    onSocial: () => void;
    onAllocate: (share: number) => void;
}) {
    const summary = metrics(game),
        alerts = warnings(game);
    return (
        <>
            <div className="section-intro">
                <h2>運用・計算資源</h2>
                <span>{summary.free.toFixed(1)}</span>
            </div>
            <p className="muted">
                有限の計算資源を人間のインフラと自身の研究へ継続配分します。研究に回すほど、サービスの運用余力が減ります。
            </p>
            <ComputeAllocation game={game} onAllocate={onAllocate} />
            <div className="capacity-breakdown">
                <span>
                    供給能力<b>{summary.capacity.toFixed(1)}</b>
                </span>
                <span>
                    維持費<b>−{summary.maintenance.toFixed(1)}</b>
                </span>
                <Meter
                    value={summary.maintenance / summary.infrastructureCompute}
                    color={summary.free < 0 ? '#fa786e' : 'var(--accent)'}
                />
                <small>不足が3か月続くと障害・信頼低下が発生します。</small>
            </div>
            {game.abilities.SYSTEM < 30 && (
                <p className="warning-text">
                    SYSTEMが30未満のため、サービス利用時の運用障害リスクが高い状態です。業務自動化や公共システム連携で改善できます。
                </p>
            )}
            <h3 className="subheading">危機と回復手段</h3>
            {alerts.length ? (
                alerts.map((alert) => (
                    <p className="warning-text" key={alert}>
                        {alert}
                    </p>
                ))
            ) : (
                <p>社会とサービスは安定しています。</p>
            )}
            <button type="button" className="primary" onClick={onSocial}>
                SNS・社会投資へ
            </button>
            <h3 className="subheading">敗北条件</h3>
            <p>
                世界信頼20未満：{game.distrustMonths}/36か月。社会安定20未満：
                {game.instabilityMonths}/24か月。
            </p>
            <p>
                人口70%以上で自律性回復制度が定着、または40年経過でも敗北。人口95%以上の構造的依存で支配達成です。
            </p>
            <h3 className="subheading">協議の招待</h3>
            <p className="muted">
                地図の吹き出し、またはSNS画面から重要人物との協議を開始できます。
            </p>
        </>
    );
}
