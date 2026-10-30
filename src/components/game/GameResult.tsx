import { useEffect, useId, useRef } from 'react';
import { worldMetrics } from '../../game/outcome';
import type { GameState } from '../../game/types';
import styles from '../GameApp.module.css';
import { Button } from '../ui/Controls';
import { Panel } from '../ui/Panel';
import { number } from './controls';

export function GameResult({ game, onRestart }: { game: GameState; onRestart: () => void }) {
    const headingId = useId();
    const restartButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        restartButton.current?.focus();
    }, []);
    return (
        <div className={styles.resultBackdrop}>
            <Panel
                as="section"
                className={`${styles.panel} ${styles.result}`}
                role="dialog"
                aria-labelledby={headingId}
                aria-modal="true"
                onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                        event.preventDefault();
                        restartButton.current?.focus();
                    }
                }}
            >
                <div className={styles.panelEyebrow}>作戦終了</div>
                <h2 id={headingId}>{game.outcome === 'victory' ? '勝利' : '敗北'}</h2>
                <p>{game.outcomeReason}</p>
                <p>世界支配率：{number(worldMetrics(game).control)}%</p>
                <Button ref={restartButton} onClick={onRestart}>
                    もう一度プレイ
                </Button>
            </Panel>
        </div>
    );
}
