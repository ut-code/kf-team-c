"""実人口の都市集積から、描画専用の侵攻順を生成する。月次の地域モデルは変更しない。"""
import heapq
import io
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from invasion_connectivity import communication_links, wrapped_delta

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / 'public/maps/textures'
WIDTH = 2048
POPULATION_WEIGHT = .97
LAND_WEIGHT = .03
URBAN_RADIUS_CELLS = 6
# 人口密度50人/km²以上では面積を補正せず、疎な地域では最大1.7乗で抑える。
DENSE_REGION_PEOPLE_PER_KM2 = 50
SPARSE_REGION_MAX_EXPONENT = 1.7
NORTH = math.log(math.tan(math.pi / 4 + math.radians(75) / 2))
SOUTH = math.log(math.tan(math.pi / 4 + math.radians(-60) / 2))


def project(lon, lat, height):
    return ((lon + 180) / 360 * WIDTH,
            (NORTH - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))
            / (NORTH - SOUTH) * height)


def relief(shape, seed):
    """固定の通過コスト。起点を乱数で配置せず、前線の凹凸だけを作る。"""
    rng = np.random.default_rng(seed)
    h, w = shape
    result = np.zeros(shape, dtype=np.float32)
    for cell, weight in [(48, .60), (18, .30), (6, .10)]:
        coarse = rng.random((h // cell + 2, w // cell + 2)).astype('float32')
        layer = Image.fromarray(coarse).resize((w, h), Image.Resampling.BILINEAR)
        result += np.asarray(layer) * weight
    return result


def urban_centers(points, areas, weights):
    """人口密度の高い実在の居住セルを選び、同一都市の重複を除く。"""
    h, w = areas.shape
    groups = [[] for _ in range(38)]

    def urban_population(point):
        x, y = map(round, project(point['longitude'], point['latitude'], h))
        y0, y1 = max(0, y - URBAN_RADIUS_CELLS), min(h, y + URBAN_RADIUS_CELLS + 1)
        x0, x1 = max(0, x - URBAN_RADIUS_CELLS), min(w, x + URBAN_RADIUS_CELLS + 1)
        mask = areas[y0:y1, x0:x1] == point['area'] + 1
        return weights[y0:y1, x0:x1][mask].sum()

    for area in range(1, 38):
        # 単一セルの密度ではなく、周囲を含む都市圏の人口集積を優先する。
        candidates = sorted((p for p in points if p['area'] == area - 1),
                            key=urban_population, reverse=True)
        if area == 1:
            # アメリカのAI企業の初期普及はベイエリアから始める。
            longitude, latitude = -122.42, 37.77
            x, y = map(round, project(longitude, latitude, h))
            if areas[y, x] != area:
                raise ValueError('ベイエリアの起点が北米西岸の陸地にありません。')
            definition = json.loads((ROOT / 'src/game/data/regions.json').read_text(encoding='utf-8'))[0]
            # 代表点に都市がない場合も座標をずらさず、GHSLの格子人口から密度を求める。
            mass = max(0, (weights[y, x] - LAND_WEIGHT / np.sum(areas == area)) / POPULATION_WEIGHT)
            cell_km2 = (40075.017 / w * math.cos(math.radians(latitude)))**2
            density = mass * definition['population'] * 1_000_000 / cell_km2
            candidates.insert(0, dict(longitude=longitude, latitude=latitude, density=density))
        for p in candidates:
            if p['density'] < 150 and groups[area]:
                continue
            x, y = project(p['longitude'], p['latitude'], h)
            # ID画像の縮小で落ちる海岸都市は、同地域の最寄り陸セルへ合わせる。
            ix, iy = round(x), round(y)
            y0, y1 = max(0, iy - 5), min(h, iy + 6)
            x0, x1 = max(0, ix - 5), min(w, ix + 6)
            yy, xx = np.nonzero(areas[y0:y1, x0:x1] == area)
            if not len(xx):
                continue
            nearest = np.argmin((xx + x0 - x)**2 + (yy + y0 - y)**2)
            x, y = int(xx[nearest] + x0), int(yy[nearest] + y0)
            separation = max(4, 9 / max(.3, math.cos(math.radians(p['latitude']))))
            if any(math.hypot(x - c['x'], y - c['y']) < separation for c in groups[area]):
                continue
            groups[area].append(dict(x=x, y=y, density=p['density'],
                                     longitude=p['longitude'], latitude=p['latitude']))
            if len(groups[area]) >= 24:
                break
        if not groups[area]:
            raise ValueError(f'都市起点がない地域: {area}')
    return groups


def passage(areas, groups):
    """都市間の接続帯と人口集積を通りやすくした模式的な通過コスト。道路の実測ではない。"""
    yy, xx = np.indices(areas.shape, dtype=np.float32)
    activity = np.zeros(areas.shape, dtype=np.float32)
    corridors = np.zeros_like(activity)
    for area, cities in enumerate(groups):
        mask = areas == area
        for city in cities:
            radius = 3 + min(7, math.log1p(city['density']) / 2)
            city_dx = (xx - city['x'] + areas.shape[1] / 2) % areas.shape[1] - areas.shape[1] / 2
            activity = np.maximum(activity, np.exp(-(city_dx**2 + (yy-city['y'])**2)
                                                   / (2*radius**2)) * mask)
        # 都市間は幅のある接続帯にし、細い回廊だけが先走る形を避ける。
        for i, city in enumerate(cities[1:], 1):
            parent = min(cities[:i], key=lambda c: wrapped_delta(c['x']-city['x'], areas.shape[1])**2 + (c['y']-city['y'])**2)
            dx, dy = wrapped_delta(city['x']-parent['x'], areas.shape[1]), city['y']-parent['y']
            offset_x = (xx - parent['x'] + areas.shape[1] / 2) % areas.shape[1] - areas.shape[1] / 2
            t = np.clip((offset_x*dx + (yy-parent['y'])*dy) / max(1, dx*dx+dy*dy), 0, 1)
            distance = (offset_x-t*dx)**2 + (yy-parent['y']-t*dy)**2
            corridors = np.maximum(corridors, np.exp(-distance / 32) * mask)
    rough = relief(areas.shape, 2030)
    cost = np.exp(rough * 1.8) / (1 + 2*activity + 1.5*corridors)
    return cost.astype(np.float32)


def arrival(areas, groups, cost, connections, kind='adoption'):
    """陸上の8近傍と、同地域内の通信接続から到達時間を求める。"""
    h, w = areas.shape
    distance = np.full((h, w), np.inf, dtype=np.float64)
    queue = []
    connected = {}
    for source, target, length in connections:
        connected.setdefault(source, []).append((target, length))
    for cities in groups:
        # 依存は別の都市集積から始める。都市が一つならその都市内の別セルを選ぶ。
        order = cities
        if kind == 'dependency':
            order = cities[1::2] + cities[::2]
        elif kind == 'opposition':
            order = cities[2::3] + cities[1::3] + cities[::3]
        for index, city in enumerate(order):
            x, y = city['x'], city['y']
            if kind != 'adoption' and len(cities) == 1:
                options = [((x+dx) % w, y+dy) for dx, dy in [(2,0),(-2,0),(0,2),(0,-2)]
                           if 0 <= y+dy < h and areas[y+dy,(x+dx) % w] == areas[y,x]
                           and areas[y+dy//2,(x+dx//2) % w] == areas[y,x]]
                if options:
                    x, y = options[0]
            delay = index * 55.0
            if delay < distance[y,x]:
                distance[y,x] = delay
                heapq.heappush(queue, (delay, y, x))
    directions = [(0, 1, 1), (0, -1, 1), (1, 0, 1), (-1, 0, 1),
                  (1, 1, math.sqrt(2)), (1, -1, math.sqrt(2)),
                  (-1, 1, math.sqrt(2)), (-1, -1, math.sqrt(2))]
    while queue:
        value, y, x = heapq.heappop(queue)
        if value > distance[y,x]:
            continue
        for target, length in connected.get(y * w + x, ()):
            ty, tx = divmod(target, w)
            candidate = value + length * (float(cost[y,x]) + float(cost[ty,tx])) * .5
            if candidate < distance[ty,tx]:
                distance[ty,tx] = candidate
                heapq.heappush(queue, (candidate,ty,tx))
        area = areas[y,x]
        for dy, dx, length in directions:
            ny, nx = y+dy, (x+dx) % w
            if not 0 <= ny < h or areas[ny,nx] != area:
                continue
            if dx and dy and (areas[y,nx] != area or areas[ny,x] != area):
                continue
            next_value = value + (float(cost[y,x])+float(cost[ny,nx])) * .5 * length
            if next_value < distance[ny,nx]:
                distance[ny,nx] = next_value
                heapq.heappush(queue, (next_value,ny,nx))
    return distance


def population_weights(areas):
    """GHSLの実人口を表示格子へ集計する。実行時には格子や個人を保持しない。"""
    import rasterio
    from rasterio.windows import Window

    source = ROOT / 'tmp/data/GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif'
    population = np.zeros(areas.shape, dtype=np.float64)
    with rasterio.open(source) as dataset:
        if dataset.crs.to_epsg() != 4326 or dataset.transform.b or dataset.transform.d:
            raise ValueError('GHSL人口原本は回転のない経緯度格子である必要があります。')
        longitudes = dataset.transform.c + (np.arange(dataset.width) + .5) * dataset.transform.a
        columns = np.floor((longitudes + 180) / 360 * areas.shape[1]).astype(np.int32)
        for start in range(0, dataset.height, 128):
            count = min(128, dataset.height - start)
            latitudes = dataset.transform.f + (start + np.arange(count) + .5) * dataset.transform.e
            valid_rows = (latitudes >= -60) & (latitudes <= 75)
            if not np.any(valid_rows):
                continue
            ys = np.zeros(count, dtype=np.int32)
            mercator = np.log(np.tan(np.pi / 4 + np.radians(latitudes[valid_rows]) / 2))
            ys[valid_rows] = np.floor((NORTH - mercator) / (NORTH - SOUTH) * areas.shape[0]).astype(np.int32)
            values = dataset.read(1, window=Window(0, start, dataset.width, count))
            valid = (values > 0) & valid_rows[:, None] & (columns >= 0)[None, :] & (columns < areas.shape[1])[None, :]
            row, column = np.nonzero(valid)
            indices = ys[row] * areas.shape[1] + columns[column]
            population += np.bincount(indices, weights=values[row, column], minlength=population.size).reshape(areas.shape)
    weights = np.zeros_like(population)
    for area in range(1, 38):
        mask = areas == area
        total = population[mask].sum()
        if total <= 0:
            raise ValueError(f'人口が取得できない地域: {area}')
        # 人口密度を主とし、無人地帯は終盤にだけ埋まるよう薄い面積重みを加える。
        weights[mask] = population[mask] / total * POPULATION_WEIGHT + LAND_WEIGHT / mask.sum()
    return weights


def footprint_exponents(areas):
    """低人口密度の広域ほど、同じ人口比率に対する初期の表示面積を小さくする。"""
    definitions = json.loads((ROOT / 'src/game/data/regions.json').read_text(encoding='utf-8'))
    h, w = areas.shape
    mercator_y = NORTH - (np.arange(h) + .5) / h * (NORTH - SOUTH)
    latitude = 2 * np.arctan(np.exp(mercator_y)) - np.pi / 2
    cell_area = (40075.017 / w * np.cos(latitude))**2
    exponents = {}
    for area, definition in enumerate(definitions, 1):
        land_km2 = (np.sum(areas == area, axis=1) * cell_area).sum()
        density = definition['population'] * 1_000_000 / land_km2
        exponents[area] = 1 + (SPARSE_REGION_MAX_EXPONENT - 1) * (1 - min(1, density / DENSE_REGION_PEOPLE_PER_KM2))
    return exponents


def ranks(areas, distance, weights, exponents):
    result = np.full(areas.shape, 65535, dtype=np.uint16)
    for area in range(1, 38):
        mask = areas == area
        values = distance[mask]
        if not np.all(np.isfinite(values)):
            raise ValueError(f'地域{area}に都市から到達できない陸地が残っています')
        order = np.argsort(values, kind='stable')
        mass = weights[mask]
        quantiles = np.empty(len(values), dtype=np.float64)
        population_fraction = np.cumsum(mass[order]) / mass.sum()
        land_fraction = (np.arange(len(values)) + 1) / len(values)
        # 面積予算は地域の人口密度に合わせる。割合1では従来どおり全域に到達する。
        # 無人地帯の除外ではなく、低密度地域の初期の見かけ面積を抑える補正。
        land_rank = land_fraction ** (1 / exponents[area])
        quantiles[order] = np.maximum(population_fraction, land_rank)
        # 上へ丸め、人口予算に届かないセルを先に塗る誤差を防ぐ。
        result[mask] = np.clip(np.ceil(quantiles * 65535), 1, 65535).astype(np.uint16)
    return result


def build():
    source = Image.open(TEXTURES / 'small-region-index.png').convert('L')
    height = round(source.height * WIDTH / source.width)
    areas = np.asarray(source.resize((WIDTH,height), Image.Resampling.NEAREST))
    points = json.loads((ROOT/'src/game/data/world.json').read_text(encoding='utf-8'))['points']
    print('人口密度を描画格子へ集計', flush=True)
    weights = population_weights(areas)
    groups = urban_centers(points, areas, weights)
    connections = communication_links(areas.tobytes(), WIDTH, height, groups[1:])
    exponents = footprint_exponents(areas)
    cost = passage(areas, groups)
    print('AI利用の到達順を生成', flush=True)
    adoption = ranks(areas, arrival(areas, groups, cost, connections), weights, exponents)
    dependency_cost = cost * (.5 + relief(areas.shape, 501) * 2)
    print('AI依存の到達順を生成', flush=True)
    dependency = ranks(areas, arrival(areas, groups, dependency_cost, connections, 'dependency'), weights, exponents)
    # 依存は使用領域内。起点と進行経路は別に持ち、同じマスクの縮小版にしない。
    dependency = np.maximum(dependency, adoption)
    opposition_cost = cost * (.5 + relief(areas.shape, 907) * 2)
    print('反AIの到達順を生成', flush=True)
    opposition = ranks(areas, arrival(areas, groups, opposition_cost, connections, 'opposition'), weights, exponents)
    for name, rank in [('使用', adoption), ('依存', dependency), ('反AI', opposition)]:
        for area in range(1, 38):
            mask = areas == area
            for amount in [0, .0001, .001, .01, .1, .5, .9]:
                covered = weights[mask & (rank / 65535 <= amount)].sum()
                land = np.mean(rank[mask] / 65535 <= amount)
                if covered > amount + 1e-9 or land > amount ** exponents[area] + 1e-9:
                    raise ValueError(f'{name}: 地域{area}の表示が人口・面積予算を超えています。')
    # RGBの3列アトラス。画像のアルファ前乗算で16bitの下位桁が失われるのを防ぐ。
    def encode(rank):
        return np.stack([rank >> 8, rank & 255, np.zeros_like(rank)], axis=-1).astype('uint8')
    pixels = np.concatenate([encode(adoption), encode(dependency), encode(opposition)], axis=1)
    # 完成してから差し替え、保存失敗時に使用中の地図素材を壊さない。
    encoded = io.BytesIO()
    Image.fromarray(pixels).save(encoded, format='PNG', optimize=True)
    pending = TEXTURES / 'invasion-rank.pending.png'
    try:
        pending.write_bytes(encoded.getbuffer())
        pending.replace(TEXTURES / 'invasion-rank.png')
    finally:
        pending.unlink(missing_ok=True)
    report = {'width': WIDTH, 'height': height, 'urbanCenters': groups[1:],
              'source': 'src/game/data/world.json / GHSL 2020 population sample',
              'channels': {'RG, first third': 'adoption uint16', 'RG, second third': 'dependency uint16', 'RG, third third': 'antiAI uint16'},
              'coverageWeight': {'population': POPULATION_WEIGHT, 'landArea': LAND_WEIGHT},
              'areaBudgetExponents': exponents,
              'urbanOrder': 'population mass of neighboring cells; Bay Area first in us-west',
              'urbanRadiusCells': URBAN_RADIUS_CELLS,
              'populationSource': 'GHSL GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif',
              'front': '8-neighbor travel time, broad urban corridors, smooth low-contrast passage cost',
              'interpretation': 'visual growth order, not population or measured transport routes'}
    (ROOT/'data/statistics/invasion-processing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'都市起点の前線テクスチャ: {WIDTH} x {height}, {sum(map(len,groups))} centers',flush=True)


if __name__ == '__main__':
    build()
    # Apply the playable visual coverage after refreshing GHSL city seeds.
    from build_visual_invasion import build as build_visual
    build_visual()
