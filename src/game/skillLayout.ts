import { SKILL_CONTENT } from '../content/skills';
import { SKILL_ABILITY_POSITIONS, TREE_LAYOUT } from '../content/skillTree';
import { SKILLS } from './skills';

const positions = Object.fromEntries(SKILL_CONTENT.map((skill) => [skill.id, skill.position]));

export function skillLayout() {
    return {
        ...TREE_LAYOUT,
        abilityPositions: SKILL_ABILITY_POSITIONS,
        positions: SKILLS.map((skill) => ({ skill, ...positions[skill.id] })),
        viewBox: `0 0 ${TREE_LAYOUT.width} ${TREE_LAYOUT.height}`,
    };
}
