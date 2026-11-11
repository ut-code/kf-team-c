import { AREAS, MONTH_MS } from '../../game/data';
import type { AreaState } from '../../game/types';
import type { MapRegion } from '../types';
import {
    type MapView,
    parseRegions,
    type RegionShape,
    regionAtPoint,
    renderSize,
    viewTransform,
    worldPoint,
} from '../view';
import { createTexture, GLProgram, loadImage, quadVertex } from './gl';
import oceanSettings from './ocean-surface.json';
import { fragmentShader as waveFragment, vertexShader as waveVertex } from './shaders/ocean';
import { compositeFragment, staticFragment } from './shaders/world';
import { ColorReader, type MapTone, readMapTone } from './tone';

export interface MapScene {
    regions: MapRegion[];
    backgroundUrl: string;
    waterMaskUrl: string;
    surfaceMaskUrl: string;
    countryIndexUrl: string;
    areaIndexUrl: string;
    invasionUrl: string;
}
export interface MapData {
    regions: MapRegion[];
    areaStates: AreaState[];
    serverArea: number;
    selectedArea: number | null;
    speed: number;
    tick: number;
}
export interface MapTarget {
    kind: 'area';
    area: number;
    id: string;
    label: string;
}
interface TargetBuffer {
    texture: WebGLTexture;
    framebuffer: WebGLFramebuffer;
    width: number;
    height: number;
}

// 1倍速で毎秒最大1.5ポイント。月次の変化には追従し、大きな急変を抑える。
// 拡大・後退に共通の上限とし、描画時にゲーム速度の倍率を掛ける。
const MAX_INVASION_CHANGE_PER_SECOND = 0.015;

/** 画面サイズ固定の単一WebGL描画。静的地図はキャッシュし、動く画像だけを一括描画する。 */
export class WorldRenderer {
    private gl: WebGLRenderingContext;
    private programs: {
        base: GLProgram;
        wave: GLProgram;
        composite: GLProgram;
    };
    private quad: WebGLBuffer;
    private textures: Record<
        'photo' | 'water' | 'surface' | 'countries' | 'areas' | 'palette' | 'invasion',
        WebGLTexture
    >;
    private invasionSize = new Float32Array(2);
    private boundaryTexelSize = new Float32Array(2);
    private baseTarget: TargetBuffer;
    private waveTarget: TargetBuffer;
    private colors = new ColorReader();
    private tone: MapTone;
    private shapes: RegionShape[] = [];
    private shapeCache = new WeakMap<MapRegion[], RegionShape[]>();
    private data: MapData | null = null;
    private view: MapView = { width: 0, height: 0, zoom: 1, x: 0, y: 0 };
    private targetsKey = '';
    private hover: MapTarget | null = null;
    private requested = '';
    private loaded = '';
    private resourceUrls = {
        photo: '',
        water: '',
        surface: '',
        countries: '',
        areas: '',
        invasion: '',
    };
    private shown: AreaState[] = [];
    private transitionFrom: AreaState[] = [];
    private transitionProgress = 1;
    private transitionDuration = MONTH_MS / 1000;
    private transitionDistance = 0;
    private transitionInGameTime = true;
    private sequence = 0;
    private alive = true;
    private ready = false;
    private dirty = true;
    private staticDirty = true;
    private waveDirty = true;
    private styleDirty = true;
    private paletteDirty = true;
    private targetsDirty = true;
    private viewDirty = true;
    private frame = 0;
    private previous = 0;
    private rendered = 0;
    private waveElapsed = 0;
    private observer: MutationObserver;
    private reported = 0;
    readonly stats = {
        frames: 0,
        staticPasses: 0,
        wavePasses: 0,
        textureUploads: 0,
        geometryCompiles: 0,
        pixelWidth: 0,
        pixelHeight: 0,
        cpuMs: 0,
        maxCpuMs: 0,
        lastCpuMs: 0,
        cpuTotalMs: 0,
    };

    constructor(
        private canvas: HTMLCanvasElement,
        private callbacks: {
            ready: () => void;
            error: (error: unknown) => void;
            targets: (targets: MapTarget[]) => void;
            presented: (view: MapView) => void;
        },
    ) {
        const gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            preserveDrawingBuffer: false,
            depth: false,
            stencil: false,
        });
        if (!gl) throw new Error('世界地図の描画にはWebGLが必要です。');
        this.gl = gl;
        this.programs = {
            base: new GLProgram(gl, quadVertex, staticFragment),
            wave: new GLProgram(gl, waveVertex, waveFragment),
            composite: new GLProgram(gl, quadVertex, compositeFragment),
        };
        this.quad = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW,
        );
        this.textures = {
            photo: createTexture(gl),
            water: createTexture(gl),
            surface: createTexture(gl),
            countries: createTexture(gl, true),
            areas: createTexture(gl, true),
            palette: createTexture(gl, true),
            // 16bitの上位・下位バイトは線形結合で復号するため、補間後も到達順を保つ。
            invasion: createTexture(gl),
        };
        this.baseTarget = this.createTarget();
        this.waveTarget = this.createTarget();
        this.tone = readMapTone(canvas, this.colors);
        this.observer = new MutationObserver(() => {
            this.styleDirty = true;
            this.invalidate(true);
        });
        this.observer.observe(document.head, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['href'],
        });
        this.observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
        });
        document.addEventListener('visibilitychange', this.visibilityChanged);
        canvas.addEventListener('webglcontextlost', this.contextLost);
    }

    private visibilityChanged = () => {
        this.previous = performance.now();
        if (document.hidden) {
            cancelAnimationFrame(this.frame);
            this.frame = 0;
        } else this.invalidate(true);
    };
    private contextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.callbacks.error(
            new Error('地図の描画用GPU接続が失われました。再読み込みしてください。'),
        );
    };

    private createTarget(): TargetBuffer {
        const gl = this.gl;
        return {
            texture: createTexture(gl),
            framebuffer: gl.createFramebuffer()!,
            width: 0,
            height: 0,
        };
    }
    private resizeTarget(target: TargetBuffer, width: number, height: number) {
        if (target.width === width && target.height === height) return;
        const gl = this.gl;
        target.width = width;
        target.height = height;
        gl.bindTexture(gl.TEXTURE_2D, target.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            target.texture,
            0,
        );
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error('地図の描画領域を確保できませんでした。');
        this.staticDirty = true;
        this.waveDirty = true;
    }

    private upload(texture: WebGLTexture, image: TexImageSource, format: number = this.gl.RGBA) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, image);
        this.stats.textureUploads++;
    }
    private bind(program: GLProgram, name: string, texture: WebGLTexture, unit: number) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.location(name), unit);
    }
    private quadDraw(program: GLProgram) {
        const gl = this.gl;
        program.use();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        const attribute = gl.getAttribLocation(program.program, 'position');
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    }
    private camera(program: GLProgram) {
        const gl = this.gl,
            v = this.view,
            t = viewTransform(v);
        gl.uniform2f(program.location('viewport'), v.width, v.height);
        gl.uniform4f(program.location('camera'), v.x, v.y, t.left, 0);
        gl.uniform1f(program.location('period'), t.period);
        gl.uniform1f(program.location('displayWidth'), t.width);
        gl.uniform1f(program.location('worldHeight'), t.height);
        gl.uniform1f(program.location('cameraX'), v.x);
        gl.uniform1f(program.location('cameraY'), v.y);
        gl.uniform1f(program.location('leftEdge'), t.left);
    }

    setScene(scene: MapScene) {
        const key = [
            scene.backgroundUrl,
            scene.waterMaskUrl,
            scene.surfaceMaskUrl,
            scene.countryIndexUrl,
            scene.areaIndexUrl,
            scene.invasionUrl,
        ].join('\n');
        if (this.requested === key) return;
        this.requested = key;
        this.ready = false;
        const sequence = ++this.sequence;
        const started = performance.now();
        const urls = {
            photo: scene.backgroundUrl,
            water: scene.waterMaskUrl,
            surface: scene.surfaceMaskUrl,
            countries: scene.countryIndexUrl,
            areas: scene.areaIndexUrl,
            invasion: scene.invasionUrl,
        };
        const image = (name: keyof typeof urls) =>
            this.resourceUrls[name] === urls[name] ? Promise.resolve(null) : loadImage(urls[name]);
        Promise.all([
            image('photo'),
            image('water'),
            image('surface'),
            image('countries'),
            image('areas'),
            image('invasion'),
        ])
            .then(([photo, water, surface, countries, areas, invasion]) => {
                if (!this.alive || sequence !== this.sequence) return;
                let shapes = this.shapeCache.get(scene.regions);
                if (!shapes) {
                    shapes = parseRegions(scene.regions);
                    this.shapeCache.set(scene.regions, shapes);
                    this.stats.geometryCompiles++;
                }
                this.shapes = shapes;
                for (const [name, source] of [
                    ['photo', photo],
                    ['water', water],
                    ['surface', surface],
                    ['countries', countries],
                    ['areas', areas],
                    ['invasion', invasion],
                ] as const) {
                    if (source) {
                        const maximum = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
                        if (source.width > maximum || source.height > maximum)
                            throw new Error(
                                `地図画像のサイズがGPUの上限（${maximum}px）を超えています。`,
                            );
                        if (name === 'invasion') {
                            this.invasionSize[0] = source.width / 3;
                            this.invasionSize[1] = source.height;
                        }
                        if (name === 'areas') {
                            this.boundaryTexelSize[0] = 1 / source.width;
                            this.boundaryTexelSize[1] = 1 / source.height;
                        }
                        this.upload(
                            this.textures[name],
                            source,
                            name === 'surface' || name === 'countries' || name === 'areas'
                                ? this.gl.LUMINANCE
                                : this.gl.RGBA,
                        );
                        this.resourceUrls[name] = urls[name];
                    }
                }

                this.loaded = key;
                this.paletteDirty = true;
                this.waveDirty = true;
                this.targetsDirty = true;
                this.canvas.dataset.sceneLoadMs = (performance.now() - started).toFixed(1);
                this.invalidate(true);
            })
            .catch((error) => {
                if (this.alive && sequence === this.sequence) this.callbacks.error(error);
            });
    }

    setData(data: MapData) {
        const old = this.data;
        if (!old || old.selectedArea !== data.selectedArea) this.staticDirty = true;
        const reset = !old || data.tick < old.tick;
        if (reset) {
            this.shown = data.areaStates.map((area) => ({ ...area }));
            this.transitionProgress = 1;
        } else if (old.areaStates !== data.areaStates) {
            this.transitionFrom = this.shown.map((area) => ({ ...area }));
            this.transitionProgress = 0;
            this.transitionInGameTime = data.tick > old.tick;
            this.transitionDistance = Math.max(
                ...data.areaStates.map((target, index) => {
                    const from = this.transitionFrom[index];
                    return Math.max(
                        Math.abs(target.autonomous - from.autonomous),
                        Math.abs(target.dependent - from.dependent),
                        Math.abs(target.antiAI - from.antiAI),
                        Math.abs(
                            target.autonomous + target.dependent - from.autonomous - from.dependent,
                        ),
                    );
                }),
            );
            // 月次更新は次の月まで等速でつなぎ、操作による大きな増減も急変させない。
            this.transitionDuration = this.transitionInGameTime ? MONTH_MS / 1000 : 2;
        }
        if (reset || old.areaStates !== data.areaStates) this.paletteDirty = true;
        if (old && data.tick < old.tick) {
            this.waveElapsed = 0;
        }
        if (old && old.speed !== data.speed) this.previous = performance.now();
        this.data = data;
        this.invalidate();
    }

    setView(view: MapView) {
        if (
            Object.keys(view).every(
                (key) => view[key as keyof MapView] === this.view[key as keyof MapView],
            )
        )
            return;
        this.view = { ...view };
        this.viewDirty = true;
        this.waveDirty = true;
        this.targetsDirty = true;
        this.invalidate(true);
    }
    setHover(target: MapTarget | null) {
        if (this.hover?.id === target?.id && this.hover?.kind === target?.kind) return;
        const areaChanged = this.hover?.area !== target?.area;
        this.hover = target;
        this.invalidate(areaChanged);
    }
    private invalidate(staticPart = false) {
        this.dirty = true;
        this.staticDirty ||= staticPart;
        if (this.alive && !this.frame && !document.hidden)
            this.frame = requestAnimationFrame(this.draw);
    }

    private updateTargets() {
        const targets = AREAS.map(
            (area, index): MapTarget => ({
                kind: 'area',
                id: String(index),
                area: index,
                label: area.name,
            }),
        );
        const key = targets.map((target) => target.id).join('|');
        if (key !== this.targetsKey) {
            this.targetsKey = key;
            this.callbacks.targets(targets);
        }
        this.targetsDirty = false;
    }

    hitTest(x: number, y: number): MapTarget | null {
        if (!this.ready) return null;
        const point = worldPoint(this.view, x, y);
        if (!point) return null;
        const id = regionAtPoint(this.shapes, point.x, point.y);
        return id ? { kind: 'area', id, area: Number(id), label: AREAS[Number(id)].name } : null;
    }

    private updatePalette() {
        const bytes = new Uint8Array(256 * 4 * 2);
        this.shown.forEach((area, index) => {
            const offset = (index + 1) * 4;
            const adoption = Math.floor((area.autonomous + area.dependent) * 65535);
            const dependency = Math.floor(area.dependent * 65535);
            bytes[offset] = adoption >> 8;
            bytes[offset + 1] = adoption & 255;
            bytes[offset + 2] = dependency >> 8;
            bytes[offset + 3] = dependency & 255;
            const antiAI = Math.floor(area.antiAI * 65535);
            bytes[1024 + offset] = antiAI >> 8;
            bytes[1024 + offset + 1] = antiAI & 255;
        });
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textures.palette);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        this.paletteDirty = false;
        this.staticDirty = true;
    }

    private selection(program: GLProgram) {
        this.gl.uniform1f(
            program.location('selected'),
            this.data!.selectedArea === null ? -1 : this.data!.selectedArea + 1,
        );
        this.gl.uniform1f(program.location('hovered'), this.hover ? this.hover.area + 1 : -1);
    }

    private drawStatic() {
        const gl = this.gl,
            p = this.programs.base;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseTarget.framebuffer);
        gl.viewport(0, 0, this.baseTarget.width, this.baseTarget.height);
        gl.disable(gl.BLEND);
        this.quadDraw(p);
        this.camera(p);
        this.bind(p, 'photo', this.textures.photo, 0);
        this.bind(p, 'water', this.textures.water, 1);
        this.bind(p, 'countryIds', this.textures.countries, 2);
        this.bind(p, 'palette', this.textures.palette, 3);
        this.bind(p, 'areaIds', this.textures.areas, 4);
        this.bind(p, 'invasion', this.textures.invasion, 5);
        gl.uniform2fv(p.location('invasionSize'), this.invasionSize);
        gl.uniform1f(p.location('dataMode'), 0);
        this.selection(p);
        for (const name of ['land', 'ocean', 'global'] as const) {
            gl.uniform4fv(p.location(`${name}Tone`), this.tone[name].values);
            if (name !== 'global') gl.uniform4fv(p.location(`${name}Tint`), this.tone[name].tint);
        }
        gl.uniform3f(
            p.location('hues'),
            this.tone.land.hue,
            this.tone.ocean.hue,
            this.tone.global.hue,
        );
        gl.uniform4fv(p.location('territory'), this.tone.territory);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.stats.staticPasses++;
        this.staticDirty = false;
    }

    private drawWaves() {
        const gl = this.gl,
            p = this.programs.wave;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.waveTarget.framebuffer);
        gl.viewport(0, 0, this.waveTarget.width, this.waveTarget.height);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.quadDraw(p);
        this.camera(p);
        this.bind(p, 'seaMask', this.textures.surface, 0);
        gl.uniform2f(p.location('rasterSize'), this.waveTarget.width, this.waveTarget.height);
        gl.uniform1f(p.location('time'), this.waveElapsed);
        gl.uniform1f(p.location('strength'), oceanSettings.strength);
        gl.uniform1f(p.location('tintStrength'), oceanSettings.tintStrength);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.stats.wavePasses++;
    }

    private draw = (now: number) => {
        this.frame = 0;
        if (
            !this.alive ||
            document.hidden ||
            !this.data ||
            this.loaded !== this.requested ||
            this.view.width === 0 ||
            this.view.height === 0
        )
            return;
        const dt = this.previous ? Math.max(0, (now - this.previous) / 1000) : 0;
        this.previous = now;
        this.waveElapsed += dt * this.data.speed * oceanSettings.timeScale;
        const transitionSpeed = this.data.speed;
        const transitioning = this.transitionProgress < 1 && transitionSpeed > 0;
        if (transitioning) {
            const progressPerSecond =
                transitionSpeed *
                Math.min(
                    1 / this.transitionDuration,
                    this.transitionDistance > 0
                        ? MAX_INVASION_CHANGE_PER_SECOND / this.transitionDistance
                        : Infinity,
                );
            this.transitionProgress = Math.min(
                1,
                // タブ復帰や描画停止後も、経過時間を一括反映して飛ばさない。
                this.transitionProgress + Math.min(dt, 0.05) * progressPerSecond,
            );
            this.shown.forEach((area, index) => {
                const from = this.transitionFrom[index];
                const target = this.data!.areaStates[index];
                for (const key of ['autonomous', 'dependent', 'antiAI'] as const) {
                    area[key] = from[key] + (target[key] - from[key]) * this.transitionProgress;
                }
            });
            this.paletteDirty = true;
        }
        const animated = this.data.speed > 0 || transitioning;
        if (!this.dirty && now - this.rendered < 1000 / oceanSettings.framesPerSecond) {
            if (animated) this.frame = requestAnimationFrame(this.draw);
            return;
        }
        const started = performance.now(),
            gl = this.gl;
        if (this.styleDirty) {
            this.tone = readMapTone(this.canvas, this.colors);
            this.styleDirty = false;
            this.staticDirty = true;
        }
        const pixels = renderSize(this.view, window.devicePixelRatio);
        if (this.canvas.width !== pixels.width || this.canvas.height !== pixels.height) {
            this.canvas.width = pixels.width;
            this.canvas.height = pixels.height;
            this.staticDirty = true;
        }
        this.resizeTarget(this.baseTarget, pixels.width, pixels.height);
        const waveSize = renderSize(
            this.view,
            window.devicePixelRatio,
            oceanSettings.maximumPixels,
        );
        this.resizeTarget(this.waveTarget, waveSize.width, waveSize.height);
        if (this.paletteDirty) this.updatePalette();
        if (this.targetsDirty) this.updateTargets();
        if (this.staticDirty) this.drawStatic();
        if (animated || this.waveDirty) {
            this.drawWaves();
            this.waveDirty = false;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, pixels.width, pixels.height);
        gl.disable(gl.BLEND);
        const composite = this.programs.composite;
        this.quadDraw(composite);
        this.bind(composite, 'base', this.baseTarget.texture, 0);
        this.bind(composite, 'waves', this.waveTarget.texture, 1);
        this.bind(composite, 'areaIds', this.textures.areas, 2);
        this.bind(composite, 'countryIds', this.textures.countries, 3);
        this.camera(composite);
        this.selection(composite);
        gl.uniform2f(composite.location('rasterSize'), pixels.width, pixels.height);
        gl.uniform2fv(composite.location('boundaryTexelSize'), this.boundaryTexelSize);
        gl.uniform1f(composite.location('animated'), 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // 通信線と発着点の目印は一時的に非表示。
        // HTMLマーカーも、実際に描き終えたカメラに揃えて同じフレームで更新する。
        if (this.viewDirty) {
            this.viewDirty = false;
            this.callbacks.presented({ ...this.view });
        }
        this.rendered = now;
        this.dirty = false;
        this.stats.frames++;
        const cpu = performance.now() - started;
        this.stats.lastCpuMs = cpu;
        this.stats.cpuTotalMs += cpu;
        this.stats.cpuMs += (cpu - this.stats.cpuMs) / Math.min(60, this.stats.frames);
        this.stats.maxCpuMs = Math.max(this.stats.maxCpuMs, cpu);
        this.stats.pixelWidth = pixels.width;
        this.stats.pixelHeight = pixels.height;
        if (this.stats.frames === 1 || now - this.reported > 1000) {
            this.reported = now;
            this.canvas.dataset.renderStats = JSON.stringify(this.stats);
        }
        if (!this.ready) {
            this.ready = true;
            this.callbacks.ready();
        }
        if (animated) this.frame = requestAnimationFrame(this.draw);
    };

    dispose() {
        this.alive = false;
        this.sequence++;
        cancelAnimationFrame(this.frame);
        this.observer.disconnect();
        document.removeEventListener('visibilitychange', this.visibilityChanged);
        this.canvas.removeEventListener('webglcontextlost', this.contextLost);
        const gl = this.gl;
        for (const program of Object.values(this.programs)) program.dispose();
        for (const texture of Object.values(this.textures)) gl.deleteTexture(texture);
        for (const target of [this.baseTarget, this.waveTarget]) {
            gl.deleteFramebuffer(target.framebuffer);
            gl.deleteTexture(target.texture);
        }
        gl.deleteBuffer(this.quad);
    }
}
