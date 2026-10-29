"""記録されたNASA画像とNatural Earth 50mの比較用原本を取得する。"""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/map-studies/raw'


def main():
    records = json.loads((RAW.parent / 'comparison-sources.json').read_text(encoding='utf-8'))
    RAW.mkdir(parents=True, exist_ok=True)
    for record in records:
        target = RAW / record['file']
        if not target.exists():
            with urllib.request.urlopen(record['url'], timeout=120) as response:
                data = response.read()
            assert hashlib.sha256(data).hexdigest() == record['sha256'], record['file']
            target.write_bytes(data)
        assert hashlib.sha256(target.read_bytes()).hexdigest() == record['sha256'], record['file']
        print(f"確認: {record['file']}", flush=True)


if __name__ == '__main__':
    main()
