import type { KeyboardEvent, PointerEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CountryState, FacilityState } from '../game/types';
import type { Size } from '../map/geometry';
import {
    centerCamera,
    constrainCamera,
    fitScale,
    project,
    resizeCamera,
    visibleWidth,
    WORLD_WIDTH,
} from '../map/geometry';
import type { Country } from '../map/types';
import { useMapStore } from '../state/mapStore';
import { MarkerLayer } from './MarkerLayer';
import { OceanSurface } from './OceanSurface';
import { TrafficLayer } from './TrafficLayer';
import styles from './WorldMap.module.css';

interface Gesture {
    pointerId: number;
    startX: number;
    startY: number;
    cameraX: number;
    cameraY: number;
    moved: boolean;
    countryId: string | null;
}

function countryAt(target: EventTarget | null): string | null {
    return target instanceof Element
        ? (target.closest('[data-country]')?.getAttribute('data-country') ?? null)
        : null;
}

export function WorldMap({
    countries,
    backgroundUrl,
    countryStates,
    facilityStates,
    onCountrySelect,
    initialLongitude,
    trafficSpeed,
    trafficTick,
}: {
    countries: Country[];
    backgroundUrl: string;
    countryStates: Record<string, CountryState>;
    facilityStates?: Record<string, FacilityState>;
    onCountrySelect?: (id: string | null) => void;
    initialLongitude?: number;
    trafficSpeed: number;
    trafficTick: number;
}) {
    const clipId = useId();
    const viewport = useRef<HTMLDivElement>(null);
    const sizeRef = useRef<Size>({ width: 0, height: 0 });
    const gesture = useRef<Gesture | null>(null);
    const [size, setSize] = useState<Size>(sizeRef.current);
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const [cameraY, setCameraY] = useState(0);
    const cameraYRef = useRef(0);
    const renderSize = useMemo(
        () => ({ width: size.width, height: size.height * zoom }),
        [size.width, size.height, zoom],
    );
    const limitY = (y: number) =>
        Math.max(sizeRef.current.height / zoomRef.current - sizeRef.current.height, Math.min(0, y));
    const [dragging, setDragging] = useState(false);
    const [imageError, setImageError] = useState(false);
    const camera = useMapStore((state) => state.camera);
    const selected = useMapStore((state) => state.selectedCountryId);
    const markers = useMapStore((state) => state.markers);

    useEffect(() => {
        const image = new Image();
        setImageError(false);
        image.onerror = () => setImageError(true);
        image.src = backgroundUrl;
        return () => {
            image.onerror = null;
        };
    }, [backgroundUrl]);

    useEffect(() => {
        const element = viewport.current!;
        const observer = new ResizeObserver(([entry]) => {
            const next = {
                width: entry.contentRect.width,
                height: entry.contentRect.height * zoomRef.current,
            };
            const state = useMapStore.getState();
            state.setCamera(
                sizeRef.current.height === 0 && initialLongitude !== undefined
                    ? constrainCamera(
                          { x: next.width / 2 - project(initialLongitude, 0).x * fitScale(next) },
                          next,
                      )
                    : resizeCamera(state.camera, sizeRef.current, next),
            );
            sizeRef.current = next;
            setSize({ width: next.width, height: next.height / zoomRef.current });
            cameraYRef.current = Math.max(
                next.height / zoomRef.current - next.height,
                Math.min(0, cameraYRef.current),
            );
            setCameraY(cameraYRef.current);
            gesture.current = null;
            setDragging(false);
        });
        observer.observe(element);
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            if (gesture.current) return;
            const factor =
                event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
            const nextZoom = Math.max(
                1,
                Math.min(3, zoomRef.current * Math.exp(-event.deltaY * factor * 0.001)),
            );
            if (nextZoom === zoomRef.current) return;
            const bounds = element.getBoundingClientRect();
            const anchorX = event.clientX - bounds.left;
            const anchorY = event.clientY - bounds.top;
            const previous = sizeRef.current;
            const next = { width: previous.width, height: element.clientHeight * nextZoom };
            const previousLeft = (previous.width - visibleWidth(previous)) / 2;
            const nextLeft = (next.width - visibleWidth(next)) / 2;
            const ratio = nextZoom / zoomRef.current;
            const camera = useMapStore.getState().camera;
            useMapStore.getState().setCamera(
                constrainCamera(
                    { x: anchorX - nextLeft - (anchorX - previousLeft - camera.x) * ratio },
                    next,
                ),
            );
            cameraYRef.current = Math.max(
                element.clientHeight - next.height,
                Math.min(0, anchorY - (anchorY - cameraYRef.current) * ratio),
            );
            setCameraY(cameraYRef.current);
            zoomRef.current = nextZoom;
            sizeRef.current = next;
            setZoom(nextZoom);
        };
        element.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            observer.disconnect();
            element.removeEventListener('wheel', onWheel);
        };
    }, [initialLongitude]);

    function pointerDown(event: PointerEvent<HTMLDivElement>) {
        if (
            event.target instanceof Element &&
            event.target.closest('[data-marker], button, [data-map-controls]')
        )
            return;
        if (event.button !== 0 || gesture.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            cameraX: camera.x,
            cameraY,
            moved: false,
            countryId: countryAt(event.target),
        };
    }

    function pointerMove(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;
        if (Math.hypot(dx, dy) > 5) current.moved = true;
        if (!current.moved) return;
        setDragging(true);
        useMapStore.getState().setCamera(constrainCamera({ x: current.cameraX + dx }, sizeRef.current));
        const nextY = limitY(current.cameraY + dy);
        cameraYRef.current = nextY;
        setCameraY(nextY);
        current.startX = event.clientX;
        current.startY = event.clientY;
        current.cameraX = useMapStore.getState().camera.x;
        current.cameraY = nextY;
    }

    function pointerUp(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const endedOn = countryAt(document.elementFromPoint(event.clientX, event.clientY));
        if (
            !current.moved &&
            Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <= 5 &&
            current.countryId === endedOn
        ) {
            useMapStore.getState().selectCountry(endedOn);
            if (endedOn) onCountrySelect?.(endedOn);
        }
        endGesture();
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    function endGesture() {
        gesture.current = null;
        setDragging(false);
    }

    function keyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.target instanceof Element && event.target.closest('button, [data-map-controls]'))
            return;
        const state = useMapStore.getState();
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            cameraYRef.current = limitY(cameraYRef.current + (event.key === 'ArrowUp' ? 80 : -80));
            setCameraY(cameraYRef.current);
            return;
        }
        const offset = { ArrowLeft: 80, ArrowRight: -80 }[event.key];
        if (offset) {
            event.preventDefault();
            state.setCamera(constrainCamera({ x: camera.x + offset }, renderSize));
        } else if (event.key === 'Home') {
            event.preventDefault();
            state.setCamera(centerCamera(renderSize));
            cameraYRef.current = (size.height - renderSize.height) / 2;
            setCameraY(cameraYRef.current);
        } else if (event.key === 'Escape') {
            state.selectCountry(null);
        }
    }

    const scale = fitScale(renderSize);
    const selectedCountry = countries.find((country) => country.id === selected);
    const period = WORLD_WIDTH * scale;
    const displayWidth = visibleWidth(renderSize);
    const left = (size.width - displayWidth) / 2;
    const tiles = scale > 0 ? (camera.x + period < displayWidth ? [0, 1] : [0]) : [];
    const countryLayer = useMemo(
        () => (
            <g className={styles.countries}>
                {countries.map((country) => (
                    <path
                        key={country.id}
                        d={country.path}
                        data-country={country.id}
                        data-control-status={countryStates?.[country.id]?.controlStatus}
                        style={
                            countryStates?.[country.id]
                                ? {
                                      fill: `rgb(var(--color-territory-rgb) / ${countryStates[country.id].controlStatus === 'controlled' ? 0.52 : (countryStates[country.id].aiInfiltration / 100) * 0.25})`,
                                  }
                                : undefined
                        }
                        className={country.id === selected ? styles.selected : undefined}
                        fillRule="evenodd"
                        vectorEffect="non-scaling-stroke"
                        tabIndex={0}
                        role="button"
                        aria-label={country.name}
                        aria-pressed={country.id === selected}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                useMapStore.getState().selectCountry(country.id);
                                onCountrySelect?.(country.id);
                            }
                        }}
                    >
                        <title>{country.name}</title>
                    </path>
                ))}
            </g>
        ),
        [countries, countryStates, selected, onCountrySelect],
    );
    return (
        <div
            ref={viewport}
            className={`${styles.viewport} ${dragging ? styles.dragging : ''}`}
            tabIndex={0}
            role="region"
            aria-label="世界地図。ドラッグと矢印キーで移動。拡大時は縦にも移動できます。Homeで中央へ、Escapeで選択解除。"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={endGesture}
            onLostPointerCapture={endGesture}
            onKeyDown={keyDown}
            onContextMenu={(event) => event.preventDefault()}
        >
            <div
                style={{
                    position: 'absolute',
                    top: cameraY,
                    width: '100%',
                    height: renderSize.height,
                }}
            >
                <div
                    className={styles.background}
                    data-map-background={backgroundUrl}
                    aria-hidden="true"
                    style={{
                        left,
                        width: displayWidth,
                        height: renderSize.height,
                        backgroundImage: `url("${backgroundUrl}")`,
                        backgroundSize: `${period}px ${renderSize.height}px`,
                        backgroundPosition: `${camera.x}px 0`,
                    }}
                />
                <OceanSurface
                    size={renderSize}
                    cameraX={camera.x}
                    speed={trafficSpeed}
                    tick={trafficTick}
                />
                <TrafficLayer
                    size={renderSize}
                    cameraX={camera.x}
                    speed={trafficSpeed}
                    tick={trafficTick}
                    countries={countryStates}
                />
                <svg className={styles.map} width="100%" height="100%" aria-label="国境と地形">
                    <defs>
                        <clipPath id={clipId}>
                            <rect x={left} y="0" width={displayWidth} height={renderSize.height} />
                        </clipPath>
                    </defs>
                    <g clipPath={`url(#${clipId})`} data-map-viewport="true">
                        {tiles.map((tile) => (
                            <g
                                key={tile}
                                transform={`translate(${left + camera.x + tile * period} 0) scale(${scale})`}
                                data-map-layer="world"
                                data-world-tile={tile}
                            >
                                {countryLayer}
                                {selectedCountry && (
                                    <path
                                        d={selectedCountry.path}
                                        className={styles.selectedOutline}
                                        data-selected-outline={selectedCountry.id}
                                        vectorEffect="non-scaling-stroke"
                                        aria-hidden="true"
                                    />
                                )}
                                {scale > 0 && (
                                    <MarkerLayer markers={markers} scale={scale} facilityStates={facilityStates} />
                                )}
                            </g>
                        ))}
                    </g>
                </svg>
            </div>
            <span className={styles.screenReaderOnly} aria-live="polite">
                {selected
                    ? `${countries.find((country) => country.id === selected)?.name}を選択中`
                    : '国は選択されていません'}
            </span>
            {imageError && (
                <p className={styles.error} role="alert">
                    背景画像を読み込めませんでした。地図アセットの配置を確認してください。
                </p>
            )}
        </div>
    );
}
