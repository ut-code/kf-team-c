import assert from 'node:assert/strict';
import { skillLayout, type TreePoint } from '../src/game/skillLayout.ts';

function distance(point: TreePoint, start: TreePoint, end: TreePoint) {
    const dx = end.x - start.x,
        dy = end.y - start.y;
    const length = dx * dx + dy * dy;
    const t =
        length === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length),
              );
    return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}
function cross(a: TreePoint, b: TreePoint, c: TreePoint) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function segmentDistance(a: TreePoint, b: TreePoint, c: TreePoint, d: TreePoint) {
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
    return Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b));
}
type Box = { left: number; right: number; top: number; bottom: number };
const bounds = (a: TreePoint, b: TreePoint, padding = 0): Box => ({
    left: Math.min(a.x, b.x) - padding,
    right: Math.max(a.x, b.x) + padding,
    top: Math.min(a.y, b.y) - padding,
    bottom: Math.max(a.y, b.y) + padding,
});
const separate = (a: Box, b: Box) =>
    a.left > b.right || b.left > a.right || a.top > b.bottom || b.top > a.bottom;

export function checkSkillLayout() {
    const tree = skillLayout();
    assert.equal(tree.centerX, 0);
    assert.equal(tree.centerY, 0);
    const boxes = [
        {
            id: 'origin',
            x: tree.centerX,
            y: tree.centerY,
            width: tree.originRadius * 2,
            height: tree.originRadius * 2,
        },
        ...tree.positions.map((node) => ({
            id: node.skill.id,
            x: node.x,
            y: node.y,
            width: tree.nodeWidth,
            height: tree.nodeHeight,
        })),
    ].map((node) => ({
        id: node.id,
        left: node.x - node.width / 2 - (node.id === 'origin' ? 2 : 6),
        right: node.x + node.width / 2 + (node.id === 'origin' ? 2 : 6),
        top: node.y - node.height / 2 - (node.id === 'origin' ? 2 : 6),
        bottom: node.y + node.height / 2 + (node.id === 'origin' ? 2 : 6),
    }));
    for (let i = 0; i < boxes.length; i++)
        for (const other of boxes.slice(i + 1))
            assert.ok(separate(boxes[i], other), `ノードが重なる：${boxes[i].id} / ${other.id}`);
    const paths = tree.edges.map((edge) => {
        const points = edge.points;
        return {
            id: `${edge.from} → ${edge.to}`,
            segments: points.slice(1).map((end, index) => ({
                start: points[index],
                end,
                box: bounds(points[index], end, 3),
            })),
        };
    });
    let closestEdges = Infinity;
    for (const path of paths)
        for (const box of boxes) {
            if (box.id === 'origin') {
                for (const segment of path.segments)
                    assert.ok(
                        distance({ x: tree.centerX, y: tree.centerY }, segment.start, segment.end) >
                            tree.originRadius + 2.1,
                        `線が起点に重なる：${path.id}`,
                    );
                continue;
            }
            const corners = [
                { x: box.left, y: box.top },
                { x: box.right, y: box.top },
                { x: box.right, y: box.bottom },
                { x: box.left, y: box.bottom },
            ];
            for (const segment of path.segments) {
                if (separate(segment.box, box)) continue;
                assert.ok(
                    !(
                        segment.start.x >= box.left &&
                        segment.start.x <= box.right &&
                        segment.start.y >= box.top &&
                        segment.start.y <= box.bottom
                    ),
                    `線がノード内部に入る：${path.id} / ${box.id}`,
                );
                for (let index = 0; index < 4; index++)
                    assert.ok(
                        segmentDistance(
                            segment.start,
                            segment.end,
                            corners[index],
                            corners[(index + 1) % 4],
                        ) > 1.1,
                        `線とノードが接触：${path.id} / ${box.id}`,
                    );
            }
        }
    for (let i = 0; i < paths.length; i++)
        for (const other of paths.slice(i + 1))
            for (const a of paths[i].segments)
                for (const b of other.segments) {
                    if (separate(a.box, b.box)) continue;
                    const gap = segmentDistance(a.start, a.end, b.start, b.end);
                    closestEdges = Math.min(closestEdges, gap);
                    assert.ok(gap > 2.1, `線同士が接触：${paths[i].id} / ${other.id}（${gap}px）`);
                }
    return {
        skills: tree.positions.length,
        edges: tree.edges.length,
        nodeOverlaps: 0,
        edgeNodeIntersections: 0,
        edgeIntersections: 0,
        closestEdges,
    };
}

console.log(JSON.stringify(checkSkillLayout()));
