export const staticFragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D photo, water, countryIds, areaIds, palette, invasion;
uniform vec2 viewport, invasionSize;
uniform vec4 camera;
uniform float period, displayWidth, worldHeight, dataMode, selected, hovered;
uniform vec4 landTone, oceanTone, globalTone, landTint, oceanTint, territory;
uniform vec3 hues;
vec3 tone(vec3 c,vec4 t,float hue,vec4 tint) {
    c=mix(c,tint.rgb,tint.a);
    c=clamp(c*t.x,0.,1.);
    c=clamp((c-.5)*t.y+.5,0.,1.);
    c=clamp(mix(vec3(dot(c,vec3(.213,.715,.072))),c,t.z),0.,1.);
    vec3 sepia=vec3(dot(c,vec3(.393,.769,.189)),dot(c,vec3(.349,.686,.168)),dot(c,vec3(.272,.534,.131)));
    c=clamp(mix(c,sepia,t.w),0.,1.);
    float a=cos(hue),b=sin(hue);
    return clamp(vec3(
        dot(c,vec3(.213+.787*a-.213*b,.715-.715*a-.715*b,.072-.072*a+.928*b)),
        dot(c,vec3(.213-.213*a+.143*b,.715+.285*a+.140*b,.072-.072*a-.283*b)),
        dot(c,vec3(.213-.213*a-.787*b,.715-.715*a+.715*b,.072+.928*a+.072*b))),0.,1.);
}
float idAt(vec2 p) { return floor(texture2D(countryIds,vec2(fract(p.x),clamp(p.y,0.,1.))).r*255.+.5); }
float areaAt(vec2 p) { return floor(texture2D(areaIds,vec2(fract(p.x),clamp(p.y,0.,1.))).r*255.+.5); }
// 3列に人口密度で重み付けした16bit到達順。依存は使用領域内に収める。
vec3 coverageAt(vec2 p) {
    p=vec2(fract(p.x),clamp(p.y,0.,1.));
    float area=areaAt(p);
    vec4 fill=texture2D(palette,vec2((area+.5)/256.,.25));
    vec2 amount=vec2(fill.r*65280.+fill.g*255.,fill.b*65280.+fill.a*255.)/65535.;
    // 到達順を線形補間して前線をセルの間でも動かす。アトラスの列同士は混ぜない。
    vec2 inset=.5/invasionSize;
    vec2 rankUV=clamp(p,inset,vec2(1.)-inset);
    vec2 used=texture2D(invasion,vec2(rankUV.x/3.,rankUV.y)).rg;
    vec2 dependent=texture2D(invasion,vec2((1.+rankUV.x)/3.,rankUV.y)).rg;
    vec2 rank=vec2(used.r*65280.+used.g*255.,dependent.r*65280.+dependent.g*255.)/65535.;
    vec4 opposition=texture2D(palette,vec2((area+.5)/256.,.75));
    float antiAmount=(opposition.r*65280.+opposition.g*255.)/65535.;
    vec2 antiEncoded=texture2D(invasion,vec2((2.+rankUV.x)/3.,rankUV.y)).rg;
    float antiRank=(antiEncoded.r*65280.+antiEncoded.g*255.)/65535.;
    float anti=step(antiRank,antiAmount)*step(.00001,antiAmount);
    return vec3(step(rank,amount)*step(vec2(.00001),amount),anti)*step(.5,area)*(1.-texture2D(water,p).a);
}
void main(){
    vec2 pixel=uv*viewport;
    float x=pixel.x-camera.z;
    if(x<0.||x>displayWidth||pixel.y<camera.y||pixel.y>camera.y+worldHeight){gl_FragColor=vec4(mix(vec3(.031,.059,.075),vec3(.612,.729,.788),dataMode),1.);return;}
    vec2 p=vec2(fract((x-camera.x)/period),(pixel.y-camera.y)/worldHeight);
    float area=areaAt(p);
    vec3 c;
    if(dataMode>.5) c=vec3(.15,.19,.22);
    else {
        vec3 original=texture2D(photo,p).rgb;
        vec3 land= tone(original,landTone,hues.x,landTint);
        vec3 sea= tone(original,oceanTone,hues.y,oceanTint);
        c=tone(mix(land,sea,texture2D(water,p).a),globalTone,hues.z,vec4(0.));

    }
    if(area>0.) {
        vec3 coverage=coverageAt(p);
        // 輪郭は約1pxの内側だけに置く。明るい太線で面を縁取らない。
        vec2 delta=vec2(.9/period,.9/worldHeight);
        vec3 neighbor=min(min(coverageAt(p+vec2(delta.x,0.)),coverageAt(p-vec2(delta.x,0.))),
                          min(coverageAt(p+vec2(0.,delta.y)),coverageAt(p-vec2(0.,delta.y))));
        vec3 edge=max(vec3(0.),coverage-neighbor);
        float opposition=coverage.z;
        float blue=coverage.x*(1.-coverage.y)*(1.-opposition);
        float red=coverage.y*(1.-opposition);
        // 各状態を重ねる前の地形を共通の明暗源にする。
        float terrainLight=dot(c,vec3(.213,.715,.072));
        float relief=smoothstep(.03,.62,terrainLight);
        vec3 neutralTerrain=vec3(terrainLight);
        // 利用は地表を透かす青い面。粒子・回路・斜線は重ねない。
        vec3 blueColor=mix(vec3(.12,.34,.44),vec3(.29,.62,.72),relief);
        c=mix(c,blueColor,blue*.38);
        // 依存は地表の色相を抑え、地形の陰影を深紅の明暗へ移す。
        // 模様や時間変化を加えず、大きな面でも地理を読めるようにする。
        vec3 dependencyFill=mix(vec3(.31,.035,.065),vec3(.76,.16,.20),relief);
        c=mix(c,mix(neutralTerrain,dependencyFill,.90),red*.94);
        // 反AIだけに地図記号として斜線を置く。地図座標に固定し、縮小時は弱める。
        float stripe=fract((p.x*8192.+p.y*4361.)/80.);
        vec2 stripeGradient=vec2(8192./period,4361./worldHeight)/80.;
        float stripePixel=length(stripeGradient);
        float aa=clamp(stripePixel*.65,.008,.12);
        float hatch=smoothstep(.68-aa,.68+aa,stripe)*(1.-smoothstep(.88-aa,.88+aa,stripe));
        hatch*=smoothstep(3.,7.,1./max(stripePixel,.0001));
        vec3 oppositionColor=mix(vec3(.48,.35,.17),vec3(.76,.60,.33),relief);
        vec3 oppositionBase=mix(neutralTerrain,oppositionColor,.50);
        c=mix(c,oppositionBase,opposition*.72);
        c=mix(c,vec3(.78,.63,.36),opposition*hatch*.32);
        // 輪郭は面の色に近づけ、状態の境界を控えめに補助する。
        c=mix(c,vec3(.29,.58,.68),edge.x*(1.-red)*(1.-opposition)*.30);
        c=mix(c,vec3(.64,.12,.17),edge.y*(1.-opposition)*.26);
        c=mix(c,vec3(.70,.54,.29),edge.z*.40);
    }
    bool focus=area>0.&&(abs(area-selected)<.1||abs(area-hovered)<.1);
    if(focus) c=mix(c,vec3(.86,.92,.94),.10);
    gl_FragColor=vec4(c,1.);
}`;

/** 選択線は海面合成の後に描き、境界の内外両側から強調対象を判定する。 */
export const compositeFragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D base, waves, areaIds, countryIds;
uniform vec2 viewport, rasterSize;
uniform vec4 camera;
uniform float animated, period, displayWidth, worldHeight, selected, hovered;
float areaAt(vec2 p) { return floor(texture2D(areaIds,vec2(fract(p.x),clamp(p.y,0.,1.))).r*255.+.5); }
float countryAt(vec2 p) { return floor(texture2D(countryIds,vec2(fract(p.x),clamp(p.y,0.,1.))).r*255.+.5); }
float focused(float id) { return id>0.&&(abs(id-selected)<.1||abs(id-hovered)<.1) ? 1. : 0.; }
void main(){
    vec2 screen=vec2(uv.x,1.-uv.y);
    vec4 baseColor=texture2D(base,screen);
    vec4 wave=texture2D(waves,screen)*animated;
    vec3 color=baseColor.rgb*(1.-wave.a)+wave.rgb;
    vec2 pixel=uv*viewport;
    float x=pixel.x-camera.z;
    if(x>=0.&&x<=displayWidth&&pixel.y>=camera.y&&pixel.y<=camera.y+worldHeight){
        vec2 p=vec2(fract((x-camera.x)/period),(pixel.y-camera.y)/worldHeight);
        // 半描画ピクセル以上を調べ、水平・垂直な境界が画素間に落ちても線を拾う。
        vec2 halfPixel=.51*viewport/rasterSize/vec2(period,worldHeight);
        vec2 minimumDelta=max(halfPixel,vec2(1./8192.,1./4361.));
        vec2 delta=max(vec2(.4/period,.4/worldHeight),minimumDelta);
        float center=areaAt(p);
        float a=areaAt(p+vec2(delta.x,0.)), b=areaAt(p-vec2(delta.x,0.));
        float c=areaAt(p+vec2(0.,delta.y)), d=areaAt(p-vec2(0.,delta.y));
        float edge=max(max(step(.5,abs(center-a)),step(.5,abs(center-b))),max(step(.5,abs(center-c)),step(.5,abs(center-d))));
        float focus=max(focused(center),max(max(focused(a),focused(b)),max(focused(c),focused(d))));
        vec2 countryDelta=max(vec2(.25/period,.25/worldHeight),minimumDelta);
        float country=countryAt(p);
        float ca=countryAt(p+vec2(countryDelta.x,0.)), cb=countryAt(p-vec2(countryDelta.x,0.));
        float cc=countryAt(p+vec2(0.,countryDelta.y)), cd=countryAt(p-vec2(0.,countryDelta.y));
        float countryEdge=max(max(step(.5,abs(country-ca)),step(.5,abs(country-cb))),max(step(.5,abs(country-cc)),step(.5,abs(country-cd))));
        // 境界が共有される画素も一度だけ合成する。透明度を足し合わせない。
        float opacity=max(countryEdge*.06,edge*mix(.14,.30,focus));
        color=mix(color,vec3(.96,.98,1.),opacity);
    }
    gl_FragColor=vec4(color,1.);
}
`;
