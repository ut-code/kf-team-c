export interface CapabilityState {
    visibility: 'hidden' | 'public' | 'exposed';
    limited: boolean;
    evidence: number;
}

interface InvestigationBase {
    id: string;
    instituteId: string;
    progress: number;
    startedMonth: number;
    closedMonth?: number;
    status: 'active' | 'disclosed' | 'restricted' | 'published';
    intervention: 'none' | 'partnership' | 'pressure';
    result?: string;
}

export interface CapabilityInvestigation extends InvestigationBase {
    kind: 'capability';
    skillId: string;
}

export interface ScientificInvestigation extends InvestigationBase {
    kind: 'research';
    researchId: string;
}

export type Investigation = CapabilityInvestigation | ScientificInvestigation;

export type InvestigationAction = 'disclose' | 'restrict' | 'partnership' | 'pressure';
