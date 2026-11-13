import { WORLD_NEWS } from '../../content/news.ts';
import { AREAS } from '../data.ts';
import { instituteArea } from '../secrecy/investigations.ts';
import { researchTopic } from '../secrecy/research.ts';
import { researchHasFindings, researchOutcomeSummary } from '../secrecy/researchTargets.ts';
import type { GameState } from '../types.ts';

/** 社会の記事と公表された研究を、同じ日付順で読む。閲覧はゲームに影響しない。 */
export function worldNews(game: GameState) {
    const articles = game.news.map((record) => {
        const article = WORLD_NEWS.find((item) => item.id === record.id)!;
        return {
            ...record,
            title: article.title,
            summary: article.summary,
            region: AREAS.find((area) => area.id === article.areaId)!.name,
        };
    });
    for (const project of game.investigations) {
        if (project.kind !== 'research' || !researchHasFindings(project)) continue;
        const topic = researchTopic(project);
        const regulation = topic.category === 'regulation';
        const region = AREAS[instituteArea(project)].name;
        const outcome = researchOutcomeSummary(project).replace(
            /(適用|支援|共有|後押し)$/,
            '$1する',
        );
        articles.push({
            id: `research:${project.id}`,
            month: project.publishedMonth!,
            title: regulation
                ? `${region}で「${topic.name}」が成立`
                : `${region}の研究機関が「${topic.name}」の成果を公表`,
            summary: `${region}で${regulation ? `「${topic.name}」が成立した。` : `研究機関が「${topic.name}」の成果を公表した。`}${outcome}。${regulation ? '施行は地域ごとに進む。' : '研究機関は、現場での活用に向けた検証と成果の共有を進めている。'}`,
            region,
        });
    }
    return articles.sort((a, b) => b.month - a.month || a.id.localeCompare(b.id));
}
