# UI素材と現在の操作

## UI部品と編集箇所

Softline UI Kitは廃止し、汎用UI部品を自作する。色と質感、画面配置、ゲーム内容を分離する。

| 編集したい内容 | ファイル |
| --- | --- |
| 基本色・透明度・かすれの強さ・地図の明るさ | `src/components/ui/theme.css` |
| ボタン・アイコンボタン・入力欄・選択欄 | `src/components/ui/Controls.tsx`、`Primitives.module.css` |
| 情報ビュー共通の半透明背景 | `src/components/ui/Panel.tsx`、`Primitives.module.css` |
| 上部統計・左下の日付と速度 | `src/components/game/GameHud.tsx`、`GameHud.module.css` |
| 下部中央メニュー・各ビューの配置 | `src/components/GameApp.tsx`、`GameApp.module.css` |
| 開始日 | `src/game/data/simulation/calendar.json` |
| 暦日の計算 | `src/game/calendar.ts` |

`theme.css`の基本色は、黒寄りの面、通常文字、補助文字、明るい文字、オレンジ、控えめな強調色、危険色、境界線、支配領域に役割を分ける。各画面で別々の色を増やさず、これらを参照する。

- `--map-brightness: 1.3`：元の地図を30%明るく表示。地形画像そのものは変更しない。
- `--surface-opacity: 0.84`：情報ビューの黒い面の不透明度。
- `--surface-grain-opacity: 0.065`：薄い粒状のかすれ。`public/ui/surfaces/grain.svg`を共用する。
- 閉じるアイコンは`--color-accent`のオレンジ。

## アイコン・字体

- アイコンは手書きせず、[Lucide](https://lucide.dev/)の無料アセットを利用。ISCライセンス等の原文を`public/licenses/lucide-LICENSE.txt`に同梱。地図の引出線や枠など単純な幾何形状は描画コードで処理する。
- 字体はローカル配信。フォント取得の外部APIは起動時に呼ばない。
- 国旗は[flag-icons](https://github.com/lipis/flag-icons)（MIT）。`public/flags/LICENSE.txt`を同梱。北キプロスとソマリランドはWikimedia CommonsのPublic domain版。

- 字体は [Noto Sans JP](https://github.com/google/fonts/tree/main/ofl/notosansjp)（SIL OFL 1.1）。`public/fonts/NotoSansJP.ttf` とライセンスを同梱。文字のかすれフィルターは使用しない。

## 初期画面と日付

情報ビューは最初すべて閉じる。基本統計は画面上部の小さな表示にまとめ、日付と速度操作は左下、研究・計算資源・SNS・設定のメニューは下部中央に置く。

開始日は暫定で **2022年11月30日**。根拠は[OpenAIのChatGPT公開記事](https://openai.com/index/chatgpt/)。開始時のtick 0がこの日付で、1tickで翌日へ進む。UTCで計算するため、端末の時差や夏時間によって日付が変わらない。

## 操作

- 国家は地図の国形状、施設は施設アイコン、チャットは未読の封筒アイコンから開く。
- シンガポールには既存110m地図に国形状がないため、同じ経緯度付近に国家マーカーを置く。国家状態も追加済み。
- 近接アイコンは画面上で展開し、本来の位置と引出線で結ぶ。施設の緯度・経度はユーザー指定の値をそのまま保存する。
- チャットの到着だけでは時間を止めない。開いて返信を選んでいる間だけ停止する。
- 国家の接続ネットワークは従来のルールを維持し、情報ビューには接続先を表示しない。
- 導入ウィンドウ、施設一覧、国家選択プルダウン、常設ログ、凡例、装飾的な製品名は表示しない。
- 「浸透進捗」は各国の浸透度の影響力加重平均であり、支配済みの割合ではないためHUDから削除。「支配率」は支配が成立した国の影響力ウェイトの割合を表示する。
- CUは仮の容量単位であり実在の性能単位ではないため表示から削除。「計算資源」は利用可能量と総量を表示する。

施設は指定一覧の44件へ更新。初期アクセス先は神戸の富岳（`f11`）。定義は`src/game/data/simulation/facilities.json`にあり、場所・元ネタ・緯度・経度も収録。

基本統計は日本語の指標名と数値を上下に配置。停止時の `Paused` は統計面から離した独立表示で、赤枠を薄く付ける。下部メニューは各ボタンに境界を設け、PC・390px幅の双方で画面内へ収める。
