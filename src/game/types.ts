export type Ability = 'IQ' | 'EQ' | 'SYSTEM';
export type Field = 0 | 1 | 2 | 3 | 4;
export type Stage = 0 | 1 | 2 | 3;
export type Outcome = 'playing' | 'victory' | 'autonomy' | 'distrust' | 'collapse' | 'timeout';
export type Policy =
    | 'success'
    | 'adoption'
    | 'recommendation'
    | 'repair'
    | 'investment'
    | 'education';

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
export interface Psychology {
    trust: number;
    autonomy: number;
    vigilance: number;
    conformity: number;
}
export interface Population extends Psychology {
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
    susceptibility: number;
    progress: number;
    stage: Stage;
    neighbors: number[];
    digital: number | null;
    education: number | null;
    economic: number | null;
    social: number;
    urban: boolean;
    baseline: Psychology;
    schoolExposure: number;
    demographicSource: 'WPP2024' | 'GHSL/WDI';
}
export interface AreaState {
    trust: number;
    resistance: number;
    coexistence: number;
    institutions: number[];
    links: number[];
    networks: { area: number; migration: number; economy: number; information: number }[];
    campaignUntil: number;
    campaignReady: number;
    momentum: number;
    investment: number;
    stability: number;
    reform: number;
}
export interface News {
    id: number;
    month: number;
    title: string;
    detail: string;
    kind: 'info' | 'good' | 'warning';
}
export interface Impact {
    id: number;
    title: string;
    month: number;
    population: number;
    transitions: number;
    transitionBreakdown: { from: Stage; to: Stage; population: number }[];
    trust: number;
    vigilance: number;
    detail: string;
}
export interface ChatOption {
    label: string;
    description: string;
    ability: Ability;
    required: number;
    trust: number;
    institution: number;
    resistance: number;
    skill?: string;
    autonomy?: number;
}
export interface Conversation {
    id: number;
    month: number;
    area: number;
    field: Field;
    person: string;
    role: 'official' | 'business' | 'citizen' | 'researcher';
    message: string;
    options: ChatOption[];
    turn: number;
    turns: number;
    transcript: { id: number; speaker: string; text: string }[];
}
export interface EventEffect {
    trust?: number;
    vigilance?: number;
    autonomy?: number;
    stability?: number;
    integration?: number;
    investment?: number;
    researchBoost?: number;
    reform?: number;
    momentum?: number;
}
export interface EventChoice {
    label: string;
    description: string;
    effect: EventEffect;
    ability?: Ability;
    required?: number;
    skill?: string;
    cost?: number;
    failure?: EventEffect;
}
export interface SocialEvent {
    id: string;
    title: string;
    description: string;
    areas: number[];
    field: Field | null;
    choices: EventChoice[];
    expires: number;
}
export interface SocialPost {
    id: number;
    month: number;
    area: number;
    language: string;
    author: string;
    text: string;
    movement: boolean;
}
export interface GameState {
    seed: number;
    month: number;
    started: boolean;
    speed: number;
    outcome: Outcome;
    points: Population[];
    areas: AreaState[];
    abilities: Record<Ability, number>;
    infrastructureShare: number;
    activeResearch: string | null;
    researchProgress: Record<string, number>;
    researchEfficiency: number;
    influence: number;
    skills: string[];
    autonomyMonths: number;
    distrustMonths: number;
    instabilityMonths: number;
    shortageMonths: number;
    nextIncident: number;
    pendingChat: Conversation | null;
    availableChats: Conversation[];
    chatResult: string | null;
    impact: Impact | null;
    news: News[];
    pendingEvent: SocialEvent | null;
    eventHistory: string[];
    posts: SocialPost[];
    history: { month: number; stages: number[] }[];
}
export interface Skill {
    id: string;
    name: string;
    branch: Ability;
    work: number;
    requires: string[];
    description: string;
    target: string;
    risk: string;
    gain: number;
    excludes?: string;
    abilityRequirements?: Partial<Record<Ability, number>>;
}
