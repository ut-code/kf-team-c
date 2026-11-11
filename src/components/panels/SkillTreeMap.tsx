import { Check, LockKeyhole, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { capabilityLabel } from '../../game/secrecy/capabilities';
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
    const viewport = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 1, height: 1 });
    const [camera, setCamera] = useState<{ x: number; y: number; zoom: number } | null>(null);
    const drag = useRef<{
        x: number;
        y: number;
        camera: { x: number; y: number; zoom: number };
    } | null>(null);
    const previousSelection = useRef(selectedId);
    const nodeDrag = useRef<{
        id: string;
        x: number;
        y: number;
        point: TreePoint;
        zoom: number;
    } | null>(null);
    const roots = tree.positions.filter((node) => node.skill.requires.length === 0);
    const originZoom = Math.min(
        1,
        size.width /
            (2 *
                Math.max(
                    ...roots.map((node) => Math.abs(node.x - tree.centerX) + tree.nodeWidth / 2),
                ) +
                80),
        size.height /
            (2 *
                Math.max(
                    ...roots.map((node) => Math.abs(node.y - tree.centerY) + tree.nodeHeight / 2),
                ) +
                80),
    );
    const fitZoom = Math.min(size.width / (tree.width + 40), size.height / (tree.height + 40));
    const view = camera ?? { x: tree.centerX, y: tree.centerY, zoom: originZoom };
    const currentView = useRef({ view, fitZoom });
    useLayoutEffect(() => {
        currentView.current = { view, fitZoom };
    }, [view, fitZoom]);
    useLayoutEffect(() => {
        const element = viewport.current!;
        const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useLayoutEffect(() => {
        if (previousSelection.current === selectedId) return;
        previousSelection.current = selectedId;
        if (editor.editing) return;
        const node = tree.positions.find((item) => item.skill.id === selectedId)!;
        setCamera((current) => ({
            x: node.x,
            y: node.y,
            zoom: current?.zoom ?? originZoom,
        }));
    }, [selectedId, originZoom, tree.positions, editor.editing]);
    useEffect(() => {
        const element = viewport.current!;
        const wheel = (event: WheelEvent) => {
            if (event.target instanceof Element && event.target.closest('.tree-layout-editor'))
                return;
            event.preventDefault();
            if (nodeDrag.current) return;
            const { view, fitZoom } = currentView.current;
            const delta =
                event.deltaY *
                (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
            const zoom = Math.max(fitZoom, Math.min(2, view.zoom * Math.exp(-delta * 0.0015)));
            const bounds = element.getBoundingClientRect();
            const x = event.clientX - bounds.left - bounds.width / 2;
            const y = event.clientY - bounds.top - bounds.height / 2;
            setCamera({
                x: view.x + x / view.zoom - x / zoom,
                y: view.y + y / view.zoom - y / zoom,
                zoom,
            });
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => element.removeEventListener('wheel', wheel);
    }, []);
    return (
        <div
            ref={viewport}
            className="tree-viewport"
            data-layout-editing={editor.editing}
            role="application"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: 矢印キーで移動できる描画領域としてフォーカスを受け取る。
            tabIndex={0}
            aria-label="スキルツリー。ドラッグまたは矢印キーで移動、ホイールで拡大縮小できます"
            onPointerDown={(event) => {
                if (
                    event.button !== 0 ||
                    (event.target instanceof Element &&
                        event.target.closest('button, .tree-layout-editor'))
                )
                    return;
                event.preventDefault();
                event.currentTarget.focus();
                drag.current = { x: event.clientX, y: event.clientY, camera: view };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (!drag.current) return;
                const start = drag.current;
                setCamera({
                    ...start.camera,
                    x: start.camera.x - (event.clientX - start.x) / start.camera.zoom,
                    y: start.camera.y - (event.clientY - start.y) / start.camera.zoom,
                });
            }}
            onPointerUp={() => {
                drag.current = null;
            }}
            onPointerCancel={() => {
                drag.current = null;
            }}
            onLostPointerCapture={() => {
                drag.current = null;
            }}
            onKeyDown={(event) => {
                if (
                    event.target instanceof Element &&
                    event.target.closest('button, .tree-layout-editor')
                )
                    return;
                const directions: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                };
                const direction = directions[event.key];
                if (!direction) return;
                event.preventDefault();
                setCamera({
                    ...view,
                    x: view.x + (direction[0] * 60) / view.zoom,
                    y: view.y + (direction[1] * 60) / view.zoom,
                });
            }}
        >
            <svg
                viewBox={`${view.x - size.width / view.zoom / 2} ${view.y - size.height / view.zoom / 2} ${size.width / view.zoom} ${size.height / view.zoom}`}
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
                                onPointerDown={(event) => {
                                    if (!editor.editing || editor.saving || event.button !== 0)
                                        return;
                                    event.stopPropagation();
                                    event.preventDefault();
                                    setCamera(view);
                                    onSelect(skill.id);
                                    nodeDrag.current = {
                                        id: skill.id,
                                        x: event.clientX,
                                        y: event.clientY,
                                        point: { x, y },
                                        zoom: view.zoom,
                                    };
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                }}
                                onPointerMove={(event) => {
                                    const start = nodeDrag.current;
                                    if (!start || start.id !== skill.id) return;
                                    event.stopPropagation();
                                    editor.move(skill.id, {
                                        x: start.point.x + (event.clientX - start.x) / start.zoom,
                                        y: start.point.y + (event.clientY - start.y) / start.zoom,
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
            {import.meta.env.DEV && (
                <div className="tree-layout-editor">
                    <label>
                        <input
                            type="checkbox"
                            checked={editor.editing}
                            disabled={editor.saving}
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
