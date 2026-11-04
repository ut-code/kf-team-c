import { SKILLS } from './skills';
import type { Branch } from './types';

type Point = { x: number; y: number };

// 手動配置。座標はカードの中心。盤面の縦横比を画面に寄せて読みやすさを保つ。
// 起点からIQは左上、EQは右上、SYSTEMは下へ分かれ、各枝を外周へ広げる。
const layout = {
    width: 1400,
    height: 900,
    nodeWidth: 148,
    nodeHeight: 56,
    centerX: 700,
    centerY: 450,
};

const positions: Record<string, Point> = {
    // IQ：知識の枝は上へ、検証の枝は左へ。末端を一列にせず扇状に広げる。
    reason: { x: 545, y: 360 },
    knowledge: { x: 415, y: 260 },
    tutor: { x: 490, y: 155 },
    curriculum: { x: 650, y: 110 },
    science: { x: 255, y: 230 },
    discovery: { x: 95, y: 175 },
    verification: { x: 365, y: 400 },
    audit: { x: 205, y: 440 },
    certified: { x: 95, y: 520 },
    privacy: { x: 175, y: 330 },

    // EQ：右上の余白を使い、対話から伴走まで緩やかに弧を描く。
    conversation: { x: 855, y: 360 },
    personalize: { x: 940, y: 245 },
    memory: { x: 1050, y: 155 },
    companion: { x: 1265, y: 115 },

    // SYSTEM：下で左右に分岐し、端末側と社会基盤側を盤面の両端へ展開する。
    lightweight: { x: 700, y: 625 },
    offline: { x: 495, y: 650 },
    mobile: { x: 245, y: 600 },
    distributed: { x: 245, y: 775 },
    automation: { x: 875, y: 665 },
    integration: { x: 1040, y: 650 },
    decision: { x: 1205, y: 590 },
    autonomous: { x: 1305, y: 480 },
    platform: { x: 950, y: 780 },
    public: { x: 1115, y: 800 },
    backbone: { x: 1280, y: 790 },
};

// 能力値も盤面内の固定座標に置き、各系統の先で読めるようにする。
const abilityPositions: Record<Branch, Point> = {
    IQ: { x: 130, y: 40 },
    EQ: { x: 1270, y: 40 },
    SYSTEM: { x: 700, y: 845 },
};

export function skillLayout() {
    return {
        ...layout,
        abilityPositions,
        positions: SKILLS.map((skill) => ({ skill, ...positions[skill.id] })),
        viewBox: `0 0 ${layout.width} ${layout.height}`,
    };
}
