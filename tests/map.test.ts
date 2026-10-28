import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import transport from '../src/game/data/transport-routes.json' with { type: 'json' };
import {
    centerCamera,
    constrainCamera,
    fitScale,
    project,
    resizeCamera,
    visibleWidth,
    WORLD_HEIGHT,
    WORLD_WIDTH,
} from '../src/map/geometry.ts';
import { compileRoute, TRAFFIC_ROUTES, trafficPosition } from '../src/map/traffic.ts';

test('交通の経路は日付変更線を短く渡り、全ルートを有限の位置で移動する', () => {
    const crossing = compileRoute({
        ...transport[0],
        phase: 0,
        points: [
            [170, 0],
            [-170, 0],
        ],
    });
    assert.ok(Math.abs(crossing.length - (WORLD_WIDTH * 20) / 360) < 1e-6);
    const middle = trafficPosition(crossing, crossing.duration / 2)!;
    assert.ok(middle.x < 1e-6 || Math.abs(middle.x - WORLD_WIDTH) < 1e-6);
    assert.equal(trafficPosition(crossing, crossing.duration * 1.1), null);
    assert.equal(TRAFFIC_ROUTES.filter((route) => route.kind === 'plane').length, 32);
    assert.equal(TRAFFIC_ROUTES.filter((route) => route.kind === 'ship').length, 12);
    for (const route of TRAFFIC_ROUTES) {
        assert.ok(route.length > 0 && route.points.length > 1, route.id);
        for (let seconds = 0; seconds < route.duration * 3; seconds += 13) {
            const point = trafficPosition(route, seconds);
            if (!point) continue;
            assert.ok(
                Number.isFinite(point.x) &&
                    Number.isFinite(point.y) &&
                    Number.isFinite(point.heading),
                route.id,
            );
            assert.ok(point.x >= 0 && point.x < WORLD_WIDTH, route.id);
            assert.ok(point.y >= 0 && point.y <= WORLD_HEIGHT, route.id);
        }
    }
});

test('非対称のメルカトル範囲と背景寸法が一致する', () => {
    assert.deepEqual(project(-180, 75), { x: 0, y: 0 });
    assert.ok(Math.abs(project(180, -60).y - WORLD_HEIGHT) < 1e-9);
    const manifest = JSON.parse(
        readFileSync(new URL('../data/manifest.json', import.meta.url), 'utf8'),
    );
    assert.equal(manifest.width, WORLD_WIDTH);
    assert.equal(manifest.height, WORLD_HEIGHT);
    assert.deepEqual(manifest.extent, [-180, -60, 180, 75]);
    assert.equal(manifest.projection, 'EPSG:3857');
    // 南側だけを切ったため、赤道は中央より下にある。
    assert.ok(project(0, 0).y > WORLD_HEIGHT / 2);
});

test('横移動は一周で循環し、表示幅は世界一周分を超えない', () => {
    const size = { width: 900, height: 900 };
    const period = WORLD_WIDTH * fitScale(size);
    assert.equal(fitScale(size), 900 / WORLD_HEIGHT);
    const camera = constrainCamera({ x: -period - 100 }, size);
    assert.ok(Math.abs(camera.x + 100) < 1e-9);
    assert.ok(Math.abs(constrainCamera({ x: 100 }, size).x - (100 - period)) < 1e-9);
    const wide = { width: 2400, height: 600 };
    assert.equal(visibleWidth(wide), WORLD_WIDTH * fitScale(wide));
    // 各画面上の地点に対応する経度が一意。一周の両端は同じ画素に含めない。
    for (const screen of [size, wide]) {
        const width = WORLD_WIDTH * fitScale(screen);
        const seen = new Set<number>();
        for (let x = 0; x < Math.floor(visibleWidth(screen)); x++) {
            const source = (((x + 321) % width) + width) % width;
            const key = Math.round(source * 1e6);
            assert.ok(!seen.has(key));
            seen.add(key);
        }
    }
    assert.ok(centerCamera(size).x <= 0);
});

test('リサイズ後も表示中心の経度を維持する', () => {
    const previous = { width: 800, height: 600 };
    const next = { width: 900, height: 800 };
    const camera = { x: -200 };
    const resized = resizeCamera(camera, previous, next);
    assert.ok(
        Math.abs(
            (previous.width / 2 - camera.x) / fitScale(previous) -
                (next.width / 2 - resized.x) / fitScale(next),
        ) < 1e-9,
    );
});

test('国境のIDは重複せず、日付変更線に世界を横断する線がない', () => {
    const raw = JSON.parse(
        readFileSync(
            new URL('../data/map-studies/raw/ne_110m_admin_0_countries.geojson', import.meta.url),
            'utf8',
        ),
    );
    const countries = JSON.parse(
        readFileSync(new URL('../public/maps/countries.json', import.meta.url), 'utf8'),
    );
    assert.equal(countries.length, 176);
    assert.equal(
        new Set(countries.map((country: { id: string }) => country.id)).size,
        countries.length,
    );
    assert.ok(!countries.some((country: { id: string }) => country.id === 'ATA'));
    const japan = countries.find((country: { id: string }) => country.id === 'JPN');
    const firstRing = raw.features.find(
        (feature: { properties: { ADM0_A3: string } }) => feature.properties.ADM0_A3 === 'JPN',
    ).geometry.coordinates[0][0];
    const firstPoint = project(firstRing[0][0], firstRing[0][1]);
    assert.ok(japan.path.startsWith(`M${firstPoint.x.toFixed(3)},${firstPoint.y.toFixed(3)}`));
    for (const country of countries) {
        const coordinates = [...country.path.matchAll(/(?:M|L)([-\d.]+),([-\d.]+)/g)];
        for (const point of coordinates) {
            assert.ok(Number(point[1]) >= 0 && Number(point[1]) <= WORLD_WIDTH);
            assert.ok(Number(point[2]) >= 0 && Number(point[2]) <= WORLD_HEIGHT);
        }
    }
    for (const feature of raw.features) {
        if (!countries.some((country: { id: string }) => country.id === feature.properties.ADM0_A3))
            continue;
        const polygons =
            feature.geometry.type === 'Polygon'
                ? [feature.geometry.coordinates]
                : feature.geometry.coordinates;
        for (const polygon of polygons)
            for (const ring of polygon) {
                for (let index = 1; index < ring.length; index++) {
                    assert.ok(
                        Math.abs(ring[index][0] - ring[index - 1][0]) <= 180,
                        feature.properties.ADM0_A3,
                    );
                }
            }
    }
});

test('施設は重なったときに集約し、拡大すると分離する', async () => {
    const { layoutMarkers } = await import('../src/map/markerLayout.ts');
    const markers = [
        { id: 'a', kind: 'facility' as const, longitude: 0, latitude: 0, label: 'A' },
        { id: 'b', kind: 'facility' as const, longitude: 5, latitude: 0, label: 'B' },
    ];
    const grouped = layoutMarkers(markers, 0.2);
    assert.equal(grouped.length, 1);
    assert.deepEqual(
        grouped[0].members.map((m) => m.id),
        ['a', 'b'],
    );
    assert.equal(layoutMarkers(markers, 0.4).length, 2);
    assert.equal(markers[0].longitude, 0);
    const seam = markers.map((m, i) => ({ ...m, longitude: i ? -179 : 179 }));
    assert.equal(layoutMarkers(seam, 0.2).length, 1);
    const mail = { ...markers[0], id: 'mail', kind: 'person' as const };
    assert.equal(layoutMarkers([...markers, mail], 0.2).length, 2);
});
