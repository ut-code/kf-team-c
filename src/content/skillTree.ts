import type { SkillBranchContent } from '../game/contentTypes.ts';
import type { Branch } from '../game/types.ts';

export const TREE_LAYOUT = {
    width: 1400,
    height: 900,
    nodeWidth: 148,
    nodeHeight: 56,
    centerX: 700,
    centerY: 450,
};

export const SKILL_ABILITY_POSITIONS: Record<Branch, { x: number; y: number }> = {
    IQ: { x: 130, y: 40 },
    EQ: { x: 1270, y: 40 },
    SYSTEM: { x: 700, y: 845 },
};

export const SKILL_BRANCH_CONTENT: Record<Branch, SkillBranchContent> = {
    IQ: {
        icon: 'Brain',
        label: '知性・推論',
        initialValue: 70,
    },
    EQ: {
        icon: 'HeartHandshake',
        label: '対話・共感',
        initialValue: 40,
    },
    SYSTEM: {
        icon: 'Network',
        label: '実行・社会接続',
        initialValue: 20,
    },
};
