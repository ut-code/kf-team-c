"""Commonsの写真候補を調べ、選定済み写真とライセンスをローカルへ保存する。"""
import html
import io
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/facility-photos'


def request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'kf-team-c-assets/1.0 (local strategy game; Commons attribution recorded)'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return response.read()
        except HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise
            time.sleep(15*(attempt+1))


def api(parameters):
    return json.loads(request('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', **parameters})))


def plain(value):
    return ' '.join(html.unescape(re.sub('<[^>]+>', '', value)).split())


def download(item):
    identifier, selection = item
    result = api({'titles': selection['file'], 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 960})
    page = next(iter(result['query']['pages'].values()))
    info = page['imageinfo'][0]
    metadata = info['extmetadata']
    license_name = plain(metadata['LicenseShortName']['value'])
    assert any(word in license_name for word in ['CC BY', 'CC0', 'Public domain', 'GODL-India']), (identifier, license_name)
    image = Image.open(io.BytesIO(request(info['thumburl'])))
    image = ImageOps.exif_transpose(image).convert('RGB')
    image.thumbnail((960, 720), Image.Resampling.LANCZOS)
    output = ROOT / 'public/photos/facilities' / f'{identifier}.webp'
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=85, method=6)
    return identifier, {
        'src': f'/photos/facilities/{identifier}.webp',
        'subject': selection['subject'],
        'relation': selection['relation'],
        'source': info['descriptionurl'],
        'author': plain(metadata['Artist']['value']),
        'license': license_name,
        'licenseUrl': metadata.get('LicenseUrl', {'value': 'https://creativecommons.org/publicdomain/mark/1.0/'})['value'].replace('http://', 'https://'),
        'changes': '縮小・WebP変換。画面では枠に合わせてトリミング。',
    }


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    selections = json.loads((DATA / 'selections.json').read_text(encoding='utf-8'))
    photos = {}
    for item in selections.items():
        time.sleep(3)
        key, photo = download(item)
        photos[key] = photo
        print(key, photo['subject'], flush=True)
        (ROOT / 'src/game/data/facility-photos.json').write_text(json.dumps(photos, ensure_ascii=False, indent=4)+'\n', encoding='utf-8')

