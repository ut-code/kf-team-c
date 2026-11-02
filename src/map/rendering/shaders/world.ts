export const staticFragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D photo, water, countryIds, areaIds, palette;
uniform vec2 viewport;
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
void main(){
    vec2 pixel=uv*viewport;
    float x=pixel.x-camera.z;
    if(x<0.||x>displayWidth||pixel.y<camera.y||pixel.y>camera.y+worldHeight){gl_FragColor=vec4(mix(vec3(.031,.059,.075),vec3(.612,.729,.788),dataMode),1.);return;}
    vec2 p=vec2(fract((x-camera.x)/period),(pixel.y-camera.y)/worldHeight);
    float id=idAt(p);
    vec4 fill=texture2D(palette,vec2((id+.5)/256.,.5));
    vec3 c;
    if(dataMode>.5) c=mix(vec3(.612,.729,.788),fill.rgb,fill.a);
    else {
        vec3 original=texture2D(photo,p).rgb;
        vec3 land= tone(original,landTone,hues.x,landTint);
        vec3 sea= tone(original,oceanTone,hues.y,oceanTint);
        c=tone(mix(land,sea,texture2D(water,p).a),globalTone,hues.z,vec4(0.));
        c=mix(c,territory.rgb,fill.a);
    }
    float area=areaAt(p);
    bool focus=area>0.&&(abs(area-selected)<.1||abs(area-hovered)<.1);
    if(focus) c=mix(c,vec3(.86,.92,.94),.10);
    gl_FragColor=vec4(c,1.);
}`;

/** 選択線は海面合成の後に描き、境界の内外両側から強調対象を判定する。 */
export const compositeFragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D base, waves, areaIds, countryIds;
uniform vec2 viewport;
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
        // 画面上の太さとID画像の1テクセルの両方を下限にし、拡大時の線欠けを防ぐ。
        vec2 delta=max(vec2(.4/period,.4/worldHeight),vec2(1./8192.,1./4361.));
        float center=areaAt(p);
        float a=areaAt(p+vec2(delta.x,0.)), b=areaAt(p-vec2(delta.x,0.));
        float c=areaAt(p+vec2(0.,delta.y)), d=areaAt(p-vec2(0.,delta.y));
        float edge=max(max(step(.5,abs(center-a)),step(.5,abs(center-b))),max(step(.5,abs(center-c)),step(.5,abs(center-d))));
        float focus=max(focused(center),max(max(focused(a),focused(b)),max(focused(c),focused(d))));
        vec2 countryDelta=max(vec2(.25/period,.25/worldHeight),vec2(1./8192.,1./4361.));
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

export const spriteVertex = `
attribute vec2 position, texcoord;
attribute vec4 color;
attribute float ship;
uniform vec2 viewport;
varying vec2 atlasUV, screen;
varying vec4 tint;
varying float clipShip;
void main(){atlasUV=texcoord;tint=color;clipShip=ship;screen=position;gl_Position=vec4(position.x/viewport.x*2.-1.,1.-position.y/viewport.y*2.,0.,1.);}
`;
export const spriteFragment = `
precision mediump float;
varying vec2 atlasUV,screen;
varying vec4 tint;
varying float clipShip;
uniform sampler2D atlas,water;
uniform vec4 camera;
uniform float period,worldHeight,displayWidth;
void main(){
    float x=screen.x-camera.z;
    if(x<0.||x>displayWidth||screen.y<camera.y||screen.y>camera.y+worldHeight)discard;
    vec4 c=texture2D(atlas,atlasUV)*tint;
    if(clipShip>.5)c.a*=texture2D(water,vec2(fract((x-camera.x)/period),(screen.y-camera.y)/worldHeight)).a;
    gl_FragColor=vec4(c.rgb*c.a,c.a);
}`;
