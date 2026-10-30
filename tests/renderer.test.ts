import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { project, WORLD_HEIGHT } from '../src/map/geometry.ts';
import type { Country, MapMarker } from '../src/map/types.ts';
import {
    countryAtPoint,
    cullMarkers,
    type MapView,
    parseCountries,
    renderSize,
    screenPoint,
    viewTransform,
    worldPoint,
} from '../src/map/view.ts';
import { createWaveNoise } from '../src/map/waveNoise.ts';

const countries: Country[] = JSON.parse(
    readFileSync(new URL('../public/maps/comparison/countries.json', import.meta.url), 'utf8'),
);
const shapes = parseCountries(countries);
test('拡大・縦移動・日付変更線をまたぐ移動でも画面座標と地理座標が一致する', () => {
    for (const zoom of [1, 1.7, 3])
        for (const x of [-1200, -10, 0]) {
            const view: MapView = { width: 1280, height: 720, zoom, x, y: (720 * (1 - zoom)) / 2 };
            for (const lon of [-179, -20, 0, 140, 179])
                for (const lat of [-30, 0, 35, 60]) {
                    const source = project(lon, lat),
                        screen = screenPoint(view, source.x, source.y);
                    const t = viewTransform(view);
                    if (
                        screen.y < 0 ||
                        screen.y > view.height ||
                        screen.x < t.left ||
                        screen.x > t.left + t.width
                    )
                        continue;
                    const roundTrip = worldPoint(view, screen.x, screen.y)!;
                    assert.ok(Math.abs(roundTrip.x - source.x) < 1e-8);
                    assert.ok(Math.abs(roundTrip.y - source.y) < 1e-8);
                }
        }
});
test('3倍に拡大してもGPU描画面の画素数を増やさない', () => {
    const view: MapView = { width: 1920, height: 1080, zoom: 1, x: 0, y: 0 };
    assert.deepEqual(renderSize(view, 1.5), renderSize({ ...view, zoom: 3 }, 1.5));
    const pixels = renderSize({ ...view, zoom: 3 }, 2);
    assert.ok(pixels.width * pixels.height <= 4_147_200);
});
test('画面外の施設を除外し、日付変更線上の施設は端に表示する', () => {
    const marker: MapMarker = {
        id: 'facility',
        kind: 'facility',
        category: 'compute',
        longitude: 179.9,
        latitude: 0,
        label: '施設',
    };
    const items = [
        { marker, ...project(marker.longitude, marker.latitude) },
        { marker: { ...marker, id: 'outside' }, x: 100, y: WORLD_HEIGHT },
    ];
    const view: MapView = { width: 1280, height: 720, zoom: 3, x: -2000, y: -1200 };
    const visible = cullMarkers(items, view);
    assert.ok(visible.every((item) => item.marker.id !== 'outside'));
    const wrapped = cullMarkers([items[0]], { ...view, zoom: 1, x: -1350, y: 0 });
    assert.ok(wrapped.length > 0);
    assert.ok(wrapped.every((item) => item.x >= -24 && item.x <= 1304));
});
test('詳細な国境データから主要都市の国を選択できる', () => {
    for (const [id, lon, lat] of [
        ['JPN', 139.75, 35.68],
        ['USA', -77.04, 38.9],
        ['BRA', -47.88, -15.79],
        ['FRA', 2.35, 48.86],
        ['RUS', 37.62, 55.75],
        ['AUS', 149.13, -35.28],
    ] as const) {
        const point = project(lon, lat);
        assert.equal(countryAtPoint(shapes, point.x, point.y), id);
    }
    const sea = project(-30, 0);
    assert.equal(countryAtPoint(shapes, sea.x, sea.y), null);
});
test('国ポリゴンの穴を偶奇規則で除外する', () => {
    const geometry = parseCountries([
        { id: 'test', name: '検証', path: 'M0,0L10,0L10,10L0,10ZM3,3L7,3L7,7L3,7Z' },
    ]);
    assert.equal(countryAtPoint(geometry, 1, 1), 'test');
    assert.equal(countryAtPoint(geometry, 5, 5), null);
});

test('波の事前計算が全縮尺で周期境界を接続する', () => {
    const bytes = createWaveNoise();
    for (const [repeat, offset] of [
        [64, 0],
        [16, 64],
        [8, 80],
    ]) {
        const corner = (x: number, y: number, c: number) => bytes[(y * 128 + x + offset) * 4 + c];
        for (let y = 0; y < repeat; y++)
            for (let x = 0; x < repeat; x++) {
                assert.equal(corner(x, y, 1), corner((x + 1) % repeat, y, 0));
                assert.equal(corner(x, y, 2), corner(x, (y + 1) % repeat, 0));
                assert.equal(corner(x, y, 3), corner((x + 1) % repeat, (y + 1) % repeat, 0));
            }
    }
});
