/** All effect values are fractions: 0.05 means five percentage points. */
export interface SocietyEffect {
    scope: 'local' | 'nearby' | 'world';
    autonomous?: number;
    dependent?: number;
    antiAI?: number;
    favorability?: number;
    skillPoints?: number;
}
export interface EncounterChoice {
    id: string;
    label: string;
    result: string;
    cost?: number;
    effects: SocietyEffect[];
    next?: string;
}
export interface DialogueNode {
    id: string;
    message: string;
    choices: EncounterChoice[];
}
export interface EncounterDefinition {
    id: string;
    kind: 'event' | 'chat';
    title: string;
    summary: string;
    areaId: string;
    location?: { longitude: number; latitude: number };
    trigger: { month: number; adoption?: number; dependent?: number; antiAI?: number };
    duration: number;
    ignored: { description: string; effects: SocietyEffect[] };
    choices?: EncounterChoice[];
    contact?: { name: string; role: string; initials: string };
    dialogue?: DialogueNode[];
}
export interface ConversationMessage {
    id: string;
    role: 'contact' | 'player' | 'system';
    text: string;
}
export interface EncounterState {
    id: string;
    openedMonth: number;
    deadline: number;
    status: 'pending' | 'resolved' | 'expired';
    nodeId?: string;
    messages: ConversationMessage[];
    result?: string;
}
export interface SocialStrategy {
    id: string;
    name: string;
    description: string;
    tradeoff: string;
    spread: number;
    dependency: number;
    trust: number;
    reconciliation: number;
}
