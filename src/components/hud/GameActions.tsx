import { Activity, CircleHelp, Globe2, Network } from 'lucide-react';
import type { GamePanel } from '../panels/FloatingPanel';

interface GameActionsProps {
    activePanel: GamePanel | null;
    research: number;
    onTogglePanel: (panel: GamePanel) => void;
    onHelp: () => void;
}

export function GameActions({ activePanel, research, onTogglePanel, onHelp }: GameActionsProps) {
    return (
        <nav className="game-actions" aria-label="ゲームの操作">
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'ability'}
                onClick={() => onTogglePanel('ability')}
            >
                <Activity size={18} />
                能力配分
            </button>
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'research'}
                onClick={() => onTogglePanel('research')}
            >
                <Network size={18} />
                スキルツリー<small>{Math.floor(research)} RP</small>
            </button>
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'area'}
                onClick={() => onTogglePanel('area')}
            >
                <Globe2 size={18} />
                小地域
            </button>
            <button
                type="button"
                className="glass icon-button"
                aria-label="遊び方を表示"
                onClick={() => onHelp()}
            >
                <CircleHelp size={18} />
            </button>
        </nav>
    );
}
