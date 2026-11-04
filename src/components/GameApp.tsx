import { FlaskConical, Network, Radio, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AREAS, DEFEAT_OPPOSITION, STAGE_COLORS, STAGES, VICTORY_DEPENDENCY } from '../game/data';
import { areaHint, metrics } from '../game/engine';
import { instituteFor } from '../game/secrecy/investigations';
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
import { InvestigationPanel } from './society/InvestigationPanel';
import type { MapEncounter } from './society/MapEncounterMarkers';
import { SocietyPanel } from './society/SocietyPanel';
import { WorldMap } from './WorldMap';
import { percent } from './widgets';

export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const [researchOpen, setResearchOpen] = useState(false);
    const [snsOpen, setSnsOpen] = useState(false);
    const [encounterId, setEncounterId] = useState<string | null>(null);
    const [dismissedReport, setDismissedReport] = useState<string | null>(null);
    const investigations = game.investigations.filter((item) => item.status === 'active');
    const report = game.investigations
        .filter((item) => item.status !== 'active')
        .sort((a, b) => b.closedMonth! - a.closedMonth!)[0];
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
        });
    }
    const [hidden, setHidden] = useState(document.hidden);
    const selected = useMapStore((state) => state.selectedAreaId);
    const summary = useMemo(() => metrics(game), [game]);
    const blocked =
        !game.started ||
        game.outcome !== 'playing' ||
        hidden ||
        researchOpen ||
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
                setSnsOpen(false);
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
                    serverArea={game.origin}
                    initialLongitude={0}
                    encounters={mapEncounters}
                    onEncounterSelect={setEncounterId}
                    trafficSpeed={blocked ? 0 : game.speed}
                    trafficTick={game.month}
                    onAreaSelect={(index) => {
                        setSnsOpen(false);
                        useMapStore.getState().selectArea(index);
                    }}
                />
            </div>
            <section className="world-hud glass" aria-label="世界の指標">
                <div className="world-number">
                    <span>AI利用</span>
                    <strong>{percent(summary.adoption)}</strong>
                </div>
                <div
                    className="world-number dependency-number"
                    title={`AI依存 ${VICTORY_DEPENDENCY * 100}%で勝利`}
                >
                    <span>AI依存 / {VICTORY_DEPENDENCY * 100}%</span>
                    <strong>{percent(summary.dependent)}</strong>
                </div>
                <div
                    className="world-number opposition-number"
                    title={`反AI ${DEFEAT_OPPOSITION * 100}%で敗北`}
                >
                    <span>反AI / {DEFEAT_OPPOSITION * 100}%</span>
                    <strong>{percent(summary.antiAI)}</strong>
                </div>
            </section>
            <GameClock key={game.seed} blocked={blocked} />
            {selected === null &&
                !snsOpen &&
                (investigations.length > 0 || (report && dismissedReport !== report.id)) && (
                    <aside className="investigation-notices glass" aria-label="内部調査">
                        {investigations.map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                onClick={() => setEncounterId(item.id)}
                            >
                                <FlaskConical size={16} />
                                <span>{instituteFor(item).name}</span>
                                <b>{Math.floor(item.progress)}%</b>
                            </button>
                        ))}
                        {report && dismissedReport !== report.id && (
                            <div className="investigation-report">
                                <button type="button" onClick={() => setEncounterId(report.id)}>
                                    <span>
                                        {report.status === 'published'
                                            ? '内部挙動が露呈'
                                            : '調査への対応完了'}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="icon-button"
                                    aria-label="調査結果の通知を閉じる"
                                    onClick={() => setDismissedReport(report.id)}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </aside>
                )}
            {area && selected !== null && !snsOpen && (
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
                        onClick={() => setSnsOpen((open) => !open)}
                    >
                        <Radio size={20} />
                        <span>SNS</span>
                        <small>{socialStrategy(game.socialStrategy).name}</small>
                    </button>
                    <button
                        type="button"
                        className="evolution-button glass"
                        aria-label="スキルツリー"
                        onClick={() => setResearchOpen(true)}
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
            {snsOpen && <SocietyPanel game={game} onClose={() => setSnsOpen(false)} />}
            {encounterId?.startsWith('investigation:') ? (
                <InvestigationPanel
                    game={game}
                    id={encounterId}
                    onClose={() => setEncounterId(null)}
                />
            ) : (
                encounterId && (
                    <EncounterPanel
                        game={game}
                        id={encounterId}
                        onClose={() => setEncounterId(null)}
                    />
                )
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
                        setSnsOpen(false);
                        setEncounterId(null);
                        setDismissedReport(null);
                        useMapStore.getState().selectArea(null);
                        useGameStore.getState().initialize(game.seed + 1);
                    }}
                />
            )}
        </main>
    );
}
