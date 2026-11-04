import { AREAS } from '../../game/data';
import type { AreaState } from '../../game/types';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../geometry';
import citiesByArea from '../traffic-cities.json';
import { type MapView, screenPoint, viewTransform } from '../view';
import { GLProgram } from './gl';

type City = (typeof citiesByArea)[number][number];
interface Route {
    source: City;
    target: City;
    targetArea: number;
    dx: number;
    dy: number;
    bend: number;
}

interface Transmission {
    route: Route;
    startedAt: number;
}

interface ExpansionCandidate {
    route: Route;
    startedAt: number;
    impact: number;
}

const ARRIVAL_SECONDS = 0.15;
// 4倍速・30fpsでも、到着から侵食までに複数フレームを確保する。
const INVASION_LEAD_SECONDS = 0.3;
const MAX_TRANSMISSIONS = 2;
// 地域人口の単位は百万人。増加人数10万人以上の到達だけを候補にする。
const MIN_IMPACT_POPULATION = 0.1;
const HOLD_SECONDS = 3;
const FADE_SECONDS = 1;
const MARKER_RADIUS = 2;

// 大陸間通信の拠点。地域内の短距離接続は作らない。
const HUB_REGIONS = [
    { id: 'us-west', continent: '北米' },
    { id: 'us-east', continent: '北米' },
    { id: 'brazil', continent: '南米' },
    { id: 'southern-cone', continent: '南米' },
    { id: 'west-europe', continent: '欧州' },
    { id: 'north-europe', continent: '欧州' },
    { id: 'west-africa', continent: 'アフリカ' },
    { id: 'south-africa', continent: 'アフリカ' },
    { id: 'india-north', continent: 'アジア' },
    { id: 'china-coast', continent: 'アジア' },
    { id: 'japan', continent: 'アジア' },
    { id: 'malay', continent: 'アジア' },
    { id: 'australia', continent: 'オセアニア' },
];

const vertex = `
attribute vec2 position, ribbon;
attribute float opacity, marker;
uniform vec2 viewport;
varying vec2 local;
varying float alpha;
varying float isMarker;
void main() {
    local = ribbon;
    alpha = opacity;
    isMarker = marker;
    gl_Position = vec4(position / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
}`;

const fragment = `
precision mediump float;
varying vec2 local;
varying float alpha;
varying float isMarker;
void main() {
    if (isMarker > .5) {
        float radius = length(local);
        float dot = 1. - smoothstep(.65, 1., radius);
        gl_FragColor = vec4(.48, .74, .79, dot * .45 * alpha);
        return;
    }
    float stroke = 1. - smoothstep(.25, .8, abs(local.y));
    float revealed = 1. - smoothstep(0., .015, local.x);
    gl_FragColor = vec4(.48, .74, .79, stroke * revealed * .3 * alpha);
}`;

/** 大陸を隔てた都市の通信。画面上の太さはズームしても一定に保つ。 */
export class ChatTraffic {
    private program: GLProgram;
    private buffer: WebGLBuffer;
    private routes: Route[] = [];
    private serverArea: number | null = null;
    private transmissions: Transmission[] = [];

    constructor(private gl: WebGLRenderingContext) {
        this.program = new GLProgram(gl, vertex, fragment);
        this.buffer = gl.createBuffer()!;
    }

    private connectServer(origin: number) {
        this.serverArea = origin;
        const home = HUB_REGIONS.find((hub) => hub.id === AREAS[origin].id)!;
        const source = citiesByArea[origin].reduce((first, candidate) =>
            candidate.adoption < first.adoption ? candidate : first,
        );
        this.routes = [];
        for (const { id, continent } of HUB_REGIONS) {
            if (continent === home.continent) continue;
            const area = AREAS.findIndex((definition) => definition.id === id);
            for (const target of citiesByArea[area]) {
                // 近接する大陸の境界ではなく、世界地図を横断する距離を選ぶ。
                if (this.distance(source, target) < 0.08 ** 2) continue;
                // 経路は地図座標で確定し、ズームや画面サイズから独立させる。
                const longitudeDelta = target.x - source.x;
                const dx = (longitudeDelta - Math.round(longitudeDelta)) * WORLD_WIDTH;
                const dy = (target.y - source.y) * WORLD_HEIGHT;
                const horizontalRatio = Math.abs(dx) / Math.hypot(dx, dy);
                const bend = Math.min(Math.abs(dx) * 0.22, WORLD_WIDTH * 0.1) * horizontalRatio;
                this.routes.push({ source, target, targetArea: area, dx, dy, bend });
            }
        }
    }

    private distance(a: City, b: City) {
        const dx = Math.min(Math.abs(a.x - b.x), 1 - Math.abs(a.x - b.x));
        return dx * dx + (((a.y - b.y) * WORLD_HEIGHT) / WORLD_WIDTH) ** 2;
    }

    private appendMarker(vertices: number[], x: number, y: number, opacity: number) {
        for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [-1, 1],
            [1, -1],
            [1, 1],
        ]) {
            vertices.push(x + sx * MARKER_RADIUS, y + sy * MARKER_RADIUS, sx, sy, opacity, 1);
        }
    }

    update(origin: number, reset: boolean) {
        if (this.serverArea !== origin || reset) {
            this.connectServer(origin);
            this.transmissions = [];
        }
    }

    /** 都市の到達順から月の途中の到達時刻を求め、影響人口が大きい通信を選ぶ。 */
    beginExpansion(previous: AreaState[], next: AreaState[], elapsed: number, duration: number) {
        const lifetime = ARRIVAL_SECONDS + HOLD_SECONDS + FADE_SECONDS;
        // 進行中の線は残し、更新で置き換わった未発信の予定は破棄する。
        this.transmissions = this.transmissions.filter(
            (item) => item.startedAt <= elapsed && elapsed - item.startedAt < lifetime,
        );
        const candidates: ExpansionCandidate[] = [];
        for (const route of this.routes) {
            const area = route.targetArea;
            const before = previous[area];
            const after = next[area];
            if (after.antiAI >= route.target.opposition) continue;
            for (const kind of ['adoption', 'dependency'] as const) {
                const from =
                    kind === 'adoption' ? before.autonomous + before.dependent : before.dependent;
                const to =
                    kind === 'adoption' ? after.autonomous + after.dependent : after.dependent;
                const rank = route.target[kind];
                const increase = to - from;
                const impact = increase * AREAS[area].population;
                if (impact < MIN_IMPACT_POPULATION || rank <= from || rank > to) continue;
                if (
                    kind === 'dependency' &&
                    route.target.adoption > after.autonomous + after.dependent
                )
                    continue;
                const invasionProgress = (rank - from) / increase;
                const invasionOffset = invasionProgress * duration;
                // 侵食の補間は変えず、通信の到着を都市の侵食より先行させる。
                const arrivalOffset = invasionOffset - INVASION_LEAD_SECONDS;
                if (arrivalOffset <= ARRIVAL_SECONDS) continue;
                candidates.push({
                    route,
                    startedAt: elapsed + arrivalOffset - ARRIVAL_SECONDS,
                    impact,
                });
            }
        }
        candidates.sort((a, b) => b.impact - a.impact || a.startedAt - b.startedAt);
        const selectedAreas = new Set<number>();
        for (const candidate of candidates) {
            if (selectedAreas.size >= MAX_TRANSMISSIONS) break;
            if (selectedAreas.has(candidate.route.targetArea)) continue;
            const end = candidate.startedAt + lifetime;
            const overlaps = this.transmissions.filter(
                (item) => item.startedAt < end && item.startedAt + lifetime > candidate.startedAt,
            );
            if (overlaps.some((item) => item.route.targetArea === candidate.route.targetArea))
                continue;
            // 保持中の線も含め、月をまたいでも同時に二本までに抑える。
            const times = [
                candidate.startedAt,
                ...overlaps
                    .map((item) => item.startedAt)
                    .filter((time) => time >= candidate.startedAt),
            ];
            if (
                times.some(
                    (time) =>
                        overlaps.filter(
                            (item) => item.startedAt <= time && item.startedAt + lifetime > time,
                        ).length >= MAX_TRANSMISSIONS,
                )
            )
                continue;
            this.transmissions.push({ route: candidate.route, startedAt: candidate.startedAt });
            selectedAreas.add(candidate.route.targetArea);
        }
    }

    draw(view: MapView, elapsed: number) {
        const lifetime = ARRIVAL_SECONDS + HOLD_SECONDS + FADE_SECONDS;
        this.transmissions = this.transmissions.filter(
            (item) => elapsed - item.startedAt < lifetime,
        );
        if (this.transmissions.length === 0) return;
        const transform = viewTransform(view);
        const vertices: number[] = [];
        // 到達イベントからの経過時間は、線の表示とフェードだけに使う。
        const fadeStart = ARRIVAL_SECONDS + HOLD_SECONDS;
        const fadeEnd = fadeStart + FADE_SECONDS;
        for (const { route, startedAt } of this.transmissions) {
            const age = elapsed - startedAt;
            if (age < 0) continue;
            const travel = Math.min(age / ARRIVAL_SECONDS, 1);
            const opacity = Math.min(1, age / 0.03, (fadeEnd - age) / FADE_SECONDS);
            const from = screenPoint(
                view,
                route.source.x * WORLD_WIDTH,
                route.source.y * WORLD_HEIGHT,
            );
            const dx = route.dx * transform.scale;
            const dy = route.dy * transform.scale;
            const bend = route.bend * transform.scale;
            for (const offset of [-transform.period, 0, transform.period]) {
                const startX = from.x + offset;
                const endX = startX + dx;
                if (
                    Math.max(startX, endX) + bend < transform.left ||
                    Math.min(startX, endX) - bend > transform.left + transform.width ||
                    Math.max(from.y, from.y + dy) + bend < 0 ||
                    Math.min(from.y, from.y + dy) - bend > view.height
                )
                    continue;
                for (let segment = 0; segment < 64; segment++) {
                    for (const [step, side] of [
                        [0, -1],
                        [0, 1],
                        [1, -1],
                        [1, -1],
                        [0, 1],
                        [1, 1],
                    ]) {
                        const t = (segment + step) / 64;
                        const arc = 4 * t * (1 - t) * bend;
                        const tangentX = dx;
                        const tangentY = dy - 4 * (1 - 2 * t) * bend;
                        const tangentLength = Math.hypot(tangentX, tangentY);
                        vertices.push(
                            startX + dx * t - (tangentY / tangentLength) * side,
                            from.y + dy * t - arc + (tangentX / tangentLength) * side,
                            t - travel,
                            side,
                            opacity,
                            0,
                        );
                    }
                }
                this.appendMarker(vertices, startX, from.y, opacity);
                if (travel === 1) {
                    this.appendMarker(vertices, endX, from.y + dy, opacity);
                }
            }
        }
        if (vertices.length === 0) return;
        const gl = this.gl;
        this.program.use();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        for (const [name, size, offset] of [
            ['position', 2, 0],
            ['ribbon', 2, 8],
            ['opacity', 1, 16],
            ['marker', 1, 20],
        ] as const) {
            const attribute = gl.getAttribLocation(this.program.program, name);
            gl.enableVertexAttribArray(attribute);
            gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 24, offset);
        }
        gl.uniform2f(this.program.location('viewport'), view.width, view.height);
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
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
    }

    dispose() {
        this.program.dispose();
        this.gl.deleteBuffer(this.buffer);
    }
}
