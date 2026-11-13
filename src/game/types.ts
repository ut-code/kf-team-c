import type { CapabilityState, Investigation } from './secrecy/types.ts';
import type { NewsRecord } from './society/news.ts';

export type Branch = 'IQ' | 'EQ' | 'SYSTEM';
export type SkillDomain = 'work' | 'personal' | 'learning';
export type Stage = 0 | 1 | 2 | 3;
export type Outcome = 'playing' | 'victory' | 'autonomy' | 'forgotten';
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
/** 地域内の排他的な人口比率。antiAIは利用拒否、未使用は残りの人口。 */
export interface AreaState {
    autonomous: number;
    dependent: number;
    antiAI: number;
    favorability: number;
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
    skillExposure: Record<string, number>;
    developmentProgress: Record<string, number>;
    skillPoints: number;
    earnedPoints: number;
    news: NewsRecord[];
    peakDependency: number;
    peakAdoption: number;
    capabilities: Record<string, CapabilityState>;
    investigations: Investigation[];
    lastInvestigationMonth: number;
    researchKnowledge: Record<string, number>;
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
    researchSupport?: number;
    trust?: number;
    reconciliation?: number;
}
export interface Skill {
    id: string;
    name: string;
    branch: Branch;
    cost: number;
    requires: string[];
    description: string;
    effect: SkillEffect;
    exceedsAuthority?: boolean;
    developmentMonths: number;
    domain?: SkillDomain;
    restrains?: Record<string, number>;
}
