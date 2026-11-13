import { useEffect, useRef, useState } from 'react';
import { worldNews } from '../game/society/worldNews';
import type { GameState } from '../game/types';
import styles from './WorldNews.module.css';

type Headline = { id: string; title: string };

export function WorldNews({ game }: { game: GameState }) {
    const received = useRef(new Set<string>());
    const [queue, setQueue] = useState<Headline[]>([]);
    useEffect(() => {
        // 到着済みの記事は再登録せず、表示中に届いた記事も後ろで待たせる。
        const incoming = worldNews(game)
            .reverse()
            .filter((article) => !received.current.has(article.id));
        for (const article of incoming) received.current.add(article.id);
        if (incoming.length) setQueue((waiting) => [...waiting, ...incoming]);
    }, [game]);
    const current = queue[0];
    return (
        <section className={styles.ticker} aria-label="ニュース" data-animation-speed="1">
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
        </section>
    );
}
