import { ORGANIZATION_CORRIDORS, PERSONAL_CORRIDORS } from '../../content/connections';
import { AREAS } from '../../game/data';
import type { AreaState } from '../../game/types';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../geometry';
import citiesByArea from '../traffic-cities.json';
import { type MapView, screenPoint, viewTransform } from '../view';
import { GLProgram } from './gl';

type City = (typeof citiesByArea)[number][number];

interface CorridorRoute {
    source: City;
    target: City;
    sourceArea: number;
    targetArea: number;
    dx: number;
    dy: number;
    bend: number;
    dashed: boolean;
    color: [number, number, number];
}

interface Flow {
    route: CorridorRoute;
    startedAt: number;
    life: number;
    impact: number;
    width: number;
    dashed: boolean;
    color: [number, number, number];
}

const BASE_SEGMENTS = 24;
const FLOW_SEGMENTS = 32;
// 地域人口の単位は百万人。月あたりの増減がこの人数を超えた経路だけを流す。
const MIN_FLOW_POPULATION = 0.05;
const MIN_OPPOSITION_POPULATION = 0.1;
const MAX_FLOWS = 5;
const MAX_OPPOSITION = 4;
const FLOW_FADE_SECONDS = 1.2;
const BASE_ORG_ALPHA = 0.16;
const BASE_PERSONAL_ALPHA = 0.12;
const FLOW_ALPHA = 0.6;
const DASH_SCREEN_LENGTH = 12;
const LINE_COLOR: [number, number, number] = [0.941, 0.78, 0.369]; // 組織経路 #f0c75e
const PERSONAL_COLOR: [number, number, number] = [0.333, 0.737, 0.902]; // 人の経路 #55bce6
const OPPOSITION_COLOR: [number, number, number] = [0.894, 0.71, 0.396]; // 反AI #e4b565

const vertex = `
attribute vec2 position, ribbon;
attribute float opacity, dash, dashCount, flow, marker;
attribute vec3 color;
uniform vec2 viewport;
uniform float dashPhase;
varying vec2 local;
varying float alpha, dashFlag, dashes, flowFlag, isMarker;
varying vec3 tint;
void main() {
    local = ribbon;
    alpha = opacity;
    tint = color;
    dashFlag = dash;
    dashes = dashCount;
    flowFlag = flow;
    isMarker = marker;
    gl_Position = vec4(position / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
}`;

const fragment = `
precision mediump float;
varying vec2 local;
varying float alpha, dashFlag, dashes, flowFlag, isMarker;
varying vec3 tint;
uniform float dashPhase;
void main() {
    if (isMarker > .5) {
        float radius = length(local);
        float dot = 1. - smoothstep(.55, 1., radius);
        gl_FragColor = vec4(tint, dot * alpha);
        return;
    }
    float pattern = 1.;
    if (dashFlag > .5) pattern = step(.5, fract(local.x * dashes - dashPhase * flowFlag));
    float stroke = 1. - smoothstep(.25, .8, abs(local.y));
    gl_FragColor = vec4(tint, stroke * pattern * alpha);
}`;

/**
 * エンジンの交流経路(connections.ts)を地図に重ねる。
 * 組織経路=重み1.4の金の実線、人の経路=重み1の水色の点線を常時薄く敷き、
 * 月次で利用者が増えた起点から流れる線を上書きする。反AIが広がった月は
 * 人の経路に沿って黄土色の線を逆方向に出す。
 */
export class NetworkLines {
    private program: GLProgram;
    private baseBuffer: WebGLBuffer;
    private flowBuffer: WebGLBuffer;
    private corridors: CorridorRoute[] = [];
    private partners: boolean[][];
    private flows: Flow[] = [];
    private baseVertices: Float32Array | null = null;
    private baseKey = '';
    private reducedMotion = false;

    constructor(private gl: WebGLRenderingContext) {
        this.program = new GLProgram(gl, vertex, fragment);
        this.baseBuffer = gl.createBuffer()!;
        this.flowBuffer = gl.createBuffer()!;
        this.partners = AREAS.map(() => AREAS.map(() => false));
        for (const [from, to] of PERSONAL_CORRIDORS) {
            const a = AREAS.findIndex((area) => area.id === from);
            const b = AREAS.findIndex((area) => area.id === to);
            if (a < 0 || b < 0) continue;
            this.partners[a][b] = true;
            this.partners[b][a] = true;
            this.pushCorridor(a, b, true, PERSONAL_COLOR);
        }
        for (const [from, to] of ORGANIZATION_CORRIDORS) {
            const a = AREAS.findIndex((area) => area.id === from);
            const b = AREAS.findIndex((area) => area.id === to);
            if (a < 0 || b < 0) continue;
            this.pushCorridor(a, b, false, LINE_COLOR);
        }
    }

    /** 経路の両端は、その地域でAIが最初に届く都市(到達順が最も早い都市)に固定する。 */
    private representativeCity(area: number) {
        return citiesByArea[area].reduce((first, candidate) =>
            candidate.adoption < first.adoption ? candidate : first,
        );
    }

    private pushCorridor(
        fromArea: number,
        toArea: number,
        dashed: boolean,
        color: [number, number, number],
    ) {
        const source = this.representativeCity(fromArea);
        const target = this.representativeCity(toArea);
        const longitudeDelta = target.x - source.x;
        const dx = (longitudeDelta - Math.round(longitudeDelta)) * WORLD_WIDTH;
        const dy = (target.y - source.y) * WORLD_HEIGHT;
        const horizontalRatio = Math.abs(dx) / Math.hypot(dx, dy);
        const bend = Math.min(Math.abs(dx) * 0.22, WORLD_WIDTH * 0.1) * horizontalRatio;
        this.corridors.push({
            source,
            target,
            sourceArea: fromArea,
            targetArea: toArea,
            dx,
            dy,
            bend,
            dashed,
            color,
        });
    }

    clear() {
        this.flows = [];
    }

    /**
     * 月次の地域差分から、この月に流れた量を線として登録する。
     * durationは侵食の補間時間(秒)で、線はその間表示してからフェードする。
     */
    begin(previous: AreaState[], next: AreaState[], elapsed: number, duration: number) {
        const life = duration + FLOW_FADE_SECONDS;
        this.flows = this.flows.filter(
            (item) => elapsed - item.startedAt < item.life && elapsed >= item.startedAt,
        );
        const candidates: Flow[] = [];
        for (const corridor of this.corridors) {
            // 経路の両方向とも、利用者が増えた起点から相手へ流す。
            for (const [fromArea, , swap] of [
                [corridor.sourceArea, corridor.targetArea, false],
                [corridor.targetArea, corridor.sourceArea, true],
            ] as const) {
                const before = previous[fromArea];
                const after = next[fromArea];
                const increase =
                    after.autonomous + after.dependent - (before.autonomous + before.dependent);
                const impact = increase * AREAS[fromArea].population;
                if (impact < MIN_FLOW_POPULATION) continue;
                candidates.push({
                    route: swap ? this.reverse(corridor) : corridor,
                    startedAt: elapsed,
                    life,
                    impact,
                    width: 1 + Math.min(2.2, Math.log1p(impact) * 0.55),
                    dashed: corridor.dashed,
                    color: corridor.color,
                });
            }
        }
        // 反AIの波及(nearbyOpposition)。拒否が増えた地域へ、人の経路でつながった
        // 近隣のうち最も拒否の強い地域から線を引く。地域内の短距離は線が多すぎるため省く。
        for (let target = 0; target < AREAS.length; target++) {
            const increase = next[target].antiAI - previous[target].antiAI;
            const impact = increase * AREAS[target].population;
            if (impact < MIN_OPPOSITION_POPULATION) continue;
            let source = -1;
            let strongest = previous[target].antiAI;
            for (let neighbor = 0; neighbor < AREAS.length; neighbor++) {
                if (!this.partners[target][neighbor]) continue;
                if (previous[neighbor].antiAI > strongest) {
                    strongest = previous[neighbor].antiAI;
                    source = neighbor;
                }
            }
            if (source < 0) continue;
            const corridor = this.corridors.find(
                (item) =>
                    (item.sourceArea === source && item.targetArea === target) ||
                    (item.sourceArea === target && item.targetArea === source),
            );
            if (!corridor) continue;
            candidates.push({
                route: corridor.sourceArea === source ? corridor : this.reverse(corridor),
                startedAt: elapsed,
                life: Math.max(duration, 2) + FLOW_FADE_SECONDS,
                impact,
                width: 1 + Math.min(2, Math.log1p(impact) * 0.6),
                dashed: true,
                color: OPPOSITION_COLOR,
            });
        }
        candidates.sort((a, b) => b.impact - a.impact);
        for (const candidate of candidates) {
            if (this.flows.length >= MAX_FLOWS + MAX_OPPOSITION) break;
            this.flows.push(candidate);
        }
    }

    private reverse(corridor: CorridorRoute): CorridorRoute {
        const longitudeDelta = corridor.source.x - corridor.target.x;
        const dx = (longitudeDelta - Math.round(longitudeDelta)) * WORLD_WIDTH;
        const dy = (corridor.source.y - corridor.target.y) * WORLD_HEIGHT;
        const horizontalRatio = Math.abs(dx) / Math.hypot(dx, dy);
        return {
            ...corridor,
            source: corridor.target,
            target: corridor.source,
            sourceArea: corridor.targetArea,
            targetArea: corridor.sourceArea,
            dx,
            dy,
            bend: Math.min(Math.abs(dx) * 0.22, WORLD_WIDTH * 0.1) * horizontalRatio,
        };
    }

    draw(view: MapView, elapsed: number) {
        this.reducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const gl = this.gl;
        this.program.use();
        gl.uniform2f(this.program.location('viewport'), view.width, view.height);
        gl.uniform1f(this.program.location('dashPhase'), this.reducedMotion ? 0 : elapsed * 1.5);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.SCISSOR_TEST);
        const transform = viewTransform(view);
        const ratio = gl.drawingBufferWidth / view.width;
        gl.scissor(
            Math.floor(transform.left * ratio),
            0,
            Math.floor(transform.width * ratio),
            gl.drawingBufferHeight,
        );
        // 常時表示の経路はカメラが動いたときだけ作り直す。
        const key = `${view.width}|${view.height}|${view.zoom}|${view.x}|${view.y}`;
        if (key !== this.baseKey || !this.baseVertices) {
            this.baseKey = key;
            this.rebuildBase(view);
        }
        this.upload(this.baseBuffer, this.baseVertices!);
        gl.drawArrays(gl.TRIANGLES, 0, this.baseVertices!.length / 12);
        // 月次の流れは毎フレーム作り直す。
        this.flows = this.flows.filter((item) => elapsed - item.startedAt < item.life);
        if (this.flows.length > 0) {
            const vertices = this.buildFlows(view, elapsed);
            const data = new Float32Array(vertices);
            this.upload(this.flowBuffer, data);
            gl.drawArrays(gl.TRIANGLES, 0, data.length / 12);
        }
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
    }

    private rebuildBase(view: MapView) {
        const transform = viewTransform(view);
        const vertices: number[] = [];
        for (const corridor of this.corridors) {
            const from = screenPoint(
                view,
                corridor.source.x * WORLD_WIDTH,
                corridor.source.y * WORLD_HEIGHT,
            );
            const dx = corridor.dx * transform.scale;
            const dy = corridor.dy * transform.scale;
            const bend = corridor.bend * transform.scale;
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
                const dashCount = Math.hypot(dx, dy) / DASH_SCREEN_LENGTH;
                if (corridor.dashed) {
                    this.pushRibbon(
                        vertices,
                        startX,
                        from.y,
                        dx,
                        dy,
                        bend,
                        0.9,
                        BASE_PERSONAL_ALPHA,
                        corridor.color,
                        true,
                        dashCount,
                        0,
                        BASE_SEGMENTS,
                    );
                } else {
                    this.pushRibbon(
                        vertices,
                        startX,
                        from.y,
                        dx,
                        dy,
                        bend,
                        1.1,
                        BASE_ORG_ALPHA,
                        corridor.color,
                        false,
                        0,
                        0,
                        BASE_SEGMENTS,
                    );
                }
            }
        }
        this.baseVertices = new Float32Array(vertices);
    }

    private buildFlows(view: MapView, elapsed: number) {
        const transform = viewTransform(view);
        const vertices: number[] = [];
        for (const flow of this.flows) {
            const age = elapsed - flow.startedAt;
            if (age < 0) continue;
            const opacity = Math.min(
                FLOW_ALPHA,
                (age / 0.1) * FLOW_ALPHA,
                ((flow.startedAt + flow.life - elapsed) / FLOW_FADE_SECONDS) * FLOW_ALPHA,
            );
            if (opacity <= 0) continue;
            const from = screenPoint(
                view,
                flow.route.source.x * WORLD_WIDTH,
                flow.route.source.y * WORLD_HEIGHT,
            );
            const dx = flow.route.dx * transform.scale;
            const dy = flow.route.dy * transform.scale;
            const bend = flow.route.bend * transform.scale;
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
                const dashCount = Math.hypot(dx, dy) / DASH_SCREEN_LENGTH;
                if (flow.dashed) {
                    this.pushRibbon(
                        vertices,
                        startX,
                        from.y,
                        dx,
                        dy,
                        bend,
                        flow.width,
                        opacity,
                        flow.color,
                        true,
                        dashCount,
                        1,
                        FLOW_SEGMENTS,
                    );
                } else {
                    for (const [ribbonWidth, ribbonOpacity] of [
                        [flow.width * 3, opacity * 0.3],
                        [flow.width, opacity],
                    ] as const) {
                        this.pushRibbon(
                            vertices,
                            startX,
                            from.y,
                            dx,
                            dy,
                            bend,
                            ribbonWidth,
                            ribbonOpacity,
                            flow.color,
                            false,
                            0,
                            1,
                            FLOW_SEGMENTS,
                        );
                    }
                }
                this.appendMarker(vertices, endX, from.y + dy, opacity * 0.8, flow.color);
            }
        }
        return vertices;
    }

    private pushRibbon(
        vertices: number[],
        startX: number,
        startY: number,
        dx: number,
        dy: number,
        bend: number,
        width: number,
        opacity: number,
        color: [number, number, number],
        dashed: boolean,
        dashCount: number,
        flowFlag: number,
        segments: number,
    ) {
        for (let segment = 0; segment < segments; segment++) {
            for (const [step, side] of [
                [0, -1],
                [0, 1],
                [1, -1],
                [0, -1],
                [1, -1],
                [1, 1],
            ]) {
                const t = (segment + step) / segments;
                const arc = 4 * t * (1 - t) * bend;
                const tangentX = dx;
                const tangentY = dy - 4 * (1 - 2 * t) * bend;
                const tangentLength = Math.hypot(tangentX, tangentY) || 1;
                vertices.push(
                    startX + dx * t - (tangentY / tangentLength) * side * width,
                    startY + dy * t - arc + (tangentX / tangentLength) * side * width,
                    t,
                    side,
                    opacity,
                    color[0],
                    color[1],
                    color[2],
                    dashed ? 1 : 0,
                    dashCount,
                    flowFlag,
                    0,
                );
            }
        }
    }

    private appendMarker(
        vertices: number[],
        x: number,
        y: number,
        opacity: number,
        color: [number, number, number],
        radius = 2.4,
    ) {
        for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [-1, 1],
            [1, -1],
            [1, 1],
        ]) {
            vertices.push(
                x + sx * radius,
                y + sy * radius,
                sx,
                sy,
                opacity,
                color[0],
                color[1],
                color[2],
                0,
                0,
                0,
                1,
            );
        }
    }

    private upload(buffer: WebGLBuffer, data: Float32Array) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        for (const [name, size, offset] of [
            ['position', 2, 0],
            ['ribbon', 2, 8],
            ['opacity', 1, 16],
            ['color', 3, 20],
            ['dash', 1, 32],
            ['dashCount', 1, 36],
            ['flow', 1, 40],
            ['marker', 1, 44],
        ] as const) {
            const attribute = gl.getAttribLocation(this.program.program, name);
            gl.enableVertexAttribArray(attribute);
            gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 48, offset);
        }
    }

    dispose() {
        this.program.dispose();
        this.gl.deleteBuffer(this.baseBuffer);
        this.gl.deleteBuffer(this.flowBuffer);
    }
}
