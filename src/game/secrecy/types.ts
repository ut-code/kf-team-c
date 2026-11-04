export interface CapabilityState {
    visibility: 'hidden' | 'public' | 'exposed';
    limited: boolean;
    evidence: number;
}

export interface Investigation {
    id: string;
    skillId: string;
    instituteId: string;
    progress: number;
    startedMonth: number;
    closedMonth?: number;
    status: 'active' | 'disclosed' | 'restricted' | 'published';
    intervention: 'none' | 'partnership' | 'pressure';
    result?: string;
}

export type InvestigationAction = 'disclose' | 'restrict' | 'partnership' | 'pressure';
