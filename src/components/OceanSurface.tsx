import { useEffect, useRef } from 'react';
import settings from '../game/data/map/ocean-surface.json';
import { mapConfig } from '../map/config';
import { fitScale, type Size, visibleWidth, WORLD_WIDTH } from '../map/geometry';
import { fragmentShader, vertexShader } from '../map/oceanShader';
import styles from './TrafficLayer.module.css';

export function OceanSurface({
    size,
    cameraX,
    cameraXRef,
    speed,
    tick,
}: {
    size: Size;
    cameraX: number;
    cameraXRef: { current: number };
    speed: number;
    tick: number;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const state = useRef({ size, cameraX, speed, tick, dirty: true, reset: false });
    useEffect(() => {
        state.current = {
            size,
            cameraX,
            speed,
            tick,
            dirty: true,
            reset: state.current.reset || tick < state.current.tick,
        };
    }, [size, cameraX, speed, tick]);
    useEffect(() => {
        const target = canvas.current!;
        const gl = target.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false,
            preserveDrawingBuffer: true,
        });
        if (!gl) throw new Error('海面の描画にはWebGLが必要です。');
        function compile(type: number, source: string) {
            const shader = gl!.createShader(type)!;
            gl!.shaderSource(shader, source);
            gl!.compileShader(shader);
            if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS))
                throw new Error(gl!.getShaderInfoLog(shader)!);
            return shader;
        }
        const vertex = compile(gl.VERTEX_SHADER, vertexShader),
            fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
        const program = gl.createProgram()!;
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(program)!);
        // biome-ignore lint/correctness/useHookAtTopLevel: WebGLのAPIでありReactフックではない。
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW,
        );
        const attribute = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
        const uniforms = Object.fromEntries(
            [
                'viewport',
                'cameraX',
                'period',
                'leftEdge',
                'displayWidth',
                'time',
                'strength',
                'tintStrength',
                'detail',
            ].map((name) => [name, gl.getUniformLocation(program, name)]),
        );
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        let ready = false,
            alive = true,
            frame = 0,
            elapsed = 0,
            previous = performance.now(),
            rendered = 0;
        const image = new Image();
        image.onload = () => {
            if (!alive) return;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, image);
            ready = true;
            state.current.dirty = true;
        };
        image.src = mapConfig.surfaceMaskUrl;
        function draw(now: number) {
            const current = state.current;
            if (current.cameraX !== cameraXRef.current) {
                current.cameraX = cameraXRef.current;
                current.dirty = true;
            }
            if (current.reset) {
                elapsed = 0;
                current.reset = false;
            }
            if (document.visibilityState === 'visible')
                elapsed +=
                    ((now - previous) / 1000) *
                    Math.min(current.speed, settings.maximumSpeed) *
                    settings.timeScale;
            previous = now;
            if (
                ready &&
                current.size.height > 0 &&
                current.size.width > 0 &&
                (current.dirty ||
                    (current.speed > 0 && now - rendered >= 1000 / settings.framesPerSecond))
            ) {
                const { width, height } = current.size;
                const scale = Math.min(
                    window.devicePixelRatio,
                    settings.maximumPixelRatio,
                    Math.sqrt(settings.maximumPixels / (width * height)),
                );
                const w = Math.max(1, Math.floor(width * scale)),
                    h = Math.max(1, Math.floor(height * scale));
                if (target.width !== w || target.height !== h) {
                    target.width = w;
                    target.height = h;
                }
                gl!.viewport(0, 0, w, h);
                // discardした陸・余白へ移動前の海面を残さない。
                gl!.clearColor(0, 0, 0, 0);
                gl!.clear(gl!.COLOR_BUFFER_BIT);
                gl!.uniform2f(uniforms.viewport, width, height);
                gl!.uniform1f(uniforms.cameraX, current.cameraX);
                gl!.uniform1f(uniforms.period, WORLD_WIDTH * fitScale(current.size));
                gl!.uniform1f(uniforms.leftEdge, (width - visibleWidth(current.size)) / 2);
                gl!.uniform1f(uniforms.displayWidth, visibleWidth(current.size));
                gl!.uniform1f(uniforms.time, elapsed);
                gl!.uniform1f(uniforms.strength, settings.strength);
                gl!.uniform1f(uniforms.tintStrength, settings.tintStrength);
                gl!.uniform1f(
                    uniforms.detail,
                    Math.min(1, (WORLD_WIDTH * fitScale(current.size) * scale) / 1024),
                );
                gl!.drawArrays(gl!.TRIANGLES, 0, 6);
                target.dataset.oceanTime = elapsed.toFixed(5);
                current.dirty = false;
                rendered = now;
            }
            frame = requestAnimationFrame(draw);
        }
        frame = requestAnimationFrame(draw);
        return () => {
            alive = false;
            image.onload = null;
            cancelAnimationFrame(frame);
            gl.deleteTexture(texture);
            gl.deleteBuffer(buffer);
            gl.deleteProgram(program);
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
        };
    }, [cameraXRef]);
    return (
        <div className={styles.layer} aria-hidden="true">
            <canvas ref={canvas} tabIndex={-1} data-ocean-surface />
        </div>
    );
}
