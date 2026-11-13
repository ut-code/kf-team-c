import { WORLD_NEWS } from '../../content/news.ts';
import { AREAS } from '../data.ts';
import { skillScale } from '../secrecy/capabilities.ts';
import type { GameState } from '../types.ts';

export interface NewsDefinition {
    id: string;
    title: string;
    summary: string;
    areaId: string;
    author?: string;
    skills: string[];
    avoid?: string[];
    minDependency?: number;
    minAdoption?: number;
    after?: string;
}
export interface NewsRecord {
    id: string;
    month: number;
}

/** ニュースは世界の記録。読む・放置する操作は人口、研究、SPを変えない。 */
export function advanceNews(game: GameState): GameState {
    const last = game.news.at(-1);
    if (last && game.month - last.month < 12) return game;
    const candidate = WORLD_NEWS.find((news) => {
        if (game.news.some((record) => record.id === news.id)) return false;
        if (news.skills.length && !news.skills.some((id) => skillScale(game, id) >= 0.8))
            return false;
        if (news.avoid?.some((id) => skillScale(game, id) >= 0.8)) return false;
        const area = game.areas[AREAS.findIndex((item) => item.id === news.areaId)];
        if (
            area.autonomous + area.dependent < (news.minAdoption ?? 0.03) ||
            area.dependent < (news.minDependency ?? 0)
        )
            return false;
        if (news.after) {
            const preceding = game.news.find((record) => record.id === news.after);
            if (!preceding || game.month - preceding.month < 18) return false;
        }
        return true;
    });
    return candidate
        ? { ...game, news: [...game.news, { id: candidate.id, month: game.month }] }
        : game;
}
