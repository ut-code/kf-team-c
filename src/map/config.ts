/** 地表の凹凸を陰影で描かず、岩地の色で山岳帯を表す。海岸線と海面の修正は維持する。 */
export const mapConfig = {
    backgroundUrl: `${import.meta.env.BASE_URL}maps/world-map.webp`,
    countriesUrl: `${import.meta.env.BASE_URL}maps/countries.json`,
    countryIndexUrl: `${import.meta.env.BASE_URL}maps/country-index.png`,
    waterMaskUrl: `${import.meta.env.BASE_URL}maps/water-mask.png`,
    surfaceMaskUrl: `${import.meta.env.BASE_URL}maps/surface-mask.png`,
};

const nasaCredit = 'NASA Earth Observatory';
const nasaUrl = 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/';

function comparisonMap(
    label: string,
    filename: string,
    description: string,
    attribution: string,
    attributionUrl: string,
) {
    return {
        label,
        description,
        attribution,
        attributionUrl,
        backgroundUrl: `${import.meta.env.BASE_URL}maps/comparison/${filename}`,
        detailedBorders: true,
        countryIndexUrl: `${import.meta.env.BASE_URL}maps/comparison/country-index.png`,
        waterMaskUrl: `${import.meta.env.BASE_URL}maps/comparison/water-mask.png`,
        surfaceMaskUrl: `${import.meta.env.BASE_URL}maps/comparison/surface-mask.png`,
    };
}

/** 比較時もカメラ・国の選択・ゲーム進行は共通にする。 */
export const mapVariants = {
    current: {
        label: '簡略化した地図',
        description: '六色を基本に土地被覆を整理した地図。',
        attribution: 'Made with Natural Earth',
        attributionUrl: 'https://www.naturalearthdata.com/',
        backgroundUrl: mapConfig.backgroundUrl,
        detailedBorders: false,
        countryIndexUrl: mapConfig.countryIndexUrl,
        waterMaskUrl: mapConfig.waterMaskUrl,
        surfaceMaskUrl: mapConfig.surfaceMaskUrl,
    },
    naturalEarth: comparisonMap(
        'Natural Earth（陰影）',
        'natural-earth.webp',
        '原画像の地形・土地被覆を残し、全体の色調を簡略化版へ揃えた地図。',
        'Made with Natural Earth',
        'https://www.naturalearthdata.com/',
    ),
    satelliteOceanTuned: comparisonMap(
        'NASA 海底地形（海洋調整・標準）',
        'satellite-ocean-tuned.webp',
        '2004年7月のBlue Marble海底地形付き版。海の彩度と明暗差を抑え、陸の写真は保持。',
        nasaCredit,
        nasaUrl,
    ),
    satellite: comparisonMap(
        'NASA 2004年7月（地形陰影付き）',
        'satellite.webp',
        'Blue Marble。北半球の夏、地形陰影付き。海洋調整前の比較用。',
        nasaCredit,
        nasaUrl,
    ),
    satelliteWinter: comparisonMap(
        'NASA 2004年1月（冬季）',
        'satellite-winter.webp',
        'Blue Marble。北半球の冬の積雪・植生を比較できる。地形陰影付き。',
        nasaCredit,
        nasaUrl,
    ),
    satellitePlain: comparisonMap(
        'NASA 2004年7月（地形陰影なし）',
        'satellite-plain.webp',
        'Blue Marbleの基本画像。追加の地形陰影を含まない。',
        nasaCredit,
        nasaUrl,
    ),
    satelliteBathymetry: comparisonMap(
        'NASA 2004年7月（海底地形付き）',
        'satellite-bathymetry.webp',
        'Blue Marble。陸の衛星画像に地形・水深の陰影を組み合わせた版。海は写真そのものではない。',
        nasaCredit,
        nasaUrl,
    ),
    satelliteSentinel2: comparisonMap(
        'Sentinel-2 cloudless（EOX・2016・プレビュー）',
        'satellite-sentinel2.webp',
        'Copernicus Sentinel-2の雲除去モザイク。2016年版、原本2048px幅の全球プレビュー。海などには配信元の背景処理を含む。',
        'EOxCloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
        'https://cloudless.eox.at/',
    ),
    satelliteNight: comparisonMap(
        'NASA Black Marble（夜間・2016）',
        'satellite-night.webp',
        'Suomi NPP / VIIRSによる夜間の都市光の合成画像。昼間の地表写真とは異なる比較用。',
        nasaCredit,
        'https://science.nasa.gov/earth/earth-observatory/night-light-maps-open-up-new-applications-90008/',
    ),
};
export type MapVariant = keyof typeof mapVariants;
export const detailedCountriesUrl = `${import.meta.env.BASE_URL}maps/comparison/countries.json`;
