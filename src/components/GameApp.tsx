import { Network, Radio, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { humanControl } from '../game/control';
import { AREAS, STAGE_COLORS, STAGES, WORLD_POPULATION } from '../game/data';
import { advanceMonth, areaHint, metrics } from '../game/engine';
import { hasCountermeasureResearch, humanResponse } from '../game/humanResponse';
import { instituteArea, instituteFor, investigationRate } from '../game/secrecy/investigations';
import { researchTopic } from '../game/secrecy/research';
import { researchPhaseLabel, researchTarget } from '../game/secrecy/researchTargets';
import { responseActive } from '../game/secrecy/responses';
import { mapScene } from '../map/config';
import type { MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { ProjectedGameContext } from './ContinuousProgress';
import { GameClock } from './GameClock';
import { OriginSelection, Result } from './GameOverlays';
import { HumanResponse, HumanResponsePanel } from './HumanResponse';
import { NotificationFeed } from './NotificationFeed';
import { PopulationChart } from './PopulationChart';
import { ResearchPanel } from './panels/ResearchPanel';
import { InvestigationPanel } from './society/InvestigationPanel';
import type { MapEncounter } from './society/MapEncounterMarkers';
import { SocietyPanel } from './society/SocietyPanel';
import { useAnimationSpeed } from './useAnimationSpeed';
import { useMapAnchor } from './useMapAnchor';
import { WorldMap } from './WorldMap';
import { WorldMetricsWidget } from './WorldMetricsWidget';
import { WorldNews } from './WorldNews';
import { percent, population } from './widgets';

type Panel =
    | { kind: 'world' | 'sns' | 'countermeasures' }
    | { kind: 'skills'; skillId?: string }
    | { kind: 'region'; id: number }
    | { kind: 'encounter'; id: string };

export function GameApp({
    regions,
    onReturnToTitle,
}: {
    regions: MapRegion[];
    onReturnToTitle: () => void;
}) {
    const game = useGameStore((state) => state.game)!;
    const shell = useRef<HTMLElement>(null);
    useAnimationSpeed(shell, game.speed);
    const session = useGameStore((state) => state.session);
    const [panel, setPanel] = useState<Panel | null>(null);
    const visiblePanel = game.outcome === 'playing' ? panel : null;
    const researchOpen = visiblePanel?.kind === 'skills';
    const snsOpen = visiblePanel?.kind === 'sns';
    const countermeasuresOpen = visiblePanel?.kind === 'countermeasures';
    const response = useMemo(() => humanResponse(game), [game]);
    const projectedGame = useMemo(() => advanceMonth(game), [game]);
    const control = useMemo(() => humanControl(game), [game]);
    const projectedControl = useMemo(() => humanControl(projectedGame), [projectedGame]);
    const showCountermeasures = hasCountermeasureResearch(game);
    const worldOpen = visiblePanel?.kind === 'world';
    const selected = visiblePanel?.kind === 'region' ? visiblePanel.id : null;
    const areaPanel = useRef<HTMLElement>(null);
    useMapAnchor(areaPanel, selected === null ? undefined : AREAS[selected]);
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
    const toggleEncounter = (id: string) => togglePanel({ kind: 'encounter', id });
    const selectedInvestigation = game.investigations.find((item) => item.id === encounterId);
    const investigations = game.investigations.filter((item) => item.status === 'active');
    const mapEncounters: MapEncounter[] = [];
    for (const investigation of investigations) {
        const institute = instituteFor(investigation);
        const topic = investigation.kind === 'research' ? researchTopic(investigation) : null;
        const regulation = topic?.category === 'regulation';
        const organization = regulation
            ? `${AREAS[instituteArea(investigation)].name}の規制当局`
            : institute.name;
        mapEncounters.push({
            id: investigation.id,
            project: investigation,
            title:
                investigation.kind === 'research'
                    ? `${organization} · ${topic!.name} · ${researchPhaseLabel(investigation)} · ${researchTarget(investigation).name}`
                    : institute.name,
            stage: responseActive(game, investigation)
                ? { cooperate: '検証協力中', pressure: '圧力下', limit: '限定運用中' }[
                      investigation.response!.action
                  ]
                : investigation.kind === 'research'
                  ? researchPhaseLabel(investigation)
                  : '調査中',
            kind: regulation ? 'regulation' : 'investigation',
            location: institute,
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
        countermeasuresOpen ||
        Boolean(selectedInvestigation);
    const paused = game.started && game.outcome === 'playing' && (blocked || game.speed === 0);
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
        <ProjectedGameContext value={projectedGame}>
            <main
                ref={shell}
                className="game-shell"
                data-paused={paused && !blocked}
                data-countermeasures={showCountermeasures}
            >
                {import.meta.env.DEV && !researchOpen && (
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
                        key={session}
                        regions={regions}
                        {...mapScene}
                        selectedArea={selected}
                        areaStates={game.areas}
                        humanProtection={response.protectionByArea}
                        serverArea={game.origin}
                        initialLongitude={138}
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
                <WorldMetricsWidget
                    values={summary}
                    countermeasureProgress={showCountermeasures ? control.progress : null}
                    nextCountermeasureProgress={projectedControl.progress}
                    countermeasuresOpen={countermeasuresOpen}
                    onCountermeasures={() => togglePanel({ kind: 'countermeasures' })}
                    paused={paused}
                    expanded={worldOpen && selected === null && !snsOpen}
                    onToggle={() => togglePanel({ kind: 'world' })}
                />
                <WorldNews key={`news:${session}`} game={game} speed={blocked ? 0 : game.speed} />
                <GameClock key={session} blocked={blocked} />
                <div className="right-hud">
                    <NotificationFeed key={session} speed={blocked ? 0 : game.speed} />
                </div>
                {area && (
                    <aside
                        ref={areaPanel}
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
                                    selected === null
                                        ? '世界全体の状況を閉じる'
                                        : '地域の状況を閉じる'
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
                        <div className="region-context">
                            <p className="region-trust">
                                信頼度 <strong>{Math.round(area.favorability * 100)}</strong>
                                <span> / 100</span>
                            </p>
                            {selected !== null && (
                                <div className="region-traits">
                                    <span>
                                        通信環境{' '}
                                        <strong>
                                            {Math.round(AREAS[selected].digital * 100)}%
                                        </strong>
                                    </span>
                                    <span>
                                        企業での利用{' '}
                                        <strong>
                                            {AREAS[selected].enterprise >= 0.65 ? '多い' : '少ない'}
                                        </strong>
                                    </span>
                                    <span>
                                        規制{' '}
                                        <strong>
                                            {AREAS[selected].regulation >= 0.6 ? '厳しい' : '緩い'}
                                        </strong>
                                    </span>
                                </div>
                            )}
                            {selected !== null && <p>{areaHint(game, selected)}</p>}
                        </div>
                        <HumanResponse
                            game={game}
                            area={selected === null ? undefined : selected}
                        />
                    </aside>
                )}
                <footer className="map-footer">
                    <div className="map-legend glass">
                        {STAGES.map((label, i) =>
                            i === 0 ? null : (
                                <span key={label}>
                                    <i style={{ background: STAGE_COLORS[i] }} />
                                    {label}
                                </span>
                            ),
                        )}
                        <span>
                            <i className="countermeasure-swatch" />
                            依存対策
                        </span>
                    </div>
                    <nav className="game-actions" aria-label="世界への戦略">
                        <button
                            type="button"
                            className="sns-button glass"
                            aria-label="社会のSNS"
                            aria-expanded={snsOpen}
                            aria-controls="sns-panel"
                            onClick={() => togglePanel({ kind: 'sns' })}
                        >
                            <Radio size={20} />
                            <span>社会の動き</span>
                            <small>SNS</small>
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
                {countermeasuresOpen && (
                    <HumanResponsePanel
                        game={game}
                        onClose={closePanel}
                        onResearch={(id) =>
                            togglePanel({
                                kind: 'encounter',
                                id,
                            })
                        }
                    />
                )}
                {snsOpen && <SocietyPanel game={game} onClose={closePanel} />}
                {selectedInvestigation && (
                    <InvestigationPanel
                        key={selectedInvestigation.id}
                        game={game}
                        id={selectedInvestigation.id}
                        onClose={closePanel}
                        onOpenSkill={(id) => togglePanel({ kind: 'skills', skillId: id })}
                    />
                )}
                {researchOpen && (
                    <ResearchPanel
                        key={visiblePanel?.kind === 'skills' ? visiblePanel.skillId : undefined}
                        initialSkill={
                            visiblePanel?.kind === 'skills' ? visiblePanel.skillId : undefined
                        }
                        game={game}
                        onResearch={useGameStore.getState().research}
                        onClose={closePanel}
                    />
                )}
                {!game.started && <OriginSelection onStart={useGameStore.getState().start} />}
                {game.outcome !== 'playing' && (
                    <Result game={game} onReturnToTitle={onReturnToTitle} />
                )}
            </main>
        </ProjectedGameContext>
    );
}
