import savedPositions from '../content/skillPositions.json' with { type: 'json' };
import { TREE_LAYOUT } from '../content/skillTree.ts';
import { SKILLS } from './skills.ts';

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
export function skillLayout(coordinates: SkillPositions = SAVED_SKILL_POSITIONS) {
    const { nodeWidth, nodeHeight, originRadius, padding } = TREE_LAYOUT;
    const positions = SKILLS.map((skill) => {
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
        return {
            from: parent?.skill.id ?? 'origin',
            to: node.skill.id,
            points: [
                { x: start.x, y: start.y },
                { x: node.x, y: node.y },
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
