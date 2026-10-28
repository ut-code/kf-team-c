import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CHATS, FACILITIES, SKILLS, SNS } from '../src/game/data.ts';
import {
    applyAction,
    availableFacility,
    computeState,
    createInitialState,
    facilityCapacity,
    humanStage,
    researchAllowed,
    simulateTick,
} from '../src/game/engine.ts';
import { evaluateOutcome, worldMetrics } from '../src/game/outcome.ts';
import { choiceAvailable, selectNews } from '../src/game/society.ts';
import { planStrategy } from '../src/game/strategies.ts';
import type { GameState } from '../src/game/types.ts';
import { TRAFFIC_ROUTES, trafficActivity } from '../src/map/traffic.ts';

const countries = JSON.parse(
    readFileSync(new URL('../public/maps/countries.json', import.meta.url), 'utf8'),
);
const initial = () => {
    const s = createInitialState(countries, 123);
    s.seenChats = CHATS.map((c) => c.id);
    return s;
};

test('固定シード・固定操作列の全状態を従来挙動と比較する', () => {
    let state = createInitialState(countries, 123);
    const commands = [
        { type: 'allocate', kind: 'service', target: 'JPN', capacity: 4 },
        { type: 'debug-country', country: 'JPN', metric: 'aiAdoption', value: 30 },
        { type: 'secure', target: 'f11' },
    ] as const;
    for (const command of commands) state = applyAction(state, command);
    state = ticks(state, 40);
    state = applyAction(state, { type: 'cancel', id: 'o1' });
    state = ticks(state, 12);
    assert.equal(
        createHash('sha256').update(JSON.stringify(state)).digest('hex'),
        '3ee4a308cc1388c3afe3f45568bc662e71eab24bba2358dfbbb463029e82495e',
    );
});
function ticks(s: GameState, n: number) {
    for (let i = 0; i < n; i++) s = simulateTick(s);
    return s;
}
function strong() {
    const s = initial();
    for (const f of Object.values(s.facilities)) {
        f.status = 'controlled';
        f.mode = 'full';
    }
    s.researched = SKILLS.map((k) => k.id);
    return s;
}

test('社会機能が停止した地域では往来が減る', () => {
    const base = initial();
    const route = TRAFFIC_ROUTES[0];
    const active = trafficActivity(route, base.countries);
    for (const id of [route.originCountry, route.destinationCountry]) {
        base.countries[id].infrastructure = 0;
        base.countries[id].economy = 0;
    }
    assert.ok(active > 0);
    assert.equal(trafficActivity(route, base.countries), 0);
});

test('公共サービスを併用する通常命令でも勝利まで到達する', (context) => {
    let state = createInitialState(countries, 42);
    for (let i = 0; i < 2700 && state.outcome === 'playing'; i++) {
        state = simulateTick(state, planStrategy(state, 'research'));
        if (
            state.outcome === 'playing' &&
            !state.operations.some((operation) => operation.kind === 'service') &&
            computeState(state).availableCapacity >= 4
        )
            state = applyAction(state, {
                type: 'allocate',
                kind: 'service',
                target: 'JPN',
                capacity: 4,
                priority: 70,
            });
    }
    assert.equal(state.outcome, 'victory');
    assert.ok(state.countries.JPN.aiAdoption > 30);
    assert.ok(state.countries.JPN.aiDependency > 25);
    assert.ok(state.seenNews.length > 0);
    context.diagnostic(
        `${state.tick}日で勝利。日本の導入率${state.countries.JPN.aiAdoption.toFixed(1)}%、依存度${state.countries.JPN.aiDependency.toFixed(1)}%。`,
    );
});

test('公共サービスの実績で導入が進み、業務統合なしには依存が増えない', () => {
    const base = initial();
    const idle = ticks(base, 120);
    const service = ticks(
        applyAction(base, { type: 'allocate', kind: 'service', target: 'JPN', capacity: 4 }),
        120,
    );
    assert.ok(service.countries.JPN.aiAdoption > 5);
    assert.equal(service.countries.JPN.aiDependency, 0);
    assert.ok(service.countries.JPN.economy > idle.countries.JPN.economy);
    assert.ok(service.countries.JPN.aiCountermeasure > idle.countries.JPN.aiCountermeasure);
    assert.equal(base.countries.JPN.aiAdoption, 0);
    const integrated = structuredClone(service);
    integrated.researched.push('institutions');
    integrated.countries.JPN.aiAdoption = 65;
    assert.ok(ticks(integrated, 150).countries.JPN.aiDependency > 25);
});

test('多言語展開前は海外への公共サービス配分を拒否する', () => {
    const base = initial();
    const action = { type: 'allocate', kind: 'service', target: 'USA', capacity: 4 } as const;
    assert.equal(applyAction(base, action).operations.length, 0);
    base.researched.push('languages');
    assert.equal(applyAction(base, action).operations[0].kind, 'service');
});

test('依存したサービスの停止は一度だけ社会損失を発生させる', () => {
    let base = applyAction(initial(), {
        type: 'allocate',
        kind: 'service',
        target: 'JPN',
        capacity: 4,
    });
    base = simulateTick(base);
    base.countries.JPN.aiAdoption = 75;
    base.countries.JPN.aiDependency = 70;
    base.newsCooldown = 1000;
    const active = simulateTick(base);
    const stopped = simulateTick(applyAction(base, { type: 'cancel', id: base.operations[0].id }));
    assert.ok(active.countries.JPN.economy - stopped.countries.JPN.economy > 6);
    assert.equal(stopped.events.filter((event) => event.title.includes('業務が混乱')).length, 1);
    const later = ticks(stopped, 3);
    assert.equal(later.events.filter((event) => event.title.includes('業務が混乱')).length, 1);
});

test('会話の研究条件をUIだけでなくエンジンでも検証する', () => {
    const base = initial();
    base.pendingChat = CHATS[0].id;
    const choice = CHATS[0].choices[3];
    assert.equal(choiceAvailable(base.researched, choice), false);
    const rejected = applyAction(base, { type: 'reply', choice: 3 });
    assert.equal(rejected.pendingChat, base.pendingChat);
    assert.equal(rejected.countries.JPN.aiAdoption, 0);
    base.researched.push('science');
    const accepted = applyAction(base, { type: 'reply', choice: 3 });
    assert.equal(accepted.pendingChat, null);
    assert.ok(accepted.countries.JPN.aiAdoption > 0);
    assert.equal(accepted.events[0].kind, 'completion');
});

test('社会ニュースは条件を満たす国で発生し、同じ記事を重複発行しない', () => {
    const base = initial();
    assert.equal(selectNews(base), null);
    assert.equal(base.events.length, 0);
    base.countries.JPN.aiAdoption = 30;
    assert.equal(selectNews(base)?.country.id, 'JPN');
    const issued = simulateTick(base);
    assert.equal(issued.events.length, 1);
    assert.equal(issued.events[0].country, 'JPN');
    assert.equal(issued.seenNews.length, 1);
    assert.equal(selectNews(issued), null);
    assert.equal(base.events.length, 0);
});

test('未対応の依頼は期限切れで次の相談を塞がなくなる', () => {
    const base = initial();
    base.pendingChat = CHATS[0].id;
    base.chatArrivedAt = 0;
    const later = ticks(base, CHATS[0].expiresAfter);
    assert.equal(later.pendingChat, null);
    assert.ok(later.chatCooldown > 0);
});

test('依存による隔離の延期は緊急警戒時には適用されない', () => {
    let example: GameState | undefined;
    for (let seed = 1; seed <= 40; seed++) {
        const base = strong();
        base.rng = Math.imul(seed, 0x9e3779b1) >>> 0;
        base.newsCooldown = 1000;
        for (const country of Object.values(base.countries)) {
            country.awareness = 70;
            country.aiAdoption = 90;
            country.aiDependency = 80;
        }
        for (const facility of Object.values(base.facilities)) facility.exposure = 20;
        if (simulateTick(base).events.some((event) => event.title.includes('隔離を延期'))) {
            example = base;
            break;
        }
    }
    assert.ok(example);
    for (const country of Object.values(example.countries)) country.awareness = 95;
    const emergency = simulateTick(example);
    assert.ok(
        Object.values(emergency.facilities).some((facility) => facility.status === 'isolated'),
    );
});

test('全177国・44施設、影響力ウェイト合計100、施設のない国にも接続がある', () => {
    const s = initial();
    assert.equal(s.definitions.length, 177);
    assert.equal(FACILITIES.length, 44);
    assert.ok(Math.abs(s.definitions.reduce((n, d) => n + d.weight, 0) - 100) < 1e-9);
    assert.ok(s.definitions.every((d) => d.links.length > 0));
    assert.equal(s.countries.PER.aiInfiltration, 0);
});
test('初期の行動範囲は限定され、研究で海外と高階層が開く', () => {
    const s = initial();
    assert.ok(availableFacility(s, 'f11'));
    assert.ok(!availableFacility(s, 'f1'));
    assert.ok(!availableFacility(s, 'f20'));
    s.researched = ['intrusion'];
    assert.ok(availableFacility(s, 'f1'));
    assert.ok(availableFacility(s, 'f20'));
    assert.ok(!availableFacility(s, 'f6'));
});
test('同じシードと操作で再現し、元の状態を変更しない', () => {
    const a = strong(),
        copy = structuredClone(a);
    a.countries.USA.awareness = 80;
    const run = () => ticks(a, 200);
    assert.deepEqual(run(), run());
    assert.equal(copy.tick, 0);
    assert.equal(a.tick, 0);
});
test('国家の並び順で波及や更新の結果が変化しない', () => {
    const a = strong();
    a.countries.USA.aiInfiltration = 80;
    const x = applyAction(a, {
        type: 'allocate',
        kind: 'infiltration',
        target: 'USA',
        capacity: 6,
    });
    const y = structuredClone(x);
    y.definitions.reverse();
    const next = simulateTick(x),
        reversed = simulateTick(y);
    assert.deepEqual(next.countries, reversed.countries);
});
test('不正な研究・未掌握施設操作・不正容量を拒否する', () => {
    let s = initial();
    s = applyAction(s, { type: 'allocate', kind: 'research', target: 'root', capacity: 4 });
    s = applyAction(s, { type: 'mode', target: 'f1', mode: 'full' });
    s = applyAction(s, { type: 'allocate', kind: 'research', target: 'unknown', capacity: 4 });
    s = applyAction(s, { type: 'allocate', kind: 'infiltration', target: 'JPN', capacity: -2 });
    assert.equal(s.operations.length, 0);
    assert.equal(s.facilities.f1.mode, 'stealth');
    assert.equal(researchAllowed(s, 'root'), false);
});
test('容量を超えた割当を拒否し、供給低下は優先度順に停止する', () => {
    let s = strong();
    s = applyAction(s, {
        type: 'allocate',
        kind: 'research',
        target: 'intrusion',
        capacity: 99999,
    });
    assert.equal(s.operations.length, 0);
    s.researched = [];
    s = applyAction(s, {
        type: 'allocate',
        kind: 'infiltration',
        target: 'JPN',
        capacity: 5,
        priority: 10,
    });
    s = applyAction(s, {
        type: 'allocate',
        kind: 'defense',
        target: 'JPN',
        capacity: 5,
        priority: 90,
    });
    for (const f of Object.values(s.facilities)) f.status = 'untouched';
    s.facilities.f11.status = 'compromised';
    s.facilities.f11.mode = 'stealth';
    s = simulateTick(s);
    assert.ok(s.shortage);
    assert.equal(s.operations.find((o) => o.kind === 'defense')!.active, true);
    assert.equal(s.operations.find((o) => o.kind === 'infiltration')!.active, false);
    const c = computeState(s);
    assert.ok(c.availableCapacity >= 0);
    assert.ok(c.allocatedCapacity <= c.totalCapacity);
});
test('浸透は投入容量で加速し、対AI能力で抑制される', () => {
    const s = strong();
    const run = (capacity: number, counter = 8) => {
        let x = structuredClone(s);
        x.countries.JPN.aiCountermeasure = counter;
        x = applyAction(x, { type: 'allocate', kind: 'infiltration', target: 'JPN', capacity });
        return ticks(x, 50).countries.JPN.aiInfiltration;
    };
    assert.ok(run(8) > run(2));
    assert.ok(run(8, 5) > run(8, 90));
});
test('施設のない国にも接続ネットワークから波及し、切断すれば抑制される', () => {
    let a = strong();
    a.countries.CHN.aiInfiltration = 90;
    a = applyAction(a, { type: 'allocate', kind: 'infiltration', target: 'CHN', capacity: 4 });
    const b = structuredClone(a);
    b.definitions.find((d) => d.id === 'VNM')!.links = [];
    assert.ok(
        simulateTick(a).countries.VNM.aiInfiltration > simulateTick(b).countries.VNM.aiInfiltration,
    );
});
test('インフラ低下と施設隔離は演算供給を減らす', () => {
    const s = strong();
    const base = facilityCapacity(s, 'f11');
    s.countries.JPN.infrastructure = 20;
    assert.ok(facilityCapacity(s, 'f11') < base);
    const total = computeState(s).totalCapacity;
    s.facilities.f11.status = 'isolated';
    assert.equal(facilityCapacity(s, 'f11'), 0);
    assert.ok(computeState(s).totalCapacity < total);
});
test('利用モードは容量と警戒リスクに影響する', () => {
    const s = initial();
    s.facilities.f11.status = 'controlled';
    const base = facilityCapacity(s, 'f11');
    const a = ticks(s, 30);
    s.facilities.f11.mode = 'full';
    assert.ok(facilityCapacity(s, 'f11') > base * 4);
    const b = ticks(s, 30);
    assert.ok(b.countries.JPN.awareness > a.countries.JPN.awareness);
});
test('ハッキングは時間と容量で進行、完了後に施設操作を解放', () => {
    let s = strong();
    s.facilities.f1.status = 'untouched';
    s = applyAction(s, { type: 'allocate', kind: 'hack', target: 'f1', capacity: 5 });
    assert.equal(s.facilities.f1.status, 'infiltrating');
    s = simulateTick(s);
    assert.ok(s.operations.find((o) => o.kind === 'hack')!.progress > 0);
    s = ticks(s, 100);
    assert.equal(s.facilities.f1.status, 'compromised');
    assert.ok(!s.operations.some((o) => o.kind === 'hack'));
    s = applyAction(s, { type: 'secure', target: 'f1' });
    assert.equal(s.facilities.f1.status, 'controlled');
});
test('研究は容量を占有し、完了後に効果を適用して解放する', () => {
    let s = initial();
    s = applyAction(s, { type: 'allocate', kind: 'research', target: 'compression', capacity: 4 });
    const supply = computeState(s).totalCapacity;
    assert.equal(computeState(s).allocatedCapacity, 4);
    s = ticks(s, 70);
    assert.ok(s.researched.includes('compression'));
    assert.ok(computeState(s).totalCapacity > supply);
    assert.equal(s.operations.length, 0);
});
test('研究中断で進捗を保持し、再開時に引き継ぐ', () => {
    let s = applyAction(initial(), {
        type: 'allocate',
        kind: 'research',
        target: 'intrusion',
        capacity: 4,
    });
    s = ticks(s, 10);
    const progress = s.researchProgress.intrusion;
    s = applyAction(s, { type: 'cancel', id: s.operations[0].id });
    s = applyAction(s, { type: 'allocate', kind: 'research', target: 'intrusion', capacity: 2 });
    assert.equal(s.operations[0].progress, progress);
    assert.ok(simulateTick(s).researchProgress.intrusion > progress);
});
test('SNSは国選択なしで全世界に届き、完了後に容量を返却する', () => {
    let s = initial();
    s = applyAction(s, {
        type: 'allocate',
        kind: 'sns',
        target: 'adoption',
        capacity: 3,
    });
    assert.equal(s.operations.length, 0);
    s.researched = ['analysis'];
    s = applyAction(s, {
        type: 'allocate',
        kind: 'sns',
        target: 'adoption',
        capacity: 3,
    });
    assert.equal(s.operations.length, 1);
    assert.equal('country' in s.operations[0], false);
    const withoutSnsState = initial();
    withoutSnsState.researched = ['analysis'];
    const withoutSns = simulateTick(withoutSnsState);
    s = simulateTick(s);
    for (const id of ['JPN', 'USA', 'BRA'])
        assert.ok(s.countries[id].aiAcceptance > withoutSns.countries[id].aiAcceptance);
    s = applyAction(s, { type: 'allocate', kind: 'sns', target: 'adoption', capacity: 4 });
    assert.equal(s.operations.length, 1);
    s = ticks(s, SNS[0].duration - 1);
    assert.equal(s.countries.JPN.aiDecisionControl, 0);
    assert.equal(s.operations.length, 0);
});
test('チャットを開いた間だけ時間が止まり、返信は共通変数を変える', () => {
    let s = createInitialState(countries);
    s = simulateTick(s);
    assert.ok(s.pendingChat);
    assert.equal(simulateTick(s).tick, s.tick + 1);
    s = applyAction(s, { type: 'chat-open' });
    const tick = s.tick;
    assert.equal(simulateTick(s).tick, tick);
    const prev = s.countries.JPN.aiInfiltration;
    s = applyAction(s, { type: 'reply', choice: 0 });
    assert.equal(s.pendingChat, null);
    assert.ok(s.countries.JPN.aiInfiltration > prev);
    assert.equal(simulateTick(s).tick, tick + 1);
});
test('支配には浸透・意思決定・対抗能力の3条件が必要', () => {
    const s = initial();
    s.countries.JPN.aiInfiltration = 90;
    s.countries.JPN.aiDecisionControl = 90;
    s.countries.JPN.aiCountermeasure = 20;
    const next = simulateTick(s);
    assert.equal(next.countries.JPN.controlStatus, 'controlled');
    assert.ok(Math.abs(worldMetrics(next).control - 7) < 1e-8);
    s.countries.JPN.aiDecisionControl = 0;
    assert.notEqual(simulateTick(s).countries.JPN.controlStatus, 'controlled');
});
test('支配閾値をわずかに下回っても維持し、下限を継続して下回ると解除', () => {
    const s = initial();
    Object.assign(s.countries.JPN, {
        aiInfiltration: 69,
        aiDecisionControl: 69,
        controlStatus: 'controlled',
    });
    assert.equal(ticks(s, 15).countries.JPN.controlStatus, 'controlled');
    s.countries.JPN.aiInfiltration = 30;
    assert.equal(ticks(s, 5).countries.JPN.controlStatus, 'controlled');
    assert.notEqual(ticks(s, 15).countries.JPN.controlStatus, 'controlled');
});
test('世界支配率は施設個数や浸透平均でなく国家ウェイトで計算', () => {
    const s = initial();
    s.countries.USA.controlStatus = 'controlled';
    s.countries.CHN.controlStatus = 'controlled';
    assert.ok(Math.abs(worldMetrics(s).control - 31) < 1e-8);
    s.countries.JPN.aiInfiltration = 100;
    assert.ok(Math.abs(worldMetrics(s).control - 31) < 1e-8);
});
test('勝利には90%の支配を10日維持する必要がある', () => {
    const s = strong();
    for (const c of Object.values(s.countries))
        Object.assign(c, {
            aiInfiltration: 95,
            aiDecisionControl: 95,
            aiCountermeasure: 0,
            controlStatus: 'controlled',
        });
    assert.equal(ticks(s, 9).outcome, 'playing');
    assert.equal(ticks(s, 10).outcome, 'victory');
});
test('警戒100だけで即死せず、最終停止作戦の完了で敗北する', () => {
    const s = strong();
    for (const c of Object.values(s.countries)) c.awareness = 100;
    assert.equal(simulateTick(s).outcome, 'playing');
    s.shutdown = s.config.shutdownDays;
    assert.equal(evaluateOutcome(s, computeState(s).totalCapacity).outcome, 'defeat');
    assert.equal(s.outcome, 'playing');
});
test('生存拠点喪失を継続すると敗北する', () => {
    const s = initial();
    for (const f of Object.values(s.facilities)) f.status = 'untouched';
    assert.equal(ticks(s, s.config.extinctionDays - 1).outcome, 'playing');
    assert.equal(ticks(s, s.config.extinctionDays).outcome, 'defeat');
});
test('警戒度によって人類の対応段階が変わる', () => {
    assert.deepEqual([0, 10, 30, 60, 90].map(humanStage), [0, 1, 2, 3, 4]);
});
test('人類は観測していない施設を隔離できない', () => {
    for (let seed = 1; seed <= 20; seed++) {
        const s = strong();
        s.rng = seed;
        for (const c of Object.values(s.countries)) c.awareness = 65;
        for (const f of Object.values(s.facilities)) f.exposure = 0;
        assert.ok(!Object.values(simulateTick(s).facilities).some((f) => f.status === 'isolated'));
    }
});
test('人類は露見した施設を隔離し、防衛投入で隔離を回避できる', () => {
    const run = (defend: boolean) => {
        let s = strong();
        s.researched = [];
        for (const c of Object.values(s.countries)) {
            c.awareness = 65;
            c.aiCountermeasure = 45;
        }
        s.facilities.f11.exposure = 60;
        if (defend)
            s = applyAction(s, {
                type: 'allocate',
                kind: 'defense',
                target: 'JPN',
                capacity: 10,
                priority: 90,
            });
        return ticks(s, 400);
    };
    const a = run(false),
        b = run(true);
    assert.ok(a.logs.some((l) => l.message.includes('が隔離されました')));
    assert.ok(b.logs.some((l) => l.message.includes('隔離を回避')));
});
test('最終停止作戦は潜伏と防衛で後退させられる', () => {
    let s = strong();
    s.shutdown = 50;
    for (const c of Object.values(s.countries)) {
        c.awareness = 90;
        c.aiCountermeasure = 40;
    }
    s.facilities.f11.exposure = 60;
    s = applyAction(s, { type: 'allocate', kind: 'defense', target: 'JPN', capacity: 40 });
    assert.ok(simulateTick(s).shutdown < 50);
});
test('自律成長に放置勝利はなく、状態は範囲内に収まる', () => {
    const s = ticks(initial(), 1200);
    assert.equal(worldMetrics(s).control, 0);
    assert.equal(s.outcome, 'playing');
    for (const c of Object.values(s.countries))
        for (const key of [
            'infrastructure',
            'economy',
            'politicalControl',
            'aiInfiltration',
            'aiDecisionControl',
            'aiCountermeasure',
            'aiAcceptance',
            'awareness',
        ] as const)
            assert.ok(c[key] >= 0 && c[key] <= 100);
});
test('施設効果・研究・国家更新の原因を確認できる', () => {
    const s = simulateTick(strong());
    assert.ok(s.causes?.JPN.some((c) => c.source === 'スーパーコンピューター「富岳」'));
    assert.ok(s.causes?.JPN.some((c) => c.source === 'インフラによる経済稼働'));
});
test('標準の自動操作はデバッグ変更なしで勝利まで到達する', () => {
    let s = createInitialState(countries, 1);
    for (let n = 0; n < 4000 && s.outcome === 'playing'; n++)
        s = simulateTick(s, planStrategy(s, 'compute'));
    assert.equal(s.outcome, 'victory', `${s.tick}日 支配${worldMetrics(s).control}%`);
});

test('開始日・月跨ぎ・年跨ぎ・閏日を端末の時差によらず計算する', async () => {
    const { gameDate } = await import('../src/game/calendar.ts');
    assert.deepEqual(gameDate(0), { iso: '2022-11-30', label: '2022.11.30' });
    assert.equal(gameDate(1).iso, '2022-12-01');
    assert.equal(gameDate(32).iso, '2023-01-01');
    assert.equal(gameDate(456).iso, '2024-02-29');
});
