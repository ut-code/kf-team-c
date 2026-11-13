import type { SkillPositions } from './skillLayout.ts';

/** 現在のノードだけを保存する。削除済みノードを含む古い編集画面とも互換性を保つ。 */
export function parseSkillPositions(value: unknown, ids: readonly string[]): SkillPositions | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries: [string, { x: number; y: number }][] = [];
    for (const id of ids) {
        if (!Object.hasOwn(value, id)) return null;
        const point: unknown = (value as Record<string, unknown>)[id];
        if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
        const { x, y } = point as { x?: unknown; y?: unknown };
        if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        )
            return null;
        entries.push([id, { x, y }]);
    }
    return Object.fromEntries(entries);
}
