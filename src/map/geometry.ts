export const WORLD_WIDTH = 8192;
export const NORTH_LATITUDE = 75;
export const SOUTH_LATITUDE = -60;
const northY = Math.log(Math.tan(Math.PI / 4 + (NORTH_LATITUDE * Math.PI) / 360));
const southY = Math.log(Math.tan(Math.PI / 4 + (SOUTH_LATITUDE * Math.PI) / 360));
export const WORLD_HEIGHT = Math.round((WORLD_WIDTH * (northY - southY)) / (2 * Math.PI));

export interface Point {
    x: number;
    y: number;
}
export interface Size {
    width: number;
    height: number;
}
export interface Camera {
    x: number;
}

/** 背景・国境・マーカーで共有するメルカトル。北緯75度〜南緯60度。 */
export function project(longitude: number, latitude: number): Point {
    const y = Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
    return {
        x: ((longitude + 180) / 360) * WORLD_WIDTH,
        y: ((northY - y) / (northY - southY)) * WORLD_HEIGHT,
    };
}

/** 表示する地図の高さに合わせて縮尺を決める。 */
export function fitScale(size: Size): number {
    return size.height / WORLD_HEIGHT;
}

/** 一周分を超えて表示しない。横長画面では描画領域を一周分へ制限する。 */
export function visibleWidth(size: Size): number {
    return Math.min(size.width, WORLD_WIDTH * fitScale(size));
}

/** 経度方向だけを循環する。描画は切断された二片を隣接させる。 */
export function constrainCamera(camera: Camera, size: Size): Camera {
    const width = WORLD_WIDTH * fitScale(size);
    if (width === 0) return { x: 0 };
    return { x: -(((-camera.x % width) + width) % width) };
}

export function centerCamera(size: Size): Camera {
    return constrainCamera({ x: (visibleWidth(size) - WORLD_WIDTH * fitScale(size)) / 2 }, size);
}

/** リサイズ時は表示中心の経度を維持する。 */
export function resizeCamera(camera: Camera, previous: Size, next: Size): Camera {
    if (previous.height === 0) return centerCamera(next);
    const ratio = fitScale(next) / fitScale(previous);
    return constrainCamera(
        { x: visibleWidth(next) / 2 - (visibleWidth(previous) / 2 - camera.x) * ratio },
        next,
    );
}
