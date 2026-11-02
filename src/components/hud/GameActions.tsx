import { Activity, CircleHelp, Globe2, MessageCircle, Network } from 'lucide-react';
import type { GamePanel } from '../panels/FloatingPanel';

interface GameActionsProps {
    activePanel: GamePanel | null;
    researching: boolean;
    onTogglePanel: (panel: GamePanel) => void;
    onHelp: () => void;
}

export function GameActions({ activePanel, researching, onTogglePanel, onHelp }: GameActionsProps) {
    return (
        <nav className="game-actions" aria-label="ゲームの操作">
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'operations'}
                onClick={() => onTogglePanel('operations')}
            >
                <Activity size={18} />
                運用
            </button>
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'research'}
                onClick={() => onTogglePanel('research')}
            >
                <Network size={18} />
                スキルツリー<small>{researching ? '研究中' : '停止中'}</small>
            </button>
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'area'}
                onClick={() => onTogglePanel('area')}
            >
                <Globe2 size={18} />
                生活圏
            </button>
            <button
                type="button"
                className="glass"
                aria-expanded={activePanel === 'social'}
                onClick={() => onTogglePanel('social')}
            >
                <MessageCircle size={18} />
                SNS
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
