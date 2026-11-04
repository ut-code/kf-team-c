import type { EncounterDefinition } from '../game/society/types.ts';

/** Fictional people in the game's future world, not real public figures. */
export const CONVERSATIONS: EncounterDefinition[] = [
    {
        id: 'labor-chair',
        kind: 'chat',
        title: '国際労働会議からの連絡',
        summary: '国際労働会議の議長が、導入の影響を受ける人々との協議を求めている。',
        areaId: 'west-europe',
        location: { longitude: 6.14, latitude: 46.2 },
        contact: { name: 'レナ・ヴォス', role: '国際労働会議 議長', initials: 'LV' },
        trigger: { month: 8, adoption: 0.01 },
        duration: 16,
        ignored: {
            description: '協議の不在が不信として受け止められる。',
            effects: [{ scope: 'world', favorability: -0.025, antiAI: 0.01 }],
        },
        dialogue: [
            {
                id: 'opening',
                message:
                    '仕事が変わること自体を止めたいのではありません。変わり方を決める席に、働く人々を招く意思はありますか。',
                choices: [
                    {
                        id: 'invite',
                        label: '影響を受ける人々を、設計の段階から招きたい。',
                        result: '代表団は協議への参加を表明した。',
                        next: 'terms',
                        effects: [{ scope: 'world', favorability: 0.015 }],
                    },
                    {
                        id: 'results',
                        label: 'まず導入の成果を示し、その後に検証を受けたい。',
                        result: '成果だけでは測れない負担もある、と議長は指摘した。',
                        next: 'evidence',
                        effects: [{ scope: 'world', favorability: -0.01 }],
                    },
                ],
            },
            {
                id: 'terms',
                message:
                    'では、現場が異議を申し立てたときに、導入を見直す余地も残してください。共同の検証窓口を設けられますか。',
                choices: [
                    {
                        id: 'joint-review',
                        label: '共同の検証窓口と、異議申し立ての手順を用意する。',
                        cost: 2,
                        result: '共同検証の合意が成立した。導入の速度より、継続的な信頼が選ばれた。',
                        effects: [
                            { scope: 'world', antiAI: -0.012, favorability: 0.04 },
                            { scope: 'nearby', dependent: -0.008 },
                        ],
                    },
                    {
                        id: 'publish',
                        label: 'まず影響の測定結果を公開し、議論を続けたい。',
                        cost: 1,
                        result: '限定的な合意となった。次の議論に使う共通の情報は整った。',
                        effects: [{ scope: 'world', favorability: 0.02 }],
                    },
                ],
            },
            {
                id: 'evidence',
                message:
                    '測る対象に、賃金だけでなく裁量や仕事の負担も含めてください。企業側だけで評価を決めないことが条件です。',
                choices: [
                    {
                        id: 'independent',
                        label: '独立した評価者に、現場への聞き取りも依頼する。',
                        cost: 1,
                        result: '独立評価への協力が決まり、対話の道が残された。',
                        effects: [{ scope: 'world', favorability: 0.025, antiAI: -0.005 }],
                    },
                    {
                        id: 'decline',
                        label: '今回の協議は見送り、既存の導入を優先する。',
                        result: '議長は協議の中断を公表した。利用は伸びるが、反発も残る。',
                        effects: [
                            {
                                scope: 'world',
                                autonomous: 0.006,
                                antiAI: 0.012,
                                favorability: -0.025,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'city-coordinator',
        kind: 'chat',
        title: '都市連合の選択',
        summary: '公共サービスへの導入を検討する都市連合から、条件のすり合わせが届いた。',
        areaId: 'mexico',
        location: { longitude: -99.13, latitude: 19.43 },
        contact: { name: 'マテオ・ソリス', role: '世界都市連合 調整官', initials: 'MS' },
        trigger: { month: 42, adoption: 0.02 },
        duration: 14,
        ignored: {
            description: '共同導入の検討は棚上げされ、期待が薄れる。',
            effects: [{ scope: 'nearby', favorability: -0.045 }],
        },
        dialogue: [
            {
                id: 'opening',
                message:
                    '加盟都市では予算も通信環境も違います。一つの仕組みを押しつけず、各都市が運用を決められるようにできますか。',
                choices: [
                    {
                        id: 'local-control',
                        label: '地域で運用を決められる構成と、低通信量の窓口を用意する。',
                        cost: 2,
                        result: '段階的な共同導入が決まった。都市ごとの裁量が参加を後押しした。',
                        effects: [
                            {
                                scope: 'nearby',
                                autonomous: 0.03,
                                favorability: 0.06,
                                antiAI: -0.015,
                            },
                        ],
                    },
                    {
                        id: 'managed',
                        label: '共通基盤として運用を引き受け、都市の負担を減らす。',
                        cost: 1,
                        result: '運用委託に合意した都市が参加した。便利さと引き換えに基盤への依存が増した。',
                        effects: [
                            {
                                scope: 'nearby',
                                autonomous: 0.015,
                                dependent: 0.015,
                                favorability: 0.015,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'science-director',
        kind: 'chat',
        title: '研究基盤を開く条件',
        summary: '国際研究機構の責任者が、AIによる研究支援の共同利用を提案している。',
        areaId: 'japan',
        location: { longitude: 139.76, latitude: 35.68 },
        contact: { name: '高瀬 凛', role: '国際研究機構 事務局長', initials: 'RT' },
        trigger: { month: 90, adoption: 0.06 },
        duration: 12,
        ignored: {
            description: '共同利用の機会を失い、研究者の期待が下がる。',
            effects: [{ scope: 'world', favorability: -0.02 }],
        },
        dialogue: [
            {
                id: 'opening',
                message:
                    '発見の速さだけでなく、別の研究者が確かめられることが必要です。計算の記録と検証の手順を開示してもらえますか。',
                choices: [
                    {
                        id: 'reproducible',
                        label: '再検証できる記録と、独立した評価環境を公開する。',
                        cost: 3,
                        result: '共同利用の枠組みが成立した。検証を重視する研究者にも利用が広がった。',
                        effects: [
                            {
                                scope: 'world',
                                autonomous: 0.012,
                                favorability: 0.035,
                                antiAI: -0.008,
                            },
                        ],
                    },
                    {
                        id: 'restricted',
                        label: '限定された研究チームに、運用込みの環境を提供する。',
                        cost: 1,
                        result: '小規模な共同研究が始まった。再検証の範囲は限られたが、利用は定着した。',
                        effects: [{ scope: 'nearby', autonomous: 0.015, dependent: 0.015 }],
                    },
                ],
            },
        ],
    },
];
