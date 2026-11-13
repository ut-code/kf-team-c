import type { skillLayout } from './skillLayout.ts';

/** 配置確認用に全ノードを収める。実際のツリーは等倍のままスクロールする。 */
export function skillTreeView(tree: ReturnType<typeof skillLayout>, width: number, height: number) {
    const scale = Math.min(1, width / tree.width, height / tree.height);
    return {
        x: -width / scale / 2,
        y: -height / scale / 2,
        width: width / scale,
        height: height / scale,
        scale,
    };
}
