"""比較版の投影、国IDの一致、国境の精細さ、原本と出力の整合性を確認する。"""
import hashlib
import json
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
    for name in ['natural-earth.webp', 'satellite.webp']:
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
    hashes = [hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in
              ['public/maps/world-map.webp', 'public/maps/comparison/natural-earth.webp', 'public/maps/comparison/satellite.webp']]
    assert len(set(hashes)) == 3
    print(json.dumps({'status': 'passed', 'countries': len(detailed), 'border_path_size_ratio': round(ratio, 2),
                      'distinct_map_images': 3, 'alps_color_counts': color_counts, 'hashes_checked': len(report['inputs'])+len(report['outputs'])}))


if __name__ == '__main__':
    main()
