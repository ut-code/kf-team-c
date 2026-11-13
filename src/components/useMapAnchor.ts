import { type RefObject, useLayoutEffect } from 'react';
import { project } from '../map/geometry';
import { screenPoint } from '../map/view';
import { useMapStore } from '../state/mapStore';

export interface MapLocation {
    longitude: number;
    latitude: number;
}

/** 開いた時の配置を保ち、描画済みの地図と同じ座標変換でパネルを動かす。 */
export function useMapAnchor(ref: RefObject<HTMLElement | null>, location?: MapLocation) {
    const longitude = location?.longitude;
    const latitude = location?.latitude;
    useLayoutEffect(() => {
        if (longitude === undefined || latitude === undefined || !ref.current) return;
        const element = ref.current;
        const world = project(longitude, latitude);
        let offset: { x: number; y: number } | null = null;
        let size = { width: 0, height: 0 };
        const position = () => {
            const frame = useMapStore.getState().presentedMap;
            if (!frame) return;
            if (size.width !== frame.view.width || size.height !== frame.view.height) {
                offset = null;
                size = { width: frame.view.width, height: frame.view.height };
            }
            const point = screenPoint(frame.view, world.x, world.y);
            const x = frame.left + point.x;
            const y = frame.top + point.y;
            if (!offset) {
                const { width, height } = element.getBoundingClientRect();
                const margin = window.innerWidth <= 700 ? 8 : 18;
                const preferred =
                    x + 28 + width <= window.innerWidth - margin ? x + 28 : x - 28 - width;
                offset = {
                    x:
                        Math.max(margin, Math.min(window.innerWidth - width - margin, preferred)) -
                        x,
                    y: Math.max(margin, Math.min(window.innerHeight - height - margin, y - 32)) - y,
                };
            }
            element.style.left = `${x + offset.x}px`;
            element.style.top = `${y + offset.y}px`;
        };
        // 左右指定で幅を決めるスマホの地域パネルも、移動中は幅を変えない。
        element.style.width = `${element.getBoundingClientRect().width}px`;
        element.style.position = 'fixed';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';
        const resize = () => {
            offset = null;
            position();
        };
        const resizeViewport = () => {
            for (const property of ['width', 'left', 'right'])
                element.style.removeProperty(property);
            element.style.width = `${element.getBoundingClientRect().width}px`;
            element.style.right = 'auto';
            resize();
        };
        position();
        const unsubscribe = useMapStore.subscribe(position);
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        window.addEventListener('resize', resizeViewport);
        return () => {
            unsubscribe();
            observer.disconnect();
            window.removeEventListener('resize', resizeViewport);
            for (const property of [
                'position',
                'left',
                'top',
                'right',
                'bottom',
                'transform',
                'width',
            ])
                element.style.removeProperty(property);
        };
    }, [ref, longitude, latitude]);
}
