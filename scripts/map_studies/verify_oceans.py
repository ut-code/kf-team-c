"""本採用版のハッシュ・投影・陸と内水域の保持を確認する。"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_map import project


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    folder = ROOT / 'assets/generated/map'
    report = json.loads((folder / '生成記録.json').read_text(encoding='utf-8'))
    assert report['size'] == [8192, 4361]
    assert report['extent'] == [-180, -60, 180, 75]
    for item in report['inputs'] + report['outputs']:
        assert digest(ROOT / item['file']) == item['sha256'], item['file']
    points = [('サハラ', 15, 22), ('シベリア', 90, 60), ('アンデス', -70, -20), ('カスピ海', 51, 42)]
    files = ['世界地図.png']
    assert report['seafloor_relief'] is False
    assert len(report['ocean_palette']) == 2
    assert report['land_materials'] == {}
    # 輪郭整理の変更面積を色の境界数に対して確認する。
    boundary_count = len(report['ocean_palette'])-1
    assert report['checks']['boundary_only_changed_ratio']/boundary_count < 0.05
    assert report['checks']['land_interior_unchanged'] is True
    assert digest(ROOT / 'public/maps/world-map.webp') == digest(folder / '世界地図.webp')
    with Image.open(ROOT / 'assets/generated/terrain/地形整理.png') as base:
        samples = {name: (tuple(round(v) for v in project(lon, lat)), base.getpixel(tuple(round(v) for v in project(lon, lat)))) for name, lon, lat in points}
    shelf_colors = []
    for filename in files:
        with Image.open(folder / filename) as image:
            assert image.size == (8192, 4361)
            for name, (point, expected) in samples.items():
                if name == 'カスピ海':
                    expected = tuple(json.loads((ROOT / 'scripts/map_studies/generalized-parameters.json').read_text(encoding='utf-8'))['lake'])
                assert max(abs(a-b) for a, b in zip(image.getpixel(point), expected)) <= (0 if name == 'カスピ海' else 32), (filename, name)
            shelf_colors.append(image.getpixel(tuple(round(v) for v in project(3, 56))))
    # 本採用の海岸に黒ずみを生む明暗加工がなく、被覆率の中間値があることを確認する。
    assert report['checks']['coast_highlight_pixels'] == 0
    assert report['checks']['coast_shadow_pixels'] == 0
    with Image.open(folder / 'land-mask.png') as image:
        coverage = np.asarray(image)
        assert np.any((coverage > 0) & (coverage < 255)), '海岸の被覆率が失われています'
    result = {'status': 'passed', 'adopted': True, 'ocean_palette_colors': len(report['ocean_palette']), 'boundary_only_changed_ratio': report['checks']['boundary_only_changed_ratio'], 'coast_coverage_without_bevel': 'passed', 'protected_reference_points': [name for name, _, _ in points], 'shelf_reference_colors': shelf_colors, 'input_and_output_hashes': len(report['inputs'])+len(report['outputs'])}
    (folder / '検証.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
