import type { NewsDefinition } from '../game/society/news.ts';

// PR #6の物語・人物を自動ニュースへ再構成。原案: KoshiroIto。
// https://github.com/ut-code/kf-team-c/pull/6 / 1324a82c5dafab98e7870db6a71ce6d0464f13df
// 選択肢・抽選・SP報酬は持たず、開発した機能と社会の利用状況に沿って報じる。
export const WORLD_NEWS: NewsDefinition[] = [
    {
        id: 'security-breach-1',
        title: '西海岸の学習サービスで情報流出',
        summary:
            '西海岸のAI学習サービスで大規模な情報流出が確認された。判断を委ねたはずの基盤の脆さが露呈し、利用を拒む人が出始めている。',
        areaId: 'us-west',
        skills: ['tutor', 'curriculum'],
        avoid: ['privacy', 'federated'],
    },
    {
        id: 'security-breach-2',
        title: '東欧の行政AIが一斉改ざんを受けた',
        summary:
            '東欧の複数自治体で、行政AIの記録が改ざんされる攻撃が見つかった。依存が進んだ地域ほど、拒否の波が広がっている。',
        areaId: 'east-europe',
        skills: ['public'],
        avoid: ['audit', 'fault-tolerance'],
    },
    {
        id: 'security-breach-3',
        title: '首都圏のAI基盤で連続する侵入',
        summary:
            '東京圏でAI基盤への侵入が連続して確認された。専門家は「構造を理解する側の目が育っていない」と指摘している。',
        areaId: 'japan',
        skills: ['platform', 'backbone'],
        avoid: ['sandbox', 'fault-tolerance'],
        minDependency: 0.3,
    },
    {
        id: 'breakthrough-discovery',
        title: 'AIが難病の治療物質を発見',
        summary:
            '大西洋岸の研究拠点で、AIが難病の治療物質候補を発見した。人間の研究者が候補の検証を進めている。',
        areaId: 'us-east',
        skills: ['drug-design', 'discovery'],
    },
    {
        id: 'discovery-followup',
        title: '新薬候補の臨床結果が確定',
        summary:
            '先に発見された治療物質候補の臨床データがまとまった。研究者は効果と副作用の検証を続けている。',
        areaId: 'us-east',
        skills: ['drug-design', 'discovery'],
        after: 'breakthrough-discovery',
    },
    {
        id: 'ai-campaign',
        title: '地方首長選にAI候補が出馬を表明',
        summary:
            '東海岸の自治体で、AI自身が出馬を表明した。公約は「判断の見えます化」。反対運動も各地で始まっている。',
        areaId: 'us-east',
        skills: ['public'],
        minDependency: 0.25,
    },
    {
        id: 'ai-marriage',
        title: '人とAIの結婚を認める法案が提案された',
        summary:
            '西欧の立法府に、人とAIの伴侶関係を認める法案が提案された。若い世代の支持が厚く、高齢の世代は強く警戒している。',
        areaId: 'west-europe',
        skills: ['companion', 'digital-twin', 'care'],
        minDependency: 0.15,
    },
    {
        id: 'marriage-backlash',
        title: '結婚制度の見直しを求める運動が再燃',
        summary:
            '伴侶AIの制度化をめぐり、保守層を中心とした見直し運動が西欧で再燃した。若い世代と高齢の世代の間で支持が割れている。',
        areaId: 'west-europe',
        skills: ['companion', 'digital-twin', 'care'],
        after: 'ai-marriage',
    },
    {
        id: 'system-outage-2',
        title: '北欧の統合行政AIが一斉停止',
        summary:
            '北欧の統合行政AIが給付と交通管理ごと停止した。障害の復旧に、計算資源の供給の2割を数か月充当する見通しが示された。',
        areaId: 'north-europe',
        skills: ['public'],
        avoid: ['fault-tolerance'],
        minDependency: 0.25,
    },
    {
        id: 'system-outage-3',
        title: '近畿圏の都市基盤AIが長期停止',
        summary:
            '近畿圏で都市基盤AIが停止し、復旧に数か月を要する見通しが出た。依存が深い分、取り返す社会的な信任の重荷も大きい。',
        areaId: 'japan',
        skills: ['public', 'backbone'],
        avoid: ['fault-tolerance'],
        minDependency: 0.4,
        after: 'system-outage-2',
    },
    {
        id: 'empathy-counselors',
        title: '高齢者ケアの共感AIを試そうという提案',
        summary:
            '夜勤の孤独に耐える入居者が少なくありません。共感AIを「代わり」ではなく「ともにいる者」として設計したい。伴走型のケアが施設で試されています。',
        areaId: 'korea',
        skills: ['care'],
        author: 'ハン・ジウォン / 高齢者ケア施設 介護主任',
    },
];
