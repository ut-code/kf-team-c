import {
    Activity,
    ArrowRight,
    Brain,
    ChevronRight,
    CircleHelp,
    Globe2,
    HeartHandshake,
    MessageCircle,
    Network,
    Radio,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    ABILITIES,
    AREAS,
    COUNTRY_STATISTICS,
    FIELDS,
    REGIONS,
    STAGE_COLORS,
    STAGES,
    START_YEAR,
    STATISTICS_YEAR,
} from '../game/data';
import { generation, metrics } from '../game/engine';
import type { Field } from '../game/types';
import { mapScene } from '../map/config';
import { WORLD_WIDTH } from '../map/geometry';
import type { MapMarker, MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { GameClock } from './GameClock';
import { Brief, Research, Result } from './GameOverlays';
import { WorldMap } from './WorldMap';
import { abilityText, Meter, percent } from './widgets';

const date = (month: number) =>
    `${START_YEAR + Math.floor(month / 12)}.${String((month % 12) + 1).padStart(2, '0')}`;
const abilityIcons = { IQ: Brain, EQ: HeartHandshake, SYSTEM: Network };
export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const [tab, setTab] = useState<'ability' | 'research' | 'area' | null>(null);
    const selectedArea = useMapStore((state) => state.selectedAreaId);
    const setSelectedArea = useMapStore((state) => state.selectArea);
    const [region, setRegion] = useState('すべて');
    const [help, setHelp] = useState(false);
    const [newsOpen, setNewsOpen] = useState(false);
    const [hidden, setHidden] = useState(document.hidden);
    const selectedMarker = useMapStore((state) => state.selectedMarkerId);
    const summary = useMemo(() => metrics(game), [game]);
    const blocked = !game.started || game.outcome !== 'playing' || help || hidden;
    const markers = useMemo<MapMarker[]>(
        () => [
            ...game.points.map(
                (point): MapMarker => ({
                    id: String(point.id),
                    kind: 'population',
                    area: point.area,
                    stage: point.stage,
                    longitude: (point.x / WORLD_WIDTH) * 360 - 180,
                    latitude:
                        ((2 *
                            Math.atan(
                                Math.exp(
                                    Math.log(Math.tan(Math.PI / 4 + (75 * Math.PI) / 360)) -
                                        (point.y * 2 * Math.PI) / WORLD_WIDTH,
                                ),
                            ) -
                            Math.PI / 2) *
                            180) /
                        Math.PI,
                    label: `${AREAS[point.area].name}・${['年少世代', '15–64歳', '高齢世代', '年齢未収録'][generation(point.age)]}・${FIELDS[point.field]}・${STAGES[point.stage]}`,
                }),
            ),
            ...game.availableChats.map(
                (chat): MapMarker => ({
                    id: `chat-${chat.id}`,
                    kind: 'conversation',
                    area: chat.area,
                    stage: 0,
                    longitude: AREAS[chat.area].longitude,
                    latitude: AREAS[chat.area].latitude,
                    label: `${AREAS[chat.area].name}・${chat.person}と会話を開始`,
                }),
            ),
        ],
        [game.points, game.availableChats],
    );
    useEffect(() => {
        useMapStore.getState().setMarkers(markers);
    }, [markers]);
    useEffect(() => {
        if (selectedMarker === null) return;
        if (selectedMarker.startsWith('chat-')) {
            useGameStore.getState().openChat(Number(selectedMarker.slice(5)));
            return;
        }
        const point = useGameStore.getState().game!.points[Number(selectedMarker)];
        if (point) {
            setSelectedArea(point.area);
            setTab('area');
        }
    }, [selectedMarker, setSelectedArea]);
    useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setTab(null);
                setSelectedArea(null);
                setHelp(false);
                useGameStore.getState().closeChat();
                useMapStore.getState().selectMarker(null);
                return;
            }
            if (
                event.target instanceof HTMLElement &&
                event.target.closest('input, select, button, textarea')
            )
                return;
            if (event.code === 'Space' && game.started && !blocked) {
                event.preventDefault();
                useGameStore.getState().speed(game.speed === 0 ? 1 : 0);
            }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [game.speed, game.started, blocked, setSelectedArea]);
    const areaIndex = selectedArea ?? 28;
    const area = game.areas[areaIndex],
        definition = AREAS[areaIndex],
        local = summary.areas[areaIndex];
    const selectedPoint =
        selectedMarker === null || selectedMarker.startsWith('chat-')
            ? null
            : game.points[Number(selectedMarker)];
    const closeChat = () => {
        useGameStore.getState().closeChat();
        useMapStore.getState().selectMarker(null);
    };
    const restart = () => {
        useMapStore.getState().selectMarker(null);
        useMapStore.getState().selectArea(null);
        setSelectedArea(null);
        setTab(null);
        useGameStore.getState().initialize(game.seed + 1);
    };
    const togglePanel = (value: 'ability' | 'research' | 'area') =>
        setTab((current) => (current === value ? null : value));
    return (
        <main className="game-shell">
            <div className="map-background">
                <WorldMap
                    regions={regions}
                    {...mapScene}
                    selectedArea={selectedArea}
                    onAreaSelect={(index) => {
                        setSelectedArea(index);
                        setTab('area');
                    }}
                    initialLongitude={0}
                    trafficSpeed={blocked ? 0 : game.speed}
                    trafficTick={game.month}
                />
            </div>
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
                    <span>共存制度</span>
                    <strong>{percent(summary.coexistence)}</strong>
                </div>
                <div
                    className={summary.maintenance > summary.capacity ? 'warning-text' : ''}
                    title={`供給 ${summary.capacity.toFixed(0)} − 維持 ${summary.maintenance.toFixed(0)}`}
                >
                    <span>育成資源</span>
                    <strong>{summary.free.toFixed(0)}</strong>
                </div>
            </section>
            <section
                className={`news-overlay glass ${newsOpen ? 'expanded' : ''}`}
                aria-label="ニュース"
            >
                <button
                    type="button"
                    className="news-toggle"
                    aria-expanded={newsOpen}
                    onClick={() => setNewsOpen(!newsOpen)}
                >
                    <Radio size={14} />
                    <span>ニュース</span>
                    <small>{game.news.length}</small>
                    <ChevronRight size={14} />
                </button>
                <div className="news-items">
                    {game.news.slice(0, newsOpen ? 30 : 3).map((news) => (
                        <article className={`news-item ${news.kind}`} key={news.id}>
                            <time>{date(news.month)}</time>
                            <b>{news.title}</b>
                            {newsOpen && <p>{news.detail}</p>}
                        </article>
                    ))}
                </div>
            </section>
            <GameClock key={game.seed} blocked={blocked} />
            <nav className="game-actions" aria-label="ゲームの操作">
                <button
                    type="button"
                    className="glass"
                    aria-expanded={tab === 'ability'}
                    onClick={() => togglePanel('ability')}
                >
                    <Activity size={18} />
                    能力配分
                </button>
                <button
                    type="button"
                    className="glass"
                    aria-expanded={tab === 'research'}
                    onClick={() => togglePanel('research')}
                >
                    <Network size={18} />
                    スキルツリー<small>{Math.floor(game.research)} RP</small>
                </button>
                <button
                    type="button"
                    className="glass"
                    aria-expanded={tab === 'area'}
                    onClick={() => togglePanel('area')}
                >
                    <Globe2 size={18} />
                    小地域
                </button>
                <button
                    type="button"
                    className="glass icon-button"
                    aria-label="遊び方を表示"
                    onClick={() => setHelp(true)}
                >
                    <CircleHelp size={18} />
                </button>
            </nav>
            <div className="map-legend glass">
                {STAGES.map((label, i) => (
                    <span key={label}>
                        <i style={{ background: STAGE_COLORS[i] }} />
                        {label}
                    </span>
                ))}
            </div>
            {tab && (
                <aside className="floating-panel glass" aria-label="操作パネル">
                    <div className="panel-heading">
                        <span>
                            {tab === 'ability'
                                ? '能力配分'
                                : tab === 'research'
                                  ? 'スキルツリー'
                                  : '小地域'}
                        </span>
                        <button
                            type="button"
                            aria-label="操作パネルを閉じる"
                            onClick={() => {
                                setTab(null);
                                setSelectedArea(null);
                                useMapStore.getState().selectMarker(null);
                            }}
                        >
                            <X size={17} />
                        </button>
                    </div>
                    <div className="panel-scroll">
                        {tab === 'ability' && (
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
                                        <section
                                            className={`ability-card ${ability.toLowerCase()}`}
                                            key={ability}
                                        >
                                            <div className="ability-title">
                                                <Icon size={20} />
                                                <h3>
                                                    {ability}
                                                    <small>{abilityText[ability]}</small>
                                                </h3>
                                                <strong>
                                                    {game.abilities[ability].toFixed(1)}
                                                </strong>
                                            </div>
                                            <Meter value={game.abilities[ability] / 100} />
                                            <div className="allocation-label">
                                                <label htmlFor={`allocation-${ability}`}>
                                                    育成配分
                                                </label>
                                                <b>
                                                    {game.allocation[ability]}%
                                                    <small>
                                                        {(
                                                            (summary.free *
                                                                game.allocation[ability]) /
                                                            100
                                                        ).toFixed(1)}{' '}
                                                    </small>
                                                </b>
                                            </div>
                                            <input
                                                id={`allocation-${ability}`}
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={game.allocation[ability]}
                                                onChange={(event) =>
                                                    useGameStore
                                                        .getState()
                                                        .allocate(
                                                            ability,
                                                            Number(event.target.value),
                                                        )
                                                }
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
                                                onClick={() =>
                                                    useGameStore.getState().focus(i as Field)
                                                }
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
                                            summary.maintenance > summary.capacity
                                                ? STAGE_COLORS[2]
                                                : 'var(--accent)'
                                        }
                                    />
                                    <small>
                                        維持比率 {percent(summary.maintenance / summary.capacity)}
                                    </small>
                                </div>
                            </>
                        )}
                        {tab === 'research' && <Research game={game} />}
                        {tab === 'area' && (
                            <>
                                <div className="section-intro">
                                    <h2>小地域の状況</h2>
                                    <span>37 AREAS</span>
                                </div>
                                <div className="area-select">
                                    <label htmlFor="region">大地域</label>
                                    <select
                                        id="region"
                                        value={region}
                                        onChange={(event) => setRegion(event.target.value)}
                                    >
                                        <option>すべて</option>
                                        {REGIONS.map((name) => (
                                            <option key={name}>{name}</option>
                                        ))}
                                    </select>
                                    <label htmlFor="area">小地域</label>
                                    <select
                                        id="area"
                                        value={areaIndex}
                                        onChange={(event) => {
                                            setSelectedArea(Number(event.target.value));
                                            useMapStore.getState().selectMarker(null);
                                        }}
                                    >
                                        <option value={areaIndex} hidden>
                                            {definition.name}
                                        </option>
                                        {AREAS.map((item, i) =>
                                            region === 'すべて' || item.region === region ? (
                                                <option key={item.id} value={i}>
                                                    {item.name}
                                                </option>
                                            ) : null,
                                        )}
                                    </select>
                                </div>
                                <div className="area-title">
                                    <span>{definition.region}</span>
                                    <h2>{definition.name}</h2>
                                    <small>
                                        人口 約{(definition.population / 100).toFixed(2)}億人 ·{' '}
                                        {local.count}集団
                                    </small>
                                </div>
                                <div className="area-metrics">
                                    <span>
                                        信頼<b>{percent(area.trust)}</b>
                                    </span>
                                    <span>
                                        反発<b>{percent(area.resistance)}</b>
                                    </span>
                                    <span>
                                        共存制度<b>{percent(area.coexistence)}</b>
                                    </span>
                                    <span>
                                        構造的依存<b>{percent(local.stages[3])}</b>
                                    </span>
                                </div>
                                <h3 className="subheading">
                                    分野ごとの制度化<span>72%から構造的依存が進行</span>
                                </h3>
                                <div className="institutions">
                                    {FIELDS.map((field, i) => (
                                        <div key={field}>
                                            <span>
                                                {field}
                                                <b>{percent(area.institutions[i])}</b>
                                            </span>
                                            <Meter
                                                value={area.institutions[i]}
                                                color={
                                                    area.institutions[i] >= 0.72
                                                        ? STAGE_COLORS[3]
                                                        : 'var(--accent)'
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <h3 className="subheading">世代構成</h3>
                                <div className="generations">
                                    {['若年 / 0–14歳', '15–64歳', '高齢 / 65歳以上'].map(
                                        (name, i) => (
                                            <span key={name}>
                                                {name}
                                                <b>{percent(local.generations[i])}</b>
                                            </span>
                                        ),
                                    )}
                                </div>
                                <p className="muted">
                                    教育制度は次の世代の判断習慣に引き継がれます。世代交代後も人口規模は一定です。
                                </p>
                                {selectedPoint && selectedPoint.area === areaIndex && (
                                    <div className="point-inspection">
                                        <b>人口集団 #{selectedPoint.id + 1}</b>
                                        <span>
                                            {
                                                ['年少世代', '15–64歳', '高齢世代', '年齢未収録'][
                                                    generation(selectedPoint.age)
                                                ]
                                            }{' '}
                                            · {FIELDS[selectedPoint.field]} ·{' '}
                                            {STAGES[selectedPoint.stage]}
                                        </span>
                                        <small>
                                            浸透係数（モデル）{' '}
                                            {selectedPoint.susceptibility.toFixed(2)} / 近隣{' '}
                                            {selectedPoint.neighbors.length}集団
                                        </small>
                                    </div>
                                )}
                                {selectedPoint && selectedPoint.area === areaIndex && (
                                    <section className="observed-statistics">
                                        <h3 className="subheading">人口点の参照統計</h3>
                                        <p>
                                            {COUNTRY_STATISTICS[selectedPoint.country].name} /{' '}
                                            {STATISTICS_YEAR}年
                                        </p>
                                        <dl>
                                            <div>
                                                <dt>代表人口</dt>
                                                <dd>
                                                    {(selectedPoint.weight / 10000).toFixed(1)}万人
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>元セルの人口密度</dt>
                                                <dd>{selectedPoint.density.toFixed(0)}人/km²</dd>
                                            </div>
                                            <div>
                                                <dt>国のインターネット利用率</dt>
                                                <dd>
                                                    {selectedPoint.internet === null
                                                        ? '未収録'
                                                        : percent(selectedPoint.internet)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>国の都市人口比率</dt>
                                                <dd>
                                                    {COUNTRY_STATISTICS[selectedPoint.country]
                                                        .urban === null
                                                        ? '未収録'
                                                        : `${COUNTRY_STATISTICS[selectedPoint.country].urban!.toFixed(1)}%`}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>国の就業率（15歳以上）</dt>
                                                <dd>
                                                    {selectedPoint.employment === null
                                                        ? '未収録'
                                                        : percent(selectedPoint.employment)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>産業区分の標本</dt>
                                                <dd>
                                                    {selectedPoint.sector === null
                                                        ? '該当なし・未収録'
                                                        : {
                                                              agriculture: '農業',
                                                              industry: '工業',
                                                              services: 'サービス業',
                                                          }[selectedPoint.sector]}
                                                </dd>
                                            </div>
                                        </dl>
                                        <small>
                                            位置・密度：GHSL。年齢区分・国別特性：公表統計。接点・浸透係数はゲーム内モデルです。
                                        </small>
                                    </section>
                                )}
                                <button
                                    type="button"
                                    className="primary campaign-button"
                                    disabled={
                                        game.influence < 20 || game.month < area.campaignReady
                                    }
                                    onClick={() => useGameStore.getState().campaign(areaIndex)}
                                >
                                    <MessageCircle size={16} />
                                    SNS対話キャンペーン<span>20 IP</span>
                                </button>
                                <p className="muted">
                                    影響力 {Math.floor(game.influence)} / 100 IP。
                                    {game.month < area.campaignReady
                                        ? `再実行まで ${area.campaignReady - game.month}か月。`
                                        : '18か月間、信頼と普及を促進。'}
                                    {game.month < area.campaignUntil && ' 現在実施中。'}
                                </p>
                                <h3 className="subheading">地理・情報の接続（モデル）</h3>
                                <div className="linked-areas">
                                    {area.links.map((i) => (
                                        <button
                                            type="button"
                                            key={i}
                                            onClick={() => {
                                                setSelectedArea(i);
                                                useMapStore.getState().selectMarker(null);
                                            }}
                                        >
                                            {AREAS[i].name}
                                            <ChevronRight size={13} />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </aside>
            )}
            {game.pendingChat && (
                <section className="conversation-panel glass" aria-label="重要人物との会話">
                    <div className="panel-heading">
                        <span>
                            <MessageCircle size={14} />
                            会話
                        </span>
                        <button type="button" aria-label="会話を閉じる" onClick={closeChat}>
                            <X size={17} />
                        </button>
                    </div>
                    <div className="conversation-content">
                        <small>
                            {AREAS[game.pendingChat.area].name}・{FIELDS[game.pendingChat.field]}
                        </small>
                        <h2>{game.pendingChat.person}</h2>
                        <blockquote>「{game.pendingChat.message}」</blockquote>
                        <div className="chat-options">
                            {game.pendingChat.options.map((option, i) => {
                                const score =
                                    game.abilities[option.ability] +
                                    (game.skills.includes('consensus') ? 15 : 0);
                                return (
                                    <button
                                        type="button"
                                        key={option.label}
                                        onClick={() => {
                                            useGameStore.getState().answer(i);
                                            useMapStore.getState().selectMarker(null);
                                        }}
                                    >
                                        <span>
                                            {option.label}
                                            <ArrowRight size={14} />
                                        </span>
                                        <small>{option.description}</small>
                                        <b
                                            className={
                                                score >= option.required
                                                    ? 'success-text'
                                                    : 'warning-text'
                                            }
                                        >
                                            {option.ability} {score.toFixed(0)} / 必要{' '}
                                            {Math.ceil(option.required)}
                                        </b>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="muted">会話中も世界の時間は進みます。</p>
                    </div>
                </section>
            )}
            {game.chatResult && (
                <div className="chat-result glass" role="status">
                    <p>{game.chatResult}</p>
                    <button
                        type="button"
                        aria-label="会話結果を閉じる"
                        onClick={() => useGameStore.getState().dismissChat()}
                    >
                        <X size={15} />
                    </button>
                </div>
            )}
            <small className="map-credit">
                NASA / Natural Earth · 人口：GHSL 2020 © EU（CC BY 4.0）
            </small>
            {(!game.started || help) && (
                <Brief
                    returning={game.started}
                    onStart={() => {
                        useGameStore.getState().start();
                        setHelp(false);
                    }}
                />
            )}
            {game.outcome !== 'playing' && <Result game={game} onRestart={restart} />}
        </main>
    );
}
