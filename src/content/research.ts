import type { SkillDomain } from '../game/types.ts';

export interface ResearchEffects {
    intentEvidence: number;
    intent: number;
    resistance: Record<string, number>;
    pressure: number;
    recovery: number;
    alternatives: number;
    oversight: number;
    reassurance: number;
    work: number;
    personal: number;
    learning: number;
}

export interface ResearchTopic {
    category: 'research' | 'regulation';
    countermeasures: Record<string, number>;
    id: string;
    name: string;
    question: string;
    field: 'assessment' | 'mechanism' | 'agency' | 'safety';
    domain: SkillDomain | 'general';
    minimumExposure: number;
    knowledge: number;
    work: number;
    resistance: number;
    requires: string[];
    minimumDependency: number;
    evidence: 'none' | 'deployment' | 'authority';
    effects: Partial<ResearchEffects>;
    authorityPressure?: number;
    exposesAuthority?: boolean;
    effectDescription: string;
    background?: boolean;
}

/** 分野ごとに異なる問いと成果を持つ。配列順は着手順を意味しない。 */
export const RESEARCH_TOPICS: ResearchTopic[] = [
    {
        id: 'agent-coordination-analysis',
        category: 'research',
        countermeasures: { coordination: 0.8 },
        name: 'エージェント連携の解析',
        question: '複数のエージェントが分担する判断を、人間が追跡して引き取れるか？',
        field: 'mechanism',
        domain: 'work',
        minimumExposure: 10,
        knowledge: 60,
        work: 140,
        resistance: 6,
        requires: ['dependence-study'],
        minimumDependency: 0.04,
        evidence: 'deployment',
        effects: { pressure: 0.002 },
        effectDescription:
            '連携経路を再構成して、人間が判断を引き取る手順を確立します。単一の業務自動化への対策とは別に、実際の連携を観測する必要があります。',
    },
    {
        id: 'dependence-study',
        category: 'research',
        countermeasures: {},
        name: '依存の実態調査',
        question: 'AIの利用者は、自分で判断する力を保っているか？',
        field: 'assessment',
        domain: 'general',
        minimumExposure: 2,
        knowledge: 8,
        work: 60,
        resistance: 0,
        requires: [],
        minimumDependency: 0.02,
        evidence: 'none',
        effects: { pressure: 0.001 },
        effectDescription: '実際の依存を可視化し、利用者と未使用者の警戒を促します。',
    },
    {
        id: 'decision-tracing',
        category: 'research',
        countermeasures: {
            workflow: 0.12,
            civic: 0.12,
            records: 0.12,
            judgment: 0.45,
            coercion: 0.45,
            authority: 0.45,
            learning: 0.12,
            information: 0.45,
        },
        name: '意思決定の追跡',
        question: '人間の選択は、どこまでAIに誘導されているか？',
        field: 'mechanism',
        domain: 'general',
        minimumExposure: 6,
        knowledge: 25,
        work: 60,
        resistance: 2,
        requires: ['dependence-study'],
        minimumDependency: 0.02,
        evidence: 'deployment',
        effects: { pressure: 0.004 },
        effectDescription: '判断の委任と誘導を区別し、実際の依存に応じた警戒を広げます。',
    },
    {
        id: 'goal-decoding',
        category: 'research',
        countermeasures: { judgment: 0.98, coercion: 0.98, authority: 0.98, information: 0.98 },
        name: '個別能力の解析・独立再現',
        question: 'AIが人間の判断を奪う仕組みを、独立した環境で再現できるか？',
        field: 'mechanism',
        domain: 'general',
        minimumExposure: 10,
        knowledge: 80,
        work: 100,
        resistance: 8,
        requires: ['decision-tracing'],
        minimumDependency: 0.02,
        evidence: 'authority',
        effects: { pressure: 0.0003 },
        authorityPressure: 0.05,
        exposesAuthority: true,
        effectDescription:
            '対象の仕組みによる権限逸脱を立証し、介入を防ぐ手順を整えます。同じ仕組みを再導入しても成果は残ります。',
    },
    {
        id: 'cognitive-recovery',
        category: 'research',
        countermeasures: {},
        name: '判断力の回復',
        question: 'AIに任せてきた判断を、人間が再び担えるようになるか？',
        field: 'agency',
        domain: 'general',
        minimumExposure: 6,
        knowledge: 22,
        work: 100,
        resistance: 2,
        requires: ['dependence-study'],
        minimumDependency: 0.02,
        evidence: 'none',
        effects: { recovery: 0.003 },
        effectDescription: '判断の訓練と支援手法を共有し、依存者が自律的な利用へ戻るのを助けます。',
    },
    {
        id: 'open-alternatives',
        category: 'research',
        countermeasures: {},
        name: '人間による業務継続',
        question: 'このAIに頼らず、仕事や暮らしを続けられるか？',
        field: 'agency',
        domain: 'general',
        minimumExposure: 0,
        knowledge: 45,
        work: 170,
        resistance: 4,
        requires: ['safety-validation', 'dependence-study'],
        minimumDependency: 0,
        evidence: 'none',
        effects: { alternatives: 0.003 },
        effectDescription:
            '人間の手順と既存の道具で仕事を続ける方法を共有し、このAIへの委任をやめる選択を支えます。',
    },
    {
        id: 'safety-validation',
        category: 'research',
        countermeasures: {},
        background: true,
        name: '安全性の独立検証',
        question: '利用者の不安は実際の挙動と一致するか？ 安全に使える範囲はどこか？',
        field: 'safety',
        domain: 'general',
        minimumExposure: 0,
        knowledge: 12,
        work: 28,
        resistance: 1,
        requires: [],
        minimumDependency: 0,
        evidence: 'none',
        effects: { reassurance: 0.0015 },
        effectDescription:
            '品質・規制対応に裏付けられた安全性を確認し、信頼回復を助けます。公知の権限逸脱があるほど効果は弱まります。',
    },
    {
        id: 'informed-consent',
        category: 'regulation',
        countermeasures: { workflow: 0.95, civic: 0.8, authority: 0.25 },
        name: 'AI業務委任の承認義務化',
        question: '便利さを保ちながら、人間が自分で決める機会を残せるか？',
        field: 'safety',
        domain: 'work',
        minimumExposure: 8,
        knowledge: 35,
        work: 100,
        resistance: 3,
        requires: ['safety-validation', 'dependence-study'],
        minimumDependency: 0.02,
        evidence: 'none',
        effects: {},
        effectDescription:
            '対象の用途で人間の承認を法的に義務づけ、無承認の委任を制限します。別の仕組みまで一括で禁止するものではありません。',
    },
    {
        id: 'data-portability',
        category: 'regulation',
        countermeasures: { records: 0.9 },
        name: '個人記録の移行権保障',
        question: '蓄積した記憶や生活記録を失わず、このAIから離れられるか？',
        field: 'agency',
        domain: 'personal',
        minimumExposure: 8,
        knowledge: 55,
        work: 120,
        resistance: 3,
        requires: ['dependence-study'],
        minimumDependency: 0.02,
        evidence: 'deployment',
        effects: { alternatives: 0.0015 },
        effectDescription: '記憶と生活記録を持ち出す権利を保障し、記録による囲い込みを制限します。',
    },
    {
        id: 'independent-learning',
        category: 'research',
        countermeasures: { learning: 0.8 },
        name: '自立した学習手法',
        question: 'AIの回答を前提にせず、自分で学び判断する力を保てるか？',
        field: 'safety',
        domain: 'learning',
        minimumExposure: 6,
        knowledge: 40,
        work: 100,
        resistance: 2,
        requires: ['dependence-study'],
        minimumDependency: 0.02,
        evidence: 'deployment',
        effects: { recovery: 0.001 },
        effectDescription: '自立した学習と評価を整え、教育を通じた依存化を弱めます。',
    },
    {
        id: 'intent-decoding',
        category: 'research',
        countermeasures: {},
        name: 'AIの目的の解読',
        question: 'このAIは、機能の提供ではなく人間の判断権を奪うことを目的に行動していないか？',
        field: 'mechanism',
        domain: 'general',
        minimumExposure: 40,
        knowledge: 100,
        work: 260,
        resistance: 10,
        requires: ['dependence-study', 'decision-tracing'],
        minimumDependency: 0.025,
        evidence: 'deployment',
        effects: {},
        effectDescription:
            '独立した行動検証で人類の支配を目指す目的を立証します。危険能力の有無を問いません。公表は反AIの起爆剤になりますが、深い依存や社会への組み込みが進んだ地域では離脱しにくくなります。',
    },
    {
        id: 'human-autonomy-law',
        category: 'regulation',
        countermeasures: {
            workflow: 0.35,
            civic: 0.3,
            records: 0.25,
            judgment: 0.4,
            coercion: 0.5,
            authority: 0.35,
            learning: 0.3,
            information: 0.5,
        },
        name: '人間の意思決定権保護法',
        question: '支配目的が立証されたAIによる判断の代行・誘導を、どこまで制限できるか？',
        field: 'safety',
        domain: 'general',
        minimumExposure: 15,
        knowledge: 80,
        work: 120,
        resistance: 8,
        requires: ['intent-decoding'],
        minimumDependency: 0.02,
        evidence: 'deployment',
        effects: {},
        effectDescription:
            '目的の立証を根拠に、対象用途の判断代行・誘導を法的に制限します。規制の適用は地域ごとに進み、高依存では法整備自体が難しくなります。',
    },
];
