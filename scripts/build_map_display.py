"""表示用地図を4096pxへ縮小し、元の地図素材は保持する。"""

from pathlib import Path

from PIL import Image

TEXTURES = Path(__file__).resolve().parents[1] / 'public/maps/textures'

for source, output in [
    ('satellite-ocean-tuned.webp', 'satellite-display.webp'),
    ('country-index.png', 'country-display.png'),
    ('small-region-index.png', 'small-region-display.png'),
]:
    with Image.open(TEXTURES / source) as image:
        size = (4096, round(image.height * 4096 / image.width))
        # 地域IDは補間すると別の地域になるため、最近傍で縮小する。
        indexed = image.mode == 'L'
        resized = image.resize(size, Image.Resampling.NEAREST if indexed else Image.Resampling.LANCZOS)
        if indexed:
            resized.save(TEXTURES / output, optimize=True)
        else:
            resized.save(TEXTURES / output, quality=88, method=6)
