import { useGameStore } from '../state/gameStore';
import styles from './NotificationFeed.module.css';
import { researchPresentation } from './society/researchPresentation';

export function NotificationFeed({ speed }: { speed: number }) {
    const items = useGameStore((state) => state.notifications.items);
    const investigations = useGameStore((state) => state.game!.investigations);
    if (!items.length) return null;
    return (
        <section className={styles.feed} aria-label="通知" data-animation-speed={speed}>
            <ol className={styles.items}>
                {items.map((item) => {
                    const project = investigations.find(
                        (project) => project.id === item.investigationId,
                    );
                    const presentation =
                        project?.kind === 'research' ? researchPresentation(project) : null;
                    const Icon = presentation?.Icon;
                    return (
                        <li
                            key={item.id}
                            className={styles.item}
                            data-kind={item.kind}
                            onAnimationEnd={() =>
                                useGameStore.getState().dismissNotification(item.id)
                            }
                        >
                            {Icon && (
                                <Icon
                                    size={15}
                                    style={{ color: presentation!.color }}
                                    aria-hidden="true"
                                />
                            )}
                            <span title={item.text}>{item.text}</span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
