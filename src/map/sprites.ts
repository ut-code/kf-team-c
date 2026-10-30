import { loadImage } from './gl';

export const facilityCategories = [
    'compute',
    'semiconductor',
    'energy',
    'communication',
    'finance',
    'government',
    'intelligence',
    'satellite',
    'industry',
] as const;
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

/** 施設画像の暗色輪郭を透過させ、円背景に色面だけを載せる。読み込み時に一度だけ処理する。 */
function facilityColorLayer(image: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
        const brightness = Math.max(
            pixels.data[index],
            pixels.data[index + 1],
            pixels.data[index + 2],
        );
        // 境界の混色部分もなだらかに抜き、縮小後の黒い縁を抑える。
        const opacity = Math.max(0, Math.min(1, (brightness - 50) / 70));
        pixels.data[index + 3] *= opacity;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
}

/** 画像は読み込み時に一枚へまとめ、描画中の画像切り替えやCanvas合成をなくす。 */
export async function loadAtlas(base: string): Promise<Atlas> {
    const names = [...facilityCategories, 'plane', 'ship', 'mail', 'map-pin'];
    const images = await Promise.all(
        names.map((name) =>
            loadImage(
                `${base}ui/${facilityCategories.includes(name as (typeof facilityCategories)[number]) ? 'facilities' : name === 'plane' || name === 'ship' ? 'traffic' : 'map'}/${name}.${name === 'plane' || name === 'ship' || name === 'mail' || name === 'map-pin' ? 'svg' : 'png'}`,
            ),
        ),
    );
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const sprites: Record<string, Sprite> = {};
    let slot = 0;
    const place = (
        name: string,
        width: number,
        height: number,
        draw: (x: number, y: number) => void,
    ) => {
        const x = (slot % 8) * 64 + 32,
            y = Math.floor(slot / 8) * 64 + 32;
        slot++;
        draw(x, y);
        sprites[name] = {
            u0: (x - width / 2) / 512,
            v0: (y - height / 2) / 256,
            u1: (x + width / 2) / 512,
            v1: (y + height / 2) / 256,
            width,
            height,
        };
    };
    names.forEach((name, index) => {
        const isFacility = facilityCategories.includes(name as (typeof facilityCategories)[number]);
        const width = name === 'ship' ? 7 : name === 'plane' ? 14 : isFacility ? 26 : 28;
        const height = name === 'ship' ? 20 : width;
        place(name, width, height, (x, y) => {
            if (name === 'mail' || name === 'map-pin') {
                context.fillStyle = '#282828';
                context.strokeStyle = '#56534f';
                context.lineWidth = 1;
                context.beginPath();
                context.roundRect(x - 14, y - 14, 28, 28, 3);
                context.fill();
                context.stroke();
                context.drawImage(images[index], x - 9, y - 9, 18, 18);
            } else if (isFacility) {
                // 小さな半透明の円へ施設記号を収め、地形を隠しすぎない。
                context.fillStyle = 'rgba(0, 0, 0, 0.65)';
                context.beginPath();
                context.arc(x, y, 13, 0, Math.PI * 2);
                context.fill();
                context.drawImage(facilityColorLayer(images[index]), x - 13, y - 13, 26, 26);
            } else context.drawImage(images[index], x - width / 2, y - height / 2, width, height);
        });
    });
    place('facility-outline', 30, 30, (x, y) => {
        context.strokeStyle = '#b7a17b';
        context.lineWidth = 1;
        context.beginPath();
        context.arc(x, y, 14, 0, Math.PI * 2);
        context.stroke();
    });
    place('outline', 44, 44, (x, y) => {
        context.strokeStyle = '#b7a17b';
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(x - 21, y - 21, 42, 42, 4);
        context.stroke();
    });
    for (const [name, color] of [
        ['neutral', '#929298'],
        ['active', '#b7a17b'],
        ['isolated', '#b97564'],
        ['unread', '#d68a45'],
        ['white', '#ffffff'],
    ]) {
        place(name, 8, 8, (x, y) => {
            context.fillStyle = color;
            context.strokeStyle = '#282828';
            context.lineWidth = 1;
            context.beginPath();
            context.arc(x, y, 3, 0, Math.PI * 2);
            context.fill();
            if (name !== 'white') context.stroke();
        });
    }
    place('trail', 22, 2, (x, y) => {
        context.fillStyle = 'white';
        context.fillRect(x - 11, y - 1, 22, 2);
    });
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
