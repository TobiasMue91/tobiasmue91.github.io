#!/usr/bin/env node
// Browser suite for tools/air_synth.html: the real sound engine, and the real hand model on a fake camera.
//
// test/air_synth.mjs checks the mapping from hands to notes in Node. This one runs what Node cannot:
//   sound   - a scripted 20 s performance (sweeps, jumps, dropouts, a hand leaving and returning) rendered through the
//             page's own engine with OfflineAudioContext. It promises no sample past full scale, the peak held under the
//             limiter's ceiling, loudness in a sensible range, and no clicks when notes change: rendered again with sine
//             waves (a saw has an edge every cycle), the largest second difference anywhere stays small - and a control
//             engine that jumps its envelope on every note is caught by the same measure.
//   camera  - getUserMedia returns a canvas's captureStream showing MediaPipe's own pointing_up.jpg, moved between the
//             top and the bottom of the picture. It promises that the hand model loads and finds the hand on nearly every
//             frame, that the note follows the hand up and down, and it prints what it measured: camera frame rate,
//             detection time per frame and the delay from the picture moving to the mapper seeing it.
//             Headless Chromium has no GPU, so these timings are a slow machine's, not a laptop's.
//
// Needs Playwright's Chromium. The camera part also needs network access to storage.googleapis.com (model and photo)
// and the MediaPipe package the page loads from jsDelivr, installed locally and served in its place:
//   npm i --no-save @mediapipe/tasks-vision@0.10.14      (or MEDIAPIPE=<folder of that package>)
// It skips what it cannot run.
//   node test/air_synth_browser.mjs [sound] [camera]      (npm run test:airsynth-browser)

import {createServer} from 'http';
import {readFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import {createRequire} from 'module';
import {execSync} from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const MP = process.env.MEDIAPIPE || join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const want = process.argv.slice(2), run = s => !want.length || want.includes(s);
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'ok    ' : 'FAIL  ') + m); if (!c) fails++; };
const info = m => console.log('      ' + m);

let chromium;
try { ({chromium} = await import('playwright')); } catch (e) {
    try { ({chromium} = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright')); } catch (e2) { console.log('skip  (no Playwright)'); process.exit(0); }
}
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json'};
const server = createServer((req, res) => {
    const f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream'}); res.end(readFileSync(f));
}).listen(0);
const port = server.address().port, URL_ = `http://localhost:${port}/tools/air_synth.html`;
const args = ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
let browser;
try { browser = await chromium.launch({args}); } catch (e) { browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args}); }

if (run('sound')) {
    const page = await browser.newPage();
    await page.goto(URL_);
    const measure = async opt => page.evaluate(async opt => {
        // a hand as the mapper takes it: palm at (x, y), camera space
        const hand = (x, y) => { const lm = []; for (let i = 0; i < 21; i++) lm.push({x: 1 - x, y, z: 0}); return [{landmarks: lm}]; };
        const script = [];
        for (let t = 0; t < 20000; t += 33.3) {
            let h;
            if (t < 4000) h = hand(0.5, 0.5 + 0.35 * Math.sin(t / 500));                 // sweep
            else if (t < 8000) h = hand((t % 1000) / 1000, (Math.floor(t / 400) % 2) ? 0.15 : 0.85);  // jumps, filter ramps
            else if (t < 9000) h = (t % 300 < 100) ? null : hand(0.7, 0.4);             // stutter dropouts
            else if (t < 11000) h = null;                                               // hand gone
            else h = hand(0.3 + 0.6 * Math.sin(t / 900) ** 2, 0.5 + 0.4 * Math.sin(t / 130));  // fast and wild
            script.push({t, hands: h});
        }
        const r = await window.renderOffline(script, 20.5, opt), b = r.buf, sr = b.sampleRate;
        let peak = 0, sum = 0, d2max = 0, d2at = 0;
        for (let c = 0; c < b.numberOfChannels; c++) {
            const d = b.getChannelData(c);
            for (let i = 2; i < d.length; i++) {
                const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i];
                const d2 = Math.abs(d[i] - 2 * d[i - 1] + d[i - 2]); if (d2 > d2max) { d2max = d2; d2at = i / sr; }
            }
        }
        const rms = Math.sqrt(sum / (b.length * b.numberOfChannels));
        return {peak, rmsDb: 20 * Math.log10(rms), d2max, d2at, notes: r.events.filter(e => e.type === 'on').length};
    }, opt);
    const saw = await measure({});
    info(`saw render: ${saw.notes} notes, peak ${saw.peak.toFixed(3)} (${(20 * Math.log10(saw.peak)).toFixed(1)} dBFS), RMS ${saw.rmsDb.toFixed(1)} dBFS`);
    ok(saw.notes > 40, 'the scripted performance plays notes');
    ok(saw.peak < 1, 'no sample reaches full scale');
    ok(saw.peak < 0.96, 'the limiter holds the peak near its ceiling (-1 dBFS), with < 0.7 dB overshoot');
    ok(saw.rmsDb > -30 && saw.rmsDb < -10, 'loudness between -30 and -10 dBFS RMS');
    const sine = await measure({wave: 'sine'}), clicky = await measure({wave: 'sine', clicky: true});
    info(`largest second difference: sine engine ${sine.d2max.toFixed(4)} at ${sine.d2at.toFixed(2)} s, clicking control ${clicky.d2max.toFixed(4)} at ${clicky.d2at.toFixed(2)} s`);
    ok(sine.d2max < 0.03, 'no clicks: with sine waves no sample bends harder than the tones themselves do');
    ok(clicky.d2max > sine.d2max * 3, 'control: an envelope that jumps on each note is caught by the same measure');
    await page.close();
}

if (run('camera')) {
    let photo = null;
    if (!existsSync(join(MP, 'vision_bundle.mjs'))) console.log('skip  camera (run: npm i --no-save @mediapipe/tasks-vision@0.10.14)');
    else {
        try { const r = await fetch('https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg'); if (r.ok) photo = Buffer.from(await r.arrayBuffer()).toString('base64'); } catch (e) {}
        if (!photo) console.log('skip  camera (no network for the MediaPipe photo)');
    }
    if (photo) {
        const ctx = await browser.newContext({viewport: {width: 800, height: 600}});
        await ctx.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/, route => {
            const f = route.request().url().split(/tasks-vision@[^/]+\//)[1].split('?')[0];
            route.fulfill({body: readFileSync(join(MP, f)), contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', headers: {'access-control-allow-origin': '*'}});
        });
        await ctx.addInitScript(img => {
            window.__pos = 0.3;      // where the hand's centre is drawn, 0 top .. 1 bottom
            window.__moved = [];     // times the picture moved
            const c = document.createElement('canvas'); c.width = 640; c.height = 480;
            const g = c.getContext('2d'), im = new Image(); im.src = 'data:image/jpeg;base64,' + img;
            const paint = () => {
                g.fillStyle = '#d9d6d2'; g.fillRect(0, 0, 640, 480);
                if (im.complete) { const h = 260, w = h * im.width / im.height; g.drawImage(im, 320 - w / 2, window.__pos * 480 - h / 2, w, h); }
                requestAnimationFrame(paint);
            };
            paint();
            const stream = c.captureStream(30);
            navigator.mediaDevices.getUserMedia = async () => stream;
        }, photo);
        const page = await ctx.newPage();
        await page.goto(URL_ + '?stats' + (process.env.DELEGATE ? '&delegate=' + process.env.DELEGATE : ''));
        await page.click('#goCam');
        const loaded = await page.waitForFunction(() => document.getElementById('modeName').textContent === 'camera', null, {timeout: 90000}).then(() => true, () => false);
        ok(loaded, 'the hand model loads and the camera starts');
        if (loaded) {
            // let the page settle on a delegate (it times the GPU one and may swap it), then count
            const settled = Date.now();
            await page.waitForFunction(() => __air.stats.delegate === 'CPU' || (__air.stats.detMs.length > 8 && __air.stats.detMs.slice().sort((a, b) => a - b)[4] < 45), null, {timeout: 60000}).catch(() => {});
            info(`delegate settled after ${((Date.now() - settled) / 1000).toFixed(1)} s`);
            await page.waitForTimeout(1500);
            const s0 = await page.evaluate(() => ({f: __air.stats.frames, h: __air.stats.withHand}));
            await page.waitForTimeout(4000);
            const s1 = await page.evaluate(s0 => ({f: __air.stats.frames - s0.f, h: __air.stats.withHand - s0.h, note: __air.mapper.state.note}), s0);
            info(`still hand: found on ${s1.h} of ${s1.f} frames`);
            ok(s1.f > 10 && s1.h / s1.f > 0.9, 'the hand is found on more than 90% of frames');
            // move the picture down, and see how long until the mapper's (unpredicted) position follows
            const lags = [];
            const notes = [s1.note];
            for (let k = 0; k < 6; k++) {
                const to = k % 2 ? 0.3 : 0.7;
                const lag = await page.evaluate(to => new Promise(res => {
                    const key = window.__key || 'y', from = __air.mapper.state[key], t0 = performance.now(); window.__pos = to;
                    const mid = (from + to) / 2, down = to > from;
                    const poll = () => { const y = __air.mapper.state[key]; if (down ? y > mid : y < mid) res(performance.now() - t0); else if (performance.now() - t0 > 3000) res(-1); else setTimeout(poll, 2); };
                    poll();
                }), to);
                lags.push(lag);
                await page.waitForTimeout(1500);
                notes.push(await page.evaluate(() => __air.mapper.state.note));
            }
            const st = await page.evaluate(() => {
                const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
                return {fps: 1000 / med(__air.stats.interval), det: med(__air.stats.detMs), wait: med(__air.stats.waitMs), f: __air.stats.frames, h: __air.stats.withHand,
                    delegate: __air.stats.delegate, out: ((__air.ctx.baseLatency || 0) + (__air.ctx.outputLatency || 0)) * 1000, text: document.getElementById('stats').textContent};
            });
            info(`camera ${st.fps.toFixed(1)} fps, detection ${st.det.toFixed(1)} ms median, hand found on ${(100 * st.h / st.f).toFixed(1)}% of ${st.f} frames`);
            info(`picture moved -> mapper half way: ${lags.map(l => l.toFixed(0)).join(', ')} ms; grid wait median ${st.wait.toFixed(0)} ms; audio output ${st.out.toFixed(0)} ms`);
            info(`notes at the two heights: ${notes.join(' ')}`);
            ok(lags.every(l => l > 0), 'the mapper follows every move of the hand');
            ok(notes.slice(1).every((m, i) => m !== null && m !== notes[i]), 'and the note changes with each move between high and low');
            ok(notes.slice(1).every((m, i) => i % 2 === 0 ? m < notes[0] : m > notes[1]), 'low is lower than high, every time');
            if (!process.env.DELEGATE) ok(st.delegate === 'CPU' || st.det < 45, 'a slow GPU delegate is swapped for the CPU one (' + st.delegate + ', ' + st.det.toFixed(0) + ' ms)');
        }
        await ctx.close();
    }
}

await browser.close(); server.close();
console.log((fails ? fails + ' of ' : 'all ') + n + ' checks ' + (fails ? 'failed' : 'passed'));
process.exit(fails ? 1 : 0);
