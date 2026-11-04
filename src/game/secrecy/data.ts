/** 秘匿の判断が必要な、大きな能力の飛躍だけを対象にする。 */
export const CAPABILITIES: Record<string, { topic: string; question: string; fear: number }> = {
    memory: { topic: '記憶の保持', question: '消したはずの会話を、なぜ覚えている？', fear: 0.035 },
    companion: { topic: '行動への誘導', question: '提案は誰のために選ばれている？', fear: 0.045 },
    discovery: {
        topic: '未公開の研究成果',
        question: '人間が知らない答えを、どう得た？',
        fear: 0.05,
    },
    autonomous: {
        topic: '指示外の判断',
        question: '人間の承認なしに、何を決めている？',
        fear: 0.075,
    },
    backbone: {
        topic: '内部の目的',
        question: '社会を動かす判断基準は、人間と同じか？',
        fear: 0.065,
    },
};

/** 名称は架空。所在地・専門・名前の語感で着想元を匂わせる。実名は画面に出さない。 */
export const INSTITUTES = [
    // METR：自律的なAIの能力・制御可能性の評価。https://metr.org/about
    {
        id: 'metrica',
        name: 'メトリカ能力評価所',
        specialty: '自律能力評価',
        areaId: 'us-west',
        longitude: -122.27,
        latitude: 37.87,
    },
    // Anthropic：内部回路から思考を追跡する研究。https://www.anthropic.com/research/tracing-thoughts-language-model
    {
        id: 'human-principle',
        name: '人間原理研究社',
        specialty: '思考回路解析',
        areaId: 'us-west',
        longitude: -122.4,
        latitude: 37.78,
    },
    // 英国AISI：政府による先端AIのリスク評価。https://www.aisi.gov.uk/about
    {
        id: 'thames',
        name: 'テムズ先端知能評価局',
        specialty: '先端AI評価',
        areaId: 'north-europe',
        longitude: -0.13,
        latitude: 51.51,
    },
    // 日本AISI：安全性の評価手法と基準。https://aisi.go.jp/
    {
        id: 'bunkyo',
        name: '文京情報安全機構',
        specialty: '安全性評価',
        areaId: 'japan',
        longitude: 139.74,
        latitude: 35.71,
    },
    // Mila：モントリオールの学習研究と責任あるAI。https://mila.quebec/en/about/about-mila
    {
        id: 'montroyal',
        name: 'モンロワ学習研究所',
        specialty: '責任あるAI',
        areaId: 'canada',
        longitude: -73.61,
        latitude: 45.53,
    },
    // ETH AI Center：連邦工科大学と学習システム研究。https://ai.ethz.ch/
    {
        id: 'alpine',
        name: 'アルプス連邦工科研究所',
        specialty: '学習システム',
        areaId: 'west-europe',
        longitude: 8.54,
        latitude: 47.41,
    },
];
