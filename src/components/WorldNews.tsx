import { ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calendarParts } from '../game/calendar';
import { worldNews } from '../game/society/worldNews';
import type { GameState } from '../game/types';
import styles from './WorldNews.module.css';
import { Modal } from './widgets';

type Headline = ReturnType<typeof worldNews>[number];

function newsDate(month: number) {
    const date = calendarParts(month, 0);
    return `${date.year}年${date.month}月`;
}

export function WorldNews({ game, speed }: { game: GameState; speed: number }) {
    const articles = useMemo(() => worldNews(game), [game]);
    const received = useRef(new Set<string>());
    const [queue, setQueue] = useState<Headline[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const opener = useRef<HTMLButtonElement>(null);
    const close = () => {
        setSelected(null);
        opener.current?.focus();
    };
    useEffect(() => {
        // 到着済みの記事は再登録せず、表示中に届いた記事も後ろで待たせる。
        const incoming = [...articles]
            .reverse()
            .filter((article) => !received.current.has(article.id));
        for (const article of incoming) received.current.add(article.id);
        if (incoming.length) setQueue((waiting) => [...waiting, ...incoming]);
    }, [articles]);
    const current = queue[0];
    const article = articles.find((item) => item.id === selected);
    return (
        <>
            <section className={styles.ticker} aria-label="ニュース" data-animation-speed={speed}>
                <h2>ニュース</h2>
                <div className={styles.window}>
                    {current && (
                        <p
                            key={current.id}
                            className={styles.headline}
                            style={{
                                animationDuration: `${Math.max(12, (current.title.length * 12 + 390) / 38)}s`,
                            }}
                            onAnimationEnd={() =>
                                setQueue((waiting) =>
                                    waiting[0]?.id === current.id ? waiting.slice(1) : waiting,
                                )
                            }
                        >
                            {current.title}
                        </p>
                    )}
                </div>
                <button
                    ref={opener}
                    type="button"
                    className={styles.open}
                    aria-label="ニュースの詳細を開く"
                    aria-haspopup="dialog"
                    disabled={!articles.length}
                    onClick={() => setSelected((current ?? articles[0]).id)}
                >
                    <ChevronRight size={17} aria-hidden="true" />
                </button>
            </section>
            {article && (
                <Modal label="ニュースの詳細" className={styles.reader} onClose={close}>
                    <header className={styles.heading}>
                        <h2>ニュース</h2>
                        <button
                            type="button"
                            className="icon-button"
                            aria-label="ニュースを閉じる"
                            onClick={close}
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </header>
                    <article className={styles.article}>
                        <p className={styles.meta}>
                            {newsDate(article.month)} · {article.region}
                        </p>
                        <h3>{article.title}</h3>
                        <p>{article.summary}</p>
                        {article.author && <p className={styles.meta}>{article.author}</p>}
                    </article>
                    {articles.length > 1 && (
                        <nav className={styles.archive} aria-label="これまでのニュース">
                            <h3>これまでのニュース</h3>
                            {articles.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-current={item.id === selected ? 'true' : undefined}
                                    onClick={() => setSelected(item.id)}
                                >
                                    <span>
                                        <small>
                                            {newsDate(item.month)} · {item.region}
                                        </small>
                                        {item.title}
                                    </span>
                                    <ChevronRight size={16} aria-hidden="true" />
                                </button>
                            ))}
                        </nav>
                    )}
                </Modal>
            )}
        </>
    );
}
