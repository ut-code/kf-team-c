import { Network, Radio, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AREAS,
    DEFEAT_OPPOSITION,
    STAGE_COLORS,
    STAGES,
    VICTORY_DEPENDENCY,
    WORLD_POPULATION,
} from '../game/data';
import { areaHint, metrics } from '../game/engine';
import { instituteFor, investigationRate } from '../game/secrecy/investigations';
import { socialStrategy } from '../game/society/strategies';
import { encounterDefinition } from '../game/society/system';
import { mapScene } from '../map/config';
import type { MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { GameClock } from './GameClock';
import { Result } from './GameOverlays';
import { PopulationChart } from './PopulationChart';
import { ResearchPanel } from './panels/ResearchPanel';
import { EncounterPanel } from './society/EncounterPanel';
import { InvestigationPanel } from './society/InvestigationPanel';
import type { MapEncounter } from './society/MapEncounterMarkers';
import { SocietyPanel } from './society/SocietyPanel';
import { WorldMap } from './WorldMap';
import { percent, population } from './widgets';

type Panel =
    | { kind: 'world' | 'sns' | 'skills' }
    | { kind: 'region'; id: number }
    | { kind: 'encounter'; id: string; side: 'left' | 'right' };

export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const [panel, setPanel] = useState<Panel | null>(null);
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
    const toggleEncounter = (id: string, anchorX = window.innerWidth / 2) =>
        togglePanel({
            kind: 'encounter',
            id,
            side: anchorX < window.innerWidth / 2 ? 'right' : 'left',
        });
    const selectedInvestigation = game.investigations.find((item) => item.id === encounterId);
    const selectedEncounter = game.encounters.find(
        (item) => item.id === encounterId && encounterDefinition(item.id),
    );
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
    useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closePanel();
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
    }, [blocked, game.speed, closePanel]);
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
        <main
            className="game-shell"
            data-floating-side={visiblePanel?.kind === 'encounter' ? visiblePanel.side : undefined}
        >
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
                </details>
            )}
            <div className="map-background">
                <WorldMap
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
                    onAreaSelect={(index) => {
                        if (index === null) closePanel();
                        else togglePanel({ kind: 'region', id: index });
                    }}
                />
            </div>
            <button
                type="button"
                className="world-hud glass"
                aria-label="世界全体の状態を表示"
                onClick={() => togglePanel({ kind: 'world' })}
                aria-expanded={worldOpen && selected === null && !snsOpen}
                aria-controls="population-details"
            >
                <span className="world-number">
                    <span>AI利用</span>
                    <strong>{percent(summary.adoption)}</strong>
                </span>
                <span
                    className="world-number dependency-number"
                    title={`AI依存 ${VICTORY_DEPENDENCY * 100}%で勝利`}
                >
                    <span>AI依存 / {VICTORY_DEPENDENCY * 100}%</span>
                    <strong>{percent(summary.dependent)}</strong>
                </span>
                <span
                    className="world-number opposition-number"
                    title={`反AI ${DEFEAT_OPPOSITION * 100}%で敗北`}
                >
                    <span>反AI / {DEFEAT_OPPOSITION * 100}%</span>
                    <strong>{percent(summary.antiAI)}</strong>
                </span>
            </button>
            <GameClock key={game.seed} blocked={blocked} />
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
                    onClose={closePanel}
                />
            ) : (
                selectedEncounter && (
                    <EncounterPanel
                        key={selectedEncounter.id}
                        game={game}
                        id={selectedEncounter.id}
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
