import type { NewsDefinition } from '../game/society/news.ts';

// 初期の物語案をもとに、利用状況に応じた社会の報道を収録。原案: KoshiroIto。
// https://github.com/ut-code/kf-team-c/pull/6 / 1324a82c5dafab98e7870db6a71ce6d0464f13df
// 選択肢・抽選・SP報酬は持たず、開発した機能と社会の利用状況に沿って報じる。
export const WORLD_NEWS: NewsDefinition[] = [
    {
        id: 'early-adoption',
        title: '企業のAI導入、まず議事録と文書作成から',
        summary:
            'AIを試す企業では、議事録の整理や文書の下書きから導入を始める動きが目立つ。顧客への回答や契約の判断には、担当者の確認を残す例が多い。',
        areaId: 'us-west',
        skills: [],
        minAdoption: 0,
    },
    {
        id: 'japan-school',
        title: '日本の学校でAI利用の評価を見直し、答えより考え方を重視',
        summary:
            '日本の学校で、AIを使った課題の評価方法が議論されている。教員からは、提出物だけでなく、解き方を口頭で説明してもらう授業を増やす案が出た。',
        areaId: 'japan',
        skills: ['curriculum'],
        minAdoption: 0.03,
    },
    {
        id: 'india-phone',
        title: 'インドで低価格スマホのAI相談が拡大、通信費が課題に',
        summary:
            'インドで低価格のスマートフォンを使ったAI相談が広がっている。販売店には、回答の精度だけでなく、通信量や端末の発熱を確かめる客も訪れている。',
        areaId: 'india-north',
        skills: ['lightweight'],
        minAdoption: 0.03,
    },
    {
        id: 'africa-shop',
        title: '西アフリカの商店でAI在庫管理、停電に備えて帳簿も併用',
        summary:
            '西アフリカの商店で、商品の仕入れをAIに相談する利用が始まっている。停電や通信の途絶に備え、売上を紙の帳簿にも記録する店主がいる。',
        areaId: 'west-africa',
        skills: ['lightweight'],
        minAdoption: 0.03,
    },
    {
        id: 'europe-review',
        title: '西欧の法律事務所で、AIが示した判例の確認を徹底',
        summary:
            '西欧の法律事務所で、AIが作成した文書の出典を確認する手順が見直されている。若手の教育担当者は、調査時間の短縮が基礎知識の習得を妨げないか注視する。',
        areaId: 'west-europe',
        skills: ['retrieval'],
        minAdoption: 0.03,
    },
    {
        id: 'factory-automation',
        title: '中国沿岸の工場で保全業務にAI、現場の経験をどう残すか',
        summary:
            '中国沿岸の工場で、設備の異常をAIが分析する運用が広がっている。現場の責任者は、警告の理由を作業員に説明できる仕組みが必要だと話した。',
        areaId: 'china-coast',
        skills: ['automation'],
        minAdoption: 0.03,
    },
    {
        id: 'hospital-diagnosis',
        title: '米東海岸の医療機関で記録作成にAI、患者への説明は医師が担当',
        summary:
            '米東海岸の医療機関で、診療記録の下書きをAIに任せる動きが出ている。医師は記録の確認にかかる時間も含めて、診療への影響を調べている。',
        areaId: 'us-east',
        skills: ['knowledge'],
        minAdoption: 0.03,
    },
    {
        id: 'memory-privacy',
        title: '会話を覚えるAI、記憶を消す権利に関心',
        summary:
            '日本の消費者相談窓口に、AIが覚えた情報の削除方法について問い合わせが寄せられている。家族で端末を共有する利用者からは、記憶を分けて管理したいとの要望もある。',
        areaId: 'japan',
        skills: ['memory'],
        minAdoption: 0.03,
    },
    {
        id: 'work-entry',
        title: '新人の研修に変化、AIなしで判断する演習も',
        summary:
            '米西海岸の企業で、AIを使わずに見積もりや調査を行う新人研修が取り入れられている。人事担当者は、出力の誤りに気づけるだけの経験を持たせたいとしている。',
        areaId: 'us-west',
        skills: ['code', 'automation'],
        minAdoption: 0.12,
        minDependency: 0.2,
    },
    {
        id: 'care-access',
        title: '相談相手はAI、支援窓口につながらない人も',
        summary:
            '韓国の福祉関係者が、悩みをAIだけに話す利用者への支援を課題に挙げた。相談の入口が増える一方、人間の専門職に助けを求める時期が遅れる懸念がある。',
        areaId: 'korea',
        skills: ['care', 'companion'],
        minAdoption: 0.12,
        minDependency: 0.2,
    },
    {
        id: 'transport-contract',
        title: 'インド南部の運送業者、AIの配車案を変更できる契約を要求',
        summary:
            'インド南部の運送事業者の間で、AIが提示する配車案を人間が変更できる契約を求める動きが出ている。現場からは、道路事情を反映しやすくなるとの声が上がった。',
        areaId: 'india-south',
        skills: ['integration'],
        minAdoption: 0.03,
    },
    {
        id: 'public-language',
        title: 'カナダの行政窓口で翻訳AI、複雑な手続きは通訳も対応',
        summary:
            'カナダの自治体で、翻訳AIを使った相談窓口が運用されている。複雑な手続きでは通訳を手配し、機械翻訳だけで申請内容を確定しない方針を取る。',
        areaId: 'canada',
        skills: ['conversation', 'public'],
        minAdoption: 0.03,
    },
    {
        id: 'family-schedule',
        title: '家族の日程調整をAIに、予定変更の連絡が課題',
        summary:
            '日本で、家族の予定や買い物をまとめて管理するAIの利用が増えている。利用者からは、AIが変更した予定を家族全員に知らせてほしいとの声が聞かれた。',
        areaId: 'japan',
        skills: ['personalize', 'habit'],
        minAdoption: 0.1,
    },
    {
        id: 'software-check',
        title: '生成コードの審査、動作に加えて保守性も確認',
        summary:
            '米西海岸の開発現場で、AIが生成したコードを確認する作業の比重が増している。担当者は、動くだけでは採用せず、後から修正できるかも判断すると話した。',
        areaId: 'us-west',
        skills: ['code'],
        minAdoption: 0.03,
    },
    {
        id: 'science-record',
        title: '欧州の研究室でAI利用の記録を重視、実験の再現性を確保へ',
        summary:
            '欧州の研究者の間で、AIが提案した実験条件と採用理由を記録する動きが広がっている。結果を再現するには、候補を選んだ過程も残す必要があるという。',
        areaId: 'west-europe',
        skills: ['science', 'discovery'],
        minAdoption: 0.03,
    },
    {
        id: 'outage-drill',
        title: '日本の企業でAIを止める防災訓練、連絡網を再確認',
        summary:
            '日本の企業で、AIを使わずに従業員の安否や取引先への連絡を確認する訓練が行われた。自動化した手順を説明できる担当者が限られることが課題になった。',
        areaId: 'japan',
        skills: ['backbone', 'integration'],
        minAdoption: 0.2,
        minDependency: 0.35,
    },
    {
        id: 'human-service',
        title: '人が応対する窓口、予約の取りにくさが課題',
        summary:
            '西欧で、AIを介さず担当者に相談できる窓口への需要が高まっている。支援団体は、対面の手続きを残すだけでなく、待ち時間も短くする必要があると指摘した。',
        areaId: 'west-europe',
        skills: ['public', 'negotiation'],
        minAdoption: 0.15,
        minDependency: 0.25,
    },
    {
        id: 'decision-appeal',
        title: '北欧でAIの判断への異議申し立てに対応、説明担当者を育成へ',
        summary:
            '北欧の組織で、AIの判断に納得できない利用者への説明担当者を育てる動きが出ている。提案をそのまま伝えるだけでは、責任の所在が分からないとの指摘がある。',
        areaId: 'north-europe',
        skills: ['decision'],
        minAdoption: 0.15,
        minDependency: 0.3,
    },
    {
        id: 'personal-data',
        title: 'AIの引っ越し、会話履歴を移せるかが争点',
        summary:
            '米西海岸で、AIサービスの乗り換え時に会話や設定を移す方法への関心が高まっている。長く使うほど移行の負担が大きくなるとして、共通形式を求める声が出た。',
        areaId: 'us-west',
        skills: ['digital-twin', 'memory'],
        minAdoption: 0.15,
        minDependency: 0.3,
    },
    {
        id: 'independent-design',
        title: '中国の製造業で設計業務のAI依存、熟練者の退職に危機感',
        summary:
            '中国沿岸の製造業で、AIの提案を検証できる技術者の確保が課題になっている。設計担当者は、図面を作る力と、設計の妥当性を判断する力をともに育てたいと話した。',
        areaId: 'china-coast',
        skills: ['decision', 'autonomous'],
        minAdoption: 0.2,
        minDependency: 0.4,
    },

    {
        id: 'security-breach-1',
        title: '米西海岸の学習塾でAI相談履歴が問題に、保護者が管理の見直しを要求',
        summary:
            '米西海岸の学習塾で、AIとの相談履歴を誰が閲覧できるかが問題になっている。保護者団体は、成績データと家庭の相談を分けて管理するよう求めた。',
        areaId: 'us-west',
        skills: ['curriculum'],
        avoid: ['federated'],
    },
    {
        id: 'security-breach-2',
        title: '東欧の自治体で行政AIの給付審査を見直し、異議申し立ての窓口を検討',
        summary:
            '東欧の自治体で、AIが下した給付審査の判断を人間が再確認する制度が議論されている。担当者は、処理の速さと異議申し立てへの対応を両立したいとしている。',
        areaId: 'east-europe',
        skills: ['public'],
        avoid: ['permission'],
    },
    {
        id: 'security-breach-3',
        title: '首都圏の自治体でAI基盤の停止に備え、業務継続計画を見直し',
        summary:
            '首都圏の自治体で、AI基盤が停止した場合の業務継続計画を見直す動きが出ている。窓口の職員からは、紙の手順書が実際の業務に追いついていないとの声が上がった。',
        areaId: 'japan',
        skills: ['automation', 'backbone'],
        avoid: ['sandbox'],
        minDependency: 0.3,
    },
    {
        id: 'breakthrough-discovery',
        title: '米東海岸の研究拠点でAIが難病の治療物質候補を発見',
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
        title: '米東海岸の地方選で政策づくりにAI、根拠の公開を求める声',
        summary:
            '米東海岸の地方選で、AIを使って公約を作成する陣営が現れた。有権者団体は、予算の試算や政策案の出典を公開するよう求めている。',
        areaId: 'us-east',
        skills: ['public'],
        minDependency: 0.25,
    },
    {
        id: 'ai-marriage',
        title: '伴侶AIの契約終了、会話記録の扱いが争点に',
        summary:
            '西欧で伴侶AIの利用契約をめぐる相談が増えている。消費者団体は、サービス終了時に会話記録を持ち出せる仕組みや、解約を妨げない設計を求めた。',
        areaId: 'west-europe',
        skills: ['companion', 'digital-twin', 'care'],
        minDependency: 0.15,
    },
    {
        id: 'marriage-backlash',
        title: '西欧で伴侶AIの利用者と家族向けの相談会、孤独の緩和と依存への不安',
        summary:
            '西欧の支援団体が、伴侶AIの利用者と家族を対象に相談会を開いた。参加者からは、孤独が和らいだという声と、生活の判断まで任せることへの不安が聞かれた。',
        areaId: 'west-europe',
        skills: ['companion', 'digital-twin', 'care'],
        after: 'ai-marriage',
    },
    {
        id: 'system-outage-2',
        title: '北欧の自治体で行政AIを止める訓練、手作業での給付判断に課題',
        summary:
            '北欧の自治体で、行政AIを止めた状態で窓口業務を続ける訓練が行われた。担当者は、給付の優先順位を職員だけで判断する難しさが浮かんだとしている。',
        areaId: 'north-europe',
        skills: ['public'],
        minDependency: 0.25,
    },
    {
        id: 'system-outage-3',
        title: '都市基盤の手動運用、人材確保が壁に',
        summary:
            '日本の都市基盤を担う事業者の間で、AIを使わずに設備を動かせる人材の確保が課題になっている。ベテラン技術者は、手動運用の訓練を継続する必要があると話す。',
        areaId: 'japan',
        skills: ['public', 'backbone'],
        minDependency: 0.4,
        after: 'system-outage-2',
    },
    {
        id: 'empathy-counselors',
        title: '韓国の介護施設で会話AI、夜間の相談を支援',
        summary:
            '韓国の介護施設で、夜間に入居者の話し相手になるAIの利用が広がっている。介護主任は、体調の変化を見逃さないため、会話の内容を職員が確認する時間も必要だと話した。',
        areaId: 'korea',
        skills: ['care'],
        author: 'ハン・ジウォン / 高齢者ケア施設 介護主任',
    },
];
