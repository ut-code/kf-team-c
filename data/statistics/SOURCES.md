# 地図・統計データの出典

ゲーム実行時は生成済みデータだけを読み込みます。人口計算は `src/game/data/regions.json` の37地域単位です。
`src/game/data/world.json` の人口点は地図生成時の都市起点の選択に使用します。

- **NASA Blue Marble Next Generation**：衛星地図。2004年7月・海底地形付き版をメルカトル投影し、水域の色調を調整しています。[原典](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/)。
- **Natural Earth 10m**：国境・州省境、陸地・湖。ゲーム用37地域に集約し、判定パスと境界・マスク画像に変換しています。Made with Natural Earth。[利用条件（パブリックドメイン）](https://www.naturalearthdata.com/about/terms-of-use/)。
- **GHS-POP R2023A、epoch 2020、WGS84、30秒角**：Schiavina, M.; Freire, S.; Carioli, A.; MacManus, K. (2023), European Commission, Joint Research Centre。© European Union、CC BY 4.0。[DOI](https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE)。原文は `GHSL-copyright.txt`。居住人口グリッドを37地域へ集計し、人口比例で4,000点を抽出しています。地図生成では高密度居住セルから都市起点を選びます。
- **World Bank WDI（2020年）**：人口・年齢（国連等）、インターネット利用（ITU）、都市人口（国連等）、就業・産業比率（ILO）。[API](https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries)、[利用条件（CC BY 4.0）](https://datacatalog.worldbank.org/public-licenses)。
- **台湾内政部（2020年9月末）**：世界銀行で欠測する台湾の年齢構成。[原典](https://www.ris.gov.tw/info-liferay/app/channel/newsEnglishDetail/20282028)。補足値と日付は `supplemental-observations.json`。

原本URL・SHA-256は `sources.json`、人口集計・抽出結果は `processing.json`、行政境界の区分は `small-region-divisions.json`、境界生成記録は `region-processing.json`、侵食の都市起点・処理記録は `invasion-processing.json` に保持しています。
地図の塗り面積と都市間の接続帯はゲーム用の模式表現で、実際の利用者分布や道路網ではありません。

## 再生成

Pythonの依存パッケージは `scripts/requirements-statistics.txt` を参照してください。
取得原本と処理中ファイルはGit管理外の `tmp/data/` に置きます。

```sh
python3 -m pip install -r scripts/requirements-statistics.txt
python3 scripts/acquire_statistics.py
python3 scripts/build_population.py
python3 scripts/build_small_regions.py
python3 scripts/build_map_display.py
python3 scripts/build_invasion.py
```

都市起点を更新せず侵食画像だけを再生成する場合は `python3 scripts/build_visual_invasion.py` を実行します（標準ライブラリのみ）。
表示用の縮小画像は `build_map_display.py` が元画像から生成します。元画像は再生成用に保持しています。
