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
//   export  - Rec in mouse mode for a few seconds saves a video, and its sound track decodes to more than silence.
//   hagrid  - 24 real hands from HaGRID's gesture sheet (fetched at test time from raw.githubusercontent.com, CC BY-SA 4.0):
//             the OK sign and the grip at several sizes and mirrored are pinches, no other hand is, and the poses read right.
//   node test/air_synth_browser.mjs [sound] [camera] [hagrid] [export]      (npm run test:airsynth-browser)

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
        // a hand as the mapper takes it: palm at (x, y), pose given (as the pointer gives it)
        const hand = (x, y, pose = 'open') => { const lm = []; for (let i = 0; i < 21; i++) lm.push({x: 1 - x, y, z: 0}); return [{landmarks: lm, palm: {x: 1 - x, y}, pose}]; };
        const script = [];
        for (let t = 0; t < 30000; t += 33.3) {
            let h, f = {t};
            if (t < 4000) h = hand(0.5, 0.5 + 0.35 * Math.sin(t / 500));                 // sweep
            else if (t < 8000) h = hand((t % 1000) / 1000, (Math.floor(t / 400) % 2) ? 0.15 : 0.85);  // jumps, filter ramps
            else if (t < 9000) h = (t % 300 < 100) ? null : hand(0.7, 0.4);             // stutter dropouts
            else if (t < 10500) h = null;                                               // hand gone
            else if (t < 16000) h = hand(0.3 + 0.6 * Math.sin(t / 900) ** 2, 0.5 + 0.4 * Math.sin(t / 130), t > 13000 ? 'two' : 'open');  // wild, then arpeggio
            else if (t < 21000) h = hand(0.5, 0.5, 'fist');                             // break
            else h = hand(0.6 + 0.3 * Math.sin(t / 300), 0.5 + 0.4 * Math.sin(t / 210)); // the drop
            if (Math.abs(t - 11000) < 17 || Math.abs(t - 23000) < 17) f.chord = true;
            if (Math.abs(t - 2000) < 17) f.loop = true;
            f.hands = h; script.push(f);
        }
        const r = await window.renderOffline(script, 30.5, opt), b = r.buf, sr = b.sampleRate;
        let peak = 0, sum = 0, d2max = 0, d2at = 0;
        for (let c = 0; c < b.numberOfChannels; c++) {
            const d = b.getChannelData(c);
            for (let i = 2; i < d.length; i++) {
                const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i];
                const d2 = Math.abs(d[i] - 2 * d[i - 1] + d[i - 2]); if (d2 > d2max) { d2max = d2; d2at = i / sr; }
            }
        }
        const rms = Math.sqrt(sum / (b.length * b.numberOfChannels));
        // loudness around the break and the drop: the hand opens at 21 s
        const win = (a, z) => { const d = b.getChannelData(0); let q = 0; const i0 = Math.floor(a * sr), i1 = Math.floor(z * sr); for (let i = i0; i < i1; i++) q += d[i] * d[i]; return 10 * Math.log10(q / (i1 - i0)); };
        const k = r.bands.findIndex((x, j) => j && x === '3' && r.bands[j - 1].endsWith('r')), dropS = k >= 0 ? script[k].t / 1000 : null;
        const drop = dropS ? {at: dropS, breakDb: win(19.5, 20.9), buildDb: win(dropS - 0.6, dropS), dropDb: win(dropS, dropS + 1.2)} : null;
        return {peak, rmsDb: 20 * Math.log10(rms), d2max, d2at, notes: r.events.filter(e => e.type === 'on').length, bands: [...new Set(r.bands)].join(' '), drop};
    }, opt);
    const names = await page.evaluate(() => SOUNDS.map(s => s.name));
    for (let k = 0; k < names.length; k++) {
        const r = await measure({sound: k, scene: k});
        info(`${names[k]}: ${r.notes} notes, peak ${r.peak.toFixed(3)} (${(20 * Math.log10(r.peak)).toFixed(1)} dBFS), RMS ${r.rmsDb.toFixed(1)} dBFS; band went ${r.bands}`);
        ok(r.notes > 60, names[k] + ': the scripted performance plays');
        ok(r.peak < 0.96, names[k] + ': the limiter holds the peak near its ceiling (-1 dBFS), nothing reaches full scale');
        ok(r.rmsDb > -30 && r.rmsDb < -10, names[k] + ': loudness between -30 and -10 dBFS RMS');
        if (k === 0) ok(/b/.test(r.bands) && /3|2/.test(r.bands), 'the band went up, broke on the fist and came back');
        const d = r.drop;
        if (d) info(`${names[k]}: hand opens at 21.0 s, drop at ${d.at.toFixed(2)} s; break ${d.breakDb.toFixed(1)} dB, last beat of the build ${d.buildDb.toFixed(1)} dB, first second of the drop ${d.dropDb.toFixed(1)} dB`);
        ok(d && d.buildDb > d.breakDb + 3, names[k] + ': the build is clearly louder than the break');
        ok(d && d.dropDb > d.breakDb + 6, names[k] + ': the drop is at least 6 dB above the break');
    }
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
        // MediaPipe's own photos: an open hand (the right one of right_hands.jpg), a fist, two fingers, one finger
        try {
            photo = {};
            for (const f of ['pointing_up', 'fist', 'victory', 'right_hands']) {
                const r = await fetch('https://storage.googleapis.com/mediapipe-assets/' + f + '.jpg');
                if (!r.ok) throw new Error(r.status);
                photo[f] = Buffer.from(await r.arrayBuffer()).toString('base64');
            }
        } catch (e) { photo = null; }
        if (!photo) console.log('skip  camera (no network for the MediaPipe photo)');
    }
    if (photo) {
        const ctx = await browser.newContext({viewport: {width: 800, height: 600}});
        await ctx.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/, route => {
            const f = route.request().url().split(/tasks-vision@[^/]+\//)[1].split('?')[0];
            route.fulfill({body: readFileSync(join(MP, f)), contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', headers: {'access-control-allow-origin': '*'}});
        });
        await ctx.addInitScript(imgs => {
            window.__pos = 0.3;      // where the hand's centre is drawn, 0 top .. 1 bottom
            window.__img = 'pointing_up';
            const c = document.createElement('canvas'); c.width = 640; c.height = 480;
            const g = c.getContext('2d'), ims = {};
            for (const k in imgs) { ims[k] = new Image(); ims[k].src = 'data:image/jpeg;base64,' + imgs[k]; }
            const paint = () => {
                const im = ims[window.__img];
                g.fillStyle = window.__img === 'right_hands' ? '#fff' : '#d9d6d2'; g.fillRect(0, 0, 640, 480);
                if (im.complete) {
                    // right_hands.jpg holds two hands: show only the open one on the right
                    const sx = window.__img === 'right_hands' ? im.width * 0.52 : 0, sw = im.width - sx;
                    const h = 260, w = h * sw / im.height; g.drawImage(im, sx, 0, sw, im.height, 320 - w / 2, window.__pos * 480 - h / 2, w, h);
                }
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
            // poses, read by the real model off real photos
            const want = {right_hands: ['open', 'melody'], fist: ['fist', 'rest'], victory: ['two', 'arp'], pointing_up: ['one', 'melody']};
            for (const [img, [pose, md]] of Object.entries(want)) {
                await page.evaluate(img => { window.__img = img; window.__pos = 0.5; }, img);
                await page.waitForTimeout(2500);
                const got = await page.evaluate(() => {
                    const s = __air.mapper.state, h = __air.hands && __air.hands[0];
                    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), pl = h ? d(h.landmarks[0], h.landmarks[9]) : 1;
                    return {pose: s.pose, mode: s.mode, present: s.present, pinch: s.pinchRatio, pinched: s.pinch,
                        tips: h ? [8, 12, 16, 20].map(i => +(d(h.landmarks[i], h.landmarks[0]) / pl).toFixed(2)) : null};
                });
                info(`${img}.jpg: pose ${got.pose}, mode ${got.mode}; fingertips from the wrist ${got.tips} palm lengths (curled < 1.1); thumb to index ${got.pinch && got.pinch.toFixed(2)} (pinch < 0.42)`);
                ok(!got.pinched, img + '.jpg is not taken for a pinch');
                ok(got.present && got.pose === pose && got.mode === md, img + '.jpg reads as ' + pose + ' and plays ' + md);
            }
            await page.evaluate(() => { window.__img = 'fist'; });
            await page.waitForTimeout(5000);
            ok(await page.evaluate(() => __air.session.band.mode === 'break'), 'a fist held in front of the camera breaks the band');
            await page.evaluate(() => { window.__img = 'right_hands'; });
            await page.waitForTimeout(4500);
            ok(await page.evaluate(() => __air.session.band.mode === 'normal' && __air.session.band.level >= 2), 'and opening it drops it back in');
            ok(notes.slice(1).every((m, i) => m !== null && m !== notes[i]), 'and the note changes with each move between high and low');
            ok(notes.slice(1).every((m, i) => i % 2 === 0 ? m < notes[0] : m > notes[1]), 'low is lower than high, every time');
            if (!process.env.DELEGATE) ok(st.delegate === 'CPU' || st.det < 45, 'a slow GPU delegate is swapped for the CPU one (' + st.delegate + ', ' + st.det.toFixed(0) + ' ms)');
        }
        await ctx.close();
    }
}

if (run('hagrid')) {
    // HaGRID's gesture sheet (CC BY-SA 4.0, github.com/hukenovs/hagrid): 24 real hands, cut out and shown to the real model.
    // Fetched at test time, never committed.
    let sheet = null;
    if (!existsSync(join(MP, 'vision_bundle.mjs'))) console.log('skip  hagrid (run: npm i --no-save @mediapipe/tasks-vision@0.10.14)');
    else {
        try { const r = await fetch('https://raw.githubusercontent.com/hukenovs/hagrid/master/images/gestures.png'); if (r.ok) sheet = Buffer.from(await r.arrayBuffer()).toString('base64'); } catch (e) {}
        if (!sheet) console.log('skip  hagrid (no network for raw.githubusercontent.com)');
    }
    if (sheet) {
        const ctx = await browser.newContext();
        await ctx.route(/\/__mp\/(.*)/, route => { const f = route.request().url().split('/__mp/')[1]; route.fulfill({body: readFileSync(join(MP, f)), contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'}); });
        const page = await ctx.newPage();
        await page.goto(URL_);
        const res = await page.evaluate(async sheet => {
            const lib = await import('/__mp/vision_bundle.mjs'), files = await lib.FilesetResolver.forVisionTasks('/__mp/wasm');
            const hl = await lib.HandLandmarker.createFromOptions(files, {baseOptions: {modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU'}, runningMode: 'IMAGE', numHands: 1});
            const im = new Image(); im.src = 'data:image/png;base64,' + sheet; await im.decode();
            const S = im.width / 2000;   // the sheet's grid, in the 2000 px wide layout
            const rows = [[70, ['call', 'dislike', 'fist', 'four', 'like', 'mute', 'grabbing', 'grip']], [340, ['ok', 'one', 'palm', 'peace', 'peace_inv', 'rock', 'point', 'pinkie']], [610, ['stop', 'stop_inv', 'three', 'three2', 'two_up', 'two_up_inv', 'mid_finger', 'three3']]];
            const xs = [127, 347, 567, 787, 1007, 1227, 1447, 1667], out = {};
            const shot = (x0, y0, size, mirror) => {
                const c = document.createElement('canvas'); c.width = 720; c.height = 640; const g = c.getContext('2d');
                g.fillStyle = '#aaa'; g.fillRect(0, 0, 720, 640);
                if (mirror) { g.translate(720, 0); g.scale(-1, 1); }
                g.drawImage(im, (x0 + 1) * S, (y0 + 1) * S, 204 * S, 203 * S, (720 - size) / 2, (640 - size) / 2, size, size);
                return c;
            };
            const judge = c => {
                const lm = hl.detect(c).landmarks[0]; if (!lm) return null;
                const g = Core.gestures(); let st, fired = 0;
                for (let t = 0; t < 900; t += 33) { st = g.step(lm, t); if (st.pinchOn) fired++; }
                return {pose: st.pose, pinch: fired > 0, ratio: Core.pinchRatio(lm)};
            };
            for (const [y0, names] of rows) names.forEach((n, k) => {
                out[n] = judge(shot(xs[k], y0, 480, false));
                if (n === 'ok' || n === 'grip') [300, 400].forEach(sz => [false, true].forEach(m => { out[n + '@' + sz + (m ? 'm' : '')] = judge(shot(xs[k], y0, sz, m)); }));
            });
            return out;
        }, sheet);
        const pinches = Object.entries(res).filter(([k]) => /^(ok|grip)/.test(k)), others = Object.entries(res).filter(([k]) => !/^(ok|grip)/.test(k));
        info('pinches: ' + pinches.map(([k, v]) => k + (v ? ' ' + v.ratio.toFixed(2) + (v.pinch ? ' yes' : ' NO') : ' no hand')).join(', '));
        info('the rest: ' + others.map(([k, v]) => k + (v ? ' ' + v.pose + (v.pinch ? ' PINCH' : '') : ' no hand')).join(', '));
        const found = pinches.filter(([, v]) => v), hit = found.filter(([, v]) => v.pinch);
        ok(found.length >= 8 && hit.length >= found.length - 1, 'real pinches (OK sign, grip; sizes, mirrored) are pinches: ' + hit.length + ' of ' + found.length);
        ok(others.every(([, v]) => !v || !v.pinch), 'none of the ' + others.length + ' other real hands is taken for a pinch');
        const want = {fist: 'fist', dislike: 'fist', like: 'fist', palm: 'open', four: 'open', stop: 'open', stop_inv: 'open', one: 'one', peace: 'two', peace_inv: 'two', two_up: 'two', three2: 'two'};
        const wrong = Object.entries(want).filter(([k, p]) => !res[k] || res[k].pose !== p);
        ok(!wrong.length, 'and their poses read as they look (' + (wrong.map(([k]) => k + ' ' + (res[k] && res[k].pose)).join(', ') || 'all ' + Object.keys(want).length) + ')');
        await ctx.close();
    }
}

if (run('export')) {
    const page = await browser.newPage({viewport: {width: 640, height: 480}});
    await page.goto(URL_);
    await page.click('#goMouse');
    await page.click('#recBtn');
    await page.mouse.move(320, 240); await page.mouse.down();
    for (let k = 0; k < 60; k++) { await page.mouse.move(200 + 4 * k, 240 + 150 * Math.sin(k / 5)); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.click('#recBtn');
    const r = await page.waitForFunction(() => window.__lastRecording, null, {timeout: 10000}).then(() => page.evaluate(async () => {
        const b = window.__lastRecording, ctx = new AudioContext();
        let audio = null;
        try { const buf = await ctx.decodeAudioData(await b.arrayBuffer()); const d = buf.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; audio = {sec: buf.duration, rms: Math.sqrt(s / d.length)}; } catch (e) { audio = {err: String(e)}; }
        return {size: b.size, type: b.type, audio};
    }), () => null);
    ok(r && r.size > 20000, 'Rec saves a video file (' + (r ? (r.size / 1024).toFixed(0) + ' KB, ' + r.type : 'none') + ')');
    ok(r && r.audio && r.audio.rms > 0.005, 'with the sound in it (' + (r && JSON.stringify(r.audio)) + ')');
    await page.close();
}

await browser.close(); server.close();
console.log((fails ? fails + ' of ' : 'all ') + n + ' checks ' + (fails ? 'failed' : 'passed'));
process.exit(fails ? 1 : 0);
