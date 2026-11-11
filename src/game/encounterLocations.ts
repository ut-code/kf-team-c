import { INSTITUTES } from '../content/institutes.ts';
import type { GameState } from './types.ts';

type Location = { longitude: number; latitude: number };
/** 同じ都市とその周辺（約200km）では、種類を問わず案件を同時発生させない。 */
export function isEncounterLocationOccupied(game: GameState, location: Location): boolean {
    const occupied = [
        ...game.investigations
            .filter((item) => item.status === 'active')
            .map((item) => INSTITUTES.find((institute) => institute.id === item.instituteId)!),
    ];
    return occupied.some((other) => {
        const longitude = Math.abs(location.longitude - other.longitude);
        const dx =
            Math.min(longitude, 360 - longitude) *
            Math.cos(((location.latitude + other.latitude) * Math.PI) / 360);
        return Math.hypot(dx, location.latitude - other.latitude) < 2;
    });
}
