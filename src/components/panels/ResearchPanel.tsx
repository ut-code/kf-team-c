import { X } from 'lucide-react';
import { useState } from 'react';
import { SKILLS } from '../../game/skills';
import type { GameState } from '../../game/types';
import { SkillDetails } from './SkillDetails';
import { SkillTreeMap } from './SkillTreeMap';

export function ResearchPanel({
    game,
    onResearch,
    onClose,
}: {
    game: GameState;
    onResearch: (id: string) => void;
    onClose: () => void;
}) {
    const [selected, setSelected] = useState('reason');
    const skill = SKILLS.find((item) => item.id === selected)!;
    return (
        <section className="research-workspace" aria-label="スキルツリー">
            <header className="research-heading">
                <h1>スキルツリー</h1>
                <div className="research-budget" title="時間経過と、世界への普及・依存で獲得">
                    <span>保有スキルポイント</span>
                    <strong>
                        {game.skillPoints}
                        <small>SP</small>
                    </strong>
                </div>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="スキルツリーを閉じる"
                    onClick={onClose}
                >
                    <X size={22} />
                </button>
            </header>
            <div className="research-layout">
                <SkillTreeMap game={game} selectedId={selected} onSelect={setSelected} />
                <SkillDetails game={game} skill={skill} onResearch={onResearch} />
            </div>
        </section>
    );
}
