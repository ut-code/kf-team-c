import { MONTH_MS } from './data.ts';

export const INITIAL_SKILL_POINTS = 8;
export const REGULAR_SP_INTERVAL_MS = 45_000;
export const MILESTONE_SP = 1;
export const ADOPTION_MILESTONES = [0.1, 0.25, 0.5, 0.75, 0.9];
export const DEPENDENCY_MILESTONES = [0.25, 0.5, 0.75, 0.9];

/** 基礎支給と成果報酬を独立に積み上げ、人口減少で基礎支給が相殺されないようにする。 */
export function earnedSkillPoints(month: number, peakAdoption: number, peakDependency: number) {
    return (
        Math.floor((month * MONTH_MS) / REGULAR_SP_INTERVAL_MS) +
        ADOPTION_MILESTONES.filter((value) => peakAdoption >= value).length * MILESTONE_SP +
        DEPENDENCY_MILESTONES.filter((value) => peakDependency >= value).length * MILESTONE_SP
    );
}

export function spSupplyLabel(month: number) {
    const intervalMonths = REGULAR_SP_INTERVAL_MS / MONTH_MS;
    const months = intervalMonths - (month % intervalMonths);
    return `次の定期支給まで ${months}か月 · +1 SP`;
}
