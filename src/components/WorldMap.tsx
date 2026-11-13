import type { KeyboardEvent, PointerEvent } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AreaState } from '../game/types';
import {
    centerCamera,
    constrainCamera,
    fitScale,
    project,
    resizeCamera,
    visibleWidth,
    WORLD_HEIGHT,
    WORLD_WIDTH,
} from '../map/geometry';
import { type MapTarget, WorldRenderer } from '../map/rendering/WorldRenderer';
import type { MapRegion, PublishedResearch } from '../map/types';
import type { MapView } from '../map/view';
import { useMapStore } from '../state/mapStore';
import { MapMetricChanges } from './MapMetricChanges';
import { type MapEncounter, MapEncounterMarkers } from './society/MapEncounterMarkers';
import styles from './WorldMap.module.css';

interface Gesture {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    target: MapTarget | null;
}

interface TouchPoint {
    x: number;
    y: number;
}

function pinchPosition(points: Map<number, TouchPoint>) {
    const [first, second] = [...points.values()];
    return {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        distance: Math.hypot(second.x - first.x, second.y - first.y),
    };
}

/** 縦横のどちらも画面内に収まる倍率。 */
function overviewZoom(width: number, height: number) {
    return Math.min(1, (width * WORLD_HEIGHT) / (height * WORLD_WIDTH));
}

/** Reactは操作と読み上げを担当し、地図の全画像は一つのWebGL描画へ渡す。 */
export const WorldMap = memo(function WorldMap({
    regions,
    selectedArea,
    backgroundUrl,
    waterMaskUrl,
    surfaceMaskUrl,
    countryIndexUrl,
    areaIndexUrl,
    invasionUrl,
    areaStates,
    serverArea,
    onAreaSelect,
    initialLongitude,
    trafficSpeed,
    trafficTick,
    showTraffic = true,
    showNetwork = true,
    publishedResearch,
    onAreaInspect,
    encounters = [],
    onEncounterSelect,
}: {
    regions: MapRegion[];
    selectedArea: number | null;
    backgroundUrl: string;
    waterMaskUrl: string;
    surfaceMaskUrl: string;
    countryIndexUrl: string;
    areaIndexUrl: string;
    invasionUrl: string;
    areaStates: AreaState[];
    serverArea: number;
    onAreaSelect?: (id: number | null) => void;
    initialLongitude?: number;
    trafficSpeed: number;
    trafficTick: number;
    showTraffic?: boolean;
    showNetwork?: boolean;
    publishedResearch: PublishedResearch[];
    onAreaInspect?: (id: number | null) => void;
    encounters?: MapEncounter[];
    onEncounterSelect?: (id: string, anchorX?: number, anchorY?: number) => void;
}) {
    const viewport = useRef<HTMLDivElement>(null),
        canvas = useRef<HTMLCanvasElement>(null);
    const renderer = useRef<WorldRenderer | null>(null);
    const view = useRef<MapView>({ width: 0, height: 0, zoom: 1, x: 0, y: 0 });
    const gesture = useRef<Gesture | null>(null);
    const pointers = useRef(new Map<number, TouchPoint>());
    const pinch = useRef<ReturnType<typeof pinchPosition> | null>(null);
    const [dragging, setDragging] = useState(false),
        [error, setError] = useState<string | null>(null),
        [ready, setReady] = useState(false);
    const [markerView, setMarkerView] = useState<MapView>({ ...view.current });
    const [targets, setTargets] = useState<MapTarget[]>([]);
    const camera = useMapStore((state) => state.camera);
    const selected = useMapStore((state) => state.selectedAreaId);

    useLayoutEffect(() => {
        try {
            const engine = new WorldRenderer(canvas.current!, {
                ready: () => {
                    setReady(true);
                    setError(null);
                },
                error: (reason) =>
                    setError(reason instanceof Error ? reason.message : String(reason)),
                targets: setTargets,
                presented: (nextView) => {
                    // ポインター入力時には先行させず、WebGL描画直後にDOMを確定する。
                    flushSync(() => setMarkerView(nextView));
                },
            });
            renderer.current = engine;
            return () => {
                renderer.current = null;
                engine.dispose();
            };
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
    }, []);

    useLayoutEffect(() => {
        renderer.current?.setData({
            regions,
            areaStates,
            serverArea,
            selectedArea,
            speed: trafficSpeed,
            tick: trafficTick,
            showTraffic,
            showNetwork,
            publishedResearch,
        });
    }, [
        regions,
        areaStates,
        serverArea,
        selectedArea,
        trafficSpeed,
        trafficTick,
        showTraffic,
        showNetwork,
        publishedResearch,
    ]);

    useEffect(() => {
        if (!renderer.current) return;
        setReady(false);
        setError(null);
        renderer.current?.setScene({
            regions,
            backgroundUrl,
            waterMaskUrl,
            surfaceMaskUrl,
            countryIndexUrl,
            areaIndexUrl,
            invasionUrl,
        });
    }, [
        regions,
        backgroundUrl,
        waterMaskUrl,
        surfaceMaskUrl,
        countryIndexUrl,
        areaIndexUrl,
        invasionUrl,
    ]);

    useLayoutEffect(() => {
        if (gesture.current) return;
        view.current.x = camera.x;
        renderer.current?.setView(view.current);
    }, [camera.x]);

    const limitY = useCallback((y: number) => {
        const { height, zoom } = view.current;
        if (zoom <= 1) return (height * (1 - zoom)) / 2;
        return Math.max(height * (1 - zoom), Math.min(0, y));
    }, []);
    const applyView = useCallback(() => {
        renderer.current?.setView(view.current);
    }, []);

    const zoomAt = useCallback(
        (requestedZoom: number, x: number, y: number, nextX = x, nextY = y) => {
            const current = view.current;
            const minimum = overviewZoom(current.width, current.height);
            const zoom = Math.max(minimum, Math.min(Math.max(1, minimum) * 3, requestedZoom));
            const oldSize = { width: current.width, height: current.height * current.zoom };
            const nextSize = { width: current.width, height: current.height * zoom };
            const left = (current.width - visibleWidth(oldSize)) / 2;
            const nextLeft = (current.width - visibleWidth(nextSize)) / 2;
            const ratio = zoom / current.zoom;
            current.x = constrainCamera(
                { x: nextX - nextLeft - (x - left - current.x) * ratio },
                nextSize,
            ).x;
            current.y = nextY - (y - current.y) * ratio;
            current.zoom = zoom;
            current.y = limitY(current.y);
            useMapStore.getState().setCamera({ x: current.x });
            applyView();
        },
        [applyView, limitY],
    );

    const showOverview = () => {
        const current = view.current;
        current.zoom = overviewZoom(current.width, current.height);
        current.x = centerCamera({ width: current.width, height: current.height * current.zoom }).x;
        current.y = limitY(0);
        useMapStore.getState().setCamera({ x: current.x });
        applyView();
    };

    useEffect(() => {
        const element = viewport.current!;
        const observer = new ResizeObserver(([entry]) => {
            const current = view.current;
            const previous = { width: current.width, height: current.height * current.zoom };
            const minimumZoom = overviewZoom(entry.contentRect.width, entry.contentRect.height);
            const relativeZoom =
                current.height === 0
                    ? 1
                    : current.zoom / overviewZoom(current.width, current.height);
            current.zoom = minimumZoom * relativeZoom;
            const next = {
                width: entry.contentRect.width,
                height: entry.contentRect.height * current.zoom,
            };
            const nextCamera =
                previous.height === 0 && initialLongitude !== undefined
                    ? constrainCamera(
                          {
                              x:
                                  visibleWidth(next) / 2 -
                                  project(initialLongitude, 0).x * fitScale(next),
                          },
                          next,
                      )
                    : resizeCamera({ x: current.x }, previous, next);
            current.width = next.width;
            current.height = entry.contentRect.height;
            current.x = nextCamera.x;
            current.y = limitY(current.y);
            gesture.current = null;
            pointers.current.clear();
            pinch.current = null;
            setDragging(false);
            useMapStore.getState().setCamera(nextCamera);
            applyView();
        });
        observer.observe(element);
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            if (pointers.current.size) return;
            const current = view.current;
            const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? current.height : 1;
            const bounds = element.getBoundingClientRect(),
                x = event.clientX - bounds.left,
                y = event.clientY - bounds.top;
            zoomAt(current.zoom * Math.exp(-event.deltaY * factor * 0.001), x, y);
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => {
            observer.disconnect();
            element.removeEventListener('wheel', wheel);
        };
    }, [initialLongitude, limitY, applyView, zoomAt]);

    const select = (target: MapTarget | null) => {
        useMapStore.getState().selectArea(target?.area ?? null);
        onAreaSelect?.(target?.area ?? null);
    };
    const point = (event: PointerEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const hover = (target: MapTarget | null) => {
        renderer.current?.setHover(target);
        onAreaInspect?.(target?.area ?? null);
        if (canvas.current) canvas.current.title = target?.label ?? '';
    };
    function pointerDown(event: PointerEvent<HTMLDivElement>) {
        if (
            event.button !== 0 ||
            pointers.current.size >= 2 ||
            !ready ||
            (event.target instanceof Element && event.target.closest('button'))
        )
            return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const p = point(event),
            current = view.current;
        pointers.current.set(event.pointerId, p);
        if (pointers.current.size === 2) {
            // 2本目の指が触れたらタップ選択を無効にし、指の中心を基準に拡縮する。
            pinch.current = pinchPosition(pointers.current);
            gesture.current = null;
            setDragging(true);
            hover(null);
            return;
        }
        gesture.current = {
            pointerId: event.pointerId,
            startX: p.x,
            startY: p.y,
            originX: current.x,
            originY: current.y,
            moved: false,
            target: renderer.current!.hitTest(p.x, p.y),
        };
    }
    function pointerMove(event: PointerEvent<HTMLDivElement>) {
        const p = point(event);
        if (pointers.current.has(event.pointerId)) {
            pointers.current.set(event.pointerId, p);
            if (pointers.current.size === 2 && pinch.current) {
                const previous = pinch.current;
                const next = pinchPosition(pointers.current);
                if (previous.distance > 0 && next.distance > 0) {
                    zoomAt(
                        (view.current.zoom * next.distance) / previous.distance,
                        previous.x,
                        previous.y,
                        next.x,
                        next.y,
                    );
                }
                pinch.current = next;
                return;
            }
        }
        const current = gesture.current;
        if (!current) {
            if (event.pointerType === 'touch') return;
            if (event.target instanceof Element && event.target.closest('button')) {
                hover(null);
                event.currentTarget.style.cursor = '';
                return;
            }
            const target = renderer.current?.hitTest(p.x, p.y) ?? null;
            hover(target);
            event.currentTarget.style.cursor = target ? 'pointer' : '';
            return;
        }
        if (current.pointerId !== event.pointerId) return;
        const dx = p.x - current.startX,
            dy = p.y - current.startY;
        if (!current.moved && Math.hypot(dx, dy) <= 5) return;
        if (!current.moved) {
            current.moved = true;
            setDragging(true);
            hover(null);
            event.currentTarget.style.cursor = 'grabbing';
        }
        const value = view.current;
        value.x = constrainCamera(
            { x: current.originX + dx },
            { width: value.width, height: value.height * value.zoom },
        ).x;
        value.y = limitY(current.originY + dy);
        applyView();
    }
    function finishPointer(event: PointerEvent<HTMLDivElement>, allowSelect: boolean) {
        if (!pointers.current.has(event.pointerId)) return;
        const current = gesture.current;
        const p = point(event),
            target = renderer.current!.hitTest(p.x, p.y);
        if (
            allowSelect &&
            current?.pointerId === event.pointerId &&
            !current.moved &&
            Math.hypot(p.x - current.startX, p.y - current.startY) <= 5 &&
            target?.id === current.target?.id &&
            target?.kind === current.target?.kind
        )
            select(target);
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        useMapStore.getState().setCamera({ x: view.current.x });
        const remaining = pointers.current.entries().next().value;
        // ピンチ後に1本だけ残っても、現在位置から連続してドラッグできるようにする。
        gesture.current = remaining
            ? {
                  pointerId: remaining[0],
                  startX: remaining[1].x,
                  startY: remaining[1].y,
                  originX: view.current.x,
                  originY: view.current.y,
                  moved: true,
                  target: null,
              }
            : null;
        setDragging(Boolean(remaining));
        if (!remaining) event.currentTarget.style.cursor = '';
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }
    function keyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.target instanceof Element && event.target.closest('button')) return;
        const current = view.current,
            size = { width: current.width, height: current.height * current.zoom };
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            current.y = limitY(current.y + (event.key === 'ArrowUp' ? 80 : -80));
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
            current.x = constrainCamera(
                { x: current.x + (event.key === 'ArrowLeft' ? 80 : -80) },
                size,
            ).x;
        else if (event.key === 'Home') {
            showOverview();
        } else if (event.key === 'Escape') {
            useMapStore.getState().selectArea(null);
            return;
        } else return;
        event.preventDefault();
        useMapStore.getState().setCamera({ x: current.x });
        applyView();
    }

    return (
        <div
            ref={viewport}
            className={`${styles.viewport} ${dragging ? styles.dragging : ''}`}
            data-animation-speed={trafficSpeed}
            tabIndex={0}
            role="region"
            aria-label={`世界地図。通信線は${showTraffic ? '表示' : '非表示'}。ドラッグと矢印キーで移動。2本指のピンチとホイールで拡大縮小、Homeで世界全体へ、Escapeで小地域の選択解除。`}
            aria-busy={!ready}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={(event) => finishPointer(event, true)}
            onPointerCancel={(event) => finishPointer(event, false)}
            onLostPointerCapture={(event) => finishPointer(event, false)}
            onPointerLeave={() => {
                if (!pointers.current.size) hover(null);
            }}
            onKeyDown={keyDown}
            onContextMenu={(event) => event.preventDefault()}
        >
            <canvas
                ref={canvas}
                className={styles.canvas}
                aria-hidden="true"
                data-world-renderer="webgl"
            />
            {!ready && !error && (
                <p className={`${styles.loading} glass`} role="status">
                    世界地図を読み込んでいます…
                </p>
            )}
            {ready && (
                <MapEncounterMarkers
                    encounters={encounters}
                    view={markerView}
                    onSelect={onEncounterSelect}
                />
            )}
            <MapMetricChanges
                speed={trafficSpeed}
                areaStates={areaStates}
                regions={regions}
                tick={trafficTick}
                serverArea={serverArea}
                view={markerView}
            />
            <div className={styles.screenReaderOnly} role="group" aria-label="画面内の小地域">
                {targets.map((target) => (
                    <button
                        type="button"
                        key={`${target.kind}:${target.id}`}
                        aria-pressed={selected === target.area}
                        onFocus={() => hover(target)}
                        onBlur={() => hover(null)}
                        onClick={() => select(target)}
                    >
                        {target.label}
                    </button>
                ))}
            </div>
            <span className={styles.screenReaderOnly} aria-live="polite">
                {selected !== null ? '小地域を選択中' : '小地域は選択されていません'}
            </span>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
        </div>
    );
});
