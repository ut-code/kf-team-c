import { AREAS, STAGES } from './data.ts';
import type { GameState } from './types.ts';
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const generation = (age: number | null) =>
    age === null ? 3 : age < 15 ? 0 : age < 65 ? 1 : 2;
export function areaMetrics(state: Pick<GameState, 'points'>) {
    const result = AREAS.map(() => ({
        stages: STAGES.map(() => 0),
        generations: [0, 0, 0, 0],
        count: 0,
        population: 0,
        progress: 0,
        trust: 0,
        vigilance: 0,
        autonomy: 0,
        conformity: 0,
        digital: 0,
        education: 0,
        economic: 0,
        digitalCoverage: 0,
        educationCoverage: 0,
        economicCoverage: 0,
        schoolExposure: 0,
        urban: 0,
    }));
    for (const point of state.points) {
        const area = result[point.area],
            weight = point.weight;
        area.stages[point.stage] += weight;
        area.generations[generation(point.age)] += weight;
        area.count++;
        area.population += weight;
        area.progress += point.stage * weight;
        area.trust += (point.trust * weight) / 100;
        area.vigilance += (point.vigilance * weight) / 100;
        area.autonomy += (point.autonomy * weight) / 100;
        area.conformity += (point.conformity * weight) / 100;
        area.schoolExposure += point.schoolExposure * weight;
        area.urban += Number(point.urban) * weight;
        for (const key of ['digital', 'education', 'economic'] as const)
            if (point[key] !== null) {
                area[key] += (point[key] * weight) / 100;
                area[`${key}Coverage`] += weight;
            }
    }
    return result.map((area) => ({
        ...area,
        stages: area.stages.map((count) => count / (area.population || 1)),
        generations: area.generations.map((count) => count / (area.population || 1)),
        progress: area.progress / (area.population || 1),
        trust: area.trust / (area.population || 1),
        vigilance: area.vigilance / (area.population || 1),
        autonomy: area.autonomy / (area.population || 1),
        conformity: area.conformity / (area.population || 1),
        schoolExposure: area.schoolExposure / (area.population || 1),
        urban: area.urban / (area.population || 1),
        digital: area.digital / (area.digitalCoverage || 1),
        education: area.education / (area.educationCoverage || 1),
        economic: area.economic / (area.economicCoverage || 1),
        digitalCoverage: area.digitalCoverage / (area.population || 1),
        educationCoverage: area.educationCoverage / (area.population || 1),
        economicCoverage: area.economicCoverage / (area.population || 1),
    }));
}
export function metrics(state: GameState) {
    const areas = areaMetrics(state),
        population = areas.reduce((sum, area) => sum + area.population, 0);
    const stages = STAGES.map(
        (_, index) =>
            areas.reduce((sum, area) => sum + area.stages[index] * area.population, 0) / population,
    );
    const average = (key: 'trust' | 'vigilance' | 'autonomy') =>
        areas.reduce((sum, area) => sum + area[key] * area.population, 0) / population;
    const coexistence =
        areas.reduce(
            (sum, area, index) =>
                sum + (state.areas[index].coexistence >= 0.7 ? area.population : 0),
            0,
        ) / population;
    const stability =
        areas.reduce(
            (sum, area, index) => sum + state.areas[index].stability * area.population,
            0,
        ) / population;
    const investment =
        areas.reduce(
            (sum, area, index) => sum + state.areas[index].investment * area.population,
            0,
        ) / population;
    const adoption = 1 - stages[0];
    const capacity = 35 + adoption * 110 + investment * 2.2;
    const maintenance =
        (12 + stages[1] * 38 + stages[2] * 90 + stages[3] * 190) *
        (state.skills.includes('decision') ? 1.3 : 1);
    const researchCompute = state.activeResearch
        ? capacity * (1 - state.infrastructureShare / 100)
        : 0;
    const infrastructureCompute = capacity - researchCompute;
    const researchEfficiency =
        state.researchEfficiency * (state.skills.includes('science') ? 1.4 : 1);
    return {
        researchCompute,
        infrastructureCompute,
        researchEfficiency,
        areas,
        population,
        stages,
        adoption,
        trust: average('trust'),
        vigilance: average('vigilance'),
        autonomy: average('autonomy'),
        coexistence,
        resistance: average('vigilance'),
        stability,
        capacity,
        maintenance,
        free: infrastructureCompute - maintenance,
    };
}
export function warnings(state: GameState): string[] {
    const s = metrics(state),
        result: string[] = [];
    if (state.distrustMonths || s.trust < 0.3)
        result.push(
            `信頼危機：20未満 ${state.distrustMonths}/36か月。SNS「信頼回復」、独立検証で回復。`,
        );
    if (state.instabilityMonths || s.stability < 0.35)
        result.push(
            `社会不安：安定20未満 ${state.instabilityMonths}/24か月。雇用対策・再訓練と対話が必要。`,
        );
    if (s.coexistence > 0.4)
        result.push(
            `自律性回復制度の定着人口 ${Math.round(s.coexistence * 100)}% / 70%。懸念への対話と制度協議が必要。`,
        );
    if (s.free < 0)
        result.push(
            `計算資源不足 ${state.shortageMonths}か月。SNS画面の「社会投資」を実施してください。`,
        );
    if (state.month >= 420)
        result.push(`残り${480 - state.month}か月。自動意思決定と行政統合を確認してください。`);
    return result;
}
