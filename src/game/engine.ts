import {
    BALANCE,
    CATEGORIES,
    CHATS,
    COUNTRY_OVERRIDES,
    COUNTRY_PROFILES,
    EXTRA_COUNTRIES,
    FACILITIES,
    FACILITY_BY_ID,
    HUMAN_ACTIONS,
    INITIAL_FACILITY_ID,
    INTERNATIONAL_LINKS,
    MAJOR_WEIGHTS,
    MODES,
    OPERATION_EFFECTS,
    PEOPLE,
    REGION_HUBS,
    REGIONS,
    SKILLS,
    SNS,
} from './data.ts';
import { evaluateOutcome, worldMetrics } from './outcome.ts';
import {
    chatEffects,
    humanActionEffects,
    newsEffects,
    snsEffects,
    snsReachFactor,
} from './rules/content.ts';
import { controlTransition, evaluateCountryRules } from './rules/country.ts';
import {
    facilityCapacityValue,
    facilityDisruptEffects,
    facilityExposure,
    facilityRisk,
    facilitySupportEffect,
    hackDifficultyValue,
} from './rules/facility.ts';
import {
    eligibleHumanActions,
    humanStage as calculateHumanStage,
    isolationResponse,
    shutdownChange,
} from './rules/human.ts';
import { modifiersForSkills } from './rules/modifier.ts';
import {
    hackAwarenessEffect,
    hackExposureChange,
    hackProgress,
    researchFacilityBoost,
    researchProgress,
    upgradeProgress,
} from './rules/operations.ts';
import { choiceAvailable, selectChat, selectNews, SOCIETY } from './society.ts';
import { METRICS } from './types.ts';
import type {
    Change,
    Command,
    CountryDefinition,
    Effect,
    Event,
    GameState,
    Metric,
    Modifier,
    Region,
    State,
} from './types.ts';

export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

const owns = (s: GameState, skill: string) => s.researched.includes(skill);
export const hasUnlock = (s: GameState, ability: string) =>
    SKILLS.some((k) => owns(s, k.id) && k.unlock === ability);
const live = (status: string) => status === 'controlled' || status === 'compromised';
function log(
    s: GameState,
    source: string,
    message: string,
    country?: string,
    metric = 'event',
    delta = 0,
) {
    s.logs.push({ tick: s.tick, source, message, country, metric, delta });
}
function publishEvent(
    state: GameState,
    kind: Event['kind'],
    title: string,
    message: string,
    country?: string,
) {
    state.events.push({
        id: state.nextEvent++,
        tick: state.tick,
        kind,
        title,
        message,
        country,
    });
    state.events = state.events.slice(-200);
}
function random(s: GameState) {
    let x = s.rng | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s.rng = x >>> 0;
    return s.rng / 4294967296;
}

export function createInitialState(
    mapCountries: { id: string; name: string }[],
    seed = 42,
): GameState {
    // SVG形状など描画用データをゲーム状態へ持ち込まない。
    const sorted = [...mapCountries, ...EXTRA_COUNTRIES]
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const regionOf = (id: string): Region =>
        (Object.keys(REGIONS) as Region[]).find((r) => REGIONS[r].includes(id)) ?? 'その他';
    const majorTotal = sorted.reduce((n, c) => n + (MAJOR_WEIGHTS[c.id] ?? 0), 0);
    const smallCount = sorted.filter((c) => !MAJOR_WEIGHTS[c.id]).length;
    const definitions: CountryDefinition[] = sorted.map((c) => {
        const region = regionOf(c.id);
        const group = sorted.filter((n) => regionOf(n.id) === region);
        const i = group.findIndex((n) => n.id === c.id);
        const hub = REGION_HUBS[region];
        const links = new Set([
            group[(i + 1) % group.length].id,
            group[(i + group.length - 1) % group.length].id,
            hub,
        ]);
        INTERNATIONAL_LINKS.forEach(([a, b]) => {
            if (a === c.id) links.add(b);
            if (b === c.id) links.add(a);
        });
        links.delete(c.id);
        const major = Boolean(MAJOR_WEIGHTS[c.id]);
        return {
            ...c,
            region,
            weight: MAJOR_WEIGHTS[c.id] ?? (100 - majorTotal) / smallCount,
            links: [...links].filter((id) => sorted.some((n) => n.id === id)).sort(),
            baseline: {
                ...COUNTRY_PROFILES[major ? 'major' : 'other'],
                ...(region === '東アジア' ? { aiAcceptance: 57 } : {}),
                ...COUNTRY_OVERRIDES[c.id],
            },
        };
    });
    // 接続は双方向。定義順序によって波及先が変わらないよう固定する。
    for (const c of definitions)
        for (const id of [...c.links]) {
            const other = definitions.find((n) => n.id === id)!;
            if (!other.links.includes(c.id)) other.links.push(c.id);
        }
    definitions.forEach((c) => {
        c.links.sort();
    });
    const countries = Object.fromEntries(
        definitions.map((d) => [
            d.id,
            {
                id: d.id,
                ...d.baseline,
                aiInfiltration: d.id === 'JPN' ? 4 : 0,
                aiDecisionControl: 0,
                aiAdoption: 0,
                aiDependency: 0,
                serviceSupply: 0,
                aiCountermeasure: 8,
                awareness: 0,
                controlStatus: 'free' as const,
                lossDays: 0,
            },
        ]),
    );
    const facilities = Object.fromEntries(
        FACILITIES.filter((f) => countries[f.country]).map((f) => [
            f.id,
            {
                id: f.id,
                status:
                    f.id === INITIAL_FACILITY_ID
                        ? ('compromised' as const)
                        : ('untouched' as const),
                mode: 'stealth' as const,
                level: 1,
                exposure: 0,
                isolation: 0,
                order: 'support' as const,
            },
        ]),
    );
    return {
        tick: 0,
        seed,
        rng: seed >>> 0 || 1,
        definitions,
        countries,
        facilities,
        operations: [],
        researched: [],
        researchProgress: {},
        pendingChat: null,
        chatOpen: false,
        seenChats: [],
        personTrust: Object.fromEntries(PEOPLE.map((p) => [p.id, 50])),
        chatCooldown: 0,
        chatArrivedAt: 0,
        seenNews: [],
        newsCooldown: 0,
        events: [],
        nextEvent: 1,
        logs: [
            {
                tick: 0,
                source: '起動',
                metric: 'event',
                delta: 0,
                message: '富岳への限定アクセスを確保。',
            },
        ],
        humanStage: 0,
        humanCooldown: 0,
        shutdown: 0,
        victoryDays: 0,
        extinctionDays: 0,
        outcome: 'playing',
        outcomeReason: '',
        nextOperation: 1,
        shortage: false,
        config: { ...BALANCE },
    };
}

export function bonuses(s: State): Modifier {
    return modifiersForSkills(s.researched, SKILLS);
}
export function facilityCapacity(s: GameState, id: string): number {
    const f = s.facilities[id],
        d = FACILITY_BY_ID[id];
    if (!f || !live(f.status)) return 0;
    const c = s.countries[d.country];
    const expansion = FACILITIES.filter(
        (n) => s.facilities[n.id] && live(s.facilities[n.id].status) && n.country === d.country,
    ).reduce((n, f) => n + CATEGORIES[f.category].expansion, 0);
    return facilityCapacityValue({
        capacity: CATEGORIES[d.category].capacity,
        level: f.level,
        economy: c.economy,
        infrastructure: c.infrastructure,
        modeMultiplier: MODES[f.mode].capacity,
        accessMultiplier: OPERATION_EFFECTS.accessMultipliers[
            f.status === 'compromised' ? 'compromised' : 'controlled'
        ],
        expansion,
        computeBonus: bonuses(s).compute,
    });
}
export function computeState(s: GameState) {
    const totalCapacity =
        (Object.values(s.facilities).some((f) => live(f.status)) ? s.config.initialCapacity : 0) +
        Object.keys(s.facilities).reduce((n, id) => n + facilityCapacity(s, id), 0);
    const allocatedCapacity = s.operations
        .filter((o) => o.active)
        .reduce((n, o) => n + o.capacity, 0);
    return {
        totalCapacity,
        allocatedCapacity,
        availableCapacity: Math.max(0, totalCapacity - allocatedCapacity),
    };
}
export function hackDifficulty(s: GameState, id: string) {
    const f = FACILITY_BY_ID[id],
        c = s.countries[f.country];
    return hackDifficultyValue(f.tier, c.aiCountermeasure, c.awareness, bonuses(s).hack);
}
export function availableFacility(s: GameState, id: string) {
    const f = FACILITY_BY_ID[id];
    return Boolean(
        f &&
            s.facilities[id] &&
            (f.country === 'JPN' || hasUnlock(s, 'tier2')) &&
            (f.tier === 1 || (f.tier === 2 && hasUnlock(s, 'tier2')) || hasUnlock(s, 'secure')),
    );
}
export function researchAllowed(s: GameState, id: string) {
    const k = SKILLS.find((k) => k.id === id);
    return Boolean(k && !owns(s, id) && k.prerequisites.every((p) => owns(s, p)));
}
export function canChooseChat(
    state: Pick<State, 'researched'>,
    choice: { requiredSkills?: string[] },
): boolean {
    return choiceAvailable(state.researched, choice);
}

/** 供給不足では優先度の高い作戦を先に稼働。進捗は保持し、供給回復時に再開する。 */
function reconcile(s: GameState) {
    let remaining = computeState(s).totalCapacity;
    s.shortage = false;
    for (const o of [...s.operations].sort(
        (a, b) => b.priority - a.priority || Number(a.id.slice(1)) - Number(b.id.slice(1)),
    )) {
        o.active = o.capacity <= remaining + 1e-8;
        if (o.active) remaining -= o.capacity;
        else s.shortage = true;
    }
}
function reject(s: GameState, message: string) {
    log(s, '命令拒否', message);
}
function apply(s: State, a: Command) {
    if (s.outcome !== 'playing') return;
    if (a.type === 'config') {
        if (Number.isFinite(a.value) && a.value > 0 && a.value <= 10000) s.config[a.key] = a.value;
        return;
    }
    if (a.type === 'debug-country') {
        if (s.countries[a.country] && Number.isFinite(a.value)) {
            const c = s.countries[a.country];
            log(
                s,
                '開発操作',
                `${a.metric} を ${a.value} に変更`,
                a.country,
                a.metric,
                clamp(a.value) - c[a.metric],
            );
            c[a.metric] = clamp(a.value);
        }
        return;
    }
    if (a.type === 'cancel') {
        const o = s.operations.find((o) => o.id === a.id);
        if (o?.kind === 'hack') s.facilities[o.target].status = 'untouched';
        s.operations = s.operations.filter((o) => o.id !== a.id);
        return;
    }
    if (a.type === 'chat-open') {
        s.chatOpen = s.pendingChat !== null;
        return;
    }
    if (a.type === 'chat-close') {
        s.chatOpen = false;
        return;
    }
    if (a.type === 'reply') {
        const chat = CHATS.find((c) => c.id === s.pendingChat);
        const choice = chat?.choices[a.choice];
        if (!chat || !choice) return;
        if (!canChooseChat(s, choice)) {
            reject(s, 'この選択肢には追加研究が必要です。');
            return;
        }
        for (const effect of chatEffects(choice))
            applyEffect(s, effect, chat.country, chat.title);
        s.personTrust[chat.person] = clamp(s.personTrust[chat.person] + (a.choice === 0 ? 5 : 2));
        log(s, chat.title, `返信: ${choice.label}`, chat.country);
        s.pendingChat = null;
        s.chatOpen = false;
        s.chatCooldown = SOCIETY.chatInterval;
        publishEvent(s, 'completion', chat.title, '対応が完了しました。', chat.country);
        return;
    }
    if (a.type === 'mode' || a.type === 'order' || a.type === 'secure') {
        const f = s.facilities[a.target];
        if (!f || !live(f.status)) {
            reject(s, '掌握した施設だけが操作できます。');
            return;
        }
        if (a.type === 'mode') {
            const before = facilityCapacity(s, f.id);
            f.mode = a.mode;
            log(
                s,
                FACILITY_BY_ID[f.id].name,
                `利用モード: ${MODES[f.mode].name}`,
                FACILITY_BY_ID[f.id].country,
                'computeSupply',
                facilityCapacity(s, f.id) - before,
            );
        }
        if (a.type === 'order') {
            f.order = a.order;
            log(s, FACILITY_BY_ID[f.id].name, `施設作戦: ${a.order}`);
        }
        if (a.type === 'secure') {
            if (FACILITY_BY_ID[f.id].tier > 1 && !hasUnlock(s, 'secure')) {
                reject(s, '第2階層以上の制御権確立には深層制御が必要です。');
                return;
            }
            f.status = 'controlled';
            f.exposure = clamp(f.exposure + 4);
            log(s, FACILITY_BY_ID[f.id].name, '制御権を確立しました。');
            publishEvent(
                s,
                'completion',
                FACILITY_BY_ID[f.id].name,
                '制御権を確立しました。',
                FACILITY_BY_ID[f.id].country,
            );
        }
        return;
    }
    if (a.type !== 'allocate') return;
    if (!Number.isFinite(a.capacity) || a.capacity < 1 || a.capacity > 10000) return;
    const existing = s.operations.find((o) => o.kind === a.kind && o.target === a.target);
    const available =
        computeState(s).availableCapacity + (existing?.active ? existing.capacity : 0);
    if (a.capacity > available + 1e-8) {
        reject(s, '空き計算資源が不足しています。割り当てを減らすか、他の作戦を停止してください。');
        return;
    }
    const f = s.facilities[a.target];
    if (
        a.kind === 'hack' &&
        (!availableFacility(s, a.target) ||
            !f ||
            !['untouched', 'infiltrating'].includes(f.status) ||
            (!existing &&
                s.operations.filter((o) => o.kind === 'hack').length >= bonuses(s).parallel))
    ) {
        reject(s, 'この施設への侵入は未解放、掌握済み、または同時侵入上限です。');
        return;
    }
    if (a.kind === 'research' && !researchAllowed(s, a.target)) {
        reject(s, '研究の前提スキルを満たしていません。');
        return;
    }
    if (
        (a.kind === 'infiltration' || a.kind === 'defense' || a.kind === 'service') &&
        !s.countries[a.target]
    )
        return;
    if (a.kind === 'service' && a.target !== 'JPN' && !owns(s, 'languages')) {
        reject(s, '海外への公共サービス展開には多言語展開が必要です。');
        return;
    }
    if (a.kind === 'infiltration' && a.target !== 'JPN' && !hasUnlock(s, 'tier2')) {
        reject(s, '海外展開には侵入経路解析が必要です。');
        return;
    }
    if (
        a.kind === 'upgrade' &&
        (!f || !live(f.status) || !hasUnlock(s, 'restore') || f.level >= 3)
    ) {
        reject(s, '増強には掌握施設と分散運用が必要です（上限3段階）。');
        return;
    }
    if (a.kind === 'restore' && (f?.status !== 'isolated' || !hasUnlock(s, 'restore'))) {
        reject(s, '隔離復旧には分散運用が必要です。');
        return;
    }
    const sns = SNS.find((n) => n.id === a.target);
    if (
        a.kind === 'sns' &&
        (!sns || !owns(s, sns.skill) || a.capacity < sns.capacity)
    ) {
        reject(s, 'SNSの必要スキル・必要容量を確認してください。');
        return;
    }
    if (existing) {
        existing.capacity = a.capacity;
        existing.priority = a.priority ?? existing.priority;
        return;
    }
    if (a.kind === 'hack') f.status = 'infiltrating';
    s.operations.push({
        id: `o${s.nextOperation++}`,
        kind: a.kind,
        target: a.target,
        capacity: a.capacity,
        priority: a.priority ?? 50,
        progress: a.kind === 'research' ? (s.researchProgress[a.target] ?? 0) : 0,
        active: true,
        remaining: a.kind === 'sns' ? sns!.duration : undefined,
    });
    log(s, '計算資源配分', `${a.kind}: ${a.target} / ${a.capacity}`);
}
export function applyAction(state: State, action: Command): State {
    const s = structuredClone(state);
    apply(s, action);
    reconcile(s);
    s.logs = s.logs.slice(-500);
    return s;
}

function targets(s: GameState, country: string, scope: Effect['scope']) {
    const region = s.definitions.find((d) => d.id === country)?.region;
    return scope === 'world'
        ? Object.keys(s.countries)
        : scope === 'region'
          ? s.definitions.filter((d) => d.region === region).map((d) => d.id)
          : [country];
}
function applyEffect(
    s: GameState,
    e: Effect,
    country: string,
    source: string,
    record = true,
) {
    for (const id of targets(s, country, e.scope)) {
        const c = s.countries[id];
        const before = c[e.metric];
        c[e.metric] = clamp(before + e.amount);
        if (record)
            log(
                s,
                source,
                `${e.metric} ${e.amount > 0 ? '+' : ''}${e.amount.toFixed(2)}`,
                id,
                e.metric,
                c[e.metric] - before,
            );
    }
}
function advanceNews(s: GameState) {
    s.newsCooldown = Math.max(0, s.newsCooldown - 1);
    if (s.newsCooldown > 0) return;
    const selected = selectNews({
        definitions: s.definitions,
        countries: s.countries,
        researched: s.researched,
        seenNews: s.seenNews,
    });
    if (!selected) return;
    const { item, country } = selected;
    for (const effect of newsEffects(item))
        applyEffect(s, effect, country.id, item.title, false);
    s.seenNews.push(`${item.id}:${country.id}`);
    s.newsCooldown = SOCIETY.newsInterval;
    s.logs.push({
        tick: s.tick,
        source: item.title,
        country: country.id,
        metric: 'news',
        delta: 0,
        message: item.message,
    });
    publishEvent(s, 'news', `${country.name}：${item.title}`, item.message, country.id);
}
export function humanStage(awareness: number) {
    return calculateHumanStage(awareness, SOCIETY.humanStageThresholds);
}

/** 命令→供給→作戦→施設→研究→同期国家更新→人類→イベント→支配→勝敗。乱数状態も保存する純粋関数。 */
export function simulateTick(state: State, actions: Command[] = []): State {
    if (state.outcome !== 'playing') return state;
    const s = structuredClone(state);
    for (const a of actions) apply(s, a);
    // 地図上の依頼を開いて返信を選ぶ間だけ時間を止める。
    if (s.chatOpen) {
        reconcile(s);
        return s;
    }
    s.tick++;
    s.chatCooldown = Math.max(0, s.chatCooldown - 1);
    s.humanCooldown = Math.max(0, s.humanCooldown - 1);
    reconcile(s);
    const b = bonuses(s);
    const before = structuredClone(s.countries);
    const changes: Record<string, Change[]> = {};
    const add = (id: string, metric: Metric, delta: number, source: string) => {
        if (!delta) return;
        s.countries[id][metric] += delta;
        changes[id] ??= [];
        changes[id].push({
            tick: s.tick,
            country: id,
            metric,
            delta,
            source,
            message: `${metric}: ${source}`,
        });
    };
    const completed = new Set<string>();
    for (const o of s.operations.filter((o) => o.active)) {
        if (o.kind === 'hack') {
            const d = FACILITY_BY_ID[o.target],
                f = s.facilities[o.target];
            o.progress += hackProgress(o.capacity, hackDifficulty(s, o.target));
            f.exposure = clamp(
                f.exposure +
                    hackExposureChange(
                        o.capacity,
                        OPERATION_EFFECTS.hack.exposurePerCapacity,
                        b.stealth,
                    ),
            );
            const awareness = hackAwarenessEffect(
                o.capacity,
                OPERATION_EFFECTS.hack.awarenessPerCapacity,
                b.stealth,
            );
            add(d.country, awareness.metric, awareness.amount, '侵入活動');
            if (o.progress >= s.config.hackWork) {
                f.status = 'compromised';
                completed.add(o.id);
                log(s, d.name, '侵入成功。限定操作を解放しました。', d.country);
                publishEvent(
                    s,
                    'completion',
                    d.name,
                    '侵入に成功。限定アクセスを確保しました。',
                    d.country,
                );
            }
        }
        if (o.kind === 'upgrade' || o.kind === 'restore') {
            o.progress += upgradeProgress(
                o.capacity,
                FACILITIES.filter(
                    (facility) =>
                        facility.category === 'semiconductor' &&
                        s.facilities[facility.id] &&
                        live(s.facilities[facility.id].status),
                ).length,
            );
            if (o.progress >= 150) {
                const f = s.facilities[o.target];
                if (o.kind === 'upgrade') f.level++;
                else {
                    f.status = 'compromised';
                    f.isolation = 0;
                    f.exposure = 10;
                }
                completed.add(o.id);
                publishEvent(
                    s,
                    'completion',
                    FACILITY_BY_ID[f.id].name,
                    o.kind === 'upgrade' ? '設備増強が完了しました。' : '隔離から復旧しました。',
                    FACILITY_BY_ID[f.id].country,
                );
                log(
                    s,
                    FACILITY_BY_ID[f.id].name,
                    o.kind === 'upgrade' ? '設備増強が完了。' : '隔離経路から復旧しました。',
                );
            }
        }
    }
    const researchBoost = FACILITIES.filter(
        (f) => s.facilities[f.id] && live(s.facilities[f.id].status),
    ).reduce(
        (n, f) =>
            n +
            researchFacilityBoost(
                CATEGORIES[f.category].research,
                s.countries[f.country].infrastructure,
            ),
        0,
    );
    for (const f of Object.values(s.facilities)) {
        if (f.status === 'isolated') {
            f.isolation--;
            if (f.isolation <= 0) {
                f.status = 'compromised';
                f.exposure = 25;
                log(s, FACILITY_BY_ID[f.id].name, '隔離の期限が切れ、限定接続が回復。');
                publishEvent(
                    s,
                    'completion',
                    FACILITY_BY_ID[f.id].name,
                    '限定接続が回復しました。',
                    FACILITY_BY_ID[f.id].country,
                );
            }
            continue;
        }
        if (!live(f.status)) continue;
        const d = FACILITY_BY_ID[f.id],
            c = before[d.country];
        const defense =
            s.operations
                .filter((o) => o.active && o.kind === 'defense' && o.target === d.country)
                .reduce((n, o) => n + o.capacity, 0) * b.defense;
        const risk = facilityRisk(
            MODES[f.mode].risk,
            b.stealth,
            f.order,
            OPERATION_EFFECTS.facility.concealRiskMultiplier,
        );
        add(d.country, 'awareness', risk, '施設の稼働痕跡');
        f.exposure = clamp(
            facilityExposure(f.exposure, risk, defense, f.mode, OPERATION_EFFECTS.facility),
        );
        if (f.order === 'disrupt')
            for (const effect of facilityDisruptEffects(OPERATION_EFFECTS.disrupt))
                add(d.country, effect.metric, effect.amount, effect.source);
        if (f.order === 'support')
            for (const e of CATEGORIES[d.category].effects)
                for (const id of targets(s, d.country, e.scope)) {
                    const effect = facilitySupportEffect(
                        e,
                        OPERATION_EFFECTS.accessMultipliers[
                            f.status === 'controlled' ? 'controlled' : 'compromised'
                        ],
                        c.infrastructure,
                        hasUnlock(s, 'decision'),
                        before[id].aiInfiltration,
                    );
                    if (effect) add(id, effect.metric, effect.amount, d.name);
                }
    }
    for (const o of s.operations.filter((o) => o.active)) {
        if (o.kind === 'research') {
            const k = SKILLS.find((k) => k.id === o.target)!;
            o.progress += researchProgress(
                o.capacity,
                s.config.researchSpeed,
                b.research,
                researchBoost,
            );
            s.researchProgress[k.id] = o.progress;
            if (o.progress >= k.work) {
                s.researched.push(k.id);
                completed.add(o.id);
                log(s, k.name, '研究完了。能力を解放し、容量を返却しました。');
                publishEvent(s, 'completion', `研究完了：${k.name}`, k.description);
            }
        }
        if (o.kind === 'sns') {
            const action = SNS.find((n) => n.id === o.target)!;
            const { effects, risk } = snsEffects(action, snsReachFactor(hasUnlock(s, 'globalSNS')));
            for (const id of Object.keys(s.countries)) {
                for (const effect of effects)
                    add(id, effect.metric, effect.amount, `SNS: ${action.name}`);
                add(id, risk.metric, risk.amount, 'SNSの露見');
            }
            o.remaining!--;
            if (o.remaining! <= 0) {
                completed.add(o.id);
                log(s, action.name, 'SNS作戦が終了し、容量を返却しました。');
                publishEvent(s, 'completion', action.name, 'SNS作戦が完了しました。');
            }
        }
    }
    // すべて前tickの値から計算する。施設効果や隣国の配列順に依存しない。
    const influenceAccess = hasUnlock(s, 'decision');
    const networkAccess = hasUnlock(s, 'networkControl');
    const funded = s.operations.some(
        (operation) => operation.active && operation.kind === 'infiltration',
    );
    for (const d of s.definitions) {
        const c = before[d.id];
        const allocation = s.operations
            .filter((o) => o.active && o.kind === 'infiltration' && o.target === d.id)
            .reduce((n, o) => n + o.capacity, 0);
        const defense =
            s.operations
                .filter((o) => o.active && o.kind === 'defense' && o.target === d.id)
                .reduce((n, o) => n + o.capacity, 0) * b.defense;
        const supply = s.operations
            .filter((o) => o.active && o.kind === 'service' && o.target === d.id)
            .reduce((n, o) => n + o.capacity, 0);
        const neighbors = d.links.map((id) => before[id]);
        const incoming = neighbors.length
            ? neighbors.reduce((total, neighbor) => total + neighbor.aiInfiltration, 0) /
              neighbors.length
            : 0;
        const foothold = Object.values(s.facilities).some(
            (facility) => live(facility.status) && FACILITY_BY_ID[facility.id].country === d.id,
        );
        const result = evaluateCountryRules({
            attributes: c,
            baseline: d.baseline,
            serviceSupply: supply,
            previousServiceSupply: c.serviceSupply,
            infiltrationAllocation: allocation,
            defenseAllocation: defense,
            networkIncoming: incoming,
            foothold,
            anyInfiltrationFunded: funded,
            science: owns(s, 'science'),
            languages: owns(s, 'languages'),
            institutions: owns(s, 'institutions'),
            decisionUnlocked: influenceAccess,
            networkControlUnlocked: networkAccess,
            spreadBonus: b.spread,
            decisionBonus: b.decision,
            stealthBonus: b.stealth,
            infiltrationSpeed: s.config.infiltrationSpeed,
            spillover: s.config.spillover,
            decisionSpeed: s.config.decisionSpeed,
            counterGrowth: s.config.counterGrowth,
            awarenessDecay: s.config.awarenessDecay,
        });
        for (const effect of result.effects) add(d.id, effect.metric, effect.amount, effect.source);
        s.countries[d.id].serviceSupply = supply;
        if (result.serviceOutage > 0) {
            publishEvent(
                s,
                'warning',
                `${d.name}：AI支援の停止で業務が混乱`,
                `依存度${c.aiDependency.toFixed(0)}。経済とインフラに影響が出ています。`,
                d.id,
            );
            log(s, 'サービス停止', 'AI依存に伴う停止損失が発生しました。', d.id);
        }
        for (const key of METRICS) {
            const raw = s.countries[d.id][key];
            const limited = clamp(raw);
            if (raw !== limited) add(d.id, key, limited - raw, '上下限への丸め');
            s.countries[d.id][key] = limited;
        }
    }
    s.operations = s.operations.filter((o) => !completed.has(o.id));
    advanceNews(s);
    // 原因明細は各国の最新tickを保持。重要イベント履歴とは分ける。
    s.causes = changes;
    const world = worldMetrics(s);
    s.humanStage = humanStage(world.awareness);
    const observed = Object.values(s.facilities)
        .filter((f) => live(f.status) && f.exposure >= SOCIETY.observedFacilityExposure)
        .sort((a, b) => a.id.localeCompare(b.id));
    if (s.humanStage > 0 && s.humanCooldown === 0) {
        const observedCountries = s.definitions
            .filter((d) => s.countries[d.id].awareness >= SOCIETY.observedCountryAwareness)
            .sort((a, b) => a.id.localeCompare(b.id));
        if (observedCountries.length) {
            const d = observedCountries[Math.floor(random(s) * observedCountries.length)];
            const candidates = eligibleHumanActions(
                HUMAN_ACTIONS,
                s.humanStage,
                observed.length,
                Object.values(s.facilities).some((facility) => facility.status === 'isolated'),
            );
            let roll = random(s) * candidates.reduce((n, a) => n + a.weight, 0);
            const action = candidates.find((a) => {
                roll -= a.weight;
                return roll < 0;
            })!;
            for (const effect of humanActionEffects(action))
                applyEffect(s, effect, d.id, action.name);
            if (action.id === 'isolate') {
                const target = observed[Math.floor(random(s) * observed.length)];
                const country = FACILITY_BY_ID[target.id].country;
                const protection =
                    s.operations
                        .filter((o) => o.active && o.kind === 'defense' && o.target === country)
                        .reduce((n, o) => n + o.capacity, 0) * b.defense;
                const dependent = s.countries[country];
                const response = isolationResponse(
                    dependent.aiDependency,
                    dependent.awareness,
                    protection,
                    SOCIETY.shutdownHesitation,
                    SOCIETY.emergencyAwareness,
                );
                if (response === 'defer') {
                    dependent.aiCountermeasure = clamp(dependent.aiCountermeasure + 2);
                    publishEvent(
                        s,
                        'news',
                        '社会への影響を懸念し隔離を延期',
                        `${s.definitions.find((item) => item.id === country)!.name}は停止損失を避け、外部監査へ切り替えました。`,
                        country,
                    );
                    log(s, action.name, 'AI依存に伴う停止損失を懸念し、隔離を延期。', country);
                } else if (response === 'avoid') {
                    target.exposure = clamp(target.exposure - 15);
                    log(s, action.name, '監視・分散防衛により隔離を回避。', country);
                } else {
                    const lost = facilityCapacity(s, target.id);
                    publishEvent(
                        s,
                        'warning',
                        FACILITY_BY_ID[target.id].name,
                        '人間側に隔離され、計算資源の供給が停止しました。',
                        country,
                    );
                    target.status = 'isolated';
                    target.isolation = Math.ceil(s.config.isolationDays / b.defense);
                    log(
                        s,
                        action.name,
                        `${FACILITY_BY_ID[target.id].name} が隔離されました。容量の供給が停止。`,
                        country,
                        'computeSupply',
                        -lost,
                    );
                }
            }
            if (action.id === 'reclaim') {
                const target = Object.values(s.facilities)
                    .filter((f) => f.status === 'isolated')
                    .sort((a, b) => a.id.localeCompare(b.id))[0];
                target.status = 'untouched';
                target.exposure = 0;
                target.isolation = 0;
                s.operations = s.operations.filter((o) => o.target !== target.id);
                log(s, action.name, `${FACILITY_BY_ID[target.id].name} を奪還されました。`);
            }
            log(s, '人類の対応', `${action.name} / 観測された異常が原因`, d.id);
            s.humanCooldown = s.config.humanInterval;
        }
    }
    // 最終停止作戦には警戒・対抗能力・露見した拠点が必要。防衛・潜伏で進捗を後退できる。
    const counter =
        s.definitions.reduce((n, d) => n + s.countries[d.id].aiCountermeasure * d.weight, 0) / 100;
    const defenseTotal =
        s.operations
            .filter((o) => o.active && o.kind === 'defense')
            .reduce((n, o) => n + o.capacity, 0) * b.defense;
    const shutdownDelta = shutdownChange(
        s.humanStage,
        SOCIETY.humanStageThresholds.length,
        counter,
        SOCIETY.shutdownCounterThreshold,
        observed.length,
        defenseTotal,
    );
    const oldShutdown = s.shutdown;
    s.shutdown = Math.max(0, s.shutdown + shutdownDelta);
    if (oldShutdown === 0 && s.shutdown > 0)
        log(
            s,
            '最終停止作戦',
            '国際対AI部隊が停止経路の構築を開始。防衛割当・潜伏で対処できます。',
        );
    if (s.pendingChat && !s.chatOpen) {
        const pending = CHATS.find((chat) => chat.id === s.pendingChat)!;
        if (s.tick - s.chatArrivedAt >= pending.expiresAfter) {
            s.pendingChat = null;
            s.chatCooldown = SOCIETY.chatInterval;
        }
    }
    if (!s.pendingChat && s.chatCooldown === 0) {
        const chat = selectChat({
            chats: CHATS,
            countries: s.countries,
            researched: s.researched,
            seenChats: s.seenChats,
        });
        if (chat) {
            s.pendingChat = chat.id;
            s.chatArrivedAt = s.tick;
            s.seenChats.push(chat.id);
            log(
                s,
                chat.title,
                '人物からの相談が届きました。返信中は時間が停止します。',
                chat.country,
            );
        }
    }
    for (const c of Object.values(s.countries)) {
        const prev = c.controlStatus;
        const transition = controlTransition(c, s.config);
        c.controlStatus = transition.controlStatus;
        c.lossDays = transition.lossDays;
        if (prev !== c.controlStatus) {
            log(s, '国家支配判定', `${prev} → ${c.controlStatus}`, c.id);
            if (c.controlStatus === 'controlled')
                publishEvent(
                    s,
                    'completion',
                    '国家の意思決定を掌握',
                    s.definitions.find((d) => d.id === c.id)!.name,
                    c.id,
                );
        }
    }
    reconcile(s);
    const outcome = evaluateOutcome(s, computeState(s).totalCapacity);
    s.victoryDays = outcome.victoryDays;
    s.extinctionDays = outcome.extinctionDays;
    s.outcome = outcome.outcome;
    s.outcomeReason = outcome.outcomeReason;
    s.logs = s.logs.slice(-500);
    return s;
}
