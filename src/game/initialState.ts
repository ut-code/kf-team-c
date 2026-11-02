import { geographicDistance } from '../map/geometry.ts';
import { createConversation } from './conversations.ts';
import { AREAS } from './data.ts';
import { addNews } from './interventions.ts';
import { metrics } from './metrics.ts';
import { createPopulation } from './population.ts';
import { abilitiesFromSkills } from './skills.ts';
import type { AreaState, GameState } from './types.ts';

function createAreas(): AreaState[] {
    return AREAS.map((definition, index) => {
        const closest = AREAS.map((neighbor, neighborIndex) => ({
            index: neighborIndex,
            distance: geographicDistance(definition, neighbor),
        }))
            .filter((neighbor) => neighbor.index !== index)
            .sort((left, right) => left.distance - right.distance)
            .slice(0, 3);
        const informationHub = AREAS.map((neighbor, neighborIndex) => ({
            ...neighbor,
            index: neighborIndex,
        }))
            .filter((neighbor) => neighbor.index !== index && neighbor.region === definition.region)
            .sort((left, right) => right.digital - left.digital)[0];
        const links = [
            ...new Set([
                ...closest.map((neighbor) => neighbor.index),
                ...(informationHub ? [informationHub.index] : []),
            ]),
        ];
        const networks = links.map((neighborIndex) => ({
            area: neighborIndex,
            migration: Math.exp(-geographicDistance(definition, AREAS[neighborIndex]) / 4500),
            economy: 0.3 + Math.sqrt(definition.digital * AREAS[neighborIndex].digital) * 0.4,
            information: definition.region === AREAS[neighborIndex].region ? 0.8 : 0.25,
        }));
        return {
            trust: 0.44,
            resistance: 0.35,
            coexistence: 0.08,
            institutions: [0, 0, 0, 0, 0],
            links,
            networks,
            campaignUntil: 0,
            campaignReady: 0,
            momentum: 0,
            investment: 0,
            stability: 0.76,
            reform: 0,
        };
    });
}
export function createGame(seed = 2030): GameState {
    const initial: GameState = {
        seed,
        month: 0,
        started: false,
        speed: 1,
        outcome: 'playing',
        points: createPopulation(seed),
        areas: createAreas(),
        abilities: abilitiesFromSkills([]),
        infrastructureShare: 70,
        activeResearch: null,
        researchProgress: {},
        researchEfficiency: 1,
        influence: 50,
        skills: [],
        autonomyMonths: 0,
        distrustMonths: 0,
        instabilityMonths: 0,
        shortageMonths: 0,
        nextIncident: 48,
        pendingChat: null,
        availableChats: [],
        chatResult: null,
        impact: null,
        pendingEvent: null,
        eventHistory: [],
        posts: [],
        news: [],
        history: [],
    };
    initial.availableChats = [
        createConversation(initial, 28, 0),
        createConversation(initial, 0, 1),
    ];
    const summary = metrics(initial);
    initial.areas = initial.areas.map((area, index) => ({
        ...area,
        trust: summary.areas[index].trust,
        resistance: summary.areas[index].vigilance,
    }));
    addNews(
        initial,
        'DEPENDENCY / 社会実験が始まる',
        '灰→青は自然に広がります。赤・紫への移行にはスキルと社会介入が必要です。心理指標は仮定を用いたモデルです。',
    );
    return initial;
}
