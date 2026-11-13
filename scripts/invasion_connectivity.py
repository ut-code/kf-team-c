"""侵食描画用の陸地接続。日付変更線をつなぎ、飛び地には同地域の都市から通信で届く。"""

import math
from array import array
from collections import deque


def wrapped_delta(delta, width):
    """世界地図の左右端を同じ場所として、短い方の変位を返す。"""
    return (delta + width / 2) % width - width / 2


def communication_links(areas, width, height, city_groups):
    """都市のない陸塊を、同地域の最寄り都市と結ぶ。海上や他地域のセルは塗らない。"""
    if len(areas) != width * height:
        raise ValueError('地域画像の寸法が一致しません')
    visited = bytearray(len(areas))
    urban_cells = set()
    for area, cities in enumerate(city_groups, 1):
        for city in cities:
            index = city['y'] * width + city['x']
            if areas[index] != area:
                raise ValueError(f'地域{area}の都市起点が陸地の外にあります')
            urban_cells.add(index)

    links = []
    for start, area in enumerate(areas):
        if not area or visited[start]:
            continue
        queue = deque([start])
        visited[start] = 1
        cells = array('I')
        has_city = False
        while queue:
            index = queue.popleft()
            cells.append(index)
            has_city |= index in urban_cells
            y, x = divmod(index, width)
            neighbors = [y * width + (x - 1) % width, y * width + (x + 1) % width]
            if y:
                neighbors.append(index - width)
            if y + 1 < height:
                neighbors.append(index + width)
            for target in neighbors:
                if not visited[target] and areas[target] == area:
                    visited[target] = 1
                    queue.append(target)
        if has_city:
            continue
        cities = city_groups[area - 1]
        if not cities:
            raise ValueError(f'地域{area}に都市起点がありません')
        # 陸塊の入口は都市との距離で決める。ランダムな起点や未到達セルの塗りつぶしは使わない。
        best = None
        for target in cells:
            y, x = divmod(target, width)
            for city in cities:
                dx = wrapped_delta(x - city['x'], width)
                squared = dx * dx + (y - city['y']) ** 2
                source = city['y'] * width + city['x']
                candidate = (squared, source, target)
                if best is None or candidate < best:
                    best = candidate
        squared, source, target = best
        links.append((source, target, math.sqrt(squared)))
    return links
