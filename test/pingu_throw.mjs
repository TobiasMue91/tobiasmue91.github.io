#!/usr/bin/env node
// Test suite for games/pingu_throw.html.
//
// The page is mostly presentation - the yeti, the penguin, particles, sound, the result
// card - wrapped around a small fixed-step physics core, and the promise is that none of the
// presentation touches the throw: the same tap on the same frame must give the same distance
// to the centimetre. So this runs the page's own script in Node against a stub DOM, drives
// requestAnimationFrame with exact timestamps, presses Space on chosen frames and compares
// what the page stores against a table recorded from the 2026-09-15 version, before the
// polish. No browser and no server needed.
//
//   node test/pingu_throw.mjs                  # everything
//   node test/pingu_throw.mjs gameplay         # named suites only
//
// Suites: gameplay, share, result.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'games', 'pingu_throw.html');
const ALL = ['gameplay', 'share', 'result'];
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
const SCRIPT = HTML.split('<script>')[1].split('</script>')[0];
const HIDDEN = new Set([...HTML.matchAll(/<[^>]*\bid="([\w-]+)"[^>]*\shidden[\s>]/g)].map(m => m[1]));

// A window with just enough DOM for the page: elements by id, a canvas context whose every
// call is a no-op, localStorage, and a requestAnimationFrame the test calls by hand.
function load(search, storage) {
    const noop = () => { };
    const store = Object.assign({}, storage || {});
    const ctx2d = {};
    for (const m of ['save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'beginPath', 'closePath',
        'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke',
        'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'setLineDash']) ctx2d[m] = noop;
    const grad = {addColorStop: noop};
    ctx2d.createLinearGradient = ctx2d.createRadialGradient = () => grad;
    ctx2d.measureText = () => ({width: 10});
    const els = {};
    const el = id => els[id] || (els[id] = {
        id, hidden: HIDDEN.has(id), textContent: '', innerHTML: '', className: '', style: {}, offsetWidth: 1,
        classList: {add: noop, remove: noop}, addEventListener: noop, setAttribute: noop, blur: noop,
        getContext: () => ctx2d, tagName: 'DIV'
    });
    let raf = null;
    const listeners = {};
    const body = {tagName: 'BODY', appendChild: noop, removeChild: noop};
    const win = {
        innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, isSecureContext: false,
        addEventListener: (type, fn) => { listeners[type] = fn; },
        matchMedia: () => ({matches: false}),
        requestAnimationFrame: cb => { raf = cb; return 1; },
        localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }},
        location: {search: search || '', origin: 'https://www.gptgames.dev', pathname: '/games/pingu_throw.html'},
        navigator: {}, setTimeout: noop, URLSearchParams, Math, JSON, Number, String, Object, Array,
        parseFloat, parseInt, isFinite, isNaN, console,
        document: {
            getElementById: el, body, hidden: false, activeElement: body, addEventListener: noop,
            createElement: () => ({getContext: () => ctx2d, style: {}, select: noop}), execCommand: () => false
        }
    };
    win.window = win;
    vm.createContext(win);
    vm.runInContext(SCRIPT, win);
    let ts = 1000;
    return {
        store, el,
        frame(ms) { ts += ms; const cb = raf; raf = null; cb(ts); },
        space() { listeners.keydown({code: 'Space', repeat: false, target: body, preventDefault: noop}); }
    };
}

// Close the intro, drop on frame `hz / 2`, swing `swing` frames later (or never), run on.
function play({hz, swing, seconds, search, storage}) {
    const page = load(search, storage);
    page.el('go').onclick();
    const drop = Math.round(hz / 2), total = drop + (swing > 0 ? swing : 0) + hz * seconds;
    for (let f = 0; f < total; f++) {
        page.frame(1000 / hz);
        if (f === drop || (swing > 0 && f === drop + swing)) page.space();
    }
    return page;
}

// Recorded from the version of 2026-09-15 (a55e355) with the same driver: [Hz, frames from
// drop to swing, stored best]. '-' is a throw that never scored.
const GOLDEN = [
    [60, 62, '-'], [60, 64, '-'], [60, 66, '56.51'], [60, 68, '90.37'], [60, 70, '125.98'],
    [60, 72, '159.99'], [60, 74, '189.69'], [60, 76, '212.28'], [60, 78, '221.88'], [60, 80, '207.98'],
    [60, 82, '179.48'], [60, 84, '141.64'], [60, 86, '99.86'], [60, 88, '57.14'], [60, 89, '37.03'],
    [60, 90, '-'], [144, 160, '73.04'], [144, 172, '159.99'], [144, 184, '219.58'], [144, 196, '179.48'],
    [144, 208, '77.16']
];

const thrown = [];

if (suites.includes('gameplay') || suites.includes('share')) {
    if (suites.includes('gameplay')) section('gameplay');
    for (const [hz, swing, want] of GOLDEN) {
        const page = play({hz, swing, seconds: 13});
        const got = page.store.pinguThrowBest || '-';
        if (suites.includes('gameplay')) check(got === want, `${hz} Hz, swing ${swing} frames after the drop: ${want}`, `got ${got}`);
        if (got !== '-') thrown.push({hz, swing, best: got, dy: page.store.pinguThrowBestDy});
    }
    if (suites.includes('gameplay')) {
        const page = play({hz: 60, swing: -1, seconds: 4});
        check(!page.store.pinguThrowBest, 'no swing scores nothing', `stored ${page.store.pinguThrowBest}`);
    }
}

if (suites.includes('share')) {
    // a challenge link carries only the height the penguin was struck at; the friend's ghost
    // has to fly to the same number
    section('share');
    for (const t of thrown) {
        const want = parseFloat(t.best).toFixed(1);
        const page = play({hz: 60, swing: -1, seconds: 0, search: '?ghost=' + Number(t.dy).toFixed(6)});
        const m = /threw <b>([\d.]+)m/.exec(page.el('vs').innerHTML);
        check(m && m[1] === want, `link for the ${t.hz} Hz / ${t.swing} throw shows ${want}m`, `intro says ${page.el('vs').innerHTML}`);
    }
    for (const bad of ['?ghost=', '?ghost=abc', '?ghost=5', '?ghost=-1.71', '?ghost=Infinity']) {
        const page = play({hz: 60, swing: -1, seconds: 0, search: bad});
        check(page.el('vs').hidden, `${bad} is ignored`);
    }
}

if (suites.includes('result')) {
    section('result');
    let page = play({hz: 60, swing: 78, seconds: 13});
    check(page.el('rank').textContent === 'Perfect', 'a dead-level hit is ranked Perfect', page.el('rank').textContent);
    check(!page.el('nb').hidden, 'the first scoring throw is a new best');
    check(/^(dead level|\d+ ms (early|late))$/.test(page.el('ms').textContent), 'the timing meter reads in ms', page.el('ms').textContent);
    check(/6<\/b><span>bounces/.test(page.el('stats').innerHTML), 'six bounces are reported', page.el('stats').innerHTML);
    check(/^221\.9/.test(page.el('finalDist').innerHTML), 'the card counts up to the distance', page.el('finalDist').innerHTML);

    // a swing 40 frames into the dive is about 0.62 s before the penguin reaches the club
    page = play({hz: 60, swing: 40, seconds: 5});
    const ms = +(/(\d+) ms early/.exec(page.el('finalNote').textContent) || [])[1];
    check(page.el('rank').textContent === 'Whiff', 'a swing at nothing is a whiff', page.el('rank').textContent);
    check(ms > 560 && ms < 680, 'a whiff says how early it was, from the dive itself', page.el('finalNote').textContent);
    check(page.el('share').hidden, 'a whiff cannot be sent as a challenge');

    page = play({hz: 60, swing: -1, seconds: 5});
    check(page.el('rank').textContent === 'No swing', 'never swinging is reported as such', page.el('rank').textContent);
    check(page.el('meter').hidden, 'no swing, no timing meter');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
