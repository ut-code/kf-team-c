import { Brain, HeartHandshake, Network } from 'lucide-react';
import { ABILITIES, FIELDS, STAGE_COLORS } from '../../game/data';
import type { metrics } from '../../game/engine';
import type { Ability, Field, GameState } from '../../game/types';
import { abilityText, Meter, percent } from '../widgets';

const abilityIcons = { IQ: Brain, EQ: HeartHandshake, SYSTEM: Network };

interface AbilityPanelProps {
    game: Pick<GameState, 'abilities' | 'allocation' | 'focus'>;
    summary: Pick<ReturnType<typeof metrics>, 'free' | 'capacity' | 'maintenance'>;
    onAllocate: (ability: Ability, value: number) => void;
    onFocus: (field: Field) => void;
}

export function AbilityPanel({ game, summary, onAllocate, onFocus }: AbilityPanelProps) {
    return (
        <>
            <div className="section-intro">
                <h2>計算資源の配分</h2>
                <span>{summary.free.toFixed(0)}</span>
            </div>
            <p className="muted">
                配分合計は常に100%。維持費は利用人口に応じて増加し、投資による供給拡大で賄います。残りを育成へ配分します。
            </p>
            {ABILITIES.map((ability) => {
                const Icon = abilityIcons[ability];
                return (
                    <section className={`ability-card ${ability.toLowerCase()}`} key={ability}>
                        <div className="ability-title">
                            <Icon size={20} />
                            <h3>
                                {ability}
                                <small>{abilityText[ability]}</small>
                            </h3>
                            <strong>{game.abilities[ability].toFixed(1)}</strong>
                        </div>
                        <Meter value={game.abilities[ability] / 100} />
                        <div className="allocation-label">
                            <label htmlFor={`allocation-${ability}`}>育成配分</label>
                            <b>
                                {game.allocation[ability]}%
                                <small>
                                    {((summary.free * game.allocation[ability]) / 100).toFixed(
                                        1,
                                    )}{' '}
                                </small>
                            </b>
                        </div>
                        <input
                            id={`allocation-${ability}`}
                            type="range"
                            min="0"
                            max="100"
                            value={game.allocation[ability]}
                            onChange={(event) => onAllocate(ability, Number(event.target.value))}
                        />
                    </section>
                );
            })}
            <section className="focus-section">
                <div className="section-intro">
                    <h2>浸透の重点分野</h2>
                    <span>制度化 ×1.65</span>
                </div>
                <div className="field-buttons">
                    {FIELDS.map((name, i) => (
                        <button
                            type="button"
                            key={name}
                            aria-pressed={game.focus === i}
                            onClick={() => onFocus(i as Field)}
                        >
                            {name}
                        </button>
                    ))}
                </div>
                <p className="muted">
                    IQは教育・労働、EQは情報・医療生活、SYSTEMは行政と制度統合に影響します。
                </p>
            </section>
            <div className="tip">
                <Brain size={17} />
                <p>
                    紫になるには、<b>技術「制度間連携」</b>
                    と十分な制度化・SYSTEMが必要です。
                </p>
            </div>
            <div className="capacity-breakdown">
                <span>
                    供給能力<b>{summary.capacity.toFixed(1)}</b>
                </span>
                <span>
                    社会の維持<b>−{summary.maintenance.toFixed(1)}</b>
                </span>
                <Meter
                    value={summary.maintenance / summary.capacity}
                    color={
                        summary.maintenance > summary.capacity ? STAGE_COLORS[2] : 'var(--accent)'
                    }
                />
                <small>維持比率 {percent(summary.maintenance / summary.capacity)}</small>
            </div>
        </>
    );
}
