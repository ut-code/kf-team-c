# 現在使用する地図素材

## フォルダー案内

| 場所 | 内容 |
| --- | --- |
| `map-studies/raw/` | 地図生成の元データ |
| `map-studies/generalized-sources.json` | 地図素材の取得元 |
| `map-studies/manifest.json` | 地図生成時の入力・出力の記録 |
| `materials/ambientcg/` | 地表テクスチャの原本 |
| `transport/raw/`・`transport/watercraft/` | 交通経路・船舶素材の原本 |
| `transport/selection.json`・`transport/manifest.json` | 交通経路の選択と生成記録 |
| `facility-photos/selections.json` | 施設写真の選択元 |

ゲーム中に読み込む定義JSONはこのフォルダーではなく、`src/game/data/` にある。構成と因果関係の編集先は `src/game/data/README.md` を参照。

- 環境色: Natural Earth HYP_50M_SR。海岸・湖・国境: Natural Earth 110m。パブリックドメイン。Made with Natural Earth。
  https://www.naturalearthdata.com/about/terms-of-use/
- 標高・水深: GMT Earth Relief 06m（SRTM15+ v2.7由来）。Tozer, Sandwellほか。GMT配布時に31.5km幅で事前平滑化された派生データ。
  https://www.generic-mapping-tools.org/remote-datasets/earth-relief.html
  https://doi.org/10.1029/2019EA000658
  原著者の公開データ記録（CC BY 4.0）: https://figshare.com/articles/online_resource/Tozer_et_al_2019_SRTM15_GMT_Grids/7979780
- 地表質感: ambientCG Ground037 / Grass004 / Ground054 / Snow001 / Rock035、CC0 1.0。分類別に微細な粒と大きな色むらを整理し、低コントラストに加工。
  https://ambientcg.com/view?id=Ground037
  https://docs.ambientcg.com/license/

現在の原本は `data/map-studies/raw/` のEarth Relief、HYP_50M_SR.tif/tfw、110mの国境・陸・湖と、`data/materials/ambientcg/` 内の5種類のColor画像。
加工設定と入力・出力のハッシュは `assets/generated/map/生成記録.json` と `assets/generated/terrain/生成記録.json`。

ゲームで使う地図は `public/maps/`。`npm run assets` で再生成する。平地と海底の配色は、水彩画風に変更する前の `37c8f58` の設定を基準にしている。海岸線の最終投影での被覆率合成、黒ずみを生む海岸の明暗加工の停止、控えめな海面反射は維持する。

山岳表現の試作: 地表の斜面陰影と標高による明度加算を取り除き、標高と周辺の高低差から山岳帯を抽出する。山岳帯は灰褐色の岩地、高所は明るめの岩色で表し、氷雪と湖は維持する。設定は `scripts/map_studies/generalized-parameters.json`。

地面の色の境界は、分類した領域の細い突起・切れ込みを矩形の開閉処理で取り除いてから、小領域を省き、直線の輪郭を単純化する。色のぼかしや曲線化は加えず、山岳帯の形・海岸線・国境はこの整理の対象にしない。

山岳帯は山地と高山の二段階の岩色に分け、直線の輪郭で描画する。海洋は水深700mを目安に浅海と深海の二色へ整理し、海底陰影や連続的な色の変化を除去した。海岸の被覆率合成と海面反射の設定は維持する。

海洋の色は浅海（水深700m未満）と深海の二色。海洋の色の境界は角切りを3回適用して曲線化する。陸の境界と海岸線自体は維持し、陰影や広いグラデーションは加えない。

地図表示の明るさは `src/components/ui/theme.css` の `--map-brightness: 1.25` で調整する。従来の1.07から約17%明るくし、地面・海の両方に適用する。

海洋の基調色を深海RGB(20,38,52)、浅海RGB(27,49,63)へ少し明るく調整した。海面の反射強度は0.045、時間倍率は1.2とし、従来より反射を見やすく、揺らぎを1.5倍速くした。海全体の色を覆う着色と黒い陰影は加えない。

陸の色数を整理: 森林・砂漠・氷雪の分類を一段階にし、中間色の帯を省いた。平地・森林・砂漠・氷雪・山地・高山の六色を基本とし、小さな孤立領域の除去を少し強めた。海洋の色と揺らぎ、地図の明るさは維持する。
