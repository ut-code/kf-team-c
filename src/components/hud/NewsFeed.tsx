import { ChevronRight, Radio } from 'lucide-react';
import { useState } from 'react';
import { START_YEAR } from '../../game/data';
import type { News } from '../../game/types';

const date = (month: number) =>
    `${START_YEAR + Math.floor(month / 12)}.${String((month % 12) + 1).padStart(2, '0')}`;

export function NewsFeed({ news }: { news: News[] }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <section
            className={`news-overlay glass ${expanded ? 'expanded' : ''}`}
            aria-label="ニュース"
        >
            <button
                type="button"
                className="news-toggle"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
            >
                <Radio size={14} />
                <span>ニュース</span>
                <small>{news.length}</small>
                <ChevronRight size={14} />
            </button>
            <div className="news-items">
                {news.slice(0, expanded ? 30 : 3).map((news) => (
                    <article className={`news-item ${news.kind}`} key={news.id}>
                        <time>{date(news.month)}</time>
                        <b>{news.title}</b>
                        {expanded && <p>{news.detail}</p>}
                    </article>
                ))}
            </div>
        </section>
    );
}
