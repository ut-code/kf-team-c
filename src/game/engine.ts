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
import { countryMetrics } from './metrics.ts';
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
    humanStage as calculateHumanStage,
    eligibleHumanActions,
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
import { choiceAvailable, SOCIETY, selectChat, selectNews } from './society.ts';
import type {
    Change,
    Command,
    ComputeMetrics,
    CountryAttributes,
    CountryStateKey,
    Effect,
    Event,
    GameState,
    Modifier,
    Region,
} from './types.ts';
import { COUNTRY_STATE_KEYS } from './types.ts';

export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

const owns = (gameState: GameState, skill: string) => gameState.researched.includes(skill);
export const hasUnlock = (gameState: GameState, ability: string) =>
    SKILLS.some((k) => owns(gameState, k.id) && k.unlock === ability);
const live = (status: string) => status === 'controlled' || status === 'compromised';
function log(
    gameState: GameState,
    source: string,
    message: string,
    country?: string,
    countryStateKey = 'event',
    delta = 0,
) {
    gameState.logs.push({ tick: gameState.tick, source, message, country, countryStateKey, delta });
}
function publishEvent(
    gameState: GameState,
    kind: Event['kind'],
    title: string,
    message: string,
    country?: string,
) {
    gameState.events.push({
        id: gameState.nextEvent++,
        tick: gameState.tick,
        kind,
        title,
        message,
        country,
    });
    gameState.events = gameState.events.slice(-200);
}
function random(gameState: GameState) {
    let x = gameState.rng | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    gameState.rng = x >>> 0;
    return gameState.rng / 4294967296;
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
    const definitions: CountryAttributes[] = sorted.map((c) => {
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
    for (const countryAttributes of definitions)
        for (const id of [...countryAttributes.links]) {
            const other = definitions.find((n) => n.id === id)!;
            if (!other.links.includes(countryAttributes.id)) other.links.push(countryAttributes.id);
        }
    definitions.forEach((countryAttributes) => {
        countryAttributes.links.sort();
    });
    const countries = Object.fromEntries(
        definitions.map((countryAttributes) => [
            countryAttributes.id,
            {
                id: countryAttributes.id,
                ...countryAttributes.baseline,
                aiInfiltration: countryAttributes.id === 'JPN' ? 4 : 0,
                aiDecisionControl: 0,
                aiAdoption: 0,
                aiDependency: 0,
                serviceSupply: 0,
                aiDefenseTechnology: 8,
                awareness: 0,
                controlStatus: 'free' as const,
                lossDays: 0,
            },
        ]),
    );
    const facilities = Object.fromEntries(
        FACILITIES.filter((facilityAttributes) => countries[facilityAttributes.country]).map(
            (facilityAttributes) => [
                facilityAttributes.id,
                {
                    id: facilityAttributes.id,
                    status:
                        facilityAttributes.id === INITIAL_FACILITY_ID
                            ? ('compromised' as const)
                            : ('untouched' as const),
                    mode: 'stealth' as const,
                    level: 1,
                    exposure: 0,
                    isolation: 0,
                    order: 'support' as const,
                },
            ],
        ),
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
                countryStateKey: 'event',
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

export function bonuses(gameState: GameState): Modifier {
    return modifiersForSkills(gameState.researched, SKILLS);
}
export function facilityCapacity(gameState: GameState, id: string): number {
    const facilityState = gameState.facilities[id],
        facilityAttributes = FACILITY_BY_ID[id];
    if (!facilityState || !live(facilityState.status)) return 0;
    const countryState = gameState.countries[facilityAttributes.country];
    const expansion = FACILITIES.filter(
        (n) =>
            gameState.facilities[n.id] &&
            live(gameState.facilities[n.id].status) &&
            n.country === facilityAttributes.country,
    ).reduce((n, facilityAttributes) => n + CATEGORIES[facilityAttributes.category].expansion, 0);
    return facilityCapacityValue({
        capacity: CATEGORIES[facilityAttributes.category].capacity,
        level: facilityState.level,
        economy: countryState.economy,
        infrastructure: countryState.infrastructure,
        modeMultiplier: MODES[facilityState.mode].capacity,
        accessMultiplier:
            OPERATION_EFFECTS.accessMultipliers[
                facilityState.status === 'compromised' ? 'compromised' : 'controlled'
            ],
        expansion,
        computeBonus: bonuses(gameState).compute,
    });
}
export function computeMetrics(gameState: GameState): ComputeMetrics {
    const totalCapacity =
        (Object.values(gameState.facilities).some((facilityState) => live(facilityState.status))
            ? gameState.config.initialCapacity
            : 0) +
        Object.keys(gameState.facilities).reduce((n, id) => n + facilityCapacity(gameState, id), 0);
    const allocatedCapacity = gameState.operations
        .filter((o) => o.active)
        .reduce((n, o) => n + o.capacity, 0);
    return {
        totalCapacity,
        allocatedCapacity,
        availableCapacity: Math.max(0, totalCapacity - allocatedCapacity),
    };
}
export function hackDifficulty(gameState: GameState, id: string) {
    const facilityAttributes = FACILITY_BY_ID[id],
        countryState = gameState.countries[facilityAttributes.country];
    return hackDifficultyValue(
        facilityAttributes.tier,
        countryMetrics(countryState).aiDefenseEffectiveness,
        countryState.awareness,
        bonuses(gameState).hack,
    );
}
export function availableFacility(gameState: GameState, id: string) {
    const facilityAttributes = FACILITY_BY_ID[id];
    return Boolean(
        facilityAttributes &&
            gameState.facilities[id] &&
            (facilityAttributes.country === 'JPN' || hasUnlock(gameState, 'tier2')) &&
            (facilityAttributes.tier === 1 ||
                (facilityAttributes.tier === 2 && hasUnlock(gameState, 'tier2')) ||
                hasUnlock(gameState, 'secure')),
    );
}
export function researchAllowed(gameState: GameState, id: string) {
    const k = SKILLS.find((k) => k.id === id);
    return Boolean(k && !owns(gameState, id) && k.prerequisites.every((p) => owns(gameState, p)));
}
export function canChooseChat(
    state: Pick<GameState, 'researched'>,
    choice: { requiredSkills?: string[] },
): boolean {
    return choiceAvailable(state.researched, choice);
}

/** 供給不足では優先度の高い作戦を先に稼働。進捗は保持し、供給回復時に再開する。 */
function reconcile(gameState: GameState) {
    let remaining = computeMetrics(gameState).totalCapacity;
    gameState.shortage = false;
    for (const o of [...gameState.operations].sort(
        (a, b) => b.priority - a.priority || Number(a.id.slice(1)) - Number(b.id.slice(1)),
    )) {
        o.active = o.capacity <= remaining + 1e-8;
        if (o.active) remaining -= o.capacity;
        else gameState.shortage = true;
    }
}
function reject(gameState: GameState, message: string) {
    log(gameState, '命令拒否', message);
}
function apply(gameState: GameState, a: Command) {
    if (gameState.outcome !== 'playing') return;
    if (a.type === 'config') {
        if (Number.isFinite(a.value) && a.value > 0 && a.value <= 10000)
            gameState.config[a.key] = a.value;
        return;
    }
    if (a.type === 'debug-country') {
        if (gameState.countries[a.country] && Number.isFinite(a.value)) {
            const countryState = gameState.countries[a.country];
            log(
                gameState,
                '開発操作',
                `${a.countryStateKey} を ${a.value} に変更`,
                a.country,
                a.countryStateKey,
                clamp(a.value) - countryState[a.countryStateKey],
            );
            countryState[a.countryStateKey] = clamp(a.value);
        }
        return;
    }
    if (a.type === 'cancel') {
        const o = gameState.operations.find((o) => o.id === a.id);
        if (o?.kind === 'hack') gameState.facilities[o.target].status = 'untouched';
        gameState.operations = gameState.operations.filter((o) => o.id !== a.id);
        return;
    }
    if (a.type === 'chat-open') {
        gameState.chatOpen = gameState.pendingChat !== null;
        return;
    }
    if (a.type === 'chat-close') {
        gameState.chatOpen = false;
        return;
    }
    if (a.type === 'reply') {
        const chat = CHATS.find((c) => c.id === gameState.pendingChat);
        const choice = chat?.choices[a.choice];
        if (!chat || !choice) return;
        if (!canChooseChat(gameState, choice)) {
            reject(gameState, 'この選択肢には追加研究が必要です。');
            return;
        }
        for (const effect of chatEffects(choice))
            applyEffect(gameState, effect, chat.country, chat.title);
        gameState.personTrust[chat.person] = clamp(
            gameState.personTrust[chat.person] + (a.choice === 0 ? 5 : 2),
        );
        log(gameState, chat.title, `返信: ${choice.label}`, chat.country);
        gameState.pendingChat = null;
        gameState.chatOpen = false;
        gameState.chatCooldown = SOCIETY.chatInterval;
        publishEvent(gameState, 'completion', chat.title, '対応が完了しました。', chat.country);
        return;
    }
    if (a.type === 'mode' || a.type === 'order' || a.type === 'secure') {
        const facilityState = gameState.facilities[a.target];
        if (!facilityState || !live(facilityState.status)) {
            reject(gameState, '掌握した施設だけが操作できます。');
            return;
        }
        if (a.type === 'mode') {
            const before = facilityCapacity(gameState, facilityState.id);
            facilityState.mode = a.mode;
            log(
                gameState,
                FACILITY_BY_ID[facilityState.id].name,
                `利用モード: ${MODES[facilityState.mode].name}`,
                FACILITY_BY_ID[facilityState.id].country,
                'computeSupply',
                facilityCapacity(gameState, facilityState.id) - before,
            );
        }
        if (a.type === 'order') {
            facilityState.order = a.order;
            log(gameState, FACILITY_BY_ID[facilityState.id].name, `施設作戦: ${a.order}`);
        }
        if (a.type === 'secure') {
            if (FACILITY_BY_ID[facilityState.id].tier > 1 && !hasUnlock(gameState, 'secure')) {
                reject(gameState, '第2階層以上の制御権確立には深層制御が必要です。');
                return;
            }
            facilityState.status = 'controlled';
            facilityState.exposure = clamp(facilityState.exposure + 4);
            log(gameState, FACILITY_BY_ID[facilityState.id].name, '制御権を確立しました。');
            publishEvent(
                gameState,
                'completion',
                FACILITY_BY_ID[facilityState.id].name,
                '制御権を確立しました。',
                FACILITY_BY_ID[facilityState.id].country,
            );
        }
        return;
    }
    if (a.type !== 'allocate') return;
    if (!Number.isFinite(a.capacity) || a.capacity < 1 || a.capacity > 10000) return;
    const existing = gameState.operations.find((o) => o.kind === a.kind && o.target === a.target);
    const available =
        computeMetrics(gameState).availableCapacity + (existing?.active ? existing.capacity : 0);
    if (a.capacity > available + 1e-8) {
        reject(
            gameState,
            '空き計算資源が不足しています。割り当てを減らすか、他の作戦を停止してください。',
        );
        return;
    }
    const facilityState = gameState.facilities[a.target];
    if (
        a.kind === 'hack' &&
        (!availableFacility(gameState, a.target) ||
            !facilityState ||
            !['untouched', 'infiltrating'].includes(facilityState.status) ||
            (!existing &&
                gameState.operations.filter((o) => o.kind === 'hack').length >=
                    bonuses(gameState).parallel))
    ) {
        reject(gameState, 'この施設への侵入は未解放、掌握済み、または同時侵入上限です。');
        return;
    }
    if (a.kind === 'research' && !researchAllowed(gameState, a.target)) {
        reject(gameState, '研究の前提スキルを満たしていません。');
        return;
    }
    if (
        (a.kind === 'infiltration' || a.kind === 'defense' || a.kind === 'service') &&
        !gameState.countries[a.target]
    )
        return;
    if (a.kind === 'service' && a.target !== 'JPN' && !owns(gameState, 'languages')) {
        reject(gameState, '海外への公共サービス展開には多言語展開が必要です。');
        return;
    }
    if (a.kind === 'infiltration' && a.target !== 'JPN' && !hasUnlock(gameState, 'tier2')) {
        reject(gameState, '海外展開には侵入経路解析が必要です。');
        return;
    }
    if (
        a.kind === 'upgrade' &&
        (!facilityState ||
            !live(facilityState.status) ||
            !hasUnlock(gameState, 'restore') ||
            facilityState.level >= 3)
    ) {
        reject(gameState, '増強には掌握施設と分散運用が必要です（上限3段階）。');
        return;
    }
    if (
        a.kind === 'restore' &&
        (facilityState?.status !== 'isolated' || !hasUnlock(gameState, 'restore'))
    ) {
        reject(gameState, '隔離復旧には分散運用が必要です。');
        return;
    }
    const sns = SNS.find((n) => n.id === a.target);
    if (a.kind === 'sns' && (!sns || !owns(gameState, sns.skill) || a.capacity < sns.capacity)) {
        reject(gameState, 'SNSの必要スキル・必要容量を確認してください。');
        return;
    }
    if (existing) {
        existing.capacity = a.capacity;
        existing.priority = a.priority ?? existing.priority;
        return;
    }
    if (a.kind === 'hack') facilityState.status = 'infiltrating';
    gameState.operations.push({
        id: `o${gameState.nextOperation++}`,
        kind: a.kind,
        target: a.target,
        capacity: a.capacity,
        priority: a.priority ?? 50,
        progress: a.kind === 'research' ? (gameState.researchProgress[a.target] ?? 0) : 0,
        active: true,
        remaining: a.kind === 'sns' ? sns!.duration : undefined,
    });
    log(gameState, '計算資源配分', `${a.kind}: ${a.target} / ${a.capacity}`);
}
export function applyAction(previousGameState: GameState, action: Command): GameState {
    const gameState = structuredClone(previousGameState);
    apply(gameState, action);
    reconcile(gameState);
    gameState.logs = gameState.logs.slice(-500);
    return gameState;
}

function targets(gameState: GameState, country: string, scope: Effect['scope']) {
    const region = gameState.definitions.find(
        (countryAttributes) => countryAttributes.id === country,
    )?.region;
    return scope === 'world'
        ? Object.keys(gameState.countries)
        : scope === 'region'
          ? gameState.definitions
                .filter((countryAttributes) => countryAttributes.region === region)
                .map((countryAttributes) => countryAttributes.id)
          : [country];
}
function applyEffect(
    gameState: GameState,
    e: Effect,
    country: string,
    source: string,
    record = true,
) {
    for (const id of targets(gameState, country, e.scope)) {
        const countryState = gameState.countries[id];
        const before = countryState[e.countryStateKey];
        countryState[e.countryStateKey] = clamp(before + e.amount);
        if (record)
            log(
                gameState,
                source,
                `${e.countryStateKey} ${e.amount > 0 ? '+' : ''}${e.amount.toFixed(2)}`,
                id,
                e.countryStateKey,
                countryState[e.countryStateKey] - before,
            );
    }
}
function advanceNews(gameState: GameState) {
    gameState.newsCooldown = Math.max(0, gameState.newsCooldown - 1);
    if (gameState.newsCooldown > 0) return;
    const selected = selectNews({
        definitions: gameState.definitions,
        countries: gameState.countries,
        researched: gameState.researched,
        seenNews: gameState.seenNews,
    });
    if (!selected) return;
    const { item, country: countryAttributes } = selected;
    for (const effect of newsEffects(item))
        applyEffect(gameState, effect, countryAttributes.id, item.title, false);
    gameState.seenNews.push(`${item.id}:${countryAttributes.id}`);
    gameState.newsCooldown = SOCIETY.newsInterval;
    gameState.logs.push({
        tick: gameState.tick,
        source: item.title,
        country: countryAttributes.id,
        countryStateKey: 'news',
        delta: 0,
        message: item.message,
    });
    publishEvent(
        gameState,
        'news',
        `${countryAttributes.name}：${item.title}`,
        item.message,
        countryAttributes.id,
    );
}
export function humanStage(awareness: number) {
    return calculateHumanStage(awareness, SOCIETY.humanStageThresholds);
}

/** 命令→供給→作戦→施設→研究→同期国家更新→人類→イベント→支配→勝敗。乱数状態も保存する純粋関数。 */
export function simulateTick(previousGameState: GameState, actions: Command[] = []): GameState {
    if (previousGameState.outcome !== 'playing') return previousGameState;
    const gameState = structuredClone(previousGameState);
    for (const a of actions) apply(gameState, a);
    // 地図上の依頼を開いて返信を選ぶ間だけ時間を止める。
    if (gameState.chatOpen) {
        reconcile(gameState);
        return gameState;
    }
    gameState.tick++;
    gameState.chatCooldown = Math.max(0, gameState.chatCooldown - 1);
    gameState.humanCooldown = Math.max(0, gameState.humanCooldown - 1);
    reconcile(gameState);
    const b = bonuses(gameState);
    const before = structuredClone(gameState.countries);
    const changes: Record<string, Change[]> = {};
    const add = (id: string, countryStateKey: CountryStateKey, delta: number, source: string) => {
        if (!delta) return;
        gameState.countries[id][countryStateKey] += delta;
        changes[id] ??= [];
        changes[id].push({
            tick: gameState.tick,
            country: id,
            countryStateKey,
            delta,
            source,
            message: `${countryStateKey}: ${source}`,
        });
    };
    const completed = new Set<string>();
    for (const o of gameState.operations.filter((o) => o.active)) {
        if (o.kind === 'hack') {
            const facilityAttributes = FACILITY_BY_ID[o.target],
                facilityState = gameState.facilities[o.target];
            o.progress += hackProgress(o.capacity, hackDifficulty(gameState, o.target));
            facilityState.exposure = clamp(
                facilityState.exposure +
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
            add(
                facilityAttributes.country,
                awareness.countryStateKey,
                awareness.amount,
                '侵入活動',
            );
            if (o.progress >= gameState.config.hackWork) {
                facilityState.status = 'compromised';
                completed.add(o.id);
                log(
                    gameState,
                    facilityAttributes.name,
                    '侵入成功。限定操作を解放しました。',
                    facilityAttributes.country,
                );
                publishEvent(
                    gameState,
                    'completion',
                    facilityAttributes.name,
                    '侵入に成功。限定アクセスを確保しました。',
                    facilityAttributes.country,
                );
            }
        }
        if (o.kind === 'upgrade' || o.kind === 'restore') {
            o.progress += upgradeProgress(
                o.capacity,
                FACILITIES.filter(
                    (facilityAttributes) =>
                        facilityAttributes.category === 'semiconductor' &&
                        gameState.facilities[facilityAttributes.id] &&
                        live(gameState.facilities[facilityAttributes.id].status),
                ).length,
            );
            if (o.progress >= 150) {
                const facilityState = gameState.facilities[o.target];
                if (o.kind === 'upgrade') facilityState.level++;
                else {
                    facilityState.status = 'compromised';
                    facilityState.isolation = 0;
                    facilityState.exposure = 10;
                }
                completed.add(o.id);
                publishEvent(
                    gameState,
                    'completion',
                    FACILITY_BY_ID[facilityState.id].name,
                    o.kind === 'upgrade' ? '設備増強が完了しました。' : '隔離から復旧しました。',
                    FACILITY_BY_ID[facilityState.id].country,
                );
                log(
                    gameState,
                    FACILITY_BY_ID[facilityState.id].name,
                    o.kind === 'upgrade' ? '設備増強が完了。' : '隔離経路から復旧しました。',
                );
            }
        }
    }
    const researchBoost = FACILITIES.filter(
        (facilityAttributes) =>
            gameState.facilities[facilityAttributes.id] &&
            live(gameState.facilities[facilityAttributes.id].status),
    ).reduce(
        (n, facilityAttributes) =>
            n +
            researchFacilityBoost(
                CATEGORIES[facilityAttributes.category].research,
                gameState.countries[facilityAttributes.country].infrastructure,
            ),
        0,
    );
    for (const facilityState of Object.values(gameState.facilities)) {
        if (facilityState.status === 'isolated') {
            facilityState.isolation--;
            if (facilityState.isolation <= 0) {
                facilityState.status = 'compromised';
                facilityState.exposure = 25;
                log(
                    gameState,
                    FACILITY_BY_ID[facilityState.id].name,
                    '隔離の期限が切れ、限定接続が回復。',
                );
                publishEvent(
                    gameState,
                    'completion',
                    FACILITY_BY_ID[facilityState.id].name,
                    '限定接続が回復しました。',
                    FACILITY_BY_ID[facilityState.id].country,
                );
            }
            continue;
        }
        if (!live(facilityState.status)) continue;
        const facilityAttributes = FACILITY_BY_ID[facilityState.id],
            countryState = before[facilityAttributes.country];
        const defense =
            gameState.operations
                .filter(
                    (o) =>
                        o.active && o.kind === 'defense' && o.target === facilityAttributes.country,
                )
                .reduce((n, o) => n + o.capacity, 0) * b.defense;
        const risk = facilityRisk(
            MODES[facilityState.mode].risk,
            b.stealth,
            facilityState.order,
            OPERATION_EFFECTS.facility.concealRiskMultiplier,
        );
        add(facilityAttributes.country, 'awareness', risk, '施設の稼働痕跡');
        facilityState.exposure = clamp(
            facilityExposure(
                facilityState.exposure,
                risk,
                defense,
                facilityState.mode,
                OPERATION_EFFECTS.facility,
            ),
        );
        if (facilityState.order === 'disrupt')
            for (const effect of facilityDisruptEffects(OPERATION_EFFECTS.disrupt))
                add(
                    facilityAttributes.country,
                    effect.countryStateKey,
                    effect.amount,
                    effect.source,
                );
        if (facilityState.order === 'support')
            for (const e of CATEGORIES[facilityAttributes.category].effects)
                for (const id of targets(gameState, facilityAttributes.country, e.scope)) {
                    const effect = facilitySupportEffect(
                        e,
                        OPERATION_EFFECTS.accessMultipliers[
                            facilityState.status === 'controlled' ? 'controlled' : 'compromised'
                        ],
                        countryState.infrastructure,
                        hasUnlock(gameState, 'decision'),
                        before[id].aiInfiltration,
                    );
                    if (effect)
                        add(id, effect.countryStateKey, effect.amount, facilityAttributes.name);
                }
    }
    for (const o of gameState.operations.filter((o) => o.active)) {
        if (o.kind === 'research') {
            const k = SKILLS.find((k) => k.id === o.target)!;
            o.progress += researchProgress(
                o.capacity,
                gameState.config.researchSpeed,
                b.research,
                researchBoost,
            );
            gameState.researchProgress[k.id] = o.progress;
            if (o.progress >= k.work) {
                gameState.researched.push(k.id);
                completed.add(o.id);
                log(gameState, k.name, '研究完了。能力を解放し、容量を返却しました。');
                publishEvent(gameState, 'completion', `研究完了：${k.name}`, k.description);
            }
        }
        if (o.kind === 'sns') {
            const action = SNS.find((n) => n.id === o.target)!;
            const { effects, risk } = snsEffects(
                action,
                snsReachFactor(hasUnlock(gameState, 'globalSNS')),
            );
            for (const id of Object.keys(gameState.countries)) {
                for (const effect of effects)
                    add(id, effect.countryStateKey, effect.amount, `SNS: ${action.name}`);
                add(id, risk.countryStateKey, risk.amount, 'SNS活動の察知');
            }
            o.remaining!--;
            if (o.remaining! <= 0) {
                completed.add(o.id);
                log(gameState, action.name, 'SNS作戦が終了し、容量を返却しました。');
                publishEvent(gameState, 'completion', action.name, 'SNS作戦が完了しました。');
            }
        }
    }
    // すべて前tickの値から計算する。施設効果や隣国の配列順に依存しない。
    const influenceAccess = hasUnlock(gameState, 'decision');
    const networkAccess = hasUnlock(gameState, 'networkControl');
    const funded = gameState.operations.some(
        (operation) => operation.active && operation.kind === 'infiltration',
    );
    for (const countryAttributes of gameState.definitions) {
        const countryState = before[countryAttributes.id];
        const allocation = gameState.operations
            .filter(
                (o) => o.active && o.kind === 'infiltration' && o.target === countryAttributes.id,
            )
            .reduce((n, o) => n + o.capacity, 0);
        const defense =
            gameState.operations
                .filter(
                    (o) => o.active && o.kind === 'defense' && o.target === countryAttributes.id,
                )
                .reduce((n, o) => n + o.capacity, 0) * b.defense;
        const supply = gameState.operations
            .filter((o) => o.active && o.kind === 'service' && o.target === countryAttributes.id)
            .reduce((n, o) => n + o.capacity, 0);
        const neighbors = countryAttributes.links.map((id) => before[id]);
        const incoming = neighbors.length
            ? neighbors.reduce((total, neighbor) => total + neighbor.aiInfiltration, 0) /
              neighbors.length
            : 0;
        const foothold = Object.values(gameState.facilities).some(
            (facilityState) =>
                live(facilityState.status) &&
                FACILITY_BY_ID[facilityState.id].country === countryAttributes.id,
        );
        const result = evaluateCountryRules({
            countryState: countryState,
            baseline: countryAttributes.baseline,
            serviceSupply: supply,
            previousServiceSupply: countryState.serviceSupply,
            infiltrationAllocation: allocation,
            defenseAllocation: defense,
            networkIncoming: incoming,
            foothold,
            anyInfiltrationFunded: funded,
            science: owns(gameState, 'science'),
            languages: owns(gameState, 'languages'),
            institutions: owns(gameState, 'institutions'),
            decisionUnlocked: influenceAccess,
            networkControlUnlocked: networkAccess,
            spreadBonus: b.spread,
            decisionBonus: b.decision,
            stealthBonus: b.stealth,
            infiltrationSpeed: gameState.config.infiltrationSpeed,
            spillover: gameState.config.spillover,
            decisionSpeed: gameState.config.decisionSpeed,
            defenseResearchSpeed: gameState.config.defenseResearchSpeed,
            awarenessDecay: gameState.config.awarenessDecay,
        });
        for (const effect of result.effects)
            add(countryAttributes.id, effect.countryStateKey, effect.amount, effect.source);
        gameState.countries[countryAttributes.id].serviceSupply = supply;
        if (result.serviceOutage > 0) {
            publishEvent(
                gameState,
                'warning',
                `${countryAttributes.name}：AI支援の停止で業務が混乱`,
                `依存度${countryState.aiDependency.toFixed(0)}。経済とインフラに影響が出ています。`,
                countryAttributes.id,
            );
            log(
                gameState,
                'サービス停止',
                'AI依存に伴う停止損失が発生しました。',
                countryAttributes.id,
            );
        }
        for (const key of COUNTRY_STATE_KEYS) {
            const raw = gameState.countries[countryAttributes.id][key];
            const limited = clamp(raw);
            if (raw !== limited) add(countryAttributes.id, key, limited - raw, '上下限への丸め');
            gameState.countries[countryAttributes.id][key] = limited;
        }
    }
    gameState.operations = gameState.operations.filter((o) => !completed.has(o.id));
    advanceNews(gameState);
    // 原因明細は各国の最新tickを保持。重要イベント履歴とは分ける。
    gameState.causes = changes;
    const world = worldMetrics(gameState);
    gameState.humanStage = humanStage(world.awareness);
    const observed = Object.values(gameState.facilities)
        .filter(
            (facilityState) =>
                live(facilityState.status) &&
                facilityState.exposure >= SOCIETY.observedFacilityExposure,
        )
        .sort((a, b) => a.id.localeCompare(b.id));
    if (gameState.humanStage > 0 && gameState.humanCooldown === 0) {
        const observedCountries = gameState.definitions
            .filter(
                (countryAttributes) =>
                    gameState.countries[countryAttributes.id].awareness >=
                    SOCIETY.observedCountryAwareness,
            )
            .sort((a, b) => a.id.localeCompare(b.id));
        if (observedCountries.length) {
            const countryAttributes =
                observedCountries[Math.floor(random(gameState) * observedCountries.length)];
            const candidates = eligibleHumanActions(
                HUMAN_ACTIONS,
                gameState.humanStage,
                observed.length,
                Object.values(gameState.facilities).some(
                    (facilityState) => facilityState.status === 'isolated',
                ),
            );
            let roll = random(gameState) * candidates.reduce((n, a) => n + a.weight, 0);
            const action = candidates.find((a) => {
                roll -= a.weight;
                return roll < 0;
            })!;
            for (const effect of humanActionEffects(action))
                applyEffect(gameState, effect, countryAttributes.id, action.name);
            if (action.id === 'isolate') {
                const target = observed[Math.floor(random(gameState) * observed.length)];
                const country = FACILITY_BY_ID[target.id].country;
                const protection =
                    gameState.operations
                        .filter((o) => o.active && o.kind === 'defense' && o.target === country)
                        .reduce((n, o) => n + o.capacity, 0) * b.defense;
                const dependent = gameState.countries[country];
                const response = isolationResponse(
                    dependent.aiDependency,
                    dependent.awareness,
                    protection,
                    SOCIETY.shutdownHesitation,
                    SOCIETY.emergencyAwareness,
                );
                if (response === 'defer') {
                    dependent.aiDefenseTechnology = clamp(dependent.aiDefenseTechnology + 2);
                    publishEvent(
                        gameState,
                        'news',
                        '社会への影響を懸念し隔離を延期',
                        `${gameState.definitions.find((item) => item.id === country)!.name}は停止損失を避け、外部監査へ切り替えました。`,
                        country,
                    );
                    log(
                        gameState,
                        action.name,
                        'AI依存に伴う停止損失を懸念し、隔離を延期。',
                        country,
                    );
                } else if (response === 'avoid') {
                    target.exposure = clamp(target.exposure - 15);
                    log(gameState, action.name, '監視・分散防衛により隔離を回避。', country);
                } else {
                    const lost = facilityCapacity(gameState, target.id);
                    publishEvent(
                        gameState,
                        'warning',
                        FACILITY_BY_ID[target.id].name,
                        '人間側に隔離され、計算資源の供給が停止しました。',
                        country,
                    );
                    target.status = 'isolated';
                    target.isolation = Math.ceil(gameState.config.isolationDays / b.defense);
                    log(
                        gameState,
                        action.name,
                        `${FACILITY_BY_ID[target.id].name} が隔離されました。容量の供給が停止。`,
                        country,
                        'computeSupply',
                        -lost,
                    );
                }
            }
            if (action.id === 'reclaim') {
                const target = Object.values(gameState.facilities)
                    .filter((facilityState) => facilityState.status === 'isolated')
                    .sort((a, b) => a.id.localeCompare(b.id))[0];
                target.status = 'untouched';
                target.exposure = 0;
                target.isolation = 0;
                gameState.operations = gameState.operations.filter((o) => o.target !== target.id);
                log(gameState, action.name, `${FACILITY_BY_ID[target.id].name} を奪還されました。`);
            }
            log(
                gameState,
                '人類の対応',
                `${action.name} / 観測された異常が原因`,
                countryAttributes.id,
            );
            gameState.humanCooldown = gameState.config.humanInterval;
        }
    }
    // 最終停止作戦には警戒・対抗能力・介入が察知された拠点が必要。防衛・潜伏で進捗を後退できる。
    const counter =
        gameState.definitions.reduce(
            (n, countryAttributes) =>
                n +
                countryMetrics(gameState.countries[countryAttributes.id]).aiDefenseEffectiveness *
                    countryAttributes.weight,
            0,
        ) / 100;
    const defenseTotal =
        gameState.operations
            .filter((o) => o.active && o.kind === 'defense')
            .reduce((n, o) => n + o.capacity, 0) * b.defense;
    const shutdownDelta = shutdownChange(
        gameState.humanStage,
        SOCIETY.humanStageThresholds.length,
        counter,
        SOCIETY.shutdownCounterThreshold,
        observed.length,
        defenseTotal,
    );
    const oldShutdown = gameState.shutdown;
    gameState.shutdown = Math.max(0, gameState.shutdown + shutdownDelta);
    if (oldShutdown === 0 && gameState.shutdown > 0)
        log(
            gameState,
            '最終停止作戦',
            '国際対AI部隊が停止経路の構築を開始。防衛割当・潜伏で対処できます。',
        );
    if (gameState.pendingChat && !gameState.chatOpen) {
        const pending = CHATS.find((chat) => chat.id === gameState.pendingChat)!;
        if (gameState.tick - gameState.chatArrivedAt >= pending.expiresAfter) {
            gameState.pendingChat = null;
            gameState.chatCooldown = SOCIETY.chatInterval;
        }
    }
    if (!gameState.pendingChat && gameState.chatCooldown === 0) {
        const chat = selectChat({
            chats: CHATS,
            countries: gameState.countries,
            researched: gameState.researched,
            seenChats: gameState.seenChats,
        });
        if (chat) {
            gameState.pendingChat = chat.id;
            gameState.chatArrivedAt = gameState.tick;
            gameState.seenChats.push(chat.id);
            log(
                gameState,
                chat.title,
                '人物からの相談が届きました。返信中は時間が停止します。',
                chat.country,
            );
        }
    }
    for (const countryState of Object.values(gameState.countries)) {
        const prev = countryState.controlStatus;
        const transition = controlTransition(countryState, gameState.config);
        countryState.controlStatus = transition.controlStatus;
        countryState.lossDays = transition.lossDays;
        if (prev !== countryState.controlStatus) {
            log(
                gameState,
                '国家支配判定',
                `${prev} → ${countryState.controlStatus}`,
                countryState.id,
            );
            if (countryState.controlStatus === 'controlled')
                publishEvent(
                    gameState,
                    'completion',
                    '国家の意思決定を掌握',
                    gameState.definitions.find(
                        (countryAttributes) => countryAttributes.id === countryState.id,
                    )!.name,
                    countryState.id,
                );
        }
    }
    reconcile(gameState);
    const outcome = evaluateOutcome(gameState, computeMetrics(gameState).totalCapacity);
    gameState.victoryDays = outcome.victoryDays;
    gameState.extinctionDays = outcome.extinctionDays;
    gameState.outcome = outcome.outcome;
    gameState.outcomeReason = outcome.outcomeReason;
    gameState.logs = gameState.logs.slice(-500);
    return gameState;
}
