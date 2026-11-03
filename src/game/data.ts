import regions from './data/regions.json' with { type: 'json' };
import type { AreaDefinition } from './types.ts';

export const AREAS = regions as AreaDefinition[];
export const STAGES = ['AI未使用', '自律的使用', 'AI依存', '反AI'];
export const STAGE_COLORS = ['#778496', '#55bce6', '#ef424e', '#e4b565'];
export const TOTAL_MONTHS = 480;
export const MONTH_MS = 3_125;
export const START_YEAR = 2022;
export const START_MONTH = 11;
export const START_DAY = 30;
export const WORLD_POPULATION = AREAS.reduce((sum, area) => sum + area.population, 0);
export const ORIGINS = [
    { area: 0, home: [0, 1], name: 'アメリカのAI企業', note: '英語圏・企業への普及' },
    { area: 28, home: [28], name: '日本のAI研究所', note: '日本語圏から世界へ' },
    { area: 26, home: [26, 27], name: '中国のテクノロジー企業', note: '大きな国内市場' },
];
export { SKILLS } from './skills.ts';
