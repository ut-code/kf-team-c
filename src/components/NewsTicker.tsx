import { useEffect, useRef, useState } from 'react';
import { calendarParts } from '../game/calendar';
import { useGameStore } from '../state/gameStore';
import styles from './NewsTicker.module.css';

interface TickerItem {
    id: string;
    month: number;
    text: string;
    warning: boolean;
}

// 右上フィードは短期間で消えるため、ティッカーは直近の通知を手元に蓄えて流す。
// 流しっぱなしにしないため、直近3件だけを残し、新着が来ると古いものから押し出される。
const BUFFER_LIMIT = 3;
const BASE_SECONDS = 16;
const SECONDS_PER_ITEM = 5;

/**
 * 画面下を流れるニュースティッカー。警告は▲、通常の報告は●で示す。
 * 内容は通知のtextの再利用で、新しい文章の生成はしない。
 */
export function NewsTicker({ speed }: { speed: number }) {
    const items = useGameStore((state) => state.notifications.items);
    const [buffer, setBuffer] = useState<TickerItem[]>([]);
    const seen = useRef(new Set<string>());
    useEffect(() => {
        const fresh = items.filter((item) => !seen.current.has(item.id));
        if (!fresh.length) return;
        for (const item of fresh) seen.current.add(item.id);
        setBuffer((current) =>
            [
                ...current,
                ...fresh.map((item) => ({
                    id: item.id,
                    month: item.month,
                    text: item.text,
                    warning: item.kind === 'warning',
                })),
            ].slice(-BUFFER_LIMIT),
        );
    }, [items]);
    if (!buffer.length) return null;
    return (
        <div className={styles.ticker} data-animation-speed={speed} aria-hidden="true">
            <span className={styles.tag}>速報</span>
            <div className={styles.viewport}>
                <div
                    className={styles.track}
                    style={{
                        animationDuration: `${BASE_SECONDS + buffer.length * SECONDS_PER_ITEM}s`,
                    }}
                >
                    {[0, 1].map((copy) => (
                        <div className={styles.copy} key={copy} aria-hidden={copy === 1}>
                            {buffer.map((item) => {
                                const date = calendarParts(item.month, 0);
                                return (
                                    <span
                                        key={item.id}
                                        className={item.warning ? styles.warn : styles.evt}
                                    >
                                        <time>
                                            {date.year}/{String(date.month).padStart(2, '0')}
                                        </time>
                                        {item.text}
                                    </span>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
