"""地図生成で共用する投影・地表マスク・画像読み込み。"""

from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "map-studies" / "raw"
PARAMETERS = Path(__file__).with_name("parameters.json")


def polygons(geometry):
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


def raster_mask(filename, size):
    image = Image.new("L", size)
    draw = ImageDraw.Draw(image)
    data = json.loads((RAW / filename).read_text(encoding="utf-8"))
    for feature in data["features"]:
        for polygon in polygons(feature["geometry"]):
            for i, ring in enumerate(polygon):
                points = [((lon + 180) / 360 * size[0], (90 - lat) / 180 * size[1]) for lon, lat, *_ in ring]
                draw.polygon(points, fill=255 if i == 0 else 0)
    return image


def read_source(stem, size):
    Image.MAX_IMAGE_PIXELS = 240_000_000
    with Image.open(RAW / f"{stem}.tif") as source:
        original_size = source.size
        image = source.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    a, d, b, e, c, f = [float(value) for value in (RAW / f"{stem}.tfw").read_text().split()]
    assert d == b == 0 and a > 0 and e < 0
    assert abs(c - a / 2 + 180) < 1e-6 and abs(f - e / 2 - 90) < 1e-6
    assert abs(a * original_size[0] - 360) < 1e-6 and abs(e * original_size[1] + 180) < 1e-6
    return image


def smoothstep(low, high, values):
    t = np.clip((values - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


class Projection:
    def __init__(self, settings):
        self.forward = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        self.inverse = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
        self.xmax = abs(self.forward.transform(180, 0)[0])
        self.ymax = abs(self.forward.transform(0, settings["max_latitude"])[1])
        self.width = settings["width"]
        self.height = round(self.width * self.ymax / self.xmax)
        self.scale = self.width / (2 * self.xmax)

    def point(self, lon, lat):
        x, y = self.forward.transform(lon, lat)
        return (x + self.xmax) * self.scale, (self.ymax - y) * self.scale

    def raster(self, image, void):
        """出力画素中心→PROJ逆変換→原画像画素中心の双一次補間。"""
        source = np.asarray(image)
        height, width = source.shape[:2]
        result = Image.new("RGB", (self.width, self.height), tuple(void))
        projected_x = (np.arange(self.width, dtype=np.float64) + 0.5) / self.scale - self.xmax
        for top in range(0, self.height, 64):
            count = min(64, self.height - top)
            projected_y = self.ymax - (np.arange(top, top + count, dtype=np.float64) + 0.5) / self.scale
            xx, yy = np.meshgrid(projected_x, projected_y)
            lon, lat = self.inverse.transform(xx, yy)
            valid = np.isfinite(lon) & np.isfinite(lat) & (np.abs(lon) <= 180) & (np.abs(lat) <= 90)
            lon = np.where(valid, lon, 0)
            lat = np.where(valid, lat, 0)
            x = np.clip((lon + 180) / 360 * width - 0.5, 0, width - 1)
            y = np.clip((90 - lat) / 180 * height - 0.5, 0, height - 1)
            x0, y0 = x.astype(np.int32), y.astype(np.int32)
            x1, y1 = np.minimum(x0 + 1, width - 1), np.minimum(y0 + 1, height - 1)
            tx, ty = (x - x0)[..., None], (y - y0)[..., None]
            rgb = (source[y0, x0] * (1 - tx) + source[y0, x1] * tx) * (1 - ty) + (source[y1, x0] * (1 - tx) + source[y1, x1] * tx) * ty
            rgb[~valid] = void
            result.paste(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))), (0, top))
        return result

