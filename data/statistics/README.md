# 人口・社会統計の出典と処理

基準年は2020年です。公表統計・公表推計を初期条件に使用し、AIへの態度や将来の社会変化を実測値として扱いません。

## 人口分布

**GHS-POP R2023A、epoch 2020、WGS84、30秒角**を使用しています。1セルは緯度方向約0.93km、値はセル内の居住人口です。行政区の人口を、衛星画像から得た建物分布などに基づいて空間配分した公表推計です。

- 発行：European Commission, Joint Research Centre（JRC）。
- Schiavina, M.; Freire, S.; Carioli, A.; MacManus, K. (2023), GHS-POP R2023A.
- DOI： https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE
- 製品説明： https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php
- 原本URLとSHA-256：`sources.json`。
- 利用条件：© European Union、CC BY 4.0。原文は `GHSL-copyright.txt`。
- 変更内容：約1kmの居住セルから人口比例で層化抽出し、4,000個のゲーム用人口集団に集約。

所属国の照合にはNatural Earth公式リポジトリの10m admin-0国境を使用します。人口グリッドと同じ格子へ照合し、海岸に一部がかかるセルも対象にします。地図の外観・WebGLシェーダーは既存のものを維持しています。

- https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries.geojson
- Natural Earth：パブリックドメイン。https://www.naturalearthdata.com/about/terms-of-use/

### 抽出

1. 37小地域の境界を、国の組み合わせと米国・ロシア・インド・中国の州・省境による分割で定義します。この区分はゲームの設計で、公式の統計区分ではありません。
2. 各小地域の人口を元のグリッドから集計し、最大剰余法で点数を配分します。さらに小地域内の国の人口比で点数を配分します。
3. 各区分内でセルの人口を重みとする非復元抽出を行います。位置は選ばれた元セルの中心座標です。ジッター、地域中心への集中、無人地域の穴埋めは行いません。
4. 各点の代表人口は小地域の総人口を点数で割った値です。「元の1kmセルに数百万人が住む」という意味ではありません。元セルの実際の人口・密度も別に保持しています。
5. 初期位置・年齢区分の割り当ては固定です。ゲーム再開時の乱数で人口分布を変更しません。

集計対象は元データの世界人口約78.41億人の99.58%、約78.08億人です。北緯75度〜南緯60度の地図範囲と国境照合により約0.42%が対象外です。対象外の人口を架空の座標へ移動して補いません。

4,000点は163か国・地域に配置されています。小国を含む小地域の総人口を代表する抽象化で、すべての国に個別の点があるわけではありません。抽出誤差や区分内の集約があるため、国別の点の割合と人口比が完全に一致するものではありません。

処理の集計値、小地域別点数、元の人口総数、除外率、成果物ハッシュは `processing.json` にあります。

## 人口点の社会属性

世界銀行WDI APIから2020年を指定して取得しています。取得したJSONを、このフォルダーにそのまま保持しています。

| 指標コード | 内容・元の提供機関 |
| --- | --- |
| `SP.POP.TOTL` | 総人口。国連等。比較・確認用 |
| `SP.POP.0014.TO.ZS` | 0〜14歳人口比率。国連WPP |
| `SP.POP.1564.TO.ZS` | 15〜64歳人口比率。国連WPP |
| `SP.POP.65UP.TO.ZS` | 65歳以上人口比率。国連WPP |
| `IT.NET.USER.ZS` | インターネット利用者比率。ITU |
| `SP.URB.TOTL.IN.ZS` | 都市人口比率。国連等 |
| `SL.EMP.TOTL.SP.ZS` | 15歳以上の就業人口比率。ILOモデル推計 |
| `SL.AGR.EMPL.ZS` | 就業者に占める農業比率。ILOモデル推計 |
| `SL.IND.EMPL.ZS` | 就業者に占める工業比率。ILOモデル推計 |
| `SL.SRV.EMPL.ZS` | 就業者に占めるサービス業比率。ILOモデル推計 |

API、取得年、データ更新日、ファイルのハッシュは `sources.json` に記録しています。元の公表推計が更新されることはあります。

- API説明： https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries
- 年齢指標の説明： https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SP.POP.65UP.TO.ZS
- ILO指標の説明： https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.SRV.EMPL.ZS
- 利用条件：World Bank / 元提供機関、CC BY 4.0。https://datacatalog.worldbank.org/public-licenses

台湾の年齢構成は世界銀行の欠測を他国の値で代替せず、台湾内政部が公表した2020年9月末の値を別途収録しています。値と日付・原典URLは `supplemental-observations.json` に明記しています。台湾のインターネット利用率・就業率は補完していません。

- https://www.ris.gov.tw/info-liferay/app/channel/newsEnglishDetail/20282028

### 統計からモデルへの変換

- **年齢**：国別の3区分の人口比に従って層化して割り当てます。区分内の年齢は経年更新のために均等配置したモデル値で、その1kmセルで実測した年齢ではありません。画面では区分を表示します。
- **インターネット利用・就業率**：各点が所属する国の公表値を保持します。点単位の実測利用率・就業率と偽って表示しません。
- **就業者・産業区分**：国別の比率から再現可能な標本を割り当てます。特定のセルの実際の職業構成を示すものではありません。
- **主要接点**：年少世代は教育、高齢世代は医療生活、就業する集団は労働、その他は接続状況に応じて情報・行政へ対応させるゲーム上のルールです。
- **浸透係数**：人口密度・インターネット利用を入力にした共通のゲーム式です。「AI依存しやすさ」を実測した性格尺度ではありません。国別に手入力した気質やランダムな性格値はありません。
- **信頼・抵抗・共存制度**：国別の架空の政治・心理特性を初期値にせず、全地域で同じシナリオ初期値から開始します。以降はプレイ中の出来事とゲームのルールで変化します。
- **世代交代**：年齢を月次更新し、集団を新世代へ交代させます。人口規模は固定したゲームモデルであり、国連の将来人口予測を再現するものではありません。

欠測は `null` のまま保持します。現在の4,000点では、年齢区分の欠測は0点、インターネット利用率の欠測は89点、就業率の欠測は13点です。欠測にはその統計からの加点を適用せず、画面で「未収録」と表示します。他の国・別の年・任意の値で埋めません。

## 再取得・再生成

ゲーム実行時は生成済みデータだけを使用します。再生成時のみPythonと公開データへのネットワーク接続が必要です。

```powershell
python -m pip install --target tmp/python-packages -r scripts/requirements-statistics.txt
python scripts/acquire_statistics.py
python -c "import sys,runpy; sys.path.insert(0,'tmp/python-packages'); sys.path.insert(0,'scripts'); runpy.run_path('scripts/build_population.py',run_name='__main__')"
python -c "import sys,runpy; sys.path.insert(0,'tmp/python-packages'); sys.path.insert(0,'scripts'); runpy.run_path('scripts/build_small_regions.py',run_name='__main__')"
```

人口原本のZIPは約460MiB、展開後のGeoTIFFは数GBです。原本と処理中ファイルは `tmp/data/`、再配布する小さな生成結果は `src/game/data/world.json`、出典・処理記録はこのフォルダーへ置きます。必要な統計や分類が不足する場合はエラーで停止し、無関係な国への自動振り分けや架空の値による穴埋めは行いません。

## 地図表示での過密対策

統計座標は変更せず、メルカトル投影後の地図座標で人口点を最低3単位離して配置します（地図幅8192）。点の円は重なっていてもよいものとし、過度な密集だけを軽く緩和します。人口点の描画サイズは画面上で固定し、ズームによらず同じ大きさで表示します。分散後の位置は地図座標で保持します。クリック判定は同じ表示位置を使います。小地域の境界判定は人口点の分散とは独立して元の地形を使用します。

小地域境界とID画像は `scripts/build_small_regions.py` で人口点と共通の区分から生成します。

## 国内分割に使う行政境界

Natural Earth 10m admin-1の州・省ポリゴンを結合します。原本URL・ハッシュは `sources.json`、行政区ごとの小地域所属は `small-region-divisions.json`、生成した境界画像・判定パスのハッシュは `region-processing.json` に記録します。

- 米国：西部の州とその他の州。
- ロシア：ウラル・シベリア・極東の行政区と西部の行政区。
- インド：南部の州・マハーラーシュトラ州などと北部の州。
- 中国：西部の省・自治区と東部の省・直轄市。

緯線や経線で国内を切り分けません。行政区をどちらへまとめるかはゲーム上の区分です。国境線と小地域線は同じ形状・描画順・格子から作り、共有部分は一度だけ合成します。
