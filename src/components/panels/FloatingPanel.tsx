import { X } from 'lucide-react';
import type { ReactNode } from 'react';

const panelTitles = {
    operations: '運用',
    research: 'スキルツリー',
    area: '生活圏',
    social: 'SNS・社会介入',
};
export type GamePanel = keyof typeof panelTitles;

interface FloatingPanelProps {
    panel: GamePanel;
    onClose: () => void;
    children: ReactNode;
}

export function FloatingPanel({ panel, onClose, children }: FloatingPanelProps) {
    return (
        <aside
            className={`${panel === 'research' ? 'research-workspace' : 'floating-panel'} glass`}
            aria-label="操作パネル"
        >
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
