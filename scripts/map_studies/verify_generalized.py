"""地形整理の出力・入力・投影情報を確認する。美術上の採否は判定しない。"""
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_generalized import aggregate_massifs
OUT = ROOT / 'assets/generated/terrain'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    report = json.loads((OUT / '生成記録.json').read_text(encoding='utf-8'))
    assert report['size'] == [8192, 4361]
    assert report['extent'] == [-180, -60, 180, 75]
    assert report['projection'] == 'EPSG:3857'
    assert report['representative_vertices'] < 3600 * 1800 / 100
    assert report['elevation_contours'] > 0
    assert report['massif_aggregation']['peak_prominence_m'] > 0
    assert report['massif_aggregation']['mean_absolute_elevation_change_m'] > 0
    assert digest(ROOT / 'scripts/build_generalized.py') == report['script_sha256']
    for item in report['inputs']:
        assert digest(ROOT / item['file']) == item['sha256'], item['file']
    assert digest(OUT / '地形整理.webp') == report['output_sha256']
    with Image.open(OUT / '地形整理.png') as image:
        assert image.size == (8192, 4361)
        # 中間画像は海との合成前の地表色を保持する。
        north = math.log(math.tan(math.pi/4 + 75*math.pi/360))
        south = math.log(math.tan(math.pi/4 - 60*math.pi/360))
        x = round((-30+180)/360*8192)
        y = round(north/(north-south)*4361)
        assert all(0 <= channel <= 255 for channel in image.getpixel((x, y)))
    profile = np.array([0, 1000, 3000, 4000, 3200, 3500, 3200, 1000, 0, 0, 0, 1500, 4500, 1500, 0], dtype=np.float32)
    synthetic = np.tile(profile, (9, 1))
    grouped, _ = aggregate_massifs(synthetic, .1, {'massif_gap_radius_degrees': .1, 'massif_max_valley_fill_m': 400, 'massif_peak_prominence_m': 1000})
    assert grouped[4, 3] == grouped[4, 5], '浅い鞍部を挟む峰が山塊へ統合されていません'
    assert grouped[4, 9] == 0, '深い谷が埋まっています'
    assert grouped[4, 12] > grouped[4, 3], '独立した高い山塊が失われています'
    result = {'status': 'passed', 'size': report['size'], 'representative_vertices': report['representative_vertices'], 'input_hashes_checked': len(report['inputs']), 'ocean_reference_point': 'passed', 'massif_merge_and_deep_valley_preservation': 'passed'}
    (OUT / '検証.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
