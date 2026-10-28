import definitions from '../game/data/transport-routes.json' with { type: 'json' };
import type { CountryState } from '../game/types.ts';
import { project, WORLD_WIDTH } from './geometry.ts';

export interface TrafficRoute {
    id: string;
    kind: 'plane' | 'ship';
    name: string;
    duration: number;
    phase: number;
    originCountry: string;
    destinationCountry: string;
    points: { x: number; y: number; distance: number }[];
    length: number;
}

/** 日付変更線をまたぐ区間を短い側へ展開し、経路上の距離を保存する。 */
export function compileRoute(definition: (typeof definitions)[number]): TrafficRoute {
    let length = 0;
    const points: TrafficRoute['points'] = [];
    for (const [longitude, latitude] of definition.points) {
        const point = project(longitude, latitude);
        const previous = points.at(-1);
        if (previous) {
            point.x += Math.round((previous.x - point.x) / WORLD_WIDTH) * WORLD_WIDTH;
            length += Math.hypot(point.x - previous.x, point.y - previous.y);
        }
        points.push({ ...point, distance: length });
    }
    return { ...definition, kind: definition.kind as TrafficRoute['kind'], points, length };
}

export const TRAFFIC_ROUTES = definitions.map(compileRoute);

/** 両端の社会機能が落ちれば往来も減る。通常の経済状態では多くの便が動く。 */
export function trafficActivity(route: TrafficRoute, countries: Record<string, CountryState>) {
    const endpoints = [countries[route.originCountry], countries[route.destinationCountry]];
    return Math.min(
        1,
        (endpoints.reduce(
            (sum, country) => sum + (country.economy * country.infrastructure) / 10000,
            0,
        ) /
            2) *
            1.4,
    );
}

/** 終点で短く待機し、次の便は反対方向へ進む。乱数やゲームロジックには依存しない。 */
export function trafficPosition(route: TrafficRoute, seconds: number) {
    const cycle = seconds / route.duration + route.phase;
    const journey = cycle % 1.2;
    if (journey >= 1) return null;
    const reverse = Math.floor(cycle / 1.2) % 2 === 1;
    const progress = reverse ? 1 - journey : journey;
    const distance = route.length * progress;
    let index = 1;
    while (index < route.points.length - 1 && route.points[index].distance < distance) index++;
    const a = route.points[index - 1],
        b = route.points[index];
    const t = (distance - a.distance) / (b.distance - a.distance);
    return {
        x: (((a.x + (b.x - a.x) * t) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH,
        y: a.y + (b.y - a.y) * t,
        heading: Math.atan2(b.y - a.y, b.x - a.x) + (reverse ? Math.PI : 0),
        opacity: Math.min(1, journey / 0.025, (1 - journey) / 0.025),
    };
}
