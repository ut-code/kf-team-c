import { countryParameterColor } from '../game/countryParameters';
import oceanSettings from '../game/data/map/ocean-surface.json';
import type { CountryState, FacilityState } from '../game/types';
import { project, WORLD_WIDTH } from './geometry';
import { createTexture, GLProgram, loadImage, quadVertex } from './gl';
import { fragmentShader as waveFragment, vertexShader as waveVertex } from './oceanShader';
import { type Atlas, loadAtlas, SpriteBatch } from './sprites';
import { ColorReader, type MapTone, readMapTone } from './tone';
import { TRAFFIC_ROUTES, trafficActivity, trafficPosition } from './traffic';
import type { Country, MapMarker } from './types';
import {
    type CountryShape,
    countryAtPoint,
    cullMarkers,
    type MapView,
    parseCountries,
    renderSize,
    screenPoint,
    type VisibleMarker,
    viewTransform,
    visibleBounds,
    worldPoint,
} from './view';
import { createWaveNoise } from './waveNoise';
import { compositeFragment, spriteFragment, spriteVertex, staticFragment } from './worldShaders';

export interface MapScene {
    countries: Country[];
    backgroundUrl: string;
    waterMaskUrl: string;
    surfaceMaskUrl: string;
    countryIndexUrl: string;
}
export interface MapData {
    countries: Country[];
    countryStates: Record<string, CountryState>;
    facilityStates?: Record<string, FacilityState>;
    markers: MapMarker[];
    selectedCountry: string | null;
    selectedMarker: string | null;
    parameterValues?: Record<string, number>;
    speed: number;
    tick: number;
}
export interface MapTarget {
    kind: 'country' | 'marker';
    id: string;
    label: string;
}
interface TargetBuffer {
    texture: WebGLTexture;
    framebuffer: WebGLFramebuffer;
    width: number;
    height: number;
}

/** 画面サイズ固定の単一WebGL描画。静的地図はキャッシュし、動く画像だけを一括描画する。 */
export class WorldRenderer {
    private gl: WebGLRenderingContext;
    private programs: {
        base: GLProgram;
        wave: GLProgram;
        composite: GLProgram;
        sprites: GLProgram;
    };
    private quad: WebGLBuffer;
    private spriteBuffer: WebGLBuffer;
    private textures: Record<
        'photo' | 'water' | 'surface' | 'countries' | 'palette' | 'atlas' | 'noise',
        WebGLTexture
    >;
    private baseTarget: TargetBuffer;
    private waveTarget: TargetBuffer;
    private colors = new ColorReader();
    private tone: MapTone;
    private atlas: Atlas | null = null;
    private atlasPromise: Promise<Atlas>;
    private batch = new SpriteBatch();
    private shapes: CountryShape[] = [];
    private shapeCache = new WeakMap<Country[], CountryShape[]>();
    private indices = new Map<string, number>();
    private data: MapData | null = null;
    private view: MapView = { width: 0, height: 0, zoom: 1, x: 0, y: 0 };
    private projected: { marker: MapMarker; x: number; y: number }[] = [];
    private visible: VisibleMarker[] = [];
    private targetsKey = '';
    private hover: MapTarget | null = null;
    private requested = '';
    private loaded = '';
    private resourceUrls = { photo: '', water: '', surface: '', countries: '' };
    private sequence = 0;
    private alive = true;
    private ready = false;
    private dirty = true;
    private staticDirty = true;
    private waveDirty = true;
    private styleDirty = true;
    private paletteDirty = true;
    private targetsDirty = true;
    private frame = 0;
    private previous = 0;
    private rendered = 0;
    private elapsed = 0;
    private waveElapsed = 0;
    private observer: MutationObserver;
    private reported = 0;
    readonly stats = {
        frames: 0,
        staticPasses: 0,
        wavePasses: 0,
        spriteDraws: 0,
        textureUploads: 0,
        geometryCompiles: 0,
        visibleMarkers: 0,
        sprites: 0,
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
        if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < WORLD_WIDTH)
            throw new Error('世界地図には8192pxのテクスチャ対応が必要です。');
        this.gl = gl;
        this.programs = {
            base: new GLProgram(gl, quadVertex, staticFragment),
            wave: new GLProgram(gl, waveVertex, waveFragment),
            composite: new GLProgram(gl, quadVertex, compositeFragment),
            sprites: new GLProgram(gl, spriteVertex, spriteFragment),
        };
        this.quad = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW,
        );
        this.spriteBuffer = gl.createBuffer()!;
        this.textures = {
            photo: createTexture(gl),
            water: createTexture(gl),
            surface: createTexture(gl),
            countries: createTexture(gl, true),
            palette: createTexture(gl, true),
            atlas: createTexture(gl),
            noise: createTexture(gl, true),
        };
        this.baseTarget = this.createTarget();
        gl.bindTexture(gl.TEXTURE_2D, this.textures.noise);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            128,
            64,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            createWaveNoise(),
        );
        this.waveTarget = this.createTarget();
        this.tone = readMapTone(canvas, this.colors);
        this.atlasPromise = loadAtlas(import.meta.env.BASE_URL);
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
        };
        const image = (name: keyof typeof urls) =>
            this.resourceUrls[name] === urls[name] ? Promise.resolve(null) : loadImage(urls[name]);
        Promise.all([
            image('photo'),
            image('water'),
            image('surface'),
            image('countries'),
            this.atlasPromise,
        ])
            .then(([photo, water, surface, countries, atlas]) => {
                if (!this.alive || sequence !== this.sequence) return;
                let shapes = this.shapeCache.get(scene.countries);
                if (!shapes) {
                    shapes = parseCountries(scene.countries);
                    this.shapeCache.set(scene.countries, shapes);
                    this.stats.geometryCompiles++;
                }
                this.shapes = shapes;
                this.indices = new Map(
                    scene.countries.map((country, index) => [country.id, index + 1]),
                );
                for (const [name, source] of [
                    ['photo', photo],
                    ['water', water],
                    ['surface', surface],
                    ['countries', countries],
                ] as const) {
                    if (source) {
                        this.upload(
                            this.textures[name],
                            source,
                            name === 'surface' || name === 'countries'
                                ? this.gl.LUMINANCE
                                : this.gl.RGBA,
                        );
                        this.resourceUrls[name] = urls[name];
                    }
                }
                if (!this.atlas) {
                    this.atlas = atlas;
                    this.upload(this.textures.atlas, atlas.canvas);
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
        if (
            !old ||
            old.countryStates !== data.countryStates ||
            old.parameterValues !== data.parameterValues
        ) {
            this.paletteDirty = true;
            this.staticDirty = true;
        }
        if (!old || old.selectedCountry !== data.selectedCountry) this.staticDirty = true;
        if (!old || old.markers !== data.markers) {
            this.projected = data.markers
                .filter((marker) => marker.latitude >= -60 && marker.latitude <= 75)
                .map((marker) => ({ marker, ...project(marker.longitude, marker.latitude) }));
            this.targetsDirty = true;
        }
        if (!old || Boolean(old.parameterValues) !== Boolean(data.parameterValues)) {
            this.staticDirty = true;
            this.waveDirty = true;
            this.targetsDirty = true;
        }
        if (old && data.tick < old.tick) {
            this.elapsed = 0;
            this.waveElapsed = 0;
        } else if (old && data.speed === 0) this.elapsed += Math.max(0, data.tick - old.tick);
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
        this.waveDirty = true;
        this.targetsDirty = true;
        this.invalidate(true);
    }
    setHover(target: MapTarget | null) {
        if (this.hover?.id === target?.id && this.hover?.kind === target?.kind) return;
        const countryChanged = this.hover?.kind === 'country' || target?.kind === 'country';
        this.hover = target;
        this.invalidate(countryChanged);
    }
    private invalidate(staticPart = false) {
        this.dirty = true;
        this.staticDirty ||= staticPart;
        if (this.alive && !this.frame && !document.hidden)
            this.frame = requestAnimationFrame(this.draw);
    }

    private updateTargets() {
        this.visible = cullMarkers(this.projected, this.view);
        const targets: MapTarget[] = this.shapes
            .filter((shape) => shape.rings.some((ring) => visibleBounds(ring.bounds, this.view)))
            .map((shape) => ({ kind: 'country', id: shape.country.id, label: shape.country.name }));
        for (const { marker } of this.visible) {
            if (this.data!.parameterValues && marker.kind !== 'country') continue;
            targets.push({
                kind: this.data!.parameterValues ? 'country' : 'marker',
                id: this.data!.parameterValues ? marker.id.slice(8) : marker.id,
                label: marker.label,
            });
        }
        const unique = [
            ...new Map(targets.map((target) => [`${target.kind}:${target.id}`, target])).values(),
        ];
        const key = unique.map((target) => `${target.kind}:${target.id}`).join('|');
        if (key !== this.targetsKey) {
            this.targetsKey = key;
            this.callbacks.targets(unique);
        }
        this.stats.visibleMarkers = this.visible.length;
        this.targetsDirty = false;
    }

    hitTest(x: number, y: number): MapTarget | null {
        if (!this.ready) return null;
        const point = worldPoint(this.view, x, y);
        if (!point) return null;
        for (let index = this.visible.length - 1; index >= 0; index--) {
            const item = this.visible[index];
            if (this.data!.parameterValues && item.marker.kind !== 'country') continue;
            const radius = this.data!.parameterValues
                ? 7
                : item.marker.kind === 'facility'
                  ? 13
                  : 14;
            if (Math.abs(x - item.x) <= radius && Math.abs(y - item.y) <= radius)
                return {
                    kind: this.data!.parameterValues ? 'country' : 'marker',
                    id: this.data!.parameterValues ? item.marker.id.slice(8) : item.marker.id,
                    label: item.marker.label,
                };
        }
        const id = countryAtPoint(this.shapes, point.x, point.y);
        return id
            ? { kind: 'country', id, label: this.shapes[this.indices.get(id)! - 1].country.name }
            : null;
    }

    private updatePalette() {
        const bytes = new Uint8Array(256 * 4);
        this.data!.countries.forEach((country) => {
            const index = this.indices.get(country.id);
            if (!index) return;
            const value = this.data!.parameterValues?.[country.id];
            if (value !== undefined) {
                const color = this.colors.read(countryParameterColor(value));
                for (let c = 0; c < 4; c++) bytes[index * 4 + c] = Math.round(color[c] * 255);
            } else {
                const state = this.data!.countryStates[country.id];
                if (state)
                    bytes[index * 4 + 3] = Math.round(
                        (state.controlStatus === 'controlled'
                            ? 0.52
                            : (state.aiDecisionControl / 100) * 0.25) * 255,
                    );
            }
        });
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textures.palette);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        this.paletteDirty = false;
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
        gl.uniform1f(p.location('dataMode'), this.data!.parameterValues ? 1 : 0);
        gl.uniform1f(p.location('selected'), this.indices.get(this.data!.selectedCountry!) ?? -1);
        gl.uniform1f(
            p.location('hovered'),
            this.hover?.kind === 'country' ? (this.indices.get(this.hover.id) ?? -1) : -1,
        );
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
        this.bind(p, 'noiseGrid', this.textures.noise, 1);
        gl.uniform1f(p.location('time'), this.waveElapsed);
        gl.uniform1f(p.location('strength'), oceanSettings.strength);
        gl.uniform1f(p.location('tintStrength'), oceanSettings.tintStrength);
        gl.uniform1f(
            p.location('detail'),
            Math.min(
                1,
                (viewTransform(this.view).period * this.waveTarget.width) / this.view.width / 1024,
            ),
        );
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.stats.wavePasses++;
    }

    private drawSprites() {
        const data = this.data!,
            atlas = this.atlas!,
            batch = this.batch,
            view = this.view,
            t = viewTransform(view);
        batch.reset();
        if (!data.parameterValues) {
            for (const route of TRAFFIC_ROUTES) {
                const activity = trafficActivity(route, data.countryStates);
                if (route.phase > activity) continue;
                const position = trafficPosition(route, this.elapsed);
                if (!position) continue;
                const p = screenPoint(view, position.x, position.y);
                if (p.y < -24 || p.y > view.height + 24) continue;
                const ship = route.kind === 'ship',
                    alpha = position.opacity * (ship ? 0.67 : 0.76) * Math.min(1, activity + 0.3);
                for (const dx of [-t.period, 0, t.period]) {
                    const x = p.x + dx;
                    if (x < t.left - 24 || x > t.left + t.width + 24) continue;
                    batch.add(
                        atlas.sprites.trail,
                        x - Math.cos(position.heading) * 14,
                        p.y - Math.sin(position.heading) * 14,
                        position.heading,
                        alpha * 0.32,
                        ship,
                        [0.75, 0.82, 0.83],
                        ship ? 13 : 22,
                        ship ? 1.3 : 0.8,
                    );
                    batch.add(
                        atlas.sprites[route.kind],
                        x,
                        p.y,
                        position.heading + (ship ? Math.PI / 2 : Math.PI / 4),
                        alpha,
                        ship,
                    );
                }
            }
        }
        for (const { marker, x, y } of this.visible) {
            if (data.parameterValues) {
                if (marker.kind === 'country') {
                    const color = this.colors.read(
                        countryParameterColor(data.parameterValues[marker.id.slice(8)]),
                    );
                    batch.add(atlas.sprites.white, x, y, 0, 1, false, color, 12, 12);
                }
                continue;
            }
            const selected =
                data.selectedMarker === marker.id ||
                (this.hover?.kind === 'marker' && this.hover.id === marker.id);
            if (selected)
                batch.add(
                    atlas.sprites[marker.kind === 'facility' ? 'facility-outline' : 'outline'],
                    x,
                    y,
                );
            batch.add(
                atlas.sprites[
                    marker.kind === 'facility'
                        ? marker.category!
                        : marker.kind === 'person'
                          ? 'mail'
                          : 'map-pin'
                ],
                x,
                y,
            );
            if (marker.kind === 'facility') continue;
            const status = data.facilityStates?.[marker.id]?.status;
            batch.add(
                atlas.sprites[
                    marker.kind === 'person'
                        ? 'unread'
                        : status === 'isolated'
                          ? 'isolated'
                          : status === 'controlled' ||
                              status === 'compromised' ||
                              status === 'infiltrating'
                            ? 'active'
                            : 'neutral'
                ],
                x + 10,
                y + (marker.kind === 'person' ? -10 : 10),
            );
        }
        this.stats.sprites = batch.length / 54;
        if (!batch.length) return;
        const gl = this.gl,
            p = this.programs.sprites;
        p.use();
        this.camera(p);
        this.bind(p, 'atlas', this.textures.atlas, 0);
        this.bind(p, 'water', this.textures.water, 1);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, batch.data, gl.DYNAMIC_DRAW);
        for (const [name, size, offset] of [
            ['position', 2, 0],
            ['texcoord', 2, 8],
            ['color', 4, 16],
            ['ship', 1, 32],
        ] as const) {
            const location = gl.getAttribLocation(p.program, name);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset);
        }
        gl.drawArrays(gl.TRIANGLES, 0, batch.length / 9);
        this.stats.spriteDraws++;
        gl.disable(gl.BLEND);
        for (const name of ['texcoord', 'color', 'ship'])
            gl.disableVertexAttribArray(gl.getAttribLocation(p.program, name));
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
        this.elapsed += dt * this.data.speed;
        this.waveElapsed +=
            dt * Math.min(this.data.speed, oceanSettings.maximumSpeed) * oceanSettings.timeScale;
        const animated = !this.data.parameterValues && this.data.speed > 0;
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
        if (!this.data.parameterValues && (animated || this.waveDirty)) {
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
        gl.uniform1f(composite.location('animated'), this.data.parameterValues ? 0 : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.drawSprites();
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
        gl.deleteBuffer(this.spriteBuffer);
    }
}
