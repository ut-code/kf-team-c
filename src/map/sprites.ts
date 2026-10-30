import { STAGE_COLORS } from '../game/data';

/** 人口点の描画サイズはズームによらずCSSピクセルで固定する。 */
export const POPULATION_SPRITE_SIZE = 5.5;

export interface Sprite {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
    width: number;
    height: number;
}
export interface Atlas {
    canvas: HTMLCanvasElement;
    sprites: Record<string, Sprite>;
}

/** 人口点を一枚のアトラスにまとめ、既存のWebGLスプライトで一括描画する。 */
export async function loadAtlas(): Promise<Atlas> {
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    const sprites: Record<string, Sprite> = {};
    [...STAGE_COLORS, '#ffffff'].forEach((color, i) => {
        const x = i * 32 + 16;
        context.beginPath();
        context.arc(x, 16, i === STAGE_COLORS.length ? 12 : 10, 0, Math.PI * 2);
        if (i === STAGE_COLORS.length) {
            context.strokeStyle = color;
            context.lineWidth = 2;
            context.stroke();
        } else {
            context.fillStyle = color;
            context.fill();
        }
        sprites[i === STAGE_COLORS.length ? 'ring' : `stage-${i}`] = {
            u0: i / 7,
            v0: 0,
            u1: (i + 1) / 7,
            v1: 1,
            width: 8,
            height: 8,
        };
    });
    context.fillStyle = '#d8c4ff';
    context.strokeStyle = '#261b3d';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(196, 4, 24, 19, 5);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(202, 22);
    context.lineTo(201, 29);
    context.lineTo(210, 22);
    context.fill();
    context.fillStyle = '#352550';
    for (const x of [202, 208, 214]) {
        context.beginPath();
        context.arc(x, 13, 1.5, 0, Math.PI * 2);
        context.fill();
    }
    sprites.conversation = { u0: 6 / 7, v0: 0, u1: 1, v1: 1, width: 34, height: 34 };
    return { canvas, sprites };
}

/** 画面内のスプライトを一つの頂点列へまとめる。 */
const white = [1, 1, 1] as const;
const triangleCorners = [0, 1, 2, 2, 1, 3] as const;
export class SpriteBatch {
    private vertices = new Float32Array(256 * 6 * 9);
    length = 0;
    reset() {
        this.length = 0;
    }
    add(
        sprite: Sprite,
        x: number,
        y: number,
        angle = 0,
        opacity = 1,
        ship = false,
        color: ArrayLike<number> = white,
        width = sprite.width,
        height = sprite.height,
    ) {
        if (this.length + 54 > this.vertices.length) {
            const larger = new Float32Array(this.vertices.length * 2);
            larger.set(this.vertices);
            this.vertices = larger;
        }
        const c = Math.cos(angle),
            s = Math.sin(angle);
        for (const corner of triangleCorners) {
            const a = (corner & 1 ? 0.5 : -0.5) * width,
                b = (corner & 2 ? 0.5 : -0.5) * height,
                i = this.length;
            this.vertices[i] = x + a * c - b * s;
            this.vertices[i + 1] = y + a * s + b * c;
            this.vertices[i + 2] = corner & 1 ? sprite.u1 : sprite.u0;
            this.vertices[i + 3] = corner & 2 ? sprite.v1 : sprite.v0;
            this.vertices[i + 4] = color[0];
            this.vertices[i + 5] = color[1];
            this.vertices[i + 6] = color[2];
            this.vertices[i + 7] = opacity;
            this.vertices[i + 8] = ship ? 1 : 0;
            this.length += 9;
        }
    }
    get data() {
        return this.vertices.subarray(0, this.length);
    }
}
