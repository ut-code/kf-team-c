# Singularity Inc.

AIが人類支配を目指すシミュレーションゲーム。React・TypeScript・Viteで構築しています。

## 開発

Node.js 24以降を使用します。

```sh
npm ci
npm run dev
```

`npm run build` でビルド、`npm run preview` で確認できます。

## 検証

- `npm run check`：コード検査。
- `npm run test:game`：ゲーム処理のテスト。
- `npm run test:skill-layout`：開発用のスキル配置保存APIのテスト。
- `npm run check:skill-layout`：スキル配置の検査。
- `npm run balance -- --verify`：ゲーム進行のシミュレーション。

## 構成

- `src/components/`：ゲーム画面、スキルツリー、SNS・調査パネル。
- `src/content/`：スキル、研究、ニュース、SNSの定義。
- `src/game/`：37地域の人口・経済・スキル・研究のシミュレーション。
- `src/map/`：地図の座標処理とWebGL描画。
- `src/state/`：ゲームと地図の状態管理。
- `public/`：配信する地図とアイコン。
- `scripts/`：検証、シミュレーション、地図・統計データの生成。
- `data/statistics/`：統計原本、出典、処理記録。[素材の出典と再生成](data/statistics/SOURCES.md)。
- `tmp/`：取得原本、処理途中のファイル、検証レポート（Git管理外）。
