# 使用中の地図素材

既存の衛星地図と投影済み国境データを再利用しています。実行時に素材提供元へ接続しません。

- `textures/satellite-ocean-tuned.webp`：NASA Blue Marble Next Generation、2004年7月・海底地形付き版。既存の生成工程でメルカトル投影へ変換し、水域の輝度・色調を調整した画像です。海底部分は水深による着色・陰影であり、海面の写真そのものではありません。
  - NASA Earth Observatory: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/
- `textures/country-index.png`：Natural Earth 10mの国境・州省境から生成した国IDテクスチャ。国境線の描画に使用します。
- `small-regions.json`・`textures/small-region-index.png`：Natural Earth 10mの国境・州省境をゲームで管理する37地域へまとめた判定用パスとID画像。ホバー選択・強調表示に使用します。
- `textures/water-mask.png`・`textures/surface-mask.png`：地図の陸・水域の色調分離、海面シェーダーで使用する既存マスク。Natural Earthの陸地・湖データを基にしています。
  - Natural Earth: https://www.naturalearthdata.com/
  - 利用条件：パブリックドメイン。Made with Natural Earth.
  - https://www.naturalearthdata.com/about/terms-of-use/

投影は北緯75度〜南緯60度、幅8192px。地域境界と侵食領域はゲーム用の模式表現です。人口は地域ごとに管理し、個人の位置は描画しません。

小地域の境界は海面の合成後に描きます。選択線は境界の両側から判定し、隣の小地域側や海側にある画素でも白線を維持します。

国境線は不透明度6%、小地域線は14%（選択時30%）で描きます。共有部分は不透明度の最大値を一度だけ適用し、二重描画による濃さの増加を防ぎます。

`textures/invasion-rank.png` は `python scripts/build_invasion.py` で生成する描画専用のRGBアトラスです。左半分のRGにAI使用、右半分のRGにAI依存の16bit到達順、左半分のBに反AIの8bit到達順を記録します。起点は保存済みのGHSL人口サンプル `src/game/data/world.json` の高密度居住セルから選び、同一都市付近の点を間引きます。選択した座標は `data/statistics/invasion-processing.json` で確認できます。

都市間の模式的な接続帯、空間的に変化する通過コスト、海岸と地域境界を用いて、角を持つ4近傍の最小通過時間を計算します。都市の起点・経路は使用・依存・反AIで分け、依存は使用領域内に収めます。実際の道路網や都市ごとの普及率を再現するものではありません。人口モデルは37地域の集計のままで、都市サンプルはビルド時だけ読み込みます。地図の面積は実人口比率そのものではありません。

AI使用は青の約2pxの輪郭と間隔の広い斜線・薄い面色、AI依存は赤の輪郭と斜線なしの塗りつぶしで表示します。輪郭の不透明度は青72%・赤75%。依存の面色は元画像の色相を弱めた上に合成し、地形の明暗を残しながら緑・茶との混色による濁りを抑えます。反AIは黄土色の輪郭と斜線で描画し、他の二領域より優先します。表示順は固定され、月次の増減を補間して前線を進退させます。
