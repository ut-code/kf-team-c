import { Network, Radio, Waypoints, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AREAS, STAGE_COLORS, STAGES, WORLD_POPULATION } from '../game/data';
import { areaHint, metrics } from '../game/engine';
import { instituteFor, investigationRate } from '../game/secrecy/investigations';
import { socialStrategy } from '../game/society/strategies';
import { encounterDefinition } from '../game/society/system';
import { mapScene } from '../map/config';
import type { MapRegion, PublishedResearch } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { GameClock } from './GameClock';
import { OriginSelection, Result } from './GameOverlays';
import { NotificationFeed } from './NotificationFeed';
import { PopulationChart } from './PopulationChart';
import { ResearchPanel } from './panels/ResearchPanel';
import { EncounterPanel } from './society/EncounterPanel';
import { InvestigationPanel } from './society/InvestigationPanel';
import type { MapEncounter } from './society/MapEncounterMarkers';
import { SocietyPanel } from './society/SocietyPanel';
import { useAnimationSpeed } from './useAnimationSpeed';
import { WorldMap } from './WorldMap';
import { WorldMetricsWidget } from './WorldMetricsWidget';
import { percent, population } from './widgets';

type Panel =
    | { kind: 'world' | 'sns' | 'skills' }
    | { kind: 'region'; id: number }
    | { kind: 'encounter'; id: string; anchor: { x: number; y: number } };

export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const shell = useRef<HTMLElement>(null);
    useAnimationSpeed(shell, game.speed);
    const session = useGameStore((state) => state.session);
    const [panel, setPanel] = useState<Panel | null>(null);
    const [showTraffic, setShowTraffic] = useState(true);
    const [showNetwork, setShowNetwork] = useState(true);
    // 公表済みの研究だけを地図の波紋(伝播)表示へ渡す。closedMonthは公表月。
    const publishedResearch = useMemo<PublishedResearch[]>(
        () =>
            game.investigations.flatMap((item) =>
                item.kind === 'research' &&
                item.status === 'published' &&
                item.closedMonth !== undefined
                    ? [
                          {
                              id: item.id,
                              instituteId: item.instituteId,
                              closedMonth: item.closedMonth,
                          },
                      ]
                    : [],
            ),
        [game.investigations],
    );
    const visiblePanel = game.outcome === 'playing' ? panel : null;
    const researchOpen = visiblePanel?.kind === 'skills';
    const snsOpen = visiblePanel?.kind === 'sns';
    const worldOpen = visiblePanel?.kind === 'world';
    const selected = visiblePanel?.kind === 'region' ? visiblePanel.id : null;
    const encounterId = visiblePanel?.kind === 'encounter' ? visiblePanel.id : null;
    const closePanel = useCallback(() => {
        setPanel(null);
        useMapStore.getState().selectArea(null);
    }, []);
    const togglePanel = (next: Panel) => {
        const currentId = panel && 'id' in panel ? panel.id : undefined;
        const nextId = 'id' in next ? next.id : undefined;
        const same = panel?.kind === next.kind && currentId === nextId;
        const opened = same && next.kind !== 'skills' ? null : next;
        setPanel(opened);
        useMapStore.getState().selectArea(opened?.kind === 'region' ? opened.id : null);
    };
    const toggleEncounter = (
        id: string,
        anchorX = window.innerWidth / 2,
        anchorY = window.innerHeight / 2,
    ) =>
        togglePanel({
            kind: 'encounter',
            id,
            anchor: { x: anchorX, y: anchorY },
        });
    const selectedInvestigation = game.investigations.find((item) => item.id === encounterId);
    const selectedEncounter = game.encounters.find(
        (item) => item.id === encounterId && encounterDefinition(item.id),
    );
    const chatOpen =
        selectedEncounter && encounterDefinition(selectedEncounter.id)?.kind === 'chat';
    const investigations = game.investigations.filter((item) => item.status === 'active');
    const pending = game.encounters.filter((item) => item.status === 'pending');
    const mapEncounters: MapEncounter[] = pending.flatMap((item) => {
        const definition = encounterDefinition(item.id);
        return definition
            ? [
                  {
                      id: item.id,
                      title: definition.title,
                      kind: definition.kind,
                      location:
                          definition.location ??
                          AREAS.find((area) => area.id === definition.areaId)!,
                  },
              ]
            : [];
    });
    for (const investigation of investigations) {
        const institute = instituteFor(investigation);
        mapEncounters.push({
            id: investigation.id,
            title: institute.name,
            kind: 'investigation',
            location: institute,
            progress: investigation.progress,
            researchSpeed:
                investigationRate(game, investigation) /
                investigationRate(game, investigation, true),
            paused: investigationRate(game, investigation) === 0,
        });
    }
    const [hidden, setHidden] = useState(document.hidden);
    const summary = useMemo(() => metrics(game), [game]);
    const blocked =
        !game.started ||
        game.outcome !== 'playing' ||
        hidden ||
        researchOpen ||
        Boolean(selectedInvestigation || selectedEncounter);
    const paused = game.started && game.outcome === 'playing' && (blocked || game.speed === 0);
    useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !chatOpen) closePanel();
            if (
                event.target instanceof HTMLElement &&
                event.target.closest('input, select, button, textarea')
            )
                return;
            if (event.code === 'Space' && !blocked) {
                event.preventDefault();
                useGameStore.getState().speed(game.speed === 0 ? 1 : 0);
            }
        };
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    }, [blocked, game.speed, closePanel, chatOpen]);
    const area = selected === null ? (worldOpen ? summary : null) : game.areas[selected];
    const detailPopulation = selected === null ? WORLD_POPULATION : AREAS[selected].population;
    const stages = area
        ? [
              Math.max(0, 1 - area.autonomous - area.dependent - area.antiAI),
              area.autonomous,
              area.dependent,
              area.antiAI,
          ]
        : [];
    return (
        <main ref={shell} className="game-shell" data-paused={paused && !blocked}>
            {import.meta.env.DEV && (
                <details className="debug-start glass">
                    <summary>Debug</summary>
                    <button
                        type="button"
                        onClick={() => {
                            closePanel();
                            useGameStore.getState().initializeDebug('spread');
                        }}
                    >
                        普及済みから開始
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            closePanel();
                            useGameStore.getState().initializeDebug('research');
                        }}
                    >
                        研究支援ありで開始
                    </button>
                    <a href="/mock/chat-traffic.html" target="_blank" rel="noreferrer">
                        通信線モックを開く
                    </a>
                </details>
            )}
            <div className="map-background">
                <WorldMap
                    key={session}
                    regions={regions}
                    {...mapScene}
                    selectedArea={selected}
                    areaStates={game.areas}
                    serverArea={game.origin}
                    initialLongitude={0}
                    encounters={mapEncounters}
                    onEncounterSelect={toggleEncounter}
                    trafficSpeed={blocked ? 0 : game.speed}
                    trafficTick={game.month}
                    showTraffic={showTraffic}
                    showNetwork={showNetwork}
                    publishedResearch={publishedResearch}
                    onAreaSelect={(index) => {
                        if (index === null) closePanel();
                        else togglePanel({ kind: 'region', id: index });
                    }}
                />
            </div>
            <WorldMetricsWidget
                values={summary}
                paused={paused}
                expanded={worldOpen && selected === null && !snsOpen}
                onToggle={() => togglePanel({ kind: 'world' })}
            />
            <GameClock key={session} blocked={blocked} />
            <div className="right-hud">
                <NotificationFeed key={session} speed={blocked ? 0 : game.speed} />
            </div>
            {area && (
                <aside
                    id="population-details"
                    className="area-card glass"
                    aria-label={selected === null ? '世界全体の状況' : '地域の状況'}
                >
                    <div className="area-card-heading">
                        <h2>{selected === null ? '世界全体' : AREAS[selected].name}</h2>
                        <button
                            type="button"
                            className="icon-button"
                            aria-label={
                                selected === null ? '世界全体の状況を閉じる' : '地域の状況を閉じる'
                            }
                            onClick={closePanel}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <p>総人口 {population(detailPopulation)}</p>
                    <div className="area-population">
                        <PopulationChart values={stages} total={detailPopulation} />
                        <dl>
                            {stages.map((value, i) => (
                                <div key={STAGES[i]}>
                                    <dt>
                                        <i style={{ background: STAGE_COLORS[i] }} />
                                        {STAGES[i]}
                                    </dt>
                                    <dd>
                                        {percent(value)}
                                        <small className="population-count">
                                            {population(value * detailPopulation)}
                                        </small>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <p>AI好感度 {Math.round(area.favorability * 100)} / 100</p>
                    {selected !== null && <p>{areaHint(game, selected)}</p>}
                </aside>
            )}
            <footer className="map-footer">
                <div className="map-legend glass">
                    {STAGES.map((label, i) => (
                        <span key={label}>
                            <i style={{ background: STAGE_COLORS[i] }} />
                            {label}
                        </span>
                    ))}
                    <button
                        type="button"
                        className="traffic-toggle"
                        aria-pressed={showTraffic}
                        aria-label={showTraffic ? '通信線を非表示にする' : '通信線を表示する'}
                        onClick={() => setShowTraffic((value) => !value)}
                    >
                        <i className="traffic-line" aria-hidden="true" />
                        通信線
                    </button>
                    <button
                        type="button"
                        className="traffic-toggle"
                        aria-pressed={showNetwork}
                        aria-label={showNetwork ? '交流経路を非表示にする' : '交流経路を表示する'}
                        onClick={() => setShowNetwork((value) => !value)}
                    >
                        <i className="traffic-line routes-line" aria-hidden="true" />
                        交流経路
                    </button>
                </div>
                <nav className="game-actions" aria-label="世界への戦略">
                    <button
                        type="button"
                        className="sns-button glass"
                        aria-label="SNS戦略"
                        aria-expanded={snsOpen}
                        aria-controls="sns-panel"
                        onClick={() => togglePanel({ kind: 'sns' })}
                    >
                        <Radio size={20} />
                        <span>SNS</span>
                        <small>{socialStrategy(game.socialStrategy).name}</small>
                    </button>
                    <button
                        type="button"
                        className="evolution-button glass"
                        aria-label="スキルツリー"
                        onClick={() => togglePanel({ kind: 'skills' })}
                    >
                        <Network size={20} />
                        <span>スキルツリー</span>
                        <b>
                            {game.skillPoints}
                            <small>SP</small>
                        </b>
                    </button>
                    <button
                        type="button"
                        className="traffic-button glass"
                        aria-pressed={showTraffic}
                        aria-label={showTraffic ? '通信線を非表示にする' : '通信線を表示する'}
                        onClick={() => setShowTraffic((value) => !value)}
                    >
                        <Waypoints size={20} />
                        <span>通信線</span>
                    </button>
                </nav>
            </footer>
            <small className="map-credit">
                NASA / Natural Earth · UN WPP / ITU · 地域設定はゲーム上の仮定
            </small>
            {snsOpen && <SocietyPanel game={game} onClose={closePanel} />}
            {selectedInvestigation ? (
                <InvestigationPanel
                    key={selectedInvestigation.id}
                    game={game}
                    id={selectedInvestigation.id}
                    anchor={visiblePanel?.kind === 'encounter' ? visiblePanel.anchor : undefined}
                    onClose={closePanel}
                />
            ) : (
                selectedEncounter && (
                    <EncounterPanel
                        key={selectedEncounter.id}
                        game={game}
                        id={selectedEncounter.id}
                        anchor={
                            visiblePanel?.kind === 'encounter' ? visiblePanel.anchor : undefined
                        }
                        onClose={closePanel}
                    />
                )
            )}
            {researchOpen && (
                <ResearchPanel
                    game={game}
                    onResearch={useGameStore.getState().research}
                    onClose={closePanel}
                />
            )}
            {!game.started && <OriginSelection onStart={useGameStore.getState().start} />}
            {game.outcome !== 'playing' && (
                <Result
                    game={game}
                    onRestart={() => {
                        closePanel();
                        useGameStore.getState().initialize(game.seed + 1);
                    }}
                />
            )}
        </main>
    );
}
