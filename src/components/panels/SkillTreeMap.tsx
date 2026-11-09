import { Check, EyeOff, LockKeyhole, Sparkles } from 'lucide-react';
import { type CSSProperties, useLayoutEffect, useRef } from 'react';
import { capabilityLabel } from '../../game/secrecy/capabilities';
import { CAPABILITIES } from '../../game/secrecy/data';
import { skillLayout } from '../../game/skillLayout';
import { skillBlockReason, skillCost, skillReachable } from '../../game/skills';
import type { Branch, GameState } from '../../game/types';
import { referenceAbility, SKILL_BRANCHES, SKILL_PRESENTATION } from './skillPresentation';

export function SkillTreeMap({
    game,
    selectedId,
    onSelect,
}: {
    game: GameState;
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const tree = skillLayout();
    const viewport = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const element = viewport.current!;
        const revealSelected = () => {
            if (element.scrollWidth <= element.clientWidth) return;
            element.querySelector(`[data-skill-id="${selectedId}"]`)?.scrollIntoView({
                block: 'nearest',
                inline: 'center',
            });
        };
        revealSelected();
        const observer = new ResizeObserver(revealSelected);
        observer.observe(element);
        return () => observer.disconnect();
    }, [selectedId]);
    const positions = new Map(tree.positions.map((node) => [node.skill.id, node]));
    return (
        <div
            ref={viewport}
            className="tree-viewport"
            style={
                {
                    '--tree-width': `${tree.width}px`,
                    '--tree-height': `${tree.height}px`,
                } as CSSProperties
            }
        >
            <svg
                viewBox={tree.viewBox}
                className="skill-tree"
                aria-label="中央から枝分かれする進化の系統"
            >
                <title>スキルツリー</title>
                {(Object.keys(SKILL_BRANCHES) as Branch[]).map((branch) => {
                    const { icon: Icon, label } = SKILL_BRANCHES[branch];
                    const position = tree.abilityPositions[branch];
                    return (
                        <foreignObject
                            key={branch}
                            x={position.x - 110}
                            y={position.y - 32}
                            width={220}
                            height={64}
                        >
                            <div className={`tree-ability ${branch.toLowerCase()}`}>
                                <Icon size={20} aria-hidden="true" />
                                <div>
                                    <div className="tree-ability-value">
                                        <span>{branch}</span>
                                        <strong>{referenceAbility(branch, game.skills)}</strong>
                                    </div>
                                    <p>{label}</p>
                                </div>
                            </div>
                        </foreignObject>
                    );
                })}

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
                {tree.positions.flatMap((node) =>
                    node.skill.requires.slice(1).map((id) => {
                        const parent = positions.get(id)!;
                        return (
                            <line
                                key={`edge-${id}-${node.skill.id}`}
                                className={`tree-branch ${game.skills.includes(node.skill.id) ? 'complete' : ''}`}
                                x1={parent.x}
                                y1={parent.y}
                                x2={node.x}
                                y2={node.y}
                            />
                        );
                    }),
                )}
                <circle className="tree-origin" cx={tree.centerX} cy={tree.centerY} r="30" />
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
                    const important = Boolean(CAPABILITIES[skill.id]);
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
                                className={`tree-node ${skill.branch.toLowerCase()} ${owned ? 'owned' : locked ? 'locked' : affordable ? 'available' : ''} ${important ? 'important' : ''}`}
                                aria-pressed={selectedId === skill.id}
                                aria-label={`${skill.name}${important ? '・重要能力・秘匿中は調査と露呈のリスクあり' : ''}・${owned ? '習得済み' : locked ? 'ロック中' : affordable ? '習得可能' : 'SP不足'}`}
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
                                {important && (
                                    <span className="tree-node-importance">
                                        <EyeOff size={11} aria-hidden="true" />
                                        重要 ·{' '}
                                        {owned ? capabilityLabel(game, skill.id) : '露呈リスク'}
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
