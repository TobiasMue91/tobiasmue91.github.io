#!/usr/bin/env node
// Camera suite for games/push_mine.html: the real MediaPipe models on a fake camera.
//
// test/push_mine.mjs checks the rep detector on synthetic signals; this one checks that the signals the real models
// produce are the ones it was written for. A canvas stands in for the camera (getUserMedia returns its captureStream)
// and shows a photo - MediaPipe's own pose.jpg for "in front", portrait.jpg for "below you" - moved down, or scaled up,
// as the body goes down. For each position it promises: the tracker finds the body, a still plank calibrates the top
// in a few seconds although the face detector's box wobbles by several percent on a still face (the bug players saw
// as a shaking ring and a ten-second hold), and every slow push-up after that counts exactly once.
//
// Needs Playwright's Chromium, network access to storage.googleapis.com (models and photos), and the MediaPipe
// package the page loads from jsDelivr, installed locally and served in its place:
//   npm i --no-save @mediapipe/tasks-vision@0.10.14
// (or install it anywhere and point MEDIAPIPE at its folder, if the repo's own install is too heavy)
//   node test/push_mine_camera.mjs          (npm run test:pushmine-camera)
// Headless Chromium runs the trackers at about 10 frames a second, so the suite takes a minute or two.

import {createServer} from 'http';
import {readFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import {createRequire} from 'module';
import {execSync} from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const MP = process.env.MEDIAPIPE || join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'ok    ' : 'FAIL  ') + m); if (!c) fails++; };
const skip = m => { console.log('  skip  (' + m + ')'); process.exit(0); };

let chromium;
try { ({chromium} = await import('playwright')); } catch (e) {
    try { ({chromium} = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright')); } catch (e2) { skip('no Playwright'); }
}
if (!existsSync(join(MP, 'vision_bundle.mjs'))) skip('run: npm i --no-save @mediapipe/tasks-vision@0.10.14');
const photo = async f => { const r = await fetch('https://storage.googleapis.com/mediapipe-assets/' + f); if (!r.ok) throw new Error(r.status); return Buffer.from(await r.arrayBuffer()).toString('base64'); };
let photos;
try { photos = {front: await photo('pose.jpg'), below: await photo('portrait.jpg')}; } catch (e) { skip('no network for the MediaPipe photos'); }

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css'};
const server = createServer((req, res) => {
    const f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream'}); res.end(readFileSync(f));
}).listen(0);
const port = server.address().port;

let browser;
try { browser = await chromium.launch({args: ['--use-fake-ui-for-media-stream']}); }
catch (e) { browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-ui-for-media-stream']}); }

async function run(mode, reps) {
    const ctx = await browser.newContext({viewport: {width: 420, height: 860}});
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/, (route, req) => {
        const f = req.url().split(/tasks-vision@[^/]+\//)[1].split('?')[0];
        route.fulfill({body: readFileSync(join(MP, f)), contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', headers: {'access-control-allow-origin': '*'}});
    });
    await ctx.addInitScript(([img, mode]) => {
        window.__p = 0;   // 0 at the top of a push-up, 1 at the bottom
        const c = document.createElement('canvas'); c.width = 640; c.height = 480;
        const g = c.getContext('2d'), im = new Image(); im.src = 'data:image/jpeg;base64,' + img;
        (function draw() {
            g.fillStyle = '#333'; g.fillRect(0, 0, 640, 480);
            if (im.complete) {
                if (mode === 'front') { const h = 432, w = h * im.width / im.height; g.drawImage(im, 320 - w / 2, -40 + window.__p * 90, w, h); }
                else { const k = 0.55 + window.__p * 0.45, h = 480 * k * 1.4, w = h * im.width / im.height; g.drawImage(im, 320 - w / 2, 240 - h / 2, w, h); }
            }
            requestAnimationFrame(draw);
        })();
        navigator.mediaDevices.getUserMedia = async () => c.captureStream(30);
    }, [photos[mode], mode]);
    const p = await ctx.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(`http://localhost:${port}/games/push_mine.html`);
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
    await p.click('#bStart'); await p.click(`[data-mode="${mode}"]`);
    const st = () => p.evaluate(() => { const D = PM.game.det; return D && {cal: D.cal, seen: D.v !== null, reps: PM.game.set.reps}; });
    let t0 = Date.now(), seen = null, held = null;
    while (Date.now() - t0 < 60000) {
        const s = await st();
        if (s && s.seen && seen === null) seen = Date.now();
        if (s && s.cal !== 'hold') { held = Date.now(); break; }
        await p.waitForTimeout(100);
    }
    ok(seen !== null, `${mode}: the tracker finds the body`);
    ok(held !== null && (held - seen) / 1000 < 8, `${mode}: a still plank sets the top ${held ? ((held - seen) / 1000).toFixed(1) + ' s after it is first seen' : 'never'}`);
    const glide = async (to, ms) => { const from = await p.evaluate(() => window.__p), k = Math.round(ms / 50); for (let i = 1; i <= k; i++) { await p.evaluate(v => { window.__p = v; }, from + (to - from) * i / k); await p.waitForTimeout(50); } };
    for (let r = 0; r < reps; r++) { await glide(1, 1800); await p.waitForTimeout(600); await glide(0, 1800); await p.waitForTimeout(1500); }
    const s = await st();
    ok(s.reps === reps, `${mode}: ${reps} slow push-ups count ${s.reps}`);
    ok(!errors.length, `${mode}: no page errors ${errors.join('; ')}`);
    await ctx.close();
}

try { await run('front', 3); await run('below', 3); }
finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} of ${n} failed` : `all ${n} passed`);
process.exit(fails ? 1 : 0);
