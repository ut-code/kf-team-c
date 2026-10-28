"""海底の細かな面模様を整理し、地表素材と海岸の立体感を合成する。"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from netCDF4 import Dataset
from PIL import Image, ImageDraw
from scipy.ndimage import label, distance_transform_edt, gaussian_filter

from land_materials import apply_materials
import build_generalized as generalized
from build_generalized import terrain, game

ROOT = game.ROOT
PARAMETERS = Path(__file__).parent / 'map_studies/ocean-parameters.json'
OUT = ROOT / 'assets/generated/map'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def round_corners(ring, iterations):
    """輪郭の頂点だけをChaikin法で丸める。画像や濃淡はぼかさない。"""
    points = ring[:-1]
    for _ in range(iterations):
        following = np.roll(points, -1, axis=0)
        points = np.stack((.75*points+.25*following, .25*points+.75*following), axis=1).reshape(-1, 2)
    return np.r_[points, points[:1]]


def rounded_shelves(field, settings, step):
    original = np.zeros(field.shape, dtype=np.float32)
    rounded = np.zeros(field.shape, dtype=np.float32)
    padded = np.pad(field, 1)
    count = 0
    for threshold in [.25, .65]:
        shapes = generalized.contour_shapes(padded, [threshold], settings['shelf_contour_tolerance_degrees'], settings['shelf_minimum_area_deg2'], step)
        masks = [Image.new('L', (field.shape[1]+2, field.shape[0]+2)) for _ in range(2)]
        draws = [ImageDraw.Draw(mask) for mask in masks]
        for _, area, ring in sorted(shapes, key=lambda item: abs(item[1]), reverse=True):
            for draw, outline in zip(draws, [ring, round_corners(ring, settings['boundary_rounding_iterations'])]):
                draw.polygon([(float(x), float(y)) for y, x in outline], fill=255 if area > 0 else 0)
            count += 1
        for mask, output in zip(masks, [original, rounded]):
            inside = np.asarray(mask)[1:-1, 1:-1] > 0
            distance = distance_transform_edt(inside) - distance_transform_edt(~inside)
            width = settings['shelf_transition_degrees']/step
            output += terrain.smoothstep(-width, width, distance)/2
    return original, rounded, count


def apply_coast_bevel(pixels, land, settings):
    """海岸だけに方向性のある細い明暗を付ける。端は経度方向に接続する。"""
    height = land.shape[0]
    halo = math.ceil(max(settings['coast_land_width_px'], settings['coast_sea_width_px'])) + 3
    azimuth = math.radians(settings['coast_light_azimuth_degrees'])
    light_x, light_y = math.sin(azimuth), -math.cos(azimuth)
    changed_land = changed_sea = 0
    for top in range(0, height, 96):
        bottom = min(top+96, height)
        start, end = max(top-halo, 0), min(bottom+halo, height)
        block = np.pad(land[start:end], ((max(halo-top, 0), max(bottom+halo-height, 0)), (0, 0)), mode='edge')
        block = np.pad(block, ((0, 0), (halo, halo)), mode='wrap')
        inside = distance_transform_edt(block).astype(np.float32)
        outside = distance_transform_edt(~block).astype(np.float32)
        dy, dx = np.gradient(inside-outside)
        length = np.maximum(np.hypot(dx, dy), 1e-6)
        facing = (-dx*light_x-dy*light_y)/length
        highlight = np.maximum(facing, 0)*np.clip(1-(inside-1)/settings['coast_land_width_px'], 0, 1)*block
        shadow = np.maximum(-facing, 0)*np.clip(1-(outside-1)/settings['coast_sea_width_px'], 0, 1)*(~block)
        center = (slice(halo, halo+bottom-top), slice(halo, -halo))
        delta = highlight[center]*settings['coast_highlight_strength'] - shadow[center]*settings['coast_shadow_strength']
        changed_land += int(((delta >= .5) & land[top:bottom]).sum())
        changed_sea += int(((delta <= -.5) & ~land[top:bottom]).sum())
        original = pixels[top:bottom].copy()
        pixels[top:bottom] = np.uint8(np.clip(np.rint(original.astype(np.float32)+delta[..., None]), 0, 255))
        interior = inside[center] > settings['coast_land_width_px']+1
        assert np.array_equal(pixels[top:bottom][interior], original[interior])
    return {'coast_highlight_pixels': changed_land, 'coast_shadow_pixels': changed_sea, 'land_interior_unchanged': True}


def main():
    settings = json.loads(PARAMETERS.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    source = terrain.RAW / 'earth_relief_06m_p.grd'
    with Dataset(source) as dataset:
        lon = np.asarray(dataset['lon'][:]); lat = np.asarray(dataset['lat'][:])
        floor = np.minimum(np.asarray(dataset['z'][:], dtype=np.float32), 0)
        source_description = dataset.description
    print('海底形状を再構成し、深海の細かな模様を平滑化', flush=True)
    elevation, shade, geometry = generalized.reconstruct(floor, lon, lat, settings)
    depth = -elevation[::-1]
    shade = shade[::-1]
    raw_depth = -floor[::-1]
    size = (len(lon), len(lat)); step = float(lon[1]-lon[0])
    field = 1-terrain.smoothstep(100, 900, raw_depth)
    original_shelf, shelf, shelf_regions = rounded_shelves(field, settings, step)
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
    alpha = np.asarray(project(land.convert('RGB')))[..., 0].copy()
    with Image.open(ROOT / 'assets/generated/terrain/地形整理.png') as image:
        base = np.asarray(image.convert('RGB')).copy()
    # 深海の面分割の痕跡を消し、大きな水深変化だけを残す。経度方向は循環する。
    sigma = settings['seafloor_smoothing_degrees']/step
    depth = gaussian_filter(depth, sigma, mode=('nearest', 'wrap'))
    shade = gaussian_filter(shade, sigma, mode=('nearest', 'wrap'))*settings['seafloor_shade_retention']
    shallow = 1-terrain.smoothstep(500, 6000, depth)
    quiet = np.array(settings['deep']) + shallow[..., None]*(np.array(settings['quiet_shallow'])-settings['deep'])
    relief = (np.array(settings['ridge_tint'])*(1-terrain.smoothstep(1200, 5500, depth))[..., None]
              + shade[..., None]*settings['relief_strength']
              - terrain.smoothstep(6000, 8500, depth)[..., None]*np.array(settings['trench_darkening']))

    def compose(shelf_mask):
        mix = shelf_mask[..., None]*settings['shelf_strength']
        colors = quiet*(1-mix) + np.array(settings['shelf'])*mix
        colors += relief*(1-shelf_mask[..., None])*settings['relief_opacity']
        ocean = np.asarray(project(Image.fromarray(np.uint8(np.clip(colors, 0, 255)))))
        result = np.empty_like(base)
        for row in range(0, game.HEIGHT, 96):
            rows = slice(row, row+96)
            weight = alpha[rows, ..., None].astype(np.float32)/255
            result[rows] = np.uint8(np.clip(np.rint(base[rows]*weight+ocean[rows]*(1-weight)), 0, 255))
        return result

    print('海の基準色を保ち、海底の濃淡と地表質感を合成', flush=True)
    original = compose(original_shelf)
    result = compose(shelf)
    changed_before_coast = int(np.any(result != original, axis=2).sum())
    max_boundary_difference = int(np.abs(result.astype(np.int16)-original.astype(np.int16)).max())
    protected = alpha == 255
    assert np.array_equal(result[protected], base[protected])
    # 海底の再計算なしで地表素材を調整できる中間画像。
    Image.fromarray(result).save(OUT / 'untextured.png')
    Image.fromarray(alpha).save(OUT / 'land-mask.png')
    texture_sources, materials = apply_materials(result)
    coast_checks = apply_coast_bevel(result, alpha >= 128, settings)
    image = Image.fromarray(result)
    image.save(OUT / '世界地図.png')
    image.save(OUT / '世界地図.webp', quality=95, method=6)
    outputs = [{'file': p.relative_to(ROOT).as_posix(), 'sha256': digest(p)} for p in [OUT/'世界地図.png', OUT/'世界地図.webp']]
    checks = {'protected_pixels_before_coast_processing': int(protected.sum()), 'boundary_only_changed_pixels': changed_before_coast, 'boundary_only_changed_ratio': changed_before_coast/(game.WIDTH*game.HEIGHT), 'max_boundary_rgb_difference': max_boundary_difference, **coast_checks}
    inputs = [source, ROOT / 'assets/generated/terrain/地形整理.png', terrain.RAW / 'ne_110m_land.geojson', PARAMETERS, *texture_sources, Path(__file__), Path(generalized.__file__)]
    report = {'size': [game.WIDTH, game.HEIGHT], 'projection': 'EPSG:3857', 'extent': [-180, -60, 180, 75], 'settings': settings, 'seafloor_relief': True, 'land_materials': materials, 'shelf_regions': shelf_regions, 'checks': checks, 'source_description': source_description, 'inputs': [{'file': p.relative_to(ROOT).as_posix(), 'sha256': digest(p)} for p in inputs], 'outputs': outputs}
    (OUT / '生成記録.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('世界地図を生成完了。海底の模様を整理し、ambientCGの地表質感を適用。', flush=True)


if __name__ == '__main__':
    main()
