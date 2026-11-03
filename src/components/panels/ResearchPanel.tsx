import { Check, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { skillLayout } from '../../game/skillLayout';
import { SKILLS, skillBlockReason } from '../../game/skills';
import type { GameState } from '../../game/types';

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
    const viewport = useRef<HTMLDivElement>(null);
    const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches);
    useLayoutEffect(() => {
        const query = window.matchMedia('(max-width: 800px)');
        const update = () => setMobile(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    const tree = skillLayout(mobile ? 'mobile' : 'desktop');
    useLayoutEffect(() => {
        const element = viewport.current!;
        const canvas = element.querySelector('svg')!;
        const scale = canvas.getBoundingClientRect().width / tree.width;
        element.scrollLeft = tree.centerX * scale - element.clientWidth / 2;
        element.scrollTop = tree.centerY * scale - element.clientHeight / 2;
    }, [tree.centerX, tree.centerY, tree.width]);
    const positions = new Map(tree.positions.map((node) => [node.skill.id, node]));
    const skill = SKILLS.find((item) => item.id === selected)!;
    const reason = skillBlockReason(game, skill);
    const owned = game.skills.includes(skill.id);
    return (
        <section className="research-workspace" aria-label="スキルツリー">
            <header className="research-heading">
                <div>
                    <span className="eyebrow">EVOLUTION</span>
                    <h1>進化</h1>
                    <small className="tree-navigation-hint">スクロールして系統をたどる</small>
                </div>
                <strong className="sp-count" title="時間経過と、世界への普及・依存で獲得">
                    {game.skillPoints}
                    <small>SP</small>
                </strong>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="スキルツリーを閉じる"
                    onClick={onClose}
                >
                    <X size={22} />
                </button>
            </header>
            <div className="tree-viewport" ref={viewport}>
                <svg
                    viewBox={tree.viewBox}
                    className={`skill-tree ${mobile ? 'mobile' : 'desktop'}`}
                    aria-label="中央から枝分かれする進化の系統"
                >
                    <title>スキルツリー</title>
                    {tree.positions.map((node) => {
                        const parent = positions.get(node.skill.requires[0]);
                        const x = parent?.x ?? tree.centerX,
                            y = parent?.y ?? tree.centerY;
                        const complete = game.skills.includes(node.skill.id);
                        return (
                            <line
                                key={`edge-${node.skill.id}`}
                                className={`tree-branch ${complete ? 'complete' : ''}`}
                                x1={x}
                                y1={y}
                                x2={node.x}
                                y2={node.y}
                            />
                        );
                    })}
                    <circle className="tree-origin" cx={tree.centerX} cy={tree.centerY} r="25" />
                    <text
                        className="tree-origin-label"
                        x={tree.centerX}
                        y={tree.centerY}
                        textAnchor="middle"
                        dy="5"
                    >
                        AI
                    </text>
                    {tree.positions.map(({ skill, x, y }) => {
                        const owned = game.skills.includes(skill.id);
                        const locked = skill.requires.some((id) => !game.skills.includes(id));
                        const affordable = !skillBlockReason(game, skill);
                        return (
                            <foreignObject
                                key={skill.id}
                                x={x - tree.nodeWidth / 2}
                                y={y - tree.nodeHeight / 2}
                                width={tree.nodeWidth}
                                height={tree.nodeHeight}
                            >
                                <button
                                    type="button"
                                    className={`tree-node ${owned ? 'owned' : ''} ${locked ? 'locked' : ''} ${affordable ? 'available' : ''} ${skill.effect.dependency ? 'dependency' : ''}`}
                                    aria-pressed={selected === skill.id}
                                    onClick={() => setSelected(skill.id)}
                                >
                                    <span>{skill.name}</span>
                                    <small>
                                        {owned ? <Check size={12} /> : `${skill.cost} SP`}
                                    </small>
                                </button>
                            </foreignObject>
                        );
                    })}
                </svg>
            </div>
            <footer className="skill-selection">
                <div>
                    <h2>{skill.name}</h2>
                    <p>{skill.description}</p>
                    <small>
                        {skill.requires.length > 0
                            ? `前提：${skill.requires.map((id) => SKILLS.find((item) => item.id === id)!.name).join('・')}`
                            : '起点から習得可能'}
                    </small>
                </div>
                <button
                    type="button"
                    className="learn-button"
                    disabled={reason !== null}
                    onClick={() => onResearch(skill.id)}
                >
                    {owned ? '習得済み' : (reason ?? `習得する · ${skill.cost} SP`)}
                </button>
            </footer>
        </section>
    );
}
