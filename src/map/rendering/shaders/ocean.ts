import { psrdNoise } from './psrdNoise';

export const vertexShader = `
attribute vec2 position;
varying vec2 screenUV;
void main() {
    screenUV = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0., 1.);
}`;

// 波面と変形場を経度方向に周期化し、日付変更線でも傾きを接続する。
export const fragmentShader = `
precision highp float;
varying vec2 screenUV;
uniform sampler2D seaMask;
uniform vec2 viewport;
uniform vec2 rasterSize;
uniform float cameraX;
uniform float period;
uniform float leftEdge;
uniform float displayWidth;
uniform float time;
uniform float strength;
uniform float tintStrength;
uniform float cameraY;
uniform float worldHeight;
${psrdNoise}
void main() {
    float x = screenUV.x * viewport.x - leftEdge;
    if (x < 0. || x > displayWidth) discard;
    float y=(1.-screenUV.y)*viewport.y-cameraY;
    if(y<0.||y>worldHeight)discard;
    vec2 uv = vec2(fract((x-cameraX)/period), y/worldHeight);
    float mask = texture2D(seaMask, uv).r;
    if (mask < .001) discard;
    vec2 p=uv*vec2(128.,128.*4361./8192.);
    vec2 flowGradientX, flowGradientY;
    float flowX=oceanNoise(p/16.,8.,time*.025,flowGradientX);
    float flowY=oceanNoise(p/16.+vec2(2.8,5.3),8.,-time*.021+1.7,flowGradientY);
    // 変形量を有界に保ち、時間とともに波面が引き伸ばされ続けるのを避ける。
    vec2 q=p+vec2(flowX,flowY)*.9;
    vec2 swellGradient, gradientA, gradientB;
    oceanNoise(q*.25+vec2(4.1,7.8),32.,time*.07,swellGradient);
    oceanNoise(q,128.,time*.28,gradientA);
    oceanNoise(q*2.+vec2(17.3,9.2),256.,-time*.48+2.4,gradientB);
    // 実際の海面描画解像度から、解像できない高周波の法線を滑らかに除く。
    vec2 footprint=vec2(128.,128.*4361./8192.)*viewport/rasterSize/vec2(period,worldHeight);
    vec2 deformationX=vec2(1.,0.)+flowGradientX*(.9/16.);
    vec2 deformationY=vec2(0.,1.)+flowGradientY*(.9/16.);
    vec2 warpedFootprint=vec2(dot(abs(deformationX),footprint),dot(abs(deformationY),footprint));
    float pixel=max(warpedFootprint.x,warpedFootprint.y);
    float coarse=1.-smoothstep(.18,.6,pixel);
    float fine=1.-smoothstep(.18,.6,pixel*2.);
    // ゆっくりしたうねりを下地に置き、細かな反射を主役にしない。
    vec2 slopeQ=swellGradient*.04*.25+gradientA*.08*coarse+gradientB*.02*2.*fine;
    // 画素単位の帯域制限を除いた波面を連鎖律で微分する。
    vec2 slope=slopeQ+(flowGradientX*slopeQ.x+flowGradientY*slopeQ.y)*(.9/16.);
    vec3 normal=normalize(vec3(-slope,1.));
    vec3 halfLight=normalize(vec3(-.28,-.22,1.));
    // 急な閾値を使わず、反射が連続的に現れて消えるようにする。
    float light=pow(max(dot(normal,halfLight),0.),80.)*coarse;
    // 広い範囲で反射量を穏やかに変え、海全体を同じ密度の粒で覆わない。
    float exposure=mix(.25,.75,smoothstep(-.55,.65,flowX*.65+flowY*.35));
    // ノイズは反射の強弱にだけ使い、雲状の白黒模様を直接表示しない。
    vec3 color = vec3(.65,.82,.9);
    float reflectionAlpha = light*strength*mask*exposure;
    float tintAlpha = tintStrength*mask;
    float alpha = reflectionAlpha+tintAlpha*(1.-reflectionAlpha);
    gl_FragColor = vec4(
        color*reflectionAlpha+vec3(.25,.45,.56)*tintAlpha*(1.-reflectionAlpha), alpha);
}`;
