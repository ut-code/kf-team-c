import news from './data/events/news.json' with { type: 'json' };
import settings from './data/simulation/society.json' with { type: 'json' };
import type {
    ChatDefinition,
    Condition,
    CountryDefinition,
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
    definitions: readonly CountryDefinition[];
    countries: Readonly<Record<string, CountryState>>;
    researched: readonly string[];
    seenNews: readonly string[];
}): { item: NewsDefinition; country: CountryDefinition } | null {
    const countries = [...input.definitions].sort((a, b) => a.id.localeCompare(b.id));
    for (const item of NEWS) {
        if (!item.requiredSkills.every((id) => input.researched.includes(id))) continue;
        const country = countries.find(
            (candidate) =>
                !input.seenNews.includes(`${item.id}:${candidate.id}`) &&
                item.conditions.every(
                    (condition) =>
                        input.countries[candidate.id][condition.metric] >= condition.min,
                ),
        );
        if (country) return { item, country };
    }
    return null;
}

export function selectChat(input: {
    chats: readonly ChatDefinition[];
    countries: Readonly<Record<string, CountryState>>;
    researched: readonly string[];
    seenChats: readonly string[];
}): ChatDefinition | null {
    return (
        input.chats.find(
            (chat) =>
                !input.seenChats.includes(chat.id) &&
                input.countries[chat.country] &&
                input.countries[chat.country].aiInfiltration >= chat.minInfiltration &&
                input.countries[chat.country].awareness >= chat.minAwareness &&
                (!chat.skill || input.researched.includes(chat.skill)),
        ) ?? null
    );
}
