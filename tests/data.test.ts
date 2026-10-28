import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import photos from '../src/game/data/facility-photos.json' with { type: 'json' };
import flags from '../src/game/data/flags.json' with { type: 'json' };
import {
    CATEGORIES,
    CHATS,
    FACILITIES,
    HUMAN_ACTIONS,
    PEOPLE,
    SKILLS,
    SNS,
} from '../src/game/data.ts';
import { createInitialState } from '../src/game/engine.ts';
import { NEWS } from '../src/game/society.ts';
import type { Effect } from '../src/game/types.ts';

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
        'politicalControl',
        'aiInfiltration',
        'aiDecisionControl',
        'aiCountermeasure',
        'aiAcceptance',
        'aiAdoption',
        'aiDependency',
        'awareness',
    ]);
    const skillIds = new Set(SKILLS.map((skill) => skill.id));
    const personIds = new Set(PEOPLE.map((person) => person.id));
    const checkEffect = (effect: Effect) => {
        assert.ok(metrics.has(effect.metric), `不明な指標: ${effect.metric}`);
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
        for (const condition of item.conditions) assert.ok(metrics.has(condition.metric));
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
