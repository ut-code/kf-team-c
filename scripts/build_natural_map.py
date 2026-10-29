"""Natural Earth原画像と50m国境を使う比較版を生成する。"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy.ndimage import distance_transform_edt, label, gaussian_filter

import build_map as game
from map_studies.build import Projection, polygons

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/map-studies/raw'
OUT = ROOT / 'public/maps/natural-earth'


def grade_land(image):
    """元画像の細かな陰影を抑え、連続的に調色する。輪郭や標高は生成しない。"""
    rgb = np.asarray(image, dtype=np.float32)
    luminance = rgb @ np.array([.2126, .7152, .0722], dtype=np.float32)
    # 最終8192pxの地図で数画素の谷筋を抑え、大きな斜面の明暗を残す。
    broad = gaussian_filter(luminance, 6, mode=('nearest', 'wrap'))
    rgb += (broad-luminance)[..., None]*.9
    rgb *= np.array([.76, .72, .64], dtype=np.float32)
    rgb += np.array([3, 5, 12], dtype=np.float32)
    # 雪氷の中立色は保ち、茶色に染めない。
    source = np.asarray(image, dtype=np.float32)
    neutral = np.clip((18-np.ptp(source, axis=2))/18, 0, 1)
    bright = np.clip((broad-205)/35, 0, 1)*neutral
    snow = broad[..., None]*.86 + np.array([0, 3, 5], dtype=np.float32)
    rgb = rgb*(1-bright[..., None])+snow*bright[..., None]
    return Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = 240_000_000
    config = json.loads((ROOT / 'scripts/map_studies/parameters.json').read_text())
    projection = Projection(config['projection'])
    with Image.open(RAW / 'HYP_50M_SR.tif') as source:
        projected = projection.raster(source.convert('RGB'), [24, 48, 65])
    top = (math.pi-game.NORTH_Y)/(2*math.pi)*projected.height
    bottom = (math.pi-game.SOUTH_Y)/(2*math.pi)*projected.height
    land_image = projected.transform((game.WIDTH, game.HEIGHT), Image.Transform.EXTENT,
                                     (0, top, projected.width, bottom), Image.Resampling.BICUBIC)
    land_image = grade_land(land_image)
    mask = Image.new('L', (game.WIDTH*2, game.HEIGHT*2))
    draw = ImageDraw.Draw(mask)
    for feature in json.loads((RAW / 'ne_50m_land.geojson').read_text(encoding='utf-8'))['features']:
        for polygon in polygons(feature['geometry']):
            for index, ring in enumerate(polygon):
                clipped = game.clip_latitude(game.clip_latitude(ring, -60, True), 75, False)
                if len(clipped) >= 3:
                    draw.polygon([(x*2, y*2) for x,y in [game.project(lon, lat) for lon,lat,*_ in clipped]], fill=255 if index == 0 else 0)
    mask = mask.resize((game.WIDTH, game.HEIGHT), Image.Resampling.BOX)
    # 内海は原画像の色をそのまま表示する。
    enclosed, _ = label(np.asarray(mask) == 0)
    sizes = np.bincount(enclosed.ravel()); sizes[0] = 0
    inland = Image.fromarray(np.uint8((enclosed > 0) & (enclosed != sizes.argmax()))*255)
    land_image.paste((35, 58, 72), mask=inland)
    mask = Image.fromarray(np.maximum(np.asarray(mask), np.asarray(inland)))
    with Image.open(ROOT / 'public/maps/world-map.webp') as ocean:
        sea_rgb = np.asarray(ocean.convert('RGB'), dtype=np.float32)
        sea_rgb = sea_rgb*np.array([.7, .65, .6])+np.array([15, 24, 33])
        result = Image.composite(land_image, Image.fromarray(np.uint8(np.clip(sea_rgb, 0, 255))), mask)
    result.save(OUT / 'world-map.webp', quality=95, method=6)
    water = ImageOps.invert(mask.resize((2048, round(2048*game.HEIGHT/game.WIDTH)), Image.Resampling.LANCZOS))
    rgba = Image.new('RGBA', water.size, 'white'); rgba.putalpha(water); rgba.save(OUT / 'water-mask.png')
    sea = np.asarray(water) > 127
    distance = distance_transform_edt(np.pad(sea, ((0,0),(64,64)), mode='wrap'))[:,64:-64]
    fade = np.clip(distance/12, 0, 1)
    Image.fromarray(np.uint8(fade*fade*(3-2*fade)*255)).save(OUT / 'surface-mask.png')
    countries = []
    for feature in json.loads((RAW / 'ne_50m_admin_0_countries.geojson').read_text(encoding='utf-8'))['features']:
        path = ''.join(game.ring_path(ring) for polygon in polygons(feature['geometry']) for ring in polygon)
        if path:
            countries.append({'id': feature['properties']['ADM0_A3'], 'name': feature['properties']['NAME_JA'], 'path': path})
    (OUT / 'countries.json').write_text(json.dumps(countries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Natural Earth原画像版: {len(countries)}地域', flush=True)


if __name__ == '__main__':
    main()
