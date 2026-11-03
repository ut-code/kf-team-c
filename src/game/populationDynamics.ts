import { canBecomeStructural } from './interventions.ts';
import { clamp, type metrics } from './metrics.ts';
import type { GameState, Population } from './types.ts';

type WorldMetrics = ReturnType<typeof metrics>;
type RandomSource = () => number;
const MONTHS_IN_YEAR = 12;
const EDUCATION_EXPOSURE_MONTHS = 180;
const MISSING_STATISTIC_MODEL_VALUE = 50;

function advanceGeneration(point: Population, state: GameState, random: RandomSource) {
    const area = state.areas[point.area];
    const previousAge = point.age;
    if (point.age !== null) point.age += 1 / MONTHS_IN_YEAR;
    if (point.age !== null && point.age >= 90) {
        // 出生死亡の予測ではなく、代表人口を固定した世代交代モデル。
        point.age = 0;
        point.field = 0;
        point.stage = 0;
        point.schoolExposure = 0;
        point.baseline = {
            trust: 44 + area.institutions[0] * 2,
            autonomy: 85,
            conformity: 45,
            vigilance: 32,
        };
        Object.assign(point, point.baseline);
    }
    if (point.age !== null && point.age < 20) {
        const schoolIntegration = state.skills.includes('school') ? area.institutions[0] / 4 : 0;
        point.schoolExposure = clamp(
            point.schoolExposure + schoolIntegration / EDUCATION_EXPOSURE_MONTHS,
        );
        const education = (point.education ?? MISSING_STATISTIC_MODEL_VALUE) / 100;
        point.baseline.conformity = clamp(
            point.baseline.conformity + point.schoolExposure * 0.018,
            0,
            100,
        );
        point.baseline.autonomy = clamp(
            point.baseline.autonomy - point.schoolExposure * 0.012 + education * 0.003,
            0,
            100,
        );
    }
    if (previousAge !== null && previousAge < 15 && point.age !== null && point.age >= 15) {
        point.field = point.employment !== null && random() < point.employment ? 1 : 2;
        point.baseline.trust = clamp(point.baseline.trust + point.schoolExposure * 10, 0, 100);
    }
    if (point.age !== null && point.age >= 65) point.field = 3;
}

function socialEnvironment(point: Population, previous: GameState, summary: WorldMetrics) {
    const area = previous.areas[point.area];
    const neighborCount = Math.max(1, point.neighbors.length);
    const networkCount = Math.max(1, area.networks.length);
    return {
        dependentNeighbors:
            point.neighbors.reduce((sum, id) => sum + Number(previous.points[id].stage >= 2), 0) /
            neighborCount,
        neighborConformity:
            point.neighbors.reduce((sum, id) => sum + previous.points[id].conformity, 0) /
            neighborCount,
        informationPressure:
            area.networks.reduce(
                (sum, network) =>
                    sum + (summary.areas[network.area].progress / 3) * network.information,
                0,
            ) / networkCount,
        incomingConformity:
            area.networks.reduce(
                (sum, network) => sum + summary.areas[network.area].conformity * network.migration,
                0,
            ) / networkCount,
    };
}

type SocialEnvironment = ReturnType<typeof socialEnvironment>;
function updatePsychology(
    point: Population,
    state: GameState,
    summary: WorldMetrics,
    social: SocialEnvironment,
    random: RandomSource,
) {
    const area = state.areas[point.area];
    const local = summary.areas[point.area];
    const iq = state.abilities.IQ / 100;
    const eq = state.abilities.EQ / 100;
    const outage = state.shortageMonths >= 3;
    const qualityEvidence = (iq - 0.35) * 0.12 + (eq - 0.35) * 0.1;
    const errorProbability = 0.018 * (1 - iq) * (state.skills.includes('reason') ? 0.7 : 1);
    const judgmentError = point.stage > 0 && random() < errorProbability;
    const systemFailure = point.stage > 0 && state.abilities.SYSTEM < 30 && random() < 0.012;
    const trustDamage =
        (judgmentError ? (state.skills.includes('opaque') ? 5 : 2.5) : 0) +
        (systemFailure ? 1.5 : 0);
    const trustRegression =
        state.skills.includes('memory') && point.trust > point.baseline.trust ? 0.01125 : 0.025;
    point.trust = clamp(
        point.trust +
            qualityEvidence -
            trustDamage -
            (outage ? 0.4 : 0) +
            trustRegression * (point.baseline.trust - point.trust) +
            (random() - 0.5) * 0.18,
        0,
        100,
    );
    const vigilancePressure =
        Math.max(0, local.stages[2] + local.stages[3] - eq) * 0.08 +
        (state.skills.includes('oversight') ? 0.045 : 0);
    point.vigilance = clamp(
        point.vigilance +
            vigilancePressure +
            (judgmentError ? 1.4 : 0) +
            (systemFailure ? 0.8 : 0) +
            (outage ? 0.2 : 0) +
            0.02 * (point.baseline.vigilance - point.vigilance),
        0,
        100,
    );
    const education = (point.education ?? MISSING_STATISTIC_MODEL_VALUE) / 100;
    const independentVerification = education * (1 - point.schoolExposure * 0.65);
    const dependencyErosion =
        point.stage >= 2 ? 0.09 * (state.skills.includes('nudge') ? 1.5 : 1) : 0;
    point.autonomy = clamp(
        point.autonomy +
            0.02 * (point.baseline.autonomy - point.autonomy) +
            area.coexistence * 0.1 +
            independentVerification * 0.035 -
            dependencyErosion,
        0,
        100,
    );
    point.conformity = clamp(
        point.conformity +
            0.02 * (point.baseline.conformity - point.conformity) +
            (social.dependentNeighbors + social.informationPressure) * 0.04 +
            (social.neighborConformity - point.conformity) * 0.001,
        0,
        100,
    );
    // 移動ネットワークは人口の作り直しではなく、判断習慣の緩やかな伝播を表す。
    point.baseline.conformity = clamp(
        point.baseline.conformity +
            (social.incomingConformity * 100 - point.baseline.conformity) * 0.0001,
        0,
        100,
    );
}

function transitionStage(
    point: Population,
    state: GameState,
    social: SocialEnvironment,
    random: RandomSource,
) {
    const area = state.areas[point.area];
    const has = (skill: string) => state.skills.includes(skill);
    const education = (point.education ?? MISSING_STATISTIC_MODEL_VALUE) / 100;
    const digital = (point.digital ?? MISSING_STATISTIC_MODEL_VALUE) / 100;
    const economic = (point.economic ?? MISSING_STATISTIC_MODEL_VALUE) / 100;
    const institution = area.institutions[point.field] / 4;
    const interventionPressure =
        Math.min(1.5, area.momentum) *
        (0.65 + social.dependentNeighbors * 0.6 + social.informationPressure * 0.25) *
        (0.55 + point.conformity / 100) *
        (0.5 + point.social / 100) *
        (1 + economic * 0.15);
    const recoveryProbability =
        clamp((point.vigilance / 100 - 0.68) * 0.015, 0, 0.02) +
        Math.max(0, area.coexistence - 0.2) * 0.015 +
        (state.shortageMonths >= 3 ? 0.006 : 0);
    if (point.stage > 0 && random() < recoveryProbability * (0.6 + point.autonomy / 100)) {
        point.stage = (point.stage - 1) as Population['stage'];
        return;
    }
    if (point.stage === 0) {
        const adoptionProbability =
            (0.002 + digital * 0.009 + education * 0.003 + institution * area.momentum * 0.02) *
            (0.55 + state.abilities.IQ / 100 + state.abilities.EQ / 100) *
            (0.6 + point.trust / 100);
        if (random() < adoptionProbability) point.stage = 1;
    } else if (point.stage === 1) {
        // スキルや時間経過だけでは大きく進まない。制度と介入の履歴が必要。
        const baseProbability =
            0.00003 + (institution > 0.18 ? 0.014 * interventionPressure * institution : 0);
        const skillMultiplier =
            (has('optimize') ? 1.3 : 1) *
            (has('nudge') ? 1.5 : 1) *
            (point.field === 1 && has('forecast') ? 1.3 : 1);
        const independentVerification = education * (1 - point.schoolExposure * 0.65);
        const probability =
            baseProbability *
            skillMultiplier *
            (0.45 + point.trust / 100) *
            (1 - independentVerification * 0.2) *
            (point.urban ? 1.2 : 0.9);
        if (random() < probability) point.stage = 2;
    } else if (point.stage === 2 && canBecomeStructural(state, point)) {
        const skillMultiplier =
            1.5 *
            (has('oversight') ? 1.8 : 1) *
            (has('opaque') ? 1.4 : 1) *
            (has('transparent') ? 0.75 : 1);
        if (
            random() <
            0.018 * interventionPressure * institution * skillMultiplier * (1 - area.coexistence)
        )
            point.stage = 3;
    }
}

export function advancePopulation(
    state: GameState,
    previous: GameState,
    summary: WorldMetrics,
    random: RandomSource,
) {
    let forwardPopulation = 0;
    let backwardPopulation = 0;
    for (const point of state.points) {
        const previousStage = previous.points[point.id].stage;
        advanceGeneration(point, state, random);
        const social = socialEnvironment(point, previous, summary);
        updatePsychology(point, state, summary, social, random);
        transitionStage(point, state, social, random);
        point.progress = point.stage;
        if (point.stage > previousStage) forwardPopulation += point.weight;
        if (point.stage < previousStage) backwardPopulation += point.weight;
    }
    return { forwardPopulation, backwardPopulation };
}
