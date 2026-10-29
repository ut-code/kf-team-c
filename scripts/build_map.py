"""本採用の世界地図と110m国境をゲームへ配信する。"""
from pathlib import Path
import hashlib
import json
import math
import shutil

from PIL import Image, ImageOps
import numpy as np
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/maps'
SOURCE = ROOT / 'assets/generated/map/世界地図.png'
COUNTRIES = ROOT / 'data/map-studies/raw/ne_110m_admin_0_countries.geojson'
WIDTH = 8192
NORTH_LATITUDE = 75
SOUTH_LATITUDE = -60
NORTH_Y = math.log(math.tan(math.pi / 4 + math.radians(NORTH_LATITUDE) / 2))
SOUTH_Y = math.log(math.tan(math.pi / 4 + math.radians(SOUTH_LATITUDE) / 2))
HEIGHT = round(WIDTH * (NORTH_Y - SOUTH_Y) / (2 * math.pi))


def project(lon, lat):
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return (lon + 180) / 360 * WIDTH, (NORTH_Y - y) / (NORTH_Y - SOUTH_Y) * HEIGHT


def clip_latitude(ring, latitude, keep_north):
    """緯度境界でポリゴンを切る。緯度を単に端へ押し付けない。"""
    if not ring:
        return []
    output = []
    previous = ring[-1]
    previous_inside = previous[1] >= latitude if keep_north else previous[1] <= latitude
    for current in ring:
        inside = current[1] >= latitude if keep_north else current[1] <= latitude
        if inside != previous_inside:
            t = (latitude - previous[1]) / (current[1] - previous[1])
            output.append([previous[0] + t * (current[0] - previous[0]), latitude])
        if inside:
            output.append(current)
        previous, previous_inside = current, inside
    return output


def ring_path(ring):
    clipped = clip_latitude(clip_latitude(ring, SOUTH_LATITUDE, True), NORTH_LATITUDE, False)
    if len(clipped) < 3:
        return ''
    points = []
    # 緯度経度上の線分を細分化し、メルカトル上の曲線に近似する。
    for start, end in zip(clipped, clipped[1:] + clipped[:1]):
        assert abs(end[0] - start[0]) <= 180 or (start[1] in {NORTH_LATITUDE, SOUTH_LATITUDE} and end[1] == start[1])
        count = max(1, math.ceil(max(abs(end[0] - start[0]), abs(end[1] - start[1])) / .25))
        for i in range(count):
            points.append(project(start[0] + (end[0] - start[0]) * i / count, start[1] + (end[1] - start[1]) * i / count))
    return 'M' + 'L'.join(f'{x:.3f},{y:.3f}' for x, y in points) + 'Z'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as image:
        assert image.size == (WIDTH, HEIGHT)
    shutil.copyfile(SOURCE.with_suffix('.webp'), OUT / 'world-map.webp')
    # 船舶の描画を海側へ切り抜く。細い運河は地図縮尺に従って隠れる。
    with Image.open(SOURCE.parent / 'land-mask.png') as land:
        mask = ImageOps.invert(land.convert('L').resize((2048, round(2048*HEIGHT/WIDTH)), Image.Resampling.LANCZOS))
        water = Image.new('RGBA', mask.size, (255, 255, 255, 255))
        water.putalpha(mask)
        water.save(OUT / 'water-mask.png')
        # 水面の反射を海岸から離して穏やかに立ち上げる。
        sea = np.asarray(mask) > 127
        distance = distance_transform_edt(np.pad(sea, ((0, 0), (64, 64)), mode='wrap'))[:, 64:-64]
        fade = np.clip(distance/12, 0, 1)
        fade = fade*fade*(3-2*fade)
        Image.fromarray(np.uint8(fade*255)).save(OUT / 'surface-mask.png')
    data = json.loads(COUNTRIES.read_text(encoding='utf-8'))
    countries = []
    for feature in data['features']:
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        path = ''.join(ring_path(ring) for polygon in polygons for ring in polygon)
        if path:
            countries.append({'id': feature['properties']['ADM0_A3'], 'name': feature['properties']['NAME_JA'], 'path': path})
    (OUT / 'countries.json').write_text(json.dumps(countries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    files = [SOURCE, COUNTRIES]
    manifest = {'projection': 'EPSG:3857', 'extent': [-180, SOUTH_LATITUDE, 180, NORTH_LATITUDE], 'width': WIDTH, 'height': HEIGHT, 'background': '地表の斜面陰影なし・山地と高山の二段階岩色・二色の海・110m海岸の被覆率合成（海岸の明暗加工なし）', 'sources': [{'file': p.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files], 'output_sha256': hashlib.sha256((OUT / 'world-map.webp').read_bytes()).hexdigest()}
    (ROOT / 'data/map-studies/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'本採用版: {WIDTH}×{HEIGHT} / メルカトル / 北緯{NORTH_LATITUDE}度〜南緯{-SOUTH_LATITUDE}度 / 国境{len(countries)}地域')


if __name__ == '__main__':
    main()
