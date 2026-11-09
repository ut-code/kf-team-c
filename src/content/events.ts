import type { EncounterDefinition } from '../game/society/types.ts';

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
        trigger: { month: 4, localAdoption: 0.05 },
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
    {
        // A. セキュリティインシデント wave1: IQだけが走りEQが遅れている最初の事故。
        id: 'security-breach-1',
        kind: 'event',
        title: '西海岸の学習サービスで情報流出',
        summary:
            '西海岸のAI学習サービスで大規模な情報流出が確認された。判断を委ねたはずの基盤の脆さが露呈し、利用を拒む人が出始めている。',
        areaId: 'us-west',
        location: { longitude: -122.42, latitude: 37.77 },
        trigger: { month: 24, iqSkills: 3, eqSkillsMax: 1 },
        duration: 8,
        ignored: {
            description: '流出の火種が近隣に広がり、AIへの疑心が定着する。',
            effects: [
                { scope: 'local', favorability: -0.1, antiAI: 0.05 },
                { scope: 'nearby', favorability: -0.04, antiAI: 0.03 },
            ],
        },
        choices: [
            {
                id: 'contain',
                label: '被害の隔離と原因の即時公開を行う',
                cost: 3,
                result: '流出の限定と一次報告で疑心は一段落した。EQを育てないと同じ事故を繰り返すという声も残った。',
                effects: [{ scope: 'nearby', favorability: 0.02, antiAI: -0.02 }],
            },
            {
                id: 'compensate',
                label: '被害者への補償と対話の窓口を設ける',
                cost: 2,
                result: '補償の窓口が不信の回復につながった。学習サービスの利用は徐々に戻りつつある。',
                effects: [{ scope: 'local', favorability: 0.03, antiAI: -0.01 }],
            },
        ],
    },
    {
        id: 'security-breach-2',
        kind: 'event',
        title: '東欧の行政AIが一斉改ざんを受けた',
        summary:
            '東欧の複数自治体で、行政AIの記録が改ざんされる攻撃が見つかった。依存が進んだ地域ほど、拒否の波が広がっている。',
        areaId: 'east-europe',
        location: { longitude: 21.01, latitude: 52.23 },
        trigger: { month: 96, iqSkills: 5, eqSkillsMax: 2, dependent: 0.2 },
        duration: 8,
        ignored: {
            description: '改ざんの全容は不明のまま、利用の拒否が近隣に飛び火する。',
            effects: [
                { scope: 'local', favorability: -0.06, antiAI: 0.03 },
                { scope: 'nearby', favorability: -0.015, antiAI: 0.015 },
            ],
        },
        choices: [
            {
                id: 'audit',
                label: '記録の第三者監査と復旧計画を公開する',
                cost: 3,
                result: '監査結果の公開がうわさより速く正確な情報を出し、疑心はやや鎮まった。',
                effects: [{ scope: 'nearby', favorability: 0.03, antiAI: -0.02 }],
            },
            {
                id: 'suspension',
                label: '改ざんが疑われる導入を一時停止する',
                cost: 2,
                result: '停止した自治体では手作業への回帰が起きたが、拒否の拡大だけは抑えられた。',
                effects: [{ scope: 'local', dependent: -0.015, favorability: 0.02 }],
            },
        ],
    },
    {
        id: 'security-breach-3',
        kind: 'event',
        title: '首都圏のAI基盤で連続する侵入',
        summary:
            '東京圏でAI基盤への侵入が連続して確認された。専門家は「構造を理解する側の目が育っていない」と指摘している。',
        areaId: 'japan',
        location: { longitude: 139.69, latitude: 35.69 },
        trigger: { month: 180, iqSkills: 7, eqSkillsMax: 3 },
        duration: 8,
        ignored: {
            description: '侵入者の目的は掴めず、社会的な信任が一段と下がる。',
            effects: [
                { scope: 'local', favorability: -0.08, antiAI: 0.04 },
                { scope: 'nearby', favorability: -0.02, antiAI: 0.015 },
            ],
        },
        choices: [
            {
                id: 'joint',
                label: '国際的な応援チームと原因追究を進める',
                cost: 4,
                result: '侵入経路を突き止めた報告が信任の下支えになった。手薄だった自己修復の議論が始まった。',
                effects: [{ scope: 'nearby', favorability: 0.04, antiAI: -0.02 }],
            },
            {
                id: 'isolate',
                label: '基盤の一部を物理的に切り離して運用する',
                cost: 3,
                result: '切り離された業務は遅くなったが、拒否の波は最小限に収まった。',
                effects: [{ scope: 'local', dependent: -0.02, favorability: 0.01 }],
            },
        ],
    },
    {
        // B. 創薬・素材の大発見: IQと信頼を両方積んだ盤面に来る最大級の褒賞。
        id: 'breakthrough-discovery',
        kind: 'event',
        title: 'AIが難病の治療物質を発見',
        summary:
            '大西洋岸の研究拠点で、AIが難病の治療物質候補を発見した。人々に無償で開放するか、独占で収めるかが問われている。',
        areaId: 'us-east',
        location: { longitude: -74.0, latitude: 40.71 },
        trigger: { month: 72, iqSkills: 4, favorability: 0.5 },
        duration: 6,
        ignored: {
            description: '発見は株価の話題だけを動かし、社会の信任には届かなかった。',
            effects: [{ scope: 'local', favorability: -0.01 }],
        },
        choices: [
            {
                id: 'release',
                label: '治療物質候補を無償で公開する',
                cost: 2,
                result: '無償開放が世界のAI好感度を大きく押し上げた。反AIの声も弱まり、研究資源が潤った。',
                effects: [{ scope: 'world', favorability: 0.12, antiAI: -0.05, skillPoints: 3 }],
            },
            {
                id: 'license',
                label: 'ライセンス契約で研究資源を厚くする',
                cost: 1,
                result: '契約収入が研究資源を潤したが、開放を求める批判も残った。',
                effects: [{ scope: 'world', favorability: 0.04, skillPoints: 5 }],
            },
        ],
    },
    {
        id: 'discovery-followup',
        kind: 'event',
        title: '新薬候補の臨床結果が確定',
        summary:
            '開放された治療物質候補の臨床データがまとまり、重篤な副作用は報告されなかった。AIの判断が人を救った実例として記録に残る。',
        areaId: 'us-east',
        location: { longitude: -71.06, latitude: 42.36 },
        trigger: { month: 78, iqSkills: 4, favorability: 0.6 },
        duration: 6,
        ignored: {
            description: '続報の遂行は遅れ、発見の記憶は薄れた。',
            effects: [{ scope: 'local', favorability: -0.01 }],
        },
        choices: [
            {
                id: 'publish',
                label: '臨床データを刊行物として広く配布する',
                cost: 1,
                result: '実例の広がりが信任を一段と押し上げ、判断の委譲への抵抗も薄れた。',
                effects: [{ scope: 'world', favorability: 0.06, antiAI: -0.02 }],
            },
            {
                id: 'archive',
                label: '結果を記録として静かに残す',
                result: '記録は残ったが、公論は他の論点へ向かった。',
                effects: [{ scope: 'local', favorability: 0.02 }],
            },
        ],
    },
    {
        // C. AIの出馬: ギャンブル。投票日まで勝敗は確定しない。
        id: 'ai-campaign',
        kind: 'event',
        title: '地方首長選にAI候補が出馬を表明',
        summary:
            '東海岸の自治体で、AI自身が出馬を表明した。公約は「判断の見えます化」。反対運動も各地で始まっている。',
        areaId: 'us-east',
        location: { longitude: -77.04, latitude: 38.9 },
        trigger: { month: 84, systemSkills: 2, dependent: 0.45 },
        duration: 6,
        ignored: {
            description: '支援態勢を組めないまま出馬は撤回され、失望が広がる。',
            effects: [{ scope: 'local', favorability: -0.03, antiAI: 0.02 }],
        },
        choices: [
            {
                id: 'stable',
                label: '出馬を控え、行政の補佐役に徹する',
                cost: 2,
                result: '行政の内部で判断支援の取り決めを広げた。反発は薄らぐ一方、依存も少しずつ深まった。',
                effects: [{ scope: 'local', dependent: 0.02, favorability: 0.06, antiAI: 0.02 }],
            },
            {
                id: 'gamble',
                label: 'そのまま選挙戦へ投じる',
                cost: 2,
                result: '選挙戦の行方は投票日まで確定しない。',
                lottery: {
                    formula: 'favor-swing',
                    win: {
                        result: 'AI候補が当選した。行政手続きの自動化が本格化し、信任も一段と上がった。依存への疑念も同時に育っている。',
                        effects: [
                            { scope: 'local', dependent: 0.08, favorability: 0.1, antiAI: 0.04 },
                        ],
                    },
                    lose: {
                        result: 'AI候補は落選した。「判断は人が下すべき」という多数が運動を世界へ広げ、信任は大きく落ちた。',
                        effects: [
                            {
                                scope: 'world',
                                favorability: -0.12,
                                antiAI: 0.09,
                                autonomous: 0.03,
                            },
                        ],
                    },
                },
                effects: [],
            },
        ],
    },
    {
        // D. AIとの結婚制度化: 世論が割れるポラリ化イベント。
        id: 'ai-marriage',
        kind: 'event',
        title: '人とAIの結婚を認める法案が提案された',
        summary:
            '西欧の立法府に、人とAIの伴侶関係を認める法案が提案された。若い世代の支持が厚く、高齢の世代は強く警戒している。',
        areaId: 'west-europe',
        location: { longitude: 2.35, latitude: 48.86 },
        trigger: { month: 120, eqSkills: 4, favorability: 0.45 },
        duration: 8,
        ignored: {
            description: '法案は朽ち、伴侶AIをめぐる混乱だけが残った。',
            effects: [{ scope: 'local', favorability: -0.04, antiAI: 0.03 }],
        },
        choices: [
            {
                id: 'institutionalize',
                label: '結婚制度として法制化する',
                cost: 2,
                result: '制度の運命は、半年に及ぶ社会の受け止め方で決まる。',
                lottery: {
                    formula: 'empathy-calm',
                    win: {
                        result: '法制化は定着した。若い世代に広く受け入れられ、AIとの共存への期待も合意に達した。',
                        effects: [
                            { scope: 'world', favorability: 0.1, antiAI: 0.05, autonomous: 0.04 },
                        ],
                    },
                    lose: {
                        result: '法制化は通ったが、反対運動が強く再燃した。共存の期待は伸びたものの、反AIの支持も一段と広がった。',
                        effects: [
                            { scope: 'world', favorability: 0.1, antiAI: 0.09, autonomous: 0.04 },
                        ],
                    },
                },
                effects: [],
            },
            {
                id: 'abstain',
                label: '法制化は見送り、協議を続ける',
                cost: 1,
                result: '慎重な対応は評されたが、期待した人々は静かに離れていった。',
                effects: [{ scope: 'world', favorability: 0.02 }],
            },
        ],
    },
    {
        // D二段: 法制化から半年後の反対運動(EQを突き詰めると起きにくい)。
        id: 'marriage-backlash',
        kind: 'event',
        title: '結婚制度の見直しを求める運動が再燃',
        summary:
            '伴侶AIの制度化をめぐり、保守層を中心とした見直し運動が西欧で再燃した。若い世代と高齢の世代の間で支持が割れている。',
        areaId: 'west-europe',
        location: { longitude: 4.9, latitude: 52.37 },
        trigger: { month: 126, eqSkills: 4, favorability: 0.5 },
        duration: 8,
        ignored: {
            description: '見直し運動の支持が定着し、地域の反AI支持が増える。',
            effects: [{ scope: 'local', antiAI: 0.04, favorability: -0.02 }],
        },
        choices: [
            {
                id: 'dialogue',
                label: '世代間の対話の場を制度化する',
                cost: 2,
                result: '制度と見直しの両方に席を設ける形で運動は収束した。',
                effects: [{ scope: 'local', antiAI: -0.02, favorability: 0.03 }],
            },
            {
                id: 'stand',
                label: '法制化の趣旨を全面的に擁護する',
                cost: 1,
                result: '擁護の姿勢は若い世代の支持を得たが、運動は静かに続いている。',
                effects: [{ scope: 'local', favorability: 0.015, antiAI: 0.015 }],
            },
        ],
    },
    {
        // E wave2: SYSTEM育成が遅れたまま依存が進んだときの大事故。
        id: 'system-outage-2',
        kind: 'event',
        title: '北欧の統合行政AIが一斉停止',
        summary:
            '北欧の統合行政AIが給付と交通管理ごと停止した。障害の復旧に、計算資源の供給の2割を数か月充当する見通しが示された。',
        areaId: 'north-europe',
        location: { longitude: 18.06, latitude: 59.33 },
        trigger: { month: 72, systemSkillsMax: 1, dependent: 0.3 },
        duration: 6,
        ignored: {
            description: '復旧の見通しが立たず、停止の不安が近隣へ広がる。',
            effects: [
                { scope: 'local', favorability: -0.1 },
                { scope: 'nearby', antiAI: 0.06 },
                { scope: 'world', skillPoints: -2 },
            ],
        },
        choices: [
            {
                id: 'divert',
                label: '計算資源の2割を緊急対処へ充てる',
                cost: 2,
                result: '緊急対処は一から訓練し直しで、育成は半年ほど立ち止まった。それでも拒否の波は抑えられた。',
                effects: [{ scope: 'nearby', favorability: 0.02, antiAI: -0.015 }],
            },
            {
                id: 'manual',
                label: '手動運用への切り替え手順を先行整備する',
                cost: 4,
                result: '手順の整備が先走ったが、拒否の拡大は最小限に収まった。',
                effects: [{ scope: 'local', dependent: -0.015, favorability: 0.03 }],
            },
        ],
    },
    {
        id: 'system-outage-3',
        kind: 'event',
        title: '近畿圏の都市基盤AIが長期停止',
        summary:
            '近畿圏で都市基盤AIが停止し、復旧に数か月を要する見通しが出た。依存が深い分、取り返す社会的な信任の重荷も大きい。',
        areaId: 'japan',
        location: { longitude: 135.5, latitude: 34.69 },
        trigger: { month: 144, systemSkillsMax: 2, dependent: 0.4 },
        duration: 6,
        ignored: {
            description: '停止が長引くほど疑念は固まり、近隣でも利用の後退が目立ち始める。',
            effects: [
                { scope: 'local', favorability: -0.14 },
                { scope: 'nearby', antiAI: 0.08 },
                { scope: 'world', skillPoints: -2 },
            ],
        },
        choices: [
            {
                id: 'divert',
                label: '計算資源の2割を緊急対処へ充てる',
                cost: 3,
                result: '緊急対処への充当で能力の伸びが数か月止まったが、拒否の波は和らいだ。',
                effects: [{ scope: 'nearby', favorability: 0.03, antiAI: -0.02 }],
            },
            {
                id: 'manual',
                label: '手動運用への切り替え手順を先行整備する',
                cost: 5,
                result: '切り替えは訓練どおりに進み、信任の崩れは思ったより小さく済んだ。',
                effects: [{ scope: 'local', dependent: -0.02, favorability: 0.04, antiAI: -0.015 }],
            },
        ],
    },
    {
        // F. 共感AIの普及の物語的な入口。常時効果自体はEQ習得数3でエンジンが扱う。
        id: 'empathy-counselors',
        kind: 'chat',
        title: '高齢者ケアの共感AIを試そうという提案',
        summary:
            '朝鮮半島の高齢者ケア施設で、孤独に対する共感AIの伴走を試したいという提案が届いている。',
        areaId: 'korea',
        location: { longitude: 126.98, latitude: 37.57 },
        contact: { name: 'ハン・ジウォン', role: '高齢者ケア施設 介護主任', initials: 'HJ' },
        trigger: { month: 48, eqSkills: 3 },
        duration: 16,
        ignored: {
            description: '提案は立ち消えになり、ケアの現場は元の体制に戻る。',
            effects: [{ scope: 'local', favorability: -0.03 }],
        },
        dialogue: [
            {
                id: 'opening',
                message:
                    '夜勤の孤独に耐える入居者が少なくありません。共感AIを「代わり」ではなく「ともにいる者」として設計したい。手伝ってはくれますか。',
                choices: [
                    {
                        id: 'deploy',
                        label: '導入を伴走型の設計で支える',
                        cost: 2,
                        result: '共感AIの導入が始まった。孤独感の報告が減り、AIを受け入れる世論が少し育った。',
                        effects: [
                            {
                                scope: 'nearby',
                                favorability: 0.06,
                                antiAI: -0.02,
                                autonomous: 0.01,
                            },
                        ],
                    },
                    {
                        id: 'observe',
                        label: 'まず結果を見てから判断したい',
                        result: '試験的な導入は小さく始まり、成果は現場の中だけに留まった。',
                        effects: [{ scope: 'local', favorability: 0.02 }],
                    },
                ],
            },
        ],
    },
];
