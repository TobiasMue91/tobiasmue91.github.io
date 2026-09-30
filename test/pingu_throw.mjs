#!/usr/bin/env node
// Test suite for games/pingu_throw.html.
//
// The page is presentation - the yeti, the camera, the tape and the level, particles, sound -
// wrapped around a small fixed-step physics core in <script id="core">, and the promise is that
// none of the presentation touches the throw: the same tap on the same frame must give the same
// distance to the centimetre. This runs that block in Node, feeds it frame times the way the
// page's requestAnimationFrame loop does, presses on chosen frames and compares the distance
// with a table recorded from the 2026-09-15 version (a55e355), before the page was remade.
// No browser and no server needed.
//
//   node test/pingu_throw.mjs                  # everything
//   node test/pingu_throw.mjs gameplay         # named suites only
//
// Suites: gameplay, ghost, page.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'games', 'pingu_throw.html');
const ALL = ['gameplay', 'ghost', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
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
const CORE = /<script id="core">([\s\S]*?)<\/script>/.exec(HTML)[1];
const box = {};
vm.createContext(box);
vm.runInContext(CORE + '\nthis.Core = Core;', box);
const Core = box.Core;

// The page's frame loop: dt = min(0.05, (ts - last) / 1000), 0 on the first frame, fed to
// Core.advance. Drop on frame hz / 2, swing `swing` frames later (or never), run on.
function play({hz, swing, seconds}) {
    const s = Core.create();
    const drop = Math.round(hz / 2), total = drop + (swing > 0 ? swing : 0) + hz * seconds;
    let ts = 1000, last = 0;
    for (let f = 0; f < total; f++) {
        ts += 1000 / hz;
        const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
        last = ts;
        Core.advance(s, dt);
        if (f === drop) Core.drop(s);
        if (swing > 0 && f === drop + swing) Core.swing(s);
    }
    return s;
}
const scored = s => s.phase === 'done' && s.contact ? s.dist.toFixed(2) : '-';

// Recorded from the version of 2026-09-15 (a55e355): [Hz, frames from drop to swing, best it
// stored]. '-' is a throw that never scored.
const GOLDEN = [
    [60, 62, '-'], [60, 64, '-'], [60, 66, '56.51'], [60, 68, '90.37'], [60, 70, '125.98'],
    [60, 72, '159.99'], [60, 74, '189.69'], [60, 76, '212.28'], [60, 78, '221.88'], [60, 80, '207.98'],
    [60, 82, '179.48'], [60, 84, '141.64'], [60, 86, '99.86'], [60, 88, '57.14'], [60, 89, '37.03'],
    [60, 90, '-'], [144, 160, '73.04'], [144, 172, '159.99'], [144, 184, '219.58'], [144, 196, '179.48'],
    [144, 208, '77.16']
];

const thrown = [];
if (suites.includes('gameplay') || suites.includes('ghost')) {
    if (suites.includes('gameplay')) section('gameplay');
    for (const [hz, swing, want] of GOLDEN) {
        const s = play({hz, swing, seconds: 13});
        const got = scored(s);
        if (suites.includes('gameplay')) check(got === want, `${hz} Hz, swing ${swing} frames after the drop: ${want}`, `got ${got}`);
        if (got !== '-') thrown.push({hz, swing, dist: s.dist, dy: s.contact.dy, bounces: s.b.bounces});
    }
    if (suites.includes('gameplay')) {
        let s = play({hz: 60, swing: -1, seconds: 4});
        check(s.phase === 'done' && !s.contact && s.dist === 0, 'no swing scores nothing', `phase ${s.phase}, dist ${s.dist}`);
        s = play({hz: 60, swing: 78, seconds: 13});
        check(s.contact.q > 0.97, 'the best frame at 60 Hz is a near-perfect hit', `q ${s.contact.q}`);
        check(s.b.bounces === 6, 'a dead-level hit bounces six times', `${s.b.bounces}`);
        check(/^-?\d+$/.test(String(s.contact.ms)) && Math.abs(s.contact.ms) < 20, 'its timing reads within 20 ms', `${s.contact.ms}`);
        s = play({hz: 60, swing: 40, seconds: 5});
        check(!s.contact && s.miss && s.miss.ms > 560 && s.miss.ms < 680, 'a swing 40 frames in says how early it was, from the dive itself', JSON.stringify(s.miss));
        check(s.dist === 0, 'a whiff scores nothing');
        // the page adds a hit-stop and slow motion after contact: time taken out of the frames
        // after the swing must not move the penguin a centimetre
        const t = Core.create();
        let ts = 1000, last = 0, f = 0;
        for (; t.phase !== 'done' && f < 60 * 30; f++) {
            ts += 1000 / 60;
            let dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
            last = ts;
            if (t.sinceSwing >= 0 && t.sinceSwing < 120) dt *= 0.28;
            Core.advance(t, dt);
            if (f === 30) Core.drop(t);
            if (f === 30 + 78) Core.swing(t);
        }
        check(t.dist !== null && t.dist.toFixed(2) === '221.88', 'slow motion after the hit leaves the distance alone', `${t.dist}`);
    }
}

if (suites.includes('ghost')) {
    // a ghost - your best, or a friend's challenge link - carries only the height the penguin
    // was struck at; flown from that alone it has to land on the same number, step for step
    section('ghost');
    for (const t of thrown) {
        const f = Core.flightFrom(t.dy);
        check(f.dist.toFixed(2) === t.dist.toFixed(2), `ghost of the ${t.hz} Hz / ${t.swing} throw lands at ${t.dist.toFixed(2)}`, `got ${f.dist.toFixed(2)}`);
        const r = Core.flightFrom(Number(t.dy.toFixed(6)));
        check(r.dist.toFixed(1) === t.dist.toFixed(1), `  and from the six decimals a link carries, at ${t.dist.toFixed(1)}`, `got ${r.dist.toFixed(1)}`);
    }
}

if (suites.includes('page')) {
    // the page around the core: it must run without throwing in a bare window, read a friend's
    // link only when it is a real height, and keep the saved best under the old keys
    section('page');
    const PAGE_JS = HTML.split('<script>')[1].split('</script>')[0];
    function load(search, storage) {
        const noop = () => { };
        const store = Object.assign({}, storage || {});
        const ctx2d = new Proxy({}, {get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({width: 10}) : k.startsWith('create') ? () => ({addColorStop: noop}) : noop), set: (o, k, v) => { o[k] = v; return true; }});
        const els = {};
        const el = id => els[id] || (els[id] = {
            id, hidden: false, textContent: '', innerHTML: '', className: '', style: {}, offsetWidth: 300,
            classList: {toggle: noop, add: noop, remove: noop}, addEventListener: noop, setAttribute: noop, blur: noop,
            getContext: () => ctx2d, closest: () => null
        });
        let raf = null;
        const listeners = {};
        const win = {
            innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
            addEventListener: (type, fn) => { listeners[type] = fn; },
            matchMedia: () => ({matches: false}),
            requestAnimationFrame: cb => { raf = cb; return 1; },
            getComputedStyle: () => ({getPropertyValue: () => '0px'}),
            localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
            location: {search: search || '', origin: 'https://www.gptgames.dev', pathname: '/games/pingu_throw.html'},
            navigator: {}, setTimeout: noop, clearTimeout: noop, URLSearchParams, Path2D: function () { }, Math, JSON, Number,
            String, Object, Array, parseFloat, parseInt, isFinite, isNaN, console,
            document: {getElementById: el, documentElement: {}, fonts: {load: () => Promise.resolve()}}
        };
        win.window = win;
        vm.createContext(win);
        vm.runInContext(CORE + '\n' + PAGE_JS, win);
        let ts = 1000;
        return {
            store, el,
            frame(ms) { ts += ms; const cb = raf; raf = null; cb(ts); },
            key(code) { listeners.keydown({code, repeat: false, target: {closest: () => null}, preventDefault: noop}); }
        };
    }
    const page = load('', {pinguThrowCount: '5'});   // past the first throw, which slows the dive down to teach it
    for (let f = 0; f < 30; f++) page.frame(1000 / 60);
    page.key('Space');
    for (let f = 0; f < 78; f++) page.frame(1000 / 60);
    page.key('Space');
    for (let f = 0; f < 60 * 14; f++) page.frame(1000 / 60);
    check(page.store.pinguThrowBest === '221.88', 'the page saves a dead-level throw as 221.88 under pinguThrowBest', page.store.pinguThrowBest);
    check(Math.abs(Core.flightFrom(parseFloat(page.store.pinguThrowBestDy)).dist - 221.88) < 0.005, 'and the height it was struck at under pinguThrowBestDy');
    check(/221\.9/.test(page.el('big').innerHTML), 'the result counts up to the distance', page.el('big').innerHTML);

    const old = load('', {pinguThrowBest: '189.69', pinguThrowBestDy: String(thrown.find(t => t.swing === 74).dy), pinguThrowCount: '12'});
    old.frame(16);
    check(/189\.7/.test(old.el('sub').innerHTML), 'a best saved by the old page is shown on the first screen', old.el('sub').innerHTML);

    const f = thrown.find(t => t.swing === 76);
    const friend = load('?ghost=' + f.dy.toFixed(6));
    friend.frame(16);
    check(new RegExp(f.dist.toFixed(1)).test(friend.el('sub').innerHTML), 'a challenge link shows the friend\'s distance', friend.el('sub').innerHTML);
    for (const bad of ['?ghost=', '?ghost=abc', '?ghost=5', '?ghost=-1.71', '?ghost=Infinity']) {
        const pg = load(bad);
        pg.frame(16);
        check(!/FRIEND/.test(pg.el('sub').innerHTML), `${bad} is ignored`, pg.el('sub').innerHTML);
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
