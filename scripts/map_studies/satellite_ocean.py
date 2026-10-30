"""NASA海底地形の連続的な陰影を保ち、海だけを落ち着いた青へ調整する。"""
import numpy as np
from PIL import Image


def tone_ocean(image, land, settings):
    # 海峡や地図端で分かれた海、カスピ海などの内陸水域にも同じ調整を使う。
    coverage = np.asarray(land)
    original = np.asarray(image)
    output = original.copy()
    deep = np.array(settings['deep_color'], dtype=np.float32)
    shallow = np.array(settings['shallow_color'], dtype=np.float32)
    low, high = settings['source_luminance_range']
    assert high > low and settings['gamma'] > 0
    # 大画像の浮動小数点配列を一度に作らず、行ごとに処理する。
    for top in range(0, image.height, 96):
        rows = slice(top, top+96)
        pixels = original[rows].astype(np.float32)
        luminance = pixels @ np.array([.2126, .7152, .0722], dtype=np.float32)
        level = np.clip((luminance-low)/(high-low), 0, 1)**settings['gamma']
        toned = deep + level[..., None]*(shallow-deep)
        # 原画像にある小島や海氷も保護する。青い水面と暗い海底だけを調整する。
        water_color = (pixels[..., 2] > np.maximum(pixels[..., 0], pixels[..., 1])) | (pixels.max(axis=2) < 20)
        alpha = (1-coverage[rows].astype(np.float32)/255)*water_color
        output[rows] = np.uint8(np.rint(pixels*(1-alpha[..., None])+toned*alpha[..., None]))
    return Image.fromarray(output)
