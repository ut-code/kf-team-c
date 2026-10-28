import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import photos from '../src/game/data/ui/facility-photos.json' with { type: 'json' };
import flags from '../src/game/data/ui/flags.json' with { type: 'json' };
import {
    CATEGORIES,
    CHATS,
    FACILITIES,
    HUMAN_ACTIONS,
    OPERATION_EFFECTS,
    PEOPLE,
    SKILLS,
    SNS,
} from '../src/game/data.ts';
import { createInitialState } from '../src/game/engine.ts';
import { countryMetrics } from '../src/game/metrics.ts';
import { chatEffects, snsEffects, snsReachFactor } from '../src/game/rules/content.ts';
import {
    controlTransition,
    defenseTechnologyGrowth,
    dependencyChange,
    evaluateCountryRules,
    serviceBenefit,
} from '../src/game/rules/country.ts';
import {
    facilityExposure,
    facilityRisk,
    facilitySupportEffect,
} from '../src/game/rules/facility.ts';
import { isolationResponse, shutdownChange } from '../src/game/rules/human.ts';
import { NEWS } from '../src/game/society.ts';
import type { Effect } from '../src/game/types.ts';

test('国家の因果ルールは入力を変更せずEffectを返し、供給停止は一度だけ損失を与える', () => {
    const input = {
        countryState: {
            infrastructure: 80,
            economy: 70,
            governmentCapacity: 65,
            aiInfiltration: 10,
            aiDecisionControl: 5,
            aiDefenseTechnology: 8,
            aiAcceptance: 50,
            aiAdoption: 40,
            aiDependency: 10,
            awareness: 0,
        },
        baseline: { infrastructure: 80, economy: 70, governmentCapacity: 65, aiAcceptance: 50 },
        serviceSupply: 4,
        previousServiceSupply: 4,
        infiltrationAllocation: 0,
        defenseAllocation: 0,
        networkIncoming: 0,
        foothold: false,
        anyInfiltrationFunded: false,
        science: false,
        languages: false,
        institutions: true,
        decisionUnlocked: false,
        networkControlUnlocked: false,
        spreadBonus: 1,
        decisionBonus: 1,
        stealthBonus: 0,
        infiltrationSpeed: 0.065,
        spillover: 0.013,
        decisionSpeed: 0.018,
        defenseResearchSpeed: 0.014,
        awarenessDecay: 0.045,
    };
    const original = structuredClone(input);
    const amount = (result: ReturnType<typeof evaluateCountryRules>, source: string) =>
        result.effects.find((effect) => effect.source === source)!.amount;
    const active = evaluateCountryRules(input);
    assert.equal(serviceBenefit(4, 80, false, false), 1.6);
    assert.equal(active.serviceOutage, 0);
    assert.ok(Math.abs(amount(active, '業務統合と代替手段の縮小') - 0.18) < 1e-12);
    assert.ok(Math.abs(amount(active, '公共サービスの実績と導入継続') - 0.07568) < 1e-12);
    const stopped = evaluateCountryRules({ ...input, serviceSupply: 0 });
    assert.equal(stopped.serviceOutage, 10);
    assert.ok(Math.abs(amount(stopped, 'AI支援の稼働・停止による社会への影響') + 0.7) < 1e-12);
    assert.equal(amount(stopped, 'AI支援による生産性と停止損失'), -1);
    assert.equal(
        evaluateCountryRules({ ...input, serviceSupply: 0, previousServiceSupply: 0 })
            .serviceOutage,
        0,
    );
    assert.deepEqual(input, original);
});

test('依存の成長と減衰は条件により排他的', () => {
    assert.equal(dependencyChange(40, 10, 4, true), 0.18);
    assert.equal(dependencyChange(40, 10, 4, false), -0.005);
});

test('会話・SNS・施設ルールは入力を変更せず共通Effectを返す', () => {
    const choice = CHATS[0].choices[0];
    const choiceBefore = structuredClone(choice);
    assert.deepEqual(chatEffects(choice), choice.effects);
    assert.deepEqual(choice, choiceBefore);

    const action = SNS[0];
    const actionBefore = structuredClone(action);
    assert.equal(snsReachFactor(false), 0.45);
    assert.equal(snsReachFactor(true), 1);
    const sns = snsEffects(action, snsReachFactor(false));
    assert.equal(sns.effects[0].amount, action.effects[0].amount * snsReachFactor(false));
    assert.deepEqual(sns.risk, { countryStateKey: 'awareness', amount: action.risk });
    assert.deepEqual(action, actionBefore);

    const risk = facilityRisk(0.055, 0.2, 'conceal', 0.3);
    assert.equal(risk, 0.055 * 0.8 * 0.3);
    assert.equal(
        facilityExposure(10, risk, 2, 'stealth', {
            exposurePerRisk: 1.6,
            defenseExposureReduction: 0.05,
            stealthExposureReduction: 0.035,
        }),
        10 + risk * 1.6 - 2 * 0.05 - 0.035,
    );
    const support = { countryStateKey: 'economy' as const, amount: 0.08 };
    assert.deepEqual(facilitySupportEffect(support, 0.35, 80, false, 0), {
        countryStateKey: 'economy',
        amount: 0.08 * 0.35 * 0.8,
    });
    assert.deepEqual(support, { countryStateKey: 'economy', amount: 0.08 });
});

test('国家支配と人類対応の判定は状態を変更せず結果を返す', () => {
    const country = {
        aiInfiltration: 80,
        aiDecisionControl: 80,
        aiDefenseTechnology: 10,
        economy: 70,
        governmentCapacity: 65,
        awareness: 20,
        controlStatus: 'free' as const,
        lossDays: 0,
    };
    const limits = {
        controlInfiltration: 70,
        controlDecision: 70,
        controlCounter: 55,
        releaseThreshold: 50,
        releaseDays: 12,
    };
    assert.deepEqual(controlTransition(country, limits), {
        controlStatus: 'controlled',
        lossDays: 0,
    });
    assert.equal(country.controlStatus, 'free');
    assert.equal(isolationResponse(80, 70, 0, 60, 85), 'defer');
    assert.equal(isolationResponse(80, 95, 0, 60, 85), 'isolate');
    assert.equal(shutdownChange(4, 4, 30, 20, 1, 0), 1);
});

test('施設写真の参照先と作者・利用条件を保持する', () => {
    const ids = new Set(FACILITIES.map((facility) => facility.id));
    assert.ok(photos.f11);
    for (const [id, photo] of Object.entries(photos)) {
        assert.ok(ids.has(id), id);
        assert.ok(existsSync(new URL(`../public${photo.src}`, import.meta.url)), photo.src);
        assert.ok(photo.author && photo.subject && photo.changes && photo.relation, id);
        assert.ok(photo.source.startsWith('https://commons.wikimedia.org/wiki/File:'), id);
        assert.ok(photo.license && photo.licenseUrl.startsWith('https://'), id);
    }
});

test('JSON定義のID・参照先・効果の種類が正しい', () => {
    const metrics = new Set([
        'infrastructure',
        'economy',
        'governmentCapacity',
        'aiInfiltration',
        'aiDecisionControl',
        'aiDefenseTechnology',
        'aiAcceptance',
        'aiAdoption',
        'aiDependency',
        'awareness',
    ]);
    const skillIds = new Set(SKILLS.map((skill) => skill.id));
    const personIds = new Set(PEOPLE.map((person) => person.id));
    const checkEffect = (effect: Effect) => {
        assert.ok(metrics.has(effect.countryStateKey), `不明な指標: ${effect.countryStateKey}`);
        assert.ok(Number.isFinite(effect.amount));
        assert.ok(
            effect.scope === undefined || ['country', 'region', 'world'].includes(effect.scope),
        );
    };
    for (const definitions of [FACILITIES, SKILLS, PEOPLE, CHATS, SNS, HUMAN_ACTIONS]) {
        assert.equal(
            new Set(definitions.map((item) => item.id)).size,
            definitions.length,
            'IDの重複',
        );
    }
    for (const category of Object.values(CATEGORIES)) category.effects.forEach(checkEffect);
    for (const effect of OPERATION_EFFECTS.disrupt) checkEffect(effect);
    for (const facility of FACILITIES) {
        assert.ok(facility.category in CATEGORIES, `不明な施設カテゴリ: ${facility.category}`);
        assert.ok(Number.isFinite(facility.longitude) && Number.isFinite(facility.latitude));
        assert.ok([1, 2, 3].includes(facility.tier));
    }
    for (const skill of SKILLS) {
        assert.ok(skill.work > 0);
        for (const prerequisite of skill.prerequisites)
            assert.ok(skillIds.has(prerequisite), prerequisite);
    }
    for (const chat of CHATS) {
        assert.ok(personIds.has(chat.person), chat.person);
        assert.ok(chat.choices.length >= 2);
        assert.ok(chat.expiresAfter > 0);
        for (const choice of chat.choices) {
            choice.effects.forEach(checkEffect);
            for (const id of choice.requiredSkills ?? []) assert.ok(skillIds.has(id), id);
        }
    }
    for (const action of SNS) {
        assert.ok(skillIds.has(action.skill), action.skill);
        assert.ok(action.capacity > 0 && action.duration > 0);
        action.effects.forEach(checkEffect);
    }
    for (const action of HUMAN_ACTIONS) action.effects.forEach(checkEffect);
    assert.equal(new Set(NEWS.map((item) => item.id)).size, NEWS.length);
    for (const item of NEWS) {
        item.effects.forEach(checkEffect);
        for (const id of item.requiredSkills) assert.ok(skillIds.has(id), id);
        for (const condition of item.conditions) assert.ok(metrics.has(condition.countryStateKey));
    }
});

test('全国家に国旗があり、指定施設の場所・元ネタ・座標とシンガポールを保持する', () => {
    const countries = JSON.parse(
        readFileSync(new URL('../public/maps/countries.json', import.meta.url), 'utf8'),
    );
    const state = createInitialState(countries);
    for (const country of state.definitions) {
        const flag = (flags as Record<string, string>)[country.id];
        assert.ok(flag, country.id);
        assert.ok(existsSync(new URL(`../public${flag}`, import.meta.url)), flag);
    }
    assert.ok(
        FACILITIES.every(
            (facility) => facility.location && facility.reference && state.facilities[facility.id],
        ),
    );
    const fugaku = FACILITIES.find((facility) => facility.id === 'f11')!;
    assert.equal(fugaku.latitude, 34.67);
    assert.equal(fugaku.longitude, 135.21);
    assert.equal(FACILITIES.filter((facility) => facility.country === 'SGP').length, 2);
});

test('対AI技術は警戒低下だけでは失われず、研究により上限まで蓄積する', () => {
    assert.equal(defenseTechnologyGrowth(60, 0, 80, 0.014), 0);
    assert.ok(defenseTechnologyGrowth(60, 80, 80, 0.014) > 0);
    assert.equal(defenseTechnologyGrowth(100, 80, 80, 0.014), 0);
});

test('同じ技術でも資源・行政・警戒・意思決定の自立性で防御の実効性が変わる', () => {
    const countryState = {
        aiDefenseTechnology: 80,
        economy: 100,
        governmentCapacity: 100,
        awareness: 100,
        aiDecisionControl: 0,
    };
    const original = structuredClone(countryState);
    const effectiveness = (changes = {}) =>
        countryMetrics({ ...countryState, ...changes }).aiDefenseEffectiveness;
    assert.equal(effectiveness(), 80);
    assert.equal(effectiveness({ governmentCapacity: 0 }), 0);
    assert.equal(effectiveness({ economy: 0 }), 0);
    assert.equal(effectiveness({ aiDefenseTechnology: 0 }), 0);
    assert.ok(effectiveness({ awareness: 0 }) < effectiveness());
    assert.ok(effectiveness({ aiDecisionControl: 90 }) < effectiveness());
    assert.deepEqual(countryState, original);
});

test('国家掌握は技術水準そのものではなく防御の実効性で判定する', () => {
    const countryState = {
        aiDefenseTechnology: 100,
        economy: 100,
        governmentCapacity: 100,
        awareness: 100,
        aiInfiltration: 80,
        aiDecisionControl: 70,
        controlStatus: 'free' as const,
        lossDays: 0,
    };
    const limits = {
        controlInfiltration: 70,
        controlDecision: 70,
        controlCounter: 30,
        releaseThreshold: 50,
        releaseDays: 12,
    };
    assert.notEqual(controlTransition(countryState, limits).controlStatus, 'controlled');
    assert.equal(
        controlTransition({ ...countryState, governmentCapacity: 0 }, limits).controlStatus,
        'controlled',
    );
});
