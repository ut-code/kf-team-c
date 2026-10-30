"""GPU用国IDテクスチャの国順・入力・実際の地理上の画素を検証する。"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_map as game


def main():
    records = json.loads((ROOT / 'data/map-studies/country-index-manifest.json').read_text(encoding='utf-8'))
    for record in records:
        source = ROOT / record['source']
        output = ROOT / record['output']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == record['source_sha256']
        assert hashlib.sha256(output.read_bytes()).hexdigest() == record['sha256']
        countries = json.loads(source.read_text(encoding='utf-8'))
        assert [country['id'] for country in countries] == record['countries']
        with Image.open(output) as image:
            assert image.mode == 'L' and image.size == (8192, 4361)
            assert image.getextrema() == (0, len(countries))
            for expected, lon, lat in [('JPN',139.75,35.68),('USA',-77.04,38.9),('BRA',-47.88,-15.79),('RUS',37.62,55.75)]:
                point = tuple(round(value) for value in game.project(lon, lat))
                index = image.getpixel(point)
                assert countries[index-1]['id'] == expected, (point,index,expected)
            sea = tuple(round(value) for value in game.project(-30, 0))
            assert image.getpixel(sea) == 0
    print(json.dumps({'status':'passed','country_atlases':len(records),'countries':len(countries)}))


if __name__ == '__main__':
    main()
