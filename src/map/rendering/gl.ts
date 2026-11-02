/** WebGL資源の作成・解放を一箇所で管理する。別エンジンへのフォールバックは持たない。 */
export class GLProgram {
    readonly program: WebGLProgram;
    private uniforms = new Map<string, WebGLUniformLocation | null>();
    constructor(
        readonly gl: WebGLRenderingContext,
        vertex: string,
        fragment: string,
    ) {
        const shaders = [
            [gl.VERTEX_SHADER, vertex],
            [gl.FRAGMENT_SHADER, fragment],
        ] as const;
        const compiled = shaders.map(([type, source]) => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(shader)!);
            return shader;
        });
        this.program = gl.createProgram()!;
        for (const shader of compiled) gl.attachShader(this.program, shader);
        gl.linkProgram(this.program);
        for (const shader of compiled) gl.deleteShader(shader);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(this.program)!);
    }
    location(name: string) {
        if (!this.uniforms.has(name))
            this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
        return this.uniforms.get(name)!;
    }
    use() {
        // biome-ignore lint/correctness/useHookAtTopLevel: ReactフックではなくWebGLのプログラム選択。
        this.gl.useProgram(this.program);
    }
    dispose() {
        this.gl.deleteProgram(this.program);
    }
}

export function createTexture(gl: WebGLRenderingContext, nearest = false) {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

export function loadImage(url: string) {
    const image = new Image();
    image.src = url;
    return image.decode().then(() => image);
}

export const quadVertex = `
attribute vec2 position;
varying vec2 uv;
void main(){ uv=vec2(position.x*.5+.5,.5-position.y*.5); gl_Position=vec4(position,0.,1.); }
`;
