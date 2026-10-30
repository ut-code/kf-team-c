import { WORLD_HEIGHT, WORLD_WIDTH } from './geometry.ts';
import type { MapMarker, MapRegion } from './types.ts';

export interface MapView {
    width: number;
    height: number;
    zoom: number;
    x: number;
    y: number;
}
export interface Bounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export interface Ring {
    points: Float32Array;
    bounds: Bounds;
}
export interface RegionShape {
    region: MapRegion;
    rings: Ring[];
}
export interface VisibleMarker {
    marker: MapMarker;
    x: number;
    y: number;
}

export function viewTransform(view: MapView) {
    const scale = (view.height * view.zoom) / WORLD_HEIGHT;
    const period = WORLD_WIDTH * scale;
    const width = Math.min(view.width, period);
    return {
        scale,
        period,
        width,
        left: (view.width - width) / 2,
        height: view.height * view.zoom,
    };
}

export function worldPoint(view: MapView, x: number, y: number) {
    const t = viewTransform(view);
    if (!t.scale || x < t.left || x > t.left + t.width || y < view.y || y > view.y + t.height)
        return null;
    return {
        x: ((((x - t.left - view.x) / t.scale) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH,
        y: (y - view.y) / t.scale,
    };
}

export function screenPoint(view: MapView, x: number, y: number) {
    const t = viewTransform(view);
    return {
        x: t.left + ((((x * t.scale + view.x) % t.period) + t.period) % t.period),
        y: y * t.scale + view.y,
    };
}

export function visibleBounds(bounds: Bounds, view: MapView, margin = 0) {
    const t = viewTransform(view);
    if (
        bounds.bottom * t.scale + view.y < -margin ||
        bounds.top * t.scale + view.y > view.height + margin
    )
        return false;
    for (const tile of [0, 1]) {
        const left = t.left + view.x + tile * t.period;
        if (
            bounds.right * t.scale + left >= t.left - margin &&
            bounds.left * t.scale + left <= t.left + t.width + margin
        )
            return true;
    }
    return false;
}

export function parseRegions(regions: MapRegion[]): RegionShape[] {
    return regions.map((region) => ({
        region,
        rings: [...region.path.matchAll(/M([^Z]+)Z/g)].map((match) => {
            const numbers = match[1].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
            const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
            for (let i = 0; i < numbers.length; i += 2) {
                bounds.left = Math.min(bounds.left, numbers[i]);
                bounds.right = Math.max(bounds.right, numbers[i]);
                bounds.top = Math.min(bounds.top, numbers[i + 1]);
                bounds.bottom = Math.max(bounds.bottom, numbers[i + 1]);
            }
            return { points: new Float32Array(numbers), bounds };
        }),
    }));
}

/** 穴を含む既存SVGと同じ偶奇規則。地形の解析は読み込み時に一度だけ行う。 */
export function regionAtPoint(shapes: RegionShape[], x: number, y: number): string | null {
    for (let c = shapes.length - 1; c >= 0; c--) {
        let inside = false;
        for (const { points: p, bounds: b } of shapes[c].rings) {
            if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
            for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
                if (
                    p[i + 1] > y !== p[j + 1] > y &&
                    x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]
                )
                    inside = !inside;
            }
        }
        if (inside) return shapes[c].region.id;
    }
    return null;
}

/** 端をまたいでも、実際に画面へ入る施設だけを個別表示する。 */
export function cullMarkers(
    markers: { marker: MapMarker; x: number; y: number }[],
    view: MapView,
): VisibleMarker[] {
    const t = viewTransform(view),
        result: VisibleMarker[] = [];
    for (const item of markers) {
        const screen = screenPoint(view, item.x, item.y);
        if (screen.y < -24 || screen.y > view.height + 24) continue;
        for (const dx of [-t.period, 0, t.period]) {
            const x = screen.x + dx;
            if (x >= t.left - 24 && x <= t.left + t.width + 24)
                result.push({ marker: item.marker, x, y: screen.y });
        }
    }
    return result;
}

/** 拡大率によらず、画面内のピクセル数だけを確保する。 */
export function renderSize(view: MapView, pixelRatio: number, maxPixels = 4_147_200) {
    const ratio = Math.min(pixelRatio, 1.5, Math.sqrt(maxPixels / (view.width * view.height)));
    return {
        width: Math.max(1, Math.floor(view.width * ratio)),
        height: Math.max(1, Math.floor(view.height * ratio)),
        ratio,
    };
}
