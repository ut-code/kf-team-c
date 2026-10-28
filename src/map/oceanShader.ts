export const vertexShader = `
attribute vec2 position;
varying vec2 screenUV;
void main() {
    screenUV = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0., 1.);
}`;

// 格子を経度方向に周期化し、日付変更線でも波と局所変形を接続する。
export const fragmentShader = `
precision highp float;
varying vec2 screenUV;
uniform sampler2D seaMask;
uniform vec2 viewport;
uniform float cameraX;
uniform float period;
uniform float leftEdge;
uniform float displayWidth;
uniform float time;
uniform float strength;
uniform float tintStrength;
uniform float detail;
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// 周期的な高さと解析的な傾き。差分による高さの再計算を避ける。
vec3 ripple(vec2 p, float repeat) {
    vec2 cell = floor(p), f = fract(p);
    float a = hash(mod(cell, repeat));
    float b = hash(mod(cell + vec2(1., 0.), repeat));
    float c = hash(mod(cell + vec2(0., 1.), repeat));
    float d = hash(mod(cell + vec2(1., 1.), repeat));
    vec2 u = f*f*f*(f*(f*6.-15.)+10.);
    vec2 du = 30.*f*f*(f-1.)*(f-1.);
    float crossTerm = a-b-c+d;
    return vec3(a+(b-a)*u.x+(c-a)*u.y+crossTerm*u.x*u.y,
        du*vec2(b-a+crossTerm*u.y, c-a+crossTerm*u.x));
}
void main() {
    float x = screenUV.x * viewport.x - leftEdge;
    if (x < 0. || x > displayWidth) discard;
    vec2 uv = vec2(fract((x-cameraX)/period), 1.-screenUV.y);
    float mask = texture2D(seaMask, uv).r;
    if (mask < .001) discard;
    vec2 p = vec2(uv.x*64., uv.y*34.);
    // 低周波の流れで形を局所的に曲げ、全体が一枚の模様として滑るのを防ぐ。
    vec2 flow = vec2(
        ripple(p*.125+vec2(time*.035, 0.), 8.).x,
        ripple(p*.125+vec2(3.7, -time*.029), 8.).x)-.5;
    vec2 q = p+flow*1.8;
    vec3 a = ripple(vec2(q.x+q.y*.65, q.y*2.)+vec2(time*.23, -time*.31), 64.);
    vec3 b = ripple(vec2(q.x*2.-q.y*.8, q.x+q.y*3.)+vec2(-time*.19, time*.27), 64.);
    vec3 swell = ripple(p*.25+vec2(time*.04, -time*.03), 16.);
    // 異なる方向と縮尺のさざ波を合成。画素より細かい層は連続的に弱める。
    vec2 slopeA = vec2(a.y, a.y*.65+a.z*2.);
    vec2 slopeB = vec2(b.y*2.+b.z, -b.y*.8+b.z*3.);
    vec3 normal = normalize(vec3(-(slopeA*.15+slopeB*.065*detail+swell.yz*.07), 1.));
    vec3 halfLight = normalize(vec3(-.28, -.22, 1.));
    float reflection = pow(max(dot(normal, halfLight), 0.), 32.);
    float flatReflection = pow(halfLight.z, 32.);
    float glints = ripple(p*.5+vec2(-time*.09, time*.07), 32.).x;
    float light = smoothstep(.55, .95, reflection);
    // ノイズは反射の強弱にだけ使い、雲状の白黒模様を直接表示しない。
    vec3 color = vec3(.65,.82,.9);
    float reflectionAlpha = abs(light)*strength*mask*mix(.3, 1., glints);
    float tintAlpha = tintStrength*mask;
    float alpha = reflectionAlpha+tintAlpha*(1.-reflectionAlpha);
    gl_FragColor = vec4(
        color*reflectionAlpha+vec3(.25,.45,.56)*tintAlpha*(1.-reflectionAlpha), alpha);
}`;
