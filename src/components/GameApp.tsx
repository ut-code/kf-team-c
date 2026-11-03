import { Bell, MessageSquare, Network, Radio, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AREAS, STAGE_COLORS, STAGES } from '../game/data';
import { areaHint, metrics } from '../game/engine';
import { socialStrategy } from '../game/society/strategies';
import { encounterDefinition } from '../game/society/system';
import { mapScene } from '../map/config';
import type { MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { GameClock } from './GameClock';
import { Result } from './GameOverlays';
import { ResearchPanel } from './panels/ResearchPanel';
import { EncounterPanel } from './society/EncounterPanel';
import { SocietyPanel } from './society/SocietyPanel';
import { WorldMap } from './WorldMap';
import { percent } from './widgets';

export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const [researchOpen, setResearchOpen] = useState(false);
    const [societyPanel, setSocietyPanel] = useState<'sns' | 'inbox' | null>(null);
    const [encounterId, setEncounterId] = useState<string | null>(null);
    const pending = game.encounters.filter((item) => item.status === 'pending');
    const mapEncounters = pending.flatMap((item) => {
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
    const [hidden, setHidden] = useState(document.hidden);
    const selected = useMapStore((state) => state.selectedAreaId);
    const summary = useMemo(() => metrics(game), [game]);
    const blocked =
        !game.started ||
        game.outcome !== 'playing' ||
        hidden ||
        researchOpen ||
        societyPanel !== null ||
        encounterId !== null;
    useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setResearchOpen(false);
                setSocietyPanel(null);
                setEncounterId(null);
                useMapStore.getState().selectArea(null);
            }
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
    }, [blocked, game.speed]);
    const area = selected === null ? null : game.areas[selected];
    const stages = area
        ? [
              Math.max(0, 1 - area.autonomous - area.dependent - area.antiAI),
              area.autonomous,
              area.dependent,
              area.antiAI,
          ]
        : [];
    return (
        <main className="game-shell">
            <div className="map-background">
                <WorldMap
                    regions={regions}
                    {...mapScene}
                    selectedArea={selected}
                    areaStates={game.areas}
                    initialLongitude={0}
                    encounters={mapEncounters}
                    onEncounterSelect={setEncounterId}
                    trafficSpeed={blocked ? 0 : game.speed}
                    trafficTick={game.month}
                    onAreaSelect={(index) => useMapStore.getState().selectArea(index)}
                />
            </div>
            <section className="world-hud glass" aria-label="世界の指標">
                <div className="world-number">
                    <span>AI利用</span>
                    <strong>{percent(summary.adoption)}</strong>
                </div>
                <div className="world-number dependency-number">
                    <span>AI依存</span>
                    <strong>{percent(summary.dependent)}</strong>
                </div>
                <div className="world-number opposition-number">
                    <span>反AI</span>
                    <strong>{percent(summary.antiAI)}</strong>
                </div>
            </section>
            <nav className="society-toolbar" aria-label="世界への戦略">
                <button type="button" className="glass" onClick={() => setSocietyPanel('sns')}>
                    <Radio size={17} />
                    <span>SNS</span>
                    <small>{socialStrategy(game.socialStrategy).name}</small>
                </button>
                <button type="button" className="glass" onClick={() => setSocietyPanel('inbox')}>
                    <Bell size={17} />
                    <span>世界の動き</span>
                    <b>{pending.length}</b>
                </button>
                <button
                    type="button"
                    className="glass"
                    onClick={() => setSocietyPanel('inbox')}
                    aria-label="人物との連絡"
                >
                    <MessageSquare size={17} />
                    <b>
                        {
                            pending.filter((item) => encounterDefinition(item.id)?.kind === 'chat')
                                .length
                        }
                    </b>
                </button>
            </nav>
            <GameClock key={game.seed} blocked={blocked} />
            {area && selected !== null && (
                <aside className="area-card glass" aria-label="地域の状況">
                    <div className="area-card-heading">
                        <h2>{AREAS[selected].name}</h2>
                        <button
                            type="button"
                            className="icon-button"
                            aria-label="地域の状況を閉じる"
                            onClick={() => useMapStore.getState().selectArea(null)}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="population-bar">
                        {stages.map((value, i) => (
                            <span
                                key={STAGES[i]}
                                style={{ width: `${value * 100}%`, background: STAGE_COLORS[i] }}
                            />
                        ))}
                    </div>
                    <dl>
                        {stages.map((value, i) => (
                            <div key={STAGES[i]}>
                                <dt>
                                    <i style={{ background: STAGE_COLORS[i] }} />
                                    {STAGES[i]}
                                </dt>
                                <dd>{percent(value)}</dd>
                            </div>
                        ))}
                    </dl>
                    <p>AI好感度 {Math.round(area.favorability * 100)} / 100</p>
                    <p>{areaHint(game, selected)}</p>
                </aside>
            )}
            <footer className="map-footer">
                <div className="map-legend">
                    {STAGES.map((label, i) => (
                        <span key={label}>
                            <i style={{ background: STAGE_COLORS[i] }} />
                            {label}
                        </span>
                    ))}
                </div>
                <button
                    type="button"
                    className="evolution-button glass"
                    aria-label="進化"
                    onClick={() => setResearchOpen(true)}
                >
                    <Network size={20} />
                    <span>進化</span>
                    <b>
                        {game.skillPoints}
                        <small>SP</small>
                    </b>
                </button>
            </footer>
            <small className="map-credit">
                NASA / Natural Earth · UN WPP / ITU · 地域設定はゲーム上の仮定
            </small>
            {societyPanel && (
                <SocietyPanel
                    game={game}
                    tab={societyPanel}
                    onClose={() => setSocietyPanel(null)}
                    onOpen={(id) => {
                        setSocietyPanel(null);
                        setEncounterId(id);
                    }}
                />
            )}
            {encounterId && (
                <EncounterPanel game={game} id={encounterId} onClose={() => setEncounterId(null)} />
            )}
            {researchOpen && (
                <ResearchPanel
                    game={game}
                    onResearch={useGameStore.getState().research}
                    onClose={() => setResearchOpen(false)}
                />
            )}
            {game.outcome !== 'playing' && (
                <Result
                    game={game}
                    onRestart={() => {
                        setResearchOpen(false);
                        setSocietyPanel(null);
                        setEncounterId(null);
                        useMapStore.getState().selectArea(null);
                        useGameStore.getState().initialize(game.seed + 1);
                    }}
                />
            )}
        </main>
    );
}
