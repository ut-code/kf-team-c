"""実人口の都市集積から、描画専用の侵攻順を生成する。月次の地域モデルは変更しない。"""
import heapq
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / 'public/maps/textures'
WIDTH = 2048
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
    for cell, weight in [(22, .50), (9, .35), (3, .15)]:
        coarse = rng.random((h // cell + 2, w // cell + 2)).astype('float32')
        layer = Image.fromarray(coarse).resize((w, h), Image.Resampling.NEAREST)
        result += np.asarray(layer) * weight
    return result


def urban_centers(points, areas):
    """人口密度の高い実在の居住セルを選び、同一都市の重複を除く。"""
    h, w = areas.shape
    groups = [[] for _ in range(38)]
    for area in range(1, 38):
        candidates = sorted((p for p in points if p['area'] == area - 1),
                            key=lambda p: -p['density'])
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
            activity = np.maximum(activity, np.exp(-((xx-city['x'])**2 + (yy-city['y'])**2)
                                                   / (2*radius**2)) * mask)
        # 各都市を近い上位都市へ結び、円ではなく枝分かれした前線を作る。
        for i, city in enumerate(cities[1:], 1):
            parent = min(cities[:i], key=lambda c: (c['x']-city['x'])**2 + (c['y']-city['y'])**2)
            dx, dy = city['x']-parent['x'], city['y']-parent['y']
            t = np.clip(((xx-parent['x'])*dx + (yy-parent['y'])*dy) / max(1, dx*dx+dy*dy), 0, 1)
            distance = (xx-parent['x']-t*dx)**2 + (yy-parent['y']-t*dy)**2
            corridors = np.maximum(corridors, np.exp(-distance/7) * mask)
    rough = relief(areas.shape, 2030)
    cost = np.exp(rough * 5) / (1 + 7*activity + 5*corridors)
    return cost.astype(np.float32)


def arrival(areas, groups, cost, kind='adoption'):
    """4近傍の最小通過時間。角を持つ前線を作り、海や地域境界を横切らない。"""
    h, w = areas.shape
    distance = np.full((h, w), np.inf, dtype=np.float64)
    queue = []
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
                options = [(x+dx, y+dy) for dx, dy in [(2,0),(-2,0),(0,2),(0,-2)]
                           if 0 <= x+dx < w and 0 <= y+dy < h and areas[y+dy,x+dx] == areas[y,x]]
                if options:
                    x, y = options[0]
            delay = index * 55.0
            if delay < distance[y,x]:
                distance[y,x] = delay
                heapq.heappush(queue, (delay, y, x))
    directions = [(0, 1, 1), (0, -1, 1), (1, 0, 1), (-1, 0, 1)]
    while queue:
        value, y, x = heapq.heappop(queue)
        if value > distance[y,x]:
            continue
        area = areas[y,x]
        for dy, dx, length in directions:
            ny, nx = y+dy, x+dx
            if not (0 <= nx < w and 0 <= ny < h) or areas[ny,nx] != area:
                continue
            if dx and dy and (areas[y,nx] != area or areas[ny,x] != area):
                continue
            next_value = value + (float(cost[y,x])+float(cost[ny,nx])) * .5 * length
            if next_value < distance[ny,nx]:
                distance[ny,nx] = next_value
                heapq.heappush(queue, (next_value,ny,nx))
    return distance


def ranks(areas, distance):
    result = np.full(areas.shape, 65535, dtype=np.uint16)
    for area in range(1, 38):
        mask = areas == area
        values = distance[mask]
        # 起点のない離島は終盤まで未到達。経緯度上の架空起点は追加しない。
        order = np.argsort(values, kind='stable')
        quantiles = np.empty(len(values), dtype=np.float64)
        quantiles[order] = (np.arange(len(values))+1) / len(values)
        quantiles[~np.isfinite(values)] = 1
        result[mask] = np.clip(quantiles*65534, 1, 65534).astype(np.uint16)
    return result


def build():
    source = Image.open(TEXTURES / 'small-region-index.png').convert('L')
    height = round(source.height * WIDTH / source.width)
    areas = np.asarray(source.resize((WIDTH,height), Image.Resampling.NEAREST))
    points = json.loads((ROOT/'src/game/data/world.json').read_text(encoding='utf-8'))['points']
    groups = urban_centers(points, areas)
    cost = passage(areas, groups)
    adoption = ranks(areas, arrival(areas, groups, cost))
    dependency_cost = cost * (.5 + relief(areas.shape, 501) * 2)
    dependency = ranks(areas, arrival(areas, groups, dependency_cost, 'dependency'))
    # 依存は使用領域内。起点と進行経路は別に持ち、同じマスクの縮小版にしない。
    dependency = np.maximum(dependency, adoption)
    opposition_cost = cost * (.5 + relief(areas.shape, 907) * 2)
    opposition = ranks(areas, arrival(areas, groups, opposition_cost, 'opposition'))
    # RGBの左右アトラス。画像のアルファ前乗算で16bitの下位桁が失われるのを防ぐ。
    def encode(rank):
        return np.stack([rank >> 8, rank & 255, np.zeros_like(rank)], axis=-1).astype('uint8')
    used = encode(adoption)
    used[:, :, 2] = np.clip(opposition.astype('float64') / 65535 * 255, 1, 255).astype('uint8')
    pixels = np.concatenate([used, encode(dependency)], axis=1)
    Image.fromarray(pixels).save(TEXTURES/'invasion-rank.png', optimize=True)
    report = {'width': WIDTH, 'height': height, 'urbanCenters': groups[1:],
              'source': 'src/game/data/world.json / GHSL 2020 population sample',
              'channels': {'RG, left half': 'adoption uint16', 'RG, right half': 'dependency uint16', 'B, left half': 'antiAI uint8'},
              'interpretation': 'visual growth order, not population or measured transport routes'}
    (ROOT/'data/statistics/invasion-processing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'都市起点の前線テクスチャ: {WIDTH} x {height}, {sum(map(len,groups))} centers',flush=True)


if __name__ == '__main__':
    build()
