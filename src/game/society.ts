import news from './data/events/news.json' with { type: 'json' };
import settings from './data/simulation/society.json' with { type: 'json' };
import type {
    ChatDefinition,
    Condition,
    CountryAttributes,
    CountryState,
    Effect,
} from './types.ts';

export const SOCIETY = settings;
export type NewsDefinition = {
    id: string;
    title: string;
    message: string;
    requiredSkills: string[];
    conditions: Condition[];
    effects: Effect[];
};
export const NEWS = news as NewsDefinition[];

export function choiceAvailable(
    researched: readonly string[],
    choice: { requiredSkills?: string[] },
): boolean {
    return !choice.requiredSkills || choice.requiredSkills.every((id) => researched.includes(id));
}

export function selectNews(input: {
    definitions: readonly CountryAttributes[];
    countries: Readonly<Record<string, CountryState>>;
    researched: readonly string[];
    seenNews: readonly string[];
}): { item: NewsDefinition; country: CountryAttributes } | null {
    const countries = [...input.definitions].sort((a, b) => a.id.localeCompare(b.id));
    for (const item of NEWS) {
        if (!item.requiredSkills.every((id) => input.researched.includes(id))) continue;
        const countryAttributes = countries.find(
            (candidate) =>
                !input.seenNews.includes(`${item.id}:${candidate.id}`) &&
                item.conditions.every(
                    (condition) =>
                        input.countries[candidate.id][condition.countryStateKey] >= condition.min,
                ),
        );
        if (countryAttributes) return { item, country: countryAttributes };
    }
    return null;
}

export function selectChat(input: {
    chats: readonly ChatDefinition[];
    accessibleCountries: readonly string[];
    countries: Readonly<Record<string, CountryState>>;
    researched: readonly string[];
    seenChats: readonly string[];
}): ChatDefinition | null {
    return (
        input.chats.find(
            (chat) =>
                !input.seenChats.includes(chat.id) &&
                input.countries[chat.country] &&
                input.accessibleCountries.includes(chat.country) &&
                input.countries[chat.country].aiDecisionControl >= chat.minDecisionControl &&
                input.countries[chat.country].awareness >= chat.minAwareness &&
                (!chat.skill || input.researched.includes(chat.skill)),
        ) ?? null
    );
}
