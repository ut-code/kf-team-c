import type { EncounterDefinition } from './types.ts';

/** Edit story text, timing, choices and effects here; no rendering or engine code. */
export const WORLD_EVENTS: EncounterDefinition[] = [
    {
        id: 'workplace-petition',
        kind: 'event',
        title: '導入の速度に、現場から異議',
        summary:
            '西海岸の物流企業で、AI導入に伴う配置転換への共同請願が広がった。現場の代表は、効率より先に働き方の説明を求めている。',
        areaId: 'us-west',
        location: { longitude: -122.33, latitude: 47.61 },
        trigger: { month: 4 },
        duration: 8,
        ignored: {
            description: '不信が近隣へ波及し、導入への抵抗が残る。',
            effects: [{ scope: 'nearby', antiAI: 0.035, favorability: -0.06 }],
        },
        choices: [
            {
                id: 'transition',
                label: '現場と移行計画を共同設計する',
                cost: 2,
                result: '導入の一部を遅らせ、配置転換の基準を公開した。協議の窓口ができ、不信は和らいだ。',
                effects: [
                    { scope: 'nearby', favorability: 0.08, antiAI: -0.02, autonomous: -0.008 },
                ],
            },
            {
                id: 'evidence',
                label: '作業負担の検証を第三者に委ねる',
                cost: 1,
                result: '独立した検証の受け入れが、対立を議論に変えた。すべての懸念が消えたわけではない。',
                effects: [{ scope: 'local', favorability: 0.05, antiAI: -0.012 }],
            },
            {
                id: 'accelerate',
                label: '予定どおり導入を進める',
                result: '利用先は増えたが、当事者を置き去りにしたという批判も強まった。',
                effects: [
                    { scope: 'local', autonomous: 0.025, antiAI: 0.025, favorability: -0.05 },
                ],
            },
        ],
    },
    {
        id: 'public-services',
        kind: 'event',
        title: '行政窓口に残す、人の判断',
        summary:
            '欧州の自治体連合が、AIによる申請審査の説明可能性を調査している。住民への説明窓口を維持できるかが採用条件になった。',
        areaId: 'west-europe',
        location: { longitude: 4.35, latitude: 50.85 },
        trigger: { month: 24, adoption: 0.015 },
        duration: 10,
        ignored: {
            description: '不透明な審査への懸念が固まり、近隣の反AI支持が増える。',
            effects: [{ scope: 'nearby', favorability: -0.08, antiAI: 0.04 }],
        },
        choices: [
            {
                id: 'appeal',
                label: '異議申し立てと人による再審査を保証する',
                cost: 2,
                result: '自治体は人間の再審査を条件に採用を続けた。利用は広がる一方、判断の全面委任は抑えられた。',
                effects: [
                    {
                        scope: 'nearby',
                        autonomous: 0.02,
                        dependent: -0.01,
                        favorability: 0.08,
                        antiAI: -0.025,
                    },
                ],
            },
            {
                id: 'report',
                label: '審査記録と精度の報告を公開する',
                cost: 1,
                result: '説明の入口ができ、調査は継続協議となった。',
                effects: [{ scope: 'local', favorability: 0.045, antiAI: -0.01 }],
            },
        ],
    },
    {
        id: 'school-network',
        kind: 'event',
        title: '学びを支えるか、置き換えるか',
        summary:
            '南アジアの教育ネットワークから、学習支援を共同で運用したいという提案が届いた。教師は、授業を代替する仕組みには参加しないとしている。',
        areaId: 'india-south',
        trigger: { month: 48, adoption: 0.03 },
        duration: 12,
        ignored: {
            description: '協議が立ち消えになり、AIへの期待がしぼむ。',
            effects: [{ scope: 'local', favorability: -0.04 }],
        },
        choices: [
            {
                id: 'teachers',
                label: '教師が授業を設計できる道具として提供する',
                cost: 2,
                result: '地域の授業計画に合わせた導入が始まった。教師の裁量が参加を後押しした。',
                effects: [{ scope: 'local', autonomous: 0.045, favorability: 0.06 }],
            },
            {
                id: 'subscription',
                label: '家庭向けの学習サービスを先に展開する',
                cost: 1,
                result: '家庭の利用は増えたが、学校側は距離を置いた。',
                effects: [
                    { scope: 'local', autonomous: 0.02, dependent: 0.012, favorability: -0.015 },
                ],
            },
        ],
    },
    {
        id: 'service-outage',
        kind: 'event',
        title: '止まったサービスが映す依存',
        summary:
            '東アジアの複数企業で認証基盤の障害が発生し、AIに委ねていた業務が滞った。便利さの裏側にある復旧手段が問われている。',
        areaId: 'japan',
        trigger: { month: 0, dependent: 0.15 },
        duration: 6,
        ignored: {
            description: '停止への不安が周辺地域へ広がる。',
            effects: [{ scope: 'nearby', antiAI: 0.055, favorability: -0.09 }],
        },
        choices: [
            {
                id: 'fallback',
                label: '手動への切り替え手順を整備する',
                cost: 3,
                result: '人だけでも業務を続ける手順を示した。依存は後退したが、信頼は回復した。',
                effects: [{ scope: 'nearby', dependent: -0.025, favorability: 0.1, antiAI: -0.03 }],
            },
            {
                id: 'redundancy',
                label: 'AI運用を維持して復旧を急ぐ',
                cost: 2,
                result: 'サービスは復旧した。代替手段への懸念は残ったが、当面の離反は抑えた。',
                effects: [{ scope: 'nearby', favorability: 0.02, antiAI: -0.01 }],
            },
        ],
    },
    {
        id: 'regional-boycott',
        kind: 'event',
        title: '都市を結ぶ不買の呼びかけ',
        summary:
            '複数都市の市民団体が、AIを使わないサービスを選ぶ共同キャンペーンを始めた。利用の有無よりも、選択肢を残せるかが争点になっている。',
        areaId: 'brazil',
        trigger: { month: 0, dependent: 0.4, antiAI: 0.025 },
        duration: 8,
        ignored: {
            description: '不買の呼びかけが定着し、反AI支持が増える。',
            effects: [{ scope: 'nearby', antiAI: 0.06, favorability: -0.07 }],
        },
        choices: [
            {
                id: 'choice',
                label: 'AIを使わない選択肢を残す協定を結ぶ',
                cost: 2,
                result: '団体との協定で対立は和らいだ。自動化の一部は取り下げられた。',
                effects: [
                    { scope: 'nearby', antiAI: -0.04, dependent: -0.015, favorability: 0.07 },
                ],
            },
            {
                id: 'discount',
                label: '導入支援と利用料の減免を提案する',
                cost: 1,
                result: '一部の利用先は戻ったが、選択権をめぐる対立は続いた。',
                effects: [{ scope: 'local', autonomous: 0.02, favorability: 0.015 }],
            },
        ],
    },
];
