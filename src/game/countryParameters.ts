import type { CountryMetrics, CountryStateKey } from './types.ts';

export type CountryParameterKey = CountryStateKey | keyof CountryMetrics;

/** 名称と説明はtypes.tsのCOUNTRY_STATE_KEYSのコメントに合わせる。 */
export const COUNTRY_PARAMETERS: Record<
    CountryParameterKey,
    { name: string; description: string }
> = {
    infrastructure: {
        name: 'インフラ',
        description: '電力・通信・物流など、施設や社会を動かす基盤の稼働状態',
    },
    economy: {
        name: '経済',
        description: '生産・取引が行われ、支援・研究・復旧への資源投入を続けられる程度',
    },
    governmentCapacity: { name: '行政能力', description: '政府の政策実行能力' },
    aiDefenseTechnology: {
        name: '対AI技術水準',
        description: '対AI技術がどこまで開発されているか',
    },
    aiExpectation: {
        name: 'AIへの期待',
        description: 'このAIに成果を期待し、計算資源を提供する意欲',
    },
    awareness: { name: '警戒度', description: 'このAIによる介入を疑い、対抗しようとする強さ' },
    aiDecisionControl: { name: '意思決定支配', description: 'AIが国の意思決定を左右している程度' },
    aiDependency: { name: 'AI依存度', description: '社会がAIなしでは機能しにくくなっている程度' },
    aiDefenseEffectiveness: {
        name: '対AI防御の実効性',
        description: '対AI技術を経済・行政能力・警戒度などに応じて運用できている程度',
    },
};

/** 全項目を共通の0〜100で比較する。国同士の相対順位による色付けは行わない。 */
export function countryParameterColor(value: number): string {
    return `hsl(${50 - value * 0.45} 65% ${78 - value * 0.38}%)`;
}
