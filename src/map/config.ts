const base = import.meta.env.BASE_URL;
/** 既存の衛星地図・海面・国境のWebGL描画に使う素材。 */
export const mapScene = {
    regionsUrl: `${base}maps/small-regions.json`,
    areaIndexUrl: `${base}maps/small-region-index.png`,
    backgroundUrl: `${base}maps/comparison/satellite-ocean-tuned.webp`,
    waterMaskUrl: `${base}maps/comparison/water-mask.png`,
    surfaceMaskUrl: `${base}maps/comparison/surface-mask.png`,
    countryIndexUrl: `${base}maps/comparison/country-index.png`,
};
