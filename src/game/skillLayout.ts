import type { Skill } from './types.ts';

export interface SkillPosition {
    skill: Skill;
    x: number;
    y: number;
}

/** 葉の数で枝の占有角を配分し、揺らぎと反発で自然な樹形へ整える。座標の手置きはしない。 */
export function layoutSkills(skills: Skill[], width = 1400, height = 650) {
    const children = (id: string) => skills.filter((skill) => skill.requires[0] === id);
    const leaves = (skill: Skill): number =>
        Math.max(
            1,
            children(skill.id).reduce((sum, child) => sum + leaves(child), 0),
        );
    const noise = (id: string) => {
        let value = 2166136261;
        for (const character of id) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
        return (value >>> 0) / 4294967295 - 0.5;
    };
    const positions: (SkillPosition & { anchorX: number; anchorY: number })[] = [];
    function grow(skill: Skill, depth: number, start: number, end: number) {
        const angle = (start + end) / 2 + noise(skill.id) * 0.09;
        const radius = depth * 160 + noise(`${skill.id}-radius`) * 36;
        const x = Math.cos(angle) * radius * 1.2;
        const y = Math.sin(angle) * radius;
        positions.push({ skill, x, y, anchorX: x, anchorY: y });
        const descendants = children(skill.id);
        const count = descendants.reduce((sum, child) => sum + leaves(child), 0);
        let cursor = start;
        for (const child of descendants) {
            const width = ((end - start) * leaves(child)) / count;
            grow(child, depth + 1, cursor, cursor + width);
            cursor += width;
        }
    }
    const branches = ['IQ', 'EQ', 'SYSTEM'];
    branches.forEach((branch, index) => {
        const root = skills.find(
            (skill) => skill.branch === branch && skill.requires.length === 0,
        )!;
        const angle = ((-150 + index * 120) * Math.PI) / 180;
        grow(root, 1, angle - 0.83, angle + 0.83);
    });
    const nodeWidth = Math.max(100, Math.min(152, width / 10));
    const nodeHeight = Math.max(38, Math.min(52, height / 10));
    const centerX = width / 2,
        centerY = height / 2;
    const extentX = Math.max(...positions.map((node) => Math.abs(node.x)));
    const extentY = Math.max(...positions.map((node) => Math.abs(node.y)));
    for (const node of positions) {
        node.x = centerX + (node.x / extentX) * (width / 2 - nodeWidth / 2 - 18);
        node.y = centerY + (node.y / extentY) * (height / 2 - nodeHeight / 2 - 18);
        if (node.skill.requires.length === 0) {
            const angle = ((-150 + branches.indexOf(node.skill.branch) * 120) * Math.PI) / 180;
            node.x = centerX + Math.cos(angle) * nodeWidth * 1.3;
            node.y = centerY + Math.sin(angle) * nodeHeight * 1.8;
        }
        node.anchorX = node.x;
        node.anchorY = node.y;
    }
    // 実際の表示面積に合わせて枝を広げ、文字は縮小せずに矩形を反発させる。
    for (let iteration = 0; iteration < 1000; iteration++) {
        for (const node of positions) {
            const attraction = iteration < 200 ? 0.008 : 0;
            node.x += (node.anchorX - node.x) * attraction;
            node.y += (node.anchorY - node.y) * attraction;
            node.x = Math.max(nodeWidth / 2 + 8, Math.min(width - nodeWidth / 2 - 8, node.x));
            node.y = Math.max(nodeHeight / 2 + 8, Math.min(height - nodeHeight / 2 - 8, node.y));
            const dx = node.x - centerX,
                dy = node.y - centerY;
            if (Math.abs(dx) < nodeWidth / 2 + 36 && Math.abs(dy) < nodeHeight / 2 + 36) {
                const angle = Math.atan2(dy, dx);
                node.x += Math.cos(angle) * 2;
                node.y += Math.sin(angle) * 2;
            }
        }
        for (const node of positions) {
            if (node.skill.requires.length === 0) {
                node.x = node.anchorX;
                node.y = node.anchorY;
            }
        }
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const a = positions[i],
                    b = positions[j];
                const dx = b.x - a.x,
                    dy = b.y - a.y;
                const overlapX = nodeWidth + 12 - Math.abs(dx);
                const overlapY = nodeHeight + 14 - Math.abs(dy);
                if (overlapX <= 0 || overlapY <= 0) continue;
                const verticalBlocked =
                    Math.min(a.y, b.y) < nodeHeight * 0.7 ||
                    Math.max(a.y, b.y) > height - nodeHeight * 0.7;
                const horizontalBlocked =
                    Math.min(a.x, b.x) < nodeWidth * 0.6 ||
                    Math.max(a.x, b.x) > width - nodeWidth * 0.6;
                if (!horizontalBlocked && (overlapX < overlapY * 1.8 || verticalBlocked)) {
                    const push = overlapX * 0.45 * (dx >= 0 ? 1 : -1);
                    const aRoot = a.skill.requires.length === 0;
                    const bRoot = b.skill.requires.length === 0;
                    if (!aRoot) a.x -= push * (bRoot ? 2 : 1);
                    if (!bRoot) b.x += push * (aRoot ? 2 : 1);
                } else {
                    const push = overlapY * 0.45 * (dy >= 0 ? 1 : -1);
                    const aRoot = a.skill.requires.length === 0;
                    const bRoot = b.skill.requires.length === 0;
                    if (!aRoot) a.y -= push * (bRoot ? 2 : 1);
                    if (!bRoot) b.y += push * (aRoot ? 2 : 1);
                }
            }
        }
    }
    return {
        positions,
        nodeWidth,
        nodeHeight,
        centerX,
        centerY,
        viewBox: `0 0 ${width} ${height}`,
    };
}
