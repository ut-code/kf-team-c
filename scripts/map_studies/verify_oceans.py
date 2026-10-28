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
from build_oceans import apply_coast_bevel


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
    assert report['seafloor_relief'] is True
    assert report['settings']['seafloor_smoothing_degrees'] == 2.4
    assert report['land_materials'] == {}
    assert report['settings']['relief_opacity'] == 0.3
    assert report['checks']['boundary_only_changed_ratio'] < 0.05
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
    # 北西向きの陸側が明るく、反対側の海側が暗くなることを確認する。
    land = np.zeros((64, 64), dtype=bool)
    land[:, 20:44] = True
    pixels = np.full((64, 64, 3), 80, dtype=np.uint8)
    apply_coast_bevel(pixels, land, report['settings'])
    assert int(pixels[32, 20, 0]) > 80
    assert int(pixels[32, 44, 0]) < 80
    assert int(pixels[32, 32, 0]) == int(pixels[0, 32, 0]) == 80
    shifted = np.full((64, 64, 3), 80, dtype=np.uint8)
    apply_coast_bevel(shifted, np.roll(land, 27, axis=1), report['settings'])
    assert np.array_equal(shifted, np.roll(pixels, 27, axis=1)), '日付変更線の接続で海岸加工が変わっています'
    result = {'status': 'passed', 'adopted': True, 'approved_baseline_relief_opacity': 0.3, 'boundary_only_changed_ratio': report['checks']['boundary_only_changed_ratio'], 'coast_light_and_wrap': 'passed', 'protected_reference_points': [name for name, _, _ in points], 'shelf_reference_colors': shelf_colors, 'input_and_output_hashes': len(report['inputs'])+len(report['outputs'])}
    (folder / '検証.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
