// ゲームに登場するパラメーター名は以下のように管理されています
//
// State -> 時間とともに変化するパラメーター  cf) CountryState, GameState
// Attributes -> 対象に固有の基本設定 cf) FacilityAttributes, CountryAttributes
// Metrics -> 状態から計算して得られる指標 cf) WorldMetrics

export const COUNTRY_STATE_KEYS = [
    // [インフラ] 通信・電力など社会基盤の稼働状態
    'infrastructure',
    // [経済] 経済活動の健全さ
    'economy',
    // [行政能力] 政府の政策実行能力
    'governmentCapacity',
    // [対AI技術水準] 対AI技術がどこまで開発されているか
    'aiDefenseTechnology',

    // [AI受容度] 社会がAIの利用を受け入れる姿勢
    'aiAcceptance',
    // [警戒度] 人間側がAIの介入をどれだけ警戒しているか
    'awareness',

    // [AI導入率] 社会でAIの利用がどれだけ広がっているか
    'aiAdoption',
    // [浸透度] AIが国の内部へ入り込んでいる程度
    'aiInfiltration',
    // [意思決定支配] AIが国の意思決定を左右している程度
    'aiDecisionControl',
    // [AI依存度] 社会がAIなしでは機能しにくくなっている程度
    'aiDependency',
] as const;
/** 国の数値状態の項目名。 */
export type CountryStateKey = (typeof COUNTRY_STATE_KEYS)[number];
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
export type Modifier = {
    hack: number;
    compute: number;
    research: number;
    spread: number;
    decision: number;
    stealth: number;
    defense: number;
    parallel: number;
};
export type Bonuses = Modifier;
export type Effect = {
    countryStateKey: CountryStateKey;
    amount: number;
    scope?: 'country' | 'region' | 'world';
};
export type Condition = { countryStateKey: CountryStateKey; min: number };
/** 国に固有の基本設定。 */
export interface CountryAttributes {
    id: string;
    name: string;
    region: Region;
    weight: number;
    links: string[];
    baseline: {
        infrastructure: number;
        economy: number;
        governmentCapacity: number;
        aiAcceptance: number;
    };
}
/** 時間とともに変化する国単位の保存状態。 */
export interface CountryState extends Record<CountryStateKey, number> {
    id: string;
    controlStatus: 'free' | 'infiltrated' | 'controlled';
    lossDays: number;
    serviceSupply: number;
}
/** 施設に固有の基本設定。 */
export interface FacilityAttributes {
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
/** 時間とともに変化する施設単位の保存状態。 */
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
export interface Event {
    id: number;
    tick: number;
    kind: 'completion' | 'news' | 'warning';
    title: string;
    message: string;
    country?: string;
}
export type GameEvent = Event;
export interface Change {
    tick: number;
    country?: string;
    source: string;
    countryStateKey: string;
    delta: number;
    message: string;
}
/** 国・施設・進行情報をまとめたゲーム全体の保存状態。 */
export interface GameState {
    tick: number;
    seed: number;
    rng: number;
    definitions: CountryAttributes[];
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
    defenseResearchSpeed: number;
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
export type Command =
    | {
          type: 'allocate';
          kind: Operation['kind'];
          target: string;
          capacity: number;
          priority?: number;
      }
    | { type: 'cancel'; id: string }
    | { type: 'mode'; target: string; mode: Mode }
    | { type: 'order'; target: string; order: FacilityState['order'] }
    | { type: 'secure'; target: string }
    | { type: 'reply'; choice: number }
    | { type: 'chat-open' }
    | { type: 'chat-close' }
    | { type: 'debug-country'; country: string; countryStateKey: CountryStateKey; value: number }
    | { type: 'config'; key: keyof Balance; value: number };
export type Action = Command;

/** 国の状態から算出する世界全体の指標。 */
export interface WorldMetrics {
    control: number;
    infiltration: number;
    awareness: number;
}

/** 施設の状態と作業への配分から算出する演算容量の指標。 */
export interface ComputeMetrics {
    totalCapacity: number;
    allocatedCapacity: number;
    availableCapacity: number;
}

/** 国の状態から算出する指標。 */
export interface CountryMetrics {
    aiDefenseEffectiveness: number;
}
