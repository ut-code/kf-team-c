import { useEffect, useMemo, useState } from 'react';
import { AREAS, FIELDS, STAGES } from '../game/data';
import { generation, metrics } from '../game/engine';
import { warnings } from '../game/metrics';
import { mapScene } from '../map/config';
import { WORLD_WIDTH } from '../map/geometry';
import type { MapMarker, MapRegion } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import { ChatResult } from './ChatResult';
import { ConversationPanel } from './ConversationPanel';
import { EventDialog } from './EventDialog';
import { GameClock } from './GameClock';
import { Brief, Result } from './GameOverlays';
import { GameActions } from './hud/GameActions';
import { NewsFeed } from './hud/NewsFeed';
import { StageLegend } from './hud/StageLegend';
import { WorldStats } from './hud/WorldStats';
import { ImpactReport } from './ImpactReport';
import { AreaPanel } from './panels/AreaPanel';
import { FloatingPanel, type GamePanel } from './panels/FloatingPanel';
import { OperationsPanel } from './panels/OperationsPanel';
import { ResearchPanel } from './panels/ResearchPanel';
import { SocialPanel } from './panels/SocialPanel';
import { WorldMap } from './WorldMap';

export function GameApp({ regions }: { regions: MapRegion[] }) {
    const game = useGameStore((state) => state.game)!;
    const [tab, setTab] = useState<GamePanel | null>(null);
    const selectedArea = useMapStore((state) => state.selectedAreaId);
    const setSelectedArea = useMapStore((state) => state.selectArea);
    const [region, setRegion] = useState('すべて');
    const [help, setHelp] = useState(false);
    const [hidden, setHidden] = useState(document.hidden);
    const selectedMarker = useMapStore((state) => state.selectedMarkerId);
    const summary = useMemo(() => metrics(game), [game]);
    const blocked =
        !game.started || game.outcome !== 'playing' || help || hidden || game.pendingEvent !== null;
    const alerts = warnings(game);
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
    const selectedPoint =
        selectedMarker === null || selectedMarker.startsWith('chat-')
            ? null
            : game.points[Number(selectedMarker)];
    const { research, allocateCompute, policy, dismissChat, dismissImpact, decideEvent, openChat } =
        useGameStore.getState();
    const selectArea = (index: number) => {
        setSelectedArea(index);
        useMapStore.getState().selectMarker(null);
    };
    const closePanel = () => {
        setTab(null);
        setSelectedArea(null);
        useMapStore.getState().selectMarker(null);
    };
    const answerChat = (index: number) => {
        useGameStore.getState().answer(index);
        useMapStore.getState().selectMarker(null);
    };
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
    const togglePanel = (value: GamePanel) =>
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
            <WorldStats summary={summary} />
            {alerts.length > 0 && (
                <div className="crisis-banner glass" role="alert">
                    {alerts[0]}
                </div>
            )}
            <NewsFeed news={game.news} />
            <GameClock key={game.seed} blocked={blocked} />
            <GameActions
                activePanel={tab}
                researching={game.activeResearch !== null}
                onTogglePanel={togglePanel}
                onHelp={() => setHelp(true)}
            />
            <StageLegend />
            {tab && (
                <FloatingPanel panel={tab} onClose={closePanel}>
                    {tab === 'operations' && (
                        <OperationsPanel
                            game={game}
                            onAllocate={allocateCompute}
                            onSocial={() => setTab('social')}
                        />
                    )}
                    {tab === 'social' && (
                        <SocialPanel
                            game={game}
                            initialArea={areaIndex}
                            onPolicy={policy}
                            onChat={openChat}
                        />
                    )}
                    {tab === 'research' && (
                        <ResearchPanel
                            game={game}
                            onResearch={research}
                            onAllocate={allocateCompute}
                        />
                    )}
                    {tab === 'area' && (
                        <AreaPanel
                            game={game}
                            local={summary.areas[areaIndex]}
                            areaIndex={areaIndex}
                            selectedPoint={selectedPoint}
                            region={region}
                            setRegion={setRegion}
                            onSelectArea={selectArea}
                            onSocial={() => setTab('social')}
                        />
                    )}
                </FloatingPanel>
            )}
            {game.pendingChat && tab !== 'research' && (
                <ConversationPanel
                    chat={game.pendingChat}
                    game={game}
                    onClose={closeChat}
                    onAnswer={answerChat}
                />
            )}
            {game.impact && tab !== 'research' && (
                <ImpactReport impact={game.impact} onDismiss={dismissImpact} />
            )}
            {game.pendingEvent && game.started && !help && (
                <EventDialog event={game.pendingEvent} game={game} onChoose={decideEvent} />
            )}
            {game.chatResult && <ChatResult message={game.chatResult} onDismiss={dismissChat} />}
            <small className="map-credit">
                NASA / Natural Earth · 人口：UN WPP · 位置：GHSL © EU · ITU / UIS / World Bank
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
