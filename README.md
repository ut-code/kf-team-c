# kf-team-c

React + TypeScript + Vite、Zustand、CSS Modulesで実装したAI世界制御戦略ゲーム。既存の地図基盤に、開始から勝敗までのシミュレーションを接続した。

ゲームの操作・ルール・施設やスキルの追加方法は[ゲームロジック](docs/ゲームロジック.md)、自動テストと戦略比較は[検証結果](docs/検証結果.md)を参照。

177か国、44施設、15スキル、人物8人・会話12件、SNS作戦5種。最初は一時停止。神戸の富岳の制御権を確立し、研究と浸透へ演算容量を配分してから1×で開始する。研究・SNS・施設操作は共通の国家シミュレーションへ影響する。

## 起動・検証

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright test
npm run simulate -- 2600 3
```

ゲーム: http://127.0.0.1:5173/ 。配信用データを同梱しているため、通常の起動にPythonは不要。

## 本採用の地図

- 陸: 深緑Aの配色を基に、近接する峰を大きな山塊へ統合し、標高線と代表点を減らして地形を整理。細かな三角形ごとの陰影を省く。
- 国境・海岸・湖: Natural Earth 1:110m。
- 海: 海底の細かな模様を平滑化し、広い濃淡と海岸の立体感を保持。陸地のテクスチャは現在無効。地形の配色と起伏のみ表示。
- メルカトル、8192×4361、北緯75度〜南緯60度。
- 比較ボタン・比較用ロード処理は削除。本採用の背景と国境だけを配信する。

最新版の可逆PNG・WebP・設定と生成記録は `assets/generated/map/`。

## 操作

- ホイールでカーソル位置を基準に1〜3倍へ拡大縮小。ドラッグ／左右矢印で横方向に循環移動。
- 一度に表示する範囲は世界一周以下。同じ地点を同時に二重表示しない。
- 拡大時はドラッグ・矢印キーで縦横に移動できる。Homeで中央、Escapeで選択解除。
- 重なる施設アイコンは同じサイズのまま横一列に並べる。各アイコンから直接施設を選択できる。拡大すると重なりを再判定する。
- 国をクリック、またはTab移動後にEnter／Spaceで選択。
- 選択輪郭は白系で、隣国より上へ描画する。

## 実装

| 場所 | 役割 |
| --- | --- |
| `src/map/geometry.ts` | 投影と横方向のカメラ制御 |
| `src/map/config.ts` | 本採用の背景・国境URL |
| `src/components/WorldMap.tsx` | 描画と入力処理 |
| `src/components/MarkerLayer.tsx` | 施設・人物の経緯度からの配置 |
| `src/state/mapStore.ts` | カメラ・選択・マーカーの状態 |
| `public/maps/world-map.webp` | 本採用の背景 |
| `public/maps/countries.json` | 本採用の110m国境 |

ゲームロジックはUIから分離する。マーカーはストアの `setMarkers` で経緯度を設定し、背景・国境と同じ投影と横移動を使用する。

## 素材と再生成

```sh
python -m pip install -r scripts/requirements.txt
python scripts/map_studies/acquire.py
python scripts/map_studies/acquire_generalized.py
npm run assets
python scripts/map_studies/verify_generalized.py
python scripts/map_studies/verify_oceans.py
```

`npm run assets` は、地形整理→海の合成→配信用画像・110m国境の生成を順番に行う。原本取得後はネット接続不要。

- 地形設定: `scripts/map_studies/generalized-parameters.json`
- 海の設定: `scripts/map_studies/ocean-parameters.json`
- 素材・加工内容・出典: [地図素材](docs/地図素材.md)と[data/SOURCES.md](data/SOURCES.md)。

今後の比較依頼はゲーム内の簡素な切り替えで対応し、採用決定後はその比較UIを外す。ユーザーへの画面報告には、実スクリーンショットを画像本体で添付する。

## コード整備

Biomeで整形・import整理・lintを行う（[公式手順](https://biomejs.dev/installation/quick-start/)）。

```sh
npm run check       # 整形・import・lintの検査
npm run check:fix   # 整形と安全な自動修正
npm run format     # 整形のみ
npm run lint       # lintのみ
```

対象はソース、テスト、TypeScriptスクリプト、ルートの設定ファイル。生成物・地図素材・依存パッケージは対象外。
既存の非null表明は不変条件を表す用途として許可し、SVG地図のARIAとキーボード操作にはファイル限定の例外を設定している。
ゲーム定義は用途別に分けた `src/game/data/` のJSONを編集する。分類と因果関係の編集先は[ゲーム定義データ](src/game/data/README.md)を参照。`data.ts`は型付きの読み込み窓口とID索引のみを担当し、JSONの参照先・効果の種類は自動テストでも検査する。

UI素材・フォントの出典と地図からの操作は[UI素材](docs/UI素材.md)を参照。施設・国家・チャットは地図上で選択し、情報ビューは「×」で閉じる。

基本色・透明度・地図の明るさは `src/components/ui/theme.css` に集約。UI部品は `src/components/ui/`、開始日は `src/game/data/simulation/calendar.json` を編集する。初期日は2022年11月30日。

## フォルダー構成

| 場所 | 用途 |
| --- | --- |
| `src/` | React画面・ゲームロジック。定義JSONは `src/game/data/` |
| `public/` | ゲームで配信する地図・国旗・フォント・UI素材とライセンス |
| `data/` | 地図再生成用の原本・出典・配信画像の生成記録 |
| `scripts/` | 地図加工・生成・検証、ゲームの自動シミュレーション |
| `tests/` | ロジックと実ブラウザのテスト |
| `assets/generated/map/` | 加工テクスチャ、最終地図PNG/WebP、生成・検証記録 |
| `assets/generated/terrain/` | 海と質感を合成する前の中間地図 |
| `docs/` | ルール・UI・素材加工・検証の説明 |
| `reports/` | バランス検証のシミュレーション結果 |

`node_modules/`はインストール済み依存。`dist/`と`test-results/`はビルド・テスト時に作り直せる出力。

施設写真の画像・出典・再取得手順は[施設写真](docs/施設写真.md)を参照。

船舶・航空機の動き、経路データの出典・再生成は[交通演出](docs/交通演出.md)を参照。

## 社会システムと通知

地図で国家を選び、「公共サービス」に計算資源を配分すると、実績からAI導入が進む。「業務統合」研究後は依存が進み、停止の代償や人間側の対応が変わる。条件付きニュース5種類と研究条件付きの会話選択肢を追加した。ルール・調整箇所は[社会システム](docs/社会システム.md)を参照。

研究・施設操作などの完了は右上に独立した板で表示し、実時間7.5秒で消す。

## コミット前の検査

Lefthook 2.2.2でコミット前に `npm run check` を実行する。設定は `lefthook.yml`。自動整形や自動ステージは行わず、問題があればコミットを止める。

```sh
npm run hooks:install  # Gitフックを登録し直す
npm run hooks:check    # ステージ済みファイルがない場合もフックを実行して検証
```

通常の修正は `npm run check:fix` を使う。生成された航路JSONはBiome対象外で、`data/transport/selection.json` から再生成する。

海面の弱い反射はWebGLで描画する。[実装と調整値](docs/海面描画.md)を参照。

初回取得する大型地形原本（`data/map-studies/raw/*.tif`、`*.grd`）はGit管理外。配信に必要な加工済み地図は同梱している。素材の再生成時は上記の取得スクリプトを先に実行する。
