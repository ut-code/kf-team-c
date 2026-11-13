import regions from './data/regions.json' with { type: 'json' };
import type { AreaDefinition } from './types.ts';

export const AREAS = regions as AreaDefinition[];
export const STAGES = ['AI未使用', 'AI通常利用', 'AI依存', '利用拒否'];
export const STAGE_COLORS = ['#778496', '#55bce6', '#ef424e', '#e4b565'];
export const DEFEAT_OPPOSITION = 0.9995;
// 1倍速の標準プレイを約25分に合わせ、月次の判断に使える時間を確保する。
export const MONTH_MS = 5_000;
// 固定方針の診断上限。目標プレイ時間や敗北条件ではない。
export const SIMULATION_MONTHS = 480;
export const START_YEAR = 2027;
export const START_MONTH = 4;
export const START_DAY = 1;
export const WORLD_POPULATION = AREAS.reduce((sum, area) => sum + area.population, 0);
export const ORIGINS = [
    { area: 0, home: [0, 1], name: 'アメリカのAI企業', note: '英語圏・企業への普及' },
    { area: 28, home: [28], name: '日本のAI研究所', note: '日本語圏から世界へ' },
    { area: 26, home: [26, 27], name: '中国のテクノロジー企業', note: '大きな国内市場' },
    { area: 8, home: [8, 9, 10, 11], name: 'EUのAI開発拠点', note: '規制対応と独立検証が鍵' },
    {
        area: 23,
        home: [23, 24],
        name: '南アジアのAI開発拠点',
        note: '大きな人口と通信・端末の制約',
    },
    {
        area: 18,
        home: [18, 19, 20, 21],
        name: '西アフリカのAI開発拠点',
        note: '軽量化から新しい利用圏へ',
    },
];
export { SKILLS } from './skills.ts';
