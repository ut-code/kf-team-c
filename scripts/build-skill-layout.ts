import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { SKILLS } from '../src/game/skills.ts';
import type { Skill } from '../src/game/types.ts';

type Point = { x: number; y: number };
type Layout = {
    width: number;
    height: number;
    nodeWidth: number;
    nodeHeight: number;
    centerX: number;
    centerY: number;
    positions: Record<string, Point>;
};

// Allocate one ordered lane per terminal descendant. Parents sit at the midpoint
// of their children, so sibling subtrees stay separate without random forces.
function branchLayout(branch: Skill['branch']) {
    const children = (id: string) => SKILLS.filter((skill) => skill.requires[0] === id);
    const root = SKILLS.find((skill) => skill.branch === branch && !skill.requires.length)!;
    let lane = 0;
    const nodes: { id: string; depth: number; lane: number }[] = [];
    function visit(skill: Skill, depth: number): number {
        const descendants = children(skill.id);
        const lanes = descendants.map((child) => visit(child, depth + 1));
        const position = lanes.length ? (lanes[0] + lanes[lanes.length - 1]) / 2 : lane++;
        nodes.push({ id: skill.id, depth, lane: position });
        return position;
    }
    visit(root, 1);
    return { nodes, lanes: lane, depth: Math.max(...nodes.map((node) => node.depth)) };
}

function build(mobile: boolean): Layout {
    const layout: Layout = mobile
        ? {
              width: 400,
              height: 1100,
              nodeWidth: 86,
              nodeHeight: 48,
              centerX: 200,
              centerY: 450,
              positions: {},
          }
        : {
              width: 1500,
              height: 600,
              nodeWidth: 120,
              nodeHeight: 48,
              centerX: 750,
              centerY: 350,
              positions: {},
          };
    for (const branch of ['IQ', 'EQ', 'SYSTEM'] as const) {
        const tree = branchLayout(branch);
        for (const node of tree.nodes) {
            const fraction = tree.lanes === 1 ? 0.5 : node.lane / (tree.lanes - 1);
            let x: number, y: number;
            if (!mobile) {
                if (branch === 'EQ') {
                    x = layout.centerX;
                    y = layout.centerY - 90 - (node.depth - 1) * 70;
                } else {
                    x =
                        layout.centerX +
                        ((branch === 'IQ' ? -1 : 1) * node.depth * 666) / tree.depth;
                    y = 150 + fraction * 390;
                }
            } else if (branch === 'IQ') {
                x = 51 + fraction * 298;
                y = 350 - (node.depth - 1) * 96;
            } else if (branch === 'EQ') {
                x = 51;
                y = 450 + (node.depth - 1) * 80;
            } else {
                x = node.depth === 1 ? 280 : 51 + fraction * 298;
                y = node.depth === 1 ? 570 : 770 + (node.depth - 2) * 96;
            }
            layout.positions[node.id] = { x: Math.round(x), y: Math.round(y) };
        }
    }
    return layout;
}

// Apply bounded, seeded variation offline. Reject moves that damage spacing or
// branch visibility; none of this search runs in the browser.
function vary(layout: Layout, seed: number) {
    const anchors = structuredClone(layout.positions);
    const ids = Object.keys(anchors);
    const mobile = layout.width < 800;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    validate(layout);
    for (let step = 0; step < 6000; step++) {
        const id = ids[Math.floor(random() * ids.length)];
        const previous = layout.positions[id];
        layout.positions[id] = {
            x: Math.round(anchors[id].x + (random() - 0.5) * (mobile ? 40 : 70)),
            y: Math.round(anchors[id].y + (random() - 0.5) * (mobile ? 56 : 60)),
        };
        try {
            validate(layout);
        } catch {
            layout.positions[id] = previous;
        }
    }
    return layout;
}

function validate(layout: Layout) {
    const { nodeWidth: w, nodeHeight: h, positions } = layout;
    assert.equal(Object.keys(positions).length, SKILLS.length);
    const nodes = Object.entries(positions);
    for (const [id, point] of nodes) {
        assert.ok(
            point.x >= w / 2 + 8 && point.x <= layout.width - w / 2 - 8,
            `${id}: horizontal bounds`,
        );
        assert.ok(
            point.y >= h / 2 + 8 && point.y <= layout.height - h / 2 - 8,
            `${id}: vertical bounds`,
        );
        assert.ok(
            Math.abs(point.x - layout.centerX) > w / 2 + 34 ||
                Math.abs(point.y - layout.centerY) > h / 2 + 34,
            `${id}: overlaps the central AI`,
        );
        for (const [otherId, other] of nodes) {
            if (id >= otherId) continue;
            assert.ok(
                Math.abs(point.x - other.x) >= w + 12 || Math.abs(point.y - other.y) >= h + 16,
                `${id} overlaps ${otherId}`,
            );
        }
    }
    const edges = SKILLS.map((skill) => ({
        id: skill.id,
        parent: skill.requires[0],
        a: positions[skill.requires[0]] ?? { x: layout.centerX, y: layout.centerY },
        b: positions[skill.id],
    }));
    const cross = (a: Point, b: Point, c: Point) =>
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    for (const edge of edges) {
        for (const other of edges) {
            if (edge.id >= other.id) continue;
            assert.ok(
                !(
                    cross(edge.a, edge.b, other.a) * cross(edge.a, edge.b, other.b) < 0 &&
                    cross(other.a, other.b, edge.a) * cross(other.a, other.b, edge.b) < 0
                ),
                `${edge.id} crosses ${other.id}`,
            );
        }
        for (const [id, point] of nodes) {
            if (id === edge.id || id === edge.parent) continue;
            // A line must not enter an unrelated card, including its inner padding.
            let start = 0,
                end = 1;
            for (const axis of ['x', 'y'] as const) {
                const half = axis === 'x' ? w / 2 + 4 : h / 2 + 4;
                const delta = edge.b[axis] - edge.a[axis];
                const low = point[axis] - half,
                    high = point[axis] + half;
                if (delta === 0) {
                    if (edge.a[axis] < low || edge.a[axis] > high) end = -1;
                } else {
                    const t1 = (low - edge.a[axis]) / delta,
                        t2 = (high - edge.a[axis]) / delta;
                    start = Math.max(start, Math.min(t1, t2));
                    end = Math.min(end, Math.max(t1, t2));
                }
            }
            assert.ok(start > end, `${edge.id} passes through ${id}`);
        }
    }
}

const layouts = { desktop: vary(build(false), 1729), mobile: vary(build(true), 2026) };
for (const [name, layout] of Object.entries(layouts)) {
    validate(layout);
    console.log(`${name}: ${SKILLS.length} nodes, no overlaps, crossings or obstructed branches`);
}
const output = new URL('../src/game/data/skill-layouts.json', import.meta.url);
if (process.argv.includes('--check')) {
    const { readFileSync } = await import('node:fs');
    assert.deepEqual(
        JSON.parse(readFileSync(output, 'utf8')),
        layouts,
        'Run npm run layout:skills to update saved coordinates',
    );
} else {
    writeFileSync(output, `${JSON.stringify(layouts, null, 4)}\n`);
}
