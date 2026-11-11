import type { skillLayout } from './skillLayout.ts';

/** 全ノードを収め、起点を左側の同じ位置に置く固定表示。 */
export function skillTreeView(tree: ReturnType<typeof skillLayout>, width: number, height: number) {
    const left = Math.min(64, width / 4);
    const right = Math.max(...tree.positions.map((node) => node.x + tree.nodeWidth / 2));
    const vertical = Math.max(
        tree.originRadius,
        ...tree.positions.map((node) => Math.abs(node.y) + tree.nodeHeight / 2),
    );
    const scale = Math.min(
        1,
        Math.max(1, width - left - 24) / right,
        Math.max(1, height - 48) / (vertical * 2),
    );
    return {
        x: -left / scale,
        y: -height / scale / 2,
        width: width / scale,
        height: height / scale,
        scale,
    };
}
