import world from './data/world.json' with { type: 'json' };
import type { Ability, AreaDefinition, CountryStatistics } from './types.ts';

export const ABILITIES: Ability[] = ['IQ', 'EQ', 'SYSTEM'];
export const FIELDS = ['教育', '労働', '情報', '医療・生活', '行政'];
export const STAGES = ['自律', '道具利用', '判断委譲', '構造的依存'];
export const STAGE_COLORS = ['#778496', '#4daaff', '#fa786e', '#b68aff'];
export const POPULATION_COUNT = world.points.length;
export const STRUCTURAL_REQUIREMENTS = { system: 52, institution: 2.7 };
export const TOTAL_MONTHS = 480;
export const MONTH_MS = 3_125;
export const START_YEAR = world.referenceYear;

// 区分はゲームの設計。人口・デジタル基盤・代表座標はGHSLと公表統計から生成する。
const definitions: [string, string, string][] = [
    ['us-west', '北米西岸', '北米'],
    ['us-east', '北米東岸', '北米'],
    ['canada', 'カナダ', '北米'],
    ['mexico', 'メキシコ・中米', '中南米'],
    ['caribbean', 'カリブ海', '中南米'],
    ['andes', 'アンデス', '中南米'],
    ['brazil', 'ブラジル', '中南米'],
    ['southern-cone', '南米南部', '中南米'],
    ['west-europe', '西欧', '欧州'],
    ['north-europe', '北欧・英国', '欧州'],
    ['south-europe', '南欧', '欧州'],
    ['east-europe', '東欧', '欧州'],
    ['russia-west', 'ロシア西部', 'ユーラシア'],
    ['central-asia', '中央アジア', 'ユーラシア'],
    ['siberia', 'シベリア・極東', 'ユーラシア'],
    ['maghreb', '北アフリカ', '中東・北アフリカ'],
    ['nile', 'ナイル流域', '中東・北アフリカ'],
    ['middle-east', '中東', '中東・北アフリカ'],
    ['west-africa', '西アフリカ', 'サハラ以南'],
    ['central-africa', '中央アフリカ', 'サハラ以南'],
    ['east-africa', '東アフリカ', 'サハラ以南'],
    ['south-africa', '南部アフリカ', 'サハラ以南'],
    ['pakistan', 'パキスタン・アフガン', '南アジア'],
    ['india-north', 'インド北部', '南アジア'],
    ['india-south', 'インド南部', '南アジア'],
    ['bengal', 'ベンガル・ヒマラヤ', '南アジア'],
    ['china-coast', '中国沿岸', '東アジア'],
    ['china-inland', '中国内陸', '東アジア'],
    ['japan', '日本', '東アジア'],
    ['korea', '朝鮮半島', '東アジア'],
    ['mekong', 'メコン', '東南アジア'],
    ['vietnam', 'ベトナム', '東南アジア'],
    ['malay', 'マレー半島', '東南アジア'],
    ['indonesia', 'インドネシア', '東南アジア'],
    ['philippines', 'フィリピン', '東南アジア'],
    ['australia', 'オーストラリア', 'オセアニア'],
    ['pacific', '太平洋・NZ', 'オセアニア'],
];
export const AREAS: AreaDefinition[] = definitions.map(([id, name, region], index) => ({
    id,
    name,
    region,
    ...world.areas[index],
}));
export const COUNTRY_STATISTICS: Record<string, CountryStatistics> = world.countries;
export const STATISTICS_YEAR = world.referenceYear;
export const WORLD_POPULATION = AREAS.reduce((sum, area) => sum + area.population, 0);
export const REGIONS = [...new Set(AREAS.map((area) => area.region))];

export { SKILLS } from './skills.ts';
