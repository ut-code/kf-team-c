import { useGameStore } from '../state/gameStore';
import styles from './NotificationFeed.module.css';

export function NotificationFeed({ speed }: { speed: number }) {
    const items = useGameStore((state) => state.notifications.items);
    if (!items.length) return null;
    return (
        <section className={styles.feed} aria-label="通知" data-animation-speed={speed}>
            <ol className={styles.items}>
                {items.map((item) => (
                    <li
                        key={item.id}
                        className={styles.item}
                        data-kind={item.kind}
                        onAnimationEnd={() => useGameStore.getState().dismissNotification(item.id)}
                    >
                        <span title={item.text}>{item.text}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
