#!/usr/bin/env node
// Test suite for games/doodling.html (Squiggle).
//
// Runs the page's DOM-free <script id="core"> block in Node. Squiggle is a sketch pad, and what
// can go quietly wrong is mostly invisible from the pad itself: a day's squiggle that differs
// between two phones, one that runs off the sheet or knots into a blot, dots taken in by the pen
// that come back after a reload, a sheet that does not survive being saved, yesterday's drawing
// that is thrown away instead of filed. No browser, no server.
//
//   node test/doodling.mjs                  # everything
//   node test/doodling.mjs squiggle dots    # named suites only
//   node test/doodling.mjs --page=path.html # run against another copy of the page
//
// Suites: squiggle, days, dots, pen, codec, sheets, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'doodling.html'));
const ALL = ['squiggle', 'days', 'dots', 'pen', 'codec', 'sheets', 'saves'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.SQ = SQ;', ctx);
const SQ = ctx.SQ;
const rnd = SQ.rng(20261001);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A hand: drags a pen through control points with a person's timing, returns the stroke.
function hand(tool, ink, ctrl, speed = 1, t0 = 0, pressure = -1) {
    const path = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
        const [ax, ay] = ctrl[i], [bx, by] = ctrl[i + 1], n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
        for (let j = 0; j < n; j++) path.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
    }
    path.push(ctrl[ctrl.length - 1]);
    // a pointer reports every 4 ms, wherever the hand has got to by then
    const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const pen = new SQ.Pen(tool, path[0][0], path[0][1], t0, pressure);
    let t = t0, j = 0;
    for (let s = speed * 4; s < L[L.length - 1]; s += speed * 4) {
        t += 4; while (j < L.length - 2 && L[j + 1] < s) j++;
        const f = (s - L[j]) / ((L[j + 1] - L[j]) || 1);
        pen.add(path[j][0] + (path[j + 1][0] - path[j][0]) * f, path[j][1] + (path[j + 1][1] - path[j][1]) * f, t, pressure);
    }
    const e = path[path.length - 1]; pen.end(e[0], e[1], t + 4);
    return {tool, ink, gap: 300, pts: pen.pts};
}
const scribble = (r, n = 6, w = 1000, h = 1500) => Array.from({length: n}, () => [r() * w, r() * h]);

if (suites.includes('squiggle')) {
    section('squiggle');
    // the same seed is the same line on every device, in both orientations
    const a = SQ.squiggle(12345), b = SQ.squiggle(12345), c = SQ.squiggle(12346);
    check(same(a, b), 'a seed always gives the same squiggle');
    check(!same(a, c), 'neighbouring seeds give different squiggles');
    let off = 0, knots = 0, flat = 0, tiny = 0, gaps = 0, worst = 0;
    const N = 1500;
    for (let i = 0; i < N; i++) {
        for (const wide of [false, true]) {
            const seed = SQ.daySeed(i + 1), p = SQ.squiggle(seed, wide), box = wide ? SQ.BOX_WIDE : SQ.BOX;
            if (p.some(q => q[0] < box.x0 - 0.01 || q[0] > box.x1 + 0.01 || q[1] < box.y0 - 0.01 || q[1] > box.y1 + 0.01)) off++;
            const cr = SQ.crossings(p); if (cr > 2) knots++; worst = Math.max(worst, cr);
            const turn = SQ.turning(p); if (turn < 2) flat++;
            const bb = SQ.bbox(p); if (Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) < 300) tiny++;
            for (let k = 1; k < p.length; k++) if (Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]) > 5.5) { gaps++; break; }
        }
    }
    check(off === 0, 'every squiggle stays inside its box on the sheet', off + ' of ' + 2 * N + ' leave it');
    check(knots <= 2 * N * 0.01, 'a squiggle crosses itself at most twice (allowing 1% stubborn seeds)', knots + ' cross more, worst ' + worst);
    check(flat === 0, 'no squiggle is a plain line', flat + ' barely turn');
    check(tiny === 0, 'every squiggle is big enough to draw from (300+ units across)', tiny + ' are smaller');
    check(gaps === 0, 'points along a squiggle are evenly spaced, so its dots are too', gaps + ' have a gap');
    // a wide sheet holds the same squiggle as a tall one, only placed differently
    const t = SQ.squiggle(777, false), w = SQ.squiggle(777, true);
    check(t.length > 20 && Math.abs(t.length - w.length) / t.length < 0.6, 'a tall and a wide sheet print the same day\'s squiggle at a comparable length');
    // shared codes
    let bad = 0;
    for (let i = 0; i < 2000; i++) { const s = Math.floor(rnd() * 1073741824); if (SQ.seedFor(SQ.codeFor(s)) !== s) bad++; }
    check(bad === 0, 'a squiggle sent as a code comes back as the same seed', bad + ' do not');
    check(['', 'abc', 'ABCDEF', 'abcdel', 'abcde1', null, 'abcdefg'].every(c => SQ.seedFor(c) === null), 'malformed codes are refused, not guessed');
}

if (suites.includes('days')) {
    section('days');
    check(SQ.dayNumber(new Date(2026, 9, 1, 0, 0, 1)) === 1 && SQ.dayNumber(new Date(2026, 9, 1, 23, 59, 59)) === 1, 'Thursday 1 October 2026 is No. 1 all day long');
    check(SQ.dayNumber(new Date(2026, 9, 2, 0, 0, 1)) === 2, 'the next squiggle comes at local midnight');
    // across two years and both daylight-saving changes, every day is one more than the last
    let jumps = 0, back = 0;
    for (let d = 0; d < 730; d++) {
        const morning = new Date(2026, 9, 1 + d, 6), night = new Date(2026, 9, 1 + d, 23, 30), next = new Date(2026, 9, 2 + d, 0, 30);
        if (SQ.dayNumber(morning) !== d + 1 || SQ.dayNumber(night) !== d + 1) back++;
        if (SQ.dayNumber(next) !== d + 2) jumps++;
        const dd = SQ.dayDate(d + 1);
        if (dd.getFullYear() !== morning.getFullYear() || dd.getMonth() !== morning.getMonth() || dd.getDate() !== morning.getDate()) back++;
    }
    check(jumps === 0 && back === 0, 'day numbers and their dates agree for two years, through clock changes', jumps + ' jumps, ' + back + ' mismatches');
    const seen = new Set(); for (let d = 1; d <= 3650; d++) seen.add(SQ.daySeed(d));
    check(seen.size === 3650, 'ten years of days never repeat a squiggle seed');
}

if (suites.includes('dots')) {
    section('dots');
    let spacing = 0, few = 0, prefix = 0, blobs = 0, n = 0;
    for (let i = 1; i <= 400; i++) {
        const p = SQ.squiggle(SQ.daySeed(i), i % 2 === 0), d = SQ.dots(p, 1);
        n++;
        const vis = d.filter(q => q[2] > 0);
        if (vis.length < 20) few++;
        for (let k = 1; k < d.length; k++) { const g = Math.hypot(d[k][0] - d[k - 1][0], d[k][1] - d[k - 1][1]); if (g < SQ.DOT * 0.7 || g > SQ.DOT * 1.3) { spacing++; break; } }
        // no two visible dots sit on top of each other where the line crosses itself
        outer: for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) if (Math.hypot(vis[a][0] - vis[b][0], vis[a][1] - vis[b][1]) < SQ.DOT * 0.55) { blobs++; break outer; }
        // printing a squiggle a bit at a time lays the same dots it ends with
        for (const u of [0.1, 0.35, 0.8]) {
            const part = SQ.dots(p, u);
            if (part.length > d.length || part.some((q, k) => Math.abs(q[0] - d[k][0]) > 1e-6 || Math.abs(q[1] - d[k][1]) > 1e-6)) { prefix++; break; }
        }
    }
    check(spacing === 0, 'dots are evenly spaced along the line', spacing + ' of ' + n);
    check(few === 0, 'every squiggle has at least 20 dots', few + ' have fewer');
    check(blobs === 0, 'where the line crosses itself the dots do not pile into a blot', blobs + ' do');
    check(prefix === 0, 'printing a sheet dot by dot ends on exactly the dots it shows afterwards', prefix + ' differ');

    // taking dots in
    const p = SQ.squiggle(SQ.daySeed(5)), d = SQ.dots(p, 1);
    const along = hand('fine', 0, p.filter((_, i) => i % 6 === 0).concat([p[p.length - 1]]), 0.8);
    const hid = SQ.covered(d, [along]), visible = d.filter(q => q[2] > 0).length;
    check(hid.reduce((a, b) => a + b, 0) >= visible * 0.95, 'a pen traced along the squiggle takes in its dots', hid.reduce((a, b) => a + b, 0) + ' of ' + visible);
    const far = hand('brush', 0, [[60, 1400], [940, 1420]]);
    check(SQ.covered(d, [far]).every(v => !v), 'a stroke nowhere near the squiggle takes no dots');
    const er = hand('eraser', 0, p.slice(0, 40).filter((_, i) => i % 5 === 0));
    check(SQ.covered(d, [er]).some(v => v), 'the eraser rubs out the printed dots it passes over');
    // drawing live takes dots in a few points at a time; a reload works them out from the
    // whole sheet at once - both must agree, or dots come back when the page is opened again
    let disagree = 0;
    for (let trial = 0; trial < 120; trial++) {
        const r = SQ.rng(trial + 1), sq = SQ.squiggle(SQ.daySeed(trial + 9), trial % 3 === 0), list = SQ.dots(sq, 1);
        const strokes = [];
        for (let s = 0; s < 1 + Math.floor(r() * 6); s++) {
            const tools = ['pencil', 'fine', 'brush', 'marker', 'eraser'];
            const base = sq[Math.floor(r() * sq.length)];
            const ctrl = [base, ...Array.from({length: 3}, () => [base[0] + (r() - .5) * 400, base[1] + (r() - .5) * 400])];
            strokes.push(hand(tools[Math.floor(r() * 5)], 0, ctrl, 0.3 + r() * 2));
        }
        const live = new Uint8Array(list.length);
        for (const st of strokes) { let i = 0; while (i < st.pts.length) { const k = 1 + Math.floor(r() * 5); SQ.absorb(list, live, st.pts.slice(i, i + k)); i += k; } }
        const reload = SQ.covered(list, SQ.decode(SQ.encode(strokes)));
        if (!same(Array.from(live), Array.from(reload))) disagree++;
    }
    check(disagree === 0, 'dots taken in while drawing are the dots still taken after a reload', disagree + ' of 120 sheets differ');
}

if (suites.includes('pen')) {
    section('pen');
    const speeds = [0.2, 0.5, 1, 2, 4], line = [[100, 700], [900, 700]];
    const w = speeds.map(v => { const st = hand('brush', 0, line, v); const mid = st.pts.slice(st.pts.length * 0.4, st.pts.length * 0.6); return mid.reduce((a, q) => a + q[2], 0) / mid.length; });
    check(w.every((x, i) => i === 0 || x < w[i - 1]), 'a brush pen thins as it speeds up', w.map(x => x.toFixed(1)).join(' > '));
    check(w[0] > 15 && w[w.length - 1] < 5, 'slow is bold and fast is a hairline', w[0].toFixed(1) + ' and ' + w[w.length - 1].toFixed(1));
    let out = 0;
    for (const tool of SQ.TOOLS) for (const v of speeds) {
        const st = hand(tool, 0, scribble(SQ.rng(v * 10 + tool.length), 5), v);
        if (st.pts.some(q => !(q[2] > 0.5) || q[2] > SQ.BASE[tool] * 1.15 + 2)) out++;
    }
    check(out === 0, 'every pen keeps a sensible width at every speed', out + ' strokes out of range');
    const pr = [0.1, 0.5, 1].map(p => { const st = hand('brush', 0, line, 1, 0, p); return st.pts[Math.floor(st.pts.length / 2)][2]; });
    check(pr[0] < pr[1] && pr[1] < pr[2], 'with a stylus, pressing harder makes the brush pen wider', pr.map(x => x.toFixed(1)).join(' < '));
    const fine = hand('fine', 0, line, 1);
    check(Math.max(...fine.pts.map(q => q[2])) - Math.min(...fine.pts.map(q => q[2])) < 2.5, 'a fineliner stays a fineliner');
    check(same(hand('pencil', 0, line, 1), hand('pencil', 0, line, 1)), 'the same hand gives the same stroke');
    const tiny = new SQ.Pen('brush', 500, 500, 0, -1); tiny.add(500.3, 500.2, 16, -1); tiny.end(500.4, 500.2, 30);
    check(tiny.pts.length === 1 && tiny.pts[0][2] > 0, 'a tap leaves a dot');
}

if (suites.includes('codec')) {
    section('codec');
    let lost = 0, size = 0, pts = 0;
    for (let trial = 0; trial < 200; trial++) {
        const r = SQ.rng(trial * 7 + 1), strokes = [];
        for (let s = 0; s < Math.floor(r() * 12); s++) {
            const tool = SQ.TOOLS[Math.floor(r() * 5)], ctrl = scribble(r, 2 + Math.floor(r() * 6), 1500, 1500).map(q => [q[0] - 200, q[1] - 200]);
            const st = hand(tool, Math.floor(r() * 6), ctrl, 0.2 + r() * 3);
            st.gap = Math.floor(r() * 5000);
            strokes.push(st);
        }
        const enc = SQ.encode(strokes), dec = SQ.decode(enc);
        if (!same(dec, strokes)) lost++;
        size += enc.length; pts += strokes.reduce((a, s) => a + s.pts.length, 0);
    }
    check(lost === 0, 'a sheet comes back from storage exactly as it was drawn, off-sheet points too', lost + ' of 200 changed');
    check(size / pts < 9, 'a point costs a few bytes, so a sketchbook fits in browser storage', (size / pts).toFixed(2) + ' bytes a point');
    check(same(SQ.decode(SQ.encode([])), []), 'an empty sheet round-trips');
    // any colour: a stroke carries its own, in the field the six inks have always used
    let wrong = 0;
    for (let i = 0; i < 500; i++) { const hex = '#' + Math.floor(rnd() * 0x1000000).toString(16).padStart(6, '0'); if (SQ.inkColor(SQ.inkOf(hex)) !== hex) wrong++; }
    check(wrong === 0 && SQ.inkColor(SQ.inkOf('#000000')) === '#000000' && SQ.inkColor(SQ.inkOf('#ffffff')) === '#ffffff', 'a mixed colour comes back as itself', wrong + ' did not');
    check(SQ.INKS.every((c, i) => SQ.inkColor(i) === c && SQ.validInk(i)) && !SQ.validInk(7) && !SQ.validInk(-1), 'the six inks keep their numbers, so old sheets keep their colours');
    const mixed = [hand('brush', SQ.inkOf('#ff00aa'), [[10, 10], [500, 900]]), hand('marker', SQ.inkOf('#0a0b0c'), [[900, 100], [100, 1400]])];
    check(same(SQ.decode(SQ.encode(mixed)), mixed) && SQ.inkColor(SQ.decode(SQ.encode(mixed))[0].ink) === '#ff00aa', 'strokes in mixed colours round-trip through storage');
    const enc = SQ.encode([hand('marker', 3, [[1, 1], [999, 1499]])]);
    let threw = 0;
    for (const bad of [enc.slice(0, enc.length - 8), 'AAAA', SQ.encode([]).replace(/^A/, 'B')]) { try { SQ.decode(bad); } catch (e) { threw++; } }
    check(threw === 3, 'damaged or unknown data is refused rather than drawn as nonsense', threw + ' of 3 refused');
}

if (suites.includes('sheets')) {
    section('sheets');
    let n = 0;
    const o = (wide, seed) => ({wide: !!wide, now: 1000 + n, id: () => 'id' + (n++), seed: () => seed || 4242});
    const ink = sh => SQ.addStroke(sh, hand('brush', 0, [[100, 600], [800, 700]]));
    const st = {pad: null, book: [], day: 0};
    check(SQ.open(st, 10, o()).length === 0 && st.pad.kind === 'day' && st.pad.day === 10 && st.pad.seed === SQ.daySeed(10), 'a first visit puts today\'s squiggle on the pad');
    const first = st.pad;
    SQ.open(st, 10, o()); check(st.pad === first, 'opening again the same day leaves the sheet where it was');
    ink(st.pad);
    const filed = SQ.open(st, 11, o());
    check(filed.length === 1 && st.book[0] === first && first.torn > 0 && st.pad.day === 11, 'a new day files yesterday\'s drawing and puts today\'s sheet on top');
    SQ.open(st, 12, o());
    check(st.book.length === 1 && st.pad.day === 12, 'an untouched sheet is not filed when the day turns');
    ink(st.pad);
    const torn = SQ.tear(st, 12, o(true, 99));
    check(torn && st.book[0] === torn && st.pad.kind === 'extra' && st.pad.seed === 99 && st.pad.wide, 'tearing files the sheet and the next one carries a fresh squiggle');
    SQ.tear(st, 12, o(false, 98));
    check(st.pad.n === 3, 'the day\'s extra sheets are numbered after today\'s: sheet 2, sheet 3', 'got ' + st.pad.n);
    check(st.book.length === 2 && st.pad.seed === 98, 'tearing off a blank sheet throws it away');
    SQ.open(st, 12, o());
    check(st.pad.kind === 'extra', 'later that day the pad stays on the extra sheet');
    st.day = 11; SQ.open(st, 12, o());
    check(st.pad.kind === 'extra', 'today\'s squiggle is not handed out twice once it has been torn off');
    // undo and redo
    const sh = SQ.sheet({id: 'x', kind: 'extra', seed: 1});
    ink(sh); ink(sh); SQ.undo(sh);
    check(sh.strokes.length === 1 && sh.redo.length === 1, 'undo takes the last stroke back and keeps it');
    SQ.redo(sh); check(sh.strokes.length === 2 && !sh.redo.length, 'redo puts it back');
    SQ.undo(sh); ink(sh); check(!sh.redo.length, 'a new stroke clears what undo kept');
    check(SQ.undo(SQ.sheet({id: 'y'})) === null && SQ.redo(SQ.sheet({id: 'y'})) === null, 'undo and redo on an empty sheet do nothing');
    // the sketchbook
    const before = st.pad, back = st.book[1];
    ink(st.pad);
    SQ.reopen(st, back.id, o());
    check(st.pad === back && back.torn === 0 && st.book[0] === before, 'taking a sheet back out files the one on the pad');
    const r = SQ.remove(st, before.id);
    check(r && st.book.indexOf(before) < 0, 'a sheet can be removed');
    SQ.restore(st, r); check(st.book[r.index] === before, 'and put back where it was');
    // links
    const pad0 = st.pad;
    SQ.receive(st, 'extra', 555, 12, o());
    check(st.pad.seed === 555 && st.book[0] === pad0, 'a sent squiggle arrives on a fresh sheet, the drawing before it filed');
    const st2 = {pad: null, book: [], day: 0}; SQ.open(st2, 30, o()); const today = st2.pad;
    check(SQ.receive(st2, 'day', 30, 30, o()) === null && st2.pad === today, 'a link to today\'s squiggle while drawing today\'s does nothing');
    SQ.receive(st2, 'day', 7, 30, o()); check(st2.pad.kind === 'day' && st2.pad.day === 7 && st2.book.length === 0, 'a link to an old day brings that day\'s squiggle; the blank sheet it replaces is dropped');
}

if (suites.includes('saves')) {
    section('saves');
    const sh = SQ.sheet({id: 'a', kind: 'day', day: 3, seed: SQ.daySeed(3), wide: true, created: 5});
    for (let i = 0; i < 5; i++) SQ.addStroke(sh, hand(SQ.TOOLS[i], i, scribble(SQ.rng(i + 1), 4, 1500, 1000), 1));
    SQ.undo(sh);
    const back = SQ.unpack(JSON.parse(JSON.stringify(SQ.pack(sh))));
    check(same(back.strokes, sh.strokes) && back.wide && back.day === 3 && back.seed === sh.seed && back.id === 'a', 'a packed sheet unpacks to the same sheet');
    check(back.redo.length === 0, 'what undo kept is not saved');
    const npts = sh.strokes.reduce((a, s) => a + s.pts.length, 0), len = JSON.stringify(SQ.pack(sh)).length;
    check(len < 300 + npts * 9, 'a packed sheet costs a few bytes a point', len + ' chars for ' + npts + ' points');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
