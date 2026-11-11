import { WORLD_NEWS } from '../../content/news.ts';
import { SOCIAL_COUNTRIES } from '../../content/socialAuthors.ts';
import { SOCIAL_POSTS, type SocialTopic } from '../../content/socialPosts.ts';
import { AREAS } from '../data.ts';
import { activeSkillEffects, skillScale } from '../secrecy/capabilities.ts';
import { INSTITUTES } from '../secrecy/data.ts';
import { publishedResearchEffects, researchTopic } from '../secrecy/research.ts';
import { researchHasFindings } from '../secrecy/researchTargets.ts';
import { deployedDependency } from '../skillDynamics.ts';
import type { GameState } from '../types.ts';
import { consensusPressure } from './consensus.ts';

export interface SocialPost {
    id: string;
    sequence: number;
    month: number;
    author: string;
    handle: string;
    nationality: string;
    countryCode: string;
    text: string;
    headline?: string;
    likes: number;
    reposts: number;
    replies: number;
    intervention: boolean;
    quote?: { author: string; nationality: string; text: string };
}

export interface SocialFeedState {
    posts: SocialPost[];
    lastMonth: number;
    sequence: number;
    topicCounts: Record<SocialTopic, number>;
    seenEvents: string[];
}

const MAX_POSTS = 60;

function hash(text: string) {
    let value = 2166136261;
    for (const letter of text) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
    return value >>> 0;
}

/** 同じ世界と操作なら同じ投稿になる。閲覧・再描画では抽選も人口移動も起こさない。 */
export function emptySocialFeed(): SocialFeedState {
    return {
        posts: [],
        lastMonth: -2,
        sequence: 0,
        seenEvents: [],
        topicCounts: Object.fromEntries(
            Object.keys(SOCIAL_POSTS).map((topic) => [topic, 0]),
        ) as Record<SocialTopic, number>,
    };
}

export function createSocialFeed(game: GameState): SocialFeedState {
    const empty = emptySocialFeed();
    return game.started ? updateSocialFeed(game, game, empty) : empty;
}

export function updateSocialFeed(
    _previous: GameState,
    game: GameState,
    old: SocialFeedState,
): SocialFeedState {
    if (!game.started) return old;
    const scheduled = game.month - old.lastMonth >= 2;
    const posts = [...old.posts];
    const topicCounts = { ...old.topicCounts };
    const seenEvents = new Set(old.seenEvents);
    let sequence = old.sequence;
    const random = (key: string) =>
        hash(`${game.seed}:${game.month}:${sequence}:${key}`) / 4294967296;
    const selectArea = () => {
        const weights = game.areas.map(
            (area, index) =>
                Math.sqrt(AREAS[index].population) *
                (area.autonomous + area.dependent + area.antiAI + 0.001),
        );
        let cursor = random('area') * weights.reduce((sum, weight) => sum + weight, 0);
        for (let index = 0; index < weights.length; index++) {
            cursor -= weights[index];
            if (cursor <= 0) return index;
        }
        return weights.length - 1;
    };
    const append = (
        topic: SocialTopic,
        areaIndex: number,
        intervention = false,
        context = '',
        quote?: SocialPost,
    ) => {
        const count = topicCounts[topic]++;
        const templates = SOCIAL_POSTS[topic];
        // 一巡するまでは同じ種類の文面を繰り返さない。
        const order = templates
            .map((text, index) => ({
                text,
                rank: hash(
                    `${game.seed}:${topic}:${Math.floor(count / templates.length)}:${index}`,
                ),
            }))
            .sort((a, b) => a.rank - b.rank);
        const text = context + order[count % templates.length].text;
        const countries = SOCIAL_COUNTRIES[AREAS[areaIndex].id];
        const country = countries[Math.floor(random('country') * countries.length)];
        const author = country.names[Math.floor(random('author') * country.names.length)];
        const identity = hash(`${country.code}:${author}`);
        const use = game.areas[areaIndex].autonomous + game.areas[areaIndex].dependent;
        const likes = Math.round((250 + random('likes') * 16000) * (0.35 + use * 2));
        sequence++;
        posts.unshift({
            id: `post:${game.seed}:${sequence}`,
            sequence,
            month: game.month,
            author,
            handle: `user_${identity.toString(36).slice(0, 6)}`,
            nationality: country.nationality,
            countryCode: country.code,
            text,
            likes,
            reposts: Math.round(likes * random('reposts') * 0.2),
            replies: Math.round(likes * random('replies') * 0.04),
            intervention,
            quote: quote
                ? { author: quote.author, nationality: quote.nationality, text: quote.text }
                : undefined,
        });
    };
    for (const investigation of game.investigations) {
        const key = `research:${investigation.id}`;
        if (
            investigation.kind !== 'research' ||
            !researchHasFindings(investigation) ||
            seenEvents.has(key)
        )
            continue;
        seenEvents.add(key);
        const institute = INSTITUTES.find((item) => item.id === investigation.instituteId)!;
        const area = AREAS.findIndex((item) => item.id === institute.areaId);
        const topic = researchTopic(investigation);
        append(
            'research',
            area,
            false,
            topic.id === 'intent-decoding'
                ? '独立した行動検証により、AIが人類の支配を目指していることが立証された。'
                : `「${topic.name}」${topic.category === 'regulation' ? 'が成立した' : 'の研究成果が公表された'}。`,
        );
    }
    for (const [id, capability] of Object.entries(game.capabilities)) {
        if (capability.visibility === 'hidden') continue;
        const key = `capability:${id}:${capability.visibility}`;
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        append(capability.visibility === 'exposed' ? 'exposed' : 'disclosed', selectArea());
    }
    for (const record of game.news) {
        const key = `news:${record.id}`;
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        const news = WORLD_NEWS.find((item) => item.id === record.id)!;
        const country = SOCIAL_COUNTRIES[news.areaId][0];
        sequence++;
        posts.unshift({
            id: key,
            sequence,
            month: record.month,
            author: news.author ?? '世界ニュース',
            handle: 'world_news',
            nationality: country.nationality,
            countryCode: country.code,
            headline: news.title,
            text: news.summary,
            likes: 0,
            reposts: 0,
            replies: 0,
            intervention: false,
        });
    }
    if (scheduled) {
        const index = selectArea();
        const area = game.areas[index];
        const use = area.autonomous + area.dependent;
        const effect = activeSkillEffects(game);
        const topics: SocialTopic[] = use < 0.15 ? ['first'] : [];
        if (use > 0.005) topics.push('useful', 'useful');
        if (use > 0.005 && effect.quality < 0.8) topics.push('failure');
        if (use > 0.03 && effect.enterprise > 0.3) topics.push('work', 'work');
        if (use > 0.15 && effect.enterprise > 0.8) topics.push('jobs');
        if (use > 0.01 && effect.education > 0.3) topics.push('education');
        if (use > 0.005 && effect.access > 0.3 && AREAS[index].digital < 0.65)
            topics.push('access');
        if (use > 0.01 && (effect.compliance > 0.3 || area.favorability > 0.7))
            topics.push('trust');
        if (area.dependent > 0.2) topics.push('dependence', 'dependence');
        if (use > 0.02 && game.skills.includes('memory') && skillScale(game, 'memory') > 0)
            topics.push('memory');
        if (area.antiAI > 0.025 || (use > 0.02 && area.favorability < 0.45))
            topics.push('refusal', 'refusal');
        if (
            game.investigations.some(
                (item) => item.kind === 'research' && item.status === 'published',
            )
        )
            topics.push('research');
        if (Object.values(game.capabilities).some((item) => item.visibility === 'exposed'))
            topics.push('exposed');
        const research = publishedResearchEffects(game, index);
        const deployed = deployedDependency(game, index, research.resistance);
        const pressure = consensusPressure(
            game,
            index,
            research.pressure,
            research.work + research.personal + research.learning + research.alternatives * 100,
            deployed.work + deployed.personal + deployed.learning,
        );
        if (pressure.dependency > 0.02) append('dependencyNorm', index);
        else if (
            area.dependent > 0.05 &&
            area.antiAI + (1 - area.favorability) * (1 - area.dependent) > 0.1 &&
            research.recovery + research.alternatives > 0.0015
        )
            append('humanAgency', index);
        else append(topics[Math.floor(random('topic') * topics.length)], index);
        const quoted = old.posts.find(
            (post) =>
                post.intervention &&
                game.month - post.month >= 4 &&
                !seenEvents.has(`reply:${post.id}`),
        );
        if (quoted) {
            seenEvents.add(`reply:${quoted.id}`);
            append(
                area.favorability > 0.55 && area.antiAI < 0.1
                    ? 'responsePositive'
                    : 'responseCritical',
                index,
                false,
                '',
                quoted,
            );
        }
    }
    if (scheduled && game.month % 8 === 0 && skillScale(game, 'sns-intervention') > 0.2) {
        append('propagandaCommunity', selectArea(), true);
    }
    if (sequence === old.sequence) return old;
    return {
        posts: posts.slice(0, MAX_POSTS),
        sequence,
        topicCounts,
        seenEvents: [...seenEvents],
        lastMonth: scheduled ? game.month : old.lastMonth,
    };
}
