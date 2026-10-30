"""比較版の投影、国IDの一致、国境の精細さ、原本と出力の整合性を確認する。"""
import hashlib
import json
import math
import re
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def main():
    report = json.loads((ROOT / 'data/map-studies/comparison-manifest.json').read_text(encoding='utf-8'))
    assert report['size'] == [8192, 4361]
    assert report['extent'] == [-180, -60, 180, 75]
    for item in report['inputs'] + report['outputs']:
        assert hashlib.sha256((ROOT / item['file']).read_bytes()).hexdigest() == item['sha256'], item['file']
    current = json.loads((ROOT / 'public/maps/countries.json').read_text(encoding='utf-8'))
    detailed = json.loads((ROOT / 'public/maps/comparison/countries.json').read_text(encoding='utf-8'))
    assert [(c['id'], c['name']) for c in current] == [(c['id'], c['name']) for c in detailed]
    ratio = sum(len(c['path']) for c in detailed)/sum(len(c['path']) for c in current)
    assert ratio > 2, ratio
    photo_sources = [item for item in json.loads((ROOT / 'data/map-studies/comparison-sources.json').read_text(encoding='utf-8')) if 'output' in item]
    registered = set(re.findall(r"'(satellite[^']*\.webp)'", (ROOT / 'src/map/config.ts').read_text(encoding='utf-8')))
    assert registered == {item['output'] for item in photo_sources} | {'satellite-ocean-tuned.webp'}
    for name in ['natural-earth.webp', 'satellite-ocean-tuned.webp'] + [item['output'] for item in photo_sources]:
        with Image.open(ROOT / 'public/maps/comparison' / name) as image:
            assert image.size == (8192, 4361)
    # アルプス周辺で簡略化版の領域色を転用せず、原画像の細部が残っていることを確認する。
    import sys
    sys.path.insert(0, str(ROOT / 'scripts'))
    import build_map as game
    x0, y0 = game.project(5, 49)
    x1, y1 = game.project(16, 43)
    box = tuple(round(value) for value in (x0, y0, x1, y1))
    color_counts = []
    for name in ['public/maps/world-map.webp', 'public/maps/comparison/natural-earth.webp']:
        with Image.open(ROOT / name) as image:
            pixels = np.asarray(image.crop(box))[::2, ::2].reshape(-1, 3)
        color_counts.append(len(np.unique(pixels, axis=0)))
    assert color_counts[1] > color_counts[0]*1.5, color_counts
    with Image.open(ROOT / 'public/maps/comparison/water-mask.png') as mask:
        land = np.asarray(mask)[..., 3] == 0
        sample_size = mask.size
    with Image.open(ROOT / 'public/maps/comparison/natural-earth.webp') as image:
        pixels = np.asarray(image.resize(sample_size, Image.Resampling.NEAREST))
    mean = pixels[land].mean(axis=0)
    assert np.max(np.abs(mean-np.array(report['natural_earth_target_mean']))) < 8, mean
    # 各候補の海も、配信元画像の色を保持する。海底地形付き版も独自の二色へ置き換えない。
    Image.MAX_IMAGE_PIXELS = 240_000_000
    for item in photo_sources:
        with Image.open(ROOT / 'data/map-studies/raw' / item['file']) as source, Image.open(ROOT / 'public/maps/comparison' / item['output']) as photo:
            for lon, lat in [(150, 20), (-35, 20), (135, 39)]:
                map_point = tuple(round(value) for value in game.project(lon, lat))
                # 投影先の画素中心に対応する原画像の四画素を補間する。
                # 水深の陰影など勾配のある海を、最寄りの一点と比較しない。
                center_lon = (map_point[0]+.5)/game.WIDTH*360-180
                mercator_y = game.NORTH_Y-(map_point[1]+.5)/game.HEIGHT*(game.NORTH_Y-game.SOUTH_Y)
                center_lat = math.degrees(math.atan(math.sinh(mercator_y)))
                x = (center_lon+180)/360*source.width-.5
                y = (90-center_lat)/180*source.height-.5
                x0, y0 = math.floor(x), math.floor(y)
                tx, ty = x-x0, y-y0
                expected = sum(np.array(source.getpixel((x0+dx, y0+dy)), dtype=np.float32)*weight
                               for dx, dy, weight in [(0, 0, (1-tx)*(1-ty)), (1, 0, tx*(1-ty)),
                                                      (0, 1, (1-tx)*ty), (1, 1, tx*ty)])
                actual = np.array(photo.getpixel(map_point), dtype=np.int16)
                assert np.max(np.abs(expected-actual)) < 10, (item['file'], lon, lat, expected, actual)
    # 加工後の配信画像でも陸を保ち、海の彩度・明暗差だけが抑えられていることを確認する。
    with Image.open(ROOT / 'public/maps/comparison/satellite-bathymetry.webp') as source, Image.open(ROOT / 'public/maps/comparison/satellite-ocean-tuned.webp') as tuned:
        before = np.asarray(source.resize(sample_size, Image.Resampling.NEAREST)).astype(np.float32)
        after = np.asarray(tuned.resize(sample_size, Image.Resampling.NEAREST)).astype(np.float32)
    from scipy.ndimage import binary_erosion, label
    interior = binary_erosion(land, iterations=3)
    land_error = np.abs(before[interior]-after[interior]).mean()
    assert land_error < 1, land_error
    regions, _ = label(~land)
    counts = np.bincount(regions.ravel())
    counts[0] = 0
    ocean = binary_erosion(regions == counts.argmax(), iterations=3)
    before_ocean, after_ocean = before[ocean], after[ocean]
    luminance = np.array([.2126, .7152, .0722])
    contrast_ratio = (after_ocean @ luminance).std()/(before_ocean @ luminance).std()
    assert contrast_ratio < .7, contrast_ratio
    saturation = lambda pixels: ((pixels.max(axis=1)-pixels.min(axis=1))/np.maximum(pixels.max(axis=1), 1)).mean()
    assert saturation(after_ocean) < saturation(before_ocean)*.85
    assert len(np.unique(after_ocean, axis=0)) > 200
    # 海峡・地図端で分かれた海や内陸水域も調整から漏らさない。
    tone = json.loads((ROOT / 'scripts/map_studies/satellite-ocean-tone.json').read_text())
    for lon, lat in [(170, 72), (35, 43), (51, 42), (-87, 44)]:
        point = tuple(round(value) for value in game.project(lon, lat))
        with Image.open(ROOT / 'public/maps/comparison/satellite-bathymetry.webp') as source, Image.open(ROOT / 'public/maps/comparison/satellite-ocean-tuned.webp') as tuned:
            original_color = np.array(source.getpixel(point), dtype=np.int16)
            tuned_color = np.array(tuned.getpixel(point), dtype=np.int16)
            low, high = tone['source_luminance_range']
            level = np.clip((original_color @ luminance-low)/(high-low), 0, 1)**tone['gamma']
            expected = np.array(tone['deep_color']) + level*(np.array(tone['shallow_color'])-tone['deep_color'])
            # 元から近い色の地点もあるため、変化量ではなく目的の色に一致するか調べる。
            assert np.max(np.abs(expected-tuned_color)) < 4, (lon, lat, expected, tuned_color)
    map_files = ['public/maps/world-map.webp', 'public/maps/comparison/natural-earth.webp', 'public/maps/comparison/satellite-ocean-tuned.webp'] + [f"public/maps/comparison/{item['output']}" for item in photo_sources]
    hashes = [hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in map_files]
    assert len(set(hashes)) == len(map_files)
    print(json.dumps({'status': 'passed', 'countries': len(detailed), 'border_path_size_ratio': round(ratio, 2),
                      'distinct_map_images': len(map_files), 'satellite_candidates': len(photo_sources), 'alps_color_counts': color_counts,
                      'land_mean_error': round(float(land_error), 3), 'ocean_contrast_ratio': round(float(contrast_ratio), 3),
                      'hashes_checked': len(report['inputs'])+len(report['outputs'])}))


if __name__ == '__main__':
    main()
