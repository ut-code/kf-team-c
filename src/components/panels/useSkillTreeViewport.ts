import { useLayoutEffect, useRef, useState } from 'react';

const INITIAL_ZOOM = 0.85;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.5;

export function useSkillTreeViewport(treeWidth: number, treeHeight: number) {
    const viewport = useRef<HTMLElement>(null);
    const [size, setSize] = useState({ width: 1, height: 1 });
    const [zoom, setZoom] = useState(INITIAL_ZOOM);
    const canvasWidth = Math.max(treeWidth, size.width / zoom);
    const canvasHeight = Math.max(treeHeight, size.height / zoom);
    const renderedWidth = canvasWidth * zoom;
    const renderedHeight = canvasHeight * zoom;
    const previous = useRef<{
        width: number;
        height: number;
        viewportWidth: number;
        viewportHeight: number;
        zoom: number;
    } | null>(null);
    const anchor = useRef<{ x: number; y: number; worldX: number; worldY: number } | null>(null);

    useLayoutEffect(() => {
        const element = viewport.current!;
        const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        if (size.width <= 1 || size.height <= 1) return;
        const element = viewport.current!;
        const old = previous.current;
        const point = anchor.current;
        // 拡大縮小は操作位置を基準にし、リサイズ・配置変更では表示の中心を保つ。
        element.scrollTo(
            point
                ? renderedWidth / 2 + point.worldX * zoom - point.x
                : old
                  ? element.scrollLeft +
                    (renderedWidth - old.width - size.width + old.viewportWidth) / 2
                  : (renderedWidth - size.width) / 2,
            point
                ? renderedHeight / 2 + point.worldY * zoom - point.y
                : old
                  ? element.scrollTop +
                    (renderedHeight - old.height - size.height + old.viewportHeight) / 2
                  : (renderedHeight - size.height) / 2,
        );
        anchor.current = null;
        previous.current = {
            width: renderedWidth,
            height: renderedHeight,
            viewportWidth: size.width,
            viewportHeight: size.height,
            zoom,
        };
    }, [renderedWidth, renderedHeight, size.width, size.height, zoom]);

    useLayoutEffect(() => {
        const element = viewport.current!;
        const zoomAt = (factor: number, clientX: number, clientY: number) => {
            const old = previous.current;
            if (!old) return;
            const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, old.zoom * factor));
            if (next === old.zoom) return;
            const rect = element.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            anchor.current = {
                x,
                y,
                worldX: (element.scrollLeft + x - old.width / 2) / old.zoom,
                worldY: (element.scrollTop + y - old.height / 2) / old.zoom,
            };
            setZoom(next);
        };
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            const delta =
                event.deltaY *
                (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
            zoomAt(Math.exp(-delta * 0.002), event.clientX, event.clientY);
        };
        const gesture = (touches: TouchList) => {
            const first = touches[0];
            const second = touches[1] ?? first;
            return {
                x: (first.clientX + second.clientX) / 2,
                y: (first.clientY + second.clientY) / 2,
                distance:
                    touches.length > 1
                        ? Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
                        : 0,
                count: touches.length,
            };
        };
        let touch: ReturnType<typeof gesture> | null = null;
        const touchStart = (event: TouchEvent) => {
            touch = gesture(event.touches);
        };
        const touchMove = (event: TouchEvent) => {
            if (!touch || !event.touches.length) return;
            event.preventDefault();
            const next = gesture(event.touches);
            if (touch.count === next.count) {
                element.scrollLeft += touch.x - next.x;
                element.scrollTop += touch.y - next.y;
                if (touch.distance > 0 && next.distance > 0) {
                    zoomAt(next.distance / touch.distance, next.x, next.y);
                }
            }
            touch = next;
        };
        const touchEnd = (event: TouchEvent) => {
            touch = event.touches.length ? gesture(event.touches) : null;
        };
        element.addEventListener('wheel', wheel, { passive: false });
        element.addEventListener('touchstart', touchStart, { passive: true });
        element.addEventListener('touchmove', touchMove, { passive: false });
        element.addEventListener('touchend', touchEnd);
        element.addEventListener('touchcancel', touchEnd);
        return () => {
            element.removeEventListener('wheel', wheel);
            element.removeEventListener('touchstart', touchStart);
            element.removeEventListener('touchmove', touchMove);
            element.removeEventListener('touchend', touchEnd);
            element.removeEventListener('touchcancel', touchEnd);
        };
    }, []);

    return { viewport, size, zoom, canvasWidth, canvasHeight, renderedWidth, renderedHeight };
}
