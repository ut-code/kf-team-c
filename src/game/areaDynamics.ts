import { clamp, type metrics } from './metrics.ts';
import type { GameState } from './types.ts';

function fieldCapability(field: number, state: GameState) {
    const { IQ, EQ, SYSTEM } = state.abilities;
    return [IQ, (IQ + SYSTEM) / 2, EQ, (IQ + EQ) / 2, SYSTEM][field] / 100;
}
function fieldUnlocked(field: number, state: GameState) {
    return state.skills.includes(
        ['knowledge', 'automation', 'personalize', 'public', 'public'][field],
    );
}
export function advanceAreas(
    state: GameState,
    previous: GameState,
    summary: ReturnType<typeof metrics>,
) {
    const outage = state.shortageMonths >= 3;
    state.areas.forEach((area, index) => {
        const local = summary.areas[index];
        const neighboringMomentum =
            area.networks.reduce((sum, network) => {
                const contact = (network.economy + network.information + network.migration) / 3;
                return sum + previous.areas[network.area].momentum * contact;
            }, 0) / Math.max(1, area.networks.length);
        area.momentum = clamp(area.momentum * 0.992 + neighboringMomentum * 0.012, 0, 1.8);
        const unrest =
            Math.max(0, local.vigilance - 0.6) *
            (0.0018 + local.stages[2] * 0.003 + local.stages[3] * 0.004);
        area.stability = clamp(
            area.stability +
                (0.76 - area.stability) * 0.006 -
                unrest -
                (outage ? 0.005 : 0) -
                (state.skills.includes('oversight') ? 0.0006 : 0),
        );
        area.coexistence = clamp(
            area.coexistence +
                Math.max(0, local.vigilance - 0.62) * 0.004 +
                Math.max(0, 0.3 - local.trust) * 0.006 +
                area.reform * 0.0004 -
                (area.campaignUntil > state.month ? 0.001 : 0),
        );
        for (let field = 0; field < 5; field++) {
            const forecastBoost = state.skills.includes('forecast') ? 1.3 : 1;
            const laborBoost = field === 1 ? forecastBoost * (1 + local.schoolExposure * 0.4) : 1;
            const educationToLabor = area.institutions[0] * local.schoolExposure * 0.0004;
            const servicesToAdministration =
                (area.institutions[1] + area.institutions[3]) * 0.00015;
            const spillover =
                field === 1 ? educationToLabor : field === 4 ? servicesToAdministration : 0;
            const integrationGrowth = fieldUnlocked(field, state)
                ? area.momentum * 0.008 * fieldCapability(field, state) * laborBoost
                : 0;
            area.institutions[field] = clamp(
                area.institutions[field] +
                    integrationGrowth +
                    spillover -
                    (area.coexistence > 0.6 ? 0.003 : 0) -
                    (outage ? 0.0015 : 0),
                0,
                4,
            );
        }
    });
}
