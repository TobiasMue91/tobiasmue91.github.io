#!/usr/bin/env node
// Test suite for games/blockdrop.html (Boogie Woogie).
//
// Runs the page's DOM-free <script id="core">: the rules of a modern falling-block game. Most of
// what can go wrong there looks right on the screen - a kick table with one sign flipped turns
// pieces correctly almost everywhere, a T-spin that scores as a mini, a back-to-back that never
// ends - so every rule is checked against something that does not come from the page:
//
//   srs     rotation against a reference written the other way round (true rotation about a
//           centre plus the guideline's offset tables), on thousands of random boards
//   spin    the classic T-spin double and mini set-ups, and the three-corner rule against a plain
//           reference after every T locked in random play
//   score   every point of thousands of random and bot games against a scorer written here
//   bag     seven-bags, seeds, the daily seed
//   timing  gravity, soft drop, lock delay and its fifteen resets, the clear delay, the clock
//   bots    a bot plays Marathon; the board stays consistent, a save made at any moment resumes
//           identically, and a decent player reaches level 15
//
//   auto    sink and clone, and the band's own player (Watch): every key it plans is legal, it
//           keeps time (a short plan per piece, one drop at its end), plays for quads, never tops out
//
//   node test/blockdrop.mjs                 # everything
//   node test/blockdrop.mjs srs spin        # named suites only
//   node test/blockdrop.mjs --page=x.html   # another copy of the page

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'blockdrop.html'));
const ALL = ['srs', 'spin', 'score', 'bag', 'timing', 'bots', 'auto'];
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
const auto = HTML.match(/<script id="auto">([\s\S]*?)<\/script>/);
vm.runInContext(core[1] + '\n' + (auto ? auto[1] : '') + '\nthis.BW = BW; this.AUTO = typeof AUTO === "undefined" ? null : AUTO;', ctx);
const BW = ctx.BW, AUTO = ctx.AUTO;
const {W, H} = BW;

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const key = cells => cells.map(([x, y]) => x + ',' + y).sort().join(' ');
const clone = g => BW.load(JSON.parse(JSON.stringify(BW.save(g))));
function fresh(seed = 1, o = {}) { const g = BW.create({seed, ...o}); BW.start(g); g.events.length = 0; return g; }
function setRows(g, rows) { // rows: strings top to bottom, bottom-aligned; X = filled
    g.board.fill(0);
    rows.forEach((row, i) => {
        const y = H - rows.length + i;
        [...row].forEach((ch, x) => { if (ch !== '.') g.board[y * W + x] = 1 + 16 * (100 + i); });
    });
}
const filled = g => g.board.filter(v => v).length;

// ---------------------------------------------------------------- reference SRS
// Pieces as cells around a rotation centre (y up), turned by true rotation, then nudged by the
// difference of two rows of the guideline's offset tables. Nothing here is copied from the page.
const REF = {
    J: [[-1, 1], [-1, 0], [0, 0], [1, 0]], L: [[1, 1], [-1, 0], [0, 0], [1, 0]],
    S: [[0, 1], [1, 1], [-1, 0], [0, 0]], T: [[0, 1], [-1, 0], [0, 0], [1, 0]],
    Z: [[-1, 1], [0, 1], [0, 0], [1, 0]], I: [[-1, 0], [0, 0], [1, 0], [2, 0]],
    O: [[0, 0], [1, 0], [0, 1], [1, 1]],
};
const OFF3 = [[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]];
const OFFI = [[[0, 0], [-1, 0], [2, 0], [-1, 0], [2, 0]], [[-1, 0], [0, 0], [0, 0], [0, 1], [0, -2]],
    [[-1, 1], [1, 1], [-2, 1], [1, 0], [-2, 0]], [[0, 1], [0, 1], [0, 1], [0, -1], [0, 2]]];
const OFFO = [[[0, 0]], [[0, -1]], [[-1, -1]], [[-1, 0]]];
function refCells(p) { // p = {k, r, cx, cy}; board y grows downward
    let cells = REF[p.k];
    for (let i = 0; i < p.r; i++) cells = cells.map(([x, y]) => [y, -x]);
    return cells.map(([x, y]) => [p.cx + x, p.cy - y]);
}
function refFree(g, cells) { return cells.every(([x, y]) => x >= 0 && x < W && y >= 0 && y < H && !g.board[y * W + x]); }
function refRotate(g, p, dir) {
    const to = (p.r + dir + 4) % 4, table = p.k === 'I' ? OFFI : p.k === 'O' ? OFFO : OFF3;
    for (let i = 0; i < table[0].length; i++) {
        const dx = table[p.r][i][0] - table[to][i][0], dy = table[p.r][i][1] - table[to][i][1];
        const q = {k: p.k, r: to, cx: p.cx + dx, cy: p.cy - dy};
        if (refFree(g, refCells(q))) return {p: q, kick: i};
    }
    return null;
}

if (suites.includes('srs')) {
    section('srs');
    const R = mulberry(11);
    // spawn: the guideline's columns, one row into view
    for (const k of BW.KINDS) {
        const g = fresh(1);
        g.queue.unshift(k); g.cur = null;
        g.are = 1; BW.tick(g, 1);
        const xs = BW.cellsOf(g.cur).map(c => c[0]), ys = BW.cellsOf(g.cur).map(c => c[1]);
        const want = k === 'I' ? [3, 6] : k === 'O' ? [4, 5] : [3, 5];
        check(Math.min(...xs) === want[0] && Math.max(...xs) === want[1], `${k} spawns in columns ${want.join('-')}`, xs.join());
        check(Math.max(...ys) === BW.TOP, `${k} shows its lowest row at the top of the well`, ys.join());
    }
    // four turns either way come home; a turn and its inverse undo each other
    for (const k of BW.KINDS) {
        const g = fresh(1); g.cur = {k, r: 0, x: 3, y: 30};
        const start = key(BW.cellsOf(g.cur));
        for (let i = 0; i < 4; i++) BW.rotate(g, 1);
        check(key(BW.cellsOf(g.cur)) === start, `${k}: four clockwise turns in the open return home`);
        BW.rotate(g, 1); BW.rotate(g, -1);
        check(key(BW.cellsOf(g.cur)) === start, `${k}: a turn and its inverse cancel`);
    }
    // random boards: every turn lands where the reference says, with the same kick
    let trials = 0, bad = 0, kicked = 0, firstBad = '';
    for (let n = 0; n < 6000; n++) {
        const g = fresh(n);
        const density = R() * 0.6, rows = 6 + Math.floor(R() * 14);
        g.board.fill(0);
        for (let y = H - rows; y < H; y++) for (let x = 0; x < W; x++) if (R() < density) g.board[y * W + x] = 1 + 16 * 5;
        const k = BW.KINDS[Math.floor(R() * 7)];
        // place the reference piece somewhere it fits, and the page's piece on the same cells
        let p = null;
        for (let tries = 0; tries < 50 && !p; tries++) {
            const q = {k, r: Math.floor(R() * 4), cx: Math.floor(R() * W), cy: H - 1 - Math.floor(R() * (rows + 2))};
            if (refFree(g, refCells(q))) p = q;
        }
        if (!p) continue;
        let cur = null;
        for (let x = -3; x < W + 3 && !cur; x++) for (let y = H - 30; y < H + 3 && !cur; y++) {
            const c = {k, r: p.r, x, y};
            if (key(BW.cellsOf(c)) === key(refCells(p))) cur = c;
        }
        if (!cur) { bad++; firstBad = firstBad || `no page state matches reference ${JSON.stringify(p)}`; continue; }
        g.cur = cur;
        for (let step = 0; step < 6; step++) {
            const dir = R() < 0.5 ? 1 : -1;
            const want = refRotate(g, p, dir);
            g.events.length = 0;
            const ok = BW.rotate(g, dir);
            trials++;
            const ev = g.events.find(e => e.t === 'rotate');
            const same = want ? ok && key(BW.cellsOf(g.cur)) === key(refCells(want.p)) && (k === 'O' || ev.kick === want.kick)
                : !ok && key(BW.cellsOf(g.cur)) === key(refCells(p));
            if (!same) { bad++; if (!firstBad) firstBad = `${k} r${p.r} dir ${dir}: want ${want ? key(refCells(want.p)) + ' kick ' + want.kick : 'no turn'}, got ${key(BW.cellsOf(g.cur))}`; break; }
            if (want) { p = want.p; if (want.kick) kicked++; }
        }
    }
    check(bad === 0, `${trials} turns on random boards match the offset-table reference (${kicked} needed a kick)`, firstBad);
    check(kicked > 500, 'the random boards exercise the kicks', `${kicked} kicked turns`);
}

// ---------------------------------------------------------------- T-spins
// The rule as the guideline states it: a T whose last move was a turn, with three of the four
// squares diagonal to its centre filled (walls and floor count); a mini unless both squares on
// the side it points to are filled, or the turn needed the fifth kick.
function refSpin(g, cur, lastKick) {
    if (cur.k !== 'T' || lastKick == null) return null;
    const cells = BW.cellsOf(cur);
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    // the centre is the only cell with three neighbours in the piece
    const centre = cells.find(([x, y]) => cells.filter(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1).length === 3);
    const [cx, cy] = centre;
    const full = (x, y) => x < 0 || x >= W || y >= H || (y >= 0 && g.board[y * W + x] !== 0);
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    if (corners.filter(([dx, dy]) => full(cx + dx, cy + dy)).length < 3) return null;
    // the nub: the cell that is not in line with the other three
    const nub = cells.find(([x, y]) => (x === cx) !== (y === cy) && !(xs.filter(v => v === x).length === 3 || ys.filter(v => v === y).length === 3));
    const [nx, ny] = [nub[0] - cx, nub[1] - cy];
    const front = nx === 0 ? [[-1, ny], [1, ny]] : [[nx, -1], [nx, 1]];
    const frontFull = front.filter(([dx, dy]) => full(cx + dx, cy + dy)).length;
    return frontFull === 2 || lastKick === 4 ? 'full' : 'mini';
}

if (suites.includes('spin')) {
    section('spin');
    { // the T-spin double every player learns first
        const g = fresh(1);
        setRows(g, ['...X......', 'XXX...XXXX', 'XXXX.XXXXX']);
        g.cur = {k: 'T', r: 1, x: 3, y: H - 3};
        check(BW.fits(g, 'T', 1, 3, H - 3), 'TSD: the T stands in the slot pointing right');
        const ok = BW.rotate(g, 1);
        check(ok && key(BW.cellsOf(g.cur)) === key([[3, H - 2], [4, H - 2], [5, H - 2], [4, H - 1]]), 'TSD: it turns down into the slot without a kick');
        g.events.length = 0;
        BW.hardDrop(g);
        const c = g.events.find(e => e.t === 'clear');
        check(c && c.n === 2 && c.spin === 'full', 'TSD scores as a full T-spin double', JSON.stringify(c && {n: c.n, spin: c.spin}));
        check(c && c.points === 1200, 'TSD at level 1 is worth 1200', c && c.points);
        check(filled(g) === 1, 'TSD leaves only the roof', filled(g));
    }
    { // a mini: three corners, but only one in front
        const g = fresh(1);
        setRows(g, ['X.........', '..........', 'X.X.......']);
        g.cur = {k: 'T', r: 3, x: 0, y: H - 3};
        check(BW.fits(g, 'T', 3, 0, H - 3), 'mini: the T stands pointing left');
        BW.rotate(g, 1);
        g.events.length = 0;
        BW.hardDrop(g);
        const c = g.events.find(e => e.t === 'clear');
        check(c && c.n === 0 && c.spin === 'mini' && c.points === 100, 'mini without lines: T-spin mini, 100', JSON.stringify(c && {n: c.n, spin: c.spin, p: c.points}));
    }
    { // a T that moved after turning is no spin
        const g = fresh(1);
        setRows(g, ['...X......', 'XXX...XXXX', 'XXXX.XXXXX']);
        g.cur = {k: 'T', r: 2, x: 4, y: H - 3};
        BW.move(g, -1);
        g.events.length = 0;
        BW.hardDrop(g);
        const c = g.events.find(e => e.t === 'clear');
        check(c && c.spin == null && c.n === 2 && c.points === 300, 'sliding a T in is a plain double', JSON.stringify(c && {n: c.n, spin: c.spin}));
    }
    // random play: every T that locks is judged as the reference judges it
    const R = mulberry(5);
    let judged = 0, spins = 0, minis = 0, bad = '';
    for (let n = 0; n < 1500 && !bad; n++) {
        const g = fresh(1000 + n);
        // a ragged board with T-shaped holes
        for (let y = H - 8; y < H; y++) for (let x = 0; x < W; x++) if (R() < 0.55) g.board[y * W + x] = 1 + 16 * 7;
        for (let p = 0; p < 30 && !g.over; p++) {
            if (!g.cur) { BW.tick(g, BW.CLEAR_DELAY); continue; }
            g.cur.k = R() < 0.6 ? 'T' : g.cur.k;
            if (!BW.fits(g, g.cur.k, g.cur.r, g.cur.x, g.cur.y)) break;
            let lastKick = null;
            for (let m = 0; m < 12; m++) {
                const a = R();
                g.events.length = 0;
                if (a < 0.3) { if (BW.move(g, R() < .5 ? -1 : 1)) lastKick = null; }
                else if (a < 0.6) { if (BW.rotate(g, R() < .5 ? -1 : 1)) lastKick = g.events.find(e => e.t === 'rotate').kick; }
                else { // drop to the floor by gravity, which keeps a turn the last move only if no row fell
                    const before = g.cur.y;
                    while (BW.fits(g, g.cur.k, g.cur.r, g.cur.x, g.cur.y + 1)) g.cur.y++;
                    if (g.cur.y !== before) { lastKick = null; g.lastRot = null; }
                }
            }
            const was = {...g.cur}, want = refSpin(g, was, lastKick);
            g.events.length = 0;
            const yBefore = g.cur.y;
            BW.hardDrop(g);
            const lockEv = g.events.find(e => e.t === 'lock');
            if (!lockEv) break;
            if (g.events.find(e => e.t === 'lock').cells[0][1] !== BW.cellsOf(was)[0][1] || yBefore !== was.y) { continue; }
            if (was.k === 'T') {
                judged++;
                if (want) { spins++; if (want === 'mini') minis++; }
                if ((lockEv.spin || null) !== want) bad = `T at r${was.r} (${was.x},${was.y}) kick ${lastKick}: page says ${lockEv.spin}, reference ${want}`;
            }
        }
    }
    check(!bad, `${judged} T locks judged like the three-corner reference (${spins} spins, ${minis} minis)`, bad);
    check(spins - minis > 3 && minis > 10, 'random play reaches both kinds of spin', `${spins} spins, ${minis} minis`);
}

// ---------------------------------------------------------------- scoring reference
// The guideline table, written plainly. Points for a lock depend on the lines, the spin, the
// back-to-back chain, the combo, an all clear and the level the lines were cleared at.
function refScorer() {
    let b2b = false, combo = -1;
    return ev => { // ev: {n, spin, allClear, level}
        const {n, spin, level} = ev;
        let base = spin === 'full' ? [400, 800, 1200, 1600][n] : spin === 'mini' ? [100, 200, 400, 400][n] : [0, 100, 300, 500, 800][n];
        let bonus = false;
        if (n > 0) {
            const hard = n === 4 || !!spin;
            if (hard && b2b) { base *= 1.5; bonus = true; }
            b2b = hard;
            combo++;
        } else combo = -1;
        let pts = base * level;
        if (n > 0 && combo > 0) pts += 50 * combo * level;
        if (ev.allClear) pts += (n === 4 && bonus ? 3200 : [0, 800, 1200, 1800, 2000][n]) * level;
        return {pts: Math.round(pts), b2b: bonus, combo: n > 0 ? combo : -1};
    };
}

// ---------------------------------------------------------------- a bot
// Tries every turn and column the way a player would reach them (turn, then shift, then drop)
// and keeps the placement with the best Dellacherie-style score.
function evaluate(g) {
    const top = new Array(W).fill(H);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (g.board[y * W + x]) { top[x] = y; break; }
    const heights = top.map(t => H - t);
    let holes = 0, bump = 0, wells = 0;
    for (let x = 0; x < W; x++) {
        for (let y = top[x] + 1; y < H; y++) if (!g.board[y * W + x]) holes++;
        if (x) bump += Math.abs(heights[x] - heights[x - 1]);
        const l = x ? heights[x - 1] : 99, r = x < W - 1 ? heights[x + 1] : 99;
        const d = Math.min(l, r) - heights[x];
        if (d > 0) wells += d * (d + 1) / 2;
    }
    const agg = heights.reduce((a, b) => a + b, 0);
    return -0.51 * agg - 0.36 * holes * 2 - 0.18 * bump - 0.2 * wells;
}
function plans(g) {
    const out = [];
    for (let r = 0; r < 4; r++) for (let dx = -5; dx <= 5; dx++) out.push({r, dx});
    return out;
}
function perform(g, plan) {
    for (let i = 0; i < plan.r; i++) if (!BW.rotate(g, 1)) return false;
    const s = Math.sign(plan.dx);
    for (let i = 0; i < Math.abs(plan.dx); i++) if (!BW.move(g, s)) return false;
    return BW.hardDrop(g);
}
function botMove(g) {
    let best = null, bestScore = -Infinity;
    for (const plan of plans(g)) {
        const h = clone(g);
        if (!perform(h, plan) || h.over) continue;
        const cleared = h.lines - g.lines;
        const s = evaluate(h) + cleared * 0.76;
        if (s > bestScore) { bestScore = s; best = plan; }
    }
    return best;
}

if (suites.includes('score')) {
    section('score');
    // random play with a random-but-legal driver: every point accounted for
    const R = mulberry(9);
    let games = 0, locks = 0, bad = '';
    const kinds = {spin: 0, b2b: 0, combo: 0, allClear: 0, quad: 0};
    for (let n = 0; n < 300 && !bad; n++) {
        const g = fresh(2000 + n);
        if (n % 3 === 0) setRows(g, new Array(8).fill('XXXXXXXXX.')); // two quads waiting: back-to-back
        if (n % 3 === 1) setRows(g, ['...X......', 'XXX...XXXX', 'XXXX.XXXXX']);
        const ref = refScorer();
        let expect = 0;
        games++;
        for (let p = 0; p < 120 && !g.over && !bad; p++) {
            if (!g.cur) { BW.tick(g, BW.CLEAR_DELAY); continue; }
            if (n % 3 === 0 && p < 2) g.cur = {k: 'I', r: 0, x: 3, y: g.cur.y};
            if (n % 3 === 1 && p < 1) g.cur.k = 'T';
            const plan = R() < 0.7 ? botMove(g) : {r: Math.floor(R() * 4), dx: Math.floor(R() * 11) - 5};
            if (n % 3 === 0 && p < 2) { plan.r = 1; plan.dx = 4; }
            if (n % 3 === 1 && p === 0) { g.cur = {k: 'T', r: 1, x: 3, y: H - 3}; plan.r = 1; plan.dx = 0; }
            if (!plan) break;
            const before = g.score, lvl = g.level;
            g.events.length = 0;
            for (let i = 0; i < plan.r; i++) BW.rotate(g, 1);
            for (let i = 0; i < Math.abs(plan.dx); i++) BW.move(g, Math.sign(plan.dx));
            const y0 = g.cur ? g.cur.y : 0;
            if (!BW.hardDrop(g)) break;
            locks++;
            const lock = g.events.find(e => e.t === 'lock');
            const clr = g.events.find(e => e.t === 'clear');
            const n2 = clr ? clr.n : 0, spin = lock.spin || null;
            const r = ref({n: n2, spin, allClear: !!(clr && clr.allClear), level: lvl});
            const want = r.pts + 2 * lock.dist;
            if (spin) kinds.spin++; if (r.b2b) kinds.b2b++; if (r.combo > 0) kinds.combo++; if (clr && clr.allClear) kinds.allClear++; if (n2 === 4) kinds.quad++;
            if (g.score - before !== want) bad = `game ${n} lock ${p}: ${n2} lines, spin ${spin}, level ${lvl}: page +${g.score - before}, reference +${want}`;
            if (clr && (clr.b2b !== r.b2b || clr.combo !== r.combo)) bad = `game ${n} lock ${p}: back-to-back/combo flags ${clr.b2b}/${clr.combo}, reference ${r.b2b}/${r.combo}`;
            expect += want;
        }
    }
    check(!bad, `${locks} locks over ${games} games score exactly as the reference table`, bad);
    check(kinds.spin > 20 && kinds.b2b > 5 && kinds.combo > 20 && kinds.quad > 50, 'the games reach spins, back-to-backs, combos and quads', JSON.stringify(kinds));
    { // all clear
        const g = fresh(3);
        setRows(g, ['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.']);
        g.cur = {k: 'I', r: 1, x: 7, y: H - 4};
        g.events.length = 0;
        BW.hardDrop(g);
        const c = g.events.find(e => e.t === 'clear');
        check(c && c.allClear && c.points === 800 + 2000 && filled(g) === 0, 'a quad that empties the well: 800 + 2000 all clear', JSON.stringify(c && {pc: c.allClear, p: c.points}));
    }
    { // soft drop: a point a row, and only while the player holds it
        const g = fresh(4);
        const s0 = g.score;
        BW.setSoft(g, true);
        BW.tick(g, 50 * 5 + 1);
        check(g.score - s0 === 5, 'soft drop at level 1: five rows in a quarter second, a point each', g.score - s0);
        BW.setSoft(g, false);
        BW.tick(g, 999);
        check(g.score - s0 === 5, 'gravity alone scores nothing', g.score - s0);
    }
}

if (suites.includes('bag')) {
    section('bag');
    for (const seed of [1, 2, 99, -5, 123456789]) {
        const g = BW.create({seed});
        const seq = [];
        BW.start(g);
        seq.push(g.cur.k);
        for (let i = 0; i < 139; i++) { g.cur = null; g.are = 1; BW.tick(g, 1); seq.push(g.cur.k); }
        let ok = true;
        for (let i = 0; i < seq.length; i += 7) if (seq.slice(i, i + 7).sort().join('') !== 'IJLOSTZ') ok = false;
        check(ok, `seed ${seed}: every bag of seven holds each piece once`, seq.join(''));
        const h = BW.create({seed}); BW.start(h);
        const seq2 = [h.cur.k, ...h.queue.slice(0, 6)];
        check(seq2.join('') === seq.slice(0, 7).join(''), `seed ${seed}: the same seed deals the same pieces`);
    }
    const a = BW.create({seed: 1}), b = BW.create({seed: 2});
    check(a.queue.join('') !== b.queue.join(''), 'different seeds deal differently');
    check(BW.hashSeed('2026-10-02') === BW.hashSeed('2026-10-02') && BW.hashSeed('2026-10-02') !== BW.hashSeed('2026-10-03'), 'the daily seed is fixed by the date');
    // over many bags, every piece is equally common in each slot of the bag
    const counts = {};
    const g = BW.create({seed: 77}); BW.start(g);
    for (let i = 0; i < 7000; i++) { const k = i ? (g.cur = null, g.are = 1, BW.tick(g, 1), g.cur.k) : g.cur.k; const slot = i % 7; counts[slot + k] = (counts[slot + k] || 0) + 1; }
    const vals = Object.values(counts);
    check(vals.length === 49 && Math.min(...vals) > 100 && Math.max(...vals) < 200, 'shuffles are fair: each piece shows up in each bag slot about equally', `${Math.min(...vals)}..${Math.max(...vals)}`);
}

if (suites.includes('timing')) {
    section('timing');
    const g = fresh(5);
    const y0 = g.cur.y;
    BW.tick(g, 999);
    check(g.cur.y === y0, 'level 1: nothing falls before a second', g.cur.y - y0);
    BW.tick(g, 2);
    check(g.cur.y === y0 + 1, 'level 1: one row a second', g.cur.y - y0);
    check(Math.abs(BW.gravity(1) - 1) < 1e-9 && Math.abs(BW.gravity(5) - 0.355) < 0.001 && BW.gravity(20) === 0, 'gravity follows the guideline curve, instant from level 20');
    { // lock delay with no input
        const h = fresh(6);
        while (BW.fits(h, h.cur.k, h.cur.r, h.cur.x, h.cur.y + 1)) h.cur.y++;
        h.events.length = 0;
        BW.tick(h, BW.LOCK_DELAY - 1);
        check(h.pieces === 0, 'a grounded piece waits out the lock delay');
        BW.tick(h, 2);
        check(h.pieces === 1, 'and locks when it runs out');
    }
    { // fifteen resets, and no more
        const h = fresh(7);
        h.cur.k = 'T';
        while (BW.fits(h, h.cur.k, h.cur.r, h.cur.x, h.cur.y + 1)) h.cur.y++;
        let n = 0;
        for (let i = 0; i < 40 && !h.pieces; i++) { BW.tick(h, BW.LOCK_DELAY - 10); if (!h.pieces) { BW.move(h, i % 2 ? 1 : -1); n++; } }
        check(h.pieces === 1 && n === BW.MAX_RESETS + 1, `fifteen moves buy time; the sixteenth does not (${n} moves)`);
    }
    { // a new lowest row restores the resets
        const h = fresh(8);
        setRows(h, ['XXXX..XXXX', 'XXXX..XXXX', 'XXXX.XXXXX']);
        h.cur = {k: 'O', r: 0, x: 0, y: H - 5}; // resting on the left shoulder
        h.lowest = h.cur.y;
        for (let i = 0; i < 10; i++) BW.move(h, i % 2 ? -1 : 1);
        const before = h.resets;
        BW.move(h, 1); BW.move(h, 1); BW.move(h, 1); // over the gap
        BW.tick(h, 1001);
        check(before === 10 && h.lowest > H - 5 && h.resets === 0, 'falling to a new lowest row restores the resets', `resets ${before} then ${h.resets}, lowest ${h.lowest - H}`);
    }
    { // the clear delay, and turns pressed during it
        const h = fresh(9);
        setRows(h, ['XXXXXXXXX.']);
        h.cur = {k: 'I', r: 1, x: 7, y: H - 4};
        BW.hardDrop(h);
        check(!h.cur && h.are === BW.CLEAR_DELAY, 'a clear holds the next piece for the clear delay');
        BW.rotate(h, 1);
        BW.tick(h, BW.CLEAR_DELAY);
        check(h.cur && h.cur.r === 1, 'a turn pressed during the clear delay is applied as the piece appears');
    }
    { // the daily clock
        const h = fresh(10, {timeLimit: 120000});
        for (let t = 0; t < 130000 && !h.over; t += 16) { BW.tick(h, 16); if (h.cur && t % 800 < 16) { const p = botMove(h); if (p) perform(h, p); } }
        check(h.over && h.overReason === 'time' && h.elapsed === 120000, 'the daily ends at exactly two minutes', `${h.overReason} at ${h.elapsed}`);
    }
    { // block out
        const h = fresh(11);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x !== 0 && y >= 18) h.board[y * W + x] = 17;
        h.cur = {k: 'I', r: 1, x: -1, y: 10};
        BW.hardDrop(h);
        check(h.over && (h.overReason === 'block' || h.overReason === 'lock'), 'a piece that cannot appear ends the game', h.overReason);
    }
}

if (suites.includes('bots')) {
    section('bots');
    const GAMES = +opt('games', 4);
    let reached = 0, badState = '', badResume = '';
    for (let n = 0; n < GAMES; n++) {
        const g = fresh(500 + n);
        let saveAt = 40 + n * 37, copy = null, inputs = [];
        let t = 0;
        while (!g.over && g.lines < 150 && t < 2e6) {
            if (!g.cur) { BW.tick(g, 16); if (copy) BW.tick(copy, 16); t++; continue; }
            if (g.pieces === saveAt && !copy) copy = clone(g);
            const plan = botMove(g);
            if (!plan) break;
            const linesBefore = g.lines, cellsBefore = filled(g);
            perform(g, plan);
            if (copy) perform(copy, plan);
            const want = cellsBefore + 4 - 10 * (g.lines - linesBefore);
            if (filled(g) !== want && !badState) badState = `game ${n}, piece ${g.pieces}: ${filled(g)} cells, expected ${want}`;
            for (let i = 0; i < W * H; i++) { const v = g.board[i]; if (v && ((v & 7) < 1 || (v & 7) > 7) && !badState) badState = `bad cell ${v}`; }
            t++;
        }
        if (copy && JSON.stringify(BW.save(copy)) !== JSON.stringify(BW.save(g)) && !badResume) badResume = `game ${n}: a save made at piece ${saveAt} played on differently`;
        if (g.lines >= 150) reached++;
        console.log(`  bot ${n}: ${g.lines} lines, level ${g.level}, ${g.score} points${g.over ? ' (topped out)' : ''}`);
    }
    check(!badState, 'every lock adds four cells and every cleared row takes ten', badState);
    check(!badResume, 'a game saved at any moment resumes identically', badResume);
    check(reached >= GAMES - 1, `a careful bot reaches level 15 in Marathon (${reached}/${GAMES})`);
}

if (suites.includes('auto')) {
    section('auto');
    { // sink: to the floor, a point a row, still movable; a T sunk into its slot can still turn in
        const g = fresh(21);
        setRows(g, ['...X......', 'XXX...XXXX', 'XXXX.XXXXX']);
        g.cur = {k: 'T', r: 1, x: 3, y: 26};
        const s0 = g.score, d = BW.sink(g);
        check(d === H - 3 - 26 && g.score - s0 === d && g.cur && g.pieces === 0, 'sink drops to the floor, a point a row, and does not lock', `${d} rows, +${g.score - s0}`);
        BW.rotate(g, 1);
        g.events.length = 0;
        BW.hardDrop(g);
        const c = g.events.find(e => e.t === 'clear');
        check(c && c.spin === 'full' && c.n === 2, 'a T sunk beside its slot and turned in is a T-spin double', JSON.stringify(c && {n: c.n, spin: c.spin}));
    }
    { // clone: a copy plays on alone and the same keys give the same game
        const g = fresh(22), h = BW.clone(g);
        for (const x of [g, h]) { BW.move(x, -1); BW.rotate(x, 1); BW.hardDrop(x); BW.tick(x, 1); BW.hold(x); BW.hardDrop(x); }
        const o = BW.clone(g);
        BW.hardDrop(o);
        check(JSON.stringify(BW.save(g)) === JSON.stringify(BW.save(h)) && o.pieces === g.pieces + 1, 'a clone plays exactly like the original, and apart from it');
    }
    if (!AUTO) fail('no <script id="auto"> block in the page');
    else {
        const DO = {hold: g => BW.hold(g), cw: g => BW.rotate(g, 1), ccw: g => BW.rotate(g, -1), L: g => BW.move(g, -1), R: g => BW.move(g, 1),
            sink: g => BW.sink(g) >= 0, drop: g => BW.hardDrop(g)};
        const PIECES = +opt('pieces', 500);
        let bad = '', longest = 0, lines = 0, quadLines = 0, over = 0, plans = 0, maxH = 0;
        for (const seed of [31, 32, 33]) {
            const g = fresh(seed);
            while (!g.over && g.pieces < PIECES && !bad) {
                if (!g.cur) { BW.tick(g, BW.CLEAR_DELAY); continue; }
                const keys = AUTO.plan(g);
                plans++;
                longest = Math.max(longest, keys.length);
                if (keys.indexOf('drop') !== keys.length - 1) bad = `seed ${seed}: plan ${keys.join(' ')} does not end in its one drop`;
                g.events.length = 0;
                const before = g.pieces;
                for (const k of keys) if (!DO[k](g)) { bad = bad || `seed ${seed}, piece ${g.pieces}: '${k}' refused in ${keys.join(' ')}`; break; }
                if (g.pieces !== before + 1 && !bad) bad = `seed ${seed}: a plan placed ${g.pieces - before} pieces`;
                for (const e of g.events) if (e.t === 'clear' && e.n) { lines += e.n; if (e.n === 4) quadLines += 4; }
                maxH = Math.max(maxH, AUTO.shape(g.board).max);
            }
            if (g.over) over++;
        }
        check(!bad, `${plans} plans of the band's player are all legal, each ending in one drop`, bad);
        check(longest <= 12, `a piece never takes more than twelve keys, so it lands within a bar and a half (longest ${longest})`);
        check(over === 0, `three games of ${PIECES} pieces without topping out (highest stack ${maxH} rows)`);
        check(quadLines >= .35 * lines, `it plays for quads: ${quadLines} of ${lines} rows go four at a time`);
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
