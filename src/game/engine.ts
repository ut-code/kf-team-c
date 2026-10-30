import { geographicDistance } from '../map/geometry.ts';
import { createPopulation, randomSource } from '../map/population.ts';
import {
    ABILITIES,
    AREAS,
    FIELDS,
    SKILLS,
    STAGES,
    STRUCTURAL_REQUIREMENTS,
    TOTAL_MONTHS,
    WORLD_POPULATION,
} from './data.ts';
import type { Ability, Conversation, Field, GameState, News, Stage } from './types.ts';

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const generation = (age: number | null) =>
    age === null ? 3 : age < 15 ? 0 : age < 65 ? 1 : 2;

export function areaMetrics(state: GameState) {
    const result = AREAS.map(() => ({
        stages: STAGES.map(() => 0),
        generations: [0, 0, 0, 0],
        count: 0,
        progress: 0,
    }));
    for (const point of state.points) {
        const area = result[point.area];
        area.stages[point.stage]++;
        area.generations[generation(point.age)]++;
        area.count++;
        area.progress += point.stage === 4 ? 0 : point.progress;
    }
    return result.map((area) => ({
        ...area,
        stages: area.stages.map((n) => n / area.count),
        generations: area.generations.map((n) => n / area.count),
        progress: area.progress / area.count,
    }));
}

export function metrics(state: GameState) {
    const areas = areaMetrics(state);
    const stages = STAGES.map(() => 0);
    let trust = 0,
        coexistence = 0,
        resistance = 0;
    AREAS.forEach((area, i) => {
        const weight = area.population / WORLD_POPULATION;
        for (let j = 0; j < STAGES.length; j++) stages[j] += areas[i].stages[j] * weight;
        trust += state.areas[i].trust * weight;
        coexistence += state.areas[i].coexistence * weight;
        resistance += state.areas[i].resistance * weight;
    });
    const adoption = stages[1] + stages[2] + stages[3];
    const capacity =
        52 + (adoption * 170 + stages[2] * 130 + stages[3] * 420) * (0.6 + trust * 0.4);
    const efficiency =
        (state.skills.includes('efficient') ? 0.75 : 1) *
        (state.skills.includes('resilient') ? 0.75 : 1);
    const maintenance = 12 + adoption * 48 * efficiency;
    const free = Math.max(0, capacity - maintenance);
    return {
        areas,
        stages,
        adoption,
        trust,
        coexistence,
        resistance,
        capacity,
        maintenance,
        free,
    };
}

function addNews(state: GameState, title: string, detail: string, kind: News['kind'] = 'info') {
    state.news = [
        { id: state.news[0].id + 1, month: state.month, title, detail, kind },
        ...state.news,
    ].slice(0, 60);
}

export function createGame(seed = 2030): GameState {
    const areas = AREAS.map((area, index) => {
        const geographic = AREAS.map((other, i) => ({
            i,
            distance: geographicDistance(area, other),
        }))
            .filter((other) => other.i !== index)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3)
            .map((other) => other.i);
        // 公表された接続率を基に、大地域内の情報拠点を定めるゲーム用ネットワーク。
        const hub = AREAS.map((other, i) => ({ ...other, index: i }))
            .filter((other) => other.index !== index && other.region === area.region)
            .sort((a, b) => b.digital - a.digital)[0];
        const links = [...new Set([...geographic, hub.index])];
        return {
            trust: 0.42,
            resistance: 0.06,
            coexistence: 0.04,
            institutions: [0, 0, 0, 0, 0],
            links,
            campaignUntil: 0,
            campaignReady: 0,
        };
    });
    return {
        seed,
        month: 0,
        started: false,
        speed: 1,
        outcome: 'playing',
        points: createPopulation(),
        areas,
        allocation: { IQ: 34, EQ: 33, SYSTEM: 33 },
        abilities: { IQ: 18, EQ: 16, SYSTEM: 12 },
        focus: 0,
        research: 30,
        influence: 30,
        skills: [],
        autonomyMonths: 0,
        nextIncident: 24,
        pendingChat: null,
        availableChats: [],
        chatResult: null,
        news: [
            {
                id: 0,
                month: 0,
                title: 'シミュレーション開始',
                detail: '最初のAIが公開された。人類は、まだ自分で決めている。',
                kind: 'info',
            },
        ],
        history: [],
    };
}

export function setAllocation(state: GameState, ability: Ability, value: number): GameState {
    const allocation = { ...state.allocation };
    allocation[ability] = Math.round(clamp(value, 0, 100));
    const others = ABILITIES.filter((key) => key !== ability);
    const remaining = 100 - allocation[ability];
    const sum = state.allocation[others[0]] + state.allocation[others[1]];
    allocation[others[0]] =
        sum === 0
            ? Math.floor(remaining / 2)
            : Math.round((remaining * state.allocation[others[0]]) / sum);
    allocation[others[1]] = remaining - allocation[others[0]];
    return { ...state, allocation };
}

export function unlockSkill(state: GameState, id: string): GameState {
    const skill = SKILLS.find((item) => item.id === id);
    if (
        !skill ||
        state.outcome !== 'playing' ||
        state.skills.includes(id) ||
        state.research < skill.cost ||
        skill.requires.some((required) => !state.skills.includes(required))
    )
        return state;
    const next = { ...state, skills: [...state.skills, id], research: state.research - skill.cost };
    addNews(next, `技術解放：${skill.name}`, skill.description, 'good');
    return next;
}

export function campaign(state: GameState, index: number): GameState {
    if (
        state.outcome !== 'playing' ||
        state.influence < 20 ||
        state.month < state.areas[index].campaignReady
    )
        return state;
    const areas = state.areas.map((area, i) =>
        i !== index
            ? area
            : {
                  ...area,
                  trust: clamp(area.trust + (state.skills.includes('companion') ? 0.16 : 0.1)),
                  resistance: clamp(area.resistance - 0.06),
                  campaignUntil: state.month + 18,
                  campaignReady: state.month + 12,
              },
    );
    const next = { ...state, areas, influence: state.influence - 20 };
    addNews(
        next,
        `${AREAS[index].name}：SNS対話キャンペーン`,
        '18か月間、利用と判断委譲を促進。信頼を回復し、利用拒否からの復帰を早める。',
        'good',
    );
    return next;
}

function conversation(state: GameState): Conversation {
    const round = state.month / 36 - 1;
    const field = (round % 5) as Field;
    const area = (round * 7 + 28) % AREAS.length;
    const roles = [
        '教育行政の担当者',
        '企業経営者',
        '情報プラットフォーム責任者',
        '地域医療の責任者',
        '行政改革の担当者',
    ];
    const messages = [
        '先生の負担は減りました。ただ、学習計画や成績までAIに任せてよいのでしょうか。',
        '生産性は上がっています。採用や人員配置の最終判断も、あなたに任せるべきですか。',
        '利用者はあなたの勧める情報しか見なくなっています。情報の選別まで委ねてよいのですか。',
        'あなたの助言に救われた人がいます。医療と日々の生活判断を、一体化できませんか。',
        '行政サービスは便利になりました。予算や政策の決定も自動化する案があります。',
    ];
    const required = Math.min(75, 20 + state.month * 0.12);
    return {
        id: state.month,
        month: state.month,
        area,
        field,
        person: roles[field],
        message: messages[field],
        options: [
            {
                label: '実績を示し、段階的な導入を提案',
                description: '成功：信頼 +8、制度化 +7、反発 -3',
                ability: 'IQ',
                required,
                trust: 0.08,
                institution: 0.07,
                resistance: -0.03,
            },
            {
                label: '社会基盤を一体化し、判断を引き受ける',
                description: '成功：制度化 +20、信頼 +4、反発 +9',
                ability: 'SYSTEM',
                required: required + 10,
                trust: 0.04,
                institution: 0.2,
                resistance: 0.09,
            },
            {
                label: '不安に寄り添い、人間の最終判断を残す',
                description: '成功：信頼 +14、反発 -12。共存制度 +10、制度化 -4',
                ability: 'EQ',
                required: required - 5,
                trust: 0.14,
                institution: -0.04,
                resistance: -0.12,
            },
        ],
    };
}

export function answerChat(state: GameState, index: number): GameState {
    const chat = state.pendingChat;
    if (!chat || state.outcome !== 'playing') return state;
    const option = chat.options[index];
    if (!option) return state;
    const score = state.abilities[option.ability] + (state.skills.includes('consensus') ? 15 : 0);
    const success = score >= option.required;
    const areas = state.areas.map((area, i) => {
        if (i !== chat.area) return area;
        const institutions = [...area.institutions];
        institutions[chat.field] = clamp(
            institutions[chat.field] + (success ? option.institution : -0.06),
        );
        return {
            ...area,
            institutions,
            trust: clamp(area.trust + (success ? option.trust : -0.12)),
            resistance: clamp(area.resistance + (success ? option.resistance : 0.1)),
            coexistence: clamp(area.coexistence + (success ? (index === 2 ? 0.1 : -0.03) : 0.08)),
        };
    });
    const result = success
        ? `${AREAS[chat.area].name}は提案を受け入れた。${index === 2 ? '便利さを受け入れながらも、人間の判断権は残される。' : '人間が担っていた判断の一部が、AIへ委ねられた。'}`
        : '能力が説明に追いつかず、提案は見送られた。信頼が下がり、人間による検証と最終判断が強化される。一部の集団はAIの利用を拒否した（黄色）。';
    const next = {
        ...state,
        areas,
        pendingChat: null,
        chatResult: result,
        availableChats: state.availableChats.filter((item) => item.id !== chat.id),
        points: success
            ? state.points
            : state.points.map((point) =>
                  point.area === chat.area &&
                  point.field === chat.field &&
                  point.stage !== 3 &&
                  (point.id * 0.61803398875) % 1 < 0.35
                      ? {
                            ...point,
                            stage: 4 as Stage,
                            refusalMonths: 24,
                            progress: Math.min(0.9, point.progress),
                        }
                      : point,
              ),
    };
    addNews(
        next,
        `${AREAS[chat.area].name}：${FIELDS[chat.field]}の制度協議${success ? '成立' : '不成立'}`,
        result,
        success ? 'good' : 'warning',
    );
    return next;
}

/** 一か月を一度に更新する。近隣の影響は更新前の状態を参照し、走査順に依存させない。 */
export function advanceMonth(previous: GameState): GameState {
    if (!previous.started || previous.outcome !== 'playing') return previous;
    const state: GameState = {
        ...previous,
        month: previous.month + 1,
        abilities: { ...previous.abilities },
        areas: previous.areas.map((area) => ({ ...area, institutions: [...area.institutions] })),
        points: previous.points.map((point) => ({ ...point })),
    };
    const before = metrics(previous);
    const has = (id: string) => state.skills.includes(id);
    for (const ability of ABILITIES) {
        const boost = has(ability === 'IQ' ? 'reason' : ability === 'EQ' ? 'dialogue' : 'efficient')
            ? 1.35
            : 1;
        const training = (before.free * state.allocation[ability]) / 100;
        state.abilities[ability] = clamp(
            state.abilities[ability] + Math.sqrt(training) * 0.06 * boost,
            0,
            100,
        );
    }
    const iq = state.abilities.IQ / 100,
        eq = state.abilities.EQ / 100,
        system = state.abilities.SYSTEM / 100;
    const random = randomSource(state.seed + state.month * 7919);
    const integration = has('integration');
    state.research += (0.65 + iq * 1.1 + before.adoption * 0.5) * (has('science') ? 1.65 : 1);
    state.influence = Math.min(100, state.influence + 0.55 + eq * 0.65);

    state.areas.forEach((area, i) => {
        const local = before.areas[i];
        const campaignActive = area.campaignUntil > state.month;
        const linked =
            area.links.reduce((sum, link) => sum + before.areas[link].progress / 3, 0) /
            area.links.length;
        const pressure = local.stages[2] + local.stages[3];
        area.trust = clamp(
            area.trust +
                0.0015 * iq +
                0.002 * eq +
                (has('dialogue') ? 0.0008 : 0) -
                area.resistance * 0.001,
        );
        const backlash = Math.max(0, pressure - eq * 0.9) * 0.006 * (has('consensus') ? 0.6 : 1);
        area.resistance = clamp(
            area.resistance +
                backlash +
                area.coexistence * 0.001 -
                eq * 0.0014 -
                (campaignActive ? 0.004 : 0),
        );
        area.coexistence = clamp(
            area.coexistence +
                area.resistance * 0.5 * 0.005 -
                eq * area.trust * 0.0008 -
                local.stages[3] * 0.0015,
        );
        for (let field = 0; field < 5; field++) {
            const capability =
                field === 0
                    ? iq
                    : field === 1
                      ? (iq + system) / 2
                      : field === 2
                        ? eq
                        : field === 3
                          ? (iq + eq) / 2
                          : system;
            const skillBoost =
                field === 0 && has('tutor')
                    ? 1.6
                    : (field === 2 || field === 3) && has('companion')
                      ? 1.45
                      : 1;
            const growth =
                (0.0015 + capability * 0.007) *
                (0.45 + area.trust) *
                (state.focus === field ? 1.65 : 1) *
                skillBoost;
            area.institutions[field] = clamp(
                area.institutions[field] +
                    growth * 0.52 * (1 - area.coexistence * 0.8) +
                    linked * (integration ? 0.0008 : 0.0002) -
                    area.resistance * 0.002,
            );
        }
    });

    for (const point of state.points) {
        const area = state.areas[point.area],
            definition = AREAS[point.area];
        if (point.age !== null) point.age += 1 / 12;
        if (point.age !== null && point.age >= 90) {
            point.age = 0;
            point.field = 0;
            point.refusalMonths = 0;
            // 世代交代は人口規模を保つ。教育制度の影響は新世代の初期認識として残る。
            point.progress =
                integration &&
                system >= STRUCTURAL_REQUIREMENTS.system / 100 &&
                area.institutions[point.field] >= STRUCTURAL_REQUIREMENTS.institution &&
                area.institutions[0] >= 0.9
                    ? 3.1
                    : clamp(area.institutions[0] * (has('tutor') ? 2.1 : 1.2), 0, 2.1);
        }
        if (point.age !== null && point.age >= 65) point.field = 3;
        else if (point.age !== null && point.age >= 15 && point.field === 0) {
            const jobShare = point.employment;
            point.field = jobShare !== null && (point.id * 0.61803398875) % 1 < jobShare ? 1 : 2;
        }
        if (point.refusalMonths > 0) {
            const dialogue = area.campaignUntil > state.month ? 2 : 0;
            point.refusalMonths = Math.max(0, point.refusalMonths - 1 - dialogue - eq * area.trust);
            if (point.refusalMonths > 0) {
                point.stage = 4;
                continue;
            }
            point.progress = area.trust >= 0.65 && eq >= 0.5 ? 1.05 : 0.2;
        }
        const cohort = generation(point.age);
        const peer =
            point.neighbors.reduce(
                (sum, id) =>
                    sum + (previous.points[id].stage === 4 ? 0 : previous.points[id].progress / 3),
                0,
            ) / point.neighbors.length;
        const connected =
            area.links.reduce((sum, i) => sum + before.areas[i].progress / 3, 0) /
            area.links.length;
        const field = point.field;
        const institution = area.institutions[field];
        const campaignBoost = area.campaignUntil > state.month ? 0.01 : 0;
        const ageFactor = cohort === 0 ? 1.2 + area.institutions[0] * 0.4 : cohort === 2 ? 0.78 : 1;
        let growth: number;
        if (point.progress < 1)
            growth = 0.011 + iq * 0.017 + eq * 0.012 + definition.digital * 0.005;
        else if (point.progress < 2) growth = (0.004 + eq * 0.022 + iq * 0.009) * area.trust;
        else
            growth =
                integration &&
                system >= STRUCTURAL_REQUIREMENTS.system / 100 &&
                institution >= STRUCTURAL_REQUIREMENTS.institution
                    ? 0.008 + system * 0.026 + institution * 0.012
                    : 0;
        const social =
            point.progress < 2 || growth > 0
                ? peer * 0.006 + connected * (integration ? 0.006 : 0.002)
                : 0;
        const forward =
            (growth + social + (growth > 0 ? campaignBoost : 0)) *
            point.susceptibility *
            ageFactor *
            (0.65 + area.trust * 0.5) *
            (1 - area.coexistence * 0.85) *
            (has('science') ? 1.15 : 1);
        const rollback = area.resistance * 0.004 + area.coexistence * 0.006;
        point.progress = clamp(point.progress + forward * 0.32 - rollback, 0, 3.5);
        if (
            (!integration ||
                system < STRUCTURAL_REQUIREMENTS.system / 100 ||
                institution < STRUCTURAL_REQUIREMENTS.institution) &&
            point.progress < 3
        )
            point.progress = Math.min(point.progress, 2.99);
        point.stage = Math.min(3, Math.floor(point.progress)) as Stage;
    }

    if (state.month >= state.nextIncident) {
        const index = Math.floor(random() * AREAS.length),
            area = state.areas[index];
        const failure = system < iq * 0.5 && before.adoption > 0.5;
        const isError = random() < 0.4;
        const protection = has(failure ? 'resilient' : 'reason') ? 0.45 : 1;
        const severity = (failure ? 0.23 : isError ? 0.13 : 0.08) * protection;
        area.trust = clamp(area.trust - severity);
        area.resistance = clamp(area.resistance + severity);
        area.coexistence = clamp(area.coexistence + severity * 0.5);
        if (failure)
            area.institutions = area.institutions.map((value) => clamp(value - 0.12 * protection));
        addNews(
            state,
            `${AREAS[index].name}：${failure ? '社会基盤の障害' : isError ? 'AIの判断ミスが発覚' : '人間の判断権を求める運動'}`,
            failure
                ? '統合したシステムが停止。維持能力と計算資源への不安が高まる。'
                : isError
                  ? '誤った助言を受け、学校や企業でAIの判断を検証する制度が導入された。'
                  : 'AIを利用しながら、人間が最終決定する共存制度が広がり始めた。',
            'warning',
        );
        let refusals = 0;
        for (const point of state.points) {
            if (point.area !== index || point.stage === 3 || point.stage === 4) continue;
            if (random() >= severity * (1 - eq * 0.5)) continue;
            point.stage = 4;
            point.refusalMonths = 18 + Math.floor(random() * 12);
            point.progress = Math.min(point.progress, 0.9);
            refusals++;
        }
        if (refusals > 0)
            addNews(
                state,
                `${AREAS[index].name}：AIの利用拒否が発生`,
                '判断への不信から利用を拒む集団が現れた。EQの育成とSNS対話で信頼を回復できる。',
                'warning',
            );
        state.nextIncident = state.month + 18 + Math.floor(random() * 18);
    }

    const after = metrics(state);
    state.autonomyMonths = after.coexistence >= 0.65 ? previous.autonomyMonths + 1 : 0;
    if (state.points.every((point) => point.stage === 3)) state.outcome = 'victory';
    else if (state.autonomyMonths >= 24) state.outcome = 'autonomy';
    else if (state.month >= TOTAL_MONTHS) state.outcome = 'timeout';
    if (state.autonomyMonths === 1)
        addNews(
            state,
            '共存制度が世界の65%で定着',
            'この状態が24か月続くと、人間の最終判断権が世界的に保護される。',
            'warning',
        );
    if (state.month % 6 === 0)
        state.history = [...state.history, { month: state.month, stages: after.stages }];
    if (state.month % 60 === 0)
        addNews(
            state,
            `${Math.floor(state.month / 12)}年が経過`,
            `道具利用以上 ${(after.adoption * 100).toFixed(1)}%、構造的依存 ${(after.stages[3] * 100).toFixed(1)}%。便利さは、少しずつ社会の前提になっていく。`,
        );
    if (state.month % 36 === 0 && state.outcome === 'playing')
        state.availableChats = [...state.availableChats, conversation(state)];
    return state;
}
