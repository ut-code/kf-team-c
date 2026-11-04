import { CONVERSATIONS } from '../content/chats.ts';
import { WORLD_EVENTS } from '../content/events.ts';
import { INSTITUTES } from '../content/institutes.ts';
import { AREAS } from './data.ts';
import type { EncounterDefinition } from './society/types.ts';
import type { GameState } from './types.ts';

type Location = { longitude: number; latitude: number };
const encounters = [...WORLD_EVENTS, ...CONVERSATIONS];

export function encounterLocation(definition: EncounterDefinition): Location {
    return definition.location ?? AREAS.find((area) => area.id === definition.areaId)!;
}

/** 同じ都市とその周辺（約200km）では、種類を問わず案件を同時発生させない。 */
export function isEncounterLocationOccupied(game: GameState, location: Location): boolean {
    const occupied = [
        ...game.encounters
            .filter((item) => item.status === 'pending')
            .map((item) => encounterLocation(encounters.find((entry) => entry.id === item.id)!)),
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
