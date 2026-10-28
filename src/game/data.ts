import chats from './data/events/chats.json' with { type: 'json' };
import humanActions from './data/events/human-actions.json' with { type: 'json' };
import people from './data/events/people.json' with { type: 'json' };
import sns from './data/events/sns.json' with { type: 'json' };
import balance from './data/simulation/balance.json' with { type: 'json' };
import categories from './data/simulation/categories.json' with { type: 'json' };
import countries from './data/simulation/countries.json' with { type: 'json' };
import facilities from './data/simulation/facilities.json' with { type: 'json' };
import modes from './data/simulation/modes.json' with { type: 'json' };
import operationEffects from './data/simulation/operation-effects.json' with { type: 'json' };
import skills from './data/simulation/skills.json' with { type: 'json' };
import type {
    Balance,
    Category,
    ChatDefinition,
    Effect,
    FacilityAttributes,
    Region,
    Skill,
} from './types.ts';

/** JSONの型境界。ゲーム定義の追加・調整はdata/内で行う。 */
export const BALANCE: Balance = balance;
export const MODES = modes;
export const OPERATION_EFFECTS = operationEffects as Omit<typeof operationEffects, 'disrupt'> & {
    disrupt: (Effect & { label: string })[];
};
export const COUNTRY_PROFILES = countries.profiles;
export const COUNTRY_OVERRIDES: Record<
    string,
    Partial<typeof COUNTRY_PROFILES.major>
> = countries.overrides;
export const REGION_HUBS: Record<Region, string> = countries.hubs;
export const REGIONS: Record<Region, string[]> = countries.regions;
export const MAJOR_WEIGHTS: Record<string, number> = countries.weights;
export const INTERNATIONAL_LINKS: string[][] = countries.links;
export const CATEGORIES = categories as Record<
    Category,
    { name: string; capacity: number; effects: Effect[]; research: number; expansion: number }
>;
export const FACILITIES = facilities as FacilityAttributes[];
export const FACILITY_BY_ID = Object.fromEntries(
    FACILITIES.map((facilityAttributes) => [facilityAttributes.id, facilityAttributes]),
);
export const SKILLS = skills as Skill[];
export const PEOPLE = people;
export const CHATS = chats as ChatDefinition[];
export const SNS = sns as {
    id: string;
    name: string;
    skill: string;
    capacity: number;
    duration: number;
    effects: Effect[];
    risk: number;
}[];
export const HUMAN_ACTIONS = humanActions as {
    id: string;
    name: string;
    stage: number;
    weight: number;
    effects: Effect[];
}[];

export const EXTRA_COUNTRIES = countries.extra;
export const INITIAL_FACILITY_ID = countries.initialFacility;
