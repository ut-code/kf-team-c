import { countryMetrics } from '../metrics.ts';
import type {
    Balance,
    CountryAttributes,
    CountryState,
    CountryStateKey,
    Effect,
} from '../types.ts';

type CountryStateValues = Record<CountryStateKey, number>;

export type CountryRuleInput = {
    countryState: CountryStateValues;
    baseline: CountryAttributes['baseline'];
    serviceSupply: number;
    previousServiceSupply: number;
    influenceAllocation: number;
    defenseAllocation: number;
    networkIncoming: number;
    foothold: boolean;
    anyInfluenceFunded: boolean;
    science: boolean;
    languages: boolean;
    institutions: boolean;
    decisionUnlocked: boolean;
    networkControlUnlocked: boolean;
    spreadBonus: number;
    decisionBonus: number;
    stealthBonus: number;
    decisionSpeed: number;
    defenseResearchSpeed: number;
    awarenessDecay: number;
    expectationDecay: number;
};

export type CountryRuleResult = {
    effects: (Effect & { source: string })[];
    serviceOutage: number;
};

export function controlTransition(
    country: Pick<
        CountryState,
        | 'aiDecisionControl'
        | 'aiDefenseTechnology'
        | 'economy'
        | 'governmentCapacity'
        | 'awareness'
        | 'controlStatus'
        | 'lossDays'
    >,
    limits: Pick<
        Balance,
        'controlDecision' | 'controlCounter' | 'releaseThreshold' | 'releaseDays'
    >,
): Pick<CountryState, 'controlStatus' | 'lossDays'> {
    if (
        country.aiDecisionControl >= limits.controlDecision &&
        countryMetrics(country).aiDefenseEffectiveness <= limits.controlCounter
    )
        return { controlStatus: 'controlled', lossDays: 0 };
    const partialStatus = country.aiDecisionControl >= 5 ? 'influenced' : 'free';
    if (country.controlStatus === 'controlled') {
        const lossDays =
            country.aiDecisionControl < limits.releaseThreshold ||
            countryMetrics(country).aiDefenseEffectiveness > limits.controlCounter + 20
                ? country.lossDays + 1
                : 0;
        return {
            lossDays,
            controlStatus: lossDays >= limits.releaseDays ? partialStatus : 'controlled',
        };
    }
    return { lossDays: 0, controlStatus: partialStatus };
}

export function serviceBenefit(
    supply: number,
    infrastructure: number,
    science: boolean,
    languages: boolean,
): number {
    return (
        Math.sqrt(supply) *
        (1 + 0.5 * Number(science) + 0.2 * Number(languages)) *
        (infrastructure / 100)
    );
}

export function serviceOutage(previousSupply: number, supply: number, dependency: number): number {
    return previousSupply > 0 && supply === 0 ? dependency : 0;
}

/** 依存は業務統合後の実際のサービス提供で蓄積し、停止後もゆっくりしか解消しない。 */
export function dependencyChange(
    benefit: number,
    dependency: number,
    institutions: boolean,
): number {
    return institutions && benefit > 0
        ? benefit * 0.08 * (1 - dependency / 100)
        : -0.0005 * dependency;
}

/** 国内の施設がなくても、研究解放後は接続国で確立した影響力から介入できる。 */
export function hasInterventionAccess(
    foothold: boolean,
    networkIncoming: number,
    networkControlUnlocked: boolean,
): boolean {
    return foothold || (networkControlUnlocked && networkIncoming >= 5);
}

export function decisionEffort(
    allocation: number,
    networkIncoming: number,
    networkControlUnlocked: boolean,
    anyInfluenceFunded: boolean,
): number {
    return (
        Math.sqrt(allocation) +
        (networkControlUnlocked && anyInfluenceFunded ? networkIncoming / 25 : 0)
    );
}

export function decisionGrowth(
    dependency: number,
    control: number,
    effort: number,
    speed: number,
    bonus: number,
    resistance: number,
    accessible: boolean,
    unlocked: boolean,
): number {
    return unlocked && accessible
        ? speed * bonus * effort * resistance * (1 + dependency / 100) * (1 - control / 103)
        : 0;
}

export function economyRecovery(baseline: number, infrastructure: number, economy: number): number {
    return (baseline * (0.4 + (0.6 * infrastructure) / 100) - economy) * 0.012;
}

/** 研究成果は蓄積し、警戒が下がっても自然には失われない。 */
export function defenseTechnologyGrowth(
    technology: number,
    awareness: number,
    economy: number,
    speed: number,
): number {
    return awareness * 0.95 * (economy / 100) * speed * (1 - technology / 100);
}

export function observedActivity(
    allocation: number,
    stealth: number,
    decisionControl: number,
): number {
    return allocation * 0.006 * (1 - stealth) + Math.max(0, decisionControl - 30) * 0.001;
}

export function awarenessDecay(
    dailyDecay: number,
    defenseAllocation: number,
    foothold: boolean,
): number {
    return -dailyDecay - defenseAllocation * 0.02 - (foothold ? 0 : 0.01);
}

function effect(
    countryStateKey: CountryStateKey,
    amount: number,
    source: string,
): Effect & { source: string } {
    if (!Number.isFinite(amount)) throw new Error(`因果計算の結果が不正です: ${source}`);
    return { countryStateKey, amount, source };
}

export function evaluateCountryRules(input: CountryRuleInput): CountryRuleResult {
    const country = input.countryState;
    const benefit = serviceBenefit(
        input.serviceSupply,
        country.infrastructure,
        input.science,
        input.languages,
    );
    const outage = serviceOutage(
        input.previousServiceSupply,
        input.serviceSupply,
        country.aiDependency,
    );
    const defense = countryMetrics(country).aiDefenseEffectiveness;
    const accessible = hasInterventionAccess(
        input.foothold,
        input.networkIncoming,
        input.networkControlUnlocked,
    );
    const effort = decisionEffort(
        input.influenceAllocation,
        input.networkIncoming,
        input.networkControlUnlocked,
        input.anyInfluenceFunded,
    );
    const resistance =
        (0.3 + country.aiExpectation / 100) / (1 + defense / 40 + country.awareness / 140);
    // 復旧の規模は経済、実行効率は行政能力が担う。
    const recovery = (country.economy / 100) * (country.governmentCapacity / 100);
    return {
        serviceOutage: outage,
        effects: [
            effect('aiExpectation', benefit * 0.06, '公共サービスの成果への期待'),
            effect('aiExpectation', -input.expectationDecay, '成果への関心の時間減衰'),
            effect('aiExpectation', -outage * 0.05, 'サービス停止による期待の低下'),
            effect(
                'aiDependency',
                dependencyChange(benefit, country.aiDependency, input.institutions),
                '業務統合と代替手段の縮小',
            ),
            effect(
                'infrastructure',
                benefit * 0.015 - outage * 0.07,
                'AI支援の稼働・停止による社会への影響',
            ),
            effect('economy', benefit * 0.03 - outage * 0.1, 'AI支援による生産性と停止損失'),
            effect('aiDefenseTechnology', benefit * 0.008, '公開された能力に対する安全性研究'),
            effect(
                'aiDecisionControl',
                decisionGrowth(
                    country.aiDependency,
                    country.aiDecisionControl,
                    effort,
                    input.decisionSpeed,
                    input.decisionBonus * input.spreadBonus,
                    resistance,
                    accessible,
                    input.decisionUnlocked,
                ),
                '施設・国家間接続を経由した意思決定介入',
            ),
            effect(
                'aiDecisionControl',
                -country.aiDecisionControl * (0.0008 + defense * 0.000009),
                '人間による権限の再確認と対AI防御',
            ),
            effect(
                'infrastructure',
                (input.baseline.infrastructure - country.infrastructure) * 0.012 * recovery,
                '経済と行政能力に応じたインフラ復旧',
            ),
            effect(
                'economy',
                economyRecovery(input.baseline.economy, country.infrastructure, country.economy),
                'インフラによる経済稼働',
            ),
            effect(
                'governmentCapacity',
                (input.baseline.governmentCapacity - country.governmentCapacity) * 0.008,
                '行政組織の復旧',
            ),
            effect(
                'aiDefenseTechnology',
                defenseTechnologyGrowth(
                    country.aiDefenseTechnology,
                    country.awareness,
                    country.economy,
                    input.defenseResearchSpeed,
                ),
                '警戒と経済に応じた対AI技術研究',
            ),
            effect(
                'awareness',
                observedActivity(
                    accessible && input.decisionUnlocked ? input.influenceAllocation : 0,
                    input.stealthBonus,
                    country.aiDecisionControl,
                ),
                '国家での介入活動の観測',
            ),
            effect(
                'awareness',
                awarenessDecay(input.awarenessDecay, input.defenseAllocation, input.foothold),
                '潜伏・監視・報告の風化',
            ),
        ],
    };
}
