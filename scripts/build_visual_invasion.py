"""保存済みの都市起点から侵食画像を再生成する。人口原本は読み直さない。
表示面積だけを扱い、ゲームの人口計算は変更しない。Python標準ライブラリーのみで動作する。
"""
import heapq
import json
import math
import struct
import zlib
from pathlib import Path
from invasion_connectivity import communication_links, wrapped_delta

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / 'public/maps/textures'


def read_png(path):
    data = path.read_bytes()
    offset, compressed = 8, bytearray()
    while offset < len(data):
        size = struct.unpack_from('>I', data, offset)[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + size]
        if kind == b'IHDR':
            width, height, depth, color, _, _, interlace = struct.unpack('>IIBBBBB', payload)
            assert depth == 8 and color in (0, 2, 6) and interlace == 0
        if kind == b'IDAT':
            compressed.extend(payload)
        offset += size + 12
    channels = {0: 1, 2: 3, 6: 4}[color]
    stride = width * channels
    raw = zlib.decompress(compressed)
    result, previous = bytearray(), bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        mode, row = raw[start], bytearray(raw[start + 1:start + 1 + stride])
        for x in range(stride):
            left = row[x - channels] if x >= channels else 0
            up = previous[x]
            corner = previous[x - channels] if x >= channels else 0
            prediction = left + up - corner
            distances = [abs(prediction - v) for v in (left, up, corner)]
            predictor = (left, up, corner)[distances.index(min(distances))]
            add = (0, left, up, (left + up) // 2, predictor)[mode]
            row[x] = (row[x] + add) & 255
        result.extend(row)
        previous = row
    return width, height, channels, result


def write_png(path, width, height, pixels):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    raw = b''.join(b'\0' + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def landscape_cost(areas, width, height, groups):
    """Broad connected urban corridors and coherent uneven passage, not real roads."""
    def noise(x, y, scale):
        gx, gy = x // scale, y // scale
        tx, ty = (x % scale) / scale, (y % scale) / scale
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        def value(a, b):
            n = ((a * 374761393 + b * 668265263 + 2030) ^ (a * 1274126177)) & 0xffffffff
            n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
            return (n ^ (n >> 16)) / 4294967295
        top = value(gx, gy) * (1 - tx) + value(gx + 1, gy) * tx
        bottom = value(gx, gy + 1) * (1 - tx) + value(gx + 1, gy + 1) * tx
        return top * (1 - ty) + bottom * ty

    corridor = [0.] * len(areas)
    for region, cities in enumerate(groups, 1):
        # Join nearby urban centers with wide bands, allowing fronts to merge.
        for order, city in enumerate(cities[1:], 1):
            parent = min(cities[:order], key=lambda c: wrapped_delta(c['x'] - city['x'], width) ** 2 + (c['y'] - city['y']) ** 2)
            ax, ay = parent['x'], parent['y']
            bx, by = ax + int(wrapped_delta(city['x'] - ax, width)), city['y']
            dx, dy = bx - ax, by - ay
            length = max(1, dx * dx + dy * dy)
            for y in range(max(0, min(ay, by) - 12), min(height, max(ay, by) + 13)):
                for unwrapped_x in range(min(ax, bx) - 12, max(ax, bx) + 13):
                    x = unwrapped_x % width
                    i = y * width + x
                    if areas[i] != region:
                        continue
                    t = max(0, min(1, ((unwrapped_x - ax) * dx + (y - ay) * dy) / length))
                    d2 = (unwrapped_x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2
                    corridor[i] = max(corridor[i], math.exp(-d2 / 50))
    cost = [1.] * len(areas)
    for i, area in enumerate(areas):
        if area:
            y, x = divmod(i, width)
            rough = .65 * noise(x, y, 11) + .35 * noise(x, y, 29)
            cost[i] = math.exp(4.5 * rough) / (1 + 14 * corridor[i])
    return cost


def build():
    report_path = ROOT / 'data/statistics/invasion-processing.json'
    report = json.loads(report_path.read_text())
    width, height = report['width'], report['height']
    sw, sh, channels, source = read_png(TEXTURES / 'small-region-index.png')
    areas = bytearray(source[(min(sh - 1, int((y + .5) * sh / height)) * sw + min(sw - 1, int((x + .5) * sw / width))) * channels] for y in range(height) for x in range(width))
    regions = [[i for i, area in enumerate(areas) if area == region] for region in range(1, 38)]
    connections = communication_links(areas, width, height, report['urbanCenters'])
    connected = {}
    for source, target, length in connections:
        connected.setdefault(source, []).append((target, length))
    print(f'離れた陸塊への通信接続: {len(connections)}件', flush=True)
    passage = landscape_cost(areas, width, height, report['urbanCenters'])
    fronts = []
    for kind in range(3):
        print(f'Generating visual front {kind + 1}/3', flush=True)
        distance = [math.inf] * len(areas)
        queue = []
        for region, cities in enumerate(report['urbanCenters'], 1):
            ordered = cities if kind == 0 else cities[kind::2] + cities[:kind] + cities[kind + 1::2]
            for order, city in enumerate(ordered):
                index = city['y'] * width + city['x']
                assert areas[index] == region
                # A few early hubs; later cities activate gradually or are reached by a corridor.
                delay = order * 8 if order < 3 else 45 + (order - 3) * 22
                if delay < distance[index]:
                    distance[index] = delay
                    heapq.heappush(queue, (delay, index))
        while queue:
            value, index = heapq.heappop(queue)
            if value != distance[index]:
                continue
            for target, length in connected.get(index, ()):
                candidate = value + length * (passage[index] + passage[target]) * .5
                if candidate < distance[target]:
                    distance[target] = candidate
                    heapq.heappush(queue, (candidate, target))
            y, x = divmod(index, width)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
                nx, ny = (x + dx) % width, y + dy
                if not 0 <= ny < height:
                    continue
                target = ny * width + nx
                if areas[target] != areas[index]:
                    continue
                if dx and dy and (areas[y * width + nx] != areas[index] or areas[ny * width + x] != areas[index]):
                    continue
                cost = (1.414 if dx and dy else 1) * (passage[index] + passage[target]) * .5
                cost *= 1 + .2 * math.sin(nx / 9 + kind * 2) * math.cos(ny / 13 + kind)
                candidate = value + cost
                if candidate < distance[target]:
                    distance[target] = candidate
                    heapq.heappush(queue, (candidate, target))
        rank = [65535] * len(areas)
        if any(area and not math.isfinite(distance[i]) for i, area in enumerate(areas)):
            raise ValueError('都市から到達できない陸地が残っています')
        for region, cells in enumerate(regions, 1):
            exponent = report['areaBudgetExponents'][str(region)]
            for order, index in enumerate(sorted(cells, key=lambda i: (distance[i], i)), 1):
                rank[index] = math.ceil((order / len(cells)) ** (1 / exponent) * 65535)
        if kind == 1:
            rank = [max(a, b) for a, b in zip(fronts[0], rank)]
        fronts.append(rank)
    pixels = bytearray(width * 3 * height * 3)
    for kind, rank in enumerate(fronts):
        for i, value in enumerate(rank):
            y, x = divmod(i, width)
            offset = (y * width * 3 + kind * width + x) * 3
            pixels[offset:offset + 2] = bytes((value >> 8, value & 255))
    pending = TEXTURES / 'invasion-rank.pending.png'
    write_png(pending, width * 3, height, pixels)
    pending.replace(TEXTURES / 'invasion-rank.png')
    report['visualCoverage'] = {'generator': 'scripts/build_visual_invasion.py', 'budget': 'land fraction with regional density exponent', 'cityDelay': 'first three: index * 8; later: 45 + (index - 3) * 22', 'population': 'used for cached city seeds only; not a coverage constraint', 'passage': 'coherent multiscale roughness and broad urban connection bands; not measured roads'}
    report['visualCoverage']['connectivity'] = {'horizontalWrap': True, 'communicationLinks': len(connections), 'unreachableLandCells': 0}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    # Reviewable Japan progression, and basic rank/containment checks.
    for k, rank in enumerate(fronts):
        assert all(1 <= rank[i] <= 65535 for cells in regions for i in cells)
    assert all(d >= a for a, d in zip(fronts[0], fronts[1]))
    japan = regions[28]
    stats = []
    for amount in (.01, .1, .3, .6, 1):
        covered = sum(fronts[0][i] <= amount * 65535 for i in japan) / len(japan)
        cities = sum(fronts[0][c['y'] * width + c['x']] / 65535 <= amount for c in report['urbanCenters'][28])
        stats.append({'use': amount, 'land': covered, 'cities': cities})
    assert stats[2]['cities'] >= 3 and stats[2]['land'] >= .25
    print(json.dumps(stats), flush=True)
    preview = bytearray()
    for y in range(375, 485):
        for amount in (.01, .1, .3, .6):
            for x in range(1740, 1850):
                i = y * width + x
                color = (45, 135, 190) if areas[i] == 29 and fronts[0][i] <= amount * 65535 else (50, 62, 58) if areas[i] else (10, 20, 30)
                preview.extend(color)
    out = ROOT / 'tmp/reports/japan-visual-growth.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    write_png(out, 440, 110, preview)
    preview = bytearray()
    for y in range(280, 530):
        for amount in (.1, .3, .6):
            for x in range(250, 650):
                i = y * width + x
                color = (45, 135, 190) if 1 <= areas[i] <= 4 and fronts[0][i] <= amount * 65535 else (50, 62, 58) if areas[i] else (10, 20, 30)
                preview.extend(color)
    write_png(ROOT / 'tmp/reports/north-america-visual-growth.png', 1200, 250, preview)


if __name__ == '__main__':
    build()
