"""実在する空港間接続と公開海上交通網から、演出用の移動経路を作る。"""
import csv
import hashlib
import heapq
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/transport'


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [*a, *b])
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371*2*math.asin(math.sqrt(min(value, 1)))


def great_circle(a, b):
    def vector(point):
        lon, lat = map(math.radians, point)
        return [math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat)]
    av, bv = vector(a), vector(b)
    angle = math.acos(max(-1, min(1, sum(x*y for x, y in zip(av, bv)))))
    points = []
    for i in range(65):
        t = i/64
        weights = math.sin((1-t)*angle)/math.sin(angle), math.sin(t*angle)/math.sin(angle)
        x, y, z = [weights[0]*u+weights[1]*v for u, v in zip(av, bv)]
        points.append([round(math.degrees(math.atan2(y, x)), 5), round(math.degrees(math.atan2(z, math.hypot(x, y))), 5)])
    return points


def sea_network():
    graph = {}
    data = json.loads((DATA / 'raw/marnet.geojson').read_text(encoding='utf-8'))
    for feature in data['features']:
        if feature['properties'].get('passage') in {'northwest', 'bering'}:
            continue
        geometry = feature['geometry']
        lines = geometry['coordinates'] if geometry['type'] == 'MultiLineString' else [geometry['coordinates']]
        for line in lines:
            points = [tuple([round((p[0]+180) % 360-180, 6), round(p[1], 6)]) for p in line]
            for a, b in zip(points, points[1:]):
                if a == b or max(a[1], b[1]) > 70 or min(a[1], b[1]) < -59:
                    continue
                length = distance(a, b)
                graph.setdefault(a, {})[b] = length
                graph.setdefault(b, {})[a] = length
    return graph


def sea_route(graph, origin, destination):
    start = min(graph, key=lambda node: distance(node, origin))
    end = min(graph, key=lambda node: distance(node, destination))
    pending = [(0, start)]
    lengths = {start: 0}
    previous = {}
    while pending:
        length, node = heapq.heappop(pending)
        if node == end:
            break
        if length > lengths[node]:
            continue
        for neighbor, cost in graph[node].items():
            candidate = length+cost
            if candidate < lengths.get(neighbor, math.inf):
                lengths[neighbor] = candidate
                previous[neighbor] = node
                heapq.heappush(pending, (candidate, neighbor))
    assert end in previous, (origin, destination)
    path = [end]
    while path[-1] != start:
        path.append(previous[path[-1]])
    return list(reversed(path)), lengths[end]


def main():
    selection = json.loads((DATA / 'selection.json').read_text(encoding='utf-8'))
    with (DATA / 'raw/airports.dat').open(encoding='utf-8') as file:
        airports = {row[4]: {'name': row[1], 'coordinates': [float(row[7]), float(row[6])]} for row in csv.reader(file)}
    with (DATA / 'raw/routes.dat').open(encoding='utf-8') as file:
        connections = {(row[2], row[4]) for row in csv.reader(file) if row[7] == '0'}
    routes = []
    for origin, destination in selection['flights']:
        assert (origin, destination) in connections or (destination, origin) in connections, (origin, destination)
        a, b = airports[origin], airports[destination]
        length = distance(a['coordinates'], b['coordinates'])
        routes.append({'id': f'air-{origin}-{destination}', 'kind': 'plane', 'name': f'{origin} — {destination}', 'points': great_circle(a['coordinates'], b['coordinates']), 'distanceKm': round(length), 'duration': round(45+length/110), 'source': 'openflights', 'originCountry': selection['airportCountries'][origin], 'destinationCountry': selection['airportCountries'][destination]})
    graph = sea_network()
    for origin, destination in selection['shipping']:
        a, b = selection['ports'][origin], selection['ports'][destination]
        path, length = sea_route(graph, a['coordinates'], b['coordinates'])
        routes.append({'id': f'sea-{origin}-{destination}', 'kind': 'ship', 'name': f"{a['name']} — {b['name']}", 'points': path, 'distanceKm': round(length), 'duration': round(150+length/70), 'source': 'marnet', 'originCountry': a['country'], 'destinationCountry': b['country']})
    for i, route in enumerate(routes):
        # 出発時刻をずらし、初期画面でも世界各地に往来が見えるようにする。
        route['phase'] = round(((i*.61803398875) % 1)*.8+.1, 5)
    output = ROOT / 'src/game/data/transport-routes.json'
    output.write_text(json.dumps(routes, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    sources = [DATA/'selection.json', *sorted((DATA/'raw').glob('*'))]
    report = {'air': len(selection['flights']), 'sea': len(selection['shipping']), 'inputs': [{'file': p.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sources], 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest()}
    (DATA / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"航空路{report['air']} / 海上経路{report['sea']}")


if __name__ == '__main__':
    main()
