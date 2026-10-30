import { BookOpen, Cpu, Mail, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CountryParameterKey } from '../game/countryParameters';
import { COUNTRY_PARAMETERS } from '../game/countryParameters';
import {
    CHATS,
    FACILITIES,
    FACILITY_BY_ID,
    INITIAL_FACILITY_ID,
    PEOPLE,
    SKILLS,
} from '../game/data.ts';
import { canChooseChat } from '../game/engine.ts';
import { countryMetrics } from '../game/metrics';
import { worldMetrics } from '../game/outcome.ts';
import { type MapVariant, mapVariants } from '../map/config';
import type { Country, MapMarker } from '../map/types';
import { useGameStore } from '../state/gameStore';
import { useMapStore } from '../state/mapStore';
import styles from './GameApp.module.css';
import { CloseButton, COUNTRY_STATE_LABELS, CountryFlag, number } from './game/controls';
import { DebugPanel } from './game/DebugPanel';
import { GameHud } from './game/GameHud';
import { CountryInfo, FacilityInfo } from './game/InfoPanels';
import { MapDataPanel } from './game/MapDataPanel';
import { Notifications } from './game/Notifications';
import { ComputePanel, ResearchPanel, SnsPanel } from './game/StrategyPanels';
import { Button } from './ui/Controls';
import { Panel } from './ui/Panel';
import { WorldMap } from './WorldMap';

type OpenPanel =
    | 'country'
    | 'facility'
    | 'research'
    | 'compute'
    | 'sns'
    | 'settings'
    | 'chat'
    | null;
const panelNames = {
    country: '国家',
    facility: '施設',
    research: '研究',
    compute: '計算資源',
    sns: 'SNS',
    settings: '設定',
    chat: '人物チャット',
};
// 下部メニュー。アイコンはLucideの無料アセットを使う。
const dock = [
    { id: 'research', label: '研究', icon: BookOpen },
    { id: 'compute', label: '計算資源', icon: Cpu },
    { id: 'sns', label: 'SNS', icon: Mail },
    { id: 'settings', label: '設定', icon: SlidersHorizontal },
] as const;

export function GameApp({
    countries,
    detailedCountries,
}: {
    countries: Country[];
    detailedCountries: Country[];
}) {
    const gameState = useGameStore((state) => state.game)!;
    const speed = useGameStore((state) => state.speed);
    const setSpeed = useGameStore((state) => state.setSpeed);
    const dispatch = useGameStore((state) => state.dispatch);
    const selected = useMapStore((state) => state.selectedCountryId);
    const marker = useMapStore((state) => state.selectedMarkerId);
    const markerSelection = useMapStore((state) => state.markerSelection);
    const [mapVariant, setMapVariant] = useState<MapVariant>('satelliteOceanTuned');
    const activeMap = mapVariants[mapVariant];
    const [panel, setPanel] = useState<OpenPanel>(null);
    const [mapParameter, setMapParameter] = useState<CountryParameterKey | null>(null);
    const [inspectedCountry, setInspectedCountry] = useState<string | null>(null);
    const mapValues = useMemo(
        () =>
            mapParameter
                ? Object.fromEntries(
                      Object.entries(gameState.countries).map(([id, state]) => [
                          id,
                          mapParameter === 'aiDefenseEffectiveness'
                              ? countryMetrics(state).aiDefenseEffectiveness
                              : state[mapParameter],
                      ]),
                  )
                : undefined,
        [gameState.countries, mapParameter],
    );
    const readoutId = inspectedCountry ?? selected;
    const world = worldMetrics(gameState);
    const chat = CHATS.find((item) => item.id === gameState.pendingChat);
    const person = chat ? PEOPLE.find((item) => item.id === chat.person)! : null;
    const countryState = selected ? gameState.countries[selected] : null;
    const facility = marker ? FACILITY_BY_ID[marker] : null;

    useEffect(() => {
        if (!speed || gameState.outcome !== 'playing' || gameState.chatOpen) return;
        const timer = window.setInterval(
            () => useGameStore.getState().step(),
            (gameState.config.secondsPerTick * 1000) / speed,
        );
        return () => clearInterval(timer);
    }, [speed, gameState.config.secondsPerTick, gameState.outcome, gameState.chatOpen]);
    const markers = useMemo<MapMarker[]>(
        () => [
            {
                id: 'country:SGP',
                kind: 'country' as const,
                longitude: 103.85,
                latitude: 1.28,
                label: 'シンガポール',
            },
            ...FACILITIES.map((item) => ({
                id: item.id,
                kind: 'facility' as const,
                category: item.category,
                longitude: item.longitude,
                latitude: item.latitude,
                label: `${item.location}・${item.name}`,
            })),
            ...(chat && person
                ? [
                      {
                          id: `chat:${chat.id}`,
                          kind: 'person' as const,
                          longitude: person.longitude,
                          latitude: person.latitude,
                          label: `${person.name}・${chat.title}`,
                      },
                  ]
                : []),
        ],
        [chat, person],
    );
    useEffect(() => {
        useMapStore.getState().setMarkers(markers);
    }, [markers]);
    useEffect(() => {
        if (!marker || markerSelection === 0) return;
        if (marker.startsWith('country:')) {
            useGameStore.getState().dispatch({ type: 'chat-close' });
            useMapStore.getState().selectCountry(marker.slice(8));
            setPanel('country');
        } else if (marker.startsWith('chat:')) {
            if (useGameStore.getState().game!.pendingChat === marker.slice(5)) {
                useGameStore.getState().dispatch({ type: 'chat-open' });
                setPanel('chat');
            }
        } else {
            useGameStore.getState().dispatch({ type: 'chat-close' });
            useMapStore.getState().selectCountry(FACILITY_BY_ID[marker].country);
            setPanel('facility');
        }
    }, [marker, markerSelection]);
    function closePanel() {
        dispatch({ type: 'chat-close' });
        setPanel(null);
    }
    const selectCountry = useCallback(() => {
        dispatch({ type: 'chat-close' });
        setPanel((current) => (current === 'sns' ? 'sns' : 'country'));
    }, [dispatch]);
    return (
        <main className={styles.game}>
            <a
                className={styles.mapCredit}
                href={activeMap.attributionUrl}
                target="_blank"
                rel="noreferrer"
            >
                {activeMap.attribution}
            </a>
            <WorldMap
                countries={activeMap.detailedBorders ? detailedCountries : countries}
                backgroundUrl={activeMap.backgroundUrl}
                waterMaskUrl={activeMap.waterMaskUrl}
                surfaceMaskUrl={activeMap.surfaceMaskUrl}
                countryIndexUrl={activeMap.countryIndexUrl}
                countryStates={gameState.countries}
                parameterValues={mapValues}
                parameterLabel={mapParameter ? COUNTRY_PARAMETERS[mapParameter].name : undefined}
                onCountryInspect={setInspectedCountry}
                facilityStates={gameState.facilities}
                onCountrySelect={selectCountry}
                initialLongitude={FACILITY_BY_ID[INITIAL_FACILITY_ID].longitude}
                trafficSpeed={gameState.outcome === 'playing' && !gameState.chatOpen ? speed : 0}
                trafficTick={gameState.tick}
            />
            <MapDataPanel
                parameter={mapParameter}
                onChange={setMapParameter}
                country={gameState.definitions.find((country) => country.id === readoutId)}
                value={readoutId ? mapValues?.[readoutId] : undefined}
            />
            <GameHud
                game={gameState}
                speed={speed}
                setSpeed={setSpeed}
                onCompute={() => {
                    dispatch({ type: 'chat-close' });
                    setPanel('compute');
                }}
            />
            <Notifications events={gameState.events} nextEvent={gameState.nextEvent} />
            {(gameState.shortage || gameState.shutdown > 0) && (
                <div className={styles.warning}>
                    {gameState.shortage && <span>計算資源不足</span>}
                    {gameState.shutdown > 0 && (
                        <span>
                            停止作戦：{number(gameState.shutdown)} / {gameState.config.shutdownDays}
                        </span>
                    )}
                </div>
            )}
            <Panel as="nav" className={styles.dock} aria-label="作戦パネル">
                {dock.map((item) => (
                    <Button
                        type="button"
                        key={item.id}
                        aria-pressed={panel === item.id}
                        onClick={() => {
                            dispatch({ type: 'chat-close' });
                            setPanel(panel === item.id ? null : item.id);
                        }}
                    >
                        <item.icon size={19} strokeWidth={1.5} aria-hidden="true" />
                        <span>{item.label}</span>
                    </Button>
                ))}
            </Panel>
            {panel && (
                <Panel
                    as="aside"
                    className={`${styles.panel} ${panel === 'research' ? styles.researchWindow : ''} ${panel === 'chat' ? styles.chatWindow : ''}`}
                    aria-label={`${panelNames[panel]}パネル`}
                    role={panel === 'chat' ? 'dialog' : undefined}
                >
                    <CloseButton onClick={closePanel} />
                    {panel === 'country' && countryState && (
                        <CountryInfo game={gameState} country={countryState} />
                    )}
                    {panel === 'facility' && facility && (
                        <FacilityInfo key={facility.id} game={gameState} id={facility.id} />
                    )}
                    {panel === 'research' && <ResearchPanel game={gameState} />}
                    {panel === 'compute' && <ComputePanel game={gameState} />}
                    {panel === 'sns' && <SnsPanel game={gameState} />}
                    {panel === 'settings' && (
                        <DebugPanel
                            game={gameState}
                            countries={countries}
                            selected={selected}
                            onRestart={closePanel}
                            mapVariant={mapVariant}
                            onMapVariantChange={(variant) => {
                                setMapVariant(variant);
                                setMapParameter(null);
                            }}
                        />
                    )}
                    {panel === 'chat' && chat && person && (
                        <>
                            <div className={styles.countryHeading}>
                                <CountryFlag
                                    id={chat.country}
                                    name={
                                        gameState.definitions.find(
                                            (item) => item.id === chat.country,
                                        )!.name
                                    }
                                />
                                <div>
                                    <small>{person.role}</small>
                                    <h2>{person.name}</h2>
                                </div>
                            </div>
                            <h3>{chat.title}</h3>
                            <p className={styles.chatMessage}>{chat.message}</p>
                            <div className={styles.choices}>
                                {chat.choices.map((choice, index) => (
                                    <Button
                                        type="button"
                                        key={choice.label}
                                        disabled={!canChooseChat(gameState, choice)}
                                        onClick={() => {
                                            dispatch({ type: 'reply', choice: index });
                                            setPanel(null);
                                        }}
                                    >
                                        {choice.label}
                                        {!canChooseChat(gameState, choice) && (
                                            <small>
                                                必要研究：
                                                {choice
                                                    .requiredSkills!.map(
                                                        (id) =>
                                                            SKILLS.find((skill) => skill.id === id)!
                                                                .name,
                                                    )
                                                    .join('・')}
                                            </small>
                                        )}
                                        <small>
                                            {choice.effects
                                                .map(
                                                    (effect) =>
                                                        `${COUNTRY_STATE_LABELS[effect.countryStateKey]}：${effect.amount > 0 ? '+' : ''}${effect.amount}`,
                                                )
                                                .join('　')}
                                        </small>
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}
                </Panel>
            )}
            {gameState.outcome !== 'playing' && (
                <div className={styles.resultBackdrop}>
                    <Panel
                        as="section"
                        className={`${styles.panel} ${styles.result}`}
                        role="dialog"
                        aria-label="ゲーム結果"
                    >
                        <h2>{gameState.outcome === 'victory' ? '勝利' : '敗北'}</h2>
                        <p>{gameState.outcomeReason}</p>
                        <p>支配率：{number(world.control)}%</p>
                        <Button
                            type="button"
                            onClick={() => {
                                useGameStore.getState().initialize(countries, gameState.seed);
                                closePanel();
                            }}
                        >
                            再開
                        </Button>
                    </Panel>
                </div>
            )}
        </main>
    );
}
