import { Network, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AREAS, STAGE_COLORS, STAGES } from '../game/data';
import { areaHint, metrics } from '../game/engine';
import { mapScene } from '../map/config';
import type { MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { GameClock } from './GameClock';
import { Brief, Result } from './GameOverlays';
import { ResearchPanel } from './panels/ResearchPanel';
import { WorldMap } from './WorldMap';
import { percent } from './widgets';

export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const [researchOpen, setResearchOpen] = useState(false);
    const [hidden, setHidden] = useState(document.hidden);
    const selected = useMapStore((state) => state.selectedAreaId);
    const summary = useMemo(() => metrics(game), [game]);
    const blocked = !game.started || game.outcome !== 'playing' || hidden || researchOpen;
    useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setResearchOpen(false);
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
        ? [Math.max(0, 1 - area.autonomous - area.dependent), area.autonomous, area.dependent]
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
                    trafficSpeed={blocked ? 0 : game.speed}
                    trafficTick={game.month}
                    onAreaSelect={(index) => useMapStore.getState().selectArea(index)}
                />
            </div>
            <header className="world-hud glass">
                <span className="wordmark">
                    HUMANITY<span>.exe</span>
                </span>
                <div className="world-number">
                    <span>AI利用</span>
                    <strong>{percent(summary.adoption)}</strong>
                </div>
                <div className="world-number dependency-number">
                    <span>AI依存</span>
                    <strong>{percent(summary.dependent)}</strong>
                </div>
                <div
                    className="response-status"
                    title="人間による代替運用を整え、AI依存から自律的使用へ戻す計画"
                >
                    <div>
                        <span>脱依存計画</span>
                        <b>{game.responseStarted ? percent(game.response) : '未始動'}</b>
                    </div>
                    <progress value={game.response} max={1} />
                </div>
            </header>
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
                    <p>{areaHint(game, selected)}</p>
                </aside>
            )}
            <div className="news-ticker" aria-live="polite">
                {game.news[0]?.title}
            </div>
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
            {researchOpen && (
                <ResearchPanel
                    game={game}
                    onResearch={useGameStore.getState().research}
                    onClose={() => setResearchOpen(false)}
                />
            )}
            {!game.started && <Brief onStart={(origin) => useGameStore.getState().start(origin)} />}
            {game.outcome !== 'playing' && (
                <Result
                    game={game}
                    onRestart={() => {
                        setResearchOpen(false);
                        useMapStore.getState().selectArea(null);
                        useGameStore.getState().initialize(game.seed + 1);
                    }}
                />
            )}
        </main>
    );
}
