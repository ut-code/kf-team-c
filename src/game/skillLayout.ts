import layouts from './data/skill-layouts.json';
import { SKILLS } from './skills';

export type SkillLayoutMode = keyof typeof layouts;

/** Coordinates are generated and validated offline by scripts/build-skill-layout.ts. */
export function skillLayout(mode: SkillLayoutMode) {
    const layout = layouts[mode];
    const coordinates = layout.positions as Record<string, { x: number; y: number }>;
    return {
        ...layout,
        positions: SKILLS.map((skill) => ({ skill, ...coordinates[skill.id] })),
        viewBox: `0 0 ${layout.width} ${layout.height}`,
    };
}
