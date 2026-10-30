import world from '../game/data/world.json' with { type: 'json' };

interface CountryStatistics {
    internet: number | null;
    employment: number | null;
    agriculture: number | null;
    industry: number | null;
    services: number | null;
}

import type { Population } from '../game/types.ts';
import { geographicDistance, project } from './geometry.ts';

export function randomSource(seed: number) {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4_294_967_296;
    };
}

/** 位置と人口属性はオフラインで生成した実統計を使用し、地図上で乱数配置しない。 */
export function createPopulation(): Population[] {
    const countries = world.countries as Record<string, CountryStatistics>;
    const points = world.points.map((source, id): Population => {
        const profile = countries[source.country];
        const internet = profile.internet === null ? null : profile.internet / 100;
        const employment = profile.employment === null ? null : profile.employment / 100;
        const q = (id * 0.61803398875) % 1;
        const employed =
            source.age !== null && source.age >= 15 && employment !== null && q < employment;
        const online = internet !== null && (id * 0.41421356237) % 1 < internet;
        const field =
            source.age !== null && source.age < 15
                ? 0
                : source.age !== null && source.age >= 65
                  ? 3
                  : employed
                    ? 1
                    : online
                      ? 2
                      : 4;
        let sector: Population['sector'] = null;
        if (
            employed &&
            profile.agriculture !== null &&
            profile.industry !== null &&
            profile.services !== null
        ) {
            const share =
                ((id * 0.73205080757) % 1) *
                (profile.agriculture + profile.industry + profile.services);
            sector =
                share < profile.agriculture
                    ? 'agriculture'
                    : share < profile.agriculture + profile.industry
                      ? 'industry'
                      : 'services';
        }
        // 以降は観測値ではなくゲームの反応モデル。AIへの態度を国別に捏造しない。
        const densityEffect = Math.min(1, Math.log10(Math.max(1, source.density)) / 4);
        const susceptibility =
            0.75 + (internet === null ? 0 : internet * 0.2) + densityEffect * 0.15;
        return {
            id,
            area: source.area,
            ...project(source.longitude, source.latitude),
            age: source.age,
            country: source.country,
            weight: source.weight,
            density: source.density,
            cellPopulation: source.cellPopulation,
            internet,
            employment,
            sector,
            field,
            refusalMonths: 0,
            susceptibility,
            progress: 0.1 + (internet === null ? 0 : internet * 0.55),
            stage: 0,
            neighbors: [],
        };
    });
    for (const point of points) {
        point.neighbors = points
            .filter((other) => other.id !== point.id && other.area === point.area)
            .map((other) => ({
                id: other.id,
                distance: geographicDistance(world.points[point.id], world.points[other.id]),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
            .map((other) => other.id);
    }
    return points;
}
