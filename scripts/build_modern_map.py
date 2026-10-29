"""実在の地形と50m海岸線から、現代の戦略ゲーム向けの地図を作る。"""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy.ndimage import distance_transform_edt, gaussian_filter

import build_map as game
from map_studies.build import Projection, polygons

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/map-studies/raw'
OUT = ROOT / 'public/maps/modern'
PREVIEW = ROOT / 'assets/generated/modern-map'
SIZE = (game.WIDTH, game.HEIGHT)
OCEAN = (28, 65, 91)


def land_mask():
    """海岸の細部を保ち、内陸の湖も水域として切り抜く。"""
    mask = Image.new('L', (game.WIDTH * 2, game.HEIGHT * 2))
    draw = ImageDraw.Draw(mask)
    for filename, land in [('ne_50m_land.geojson', True), ('ne_110m_lakes.geojson', False)]:
        data = json.loads((RAW / filename).read_text(encoding='utf-8'))
        for feature in data['features']:
            for polygon in polygons(feature['geometry']):
                for index, ring in enumerate(polygon):
                    clipped = game.clip_latitude(
                        game.clip_latitude(ring, game.SOUTH_LATITUDE, True),
                        game.NORTH_LATITUDE, False,
                    )
                    if len(clipped) >= 3:
                        points = [(x * 2, y * 2) for x, y in
                                  [game.project(lon, lat) for lon, lat, *_ in clipped]]
                        draw.polygon(points, fill=255 if (index == 0) == land else 0)
    return mask.resize(SIZE, Image.Resampling.BOX)


def terrain():
    """環境色の深みを強め、白を加えずに暗めの自然色へ調色する。"""
    settings = json.loads((ROOT / 'scripts/map_studies/parameters.json').read_text())
    projection = Projection(settings['projection'])
    with Image.open(RAW / 'HYP_50M_SR.tif') as source:
        projected = projection.raster(source.convert('RGB'), OCEAN)
    top = (np.pi - game.NORTH_Y) / (2 * np.pi) * projected.height
    bottom = (np.pi - game.SOUTH_Y) / (2 * np.pi) * projected.height
    image = projected.transform(SIZE, Image.Transform.EXTENT,
                                (0, top, projected.width, bottom), Image.Resampling.BICUBIC)
    del projected
    rgb = np.asarray(image, dtype=np.float32)
    luminance = rgb @ np.array([.2126, .7152, .0722], dtype=np.float32)
    broad = gaussian_filter(luminance, 5, mode=('nearest', 'wrap'))
    rgb += (broad - luminance)[..., None] * .60
    # 植生の緑と乾燥地の砂色を強め、白浮きを避けて中間調を落とす。
    rgb = ((rgb - broad[..., None]) * 1.4 + broad[..., None]) * .68
    rgb += np.array([-3, 3, -7], dtype=np.float32)
    neutral = np.clip((22 - np.ptp(np.asarray(image), axis=2)) / 22, 0, 1)
    snow = np.clip((broad - 205) / 35, 0, 1) * neutral
    for channel, offset in enumerate([4, 8, 9]):
        rgb[..., channel] = rgb[..., channel] * (1 - snow) + (broad * .72 + offset) * snow
    return Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))


def ocean(mask):
    """深い青の海に、控えめな海岸の縁取りを加える。"""
    small = mask.resize((2048, round(2048 * game.HEIGHT / game.WIDTH)), Image.Resampling.BOX)
    sea = np.asarray(small) < 128
    padded = np.pad(sea, ((0, 0), (256, 256)), mode='wrap')
    distance = distance_transform_edt(padded)[:, 256:-256]
    coast = np.exp(-distance / 1.5) * sea
    shelf = np.exp(-distance / 18) * sea
    rgb = np.empty((*sea.shape, 3), dtype=np.float32)
    for channel, (base, lift, soft) in enumerate(zip(OCEAN, [6, 9, 9], [3, 5, 5])):
        rgb[..., channel] = base + coast * lift + shelf * soft
    image = Image.fromarray(np.uint8(rgb)).resize(SIZE, Image.Resampling.BICUBIC)
    return image, small, distance


def save_preview(image, features):
    """ゲーム側で重ねる国境を含めた確認用画像を保存する。"""
    preview = image.copy()
    preview.thumbnail((3600, 2000), Image.Resampling.LANCZOS)
    overlay = Image.new('RGBA', preview.size)
    draw = ImageDraw.Draw(overlay)
    scale = preview.width / game.WIDTH
    for feature in features:
        for polygon in polygons(feature['geometry']):
            for ring in polygon:
                clipped = game.clip_latitude(
                    game.clip_latitude(ring, game.SOUTH_LATITUDE, True),
                    game.NORTH_LATITUDE, False,
                )
                if len(clipped) >= 3:
                    points = [(x * scale, y * scale) for x, y in
                              [game.project(lon, lat) for lon, lat, *_ in clipped]]
                    draw.line(points + points[:1], fill=(78, 99, 93, 143), width=2)
    preview = Image.alpha_composite(preview.convert('RGBA'), overlay).convert('RGB')
    preview.thumbnail((1800, 1000), Image.Resampling.LANCZOS)
    preview.save(PREVIEW / '世界地図.png')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = 240_000_000
    print('地形原画像を投影・調色しています。', flush=True)
    land = terrain()
    mask = land_mask()
    sea, small, distance = ocean(mask)
    result = Image.composite(land, sea, mask)
    result.save(OUT / 'world-map.webp', quality=94, method=6)

    # 地図・船舶・海面反射を同じ海岸線へ揃える。
    water = Image.new('RGBA', small.size, 'white')
    water.putalpha(ImageOps.invert(small))
    water.save(OUT / 'water-mask.png')
    fade = np.clip(distance / 12, 0, 1)
    Image.fromarray(np.uint8(fade * fade * (3 - 2 * fade) * 255)).save(OUT / 'surface-mask.png')

    countries = []
    data = json.loads((RAW / 'ne_50m_admin_0_countries.geojson').read_text(encoding='utf-8'))
    save_preview(result, data['features'])
    for feature in data['features']:
        path = ''.join(game.ring_path(ring) for polygon in polygons(feature['geometry']) for ring in polygon)
        if path:
            countries.append({'id': feature['properties']['ADM0_A3'],
                              'name': feature['properties']['NAME_JA'], 'path': path})
    (OUT / 'countries.json').write_text(json.dumps(countries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    sources = ['HYP_50M_SR.tif', 'ne_50m_land.geojson', 'ne_110m_lakes.geojson', 'ne_50m_admin_0_countries.geojson']
    manifest = {
        'description': '標準的で見やすい現代風の地図。深い青の海、濃い緑と砂色の陸地、実地形の陰影、細い国境。白を混ぜる淡色化を取り除き、中間調を暗くして色の深みを保っている。画像生成は使用していない。',
        'projection': 'EPSG:3857', 'extent': [-180, -60, 180, 75],
        'width': game.WIDTH, 'height': game.HEIGHT,
        'sources': [{'file': (RAW / name).relative_to(ROOT).as_posix(),
                     'sha256': hashlib.sha256((RAW / name).read_bytes()).hexdigest()} for name in sources],
        'outputs': {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest()
                    for name in ['world-map.webp', 'countries.json', 'water-mask.png', 'surface-mask.png']},
    }
    (PREVIEW / '生成記録.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'現代風世界地図: {game.WIDTH}×{game.HEIGHT} / {len(countries)}地域', flush=True)


if __name__ == '__main__':
    main()
