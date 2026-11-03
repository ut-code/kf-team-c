export const staticFragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D photo, water, countryIds, areaIds, palette, invasion;
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
    float area=areaAt(p);
    vec4 fill=texture2D(palette,vec2((area+.5)/256.,.5));
    vec3 c;
    if(dataMode>.5) c=vec3(.15,.19,.22);
    else {
        vec3 original=texture2D(photo,p).rgb;
        vec3 land= tone(original,landTone,hues.x,landTint);
        vec3 sea= tone(original,oceanTone,hues.y,oceanTint);
        c=tone(mix(land,sea,texture2D(water,p).a),globalTone,hues.z,vec4(0.));

    }
    if(area>0.) {
        float adoption=(fill.r*65280.+fill.g*255.)/65535.;
        float dependency=(fill.b*65280.+fill.a*255.)/65535.;
        vec2 encoded=texture2D(invasion,p).rg;
        float rank=(encoded.r*65280.+encoded.g*255.)/65535.;
        float land=1.-texture2D(water,p).a;
        float blue=(1.-step(adoption,rank))*step(.00001,adoption)*land;
        float red=(1.-step(dependency,rank))*step(.00001,dependency)*land;
        // 模様は画面ではなく地理座標に固定し、移動・拡大でも領域を維持する。
        float hatch=step(.65,fract((p.x*8192.+p.y*4361.)/13.));
        c=mix(c,vec3(.12,.48,.65),blue*.66);
        c=mix(c,mix(vec3(.80,.08,.16),vec3(1.,.32,.36),hatch*.40),red*.88);
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
