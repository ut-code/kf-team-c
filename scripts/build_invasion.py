"""依存領域の固定成長順を生成する。人口点・人口シミュレーションには使わない。"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / 'public/maps/textures'


def build():
    source = Image.open(TEXTURES / 'small-region-index.png').convert('L')
    width = 2048
    height = round(source.height * width / source.width)
    areas = np.asarray(source.resize((width, height), Image.Resampling.NEAREST))
    yy, xx = np.indices((height, width), dtype=np.float32)
    cell = 66
    cx, cy = np.floor(xx / cell), np.floor(yy / cell)
    distance = np.full((height, width), np.inf, dtype=np.float32)
    for oy in [-2, -1, 0, 1, 2]:
        for ox in [-2, -1, 0, 1, 2]:
            gx, gy = cx + ox, cy + oy
            rng = np.sin(gx * 127.1 + gy * 311.7) * 43758.5453
            jitter_x = rng - np.floor(rng)
            rng = np.sin(gx * 269.5 + gy * 183.3) * 43758.5453
            jitter_y = rng - np.floor(rng)
            rng = np.sin(gx * 419.2 + gy * 73.7) * 15347.8361
            activity = rng - np.floor(rng)
            rng = np.sin(gx * 83.9 + gy * 239.1) * 29673.1763
            growth = rng - np.floor(rng)
            dx = xx - (gx + jitter_x) * cell
            dy = yy - (gy + jitter_y) * cell
            angle = jitter_x * np.pi
            u = dx * np.cos(angle) + dy * np.sin(angle)
            v = -dx * np.sin(angle) + dy * np.cos(angle)
            # 角を持つ非等方距離で、拡大・合流する多角形を作る。
            polygon = np.maximum(np.abs(u) * (.8 + jitter_y * .4), np.maximum(np.abs(v), (np.abs(u) + np.abs(v)) * .72))
            # 発生時期・成長速度・密度を変え、等間隔の斑点に見えないようにする。
            score = polygon * (.55 + growth * .9) + jitter_y * cell * .45
            score = np.where(activity > .3, score, np.inf)
            distance = np.minimum(distance, score)
    rank = np.zeros((height, width), dtype=np.uint16)
    for area_id in range(1, 38):
        mask = areas == area_id
        values = distance[mask]
        if not len(values):
            continue
        # 地域ごとの累積分布で補正し、塗られる面積比を依存人口比へ一致させる。
        sorted_values = np.sort(values)
        quantiles = np.searchsorted(sorted_values, values, side='right') / len(values)
        rank[mask] = np.clip(quantiles * 65534 + 1, 1, 65535).astype(np.uint16)
    pixels = np.zeros((height, width, 3), dtype=np.uint8)
    pixels[:, :, 0] = rank >> 8
    pixels[:, :, 1] = rank & 255
    Image.fromarray(pixels).save(TEXTURES / 'invasion-rank.png', optimize=True)
    print(f'侵食テクスチャ: {width} x {height}')


if __name__ == '__main__':
    build()
