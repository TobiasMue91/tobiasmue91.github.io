#!/usr/bin/env node
// Test suite for games/moorhuhn.html.
//
// The page is a lot of painting - the moor, the chickens, the gun, particles, sound, the
// cards - around a small fixed-step hunt: a seeded schedule of birds, ten shells, a reload
// that costs time, and a score table. The promise is that the painting never touches the
// hunt. So this runs the page's own script in Node against a stub DOM, lets a deterministic
// bot play whole ninety-second hunts on fixed seeds - aiming at birds, the set pieces and the
// signpost, missing on purpose, panning, reloading - and compares the trace of the hunt
// against a table recorded before the polish. No browser and no server needed.
//
//   node test/moorhuhn.mjs                     # everything
//   node test/moorhuhn.mjs hunt                # named suites only
//   node test/moorhuhn.mjs --record            # print a fresh table instead of checking
//   node test/moorhuhn.mjs --page=path.html    # run against another copy of the page
//
// Suites: hunt, cards, aim.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'moorhuhn.html');
const RECORD = args.includes('--record');
const ALL = ['hunt', 'cards', 'aim'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const SCRIPT = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

// A window with just enough DOM for the page: elements by id, a canvas context whose every
// call is a no-op, localStorage, and a requestAnimationFrame the test calls by hand.
function load() {
    const noop = () => { };
    const store = {};
    const ctx2d = {};
    for (const m of ['save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'beginPath', 'closePath',
        'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke',
        'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'setLineDash',
        'roundRect', 'resetTransform']) ctx2d[m] = noop;
    const grad = {addColorStop: noop};
    ctx2d.createLinearGradient = ctx2d.createRadialGradient = () => grad;
    ctx2d.createPattern = () => ({});
    ctx2d.measureText = () => ({width: 10});
    ctx2d.getImageData = (x, y, w, h) => ({data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h});
    ctx2d.putImageData = noop;
    const classList = () => {
        const s = new Set();
        return {add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)),
            toggle: (c, on) => { (on === undefined ? !s.has(c) : on) ? s.add(c) : s.delete(c); }, contains: c => s.has(c)};
    };
    const els = {};
    let canvasEl = null;
    const mkEl = id => {
        const listeners = {};
        const e = {
            id, textContent: '', innerHTML: '', value: '', className: '', style: {}, offsetWidth: 1, hidden: false,
            classList: classList(), listeners, dataset: {}, tagName: 'DIV',
            addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
            removeEventListener: noop, setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
            appendChild: noop, removeChild: noop, blur: noop, focus: noop, select: noop,
            querySelector: () => null, querySelectorAll: () => [],
            getContext: () => ctx2d, width: 0, height: 0,
            getBoundingClientRect: () => ({left: 0, top: 0, width: win.VW_CSS(), height: 400, right: 0, bottom: 0})
        };
        return e;
    };
    const el = id => els[id] || (els[id] = mkEl(id));
    for (const m of HTML.matchAll(/class="overlay hidden" id="(\w+)"/g)) el(m[1]).classList.add('hidden');
    for (const m of HTML.matchAll(/id="(\w+)"[^>]*class="[^"]*\bhidden\b/g)) el(m[1]).classList.add('hidden');
    const docListeners = {}, winListeners = {};
    let raf = null, now = 0;
    const body = mkEl('body');
    const win = {
        innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, isSecureContext: false,
        addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
        removeEventListener: noop,
        matchMedia: q => ({matches: false, media: q, addEventListener: noop, addListener: noop}),
        requestAnimationFrame: cb => { raf = cb; return 1; },
        cancelAnimationFrame: noop,
        localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; }},
        location: {search: '', origin: 'https://www.gptgames.dev', pathname: '/games/moorhuhn.html', href: ''},
        history: {replaceState: noop},
        navigator: {}, screen: {}, performance: {now: () => now},
        setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
        URLSearchParams, Math, JSON, Number, String, Object, Array, Set, Map, Promise, Date, Uint8ClampedArray,
        Float32Array, parseFloat, parseInt, isFinite, isNaN, console, Symbol, Error,
        document: {
            getElementById: el, body, documentElement: mkEl('html'), hidden: false, activeElement: body,
            fullscreenElement: null, addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
            createElement: t => { const e = mkEl('new-' + t); e.tagName = t.toUpperCase(); return e; },
            querySelector: () => null, querySelectorAll: () => [], execCommand: () => false,
            fonts: {ready: Promise.resolve(), load: () => Promise.resolve()}
        },
        VW_CSS: () => vm.runInContext('VW', ctxv)
    };
    win.window = win;
    win.self = win;
    const ctxv = vm.createContext(win);
    vm.runInContext(SCRIPT, ctxv);
    canvasEl = els.cv;
    const fire = (target, type, ev) => (target.listeners[type] || []).forEach(fn => fn(ev));
    const evBase = {preventDefault: noop, stopPropagation: noop, target: canvasEl};
    return {
        store, el,
        get: expr => vm.runInContext(expr, ctxv),
        frame() { now += 1000 / 60; const cb = raf; raf = null; if (cb) cb(now); },
        click(id) { fire(el(id), 'click', Object.assign({}, evBase, {target: el(id)})); },
        move(x, y) { fire(canvasEl, 'mousemove', Object.assign({}, evBase, {clientX: x, clientY: y})); },
        down(button) { fire(canvasEl, 'mousedown', Object.assign({}, evBase, {button: button || 0})); },
        key(code) { (winListeners.keydown || []).forEach(fn => fn(Object.assign({}, evBase, {code, key: code, target: body}))); }
    };
}

// A deterministic hunter. It reads the moor the way a player sees it - which birds are in
// view and where their hit boxes sit - and takes decisions only from that and the frame count,
// so any change in what the hunt does shows up as a different trace.
function hunt(seed) {
    const page = load();
    page.el('seedInput').value = seed;
    page.click('startBtn');
    const VW = page.get('VW');
    const trace = [];
    let f = 0, shotNo = 0, aim = [VW / 2, 200];
    const aimAt = (x, y) => { aim = [x, y]; page.move(x, y); };
    while (page.get('state') === 'play' && f < 60 * 100) {
        f++;
        const phase = Math.floor(f / 420) % 5;
        if (page.get('ammo') === 0 && page.get('reloadT') === 0 && f % 3 === 0) page.down(2);
        if (phase === 3) aimAt(3, 200);                       // ride the left edge
        else if (phase === 4 && f % 420 < 140) aimAt(VW - 3, 200);  // and the right
        else if (f % 11 === 0) {
            shotNo++;
            const panX = page.get('panX');
            let pick = null;
            if (shotNo % 7 === 0) pick = [VW * 0.5, 60];      // a shell into the sky
            else if (shotNo % 13 === 0) {                     // the set pieces, and the signpost
                const target = page.get(`(() => {
                    const k = ${shotNo} % 3;
                    for (const p of props) {
                        if (k === 0 && p.kind === 'windmill') {
                            for (let i = 0; i < 4; i++) if (p.blades[i]) {
                                const a = p.ang + i * Math.PI / 2;
                                return [p.x + Math.cos(a) * 44, p.y + Math.sin(a) * 44];
                            }
                        }
                        if (k === 1 && p.kind === 'scarecrow' && p.hat) return [p.x, p.y - 40];
                        if (k === 2 && p.kind === 'sign' && !p.hit) return [p.x, p.y - 20];
                    }
                    return null;
                })()`);
                if (target && target[0] - panX > 0 && target[0] - panX < VW) pick = [target[0] - panX, target[1]];
            }
            if (!pick) {
                // the live bird in view that this shot's rule prefers: far, near or first
                const rule = shotNo % 3;
                const b = page.get(`(() => {
                    let best = null;
                    for (const b of birds) {
                        if (b.dead) continue;
                        const x = b.x - panX;
                        if (x < 8 || x > VW - 8 || b.y < 44) continue;
                        const s = ${rule} === 0 ? b.band : ${rule} === 1 ? -b.band : -Math.abs(x - VW / 2);
                        const box = birdBox(b);
                        if (!best || s < best.s) best = {s, x: box.x + box.w / 2 - panX, y: box.y + box.h / 2};
                    }
                    return best && [best.x, best.y];
                })()`);
                if (b) pick = b;
            }
            if (pick) { aimAt(pick[0], pick[1]); page.down(0); }
        }
        page.frame();
        if (f % 60 === 0) trace.push([page.get('score'), page.get('hits'), page.get('shots'), page.get('reloads'),
            page.get('birds.filter(b => !b.dead).length'), Math.round(page.get('panX'))]);
    }
    for (let i = 0; i < 90 && page.get('state') === 'play'; i++) page.frame();
    return {page, trace, f};
}

const fnv = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

// Recorded from the version of 2026-09-15 (d08033e): for each seed, the score, hits, shells
// and reloads at the whistle, and a hash of the second-by-second trace of the whole hunt.
const GOLDEN = {
    moor: {end: [2040, 160, 208, 20], trace: '8543ea38', secs: 90},
    12345: {end: [1915, 163, 210, 21], trace: 'a9b7bc53', secs: 90},
    heather: {end: [1840, 142, 190, 19], trace: 'aab71e42', secs: 90},
    windmill: {end: [1915, 147, 200, 20], trace: '64f101e7', secs: 90}
};

if (suites.includes('hunt')) {
    section('hunt');
    const out = {};
    for (const seed of ['moor', '12345', 'heather', 'windmill']) {
        const {page, trace} = hunt(seed);
        const last = trace[trace.length - 1] || [];
        const got = {end: [page.get('score'), page.get('hits'), page.get('shots'), page.get('reloads')], trace: fnv(JSON.stringify(trace)), secs: trace.length};
        out[seed] = got;
        if (RECORD) continue;
        const want = GOLDEN[seed];
        check(page.get('state') === 'over', `seed ${seed}: the hunt ends on the whistle`);
        check(want && JSON.stringify(want.end) === JSON.stringify(got.end), `seed ${seed}: score, hits, shells, reloads ${want && want.end}`, `got ${got.end} (last trace row ${last})`);
        check(want && want.trace === got.trace && want.secs === got.secs, `seed ${seed}: the whole hunt, second by second`, `trace ${got.trace} over ${got.secs}s`);
    }
    if (RECORD) console.log(JSON.stringify(out, null, 4));
}

if (suites.includes('cards') && !RECORD) {
    section('cards');
    const {page} = hunt('moor');
    const best = page.store.moorhuhn_best;
    check(best && +best === page.get('score'), 'the first hunt is stored as the best', `stored ${best}, scored ${page.get('score')}`);
    check(page.el('ovScore').textContent.replace(/,/g, '') === String(page.get('score')), 'the card shows the score', page.el('ovScore').textContent);
    check(page.el('ovSeed').textContent === 'moor', 'the card names the seed', page.el('ovSeed').textContent);
    check(!page.el('overScreen').classList.contains('hidden'), 'the card is up');
}

if (suites.includes('aim') && !RECORD) {
    // what you see is what you hit: a far bird bobbing off its flight line is hit where it
    // is drawn, not where its line runs
    section('aim');
    const page = load();
    page.el('seedInput').value = 'moor';
    page.click('startBtn');
    let tried = 0, hit = 0;
    for (let f = 0; f < 60 * 30 && tried < 8; f++) {
        page.frame();
        if (page.get('cooldown') > 0 || page.get('reloadT') > 0) continue;
        if (page.get('ammo') === 0) { page.down(2); continue; }
        const t = page.get(`(() => {
            for (const b of birds) {
                if (b.dead || b.perched || b.band !== 0) continue;
                // aim at the part of the drawn bird furthest from its line: its back when it has
                // bobbed up, its belly when it has bobbed down
                const off = Math.sin(b.bob) * b.bobAmp, x = b.x - panX, half = 15 * b.scale;
                if (Math.abs(off) > 3 && x > VW * 0.2 && x < VW * 0.8) return [birds.indexOf(b), x, b.y + off + Math.sign(off) * half * 0.75];
            }
            return null;
        })()`);
        if (!t) continue;
        tried++;
        page.move(t[1], t[2]);
        page.down(0);
        if (page.get(`birds[${t[0]}].dead`)) hit++;
    }
    check(tried >= 5, 'enough far birds bobbed off their line to try', `${tried}`);
    check(hit === tried, 'every shot at a far bird where it is drawn hits it', `${hit} of ${tried}`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
