export interface CapabilityState {
    visibility: 'hidden' | 'public' | 'exposed';
    evidence: number;
}

export type InvestigationAction = 'cooperate' | 'pressure' | 'limit';

export interface InvestigationResponse {
    action: InvestigationAction;
    startedMonth: number;
    untilMonth: number;
    skillIds: string[];
}

interface InvestigationBase {
    id: string;
    instituteId: string;
    progress: number;
    startedMonth: number;
    closedMonth?: number;
    status: 'active' | 'disclosed' | 'restricted' | 'published';
    result?: string;
    response?: InvestigationResponse;
}

export interface CapabilityInvestigation extends InvestigationBase {
    kind: 'capability';
    skillId: string;
}

export interface ScientificInvestigation extends InvestigationBase {
    kind: 'research';
    researchId: string;
    collaborators: string[];
    observedExposure: number;
    targetId: string;
    phase: 'research' | 'validation' | 'legislation' | 'complete';
    publishedMonth?: number;
    coverage: number[];
}

export type Investigation = CapabilityInvestigation | ScientificInvestigation;
