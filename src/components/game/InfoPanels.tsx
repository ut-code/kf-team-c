import { CATEGORIES, FACILITY_BY_ID, MODES } from '../../game/data.ts';
import { availableFacility, facilityCapacity, hackDifficulty } from '../../game/engine.ts';
import type { CountryState, GameState, Metric } from '../../game/types.ts';
import { useGameStore } from '../../state/gameStore';
import styles from '../GameApp.module.css';
import { Button, Select } from '../ui/Controls';
import {
    Allocation,
    CountryFlag,
    METRIC_LABELS,
    number,
    STATUS_LABELS,
    ValueRow,
} from './controls';
import { FacilityPhoto } from './FacilityPhoto';

export function CountryInfo({ game, country }: { game: GameState; country: CountryState }) {
    const definition = game.definitions.find((item) => item.id === country.id)!;
    return (
        <>
            <div className={styles.countryHeading}>
                <CountryFlag id={country.id} name={definition.name} />
                <div>
                    <h2>{definition.name}</h2>
                    <small>{STATUS_LABELS[country.controlStatus]}</small>
                </div>
            </div>
            <div className={styles.stats}>
                {(Object.keys(METRIC_LABELS) as Metric[]).map((metric) => (
                    <ValueRow
                        key={metric}
                        label={METRIC_LABELS[metric]}
                        value={`${number(country[metric])}${metric === 'aiAdoption' || metric === 'aiDependency' ? '%' : ''}`}
                    />
                ))}
            </div>
            <h3>公共サービス</h3>
            {country.id === 'JPN' || game.researched.includes('languages') ? (
                <Allocation
                    key={`${country.id}-service`}
                    game={game}
                    kind="service"
                    target={country.id}
                />
            ) : (
                <small>必要研究：多言語展開</small>
            )}
            <details>
                <summary>導入と依存</summary>
                <p>
                    導入率は社会での利用の広がり。依存度は停止したときの代替の難しさです。業務統合を研究すると依存が進みます。
                </p>
            </details>
            <h3>浸透工作</h3>
            <Allocation
                key={`${country.id}-infiltration`}
                game={game}
                kind="infiltration"
                target={country.id}
            />
            <h3>監視・防衛</h3>
            <Allocation
                key={`${country.id}-defense`}
                game={game}
                kind="defense"
                target={country.id}
            />
        </>
    );
}

export function FacilityInfo({ game, id }: { game: GameState; id: string }) {
    const definition = FACILITY_BY_ID[id],
        facility = game.facilities[id];
    const country = game.definitions.find((item) => item.id === definition.country)!;
    const dispatch = useGameStore((state) => state.dispatch);
    const operation = game.operations.find((item) => item.kind === 'hack' && item.target === id);
    const acquired = facility.status === 'controlled' || facility.status === 'compromised';
    return (
        <div data-facility={id}>
            <div className={styles.countryHeading}>
                <CountryFlag id={country.id} name={country.name} />
                <div>
                    <small>
                        {country.name}・{definition.location}
                    </small>
                    <h2>{definition.name}</h2>
                </div>
            </div>
            <div className={styles.facilityType}>
                {CATEGORIES[definition.category].name}
                <span>{STATUS_LABELS[facility.status]}</span>
            </div>
            <FacilityPhoto id={id} />
            <div className={styles.stats}>
                <ValueRow label="計算資源" value={number(facilityCapacity(game, id))} />
                <ValueRow label="露見度" value={number(facility.exposure)} />
                <ValueRow label="設備段階" value={`${facility.level} / 3`} />
            </div>
            {operation && (
                <ValueRow
                    label="侵入進捗"
                    value={`${number((operation.progress / game.config.hackWork) * 100)}%`}
                />
            )}
            {!acquired &&
                facility.status !== 'isolated' &&
                (availableFacility(game, id) ? (
                    <>
                        <ValueRow label="侵入難易度" value={number(hackDifficulty(game, id))} />
                        <Allocation game={game} kind="hack" target={id} />
                    </>
                ) : (
                    <div className={styles.requirement}>
                        必要研究：{definition.tier === 3 ? '深層制御' : '侵入経路解析'}
                    </div>
                ))}
            {acquired && (
                <>
                    {facility.status === 'compromised' && (
                        <Button
                            type="button"
                            className={styles.primaryAction}
                            disabled={definition.tier > 1 && !game.researched.includes('root')}
                            onClick={() => dispatch({ type: 'secure', target: id })}
                        >
                            制御権を確立
                        </Button>
                    )}
                    <h3>資源利用</h3>
                    <div className={styles.modeSwitch}>
                        {(Object.keys(MODES) as (keyof typeof MODES)[]).map((mode) => (
                            <Button
                                type="button"
                                key={mode}
                                aria-pressed={facility.mode === mode}
                                onClick={() => dispatch({ type: 'mode', target: id, mode })}
                            >
                                {MODES[mode].name}
                            </Button>
                        ))}
                    </div>
                    <h3>運用方針</h3>
                    <Select
                        className={styles.wideField}
                        aria-label="施設の運用方針"
                        value={facility.order}
                        onChange={(event) =>
                            dispatch({
                                type: 'order',
                                target: id,
                                order: event.target.value as 'support' | 'conceal' | 'disrupt',
                            })
                        }
                    >
                        <option value="support">稼働支援・介入</option>
                        <option value="conceal">潜伏</option>
                        <option value="disrupt">供給妨害</option>
                    </Select>
                    <div className={styles.effectList}>
                        {CATEGORIES[definition.category].effects.map((effect) => (
                            <ValueRow
                                key={effect.metric}
                                label={METRIC_LABELS[effect.metric]}
                                value={`${effect.amount > 0 ? '+' : ''}${effect.amount} / 日`}
                            />
                        ))}
                    </div>
                    {game.researched.includes('distributed') && facility.level < 3 && (
                        <>
                            <h3>設備増強</h3>
                            <Allocation game={game} kind="upgrade" target={id} />
                        </>
                    )}
                </>
            )}
            {facility.status === 'isolated' && (
                <>
                    <ValueRow label="隔離の残り日数" value={`${facility.isolation}日`} />
                    {game.researched.includes('distributed') && (
                        <Allocation game={game} kind="restore" target={id} />
                    )}
                </>
            )}
        </div>
    );
}
