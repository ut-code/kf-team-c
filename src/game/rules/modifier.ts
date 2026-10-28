import type { Modifier, Skill } from '../types.ts';

export function modifiersForSkills(researched: readonly string[], skills: readonly Skill[]): Modifier {
    const modifiers: Modifier = {
        hack: 1,
        compute: 1,
        research: 1,
        spread: 1,
        decision: 1,
        stealth: 0,
        defense: 1,
        parallel: 1,
    };
    skills.filter((skill) => researched.includes(skill.id)).forEach((skill) => {
        Object.entries(skill.bonuses).forEach(([key, value]) => {
            modifiers[key as keyof Modifier] += value;
        });
    });
    return modifiers;
}
