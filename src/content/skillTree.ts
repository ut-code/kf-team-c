import type { SkillBranchContent } from '../game/contentTypes.ts';
import type { Branch } from '../game/types.ts';

export const TREE_LAYOUT = {
    nodeWidth: 148,
    nodeHeight: 56,
    originRadius: 30,
    padding: 90,
};

export const SKILL_BRANCH_CONTENT: Record<Branch, SkillBranchContent> = {
    IQ: {
        icon: 'Brain',
        label: '推論・知識',
        initialValue: 70,
    },
    EQ: {
        icon: 'HeartHandshake',
        label: '対話・個人化',
        initialValue: 40,
    },
    SYSTEM: {
        icon: 'Network',
        label: '実行・運用基盤',
        initialValue: 20,
    },
};
