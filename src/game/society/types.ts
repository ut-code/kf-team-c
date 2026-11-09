/** All effect values are fractions: 0.05 means five percentage points. */
export interface SocietyEffect {
    scope: 'local' | 'nearby' | 'world';
    autonomous?: number;
    dependent?: number;
    antiAI?: number;
    favorability?: number;
    skillPoints?: number;
}
/** triggerの比率は世界全体。月とブランチ別習得数は、条件をすべて満たしたときに候補になる。 */
export interface SocietyTrigger {
    month: number;
    adoption?: number;
    localAdoption?: number;
    dependent?: number;
    antiAI?: number;
    iqSkills?: number;
    eqSkills?: number;
    systemSkills?: number;
    /** 学習数上限。EQやSYSTEMを育てていない状態を表す条件に使う。 */
    eqSkillsMax?: number;
    systemSkillsMax?: number;
    /** 世界のAI好感度の下限。 */
    favorability?: number;
}
/** 選択肢に成否のもつれを持たせる。結果はシード・月・選択肢IDから決定論的に決まる。 */
export interface EncounterLottery {
    /**
     * favor-swing: 好感度と反AIの差から成功確率を算出。
     * empathy-calm: EQブランチの習得数が成功率を上げる。fixed: chance を固定値で使う。
     */
    formula: 'favor-swing' | 'empathy-calm' | 'fixed';
    chance?: number;
    win: { result: string; effects: SocietyEffect[] };
    lose: { result: string; effects: SocietyEffect[] };
}
export interface EncounterChoice {
    id: string;
    label: string;
    result: string;
    cost?: number;
    effects: SocietyEffect[];
    lottery?: EncounterLottery;
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
    trigger: SocietyTrigger;
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
