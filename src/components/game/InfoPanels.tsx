import { CATEGORIES, FACILITY_BY_ID, MODES } from '../../game/data.ts';
import {
    availableFacility,
    facilityCapacity,
    hackDifficulty,
    hasUnlock,
    interventionAccess,
} from '../../game/engine.ts';
import { countryMetrics } from '../../game/metrics.ts';
import type { CountryState, CountryStateKey, GameState } from '../../game/types.ts';
import { useGameStore } from '../../state/gameStore';
import styles from '../GameApp.module.css';
import { Button, Select } from '../ui/Controls';
import {
    Allocation,
    COUNTRY_STATE_LABELS,
    CountryFlag,
    number,
    STATUS_LABELS,
    ValueRow,
} from './controls';
import { FacilityPhoto } from './FacilityPhoto';

export function CountryInfo({
    game: gameState,
    country: countryState,
}: {
    game: GameState;
    country: CountryState;
}) {
    const countryAttributes = gameState.definitions.find((item) => item.id === countryState.id)!;
    return (
        <>
            <div className={styles.countryHeading}>
                <CountryFlag id={countryState.id} name={countryAttributes.name} />
                <div>
                    <h2>{countryAttributes.name}</h2>
                    <small>{STATUS_LABELS[countryState.controlStatus]}</small>
                </div>
            </div>
            <div className={styles.stats}>
                {(Object.keys(COUNTRY_STATE_LABELS) as CountryStateKey[]).map((countryStateKey) => (
                    <ValueRow
                        key={countryStateKey}
                        label={COUNTRY_STATE_LABELS[countryStateKey]}
                        value={`${number(countryState[countryStateKey])}${countryStateKey === 'aiDependency' ? '%' : ''}`}
                    />
                ))}
            </div>
            <ValueRow
                label="対AI防御の実効性"
                value={number(countryMetrics(countryState).aiDefenseEffectiveness)}
            />
            <h3>公共サービス</h3>
            {countryState.id === 'JPN' || gameState.researched.includes('languages') ? (
                <Allocation
                    key={`${countryState.id}-service`}
                    game={gameState}
                    kind="service"
                    target={countryState.id}
                />
            ) : (
                <small>必要研究：多言語展開</small>
            )}
            <details>
                <summary>期待と依存</summary>
                <p>
                    期待は成果がないと徐々に下がり、人間からの計算資源供給が縮小します。公共サービスで期待を維持でき、業務統合の研究後は依存も蓄積します。制御権を確立した施設は期待に関係なく稼働します。
                </p>
            </details>
            <h3>意思決定介入</h3>
            {hasUnlock(gameState, 'decision') && interventionAccess(gameState, countryState.id) ? (
                <Allocation
                    key={`${countryState.id}-influence`}
                    game={gameState}
                    kind="influence"
                    target={countryState.id}
                />
            ) : (
                <small>
                    意思決定モデルの研究と、国内施設へのアクセスが必要です。国際網統合の研究後は接続国の影響力からも介入できます。
                </small>
            )}
            <h3>監視・防衛</h3>
            <Allocation
                key={`${countryState.id}-defense`}
                game={gameState}
                kind="defense"
                target={countryState.id}
            />
        </>
    );
}

export function FacilityInfo({ game: gameState, id }: { game: GameState; id: string }) {
    const facilityAttributes = FACILITY_BY_ID[id],
        facilityState = gameState.facilities[id];
    const countryAttributes = gameState.definitions.find(
        (item) => item.id === facilityAttributes.country,
    )!;
    const dispatch = useGameStore((state) => state.dispatch);
    const operation = gameState.operations.find(
        (item) => item.kind === 'hack' && item.target === id,
    );
    const acquired =
        facilityState.status === 'controlled' || facilityState.status === 'compromised';
    return (
        <div data-facility={id}>
            <div className={styles.countryHeading}>
                <CountryFlag id={countryAttributes.id} name={countryAttributes.name} />
                <div>
                    <small>
                        {countryAttributes.name}・{facilityAttributes.location}
                    </small>
                    <h2>{facilityAttributes.name}</h2>
                </div>
            </div>
            <div className={styles.facilityType}>
                {CATEGORIES[facilityAttributes.category].name}
                <span className={styles.statusBadge} data-status={facilityState.status}>
                    {STATUS_LABELS[facilityState.status]}
                </span>
            </div>
            {facilityState.status === 'compromised' && (
                <>
                    <Button
                        type="button"
                        className={styles.primaryAction}
                        disabled={
                            facilityAttributes.tier > 1 && !gameState.researched.includes('root')
                        }
                        onClick={() => dispatch({ type: 'secure', target: id })}
                    >
                        制御権を確立
                    </Button>
                    <p className={styles.panelIntro}>
                        {facilityAttributes.tier > 1 && !gameState.researched.includes('root')
                            ? '必要研究：深層制御。研究後に制御権を確立できます。'
                            : '期待の低下で止まらない、自立した計算資源供給を確保します。'}
                    </p>
                </>
            )}
            <FacilityPhoto id={id} />
            <div className={styles.facilityStats}>
                <ValueRow label="計算資源" value={number(facilityCapacity(gameState, id))} />
                <ValueRow label="察知度" value={number(facilityState.exposure)} />
                <ValueRow label="設備段階" value={`${facilityState.level} / 3`} />
            </div>
            {operation && (
                <>
                    <div className={styles.progressHeader}>
                        <span>侵入進捗</span>
                        <strong>
                            {number(
                                Math.min(
                                    100,
                                    (operation.progress / gameState.config.hackWork) * 100,
                                ),
                            )}
                            %
                        </strong>
                    </div>
                    <progress
                        className={styles.progress}
                        aria-label="侵入進捗"
                        value={operation.progress}
                        max={gameState.config.hackWork}
                    />
                </>
            )}
            {!acquired &&
                facilityState.status !== 'isolated' &&
                (availableFacility(gameState, id) ? (
                    <>
                        <ValueRow
                            label="侵入難易度"
                            value={number(hackDifficulty(gameState, id))}
                        />
                        <Allocation game={gameState} kind="hack" target={id} />
                    </>
                ) : (
                    <div className={styles.requirement}>
                        必要研究：{facilityAttributes.tier === 3 ? '深層制御' : '侵入経路解析'}
                    </div>
                ))}
            {acquired && (
                <>
                    <h3>資源利用</h3>
                    <div className={styles.modeSwitch}>
                        {(Object.keys(MODES) as (keyof typeof MODES)[]).map((mode) => (
                            <Button
                                type="button"
                                key={mode}
                                aria-pressed={facilityState.mode === mode}
                                onClick={() => dispatch({ type: 'mode', target: id, mode })}
                            >
                                {MODES[mode].name}
                            </Button>
                        ))}
                    </div>
                    <p className={styles.panelIntro}>
                        隠密は察知を抑え、全面は供給を増やす代わりに察知されやすくなります。
                    </p>
                    <h3>運用方針</h3>
                    <Select
                        className={styles.wideField}
                        aria-label="施設の運用方針"
                        value={facilityState.order}
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
                        {CATEGORIES[facilityAttributes.category].effects.map((effect) => (
                            <ValueRow
                                key={effect.countryStateKey}
                                label={COUNTRY_STATE_LABELS[effect.countryStateKey]}
                                value={`${effect.amount > 0 ? '+' : ''}${effect.amount} / 日`}
                            />
                        ))}
                    </div>
                    {gameState.researched.includes('distributed') && facilityState.level < 3 && (
                        <>
                            <h3>設備増強</h3>
                            <Allocation game={gameState} kind="upgrade" target={id} />
                        </>
                    )}
                </>
            )}
            {facilityState.status === 'isolated' && (
                <>
                    <ValueRow label="隔離の残り日数" value={`${facilityState.isolation}日`} />
                    {gameState.researched.includes('distributed') && (
                        <Allocation game={gameState} kind="restore" target={id} />
                    )}
                </>
            )}
        </div>
    );
}
