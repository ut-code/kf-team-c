/**
 * PSRD noiseを海面用に経度方向だけ周期化。式と係数は著者の実装に従う。
 * https://github.com/stegu/psrdnoise/blob/main/src/psrdnoise2.glsl
 *
 * Copyright (c) 2021 Stefan Gustavson and Ian McEwan.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */
export const psrdNoise = `
float oceanNoise(vec2 p, float repeat, float phase, out vec2 gradient) {
    vec2 lattice=vec2(p.x+p.y*.5,p.y);
    vec2 i=floor(lattice), f=fract(lattice);
    float corner=step(f.y,f.x);
    vec2 offset=vec2(corner,1.-corner);
    vec2 v0=vec2(i.x-i.y*.5,i.y);
    vec2 v1=v0+vec2(offset.x-offset.y*.5,offset.y);
    vec2 v2=v0+vec2(.5,1.);
    vec2 x0=p-v0, x1=p-v1, x2=p-v2;
    vec3 wrappedX=mod(vec3(v0.x,v1.x,v2.x),repeat);
    vec3 iy=vec3(v0.y,v1.y,v2.y);
    vec3 ix=floor(wrappedX+.5*iy+.5);
    vec3 hash=mod(ix,289.);
    hash=mod((hash*51.+2.)*hash+iy,289.);
    hash=mod((hash*34.+10.)*hash,289.);
    vec3 angle=hash*.07482+phase;
    vec3 gx=cos(angle), gy=sin(angle);
    vec2 g0=vec2(gx.x,gy.x), g1=vec2(gx.y,gy.y), g2=vec2(gx.z,gy.z);
    vec3 w=max(.8-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.);
    vec3 w2=w*w, w3=w2*w, w4=w2*w2;
    vec3 ramp=vec3(dot(g0,x0),dot(g1,x1),dot(g2,x2));
    vec3 dw=-8.*w3*ramp;
    gradient=10.9*(w4.x*g0+dw.x*x0+w4.y*g1+dw.y*x1+w4.z*g2+dw.z*x2);
    return 10.9*dot(w4,ramp);
}
`;
