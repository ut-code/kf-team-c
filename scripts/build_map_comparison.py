"""色調を揃えたNatural Earth陰影版とNASA衛星写真版、50m国境を生成する。"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from netCDF4 import Dataset
from PIL import Image, ImageDraw, ImageOps
from scipy.ndimage import distance_transform_edt

import build_generalized as generalized
import build_map as game
from build_oceans import curved_water_region
from map_studies import build as terrain

ROOT = game.ROOT
RAW = terrain.RAW
OUT = ROOT / 'public/maps/comparison'
SIZE = (game.WIDTH, game.HEIGHT)


def project_image(image):
    projection = terrain.Projection(json.loads(terrain.PARAMETERS.read_text())['projection'])
    full = projection.raster(image, [0, 0, 0])
    top = (math.pi-game.NORTH_Y)/(2*math.pi)*full.height
    bottom = (math.pi-game.SOUTH_Y)/(2*math.pi)*full.height
    return full.transform(SIZE, Image.Transform.EXTENT,
                          (0, top, full.width, bottom), Image.Resampling.BICUBIC)


def detailed_land():
    """背景・船舶・反射の海岸を同じ50mデータから作る。湖は既存の110m原本を使う。"""
    mask = Image.new('L', (game.WIDTH*2, game.HEIGHT*2))
    draw = ImageDraw.Draw(mask)
    for filename, is_land in [('ne_50m_land.geojson', True), ('ne_110m_lakes.geojson', False)]:
        data = json.loads((RAW / filename).read_text(encoding='utf-8'))
        for feature in data['features']:
            for polygon in terrain.polygons(feature['geometry']):
                for index, ring in enumerate(polygon):
                    ring = game.clip_latitude(game.clip_latitude(ring, game.SOUTH_LATITUDE, True), game.NORTH_LATITUDE, False)
                    if len(ring) >= 3:
                        draw.polygon([(x*2, y*2) for x, y in [game.project(lon, lat) for lon, lat, *_ in ring]],
                                     fill=255 if (index == 0) == is_land else 0)
    return mask.resize(SIZE, Image.Resampling.BOX)


def ocean_image():
    """現行版と同じ二色・曲線化の設定で海だけを描く。"""
    settings = json.loads((ROOT / 'scripts/map_studies/ocean-parameters.json').read_text())
    with Dataset(RAW / 'earth_relief_06m_p.grd') as dataset:
        depth = -np.minimum(np.asarray(dataset['z'][:], dtype=np.float32), 0)[::-1]
        step = float(dataset['lon'][1]-dataset['lon'][0])
    shelf, _ = generalized.polygon_region(depth < settings['shelf_depth_m'],
        settings['shelf_contour_tolerance_degrees'], settings['shelf_minimum_area_deg2'],
        settings['shelf_cleanup_degrees'], step)
    shelf = curved_water_region(shelf, settings['shelf_contour_tolerance_degrees'],
                                settings['boundary_rounding_iterations'], step)
    colors = np.where(shelf[..., None], np.array(settings['shelf']), np.array(settings['deep']))
    return project_image(Image.fromarray(np.uint8(colors)))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print('比較版の50m海岸・国境と海面マスクを生成', flush=True)
    land = detailed_land()
    water = ImageOps.invert(land.resize((2048, round(2048*game.HEIGHT/game.WIDTH)), Image.Resampling.LANCZOS))
    rgba = Image.new('RGBA', water.size, 'white')
    rgba.putalpha(water)
    rgba.save(OUT / 'water-mask.png')
    distance = distance_transform_edt(np.pad(np.asarray(water) > 127, ((0, 0), (64, 64)), mode='wrap'))[:, 64:-64]
    fade = np.clip(distance/12, 0, 1)
    Image.fromarray(np.uint8(fade*fade*(3-2*fade)*255)).save(OUT / 'surface-mask.png')

    current = json.loads((ROOT / 'public/maps/countries.json').read_text(encoding='utf-8'))
    features = json.loads((RAW / 'ne_50m_admin_0_countries.geojson').read_text(encoding='utf-8'))['features']
    by_id = {feature['properties']['ADM0_A3']: feature for feature in features}
    assert all(country['id'] in by_id for country in current)
    countries = []
    for country in current:
        geometry = by_id[country['id']]['geometry']
        path = ''.join(game.ring_path(ring) for polygon in terrain.polygons(geometry) for ring in polygon)
        assert path, country['id']
        countries.append({**country, 'path': path})
    (OUT / 'countries.json').write_bytes(json.dumps(countries, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))

    print('Natural Earth原画像の細部を保ち、全体の色調だけを現在の地図へ揃える', flush=True)
    with Image.open(RAW / 'NE2_50M_SR.tif') as source:
        natural = np.asarray(project_image(source.convert('RGB')), dtype=np.float32)
    with Image.open(ROOT / 'assets/generated/terrain/地形整理.png') as image:
        base = np.asarray(image.convert('RGB'), dtype=np.float32)
    # 陸全体の色分布だけを合わせる。簡略化版の領域境界や色マスクは転用しない。
    sample_land = np.asarray(land)[::8, ::8] > 254
    source_sample = natural[::8, ::8][sample_land]
    target_sample = base[::8, ::8][sample_land]
    source_mean = source_sample.mean(axis=0)
    target_mean = target_sample.mean(axis=0)
    scale = target_sample.std(axis=0)/source_sample.std(axis=0)
    pixels = np.empty((*natural.shape[:2], 3), dtype=np.uint8)
    for top in range(0, game.HEIGHT, 96):
        rows = slice(top, top+96)
        pixels[rows] = np.uint8(np.clip((natural[rows]-source_mean)*scale+target_mean, 0, 255))
    detailed = Image.fromarray(pixels)
    Image.composite(detailed, ocean_image(), land).save(OUT / 'natural-earth.webp', quality=95, method=6)
    del natural, base, pixels, detailed

    print('NASA Blue Marbleの衛星写真を同じ投影へ変換', flush=True)
    with Image.open(RAW / 'blue-marble-july.jpg') as source:
        project_image(source.convert('RGB')).save(OUT / 'satellite.webp', quality=95, method=6)
    files = ['natural-earth.webp', 'satellite.webp', 'countries.json', 'water-mask.png', 'surface-mask.png']
    inputs = [RAW / name for name in ['NE2_50M_SR.tif', 'blue-marble-july.jpg', 'ne_50m_admin_0_countries.geojson',
                                    'ne_50m_land.geojson', 'ne_110m_lakes.geojson', 'earth_relief_06m_p.grd']]
    inputs += [ROOT / 'assets/generated/terrain/地形整理.png', ROOT / 'public/maps/countries.json',
               ROOT / 'scripts/map_studies/ocean-parameters.json', Path(__file__)]
    report = {'projection': 'EPSG:3857', 'extent': [-180, -60, 180, 75], 'size': list(SIZE),
              'border_scale': '50m', 'countries': len(countries), 'natural_earth_color_scale': scale.tolist(),
              'natural_earth_target_mean': target_mean.tolist(),
              'inputs': [{'file': p.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in inputs],
              'outputs': [{'file': f'public/maps/comparison/{name}', 'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()} for name in files]}
    (ROOT / 'data/map-studies/comparison-manifest.json').write_bytes(json.dumps(report, ensure_ascii=False, indent=2).encode('utf-8'))
    print('比較用の地図と50m国境を生成完了', flush=True)


if __name__ == '__main__':
    main()
