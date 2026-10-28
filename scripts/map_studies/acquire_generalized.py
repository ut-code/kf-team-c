"""地形の形を整理するための標高・110m海岸原本を保存。"""
import json
import urllib.request
from acquire import RAW, digest


def main():
    sources = {
        'earth_relief_06m_p.grd': 'https://oceania.generic-mapping-tools.org/server/earth/earth_relief/earth_relief_06m_p.grd',
        'ne_110m_land.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson',
        'ne_110m_lakes.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_lakes.geojson',
    }
    records = []
    for name, url in sources.items():
        path = RAW / name
        if not path.exists():
            print(f'取得: {name}', flush=True)
            part = path.with_suffix(path.suffix + '.part')
            with urllib.request.urlopen(url, timeout=180) as response, part.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            part.replace(path)
        records.append({'file': name, 'url': url, 'sha256': digest(path), 'bytes': path.stat().st_size})
    (RAW.parent / 'generalized-sources.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
