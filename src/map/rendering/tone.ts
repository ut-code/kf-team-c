export interface Tone {
    values: Float32Array;
    hue: number;
    tint: Float32Array;
}
export interface MapTone {
    land: Tone;
    ocean: Tone;
    global: Tone;
    territory: Float32Array;
}

/** CSSの色表記の解釈だけに1画素のCanvasを使う。地図の描画には使用しない。 */
export class ColorReader {
    private context: CanvasRenderingContext2D;
    private cache = new Map<string, Float32Array>();
    constructor() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        this.context = canvas.getContext('2d', { willReadFrequently: true })!;
    }
    read(color: string) {
        const cached = this.cache.get(color);
        if (cached) return cached;
        this.context.clearRect(0, 0, 1, 1);
        this.context.fillStyle = color;
        this.context.fillRect(0, 0, 1, 1);
        const data = this.context.getImageData(0, 0, 1, 1).data;
        const value = new Float32Array([...data].map((v) => v / 255));
        this.cache.set(color, value);
        return value;
    }
}

export function readMapTone(element: HTMLElement, colors: ColorReader): MapTone {
    const style = getComputedStyle(element);
    const read = (prefix: string, tint: boolean): Tone => {
        const value = (key: string) => style.getPropertyValue(`--${prefix}-${key}`).trim();
        const rawHue = value('hue');
        const hue =
            Number.parseFloat(rawHue) *
            (rawHue.endsWith('rad') ? 1 : rawHue.endsWith('turn') ? 2 * Math.PI : Math.PI / 180);
        return {
            values: new Float32Array(
                ['brightness', 'contrast', 'saturation', 'sepia'].map((key) => Number(value(key))),
            ),
            hue,
            tint: tint ? colors.read(value('tint')) : new Float32Array(4),
        };
    };
    return {
        land: read('map-land', true),
        ocean: read('map-ocean', true),
        global: read('map', false),
        territory: colors.read(`rgb(${style.getPropertyValue('--color-territory-rgb')})`),
    };
}
