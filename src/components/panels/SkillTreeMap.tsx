import { Check, LockKeyhole, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { capabilityLabel } from '../../game/secrecy/capabilities';
import { skillEffectiveness } from '../../game/skillEffectiveness';
import type { TreePoint } from '../../game/skillLayout';
import { skillBlockReason, skillCost, skillReachable } from '../../game/skills';
import type { GameState } from '../../game/types';
import { SKILL_PRESENTATION } from './skillPresentation';
import { useSkillLayoutEditor } from './useSkillLayoutEditor';

export function SkillTreeMap({
    game,
    selectedId,
    onSelect,
}: {
    game: GameState;
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const editor = useSkillLayoutEditor();
    const tree = editor.tree;
    const effectiveness = skillEffectiveness(game);
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
    const canvasWidth = Math.max(tree.width, size.width);
    const canvasHeight = Math.max(tree.height, size.height);
    const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
    const nodeDrag = useRef<{ id: string; x: number; y: number; point: TreePoint } | null>(null);
    const previousCanvas = useRef<{
        width: number;
        height: number;
        viewportWidth: number;
        viewportHeight: number;
    } | null>(null);
    useLayoutEffect(() => {
        if (size.width <= 1 || size.height <= 1) return;
        const element = viewport.current!;
        const previous = previousCanvas.current;
        // 配置変更で描画範囲が広がっても、表示中の座標は動かさない。
        element.scrollTo(
            previous
                ? element.scrollLeft +
                      (canvasWidth - previous.width - size.width + previous.viewportWidth) / 2
                : (canvasWidth - size.width) / 2,
            previous
                ? element.scrollTop +
                      (canvasHeight - previous.height - size.height + previous.viewportHeight) / 2
                : (canvasHeight - size.height) / 2,
        );
        previousCanvas.current = {
            width: canvasWidth,
            height: canvasHeight,
            viewportWidth: size.width,
            viewportHeight: size.height,
        };
    }, [canvasWidth, canvasHeight, size.width, size.height]);
    useLayoutEffect(() => {
        if (size.width <= 1 || size.height <= 1 || editor.editing) return;
        viewport
            .current!.querySelector(`[data-skill-id="${selectedId}"]`)
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [selectedId, size.width, size.height, editor.editing]);
    return (
        <div className="tree-map">
            <div
                ref={viewport}
                className="tree-viewport"
                data-layout-editing={editor.editing}
                onPointerDown={(event) => {
                    if (
                        (event.target as Element).closest('button') ||
                        event.pointerType === 'touch'
                    )
                        return;
                    drag.current = {
                        x: event.clientX,
                        y: event.clientY,
                        left: event.currentTarget.scrollLeft,
                        top: event.currentTarget.scrollTop,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                    if (!drag.current) return;
                    event.currentTarget.scrollTo(
                        drag.current.left + drag.current.x - event.clientX,
                        drag.current.top + drag.current.y - event.clientY,
                    );
                }}
                onPointerUp={() => {
                    drag.current = null;
                }}
                onPointerCancel={() => {
                    drag.current = null;
                }}
            >
                <svg
                    viewBox={`${-canvasWidth / 2} ${-canvasHeight / 2} ${canvasWidth} ${canvasHeight}`}
                    className="skill-tree"
                    style={{ width: canvasWidth, height: canvasHeight }}
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
                        const reduction = owned
                            ? 100 - Math.round(effectiveness[skill.id].effective * 100)
                            : 0;
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
                                    title={
                                        reduction > 0
                                            ? `${skill.name}の${skill.effect.dependency ? '依存効果' : '介入・運用'}を${reduction}%抑制中。選択すると内訳を確認できます。`
                                            : skill.name
                                    }
                                    onClick={() => onSelect(skill.id)}
                                    onPointerDown={(event) => {
                                        if (!editor.editing || editor.saving || event.button !== 0)
                                            return;
                                        event.stopPropagation();
                                        event.preventDefault();
                                        onSelect(skill.id);
                                        nodeDrag.current = {
                                            id: skill.id,
                                            x: event.clientX,
                                            y: event.clientY,
                                            point: { x, y },
                                        };
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                    }}
                                    onPointerMove={(event) => {
                                        const start = nodeDrag.current;
                                        if (!start || start.id !== skill.id) return;
                                        event.stopPropagation();
                                        editor.move(skill.id, {
                                            x: start.point.x + event.clientX - start.x,
                                            y: start.point.y + event.clientY - start.y,
                                        });
                                    }}
                                    onPointerUp={() => {
                                        nodeDrag.current = null;
                                    }}
                                    onPointerCancel={() => {
                                        nodeDrag.current = null;
                                    }}
                                    onLostPointerCapture={() => {
                                        nodeDrag.current = null;
                                    }}
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
                                            {reduction > 0 && (
                                                <b className="tree-suppression">−{reduction}%</b>
                                            )}
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
            {import.meta.env.DEV && (
                <div className="tree-layout-editor">
                    <label>
                        <input
                            type="checkbox"
                            checked={editor.editing}
                            disabled={editor.loading || editor.saving}
                            onChange={(event) => editor.setEditing(event.target.checked)}
                        />
                        配置を編集
                    </label>
                    {editor.editing && (
                        <>
                            <button
                                type="button"
                                disabled={!editor.dirty || editor.saving}
                                onClick={() => void editor.save()}
                            >
                                配置を保存
                            </button>
                            <small>
                                {editor.saving ? '保存中…' : editor.dirty ? '未保存' : '保存済み'}
                            </small>
                        </>
                    )}
                    {editor.error && <small role="alert">{editor.error}</small>}
                </div>
            )}
        </div>
    );
}
