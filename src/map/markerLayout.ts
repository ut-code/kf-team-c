import { project, WORLD_WIDTH } from './geometry.ts';
import type { MapMarker } from './types.ts';

export interface PositionedMarker {
    marker: MapMarker;
    members: MapMarker[];
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
}

/** 画面上で重なる施設を連結し、日付変更線をまたぐ近接も同じグループにする。 */
export function layoutMarkers(markers: MapMarker[], scale: number): PositionedMarker[] {
    const positions = markers.map((marker) => ({
        marker,
        ...project(marker.longitude, marker.latitude),
    }));
    const visited = new Set<number>();
    const result: PositionedMarker[] = [];
    const wrap = (x: number) => x - Math.round(x / WORLD_WIDTH) * WORLD_WIDTH;
    for (let index = 0; index < positions.length; index++) {
        if (visited.has(index)) continue;
        const group = [index];
        visited.add(index);
        for (let cursor = 0; cursor < group.length; cursor++) {
            const current = positions[group[cursor]];
            if (current.marker.kind !== 'facility') continue;
            for (let candidate = 0; candidate < positions.length; candidate++) {
                if (visited.has(candidate)) continue;
                const other = positions[candidate];
                if (
                    other.marker.kind === 'facility' &&
                    Math.abs(wrap(current.x - other.x) * scale) < 34 &&
                    Math.abs((current.y - other.y) * scale) < 34
                ) {
                    group.push(candidate);
                    visited.add(candidate);
                }
            }
        }
        const origin = positions[index];
        const x =
            origin.x +
            group.reduce((sum, item) => sum + wrap(positions[item].x - origin.x), 0) / group.length;
        result.push({
            marker: origin.marker,
            members: group.map((item) => positions[item].marker),
            x: ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH,
            y: group.reduce((sum, item) => sum + positions[item].y, 0) / group.length,
            offsetX: 0,
            offsetY: 0,
        });
    }
    return result;
}
