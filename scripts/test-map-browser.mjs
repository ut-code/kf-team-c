// Start npm run dev first. MAP_TEST_URL and CHROME_PATH may override the defaults.
import assert from 'node:assert/strict';
import { browser } from './map-browser.mjs';

console.log('Launching isolated Chrome');
const b = await browser();
try {
    await b.page('Page.addScriptToEvaluateOnNewDocument', {
        source: `(() => {
        const locations = new WeakMap(), programs = new WeakMap();
        const proto = WebGLRenderingContext.prototype;
        const getLocation = proto.getUniformLocation;
        proto.getUniformLocation = function(program, name) {
            const result = getLocation.call(this, program, name);
            if(result) locations.set(result, {program,name});
            return result;
        };
        for(const method of ['uniform1f','uniform2f','uniform4f']) {
            const original = proto[method];
            proto[method] = function(location, ...values) {
                const info = locations.get(location);
                if(info) {
                    const state = programs.get(info.program) || {};
                    state[info.name] = values;
                    programs.set(info.program, state);
                }
                return original.call(this,location,...values);
            };
        }
        const draw = proto.drawArrays;
        proto.drawArrays = function(...args) {
            const result = draw.apply(this,args);
            if(this.getParameter(this.FRAMEBUFFER_BINDING) === null) {
                const state = programs.get(this.getParameter(this.CURRENT_PROGRAM));
                if(state?.camera) window.__paintedMap = structuredClone(state);
            }
            return result;
        };
        const raf = window.requestAnimationFrame.bind(window);
        const cancel = window.cancelAnimationFrame.bind(window);
        const held = new Map();
        let nextId = -1;
        window.requestAnimationFrame = callback => {
            if(!window.__holdFrames) return raf(callback);
            const id = nextId--;
            held.set(id,callback);
            return id;
        };
        window.cancelAnimationFrame = id => { held.delete(id); cancel(id); };
        window.__releaseFrames = () => {
            window.__holdFrames = false;
            for(const callback of held.values()) raf(callback);
            held.clear();
        };
    })()`,
    });
    await b.page('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1.25,
        mobile: false,
    });
    await b.page('Page.navigate', { url: process.env.MAP_TEST_URL || 'http://127.0.0.1:5173' });
    await b.waitFor(
        `document.querySelector('[aria-label^="世界地図"]')?.getAttribute('aria-busy') === 'false'`,
    );
    await b.evaluate(`(async () => {
        const { useGameStore } = await import('/src/state/gameStore.ts');
        const { ENCOUNTERS } = await import('/src/game/society/system.ts');
        const { AREAS } = await import('/src/game/data.ts');
        window.__locations = Object.fromEntries(ENCOUNTERS.map(e=>[e.id,e.location || AREAS.find(a=>a.id===e.areaId)]));
        const game = useGameStore.getState().game;
        useGameStore.setState({game:{...game,speed:0,encounters:ENCOUNTERS.slice(0,8).map(e=>({id:e.id,status:'pending',openedMonth:0,deadline:30,messages:[]}))}});
    })()`);
    await b.waitFor(`document.querySelectorAll('.map-encounter-marker').length > 0`);
    const settle = () =>
        b.evaluate(
            'new Promise(resolve => requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
        );
    await settle();
    // Compare the rendered DOM tip to the uniforms actually submitted to WebGL.
    // This deliberately does not call screenPoint or read the requested camera store.
    const alignment = () =>
        b.evaluate(`(() => {
        const s=window.__paintedMap;
        const [cx,cy,left]=s.camera, period=s.period[0], height=s.worldHeight[0];
        const north=Math.log(Math.tan(Math.PI/4+75*Math.PI/360));
        const south=Math.log(Math.tan(Math.PI/4-60*Math.PI/360));
        return [...document.querySelectorAll('.map-encounter-marker')].map(marker=>{
            const geo=window.__locations[marker.dataset.encounterId];
            const u=(geo.longitude+180)/360;
            const v=(north-Math.log(Math.tan(Math.PI/4+geo.latitude*Math.PI/360)))/(north-south);
            const x=left+((u*period+cx)%period+period)%period;
            const y=v*height+cy;
            const rect=marker.getBoundingClientRect();
            return {id:marker.dataset.encounterId,error:Math.hypot(rect.left+rect.width/2-x,rect.bottom-y)};
        });
    })()`);
    let maxError = 0,
        checks = 0;
    async function check(label) {
        const results = await alignment();
        assert.ok(results.length, `${label}: no visible markers`);
        for (const result of results) {
            maxError = Math.max(maxError, result.error);
            checks++;
            assert.ok(
                result.error < 0.15,
                `${label}: ${result.id} is ${result.error.toFixed(2)}px away from the painted map`,
            );
        }
    }
    await check('initial');
    console.log('Initial map aligned');
    assert.equal(
        await b.evaluate(`document.querySelectorAll('.map-encounter-marker > svg').length`),
        0,
    );
    assert.equal(
        await b.evaluate(
            `[...document.querySelectorAll('.map-encounter-marker img')].every(e=>e.complete && e.naturalWidth>0)`,
        ),
        true,
    );
    assert.equal(
        await b.evaluate(
            `document.querySelector('.map-encounter-marker.chat img').src.endsWith('/chat-marker.svg')`,
        ),
        true,
    );
    await b.screenshot('map-desktop');

    async function drag(dx, dy, label) {
        await b.page('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: 650,
            y: 600,
            button: 'left',
            clickCount: 1,
        });
        await b.evaluate('window.__holdFrames=true');
        for (let step = 1; step <= 4; step++) {
            await b.page('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: 650 + (dx * step) / 4,
                y: 600 + (dy * step) / 4,
                buttons: 1,
            });
            // Let React process the input while the canvas frame is deliberately delayed.
            await b.evaluate('new Promise(resolve=>setTimeout(resolve,0))');
            await check(`${label} delayed frame ${step}`);
        }
        await b.evaluate('window.__releaseFrames()');
        await settle();
        await check(`${label} presented`);
        await b.page('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: 650 + dx,
            y: 600 + dy,
            button: 'left',
            clickCount: 1,
        });
    }
    await drag(180, 0, 'horizontal wrap');
    console.log('Delayed-frame horizontal drag aligned');
    await b.page('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: 720,
        y: 450,
        deltaY: -600,
        deltaX: 0,
    });
    await settle();
    await check('zoom');
    await drag(120, 144, 'diagonal zoomed');
    await b.screenshot('map-zoomed');
    await b.page('Emulation.setDeviceMetricsOverride', {
        width: 760,
        height: 900,
        deviceScaleFactor: 2,
        mobile: false,
    });
    await settle();
    await check('resize DPR2');
    await b.screenshot('map-narrow');
    const chat = await b.evaluate(
        `(() => {const e=document.querySelector('.map-encounter-marker.chat');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.4};})()`,
    );
    assert.ok(chat, 'chat marker should be visible');
    await b.page('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        ...chat,
        button: 'left',
        clickCount: 1,
    });
    await b.page('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        ...chat,
        button: 'left',
        clickCount: 1,
    });
    await b.waitFor(`!!document.querySelector('dialog[open]')`);
    const errors = b.events.filter(
        (e) =>
            e.method === 'Runtime.exceptionThrown' ||
            (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'),
    );
    assert.deepEqual(errors, []);
    console.log(
        `Map browser checks passed: ${checks} marker positions; max error ${maxError.toFixed(4)} CSS px. Delayed frames, wrap, zoom, diagonal pan, resize, DPR, assets and chat click verified.`,
    );
} finally {
    await b.close();
}
