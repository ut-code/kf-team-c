import type { Attribute, Balance, CountryState, Effect } from '../types.ts';

type CountryAttributes = Record<Attribute, number>;
type Baseline = Pick<CountryAttributes, 'infrastructure' | 'economy' | 'politicalControl' | 'aiAcceptance'>;

export type CountryRuleInput = {
    attributes: CountryAttributes;
    baseline: Baseline;
    serviceSupply: number;
    previousServiceSupply: number;
    infiltrationAllocation: number;
    defenseAllocation: number;
    networkIncoming: number;
    foothold: boolean;
    anyInfiltrationFunded: boolean;
    science: boolean;
    languages: boolean;
    institutions: boolean;
    decisionUnlocked: boolean;
    networkControlUnlocked: boolean;
    spreadBonus: number;
    decisionBonus: number;
    stealthBonus: number;
    infiltrationSpeed: number;
    spillover: number;
    decisionSpeed: number;
    counterGrowth: number;
    awarenessDecay: number;
};

export type CountryRuleResult = {
    effects: (Effect & { source: string })[];
    serviceOutage: number;
};

export function controlTransition(
    country: Pick<
        CountryState,
        'aiInfiltration' | 'aiDecisionControl' | 'aiCountermeasure' | 'controlStatus' | 'lossDays'
    >,
    limits: Pick<
        Balance,
        | 'controlInfiltration'
        | 'controlDecision'
        | 'controlCounter'
        | 'releaseThreshold'
        | 'releaseDays'
    >,
): Pick<CountryState, 'controlStatus' | 'lossDays'> {
    if (
        country.aiInfiltration >= limits.controlInfiltration &&
        country.aiDecisionControl >= limits.controlDecision &&
        country.aiCountermeasure <= limits.controlCounter
    )
        return { controlStatus: 'controlled', lossDays: 0 };
    if (country.controlStatus === 'controlled') {
        const lossDays =
            country.aiInfiltration < limits.releaseThreshold ||
            country.aiDecisionControl < limits.releaseThreshold ||
            country.aiCountermeasure > limits.controlCounter + 20
                ? country.lossDays + 1
                : 0;
        return {
            lossDays,
            controlStatus:
                lossDays >= limits.releaseDays
                    ? country.aiInfiltration >= 5
                        ? 'infiltrated'
                        : 'free'
                    : 'controlled',
        };
    }
    return {
        lossDays: country.lossDays,
        controlStatus: country.aiInfiltration >= 5 ? 'infiltrated' : 'free',
    };
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

export function adoptionChange(benefit: number, acceptance: number, adoption: number): number {
    return benefit * 0.12 * (0.4 + acceptance / 100) * (1 - adoption / 100) - adoption * 0.0007;
}

export function dependencyChange(
    adoption: number,
    dependency: number,
    supply: number,
    institutions: boolean,
): number {
    return institutions && supply > 0 && adoption >= 25
        ? Math.max(0, adoption - dependency) * 0.003 * Math.sqrt(supply)
        : -0.0005 * dependency;
}

export function infiltrationResistance(
    acceptance: number,
    adoption: number,
    countermeasure: number,
    awareness: number,
): number {
    return (
        (0.3 + acceptance / 100 + adoption / 300) /
        (1 + countermeasure / 40 + awareness / 140)
    );
}

export function fundedInfiltration(
    allocation: number,
    speed: number,
    spreadBonus: number,
    resistance: number,
    infiltration: number,
): number {
    return allocation * speed * spreadBonus * resistance * (1 - infiltration / 105);
}

export function networkSpillover(
    incoming: number,
    infiltration: number,
    speed: number,
    spreadBonus: number,
    resistance: number,
    funded: boolean,
): number {
    return funded
        ? Math.max(0, incoming - infiltration * 0.8) * speed * spreadBonus * resistance
        : 0;
}

export function infiltrationDecay(infiltration: number, countermeasure: number): number {
    return -1 * infiltration * (0.0002 + countermeasure * 0.000009);
}

export function decisionEffort(
    allocation: number,
    networkIncoming: number,
    networkControlUnlocked: boolean,
    anyInfiltrationFunded: boolean,
): number {
    return (
        (allocation > 0 ? Math.sqrt(allocation) : 0) +
        (networkControlUnlocked && anyInfiltrationFunded ? networkIncoming / 25 : 0)
    );
}

export function decisionGrowth(
    infiltration: number,
    dependency: number,
    control: number,
    effort: number,
    speed: number,
    bonus: number,
    unlocked: boolean,
): number {
    return unlocked && infiltration >= 25
        ? speed *
              bonus *
              effort *
              (infiltration / 100) *
              (1 + dependency / 100) *
              (1 - control / 103)
        : 0;
}

export function economyRecovery(
    baseline: number,
    infrastructure: number,
    economy: number,
): number {
    return (baseline * (0.4 + (0.6 * infrastructure) / 100) - economy) * 0.012;
}

export function countermeasureTarget(
    awareness: number,
    economy: number,
    politicalControl: number,
    decisionControl: number,
): number {
    return (
        8 +
        awareness *
            0.95 *
            (economy / 100) *
            (politicalControl / 100) *
            (1 - decisionControl / 110)
    );
}

export function observedActivity(
    allocation: number,
    stealth: number,
    decisionControl: number,
): number {
    return (
        allocation * 0.006 * (1 - stealth) +
        (decisionControl > 30 ? (decisionControl - 30) * 0.001 : 0)
    );
}

export function awarenessDecay(
    dailyDecay: number,
    defenseAllocation: number,
    foothold: boolean,
): number {
    return -dailyDecay - defenseAllocation * 0.02 - (foothold ? 0 : 0.01);
}

function effect(metric: Attribute, amount: number, source: string): Effect & { source: string } {
    if (!Number.isFinite(amount)) throw new Error(`因果計算の結果が不正です: ${source}`);
    return { metric, amount, source };
}

export function evaluateCountryRules(input: CountryRuleInput): CountryRuleResult {
    const attributes = input.attributes;
    const benefit = serviceBenefit(
        input.serviceSupply,
        attributes.infrastructure,
        input.science,
        input.languages,
    );
    const outage = serviceOutage(
        input.previousServiceSupply,
        input.serviceSupply,
        attributes.aiDependency,
    );
    const resistance = infiltrationResistance(
        attributes.aiAcceptance,
        attributes.aiAdoption,
        attributes.aiCountermeasure,
        attributes.awareness,
    );
    const effort = decisionEffort(
        input.infiltrationAllocation,
        input.networkIncoming,
        input.networkControlUnlocked,
        input.anyInfiltrationFunded,
    );
    const counterTarget = countermeasureTarget(
        attributes.awareness,
        attributes.economy,
        attributes.politicalControl,
        attributes.aiDecisionControl,
    );
    const activity = observedActivity(
        input.infiltrationAllocation,
        input.stealthBonus,
        attributes.aiDecisionControl,
    );
    return {
        serviceOutage: outage,
        effects: [
            effect(
                'aiAdoption',
                adoptionChange(benefit, attributes.aiAcceptance, attributes.aiAdoption),
                '公共サービスの実績と導入継続',
            ),
            effect(
                'aiDependency',
                dependencyChange(
                    attributes.aiAdoption,
                    attributes.aiDependency,
                    input.serviceSupply,
                    input.institutions,
                ),
                '業務統合と代替手段の縮小',
            ),
            effect(
                'infrastructure',
                benefit * 0.015 - outage * 0.07,
                'AI支援の稼働・停止による社会への影響',
            ),
            effect('economy', benefit * 0.03 - outage * 0.1, 'AI支援による生産性と停止損失'),
            effect('aiAcceptance', benefit * 0.025, 'サービスへの評価'),
            effect('aiCountermeasure', benefit * 0.008, '公開された能力に対する安全性研究'),
            effect(
                'aiInfiltration',
                fundedInfiltration(
                    input.infiltrationAllocation,
                    input.infiltrationSpeed,
                    input.spreadBonus,
                    resistance,
                    attributes.aiInfiltration,
                ),
                '計算資源による浸透',
            ),
            effect(
                'aiInfiltration',
                networkSpillover(
                    input.networkIncoming,
                    attributes.aiInfiltration,
                    input.spillover,
                    input.spreadBonus,
                    resistance,
                    input.anyInfiltrationFunded,
                ),
                '接続国家からの波及',
            ),
            effect(
                'aiInfiltration',
                infiltrationDecay(attributes.aiInfiltration, attributes.aiCountermeasure),
                '接続の自然減衰・対AI検疫',
            ),
            effect(
                'aiDecisionControl',
                decisionGrowth(
                    attributes.aiInfiltration,
                    attributes.aiDependency,
                    attributes.aiDecisionControl,
                    effort,
                    input.decisionSpeed,
                    input.decisionBonus,
                    input.decisionUnlocked,
                ),
                '意思決定モデルによる介入',
            ),
            effect('aiDecisionControl', -0.0008 * attributes.aiDecisionControl, '人間による権限の再確認'),
            effect(
                'infrastructure',
                (input.baseline.infrastructure - attributes.infrastructure) * 0.012,
                'インフラの復旧と基準回帰',
            ),
            effect(
                'economy',
                economyRecovery(input.baseline.economy, attributes.infrastructure, attributes.economy),
                'インフラによる経済稼働',
            ),
            effect(
                'politicalControl',
                (input.baseline.politicalControl - attributes.politicalControl) * 0.008,
                '行政組織の復旧',
            ),
            effect(
                'aiAcceptance',
                (input.baseline.aiAcceptance - attributes.aiAcceptance) * 0.003,
                '社会受容の基準回帰',
            ),
            effect(
                'aiCountermeasure',
                (counterTarget - attributes.aiCountermeasure) * input.counterGrowth,
                '警戒・経済・統制に応じた対策投資',
            ),
            effect('awareness', activity, '国家での介入活動の観測'),
            effect(
                'awareness',
                awarenessDecay(input.awarenessDecay, input.defenseAllocation, input.foothold),
                '潜伏・監視・報告の風化',
            ),
        ],
    };
}
