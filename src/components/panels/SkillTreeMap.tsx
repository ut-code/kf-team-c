import { Check, LockKeyhole, Sparkles } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { capabilityLabel } from '../../game/secrecy/capabilities';
import { skillLayout } from '../../game/skillLayout';
import { skillBlockReason, skillCost, skillReachable } from '../../game/skills';
import { skillTreeView } from '../../game/skillTreeView';
import type { Branch, GameState } from '../../game/types';
import { SKILL_PRESENTATION } from './skillPresentation';

export function SkillTreeMap({
    game,
    branch,
    selectedId,
    onSelect,
}: {
    game: GameState;
    branch: Branch;
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const tree = useMemo(() => skillLayout(undefined, branch), [branch]);
    const viewport = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 1, height: 1 });
    useLayoutEffect(() => {
        const element = viewport.current!;
        const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const view = skillTreeView(tree, size.width, size.height);
    return (
        <div ref={viewport} className="tree-viewport">
            <svg
                viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
                className="skill-tree"
                aria-label="AI機能の開発と接続を示すスキルツリー"
            >
                <title>スキルツリー</title>
                {tree.edges.map((edge) => (
                    <line
                        key={`${edge.from}:${edge.to}`}
                        className={`tree-branch ${game.skills.includes(edge.to) ? 'complete' : ''}`}
                        x1={edge.points[0].x}
                        y1={edge.points[0].y}
                        x2={edge.points[1].x}
                        y2={edge.points[1].y}
                    />
                ))}
                <circle
                    className="tree-origin"
                    cx={tree.centerX}
                    cy={tree.centerY}
                    r={tree.originRadius}
                />
                <Sparkles
                    className="tree-origin-icon"
                    x={tree.centerX - 12}
                    y={tree.centerY - 12}
                    size={24}
                    aria-label="AI"
                />
                {tree.positions.map(({ skill, x, y }) => {
                    const Icon = SKILL_PRESENTATION[skill.id].icon;
                    const owned = game.skills.includes(skill.id);
                    const locked = !skillReachable(game, skill);
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
                                data-skill-id={skill.id}
                                className={`tree-node ${skill.branch.toLowerCase()} ${owned ? 'owned' : locked ? 'locked' : affordable ? 'available' : ''}`}
                                aria-pressed={selectedId === skill.id}
                                aria-label={`${skill.name}・${owned ? '習得済み' : locked ? 'ロック中' : affordable ? '習得可能' : 'SP不足'}`}
                                onClick={() => onSelect(skill.id)}
                            >
                                <span className="tree-node-content">
                                    <span className="tree-node-title">
                                        <Icon size={15} aria-hidden="true" />
                                        {skill.name}
                                    </span>
                                    <small>
                                        {owned ? <Check size={10} aria-hidden="true" /> : null}
                                        {owned
                                            ? capabilityLabel(game, skill.id)
                                            : `${skillCost(game, skill)} SP`}
                                    </small>
                                </span>
                                {locked && !owned && (
                                    <span className="tree-node-lock-overlay" aria-hidden="true">
                                        <LockKeyhole size={24} />
                                    </span>
                                )}
                            </button>
                        </foreignObject>
                    );
                })}
            </svg>
        </div>
    );
}
