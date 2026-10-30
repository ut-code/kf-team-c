"""国境を一度だけ国IDテクスチャへ変換する。陸の色・国境・当たり判定の国順を共有する。"""
import hashlib
import json
import math
import re
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIZE = (8192, 4361)


def build(source):
    countries = json.loads(source.read_text(encoding='utf-8'))
    assert len(countries) < 255
    output = Image.new('L', SIZE)
    for index, country in enumerate(countries, 1):
        rings = []
        for ring in re.findall(r'M([^Z]+)Z', country['path']):
            values = [float(value) for value in re.findall(r'-?\d+(?:\.\d+)?', ring)]
            rings.append(list(zip(values[::2], values[1::2])))
        # 偶奇規則で穴を抜き、境界のアンチエイリアスによる国IDの混色を避ける。
        mask = Image.new('1', SIZE)
        for ring in rings:
            x0 = max(0, math.floor(min(x for x, _ in ring)))
            y0 = max(0, math.floor(min(y for _, y in ring)))
            x1 = min(SIZE[0], math.ceil(max(x for x, _ in ring))+1)
            y1 = min(SIZE[1], math.ceil(max(y for _, y in ring))+1)
            if x1 <= x0 or y1 <= y0:
                continue
            box = (x0, y0, x1, y1)
            tile = Image.new('1', (x1-x0, y1-y0))
            ImageDraw.Draw(tile).polygon([(x-x0, y-y0) for x, y in ring], fill=1)
            mask.paste(ImageChops.logical_xor(mask.crop(box), tile), box)
        output.paste(index, (0, 0), mask)
    target = source.with_name('country-index.png')
    output.save(target, optimize=True)
    return {'source':source.relative_to(ROOT).as_posix(), 'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'output':target.relative_to(ROOT).as_posix(), 'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'countries':[country['id'] for country in countries], 'size':list(SIZE)}


def main():
    records = [build(ROOT / name) for name in ['public/maps/countries.json', 'public/maps/comparison/countries.json']]
    (ROOT / 'data/map-studies/country-index-manifest.json').write_text(json.dumps(records, indent=2), encoding='utf-8', newline='\n')
    print('国IDテクスチャを生成完了')


if __name__ == '__main__':
    main()
