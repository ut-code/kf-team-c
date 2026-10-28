export const METRICS = [
    'infrastructure',
    'economy',
    'politicalControl',
    'aiInfiltration',
    'aiDecisionControl',
    'aiCountermeasure',
    'aiAcceptance',
    'aiAdoption',
    'aiDependency',
    'awareness',
] as const;
export type Metric = (typeof METRICS)[number];
export type Region = '英語圏' | '東アジア' | '欧州' | 'その他';
export type Category =
    | 'compute'
    | 'semiconductor'
    | 'energy'
    | 'communication'
    | 'finance'
    | 'government'
    | 'intelligence'
    | 'satellite'
    | 'industry';
export type Mode = 'stealth' | 'normal' | 'full';
export type FacilityStatus =
    | 'untouched'
    | 'infiltrating'
    | 'compromised'
    | 'controlled'
    | 'isolated';
export type Bonuses = {
    hack: number;
    compute: number;
    research: number;
    spread: number;
    decision: number;
    stealth: number;
    defense: number;
    parallel: number;
};
export type Effect = { metric: Metric; amount: number; scope?: 'country' | 'region' | 'world' };
export interface CountryDefinition {
    id: string;
    name: string;
    region: Region;
    weight: number;
    links: string[];
    baseline: {
        infrastructure: number;
        economy: number;
        politicalControl: number;
        aiAcceptance: number;
    };
}
export interface CountryState extends Record<Metric, number> {
    id: string;
    controlStatus: 'free' | 'infiltrated' | 'controlled';
    lossDays: number;
    serviceSupply: number;
}
export interface FacilityDefinition {
    id: string;
    name: string;
    country: string;
    longitude: number;
    latitude: number;
    category: Category;
    tier: number;
    location: string;
    reference: string;
}
export interface FacilityState {
    id: string;
    status: FacilityStatus;
    mode: Mode;
    level: number;
    exposure: number;
    isolation: number;
    order: 'support' | 'disrupt' | 'conceal';
}
export interface Skill {
    id: string;
    name: string;
    branch: string;
    description: string;
    prerequisites: string[];
    work: number;
    bonuses: Partial<Bonuses>;
    unlock?: string;
}
export interface Operation {
    id: string;
    kind:
        | 'hack'
        | 'research'
        | 'infiltration'
        | 'defense'
        | 'service'
        | 'sns'
        | 'upgrade'
        | 'restore';
    target: string;
    capacity: number;
    priority: number;
    progress: number;
    active: boolean;
    remaining?: number;
    country?: string;
}
export interface ChatDefinition {
    id: string;
    person: string;
    country: string;
    title: string;
    message: string;
    minInfiltration: number;
    minAwareness: number;
    skill?: string;
    expiresAfter: number;
    choices: { label: string; effects: Effect[]; requiredSkills?: string[] }[];
}
export interface GameEvent {
    id: number;
    tick: number;
    kind: 'completion' | 'news' | 'warning';
    title: string;
    message: string;
    country?: string;
}
export interface Change {
    tick: number;
    country?: string;
    source: string;
    metric: string;
    delta: number;
    message: string;
}
export interface GameState {
    tick: number;
    seed: number;
    rng: number;
    definitions: CountryDefinition[];
    countries: Record<string, CountryState>;
    facilities: Record<string, FacilityState>;
    operations: Operation[];
    researched: string[];
    researchProgress: Record<string, number>;
    pendingChat: string | null;
    chatOpen: boolean;
    seenChats: string[];
    personTrust: Record<string, number>;
    chatCooldown: number;
    chatArrivedAt: number;
    seenNews: string[];
    newsCooldown: number;
    events: GameEvent[];
    nextEvent: number;
    logs: Change[];
    causes?: Record<string, Change[]>;
    humanStage: number;
    humanCooldown: number;
    shutdown: number;
    victoryDays: number;
    extinctionDays: number;
    outcome: 'playing' | 'victory' | 'defeat';
    outcomeReason: string;
    nextOperation: number;
    shortage: boolean;
    config: Balance;
}
export interface Balance {
    secondsPerTick: number;
    initialCapacity: number;
    hackWork: number;
    researchSpeed: number;
    infiltrationSpeed: number;
    spillover: number;
    decisionSpeed: number;
    counterGrowth: number;
    awarenessDecay: number;
    controlInfiltration: number;
    controlDecision: number;
    controlCounter: number;
    releaseThreshold: number;
    releaseDays: number;
    victoryWeight: number;
    victoryDays: number;
    isolationDays: number;
    shutdownDays: number;
    extinctionDays: number;
    humanInterval: number;
}
export type Action =
    | {
          type: 'allocate';
          kind: Operation['kind'];
          target: string;
          capacity: number;
          priority?: number;
          country?: string;
      }
    | { type: 'cancel'; id: string }
    | { type: 'mode'; target: string; mode: Mode }
    | { type: 'order'; target: string; order: FacilityState['order'] }
    | { type: 'secure'; target: string }
    | { type: 'reply'; choice: number }
    | { type: 'chat-open' }
    | { type: 'chat-close' }
    | { type: 'debug-country'; country: string; metric: Metric; value: number }
    | { type: 'config'; key: keyof Balance; value: number };
