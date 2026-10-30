import { CircleCheck, Newspaper, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import presentation from '../../game/data/ui/presentation.json';
import type { GameEvent } from '../../game/types.ts';
import { IconButton } from '../ui/Controls';
import { Panel } from '../ui/Panel';
import styles from './Notifications.module.css';

const icons = { completion: CircleCheck, news: Newspaper, warning: TriangleAlert };

function Notice({ event, expire }: { event: GameEvent; expire: (id: number) => void }) {
    const callback = useRef(expire);
    callback.current = expire;
    useEffect(() => {
        const timer = window.setTimeout(
            () => callback.current(event.id),
            presentation.notificationLifetimeMs,
        );
        return () => window.clearTimeout(timer);
    }, [event.id]);
    const Icon = icons[event.kind];
    return (
        <Panel as="div" className={styles.card} data-notification={event.kind}>
            <Icon aria-hidden="true" size={17} />
            <div>
                <strong>{event.title}</strong>
                <p>{event.message}</p>
            </div>
            <IconButton
                icon={X}
                label={`${event.title}の通知を閉じる`}
                className={styles.dismiss}
                onClick={() => expire(event.id)}
            />
        </Panel>
    );
}

export function Notifications({ events, nextEvent }: { events: GameEvent[]; nextEvent: number }) {
    const lastSeen = useRef(0);
    const [pending, setPending] = useState<GameEvent[]>([]);
    useEffect(() => {
        // 再開始で連番が戻った場合、前のプレイの通知も捨てる。
        const restarted = nextEvent <= lastSeen.current;
        if (restarted) lastSeen.current = 0;
        const incoming = events.filter((event) => event.id > lastSeen.current);
        if (restarted || incoming.length)
            setPending((current) => [...(restarted ? [] : current), ...incoming]);
        lastSeen.current = nextEvent - 1;
    }, [events, nextEvent]);
    return (
        <section
            className={styles.stack}
            aria-label="通知"
            aria-live="polite"
            aria-relevant="additions"
        >
            {pending.slice(0, presentation.visibleNotifications).map((event) => (
                <Notice
                    key={event.id}
                    event={event}
                    expire={(id) =>
                        setPending((current) => current.filter((item) => item.id !== id))
                    }
                />
            ))}
        </section>
    );
}
