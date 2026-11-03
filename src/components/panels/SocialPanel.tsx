import { useState } from 'react';
import { AREAS } from '../../game/data';
import { languageFor, POLICIES } from '../../game/interventions';
import { metrics } from '../../game/metrics';
import type { GameState, Policy } from '../../game/types';
import { percent } from '../widgets';

interface SocialPanelProps {
    game: GameState;
    initialArea: number;
    onPolicy: (area: number, policy: Policy) => void;
    onChat: (id: number) => void;
}
export function SocialPanel({ game, initialArea, onPolicy, onChat }: SocialPanelProps) {
    const [areaIndex, setAreaIndex] = useState(initialArea);
    const [language, setLanguage] = useState(languageFor(initialArea));
    const summary = metrics(game);
    const members = AREAS.map((_, i) => i).filter((i) => languageFor(i) === language);
    const population = members.reduce((sum, i) => sum + summary.areas[i].population, 0);
    const mean = (key: 'trust' | 'vigilance') =>
        members.reduce((sum, i) => sum + summary.areas[i][key] * summary.areas[i].population, 0) /
        (population || 1);
    return (
        <>
            <div className="section-intro">
                <h2>SNS・社会介入</h2>
                <span>{Math.floor(game.influence)} IP</span>
            </div>
            <label htmlFor="social-language">言語圏</label>
            <select
                id="social-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
            >
                {[...new Set(AREAS.map((_, i) => languageFor(i)))].map((name) => (
                    <option key={name}>{name}</option>
                ))}
            </select>
            <div className="area-metrics">
                <span>
                    世論の信頼<b>{percent(mean('trust'))}</b>
                </span>
                <span>
                    警戒<b>{percent(mean('vigilance'))}</b>
                </span>
            </div>
            <p className="muted">言語圏は表示用の区分。国ごとの性格の実測値ではありません。</p>
            <h3 className="subheading">施策を実行する生活圏</h3>
            <select
                aria-label="施策対象の生活圏"
                value={areaIndex}
                onChange={(event) => setAreaIndex(Number(event.target.value))}
            >
                {AREAS.map((area, i) => (
                    <option key={area.id} value={i}>
                        {area.name}
                    </option>
                ))}
            </select>
            <p className="muted">
                対象：{AREAS[areaIndex].name}。施策は4か月ごと。
                {game.areas[areaIndex].campaignReady > game.month
                    ? `あと${game.areas[areaIndex].campaignReady - game.month}か月待機。`
                    : '実行できます。'}
            </p>
            <div className="policy-list">
                {POLICIES.map((policy) => {
                    const missing = policy.skill && !game.skills.includes(policy.skill);
                    return (
                        <button
                            type="button"
                            key={policy.id}
                            disabled={
                                !!missing ||
                                game.influence < policy.cost ||
                                game.areas[areaIndex].campaignReady > game.month
                            }
                            onClick={() => onPolicy(areaIndex, policy.id)}
                        >
                            <b>
                                {policy.name}
                                <span>{policy.cost} IP</span>
                            </b>
                            <small>
                                {policy.description}
                                {missing ? ' 必要なスキルが未習得です。' : ''}
                            </small>
                        </button>
                    );
                })}
            </div>
            <h3 className="subheading">重要人物からの招待</h3>
            {game.availableChats.map((chat) => (
                <button
                    type="button"
                    className="chat-invitation"
                    key={chat.id}
                    onClick={() => onChat(chat.id)}
                >
                    {AREAS[chat.area].name}・{chat.person}
                    <small>
                        {chat.turn + 1}/{chat.turns}往復目
                    </small>
                </button>
            ))}
            <h3 className="subheading">投稿・社会運動</h3>
            {game.posts
                .filter((post) => post.language === language)
                .slice(0, 12)
                .map((post) => (
                    <article
                        className={`social-post ${post.movement ? 'movement' : ''}`}
                        key={post.id}
                    >
                        <b>{post.author}</b>
                        <small>
                            {AREAS[post.area].name}・{Math.floor(post.month / 12)}年目
                            {post.movement ? ' ／ 自律性回復運動' : ''}
                        </small>
                        <p>{post.text}</p>
                    </article>
                ))}
            {!game.posts.some((post) => post.language === language) && (
                <p className="muted">
                    この言語圏には、まだ注目の投稿がありません。施策や社会の変化が投稿に反映されます。
                </p>
            )}
        </>
    );
}
