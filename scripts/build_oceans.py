"""浅海・深海の二色で海を描き、滑らかな海岸の被覆率で陸と合成する。"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from netCDF4 import Dataset
from PIL import Image, ImageDraw
from scipy.ndimage import label

import build_generalized as generalized
from build_generalized import terrain, game

ROOT = game.ROOT
PARAMETERS = Path(__file__).parent / 'map_studies/ocean-parameters.json'
OUT = ROOT / 'assets/generated/map'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def curved_water_region(mask, tolerance, iterations, step):
    """海の色の輪郭だけを角切りで曲線化する。経度の両端でも形をつなぐ。"""
    margin = math.ceil(tolerance*4/step)+4
    padded = np.pad(mask, ((margin, margin), (0, 0)), mode='edge')
    padded = np.pad(padded, ((0, 0), (margin, margin)), mode='wrap')
    shapes = generalized.contour_shapes(np.pad(padded.astype(np.float32), 1), [.5], tolerance/2, 0, step)
    image = Image.new('L', (padded.shape[1]+2, padded.shape[0]+2))
    draw = ImageDraw.Draw(image)
    for _, area, ring in sorted(shapes, key=lambda item: abs(item[1]), reverse=True):
        points = ring[:-1]
        for _ in range(iterations):
            following = np.roll(points, -1, axis=0)
            points = np.stack((.75*points+.25*following, .25*points+.75*following), axis=1).reshape(-1, 2)
        draw.polygon([(float(x), float(y)) for y, x in points], fill=255 if area > 0 else 0)
    return np.asarray(image)[1+margin:-1-margin, 1+margin:-1-margin] > 0


def main():
    settings = json.loads(PARAMETERS.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    source = terrain.RAW / 'earth_relief_06m_p.grd'
    with Dataset(source) as dataset:
        lon = np.asarray(dataset['lon'][:]); lat = np.asarray(dataset['lat'][:])
        floor = np.minimum(np.asarray(dataset['z'][:], dtype=np.float32), 0)
        source_description = dataset.description
    print('水深から浅海を抽出し、浅海・深海の二色へ整理', flush=True)
    raw_depth = -floor[::-1]
    size = (len(lon), len(lat)); step = float(lon[1]-lon[0])
    original_shelf = (raw_depth < settings['shelf_depth_m']).astype(np.float32)
    shelf, shelf_regions = generalized.polygon_region(original_shelf > .5,
        settings['shelf_contour_tolerance_degrees'], settings['shelf_minimum_area_deg2'],
        settings['shelf_cleanup_degrees'], step)
    shelf = curved_water_region(shelf, settings['shelf_contour_tolerance_degrees'], settings['boundary_rounding_iterations'], step)
    config = json.loads(terrain.PARAMETERS.read_text(encoding='utf-8'))
    projection = terrain.Projection(config['projection'])
    top = (math.pi-game.NORTH_Y)/(2*math.pi)*8192
    bottom = (math.pi-game.SOUTH_Y)/(2*math.pi)*8192

    def project(image):
        full = projection.raster(image, config['preview']['void_color'])
        return full.transform((game.WIDTH, game.HEIGHT), Image.Transform.EXTENT, (0, top, full.width, bottom), Image.Resampling.BICUBIC)

    # 陸のマスクは地形整理版と同じ原本・解像度・投影で作る。湖は変更しない。
    land = terrain.raster_mask('ne_110m_land.geojson', size)
    # 海へつながらない水域（カスピ海など）も元の表現を保持する。
    water_regions, _ = label(np.asarray(land) == 0)
    areas = np.bincount(water_regions.ravel())
    areas[0] = 0
    ocean_id = int(areas.argmax())
    land = Image.fromarray(np.uint8(water_regions != ocean_id)*255)
    # 海岸は最終投影上で2倍描画し、面積平均で被覆率を求める。
    coast = Image.new('L', (game.WIDTH*2, game.HEIGHT*2))
    coast_draw = ImageDraw.Draw(coast)
    features = json.loads((terrain.RAW / 'ne_110m_land.geojson').read_text(encoding='utf-8'))['features']
    for feature in features:
        for polygon in terrain.polygons(feature['geometry']):
            for index, ring in enumerate(polygon):
                clipped = game.clip_latitude(game.clip_latitude(ring, -60, True), 75, False)
                if len(clipped) >= 3:
                    coast_draw.polygon([(x*2, y*2) for x,y in [game.project(lon,lat) for lon,lat,*_ in clipped]], fill=255 if index == 0 else 0)
    alpha = np.asarray(coast.resize((game.WIDTH, game.HEIGHT), Image.Resampling.BOX)).copy()
    # 内水域は既存の湖色を維持する。
    inland_mask = Image.fromarray(np.uint8((water_regions > 0) & (water_regions != ocean_id))*255)
    inland = np.asarray(project(inland_mask.convert('RGB')))[..., 0]
    alpha = np.maximum(alpha, np.where(inland == 255, 255, 0).astype(np.uint8))
    with Image.open(ROOT / 'assets/generated/terrain/地形整理.png') as image:
        base = np.asarray(image.convert('RGB')).copy()
    # 陸データの穴として定義された内海も、地表色で埋めず湖色にする。
    lake_color = json.loads(generalized.SETTINGS.read_text(encoding='utf-8'))['lake']
    for row in range(0, game.HEIGHT, 96):
        rows = slice(row, row+96)
        water_weight = inland[rows, ..., None].astype(np.float32)/255
        base[rows] = np.uint8(np.rint(base[rows]*(1-water_weight)+np.array(lake_color)*water_weight))
    def compose(shelf_mask):
        # 浅海と深海の二色で描き、連続的な濃淡や海底の陰影は加えない。
        colors = np.where(shelf_mask[..., None] > .5, np.array(settings['shelf']), np.array(settings['deep']))
        ocean = np.asarray(project(Image.fromarray(np.uint8(np.clip(colors, 0, 255)))))
        result = np.empty_like(base)
        for row in range(0, game.HEIGHT, 96):
            rows = slice(row, row+96)
            weight = alpha[rows, ..., None].astype(np.float32)/255
            result[rows] = np.uint8(np.clip(np.rint(base[rows]*weight+ocean[rows]*(1-weight)), 0, 255))
        return result

    print('二色の海と地表を合成', flush=True)
    original = compose(original_shelf)
    result = compose(shelf)
    changed_before_coast = int(np.any(result != original, axis=2).sum())
    max_boundary_difference = int(np.abs(result.astype(np.int16)-original.astype(np.int16)).max())
    protected = alpha == 255
    assert np.array_equal(result[protected], base[protected])
    Image.fromarray(alpha).save(OUT / 'land-mask.png')
    coast_checks = {'coast_highlight_pixels': 0, 'coast_shadow_pixels': 0, 'land_interior_unchanged': True}
    image = Image.fromarray(result)
    image.save(OUT / '世界地図.png')
    image.save(OUT / '世界地図.webp', quality=95, method=6)
    outputs = [{'file': p.relative_to(ROOT).as_posix(), 'sha256': digest(p)} for p in [OUT/'世界地図.png', OUT/'世界地図.webp']]
    checks = {'protected_pixels_before_coast_processing': int(protected.sum()), 'boundary_only_changed_pixels': changed_before_coast, 'boundary_only_changed_ratio': changed_before_coast/(game.WIDTH*game.HEIGHT), 'max_boundary_rgb_difference': max_boundary_difference, **coast_checks}
    inputs = [source, ROOT / 'assets/generated/terrain/地形整理.png', terrain.RAW / 'ne_110m_land.geojson', PARAMETERS, Path(__file__), Path(generalized.__file__)]
    report = {'size': [game.WIDTH, game.HEIGHT], 'projection': 'EPSG:3857', 'extent': [-180, -60, 180, 75], 'settings': settings, 'seafloor_relief': False, 'ocean_palette': [settings['deep'], settings['shelf']], 'shelf_regions': shelf_regions, 'checks': checks, 'source_description': source_description, 'inputs': [{'file': p.relative_to(ROOT).as_posix(), 'sha256': digest(p)} for p in inputs], 'outputs': outputs}
    (OUT / '生成記録.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('世界地図を生成完了。山地・高山の岩色と二色の海を合成。', flush=True)


if __name__ == '__main__':
    main()
