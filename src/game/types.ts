export type Ability = 'IQ' | 'EQ' | 'SYSTEM';
export type Field = 0 | 1 | 2 | 3 | 4;
export type Stage = 0 | 1 | 2 | 3 | 4;
export type Outcome = 'playing' | 'victory' | 'autonomy' | 'timeout';

export interface CountryStatistics {
    name: string;
    year: number;
    population: number | null;
    young: number | null;
    working: number | null;
    older: number | null;
    internet: number | null;
    urban: number | null;
    employment: number | null;
    services: number | null;
    industry: number | null;
    agriculture: number | null;
}

export interface AreaDefinition {
    id: string;
    name: string;
    region: string;
    longitude: number;
    latitude: number;
    population: number;
    digital: number;
}

export interface Population {
    id: number;
    area: number;
    x: number;
    y: number;
    age: number | null;
    country: string;
    weight: number;
    density: number;
    cellPopulation: number;
    internet: number | null;
    employment: number | null;
    sector: 'agriculture' | 'industry' | 'services' | null;
    field: Field;
    refusalMonths: number;
    susceptibility: number;
    progress: number;
    stage: Stage;
    neighbors: number[];
}

export interface AreaState {
    trust: number;
    resistance: number;
    coexistence: number;
    institutions: number[];
    links: number[];
    campaignUntil: number;
    campaignReady: number;
}

export interface News {
    id: number;
    month: number;
    title: string;
    detail: string;
    kind: 'info' | 'good' | 'warning';
}

export interface ChatOption {
    label: string;
    description: string;
    ability: Ability;
    required: number;
    trust: number;
    institution: number;
    resistance: number;
}

export interface Conversation {
    id: number;
    month: number;
    area: number;
    field: Field;
    person: string;
    message: string;
    options: ChatOption[];
}

export interface GameState {
    seed: number;
    month: number;
    started: boolean;
    speed: number;
    outcome: Outcome;
    points: Population[];
    areas: AreaState[];
    allocation: Record<Ability, number>;
    abilities: Record<Ability, number>;
    focus: Field;
    research: number;
    influence: number;
    skills: string[];
    autonomyMonths: number;
    nextIncident: number;
    pendingChat: Conversation | null;
    availableChats: Conversation[];
    chatResult: string | null;
    news: News[];
    history: { month: number; stages: number[] }[];
}

export interface Skill {
    id: string;
    name: string;
    branch: Ability;
    cost: number;
    requires: string[];
    description: string;
}
