"""行政境界に沿う37小地域から、判定パスと共通の国・小地域ID画像を生成する。"""

import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image
from affine import Affine
from rasterio.features import rasterize
from shapely import union_all, transform
from shapely.geometry import box, mapping, shape
from region_boundaries import load_region_parts

ROOT = Path(__file__).resolve().parents[1]
WIDTH = 8192
NORTH = math.log(math.tan(math.pi / 4 + 75 * math.pi / 360))
SOUTH = math.log(math.tan(math.pi / 4 - 60 * math.pi / 360))
HEIGHT = round(WIDTH * (NORTH - SOUTH) / (2 * math.pi))


def project(longitude, latitude):
    return (
        (np.asarray(longitude) + 180) / 360 * WIDTH,
        (NORTH - np.log(np.tan(math.pi / 4 + np.asarray(latitude) * math.pi / 360)))
        / (NORTH - SOUTH)
        * HEIGHT,
    )


if __name__ == "__main__":
    parts = load_region_parts()
    countries = {
        country: index + 1
        for index, country in enumerate(sorted({part[0] for part in parts}))
    }
    grouped = [[] for _ in range(37)]
    country_shapes = []
    area_shapes = []
    for country, area, geometry in parts:
        projected = transform(
            shape(geometry).intersection(box(-180, -60, 180, 75)),
            project,
            interleaved=False,
        )
        if projected.is_empty:
            continue
        grouped[area].append(projected)
        country_shapes.append((mapping(projected), countries[country]))
        area_shapes.append((mapping(projected), area + 1))
    regions = []
    for area, parts in enumerate(grouped):
        merged = union_all(parts).simplify(0.25, preserve_topology=True)
        polygons = [merged] if merged.geom_type == "Polygon" else merged.geoms
        paths = []
        for polygon in polygons:
            for ring in [polygon.exterior, *polygon.interiors]:
                paths.append(
                    "M" + "L".join(f"{x:.2f},{y:.2f}" for x, y in ring.coords) + "Z"
                )
        regions.append({"id": str(area), "path": "".join(paths)})
    maps = ROOT / "public/maps"
    (maps / "small-regions.json").write_bytes(
        json.dumps(regions, separators=(",", ":")).encode()
    )
    # 同じ形状・順序・格子から生成し、国境と小地域境界のずれを生じさせない。
    for filename, shapes in [
        ("small-region-index.png", area_shapes),
        ("comparison/country-index.png", country_shapes),
    ]:
        pixels = rasterize(
            shapes,
            out_shape=(HEIGHT, WIDTH),
            transform=Affine.identity(),
            dtype="uint8",
        )
        Image.fromarray(pixels).save(maps / filename, optimize=True)
    files = [
        "small-regions.json",
        "small-region-index.png",
        "comparison/country-index.png",
    ]
    report = {
        "regions": len(regions),
        "countries": len(countries),
        "width": WIDTH,
        "height": HEIGHT,
        "files": {
            name: hashlib.sha256((maps / name).read_bytes()).hexdigest()
            for name in files
        },
    }
    (ROOT / "data/statistics/region-processing.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("行政境界から小地域・国境画像を生成:", len(regions), len(countries))
