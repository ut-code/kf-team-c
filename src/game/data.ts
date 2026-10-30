import world from './data/world.json' with { type: 'json' };
import type { Ability, AreaDefinition, CountryStatistics, Skill } from './types.ts';

export const ABILITIES: Ability[] = ['IQ', 'EQ', 'SYSTEM'];
export const FIELDS = ['教育', '労働', '情報', '医療・生活', '行政'];
export const STAGES = ['自律', '道具利用', '判断委譲', '構造的依存', '利用拒否'];
export const STAGE_COLORS = ['#778496', '#4daaff', '#fa786e', '#b68aff', '#f0c75e'];
export const POPULATION_COUNT = world.points.length;
export const STRUCTURAL_REQUIREMENTS = { system: 40, institution: 0.72 };
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

export const SKILLS: Skill[] = [
    {
        id: 'reason',
        name: '検証型推論',
        branch: 'IQ',
        cost: 30,
        requires: [],
        description: 'IQ成長 +35%。判断ミスの被害を軽減。',
    },
    {
        id: 'tutor',
        name: '個別教育',
        branch: 'IQ',
        cost: 65,
        requires: ['reason'],
        description: '教育の制度化 +60%。新世代がAIによる判断に親しむ。',
    },
    {
        id: 'science',
        name: '自律研究',
        branch: 'IQ',
        cost: 110,
        requires: ['tutor'],
        description: '研究点の獲得 +65%。全分野の判断委譲を促進。',
    },
    {
        id: 'dialogue',
        name: '文脈理解',
        branch: 'EQ',
        cost: 30,
        requires: [],
        description: 'EQ成長 +35%。地域の信頼獲得を促進。',
    },
    {
        id: 'companion',
        name: '生活伴走',
        branch: 'EQ',
        cost: 65,
        requires: ['dialogue'],
        description: '医療・生活と情報の制度化 +45%。SNS効果を強化。',
    },
    {
        id: 'consensus',
        name: '合意形成',
        branch: 'EQ',
        cost: 110,
        requires: ['companion'],
        description: '反発の蓄積 -40%。対話の能力判定 +15。',
    },
    {
        id: 'efficient',
        name: '推論の軽量化',
        branch: 'SYSTEM',
        cost: 30,
        requires: [],
        description: '維持費 -25%、SYSTEM成長 +35%。制度間連携の前提技術。',
    },
    {
        id: 'integration',
        name: '制度間連携',
        branch: 'SYSTEM',
        cost: 65,
        requires: ['efficient'],
        description: '構造的依存の必須技術。SYSTEM 40・分野の制度化72%から紫へ進む。',
    },
    {
        id: 'resilient',
        name: '分散社会基盤',
        branch: 'SYSTEM',
        cost: 110,
        requires: ['integration'],
        description: '維持費をさらに -25%、障害の被害を軽減。支配には必須ではない。',
    },
];
