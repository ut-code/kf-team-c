import { X } from 'lucide-react';
import { useGameStore } from '../state/gameStore';
import styles from './NewsBreaking.module.css';

/**
 * 警告(warning)を速報バナーとして地図の上端へ差し込む。
 * 先頭は点滅する「速報」、2本目以降は「続報」。クリックで閉じ、
 * アニメーション終了でも自動的に消える。表示速度はゲーム速度へ追従する。
 */
export function NewsBreaking({ speed }: { speed: number }) {
    const items = useGameStore((state) => state.notifications.items).filter(
        (item) => item.kind === 'warning',
    );
    if (!items.length) return null;
    return (
        <div className={styles.stack} data-animation-speed={speed}>
            {items.map((item, index) => (
                <button
                    type="button"
                    key={item.id}
                    className={styles.banner}
                    title={item.text}
                    onClick={() => useGameStore.getState().dismissNotification(item.id)}
                    onAnimationEnd={(event) => {
                        if (event.target === event.currentTarget) {
                            useGameStore.getState().dismissNotification(item.id);
                        }
                    }}
                >
                    <span className={index === 0 ? styles.tag : styles.tagFollow}>
                        <i className={styles.dot} aria-hidden="true" />
                        {index === 0 ? '速報' : '続報'}
                    </span>
                    <span className={styles.headline}>
                        {item.text}
                        <X size={13} className={styles.close} aria-hidden="true" />
                    </span>
                </button>
            ))}
        </div>
    );
}
