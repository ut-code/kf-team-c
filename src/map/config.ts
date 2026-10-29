/** 地表の凹凸を陰影で描かず、岩地の色で山岳帯を表す。海岸線と海面の修正は維持する。 */
export const mapConfig = {
    backgroundUrl: `${import.meta.env.BASE_URL}maps/world-map.webp`,
    countriesUrl: `${import.meta.env.BASE_URL}maps/countries.json`,
    waterMaskUrl: `${import.meta.env.BASE_URL}maps/water-mask.png`,
    surfaceMaskUrl: `${import.meta.env.BASE_URL}maps/surface-mask.png`,
};

/** 比較時もカメラ・国の選択・ゲーム進行は共通にする。 */
export const mapVariants = {
    current: {
        label: '現在の地図（簡略化）',
        backgroundUrl: mapConfig.backgroundUrl,
        detailedBorders: false,
        waterMaskUrl: mapConfig.waterMaskUrl,
        surfaceMaskUrl: mapConfig.surfaceMaskUrl,
    },
    naturalEarth: {
        label: 'Natural Earth（陰影・高精細国境）',
        backgroundUrl: `${import.meta.env.BASE_URL}maps/comparison/natural-earth.webp`,
        detailedBorders: true,
        waterMaskUrl: `${import.meta.env.BASE_URL}maps/comparison/water-mask.png`,
        surfaceMaskUrl: `${import.meta.env.BASE_URL}maps/comparison/surface-mask.png`,
    },
    satellite: {
        label: '衛星写真（NASA・高精細国境）',
        backgroundUrl: `${import.meta.env.BASE_URL}maps/comparison/satellite.webp`,
        detailedBorders: true,
        waterMaskUrl: `${import.meta.env.BASE_URL}maps/comparison/water-mask.png`,
        surfaceMaskUrl: `${import.meta.env.BASE_URL}maps/comparison/surface-mask.png`,
    },
};
export type MapVariant = keyof typeof mapVariants;
export const detailedCountriesUrl = `${import.meta.env.BASE_URL}maps/comparison/countries.json`;
