# 現在使用する地図素材

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
