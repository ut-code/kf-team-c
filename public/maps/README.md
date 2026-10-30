# 使用中の地図素材

既存の衛星地図と投影済み国境データを再利用しています。実行時に素材提供元へ接続しません。

- `comparison/satellite-ocean-tuned.webp`：NASA Blue Marble Next Generation、2004年7月・海底地形付き版。既存の生成工程でメルカトル投影へ変換し、水域の輝度・色調を調整した画像です。海底部分は水深による着色・陰影であり、海面の写真そのものではありません。
  - NASA Earth Observatory: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/
- `comparison/country-index.png`：Natural Earth 10mの国境・州省境から生成した国IDテクスチャ。国境線の描画に使用します。
- `small-regions.json`・`small-region-index.png`：Natural Earth 10mの国境・州省境を人口点と同じ37小地域へまとめた判定用パスとID画像。ホバー選択・強調表示に使用します。
- `comparison/water-mask.png`・`surface-mask.png`：地図の陸・水域の色調分離、海面シェーダーで使用する既存マスク。Natural Earthの陸地・湖データを基にしています。
  - Natural Earth: https://www.naturalearthdata.com/
  - 利用条件：パブリックドメイン。Made with Natural Earth.
  - https://www.naturalearthdata.com/about/terms-of-use/

投影は北緯75度〜南緯60度、幅8192px。地図上の人口点と小地域はゲーム用に生成した模式表現です。

小地域の境界は海面の合成後に描きます。選択線は境界の両側から判定し、隣の小地域側や海側にある画素でも白線を維持します。

国境線は不透明度6%、小地域線は14%（選択時30%）で描きます。共有部分は不透明度の最大値を一度だけ適用し、二重描画による濃さの増加を防ぎます。
