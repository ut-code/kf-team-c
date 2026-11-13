import { ORGANIZATION_LINKS, PERSONAL_LINKS } from '../../game/connections';
import { AREAS } from '../../game/data';
import { INSTITUTES } from '../../game/secrecy/data';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../geometry';
import citiesByArea from '../traffic-cities.json';
import type { PublishedResearch } from '../types';
import { type MapView, screenPoint, viewTransform } from '../view';
import { GLProgram } from './gl';

type City = (typeof citiesByArea)[number][number];

interface Ripple {
    id: string;
    city: City;
    closedMonth: number;
    maxRadius: number;
    startedAt: number;
}

const REACH_MONTHS = 12;
const RING_SEGMENTS = 64;
const RING_WIDTH = 1.6;
const RIPPLE_COLOR: [number, number, number] = [0.98, 0.471, 0.431]; // #fa786e

const vertex = `
attribute vec2 position, ribbon;
attribute float opacity;
attribute vec3 color;
uniform vec2 viewport;
varying vec2 local;
varying float alpha;
varying vec3 tint;
void main() {
    local = ribbon;
    alpha = opacity;
    tint = color;
    gl_Position = vec4(position / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
}`;

const fragment = `
precision mediump float;
varying vec2 local;
varying float alpha;
varying vec3 tint;
void main() {
    float stroke = 1. - smoothstep(.15, .85, abs(local.y));
    gl_FragColor = vec4(tint, stroke * alpha);
}`;

/**
 * 公表された研究の伝播(researchReach)を同心円の波紋で示す。
 * 公表された機関の地域から、直接接続のある地域の最遠点まで12か月かけて広がる。
 * 接続の薄い地域へはresearchReachの残り25%が240か月かけて届くため、波紋は12か月で引く。
 */
export class ResearchRipples {
    private program: GLProgram;
    private buffer: WebGLBuffer;
    private ripples: Ripple[] = [];

    constructor(private gl: WebGLRenderingContext) {
        this.program = new GLProgram(gl, vertex, fragment);
        this.buffer = gl.createBuffer()!;
    }

    /** 公表リストの差分から波紋を追加・削除する。リセット時は現在の公表から作り直す。 */
    sync(published: PublishedResearch[], month: number, reset: boolean, elapsed: number) {
        if (reset) this.ripples = [];
        this.ripples = this.ripples.filter(
            (ripple) =>
                published.some((item) => item.id === ripple.id) &&
                month - ripple.closedMonth <= REACH_MONTHS + 1,
        );
        for (const item of published) {
            if (this.ripples.some((ripple) => ripple.id === item.id)) continue;
            // 12か月を過ぎた公表には新しく波紋を作らない。
            if (month - item.closedMonth > REACH_MONTHS) continue;
            const ripple = this.spawn(item, elapsed);
            if (ripple) this.ripples.push(ripple);
        }
    }

    private spawn(item: PublishedResearch, elapsed: number): Ripple | null {
        const institute = INSTITUTES.find((entry) => entry.id === item.instituteId);
        if (!institute) return null;
        const area = AREAS.findIndex((entry) => entry.id === institute.areaId);
        if (area < 0 || citiesByArea[area].length === 0) return null;
        const city = citiesByArea[area].reduce((first, candidate) =>
            candidate.adoption < first.adoption ? candidate : first,
        );
        // 直接接続(researchReachの80%圏)のある地域の最遠点までを波紋の半径にする。
        let maxRadius = 0;
        for (let target = 0; target < AREAS.length; target++) {
            if (target === area) continue;
            const reach = Math.max(PERSONAL_LINKS[target][area], ORGANIZATION_LINKS[target][area]);
            if (reach <= 0) continue;
            for (const candidate of citiesByArea[target]) {
                const longitudeDelta = candidate.x - city.x;
                const dx = (longitudeDelta - Math.round(longitudeDelta)) * WORLD_WIDTH;
                const dy = (candidate.y - city.y) * WORLD_HEIGHT;
                maxRadius = Math.max(maxRadius, Math.hypot(dx, dy));
            }
        }
        if (maxRadius <= 0) return null;
        return {
            id: item.id,
            city,
            closedMonth: item.closedMonth,
            maxRadius,
            startedAt: elapsed,
        };
    }

    clear() {
        this.ripples = [];
    }

    draw(view: MapView, month: number, elapsed: number) {
        if (this.ripples.length === 0) return;
        const transform = viewTransform(view);
        const vertices: number[] = [];
        for (const ripple of this.ripples) {
            const age = month - ripple.closedMonth;
            if (age < 0) continue;
            const progress = Math.min(1, age / REACH_MONTHS);
            if (progress <= 0) continue;
            const fadeIn = Math.min(1, (elapsed - ripple.startedAt) / 0.5);
            const center = screenPoint(
                view,
                ripple.city.x * WORLD_WIDTH,
                ripple.city.y * WORLD_HEIGHT,
            );
            const radius = ripple.maxRadius * transform.scale * progress;
            // 先頭の波紋に、前の月の波紋を薄く重ねて進みを見せる。
            for (const [share, alpha] of [
                [1, 0.5],
                [0.62, 0.3],
                [0.32, 0.18],
            ] as const) {
                const ringRadius = radius * share;
                if (ringRadius < RING_WIDTH * 2) continue;
                this.pushRing(
                    vertices,
                    center.x,
                    center.y,
                    ringRadius,
                    alpha * fadeIn,
                    transform,
                    view,
                );
            }
        }
        if (vertices.length === 0) return;
        const gl = this.gl;
        this.program.use();
        gl.uniform2f(this.program.location('viewport'), view.width, view.height);
        const data = new Float32Array(vertices);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        for (const [name, size, offset] of [
            ['position', 2, 0],
            ['ribbon', 2, 8],
            ['opacity', 1, 16],
            ['color', 3, 20],
        ] as const) {
            const attribute = gl.getAttribLocation(this.program.program, name);
            gl.enableVertexAttribArray(attribute);
            gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 32, offset);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.SCISSOR_TEST);
        const ratio = gl.drawingBufferWidth / view.width;
        gl.scissor(
            Math.floor(transform.left * ratio),
            0,
            Math.floor(transform.width * ratio),
            gl.drawingBufferHeight,
        );
        gl.drawArrays(gl.TRIANGLES, 0, data.length / 8);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
    }

    private pushRing(
        vertices: number[],
        centerX: number,
        centerY: number,
        radius: number,
        opacity: number,
        transform: ReturnType<typeof viewTransform>,
        view: MapView,
    ) {
        for (const offset of [-transform.period, 0, transform.period]) {
            const x = centerX + offset;
            if (
                x + radius + RING_WIDTH < transform.left ||
                x - radius - RING_WIDTH > transform.left + transform.width ||
                centerY + radius + RING_WIDTH < 0 ||
                centerY - radius - RING_WIDTH > view.height
            )
                continue;
            for (let segment = 0; segment < RING_SEGMENTS; segment++) {
                for (const [step, side] of [
                    [0, -1],
                    [0, 1],
                    [1, -1],
                    [0, -1],
                    [1, -1],
                    [1, 1],
                ]) {
                    const t = (segment + step) / RING_SEGMENTS;
                    const angle = t * Math.PI * 2;
                    const dirX = Math.cos(angle);
                    const dirY = Math.sin(angle);
                    vertices.push(
                        x + dirX * (radius + side * RING_WIDTH),
                        centerY + dirY * (radius + side * RING_WIDTH),
                        0,
                        side,
                        opacity,
                        RIPPLE_COLOR[0],
                        RIPPLE_COLOR[1],
                        RIPPLE_COLOR[2],
                    );
                }
            }
        }
    }

    dispose() {
        this.program.dispose();
        this.gl.deleteBuffer(this.buffer);
    }
}
