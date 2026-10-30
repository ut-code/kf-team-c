import type { KeyboardEvent, PointerEvent } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import type { MapRegion } from '../map/types';
import type { MapView } from '../map/view';
import { type MapTarget, WorldRenderer } from '../map/WorldRenderer';
import { useMapStore } from '../state/mapStore';
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

/** Reactは操作と読み上げを担当し、地図の全画像は一つのWebGL描画へ渡す。 */
export const WorldMap = memo(function WorldMap({
    regions,
    selectedArea,
    backgroundUrl,
    waterMaskUrl,
    surfaceMaskUrl,
    countryIndexUrl,
    areaIndexUrl,
    onAreaSelect,
    initialLongitude,
    trafficSpeed,
    trafficTick,
    onAreaInspect,
}: {
    regions: MapRegion[];
    selectedArea: number | null;
    backgroundUrl: string;
    waterMaskUrl: string;
    surfaceMaskUrl: string;
    countryIndexUrl: string;
    areaIndexUrl: string;
    onAreaSelect?: (id: number | null) => void;
    initialLongitude?: number;
    trafficSpeed: number;
    trafficTick: number;
    onAreaInspect?: (id: number | null) => void;
}) {
    const viewport = useRef<HTMLDivElement>(null),
        canvas = useRef<HTMLCanvasElement>(null);
    const renderer = useRef<WorldRenderer | null>(null);
    const view = useRef<MapView>({ width: 0, height: 0, zoom: 1, x: 0, y: 0 });
    const gesture = useRef<Gesture | null>(null);
    const [dragging, setDragging] = useState(false),
        [error, setError] = useState<string | null>(null),
        [ready, setReady] = useState(false);
    const [targets, setTargets] = useState<MapTarget[]>([]);
    const camera = useMapStore((state) => state.camera);
    const selected = useMapStore((state) => state.selectedAreaId);
    const selectedMarker = useMapStore((state) => state.selectedMarkerId);
    const markers = useMapStore((state) => state.markers);

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
            markers,
            selectedArea,
            selectedMarker,
            speed: trafficSpeed,
            tick: trafficTick,
        });
    }, [regions, markers, selectedArea, selectedMarker, trafficSpeed, trafficTick]);

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
        });
    }, [regions, backgroundUrl, waterMaskUrl, surfaceMaskUrl, countryIndexUrl, areaIndexUrl]);

    useLayoutEffect(() => {
        if (gesture.current) return;
        view.current.x = camera.x;
        renderer.current?.setView(view.current);
    }, [camera.x]);

    const limitY = useCallback(
        (y: number) => Math.max(view.current.height * (1 - view.current.zoom), Math.min(0, y)),
        [],
    );
    const applyView = useCallback(() => renderer.current?.setView(view.current), []);

    useEffect(() => {
        const element = viewport.current!;
        const observer = new ResizeObserver(([entry]) => {
            const current = view.current;
            const previous = { width: current.width, height: current.height * current.zoom };
            const minimumZoom =
                (entry.contentRect.width * WORLD_HEIGHT) / (entry.contentRect.height * WORLD_WIDTH);
            current.zoom = Math.max(current.zoom, minimumZoom);
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
            setDragging(false);
            useMapStore.getState().setCamera(nextCamera);
            applyView();
        });
        observer.observe(element);
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            if (gesture.current) return;
            const current = view.current;
            const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? current.height : 1;
            const minimumZoom = Math.max(
                1,
                (current.width * WORLD_HEIGHT) / (current.height * WORLD_WIDTH),
            );
            const zoom = Math.max(
                minimumZoom,
                Math.min(minimumZoom * 3, current.zoom * Math.exp(-event.deltaY * factor * 0.001)),
            );
            if (zoom === current.zoom) return;
            const bounds = element.getBoundingClientRect(),
                x = event.clientX - bounds.left,
                y = event.clientY - bounds.top;
            const oldSize = { width: current.width, height: current.height * current.zoom },
                nextSize = { width: current.width, height: current.height * zoom };
            const left = (current.width - visibleWidth(oldSize)) / 2,
                nextLeft = (current.width - visibleWidth(nextSize)) / 2,
                ratio = zoom / current.zoom;
            current.x = constrainCamera(
                { x: x - nextLeft - (x - left - current.x) * ratio },
                nextSize,
            ).x;
            current.y = Math.max(
                current.height - nextSize.height,
                Math.min(0, y - (y - current.y) * ratio),
            );
            current.zoom = zoom;
            useMapStore.getState().setCamera({ x: current.x });
            applyView();
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => {
            observer.disconnect();
            element.removeEventListener('wheel', wheel);
        };
    }, [initialLongitude, limitY, applyView]);

    const select = (target: MapTarget | null) => {
        if (target?.kind === 'marker') useMapStore.getState().selectMarker(target.id);
        else {
            useMapStore.getState().selectArea(target?.area ?? null);
            if (target) onAreaSelect?.(target.area);
        }
    };
    const point = (event: PointerEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const hover = (target: MapTarget | null) => {
        renderer.current?.setHover(target);
        if (target) useMapStore.getState().selectArea(target.area);
        onAreaInspect?.(target?.area ?? null);
        if (canvas.current) canvas.current.title = target?.label ?? '';
    };
    function pointerDown(event: PointerEvent<HTMLDivElement>) {
        if (
            event.button !== 0 ||
            gesture.current ||
            !ready ||
            (event.target instanceof Element && event.target.closest('button'))
        )
            return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        const p = point(event),
            current = view.current;
        gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: current.x,
            originY: current.y,
            moved: false,
            target: renderer.current!.hitTest(p.x, p.y),
        };
    }
    function pointerMove(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current) {
            const p = point(event),
                target = renderer.current?.hitTest(p.x, p.y) ?? null;
            hover(target);
            event.currentTarget.style.cursor = target ? 'pointer' : '';
            return;
        }
        if (current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.startX,
            dy = event.clientY - current.startY;
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
    function endGesture() {
        if (gesture.current?.moved) useMapStore.getState().setCamera({ x: view.current.x });
        gesture.current = null;
        setDragging(false);
        if (viewport.current) viewport.current.style.cursor = '';
    }
    function pointerUp(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const p = point(event),
            target = renderer.current!.hitTest(p.x, p.y);
        if (
            !current.moved &&
            Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <= 5 &&
            target?.id === current.target?.id &&
            target?.kind === current.target?.kind
        )
            select(target);
        endGesture();
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
            current.x = centerCamera(size).x;
            current.y = (current.height - size.height) / 2;
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
            tabIndex={0}
            role="region"
            aria-label="世界地図。ドラッグと矢印キーで移動。ホイールで拡大縮小、Homeで中央へ、Escapeで小地域の選択解除。"
            aria-busy={!ready}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={endGesture}
            onLostPointerCapture={endGesture}
            onPointerLeave={() => {
                if (!gesture.current) hover(null);
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
            <div className={styles.screenReaderOnly} role="group" aria-label="画面内の小地域">
                {targets.map((target) => (
                    <button
                        type="button"
                        key={`${target.kind}:${target.id}`}
                        aria-pressed={
                            target.kind === 'area'
                                ? selected === target.area
                                : selectedMarker === target.id
                        }
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
