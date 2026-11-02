import { X } from 'lucide-react';
import type { ReactNode } from 'react';

const panelTitles = { ability: '能力配分', research: 'スキルツリー', area: '小地域' };
export type GamePanel = keyof typeof panelTitles;

interface FloatingPanelProps {
    panel: GamePanel;
    onClose: () => void;
    children: ReactNode;
}

export function FloatingPanel({ panel, onClose, children }: FloatingPanelProps) {
    return (
        <aside className="floating-panel glass" aria-label="操作パネル">
            <div className="panel-heading">
                <span>{panelTitles[panel]}</span>
                <button type="button" aria-label="操作パネルを閉じる" onClick={onClose}>
                    <X size={17} />
                </button>
            </div>
            <div className="panel-scroll">{children}</div>
        </aside>
    );
}
