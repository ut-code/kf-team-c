"""土地分類ごとの拡大テクスチャを、素材の明暗を使った境界で合成する。"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = ROOT / 'scripts/map_studies/land-materials.json'


def prepare_material(identifier, settings, common):
    source = ROOT / f"data/materials/ambientcg/{settings['asset']}/{settings['asset']}_1K-JPG_Color.jpg"
    with Image.open(source) as image:
        # 面積平均で微細な草・砂粒を省き、その大きな形を地図上で拡大する。
        reduced = image.convert('RGB').resize((common['detail_resolution'],)*2, Image.Resampling.BOX)
    rgb = np.asarray(reduced, dtype=np.float32)
    # 大きな色むらを素材の段階で差し引き、染み状の明暗を地図へ持ち込まない。
    rgb = rgb-gaussian_filter(rgb, (12, 12, 0), mode='wrap')+128
    mean = rgb.mean(axis=(0, 1))
    luminance = rgb @ np.array([.2126, .7152, .0722])
    height = np.clip((luminance-luminance.mean())/max(float(luminance.std()), 1), -2, 2)
    detail = height[..., None]*settings['contrast'] + (rgb-mean)*settings['tint_strength']
    # 確認画像は実際に合成する明暗量を128を中立値として保存する。
    folder = ROOT / 'assets/generated/map/materials'
    folder.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.uint8(np.clip(128+detail, 0, 255))).save(folder / f'{identifier}.png')
    tile = Image.fromarray(np.uint8(np.clip(128+detail, 0, 255))).resize((common['tile_size_px'],)*2, Image.Resampling.BICUBIC)
    return np.asarray(tile), source


def apply_materials(pixels):
    settings = json.loads(SETTINGS.read_text(encoding='utf-8'))
    if not settings['enabled']:
        return [SETTINGS], {}
    identifiers = list(settings['materials'])
    masks = []
    textures = []
    sources = [SETTINGS, Path(__file__)]
    for identifier, material in settings['materials'].items():
        mask_path = ROOT / f'assets/generated/terrain/masks/{identifier}.png'
        with Image.open(mask_path) as image:
            masks.append(np.asarray(image).copy())
        texture, source = prepare_material(identifier, material, settings)
        textures.append(texture)
        sources.extend([source, mask_path])
    tile_size = settings['tile_size_px']
    for top in range(0, pixels.shape[0], 64):
        rows = slice(top, min(top+64, pixels.shape[0]))
        # 全分類に共通の地理座標でサンプリングし、国境やチャンクごとの継ぎ目を作らない。
        yy = np.arange(top, rows.stop)[:, None] % tile_size
        xx = np.arange(pixels.shape[1])[None, :] % tile_size
        samples = [texture[yy, xx].astype(np.float32)-128 for texture in textures]
        weights = np.stack([mask[rows] for mask in masks]).astype(np.float32)/255
        coverage = np.clip(weights.sum(axis=0), 0, 1)
        heights = np.stack([sample.mean(axis=2)/settings['materials'][key]['contrast'] for key, sample in zip(identifiers, samples)])
        # 境界だけに素材の凹凸を反映。両画像を広範囲にぼかして混ぜない。
        scores = weights + heights*settings['boundary_height_strength']*4*weights*(1-weights)
        maximum = scores.max(axis=0)
        weights = np.maximum(scores-maximum+settings['boundary_width'], 0)*(weights > 0)
        total = weights.sum(axis=0)
        weights /= np.maximum(total, 1e-6)
        detail = sum(sample*weight[..., None] for sample, weight in zip(samples, weights))
        original = pixels[rows].copy()
        pixels[rows] = np.uint8(np.clip(np.rint(original.astype(np.float32)+detail*coverage[..., None]), 0, 255))
        assert np.array_equal(pixels[rows][coverage == 0], original[coverage == 0]), '海・湖に地表素材が混入'
    return sources, {key: value['asset'] for key, value in settings['materials'].items()}
