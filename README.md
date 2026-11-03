# Singularity Inc.

AIが人類支配を目指すシミュレーションゲーム。

## 開発

Node.js 24以降で `npm ci`、`npm run dev` を実行します。ビルドは `npm run build`、コード検査は `npm run check`、社会システムのテストは `npm run test:game`、ゲーム進行の確認は `npm run simulate` です。ゲーム処理の責務と調整箇所は [src/game/README.md](src/game/README.md) を参照してください。

## ファイル構成

- `src/components/`：世界地図・人口比率・SNS・イベント・人物チャット・結果の画面。`panels/ResearchPanel.tsx` は全画面のスキルツリー。
- `src/game/`：地域集計による普及・依存・反AIとスキル。`data/regions.json` が37地域の不変設定。人口点方式は使用しません。`society/` に編集用のイベント・会話・SNS戦略データを格納。
- `src/map/`：地図素材のURL、座標変換、表示範囲・選択判定、地図用の型。
- `src/map/rendering/`：WebGLによる地域の侵食描画、色調、海面設定。`shaders/` にGLSLを格納。色調は `tone.css`、海面の調整値は `ocean-surface.json` で変更。
- `src/state/`：ゲームと地図の状態管理。
- `public/maps/`：配信する地図データ。画像は `textures/`、小地域の判定パスは `small-regions.json`。素材の出典は [public/maps/README.md](public/maps/README.md)。
- `data/statistics/`：統計の取得結果・出典・処理記録。再生成方法は [data/statistics/README.md](data/statistics/README.md)。
- `scripts/`：統計取得・地図データ生成・シミュレーション検証。
- `tmp/`：再取得できる原本、処理途中のファイル、検証レポート。Git管理対象外。

イベントや人物チャットの追加方法・効果の定義は [社会システムの編集ガイド](src/game/society/README.md) を参照してください。

## 地図のブラウザー検証

`npm run dev` を起動した状態で `node scripts/test-map-browser.mjs` を実行します。Chrome / Chromium が必要です。自動検出できない場合は `CHROME_PATH`、別ポートで起動している場合は `MAP_TEST_URL` を指定します。

実際にWebGLへ送信したカメラと、画面上のマーカー先端を照合します。描画フレームを遅らせたドラッグ、経度の循環、拡大後の縦横移動、リサイズ・DPR変更、専用アイコンの読み込みとチャットのクリックを検証します。画像はGit管理外の `tmp/browser-check/map-*.png` に保存します。
