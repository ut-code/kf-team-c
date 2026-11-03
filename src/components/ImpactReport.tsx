import { X } from 'lucide-react';
import { STAGES } from '../game/data';
import type { Impact } from '../game/types';
export function ImpactReport({ impact, onDismiss }: { impact: Impact; onDismiss: () => void }) {
    const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
    return (
        <section className="impact-report glass" role="status" aria-label="施策の影響">
            <div className="panel-heading">
                <b>施策レポート</b>
                <button type="button" aria-label="施策レポートを閉じる" onClick={onDismiss}>
                    <X size={15} />
                </button>
            </div>
            <div className="impact-content">
                <strong>{impact.title}</strong>
                <p>{impact.detail}</p>
                <dl>
                    <div>
                        <dt>影響人口</dt>
                        <dd>{(impact.population / 1e6).toFixed(1)}百万人</dd>
                    </div>
                    <div>
                        <dt>段階が変化した人口</dt>
                        <dd>{(impact.transitions / 1e6).toFixed(1)}百万人</dd>
                    </div>
                    <div>
                        <dt>平均信頼</dt>
                        <dd>{signed(impact.trust)}</dd>
                    </div>
                    <div>
                        <dt>平均警戒</dt>
                        <dd>{signed(impact.vigilance)}</dd>
                    </div>
                </dl>
                {impact.transitionBreakdown.length > 0 && (
                    <p>
                        {impact.transitionBreakdown
                            .map(
                                (change) =>
                                    `${STAGES[change.from]}→${STAGES[change.to]} ${(change.population / 1e6).toFixed(1)}百万人`,
                            )
                            .join(' ／ ')}
                    </p>
                )}
                <small>実施直後の変化です。短期効果は自然回帰し、その後も社会が変化します。</small>
            </div>
        </section>
    );
}
