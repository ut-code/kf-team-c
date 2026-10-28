import news from './data/news.json' with { type: 'json' };
import settings from './data/society.json' with { type: 'json' };
import { publishEvent } from './events.ts';
import type { CountryState, Effect, GameState, Metric } from './types.ts';

export const SOCIETY = settings;
export const NEWS = news as {
    id: string;
    title: string;
    message: string;
    requiredSkills: string[];
    conditions: { metric: Metric; min: number }[];
    effects: Effect[];
}[];

export function choiceAvailable(state: GameState, choice: { requiredSkills?: string[] }) {
    return (
        !choice.requiredSkills || choice.requiredSkills.every((id) => state.researched.includes(id))
    );
}

/** 有用なサービスの実績が導入へ、業務の組み替えが依存へつながる。 */
export function societyChanges(state: GameState, country: CountryState, supply: number) {
    const quality =
        1 +
        (state.researched.includes('science') ? 0.5 : 0) +
        (state.researched.includes('languages') ? 0.2 : 0);
    const benefit = (Math.sqrt(supply) * quality * country.infrastructure) / 100;
    const adoption =
        benefit *
            settings.adoptionSpeed *
            (0.4 + country.aiAcceptance / 100) *
            (1 - country.aiAdoption / 100) -
        country.aiAdoption * settings.adoptionDecay;
    const dependency =
        state.researched.includes('institutions') && supply > 0 && country.aiAdoption >= 25
            ? Math.max(0, country.aiAdoption - country.aiDependency) *
              settings.dependencySpeed *
              Math.sqrt(supply)
            : -country.aiDependency * settings.dependencyDecay;
    return {
        adoption,
        dependency,
        benefit,
        outage: country.serviceSupply > 0 && supply === 0 ? country.aiDependency : 0,
    };
}

export function updateNews(state: GameState) {
    state.newsCooldown = Math.max(0, state.newsCooldown - 1);
    if (state.newsCooldown > 0) return;
    const countries = [...state.definitions].sort((a, b) => a.id.localeCompare(b.id));
    for (const item of NEWS) {
        if (!item.requiredSkills.every((id) => state.researched.includes(id))) continue;
        const definition = countries.find(
            (country) =>
                !state.seenNews.includes(`${item.id}:${country.id}`) &&
                item.conditions.every(
                    (condition) => state.countries[country.id][condition.metric] >= condition.min,
                ),
        );
        if (!definition) continue;
        const country = state.countries[definition.id];
        for (const effect of item.effects)
            country[effect.metric] = Math.min(
                100,
                Math.max(0, country[effect.metric] + effect.amount),
            );
        state.seenNews.push(`${item.id}:${definition.id}`);
        state.newsCooldown = settings.newsInterval;
        state.logs.push({
            tick: state.tick,
            source: item.title,
            country: definition.id,
            metric: 'news',
            delta: 0,
            message: item.message,
        });
        publishEvent(
            state,
            'news',
            `${definition.name}：${item.title}`,
            item.message,
            definition.id,
        );
        return;
    }
}
