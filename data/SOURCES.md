# 現在使用する地図素材

## フォルダー案内

| 場所 | 内容 |
| --- | --- |
| `map-studies/raw/` | 地図生成の元データ |
| `map-studies/generalized-sources.json` | 地図素材の取得元 |
| `map-studies/manifest.json` | 地図生成時の入力・出力の記録 |
| `transport/raw/`・`transport/watercraft/` | 交通経路・船舶素材の原本 |
| `transport/selection.json`・`transport/manifest.json` | 交通経路の選択と生成記録 |
| `facility-photos/selections.json` | 施設写真の選択元 |

ゲーム中に読み込む定義JSONはこのフォルダーではなく、`src/game/data/` にある。構成と因果関係の編集先は `src/game/data/README.md` を参照。

- 環境色: Natural Earth II NE2_50M_SR（土地被覆を基にした地図画像）。氷雪: Natural Earth 10m Glaciated Areas。海岸・湖・国境: Natural Earth 110m。パブリックドメイン。Made with Natural Earth。
  https://www.naturalearthdata.com/about/terms-of-use/
- 標高・水深: GMT Earth Relief 06m（SRTM15+ v2.7由来）。Tozer, Sandwellほか。GMT配布時に31.5km幅で事前平滑化された派生データ。
  https://www.generic-mapping-tools.org/remote-datasets/earth-relief.html
  https://doi.org/10.1029/2019EA000658
  原著者の公開データ記録（CC BY 4.0）: https://figshare.com/articles/online_resource/Tozer_et_al_2019_SRTM15_GMT_Grids/7979780

## 現在の地図と再生成

ゲームで使う地図は `public/maps/`。`npm run assets` で、`data/map-studies/raw/` のEarth Relief、NE2_50M_SR.tif/tfw、10mの氷河域、110mの国境・陸・湖から再生成する。Pythonの依存パッケージは `scripts/requirements.txt` に記載する。

陸は平地・森林・砂漠・氷雪・山地・高山の六色を基本とし、小さな孤立領域を除去して直線の輪郭で描く。地表の斜面陰影やテクスチャは加えない。設定は `scripts/map_studies/generalized-parameters.json`。

海は浅海（水深700m未満）と深海の二色。基調色は浅海RGB(27,49,63)、深海RGB(20,38,52)。色の境界は角切りを3回適用して曲線化し、海底陰影は加えない。設定は `scripts/map_studies/ocean-parameters.json`。

海岸線は最終投影で被覆率を合成し、黒ずみを生む明暗加工は行わない。海面反射の強度は0.045、時間倍率は1.2。地図表示の明るさは `src/map/tone.css` の `--map-brightness: 1.25` で調整する。

生成に必要な中間画像と入力・出力の記録は `assets/generated/map/`、`assets/generated/terrain/` に保存する。検証には `python scripts/map_studies/verify_generalized.py` と `python scripts/map_studies/verify_oceans.py` を使用する。現在の見た目のプレビューは `reports/map-preview.png`。

森林の分類は、標高色を含むHYP画像から土地被覆を表すNatural Earth IIへ切り替えた。相対的な緑の強さで判定し、細長い島の森林が消えないよう森林用の整理尺度を使う。森林のある山では緑を優先し、緯度別に設定した森林限界より上だけ岩地へ変える。氷雪はNatural Earthの氷河域ポリゴンから分類する。どちらも地図表現用の簡略化で、現代の森林被覆率や氷河の最新分布を厳密に示すものではない。

原本の取得は `scripts/map_studies/acquire.py` と `scripts/map_studies/acquire_generalized.py`。土地被覆・氷河域の取得元とハッシュは `data/map-studies/landcover-sources.json`。

## ゲーム内の地図比較

設定画面の「[デバッグ用]世界地図の切り替え」で、現在の簡略化版、Natural Earth陰影版、NASA衛星写真版を切り替える。後半二種類はNatural Earth 50mの国境・海岸・船舶マスク・海面反射マスクを共用する。ゲームの国IDと日本語名は既存版と揃える。

Natural Earth陰影版はNE2_50M_SRの原画像を地図本体に使い、地形・土地被覆・連続的な色の変化を保つ。陸全体のRGBの平均と分散だけを現在の配色へ揃え、簡略化版の領域境界や色マスクは転用しない。写真版はNASA Blue Marble Next Generation（2004年7月、地形陰影付き）の全球衛星画像を使用する。航空機による写真ではないため、ゲーム内でも「衛星写真」と表示する。
https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/

取得元とハッシュは `data/map-studies/comparison-sources.json`。原本の取得は `python scripts/acquire_map_comparison.py`、比較版だけの再生成は `python scripts/build_map_comparison.py`。`npm run assets` にも比較版の生成を含める。出力は `public/maps/comparison/`、生成記録は `data/map-studies/comparison-manifest.json`。

標準表示はNASA海底地形付き版の海洋調整版。NASA原画像を投影し、水域の輝度に沿って落ち着いた青へ連続的に変換する。陸の写真は保持し、加工前の版も比較用に残す。画像の色調は `src/map/tone.css` で明るさ・コントラスト・彩度・セピア・色相を調整できる。海面反射は従来どおり画像の上へ重ねる。

## 追加の衛星画像候補

標準のNASA 2004年7月版に加え、同1月の冬季版、7月の地形陰影なし版、7月の海底地形付き版、NASA Black Marble 2016の夜間画像、EOX Sentinel-2 cloudless 2016を登録する。全候補で50m国境・海岸マスクを共用し、`src/map/tone.css` の設定も共通に適用する。選択してもカメラやゲーム進行は変えない。

NASAの月別画像は2004年のMODIS合成画像。海底地形付き版の海は水深からの着色・陰影を含み、夜間版はSuomi NPP / VIIRSの都市光を合成した画像である。いずれも最新の写真や単一時点の撮影ではない。
https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/
https://science.nasa.gov/earth/earth-observatory/night-light-maps-open-up-new-applications-90008/

EOX Sentinel-2 cloudless 2016はCC BY 4.0。公式WMSからEPSG:4326・2048×1024の全球プレビューを取得し、ゲームの投影へ変換する。ゲーム内にもプレビューであることと原本の解像度を表示する。地表の雲除去モザイクと配信元による海・極域の背景処理を使用する。出典は地図上へ常時表示する。
https://maps.eox.at/
https://cloudless.eox.at/documentation/faq

各原本のURL・SHA-256は `comparison-sources.json` に記録。`python scripts/acquire_map_comparison.py` で再取得し、`python scripts/build_map_comparison.py` で再生成、`python scripts/map_studies/verify_comparison.py` で候補登録・出力・海の画素・国境を検証する。

## 海底地形付き版の海洋調整

Google Maps / Earthの落ち着いた海色と控えめな陰影を見た目の参考に、NASA Blue Marble 2004年7月の海底地形付き版を加工した。Googleの画像や地形データはゲーム素材に使用していない。参考: https://maps.googleblog.com/2012/02/clearer-view-of-seafloor-in-google.html

`scripts/map_studies/satellite-ocean-tone.json` に最暗部・最明部のRGB、原画像の輝度範囲、ガンマを定義する。原画像の連続的な海底陰影を狭い色域へ写し、彩度・明暗差を抑え、黒に近い海を持ち上げる。50m陸マスクの被覆率で水域を選ぶ。海峡や地図端で分断された海、カスピ海などの内陸水域も同じトーンに揃え、陸を保護する。原画像の青くない小島や海氷も保持する。追加の海岸影や陸のぼかしは使用しない。

生成物: `public/maps/comparison/satellite-ocean-tuned.webp`。原画像と加工版のSHA-256、設定ファイルと生成コードのSHA-256は `comparison-manifest.json` に記録する。

表示時の色調は `src/map/tone.css` で陸と水域を別々に設定する。WebGLのシェーダーが同じ原画像と水域マスクを参照し、領域別の色調を適用してから全体の色調を適用する。背景画像の二重描画やCSSフィルターの中間面は使用しない。水域には海・黒海・カスピ海・湖を含む。設定の反映に画像の再生成は不要。

国IDテクスチャは `python scripts/build_country_index.py` で既存の国境SVGパスから生成する。出力は各地図ディレクトリの `country-index.png`。入力・出力のハッシュと国順は `data/map-studies/country-index-manifest.json` に記録する。画像はパレット用の識別子で、追加の地理素材は使用しない。
