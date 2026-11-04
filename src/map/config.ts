const base = import.meta.env.BASE_URL;
/** 既存の衛星地図・海面・国境のWebGL描画に使う素材。 */
export const mapScene = {
    invasionUrl: `${base}maps/textures/invasion-rank.png?v=urban-front`,
    regionsUrl: `${base}maps/small-regions.json`,
    areaIndexUrl: `${base}maps/textures/small-region-index.png`,
    backgroundUrl: `${base}maps/textures/satellite-ocean-tuned.webp`,
    waterMaskUrl: `${base}maps/textures/water-mask.png`,
    surfaceMaskUrl: `${base}maps/textures/surface-mask.png`,
    countryIndexUrl: `${base}maps/textures/country-index.png`,
};
