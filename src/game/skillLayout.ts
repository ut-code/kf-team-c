import savedPositions from '../content/skillPositions.json' with { type: 'json' };
import { TREE_LAYOUT } from '../content/skillTree.ts';
import { SKILLS } from './skills.ts';
import type { Branch } from './types.ts';

export interface TreePoint {
    x: number;
    y: number;
}
export type SkillPositions = Record<string, TreePoint>;
export interface TreeEdge {
    from: string;
    to: string;
    points: [TreePoint, TreePoint];
}
export const SAVED_SKILL_POSITIONS: SkillPositions = savedPositions;

/** 配置は起点からの相対座標で保存する。ノードを移動しても起点とカメラはずれない。 */
export function skillLayout(coordinates: SkillPositions = SAVED_SKILL_POSITIONS, branch?: Branch) {
    const { nodeWidth, nodeHeight, originRadius, padding } = TREE_LAYOUT;
    const positions = SKILLS.filter((skill) => !branch || skill.branch === branch).map((skill) => {
        const point = coordinates[skill.id];
        if (!point) throw new Error(`${skill.id}のノード位置が設定されていません`);
        return { skill, ...point };
    });
    const byId = new Map(positions.map((node) => [node.skill.id, node]));
    const edges: TreeEdge[] = positions.map((node) => {
        if (node.skill.requires.length > 1)
            throw new Error(`${node.skill.id}の前提は1スキルにしてください`);
        const parent = byId.get(node.skill.requires[0]);
        if (node.skill.requires.length && !parent)
            throw new Error(`${node.skill.id}の前提スキルが見つかりません`);
        const start = parent ?? { x: 0, y: 0 };
        const dx = node.x - start.x,
            dy = node.y - start.y;
        const length = Math.hypot(dx, dy);
        // 線をノードの縁までつなぐ。描画順で枠線とノードを手前に置く。
        const inset = (width: number, height: number) =>
            Math.min(width / 2 / Math.abs(dx || 1e-9), height / 2 / Math.abs(dy || 1e-9));
        const from = parent ? inset(nodeWidth, nodeHeight) : originRadius / length;
        const to = inset(nodeWidth, nodeHeight);
        // 編集中に親子を重ねてもNaNや逆向きの線を描かない。
        const connected = length > 0 && from + to < 1;
        return {
            from: parent?.skill.id ?? 'origin',
            to: node.skill.id,
            points: [
                connected ? { x: start.x + dx * from, y: start.y + dy * from } : { ...start },
                connected ? { x: node.x - dx * to, y: node.y - dy * to } : { ...start },
            ],
        };
    });
    const width = Math.ceil(
        (Math.max(...positions.map((node) => Math.abs(node.x))) + nodeWidth / 2 + padding) * 2,
    );
    const height = Math.ceil(
        (Math.max(...positions.map((node) => Math.abs(node.y))) + nodeHeight / 2 + padding) * 2,
    );
    return {
        width,
        height,
        centerX: 0,
        centerY: 0,
        nodeWidth,
        nodeHeight,
        originRadius,
        positions,
        edges,
        viewBox: `${-width / 2} ${-height / 2} ${width} ${height}`,
    };
}
