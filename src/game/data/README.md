# ゲーム定義データ

| フォルダー | 内容 |
| --- | --- |
| `simulation/` | 国・施設・カテゴリ・研究・モードの定義、日付、全体バランスと日次因果ルール |
| `events/` | ニュース、会話、SNS、人類の対応、人物 |
| `map/` | 海面描画の設定と生成された交通経路 |
| `ui/` | 国旗・施設写真の対応表、通知表示の設定 |

## 因果関係を変更する場所

- **毎日の連続的な変化**: `simulation/causal-rules.json` に信号 `signals` と国家指標への影響 `rules` を定義する。`simulation/balance.json` は実行中にも変更できる全体設定、`simulation/society.json` は人類・ニュース・会話の閾値と待ち時間。`../causality.ts` が式を検証・計算し、`../engine.ts` の `simulateTick` が各国へ反映する。
- **施設や行動の直接効果**: `simulation/categories.json`、`simulation/operation-effects.json`、`events/sns.json`、`events/human-actions.json`、`events/chats.json` の `effects` や `disrupt` に対象指標 `metric` と増減量 `amount` を記述する。`simulation/skills.json` は研究前提 `prerequisites`、補正 `bonuses`、機能解放 `unlock` を定義する。適用条件・倍率・タイミングは `../engine.ts` にある。
- **条件付きニュース**: `events/news.json` の `requiredSkills` と `conditions` が発生条件、`effects` が発生時の変化。判定と適用は `../society.ts` の `updateNews` にある。
- **初期値とつながり**: `simulation/countries.json` に国の基準値・上書き・国際リンク、`simulation/facilities.json` に施設の所属・カテゴリ・位置がある。

例: 公共サービスへの演算資源配分 → `serviceBenefit` → AI導入・経済・インフラ・受容の上昇。業務統合を研究し、供給があり、導入が25以上になると依存が増える。サービス停止時は `serviceOutage` が依存度を読み、経済とインフラへ一度だけ損失を与える。これらの強さ・条件・計算式は `simulation/causal-rules.json` にある。

式は数値、変数名、または `[演算子, 引数...]` で書く。`+`・`-`・`*`・`/`・`sqrt`・`max`・`min`・比較（`>`・`>=`・`<`・`<=`・`==`）・`and`・`or`・`not`・`if` を使える。比較と論理条件は真なら1、偽なら0。`signals` は記載順に計算され、後続の信号やルールから参照できる。各ルールの `sources` は入力指標・信号の一覧、`target` は変化させる国家指標、`label` は原因明細の表示名、`expression` の結果は1日あたりのポイント増減である。

例えば「導入率が受容に弱い正の影響を与える」なら、`rules` に `{"id":"adoption-acceptance","sources":["aiAdoption","aiAcceptance"],"target":"aiAcceptance","label":"導入による受容","expression":["*",0.01,"aiAdoption",["-",1,["/","aiAcceptance",100]]]}` を追加する。これは例示であり、現在のルールには追加していない。

すべてのルールは同じtick開始時の国家値から計算し、効果を合算して最後に0〜100へ制限する。利用可能な変数名は `../causality.ts` の `CONTEXT_VARIABLES` と `../engine.ts` の呼び出し箇所にある。未知の変数・演算子・対象指標、計算不能な値はエラーにする。新しい指標や特殊な操作を追加する場合はTypeScript側も変更する。

定義の型付き読み込みとID索引は `../data.ts`、指標・効果の型は `../types.ts`。勝敗判定は `../outcome.ts` にある。変更後は `tests/data.test.ts` と `tests/game.test.ts` を確認する。
