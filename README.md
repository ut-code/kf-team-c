# 社会浸透シミュレーション

AIが人類支配を目指すシミュレーションゲーム。

## 開発

Node.js 24以降で `npm ci`、`npm run dev` を実行します。ビルドは `npm run build`、コード検査は `npm run check`、ゲーム進行の検証は `npm run simulate -- 1` です。

## ファイル構成

- `src/components/`：Reactによる画面・操作。`panels/` は操作パネル、`hud/` は世界指標・ニュース・操作ナビゲーション。
- `src/game/`：ゲームルール、人口集団の生成、ゲーム用データ。`data/world.json` は生成済みの人口・国別統計。
- `src/map/`：地図素材のURL、座標変換、表示範囲・選択判定、地図用の型。
- `src/map/rendering/`：WebGL描画、スプライト、色調、海面設定。`shaders/` にGLSLを格納。色調は `tone.css`、海面の調整値は `ocean-surface.json` で変更。
- `src/state/`：ゲームと地図の状態管理。
- `public/maps/`：配信する地図データ。画像は `textures/`、小地域の判定パスは `small-regions.json`。素材の出典は [public/maps/README.md](public/maps/README.md)。
- `data/statistics/`：統計の取得結果・出典・処理記録。再生成方法は [data/statistics/README.md](data/statistics/README.md)。
- `scripts/`：統計取得・地図データ生成・シミュレーション検証。
- `tmp/`：再取得できる原本、処理途中のファイル、検証レポート。Git管理対象外。
