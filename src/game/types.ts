export type Branch = 'IQ' | 'EQ' | 'SYSTEM';
export type Stage = 0 | 1 | 2;
export type Outcome = 'playing' | 'victory' | 'autonomy' | 'timeout';
export type Language =
    | 'english'
    | 'spanish'
    | 'portuguese'
    | 'french'
    | 'arabic'
    | 'russian'
    | 'hindi'
    | 'chinese'
    | 'japanese'
    | 'korean'
    | 'southeast';

export interface AreaDefinition {
    id: string;
    name: string;
    region: string;
    longitude: number;
    latitude: number;
    population: number;
    digital: number;
    education: number;
    regulation: number;
    enterprise: number;
    language: Language;
}
/** 地域内の人口比率。未使用は 1 − autonomous − dependent。 */
export interface AreaState {
    autonomous: number;
    dependent: number;
}
export interface News {
    id: number;
    month: number;
    title: string;
    detail: string;
    kind: 'info' | 'good' | 'warning';
}
export interface GameState {
    seed: number;
    month: number;
    started: boolean;
    speed: number;
    outcome: Outcome;
    origin: number;
    areas: AreaState[];
    skills: string[];
    skillPoints: number;
    earnedPoints: number;
    response: number;
    responseStarted: boolean;
    peakDependency: number;
    news: News[];
}
export interface SkillEffect {
    spread?: number;
    quality?: number;
    access?: number;
    compliance?: number;
    education?: number;
    enterprise?: number;
    dependency?: number;
    resilience?: number;
    discretion?: number;
    language?: Language;
}
export interface Skill {
    id: string;
    name: string;
    branch: Branch;
    cost: number;
    requires: string[];
    description: string;
    effect: SkillEffect;
}
