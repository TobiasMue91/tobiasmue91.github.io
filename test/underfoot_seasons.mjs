#!/usr/bin/env node
// Test suite for playground/underfoot_seasons.html, the "four seasons" prototype.
//
// The prototype's whole claim is that the season is the key: one map, and each season opens
// ways the others close. That is checkable without playing. A reachability graph over
// (season, stretch of ground) explores the garden with the real physics, switching seasons
// only at stumps and only once their token has been found, and must show that the nest can be
// reached, that it cannot be reached without winter, that nothing you can get to is a dead end,
// and how much of the garden each season adds.
//
//   node test/underfoot_seasons.mjs                  # everything (about a minute)
//   node test/underfoot_seasons.mjs water            # named suites only
//   node test/underfoot_seasons.mjs --page=other.html
//
// Suites: tiles, water, wind, stumps, map.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'playground', 'underfoot_seasons.html');
const ALL = ['tiles', 'water', 'wind', 'stumps', 'map'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);
const note = text => console.log(`  ${text}`);

const HTML = readFileSync(PAGE, 'utf8');
const block = id => HTML.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`))[1];
const ctx = vm.createContext({});
vm.runInContext(block('core') + '\nthis.UF = UF;', ctx);
vm.runInContext(block('levels') + '\nthis.LEVELS = LEVELS;', ctx);
const UF = ctx.UF, LEVELS = ctx.LEVELS, P = UF.P, FX = UF.FX, TILE = UF.TILE, IN = UF.IN, K = UF.K;
const fmt = v => (Math.round(v * 100) / 100).toFixed(2);
const tiles = v => v / TILE;
const SUMMER = 0, AUTUMN = 1, WINTER = 2;

// a small room: `rows` of characters, the player at '@'
const room = (rows, opts = {}) => UF.newGame(UF.parseLevel({id: 't', rows}), Object.assign({viewW: 16}, opts));
const run = (s, n, h = 0, until) => { for (let i = 0; i < n; i++) { UF.step(s, {h}); if (until && until(s)) return i + 1; } return n; };

/* ================= tiles ================= */
if (suites.includes('tiles')) {
    section('tiles');
    const expect = {
        '_': ['water', 'water', 'solid'], 'A': ['water', 'ledge', 'solid'], 'L': ['ledge', 'empty', 'empty'],
        'S': ['empty', 'empty', 'solid'], 'D': ['empty', 'draft', 'empty'], '~': ['water', 'water', 'water'],
        'Y': ['ledge', 'ledge', 'ledge'], 'W': ['solid', 'solid', 'solid'], 'K': ['solid', 'solid', 'solid'],
    };
    const name = ['empty', 'solid', 'ledge', 'water', 'draft'];
    for (const [c, want] of Object.entries(expect)) {
        const code = UF.parseLevel({id: 't', rows: ['@' + c, '##']}).tiles[1];
        const got = [0, 1, 2].map(si => name[UF.KIND[si][code]]);
        check(got.join() === want.join(), `'${c}' is ${want.join(' / ')} in summer / autumn / winter`, `got ${got.join(' / ')}`);
    }
}

/* ================= water ================= */
if (suites.includes('water')) {
    section('water');
    // a pond: banks one and three tiles above the surface
    const pond = [
        '...........................',
        '...........................',
        '###.......................#',
        '###.......................#',
        '###.....................@.#',
        '###.................#######',
        '###_________________#######',
        '###~~~~~~~~~~~~~~~~~#######',
        '###~~~~~~~~~~~~~~~~~#######',
        '###~~~~~~~~~~~~~~~~~#######',
        '###~~~~~~~~~~~~~~~~~#######',
        '###########################',
    ];
    // left bank top at row 2 (three tiles above the surface row 6... four rows up); right bank top at row 5
    let s = room(pond);
    run(s, 90, IN.L);
    check(s.p.water, 'walking off the bank drops you in the water');
    run(s, 200);
    check(s.p.onGround && s.p.y === 11 * TILE, 'left alone you sink to the bottom');
    let sink = 0;
    s = room(pond); run(s, 90, IN.L);
    for (let i = 0; i < 80; i++) { UF.step(s); sink = Math.max(sink, s.p.vy); }
    check(sink === P.SWIM_SINK, `sinking tops out at ${sink / FX} px/f`);
    // strokes lift you: tap every 12 frames from the bottom
    s = room(pond); run(s, 90, IN.L); run(s, 200);
    const y0 = s.p.y;
    for (let i = 0; i < 120; i++) UF.step(s, {h: i % 12 === 0 ? IN.J : 0});
    check(s.p.y < y0 - 3 * TILE, 'strokes carry you up from the bottom');
    // out of the water: onto the near bank (one tile up), never onto the far one (three and more)
    const exitTo = dir => {
        const t = room(pond); run(t, 90, IN.L); run(t, 200);
        if (!t.p.water) return 'never swam';
        for (let i = 0; i < 600; i++) {
            UF.step(t, {h: dir | (i % 10 === 0 ? IN.J : 0)});
            if (t.p.onGround && !t.p.water && t.p.y <= 5 * TILE) return tiles(t.p.y);
        }
        return null;
    };
    check(exitTo(IN.R) === 5, 'a swimmer climbs out onto a bank a tile above the surface');
    check(exitTo(IN.L) === null, 'but never onto a bank three tiles above it');
    // SMB's swim speed limit
    s = room(pond); run(s, 90, IN.L); run(s, 60, IN.L);
    check(Math.abs(s.p.vx) === P.SWIM_MAX, 'swimming tops out at 1 px/f');
    // winter: the surface is ice you walk on
    s = room(pond, {season: WINTER});
    s.unlocked = [0, 1, 2];
    run(s, 200, IN.L);
    check(!s.p.water && s.p.onGround && s.p.y === 6 * TILE && s.p.x < 6 * TILE, 'in winter the pond is ice you walk across');
}

/* ================= wind ================= */
if (suites.includes('wind')) {
    section('wind');
    const shaft = [];
    // a column of wind two tiles wide, rows 3 to 27, and a ledge at row 6 beside it
    for (let y = 0; y < 30; y++) shaft.push(y >= 28 ? '##########' : y === 27 ? '.@DD......' : y === 6 ? '..DD.#####' : y >= 3 ? '..DD......' : '..........');
    let s = room(shaft, {season: AUTUMN});
    s.unlocked = [0, 1];
    run(s, 12, IN.R);
    let top = s.p.y;
    for (let i = 0; i < 200; i++) { UF.step(s); top = Math.min(top, s.p.y); }
    check(tiles(top) < 4, `standing in the autumn wind lifts you from the ground to row ${fmt(tiles(top))}`);
    run(s, 80, IN.R);
    check(s.p.onGround && s.p.y === 6 * TILE, 'and you can step off it onto the ledge beside its top');
    s = room(shaft, {season: SUMMER});
    run(s, 12, IN.R); run(s, 200);
    check(s.p.y === 28 * TILE, 'in summer there is no wind there');
}

/* ================= stumps ================= */
if (suites.includes('stumps')) {
    section('stumps');
    const yard = ['..........', '..@.T.....', '##########'];
    let s = room(yard);
    run(s, 20, IN.R, t => UF.stumpUnder(t, t.p) >= 0);
    check(UF.stumpUnder(s, s.p) === 0 && s.checkpoint.x === 4 * TILE + TILE / 2, 'reaching a stump makes it the place you start again');
    UF.step(s, {h: IN.U});
    check(s.season === SUMMER, 'with only summer found, up does not change the season');
    s.unlocked = [0, 1, 2];
    UF.step(s, {h: 0});
    const seen = [];
    for (let i = 0; i < 3; i++) { UF.step(s, {h: IN.U}); seen.push(s.season); UF.step(s, {h: 0}); }
    check(seen.join() === '1,2,0', 'with all three, up turns summer to autumn to winter and back', `got ${seen}`);
    const y = s.p.y;
    UF.step(s, {h: IN.U | IN.J});
    check(s.p.onGround && s.p.y === y, 'turning the season does not also jump, even on a key that means both');
    // tokens unlock
    s = room(['..@1.2....', '##########']);
    run(s, 30, IN.R);
    check(s.unlocked.join() === '0,1,2', 'picking up the autumn leaf and the winter crystal unlocks both seasons');
    // the garden's stumps have room to stand, big, in every season
    const L = UF.parseLevel(LEVELS[0]);
    for (const st of L.stumps) for (const si of [0, 1, 2]) {
        L.season = si;
        check(!UF.overlaps(L, st.tx * TILE + TILE / 2, (st.ty + 1) * TILE, P.W, P.H_BIG), `stump at ${st.tx} has room in ${UF.SEASONS[si]}`);
    }
}

/* ================= map ================= */
// The reachability graph. Nodes are a season and a stretch of standable ground; edges are moves
// tried with the real physics (walks, jumps of five lengths, and swims), plus a change of season
// at a stump once that season has been found. Creatures are left out: they cannot close a way.
const stand = (L, tx, ty) => {
    const k = UF.kindAt(L, tx, ty);
    return (k === K.SOLID || k === K.LEDGE) && UF.kindAt(L, tx, ty - 1) !== K.SOLID;
};
function stretch(L, x, y) {
    const ty = y / TILE;
    let a = Math.floor(x / TILE);
    if (!stand(L, a, ty)) a = Math.floor((x - P.W / 2) / TILE);
    if (!stand(L, a, ty)) a = Math.floor((x + P.W / 2 - 1) / TILE);
    let b = a;
    while (stand(L, a - 1, ty)) a--;
    while (stand(L, b + 1, ty)) b++;
    return {start: a, end: b, ty};
}
// a move: hold `dir` for `wait` frames, then either jump (holding it `hold` frames), or swim
// (a stroke every `swim` frames), or let go for `pause` frames and hold `dir` again (to ride
// the wind), and carry on until the player lands somewhere
function tryMove(s, {dir, wait = 0, hold = 0, swim = 0, pause = 0}, limit = 220) {
    const c = UF.clone(s);
    const got = {tokens: [], golds: [], nest: false};
    const from = stretch(c.level, c.p.x, c.p.y);
    const acting = hold || swim || pause;
    for (let f = 0; f < wait + pause + limit; f++) {
        let h = dir;
        if (swim) { if (f % swim === 0) h |= IN.J; }
        else if (pause) { if (f >= wait && f < wait + pause) h = 0; }
        else if (hold && f >= wait && f < wait + hold) h |= IN.J;
        UF.step(c, {h});
        for (const e of c.events) {
            if (e.type === 'token') got.tokens.push(e.season);
            if (e.type === 'gold') got.golds.push(e.tx + ',' + e.ty);
            if (e.type === 'clear') got.nest = true;
        }
        if (got.nest) return Object.assign(got, {x: c.p.x, y: c.p.y, end: true});
        if (f > wait + pause + 2 && c.p.onGround) {
            const st = stretch(c.level, c.p.x, c.p.y);
            if (acting || st.start !== from.start || st.ty !== from.ty) return Object.assign(got, {x: c.p.x, y: c.p.y});
        }
    }
    return c.p.water || !c.p.onGround ? Object.assign(got, {x: c.p.x, y: c.p.y, lost: true}) : null;
}

function explore(unlocked) {
    const def = Object.assign({}, LEVELS[0], {rows: LEVELS[0].rows.map(r => r.replace(/[bsr]/g, '.'))});
    const L = UF.parseLevel(def);
    const base = UF.newGame(L, {viewW: 16});
    const nodes = new Map(), tokens = new Map(), golds = new Set();
    let nest = false, sims = 0;
    const key = (si, st) => `${si}:${st.ty}:${st.start}`;
    const node = (si, st) => {
        const k = key(si, st);
        if (!nodes.has(k)) nodes.set(k, Object.assign({si, key: k, out: new Set(), done: false, stump: false, nest: false}, st));
        return nodes.get(k);
    };
    const place = (si, x, y) => {
        const s = UF.clone(base);
        s.season = si; s.level.season = si; s.unlocked = unlocked.slice();
        Object.assign(s.p, {x, y, vx: 0, vy: 0, onGround: true, fall: true, jumped: false, air: 0});
        UF.snapCamera(s);
        return s;
    };
    L.season = 0;
    const queue = [node(0, stretch(L, base.p.x, base.p.y))];
    while (queue.length) {
        const n = queue.shift();
        if (n.done) continue;
        n.done = true;
        L.season = n.si;
        // stumps on this stretch: change to any other season found so far, standing still
        for (const st of L.stumps) {
            if (st.ty + 1 !== n.ty || st.tx < n.start || st.tx > n.end) continue;
            n.stump = true;
            for (const si of unlocked) {
                if (si === n.si) continue;
                L.season = si;
                const to = node(si, stretch(L, st.tx * TILE + TILE / 2, n.ty * TILE));
                L.season = n.si;
                n.out.add(to.key);
                if (!to.done) queue.push(to);
            }
        }
        const xs = [...new Set([n.start, Math.round((n.start + n.end) / 2), n.end])];
        for (const tx of xs) {
            const s = place(n.si, tx * TILE + TILE / 2, n.ty * TILE);
            const moves = [];
            for (const dir of [0, IN.L, IN.R, IN.L | IN.B, IN.R | IN.B])
                for (const hold of [0, 6, 14, 24, 40])
                    for (const wait of hold ? [0, 6, 14, 26] : [40])
                        if (dir || hold) moves.push({dir, wait, hold});
            for (const dir of [0, IN.L, IN.R]) for (const swim of [8, 14]) moves.push({dir, swim});
            for (const dir of [IN.L, IN.R]) for (const wait of [6, 12, 18, 26, 36]) moves.push({dir, wait, pause: 90});
            for (const m of moves) {
                sims++;
                const r = tryMove(s, m);
                if (!r) continue;
                for (const t of r.tokens) if (!tokens.has(t)) tokens.set(t, UF.SEASONS[n.si]);
                for (const g of r.golds) golds.add(g);
                if (r.nest) { n.nest = true; nest = true; continue; }
                if (r.lost) continue;
                L.season = n.si;
                const to = node(n.si, stretch(L, r.x, r.y));
                if (to.key !== n.key) { n.out.add(to.key); if (!to.done) queue.push(to); }
            }
        }
    }
    // from everywhere reached, a stump (to rest and change season) or the nest must be reachable
    const good = new Set([...nodes.values()].filter(n => n.stump || n.nest).map(n => n.key));
    for (let grew = true; grew;) {
        grew = false;
        for (const n of nodes.values()) if (!good.has(n.key) && [...n.out].some(k => good.has(k))) { good.add(n.key); grew = true; }
    }
    const stuck = [...nodes.values()].filter(n => !good.has(n.key)).map(n => `${UF.SEASONS[n.si]} x ${n.start}-${n.end} y ${n.ty}`);
    // how much ground, in tiles, is reachable in any season
    const cells = new Set();
    for (const n of nodes.values()) for (let x = n.start; x <= n.end; x++) cells.add(x + ',' + n.ty);
    if (process.env.NODES) for (const n of nodes.values()) console.log(`    ${UF.SEASONS[n.si]} x ${n.start}-${n.end} y ${n.ty} -> ${[...n.out].join(' ')}`);
    return {nodes: nodes.size, sims, tokens, golds, nest, stuck, cells: cells.size};
}

if (suites.includes('map')) {
    section('map');
    const L = UF.parseLevel(LEVELS[0]);
    const allGolds = [];
    for (let i = 0; i < L.orig.length; i++) if (L.orig[i] === UF.T.GOLD || L.orig[i] === UF.T.GOLD_WATER) allGolds.push((i % L.w) + ',' + Math.floor(i / L.w));
    // grow the seasons the way a player does: whatever tokens the current seasons reach
    let unlocked = [SUMMER];
    const steps = [];
    for (let round = 0; round < 4; round++) {
        const r = explore(unlocked);
        steps.push({unlocked: unlocked.slice(), r});
        const more = [...r.tokens.keys()].map(t => UF.SEASONS.indexOf(t)).filter(si => !unlocked.includes(si));
        if (!more.length) break;
        unlocked = [...unlocked, ...more].sort();
    }
    const last = steps[steps.length - 1].r;
    const total = last.cells;
    for (const {unlocked: u, r} of steps)
        note(`with ${u.map(si => UF.SEASONS[si]).join(' + ')}: ${r.cells} tiles of ground (${Math.round(100 * r.cells / total)}%), ${r.nodes} places, ${r.sims} moves tried; tokens ${[...r.tokens].map(([t, where]) => `${t} (found in ${where})`).join(', ') || '-'}; nest ${r.nest ? 'reached' : 'not reached'}`);
    check(steps.length === 3 && unlocked.join() === '0,1,2', 'summer leads to autumn, and autumn to winter', `unlocked ${unlocked}`);
    const at = i => (steps[i] || steps[steps.length - 1]).r;
    check(at(0).tokens.get('autumn') === 'summer', 'the autumn leaf is reached in summer');
    check(steps.length > 1 && at(1).tokens.get('winter') === 'autumn', 'the winter crystal is reached in autumn');
    check(steps.length === 3 && !at(0).nest && !at(1).nest && last.nest, 'the nest is reached only once winter is found');
    check(steps.length === 3 && at(0).cells < at(1).cells && at(1).cells < last.cells, 'every season adds ground the ones before could not reach');
    check(last.stuck.length === 0, 'from everywhere you can get to, a stump or the nest can still be reached', last.stuck.join('; '));
    const missing = allGolds.filter(g => !last.golds.has(g));
    check(missing.length === 0, `all ${allGolds.length} golden seeds can be reached`, `missing ${missing.join(' ')}`);
    // and which season each golden seed needs
    for (const g of allGolds) {
        const first = steps.findIndex(st => st.r.golds.has(g));
        note(`golden seed at ${g}: first reachable with ${first < 0 ? 'nothing' : steps[first].unlocked.map(si => UF.SEASONS[si]).join(' + ')}`);
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
