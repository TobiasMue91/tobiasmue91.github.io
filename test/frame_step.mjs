#!/usr/bin/env node
// Test suite for frame stepping in tools/video_frame_extractor.html and
// tools/video_thumbnail_extractor.html.
//
// Both pages exist to get one exact frame out of a video: step to it, grab it, and know which
// one it was. Browsers report no frame rate and round the time a frame starts at (to the
// millisecond in WebM), so none of that shows on the page - a step that stays put or skips a
// frame looks like every other step, and a grab labelled with the wrong frame looks like a grab
// labelled with the right one. The suite makes clips whose every frame carries its own number
// in blocks a pixel read can decode, loads them into the real pages in headless Chromium,
// presses the buttons, and reads back which frame is on screen and in every grab.
//
//   node test/frame_step.mjs                          # everything
//   node test/frame_step.mjs step batch               # named suites only
//   node test/frame_step.mjs --only=frame             # one page: frame or thumbnail
//   node test/frame_step.mjs --frame-page=old.html --thumbnail-page=old2.html
//
// Suites: step, grab, slider, batch, vfr. Needs Playwright's Chromium (a dev dependency;
// CHROMIUM_PATH picks another build) and, for all but vfr, an ffmpeg that writes VP8 WebM - the
// one Playwright installs beside its browsers will do, FFMPEG names another. No server: the
// pages are served from the checkout by request interception, and the clips are made at run
// time, so nothing binary is committed.

import {readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import {tmpdir} from 'os';
import {spawn, spawnSync} from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const arg = name => (args.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || null;
const EXE = process.env.CHROMIUM_PATH || undefined;
const ALL = ['step', 'grab', 'slider', 'batch', 'vfr'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const ORIGIN = 'http://frames.test';

let failures = 0, passes = 0, skips = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + String(detail).replace(/\n/g, '\n          ') : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const skip = (what, why) => {
    skips++;
    console.log(`  skip  ${what}  (${why})`);
};
const section = name => console.log(`\n=== ${name} ===`);
const list = a => a.length > 40 ? a.slice(0, 40).join(',') + ',…' : a.join(',');

// How each page is driven. `label` reads the frame number the page shows and the count it gives
// (1-based), `card` the frame number and start time a grab is labelled with; either is empty
// where the page shows no number, as for a video whose frames are not on a regular grid.
const PAGES = {
    frame: {
        file: arg('frame-page') || join(ROOT, 'tools', 'video_frame_extractor.html'),
        path: 'tools/video_frame_extractor.html',
        input: '#videoInput', next: '#nextFrameBtn', prev: '#prevFrameBtn', grab: '#extractBtn',
        cards: '.frame-item', cardImg: '.frame-item img', cardLabel: '.frame-info',
        status: '#frameInfo', slider: '#frameSlider',
        batch: {input: '#intervalInput', button: '#batchExtractBtn', every: 0.5, inclusive: true},
        label: s => (s.match(/frame (\d+) of (\d+)/) || []).slice(1),
        card: s => (s.match(/Frame (\d+) at (\d+):(\d+\.\d+)/) || []).slice(1)
    },
    thumbnail: {
        file: arg('thumbnail-page') || join(ROOT, 'tools', 'video_thumbnail_extractor.html'),
        path: 'tools/video_thumbnail_extractor.html',
        input: '#fileInput', next: '#btnNextFrame', prev: '#btnPrevFrame', grab: '#btnCapture',
        cards: '.thumb-card', cardImg: '.thumb-card img', cardLabel: '.thumb-card .timestamp',
        status: '#timeDisplay', timeline: '#timeline',
        batch: {input: '#interval', button: '#btnAutoExtract', every: 1, inclusive: false},
        label: s => (s.match(/frame (\d+) of (\d+)/) || []).slice(1),
        card: s => {
            const m = s.match(/(\d+):(\d+\.\d+) · frame (\d+)/);
            return m ? [m[3], m[1], m[2]] : [];
        }
    }
};
const pages = arg('only') ? [arg('only')] : Object.keys(PAGES);

// ---------- clips ----------
// Every frame is 192x108 with its number in eleven black and white blocks along the top.
const W = 192, H = 108, BITS = 11;
const DRAW = `(g, n) => {
    g.fillStyle = '#333'; g.fillRect(0, 0, ${W}, ${H});
    for (let b = 0; b < ${BITS}; b++) { g.fillStyle = (n >> (${BITS - 1} - b)) & 1 ? '#fff' : '#000'; g.fillRect(6 + b * 16, 6, 13, 32) }
    g.fillStyle = '#ff0'; g.font = 'bold 40px sans-serif'; g.fillText(String(n), 8, 90)
}`;
// read the number back off anything drawable: the page's video, or a grab's <img>
const READ = `window.__read = el => {
    const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    const g = c.getContext('2d'); g.drawImage(el, 0, 0, ${W}, ${H});
    const d = g.getImageData(0, 0, ${W}, ${H}).data; let v = 0;
    for (let b = 0; b < ${BITS}; b++) v = v * 2 + (d[(22 * ${W} + 12 + b * 16) * 4] > 128 ? 1 : 0);
    return v
}`;

function findFfmpeg(chromiumPath) {
    if (process.env.FFMPEG) return process.env.FFMPEG;
    // Playwright keeps its ffmpeg next to its browsers: <registry>/ffmpeg-NNNN/ffmpeg-<os>
    for (let dir = dirname(chromiumPath), i = 0; i < 4; i++, dir = dirname(dir)) {
        if (!existsSync(dir)) continue;
        for (const d of readdirSync(dir).filter(d => /^ffmpeg-\d+$/.test(d))) {
            for (const f of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe']) if (existsSync(join(dir, d, f))) return join(dir, d, f);
        }
    }
    return spawnSync('ffmpeg', ['-version']).status === 0 ? 'ffmpeg' : null;
}

async function makeJpegs(browser, count) {
    const page = await browser.newPage();
    const b64 = await page.evaluate(async ([count, draw]) => {
        const c = document.createElement('canvas'); c.width = 192; c.height = 108;
        const g = c.getContext('2d'), paint = eval(draw), out = [];
        for (let n = 0; n < count; n++) {
            paint(g, n);
            const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let s = '';
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            out.push(btoa(s));
        }
        return out;
    }, [count, DRAW]);
    await page.close();
    return b64.map(s => Buffer.from(s, 'base64'));
}

function encode(ffmpeg, jpegs, rate, file, extra = []) {
    return new Promise((resolve, reject) => {
        const p = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', rate,
            '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '1M', '-g', '60', ...extra, file]);
        let err = '';
        p.stderr.on('data', d => err += d);
        p.on('close', code => code === 0 ? resolve(file) : reject(new Error(`ffmpeg: ${err}`)));
        p.stdin.on('error', () => {});
        for (const j of jpegs) p.stdin.write(j);
        p.stdin.end();
    });
}

// A screen recording in miniature: MediaRecorder, frames pushed by hand, and a file that does not
// say how long it is. `gaps` are the milliseconds between frames: uneven ones (short, held) like a
// screen recording, or an even 33 whose timestamps come out a little jittery, like a phone's.
async function record(browser, file, gaps) {
    const page = await browser.newPage();
    const b64 = await page.evaluate(async ([draw, gaps]) => {
        const c = document.createElement('canvas'); c.width = 192; c.height = 108;
        const g = c.getContext('2d'), paint = eval(draw);
        paint(g, 0);
        const stream = c.captureStream(0), track = stream.getVideoTracks()[0];
        const rec = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1e6});
        const chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.start();
        for (let n = 0; n < 72; n++) {
            paint(g, n);
            track.requestFrame();
            await new Promise(r => setTimeout(r, gaps[n % gaps.length]));
        }
        await new Promise(r => { rec.onstop = r; rec.stop() });
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
    }, [DRAW, gaps]);
    await page.close();
    writeFileSync(file, Buffer.from(b64, 'base64'));
    return file;
}

// What a plain <video> shows when sought to each of `times`, without the pages' help; with no
// times, every frame in the clip in the order they appear, found by seeking every 2 ms.
async function framesAt(browser, file, times = null) {
    const page = await browser.newPage();
    await page.goto(`${ORIGIN}/blank.html`);
    await page.evaluate(READ);
    await page.setInputFiles('#f', file);
    const seen = await page.evaluate(async times => {
        const v = document.querySelector('video');
        v.src = URL.createObjectURL(document.querySelector('#f').files[0]);
        await new Promise(r => v.addEventListener('loadeddata', r, {once: true}));
        if (!isFinite(v.duration)) await new Promise(r => {
            v.addEventListener('durationchange', r, {once: true});
            v.currentTime = 1e101
        });
        // done once the frame is presented, not just when the seek ends: under load 'seeked' can
        // come before the picture has changed
        const seek = t => new Promise(r => {
            let done = false;
            const end = () => done || (done = true, r());
            v.requestVideoFrameCallback(end);
            v.addEventListener('seeked', () => setTimeout(end, 1000), {once: true});
            v.currentTime = t
        });
        const out = [];
        if (times) {
            for (const t of times) {
                await seek(t);
                out.push(__read(v));
            }
            return out;
        }
        // Chromium occasionally shows an earlier frame for a moment while seeking forward through
        // a recording, so a frame counts once, where it first appears
        // (a recording's last frame starts at its duration, so that is sought too)
        for (let k = 0; k * 0.002 < v.duration + 0.002; k++) {
            await seek(Math.min(k * 0.002, v.duration));
            const n = __read(v);
            if (!out.includes(n)) out.push(n);
        }
        return out;
    }, times);
    await page.close();
    return seen;
}

// ---------- driving a page ----------
async function open(browser, name) {
    const P = PAGES[name];
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    page.on('pageerror', e => fail(`${name}: no script errors`, e.message));
    await page.addInitScript(() => {
        for (const ev of ['seeking', 'seeked']) document.addEventListener(ev, () => window.__seekAt = performance.now(), true);
    });
    await page.addInitScript(READ);
    return {page, P, name};
}

async function load(s, clip) {
    const {page, P} = s;
    await page.goto(`${ORIGIN}/${P.path}`);
    await page.setInputFiles(P.input, clip.file);
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    // the page counts the frames first; an older page has nothing to wait for
    await page.waitForFunction(([sel]) => /frame \d|variable frame rate/.test(document.querySelector(sel)?.textContent || ''), [P.status], {timeout: 8000}).catch(() => {});
    await settle(s, 150);
}

// Pages seek, and may seek again once they see where they landed; done is when nothing has
// sought for a while.
async function settle({page}, quiet = 90) {
    await page.waitForFunction(q => {
        const v = document.querySelector('video');
        return !v.seeking && performance.now() - (window.__seekAt || 0) > q;
    }, quiet, {polling: 15, timeout: 30000});
}

const shown = ({page}) => page.evaluate(() => __read(document.querySelector('video')));
const status = async s => s.P.label(await s.page.$eval(s.P.status, e => e.textContent).catch(() => ''));
async function press(s, button, times = 1, quiet) {
    for (let i = 0; i < times; i++) await s.page.click(s.P[button]);
    await settle(s, quiet);
}
// jump near a place in the clip the way a person would: the slider, or a click on the timeline
async function jump(s, fraction, frames) {
    const {page, P} = s;
    if (P.slider) {
        await page.$eval(P.slider, (el, v) => {
            el.value = v;
            el.dispatchEvent(new Event('input'))
        }, Math.round(fraction * (frames - 1)));
    } else {
        const box = await page.locator(P.timeline).boundingBox();
        await page.mouse.click(box.x + Math.max(1, Math.min(box.width - 1, fraction * box.width)), box.y + box.height / 2);
    }
    await settle(s, 200);
}
async function cards(s) {
    const {page, P} = s;
    return page.evaluate(async ([img, label]) => {
        const out = [];
        const labels = [...document.querySelectorAll(label)].map(e => e.textContent);
        for (const [i, el] of [...document.querySelectorAll(img)].entries()) {
            if (!el.complete) await new Promise(r => el.onload = r);
            out.push({n: __read(el), label: labels[i]});
        }
        return out;
    }, [P.cardImg, P.cardLabel]);
}

// ---------- suites ----------
async function stepSuite(ctx) {
    section('step: every press moves exactly one frame, in both directions');
    for (const name of pages) for (const clip of ctx.clips) {
        const s = await open(ctx.browser, name), what = `${name}, ${clip.name}`;
        await load(s, clip);
        check(await shown(s) === 0, `${what}: opens on the first frame`);
        const [num, of] = await status(s);
        check(+num === 1 && +of === clip.frames, `${what}: counts ${clip.frames} frames and says it is on frame 1`, `status says ${[num, of]}`);
        const fwd = [];
        for (let i = 0; i < 30; i++) {
            await press(s, 'next');
            fwd.push(await shown(s));
        }
        const moved = fwd.map((n, i) => n - (i ? fwd[i - 1] : 0));
        check(fwd.every((n, i) => n === i + 1), `${what}: 30 presses of next frame show frames 1-30`,
            `${moved.filter(d => d === 0).length} presses stayed put, ${moved.filter(d => d > 1).length} skipped a frame: ${list(fwd)}`);
        const [afterNum] = await status(s);
        check(+afterNum === fwd[29] + 1, `${what}: the frame number shown is the frame on screen`, `says ${afterNum}, showing frame ${fwd[29] + 1}`);
        const back = [];
        for (let i = 0; i < 10; i++) {
            await press(s, 'prev');
            back.push(await shown(s));
        }
        check(back.every((n, i) => n === 29 - i), `${what}: 10 presses of previous frame show frames 29-20`, list(back));
        await press(s, 'next', 6, 250);
        check(await shown(s) === 26, `${what}: six quick presses move six frames`, `on frame ${await shown(s)}, expected 26`);
        // the ends of the clip: stepping stops there rather than wrapping or sticking early
        await jump(s, 0, clip.frames);
        await press(s, 'prev', 2, 250);
        check(await shown(s) === 0, `${what}: previous frame on the first frame stays there`, `on ${await shown(s)}`);
        await jump(s, 0.97, clip.frames);
        const start = await shown(s), tail = [];
        for (let i = 0; i < clip.frames - start + 1; i++) {
            await press(s, 'next', 1, 250);
            tail.push(await shown(s));
        }
        const want = tail.map((_, i) => Math.min(clip.frames - 1, start + 1 + i));
        check(tail.every((n, i) => n === want[i]), `${what}: steps to the last frame from ${start} and stops there`, list(tail));
        const [lastNum] = await status(s);
        check(+lastNum === clip.frames, `${what}: the last frame is called frame ${clip.frames}`, `called ${lastNum}`);
        await s.page.close();
    }
}

async function grabSuite(ctx) {
    section('grab: a grab is the frame on screen, labelled with its number and start time');
    for (const name of pages) for (const clip of ctx.clips) {
        const s = await open(ctx.browser, name), what = `${name}, ${clip.name}`;
        await load(s, clip);
        const want = [];
        for (const steps of [7, 1, 0, 40]) {
            await press(s, 'next', steps);
            want.push(await shown(s));
            await s.page.click(s.P.grab);
            await s.page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [s.P.cardImg, want.length]);
        }
        // a person does not wait for a step to finish before grabbing
        for (let i = 0; i < 3; i++) {
            await s.page.click(s.P.next);
            await s.page.click(s.P.grab);
        }
        await settle(s, 250);
        await s.page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [s.P.cardImg, 7]);
        want.push(want[3] + 1, want[3] + 2, want[3] + 3);
        const got = await cards(s);
        check(got.map(c => c.n).join() === want.join(), `${what}: each grab holds the frame that was on screen, grabbed at once or after waiting`, `grabbed ${got.map(c => c.n)}, on screen ${want}`);
        for (const c of got) {
            const [num, min, sec] = s.P.card(c.label || '');
            const t = +min * 60 + +sec;
            check(+num === c.n + 1 && Math.abs(t - (clip.start + c.n / clip.rate)) < 0.0011,
                `${what}: the grab of frame ${c.n + 1} is labelled with it and its start time`, `label "${c.label}"`);
        }
        await s.page.close();
    }
}

async function sliderSuite(ctx) {
    section('slider: the frame slider counts real frames');
    if (!pages.includes('frame')) return skip('slider', 'only the frame page has one');
    for (const clip of ctx.clips) {
        const s = await open(ctx.browser, 'frame'), what = `frame, ${clip.name}`;
        await load(s, clip);
        const max = await s.page.$eval(s.P.slider, e => +e.max);
        check(max === clip.frames - 1, `${what}: the slider runs from frame 1 to frame ${clip.frames}`, `max ${max}`);
        const wrong = [];
        for (const n of [0, 1, 17, Math.floor(clip.frames / 2), clip.frames - 2, clip.frames - 1]) {
            await s.page.$eval(s.P.slider, (el, v) => {
                el.value = v;
                el.dispatchEvent(new Event('input'))
            }, n);
            await settle(s, 200);
            const at = await shown(s);
            if (at !== n) wrong.push(`${n}->${at}`);
        }
        check(!wrong.length, `${what}: slider positions show those frames`, wrong.join(' '));
        // a drag: many positions faster than seeks finish, ending on 40
        await s.page.$eval(s.P.slider, el => {
            for (let v = 5; v <= 40; v += 5) {
                el.value = v;
                el.dispatchEvent(new Event('input'))
            }
        });
        await settle(s, 250);
        const at = await shown(s), value = await s.page.$eval(s.P.slider, e => +e.value);
        check(at === 40 && value === 40, `${what}: a fast drag ends on the frame it was let go at`, `showing ${at}, slider at ${value}`);
        await s.page.close();
    }
}

async function batchSuite(ctx) {
    section('batch: extracting every N seconds takes the frame on screen at each of those times, once each');
    for (const name of pages) for (const clip of [...ctx.clips, ...ctx.recordings]) {
        const s = await open(ctx.browser, name), {every, inclusive} = s.P.batch, what = `${name}, ${clip.name}, every ${every} s`;
        await load(s, clip);
        const duration = await s.page.evaluate(() => document.querySelector('video').duration);
        const times = [];
        for (let k = 0; inclusive ? k * every <= duration : k * every < duration; k++) times.push(k * every);
        const want = (await framesAt(ctx.browser, clip.file, times)).filter((n, i, a) => i === 0 || n !== a[i - 1]);
        await s.page.fill(s.P.batch.input, String(every));
        await s.page.click(s.P.batch.button);
        await s.page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [s.P.cardImg, want.length], {timeout: 60000}).catch(() => {});
        await s.page.waitForTimeout(600);
        const got = (await cards(s)).map(c => c.n);
        check(got.join() === want.join(), `${what}: ${want.length} grabs, at the frames on screen at those times`, `got ${list(got)}\n want ${list(want)}`);
        await s.page.close();
    }
}

async function vfrSuite(ctx) {
    section('vfr: recordings with frames off a regular grid and no duration');
    for (const clip of ctx.recordings) for (const name of pages) {
        const truth = clip.truth;
        if (name === pages[0]) console.log(`  ${clip.name}: ${truth.length} frames (by brute force), numbers ${list(truth)}`);
        const s = await open(ctx.browser, name), what = `${name}, ${clip.name}`;
        await load(s, clip);
        const seq = [await shown(s)];
        const lies = [];
        for (let i = 0; i < truth.length + 2; i++) {
            await press(s, 'next', 1, 250);
            const n = await shown(s), [num] = await status(s);
            seq.push(n);
            // a page may decline to number these frames, but a number it does show must be right
            if (num !== undefined && +num !== truth.indexOf(n) + 1) lies.push(`${n}:${num}`);
        }
        const visited = seq.filter((n, i) => i === 0 || n !== seq[i - 1]);
        check(visited.join() === truth.join(), `${what}: next frame visits every frame once, in order, and stops at the last`,
            `visited ${list(visited)}`);
        check(!lies.length, `${what}: any frame number shown is the frame's own`, lies.join(' '));
        const back = [];
        for (let i = 0; i < 12; i++) {
            await press(s, 'prev', 1, 250);
            back.push(await shown(s));
        }
        const wantBack = truth.slice(-13, -1).reverse();
        check(back.join() === wantBack.join(), `${what}: previous frame walks back through every frame`, `got ${list(back)}\n want ${list(wantBack)}`);
        // stepping here searches, which takes a while; a grab made at once must wait for it
        for (let i = 0; i < 4; i++) {
            await s.page.click(s.P.prev);
            await s.page.click(s.P.grab);
        }
        await settle(s, 250);
        await s.page.waitForFunction(([sel]) => document.querySelectorAll(sel).length >= 4, [s.P.cardImg]);
        const grabbed = (await cards(s)).map(c => c.n), wantGrabs = truth.slice(-17, -13).reverse();
        check(grabbed.join() === wantGrabs.join(), `${what}: grabs made straight after previous frame hold the frames it lands on`, `got ${grabbed}, want ${wantGrabs}`);
        await s.page.close();
    }
}

// ---------- run ----------
const SUITES = {step: stepSuite, grab: grabSuite, slider: sliderSuite, batch: batchSuite, vfr: vfrSuite};
for (const name of suites) if (!SUITES[name]) {
    console.log(`unknown suite ${name}; have ${ALL.join(', ')}`);
    process.exit(2);
}
for (const name of pages) if (!PAGES[name]) {
    console.log(`unknown page ${name}; have ${Object.keys(PAGES).join(', ')}`);
    process.exit(2);
}

const {chromium} = await import('playwright');
const browser = await chromium.launch(EXE ? {executablePath: EXE} : {});
const context = await browser.newContext();
await context.route(`${ORIGIN}/**`, route => {
    const path = new URL(route.request().url()).pathname.slice(1);
    if (path === 'blank.html') return route.fulfill({contentType: 'text/html', body: '<input type="file" id="f"><video muted></video>'});
    const page = Object.values(PAGES).find(p => p.path === path);
    const file = page ? page.file : join(ROOT, path);
    if (!existsSync(file)) return route.fulfill({status: 404, body: ''});
    route.fulfill({contentType: extname(file) === '.js' ? 'application/javascript' : 'text/html', body: readFileSync(file)});
});
await context.route(url => !url.href.startsWith(ORIGIN), route => route.abort());
const ctx = {browser: context, clips: [], recordings: []};
const dir = mkdtempSync(join(tmpdir(), 'frame-step-'));
try {
    if (suites.some(s => s !== 'vfr')) {
        const ffmpeg = findFfmpeg(EXE || chromium.executablePath());
        if (!ffmpeg) {
            for (const s of suites.filter(s => s !== 'vfr')) skip(s, 'no ffmpeg to make clips with; set FFMPEG');
        } else {
            const jpegs = await makeJpegs(context, 300);
            // [name, rate as ffmpeg takes it, frames/second, frames, extra ffmpeg arguments, start time]
            const specs = [['24 fps', '24', 24, 150], ['25 fps', '25', 25, 150], ['29.97 fps', '30000/1001', 30000 / 1001, 150],
                ['30 fps', '30', 30, 150], ['50 fps', '50', 50, 150], ['60 fps', '60', 60, 150], ['120 fps', '120', 120, 300],
                ['30 fps from 0.5 s', '30', 30, 150, ['-output_ts_offset', '0.5'], 0.5]];
            for (const [name, r, rate, frames, extra = [], start = 0] of specs) {
                const file = await encode(ffmpeg, jpegs.slice(0, frames), r, join(dir, `${name.replace(/\W+/g, '_')}.webm`), extra);
                ctx.clips.push({name, rate, frames, file, start});
            }
        }
    }
    if (suites.includes('vfr') || suites.includes('batch')) {
        for (const [name, gaps] of [['uneven recording', [33, 33, 33, 20, 20, 50, 33, 33, 200, 33, 20, 33, 100, 33, 33, 66]],
            ['steady recording', [33]]]) {
            const file = await record(context, join(dir, `${name.replace(/\W+/g, '_')}.webm`), gaps);
            ctx.recordings.push({name, file, truth: await framesAt(context, file)});
        }
    }
    for (const name of suites) {
        if (name !== 'vfr' && name !== 'batch' && !ctx.clips.length) continue;
        try {
            await SUITES[name](ctx);
        } catch (e) {
            fail(`${name} suite ran`, e.stack || e);
        }
    }
} finally {
    await browser.close();
    rmSync(dir, {recursive: true, force: true});
}
console.log(`\n${passes} passed, ${failures} failed${skips ? `, ${skips} skipped` : ''}`);
process.exit(failures ? 1 : 0);
