import { Network, X } from 'lucide-react';
import { useState } from 'react';
import { SKILLS } from '../../game/skills';
import type { Branch, GameState } from '../../game/types';
import { SkillDetails } from './SkillDetails';
import { SkillPerformance } from './SkillPerformance';
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
    const [branch, setBranch] = useState<Branch>('IQ');
    const [performanceOpen, setPerformanceOpen] = useState(false);
    const [selections, setSelections] = useState<Record<Branch, string>>({
        IQ: 'reason',
        EQ: 'conversation',
        SYSTEM: 'lightweight',
    });
    const selected = selections[branch];
    const setSelected = (id: string) => setSelections((current) => ({ ...current, [branch]: id }));
    const skill = SKILLS.find((item) => item.id === selected)!;
    return (
        <section className="research-workspace" aria-label="スキルツリー">
            <header className="research-heading">
                <h1>
                    <Network size={22} aria-hidden="true" />
                    スキルツリー
                </h1>
                <nav className="skill-branch-tabs" aria-label="スキルツリーの表示">
                    {(['IQ', 'EQ', 'SYSTEM'] as const).map((item) => (
                        <button
                            key={item}
                            type="button"
                            className={item.toLowerCase()}
                            aria-pressed={!performanceOpen && branch === item}
                            onClick={() => {
                                setBranch(item);
                                setPerformanceOpen(false);
                            }}
                        >
                            {item}
                        </button>
                    ))}
                    <button
                        type="button"
                        aria-pressed={performanceOpen}
                        onClick={() => setPerformanceOpen(true)}
                    >
                        ステータス
                    </button>
                </nav>
                <div className="research-budget">
                    <span>残り</span>
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
            {performanceOpen ? (
                <SkillPerformance
                    game={game}
                    onSelectSkill={(id) => {
                        const target = SKILLS.find((item) => item.id === id)!;
                        setSelections((current) => ({ ...current, [target.branch]: id }));
                        setBranch(target.branch);
                        setPerformanceOpen(false);
                    }}
                />
            ) : (
                <div className="research-layout">
                    <SkillTreeMap
                        branch={branch}
                        game={game}
                        selectedId={selected}
                        onSelect={setSelected}
                    />
                    <SkillDetails game={game} skill={skill} onResearch={onResearch} />
                </div>
            )}
        </section>
    );
}
