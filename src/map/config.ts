/** 地表の凹凸を陰影で描かず、岩地の色で山岳帯を表す。海岸線と海面の修正は維持する。 */
export const mapConfig = {
    backgroundUrl: `${import.meta.env.BASE_URL}maps/world-map.webp`,
    countriesUrl: `${import.meta.env.BASE_URL}maps/countries.json`,
    waterMaskUrl: `${import.meta.env.BASE_URL}maps/water-mask.png`,
    surfaceMaskUrl: `${import.meta.env.BASE_URL}maps/surface-mask.png`,
};
