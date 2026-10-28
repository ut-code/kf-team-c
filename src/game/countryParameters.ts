import type { CountryMetrics, CountryStateKey } from './types.ts';

export type CountryParameterKey = CountryStateKey | keyof CountryMetrics;

/** 名称と説明はtypes.tsのCOUNTRY_STATE_KEYSのコメントに合わせる。 */
export const COUNTRY_PARAMETERS: Record<
    CountryParameterKey,
    { name: string; description: string }
> = {
    infrastructure: { name: 'インフラ', description: '通信・電力など社会基盤の稼働状態' },
    economy: { name: '経済', description: '経済活動の健全さ' },
    governmentCapacity: { name: '行政能力', description: '政府の政策実行能力' },
    aiDefenseTechnology: {
        name: '対AI技術水準',
        description: '対AI技術がどこまで開発されているか',
    },
    aiAcceptance: { name: 'AI受容度', description: '社会がAIの利用を受け入れる姿勢' },
    awareness: { name: '警戒度', description: '人間側がAIの介入をどれだけ警戒しているか' },
    aiAdoption: { name: 'AI導入率', description: '社会でAIの利用がどれだけ広がっているか' },
    aiInfiltration: { name: '浸透度', description: 'AIが国の内部へ入り込んでいる程度' },
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
