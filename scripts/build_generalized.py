"""標高の代表点と単純化した標高線から地形を再構成する。画像ぼかしは使わない。"""
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np
from netCDF4 import Dataset
from PIL import Image, ImageDraw
from scipy.ndimage import maximum_filter, minimum_filter, label, find_objects, grey_closing, binary_opening, binary_closing
from scipy.spatial import Delaunay
from skimage.measure import find_contours, approximate_polygon
from skimage.morphology import reconstruction

import build_map as game
sys.path.insert(0, str(Path(__file__).parent / 'map_studies'))
import build as terrain

SETTINGS = Path(__file__).parent / 'map_studies/generalized-parameters.json'
OUT = game.ROOT / 'assets/generated/terrain'


def signed_area(points):
    return np.sum(points[:-1, 1] * points[1:, 0] - points[1:, 1] * points[:-1, 0]) / 2


def contour_shapes(field, levels, tolerance, minimum_area, step):
    shapes = []
    for level in levels:
        for ring in find_contours(field, level):
            if np.linalg.norm(ring[0] - ring[-1]) > 1e-6:
                continue
            area = signed_area(ring)
            if abs(area) * step * step < minimum_area:
                continue
            simple = approximate_polygon(ring, tolerance=tolerance / step)
            if len(simple) >= 4:
                shapes.append((float(level), float(area), simple))
    return shapes


def polygon_region(inside, tolerance, minimum_area, cleanup, step):
    """細い突起を整理し、直線の輪郭で領域を描く。色は混ぜない。"""
    radius = max(1, round(cleanup/step))
    footprint = np.ones((radius*2+1, radius*2+1), dtype=bool)
    margin = radius*4
    padded = np.pad(inside, ((margin, margin), (0, 0)), mode='edge')
    padded = np.pad(padded, ((0, 0), (margin, margin)), mode='wrap')
    cleaned = binary_closing(binary_opening(padded, structure=footprint), structure=footprint)
    cleaned = cleaned[margin:-margin, margin:-margin]
    shapes = contour_shapes(np.pad(cleaned.astype(np.float32), 1), [.5], tolerance, minimum_area, step)
    image = Image.new('L', (inside.shape[1]+2, inside.shape[0]+2))
    draw = ImageDraw.Draw(image)
    for _, area, ring in sorted(shapes, key=lambda item: abs(item[1]), reverse=True):
        draw.polygon([(float(x), float(y)) for y, x in ring], fill=255 if area > 0 else 0)
    return np.asarray(image)[1:-1, 1:-1] > 0, len(shapes)


def climate_regions(field, settings, step):
    """環境色を一段階で分類し、中間色の帯と小さな斑点を減らす。"""
    inside, count = polygon_region(field >= settings['climate_threshold'],
        settings['climate_tolerance_degrees'], settings['climate_minimum_area_deg2'],
        settings['climate_cleanup_degrees'], step)
    return inside.astype(np.float32), count


def aggregate_massifs(z, step, settings):
    """浅い分断をつなぎ、鞍部からの比高が小さい峰を同じ山塊へ統合する。"""
    radius = max(1, round(settings['massif_gap_radius_degrees']/step))
    yy, xx = np.mgrid[-radius:radius+1, -radius:radius+1]
    footprint = xx*xx+yy*yy <= radius*radius
    # 狭く浅い谷だけを持ち上げる。深い主要な谷まで埋めないよう上限を設ける。
    connected = np.minimum(grey_closing(z, footprint=footprint), z+settings['massif_max_valley_fill_m'])
    prominence = settings['massif_peak_prominence_m']
    # h-dome除去: 画像の平均化ではなく、峰と鞍部の高さ関係による再構成。
    grouped = reconstruction(connected-prominence, connected, method='dilation').astype(np.float32)
    grouped = np.maximum(grouped, 0)
    # 標高の絶対値をゲーム用に再強調して埋め合わせる処理はしない。
    report = {'peak_prominence_m': prominence, 'valley_fill_limit_m': settings['massif_max_valley_fill_m'], 'connection_radius_degrees': settings['massif_gap_radius_degrees'], 'maximum_elevation_before_m': float(z.max()), 'maximum_elevation_after_m': float(grouped.max()), 'mean_absolute_elevation_change_m': float(np.abs(grouped-z).mean())}
    return grouped, report


def reconstruct(z, lon, lat, settings):
    step = float(lon[1] - lon[0])
    spacing = round(settings['anchor_spacing_degrees'] / step)
    rows = np.unique(np.r_[np.arange(0, z.shape[0], spacing), z.shape[0]-1])
    cols = np.unique(np.r_[np.arange(0, z.shape[1], spacing), z.shape[1]-1])
    yy, xx = np.meshgrid(rows, cols, indexing='ij')
    points = [np.c_[xx.ravel(), yy.ravel()]]
    heights = [z[yy, xx].ravel()]
    shapes = contour_shapes(z, settings['contour_levels_m'], settings['contour_tolerance_degrees'], settings['minimum_contour_area_deg2'], step)
    for level, _, ring in shapes:
        points.append(ring[:-1, ::-1])
        heights.append(np.full(len(ring)-1, level))
    # 局所の小さな峰ではなく、数百km単位の主要な高点と高原内の低点を残す。
    window = round(settings['peak_spacing_degrees'] / step) | 1
    for extrema in [maximum_filter(z, size=window), minimum_filter(z, size=window)]:
        components, count = label((z == extrema) & (z >= settings['minimum_peak_m']))
        for index, region in enumerate(find_objects(components), 1):
            if region is None:
                continue
            pixels = np.argwhere(components[region] == index)
            y, x = pixels[len(pixels)//2] + [region[0].start, region[1].start]
            points.append(np.array([[x, y]]))
            heights.append(np.array([z[y, x]]))
    xy, keep = np.unique(np.round(np.concatenate(points), 5), axis=0, return_index=True)
    values = np.concatenate(heights)[keep]
    tri = Delaunay(xy)
    # 各面の法線を実際の地形寸法から作る。写真の影は使用しない。
    latitude = np.interp(xy[:, 1], np.arange(len(lat)), lat)
    vertices = np.c_[xy[:, 0] * step * 111000, xy[:, 1] * step * 111000, values * settings['vertical_exaggeration']]
    a = vertices[tri.simplices[:, 1]] - vertices[tri.simplices[:, 0]]
    b = vertices[tri.simplices[:, 2]] - vertices[tri.simplices[:, 0]]
    longitude_scale = np.cos(np.radians(latitude[tri.simplices].mean(axis=1)))
    a[:, 0] *= longitude_scale
    b[:, 0] *= longitude_scale
    face = np.cross(a, b)
    face *= np.where(face[:, 2:3] < 0, -1, 1)
    normal = np.zeros((len(xy), 3), dtype=np.float64)
    for corner in range(3):
        np.add.at(normal, tri.simplices[:, corner], face)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-8)
    face /= np.maximum(np.linalg.norm(face, axis=1, keepdims=True), 1e-8)
    az = math.radians(settings['light_azimuth_degrees'])
    alt = math.radians(settings['light_altitude_degrees'])
    light = np.array([math.sin(az)*math.cos(alt), math.cos(az)*math.cos(alt), math.sin(alt)])
    elevation = np.empty(z.shape, dtype=np.float32)
    illumination = np.empty(z.shape, dtype=np.float32)
    for top in range(0, z.shape[0], 48):
        yy, xx = np.meshgrid(np.arange(top, min(top+48, z.shape[0])), np.arange(z.shape[1]), indexing='ij')
        query = np.c_[xx.ravel(), yy.ravel()]
        indices = tri.find_simplex(query)
        assert np.all(indices >= 0)
        transform = tri.transform[indices]
        weights = np.einsum('nij,nj->ni', transform[:, :2], query-transform[:, 2])
        weights = np.c_[weights, 1-weights.sum(axis=1)]
        corners = tri.simplices[indices]
        elevation[top:top+len(yy)] = np.sum(values[corners]*weights, axis=1).reshape(yy.shape)
        n = np.einsum('ni,nij->nj', weights, normal[corners])
        n = n*settings['normal_smooth_mix'] + face[indices]*(1-settings['normal_smooth_mix'])
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-8)
        illumination[top:top+len(yy)] = (n @ light - light[2]).reshape(yy.shape)
    return elevation, illumination, {'representative_vertices': len(xy), 'triangles': len(tri.simplices), 'elevation_contours': len(shapes)}


def main():
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    settings = json.loads(SETTINGS.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    with Dataset(terrain.RAW / 'earth_relief_06m_p.grd') as dataset:
        lon = np.asarray(dataset['lon'][:]); lat = np.asarray(dataset['lat'][:])
        z = np.maximum(np.asarray(dataset['z'][:], dtype=np.float32), 0)
        source_description = dataset.description
    print('近接する峰を山塊へまとめ、浅い分断と小さな峰を整理', flush=True)
    grouped, massif_report = aggregate_massifs(z, float(lon[1]-lon[0]), settings)
    elevation, shade, report = reconstruct(grouped, lon, lat, settings)
    report['massif_aggregation'] = massif_report
    # NetCDFは南から北へ並ぶ。画像では北を上にする。
    elevation = elevation[::-1]; shade = shade[::-1]
    size = (len(lon), len(lat)); step = float(lon[1]-lon[0])
    source = np.asarray(terrain.read_source('HYP_50M_SR', size), dtype=np.float32) / 255
    r, g, b = source[..., 0], source[..., 1], source[..., 2]
    forest, forest_count = climate_regions(terrain.smoothstep(.008, .12, g-r), settings, step)
    desert, desert_count = climate_regions(terrain.smoothstep(.008, .14, r-b), settings, step)
    ice, ice_count = climate_regions(terrain.smoothstep(.002, .06, b-g)*terrain.smoothstep(.02, .1, b-r)*terrain.smoothstep(.48, .78, (r+g+b)/3), settings, step)
    land = np.asarray(terrain.raster_mask('ne_110m_land.geojson', size), dtype=np.float32)/255
    lakes = np.asarray(terrain.raster_mask('ne_110m_lakes.geojson', size), dtype=np.float32)/255
    rgb = np.broadcast_to(np.array(settings['land'], dtype=np.float32), (*land.shape, 3)).copy()
    for mask, name in [(forest, 'forest'), (desert, 'desert'), (ice, 'ice')]:
        rgb = np.where(mask[..., None] > .5, np.array(settings[name]), rgb)
    # 斜面の照明や標高による明暗を付けず、岩地の色で山岳帯を表す。
    radius = max(1, round(settings['mountain_neighborhood_degrees']/step))
    local_relief = (maximum_filter(elevation, size=radius*2+1, mode=('nearest', 'wrap'))
                    - minimum_filter(elevation, size=radius*2+1, mode=('nearest', 'wrap')))
    rugged = terrain.smoothstep(settings['mountain_relief_start_m'], settings['mountain_relief_full_m'], local_relief)
    mountain = terrain.smoothstep(settings['mountain_start_m'], settings['mountain_full_m'], elevation)*rugged
    # 山地と高山は二段階の岩色で描く。氷雪との境界にも広い混色帯を作らない。
    mountain = np.maximum(mountain, terrain.smoothstep(2200, 3600, elevation))
    mountain, mountain_count = polygon_region(mountain >= settings['mountain_coverage_threshold'],
        settings['mountain_contour_tolerance_degrees'], settings['mountain_minimum_area_deg2'],
        settings['mountain_cleanup_degrees'], step)
    high, high_count = polygon_region(elevation >= settings['mountain_high_start_m'],
        settings['mountain_contour_tolerance_degrees'], settings['mountain_minimum_area_deg2'],
        settings['mountain_cleanup_degrees'], step)
    mountain = mountain & (ice < .5)
    high = high & mountain
    rock_color = np.where(high[..., None], np.array(settings['mountain_high']), np.array(settings['mountain']))
    rgb = np.where(mountain[..., None], rock_color, rgb)
    mountain = mountain.astype(np.float32)
    rgb = rgb*(1-lakes[..., None]) + np.array(settings['lake'])*lakes[..., None]
    # 海との被覆率合成は最終投影後に一度だけ行う。
    flat = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))
    config = json.loads(terrain.PARAMETERS.read_text(encoding='utf-8'))
    projection = terrain.Projection(config['projection'])
    full = projection.raster(flat, config['preview']['void_color'])
    top = (math.pi-game.NORTH_Y)/(2*math.pi)*full.height
    bottom = (math.pi-game.SOUTH_Y)/(2*math.pi)*full.height
    world = full.transform((game.WIDTH, game.HEIGHT), Image.Transform.EXTENT, (0, top, full.width, bottom), Image.Resampling.BICUBIC)
    # 岩地の素材マスクも地表の配色と同じ山岳帯へ揃える。
    ice_cover = np.where(mountain > 0, 0, ice)
    available = 1-ice_cover
    rock = mountain
    available = available-rock
    desert_weight = available*desert
    available = available-desert_weight
    forest_weight = available*forest
    cover = {'ice': ice_cover, 'rock': rock, 'desert': desert_weight, 'forest': forest_weight, 'grassland': available-forest_weight}
    (OUT / 'masks').mkdir(exist_ok=True)
    for name, mask in cover.items():
        image = Image.fromarray(np.uint8(np.clip(mask*land*(1-lakes)*255, 0, 255))).convert('RGB')
        projected = projection.raster(image, [0, 0, 0])
        projected = projected.transform((game.WIDTH, game.HEIGHT), Image.Transform.EXTENT, (0, top, projected.width, bottom), Image.Resampling.BICUBIC)
        projected.getchannel('R').save(OUT / 'masks' / f'{name}.png')
    # 表示中の画像を直接上書きせず、保存が完了してから置き換える。
    for suffix, options in [('png', {}), ('webp', {'quality': 95, 'method': 6})]:
        temporary = OUT / f'地形整理.tmp.{suffix}'
        world.save(temporary, **options)
        temporary.replace(OUT / f'地形整理.{suffix}')
    inputs = [SETTINGS] + [terrain.RAW / name for name in ['earth_relief_06m_p.grd', 'HYP_50M_SR.tif', 'HYP_50M_SR.tfw', 'ne_110m_land.geojson', 'ne_110m_lakes.geojson']]
    report.update({'climate_regions': {'forest': forest_count, 'desert': desert_count, 'ice': ice_count}, 'mountain_regions': {'mountain': mountain_count, 'high': high_count}, 'size': list(world.size), 'projection': 'EPSG:3857', 'extent': [-180, -60, 180, 75], 'source_description': source_description, 'settings': settings, 'script_sha256': script_hash, 'inputs': [{'file': p.relative_to(game.ROOT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in inputs], 'output_sha256': hashlib.sha256((OUT / '地形整理.webp').read_bytes()).hexdigest()})
    (OUT / '生成記録.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key not in {'settings', 'source_description'}}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
