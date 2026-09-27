#!/usr/bin/env node
// Test suite for playground/underfoot.html (the platformer, milestone 1: movement).
//
// The page's whole promise at this stage is that it moves like Super Mario Bros. and is
// fairer about it. Neither shows in a diff: a changed constant or a reordered update moves
// every jump by a pixel and nothing looks wrong. So the page keeps physics, collision and
// camera in a <script id="core"> block with no DOM, and this runs that block in Node against
// a reference model written separately from the original ROM's table bytes.
//
//   node test/underfoot.mjs                  # everything
//   node test/underfoot.mjs physics          # named suites only
//   node test/underfoot.mjs --page=old.html  # run against another copy of the page
//
// Suites: physics, assists, collision, course.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'playground', 'underfoot.html');
const ALL = ['physics', 'assists', 'collision', 'course'];
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
const note = text => console.log(`  ${text}`);

const HTML = readFileSync(PAGE, 'utf8');
const block = id => {
    const m = HTML.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
    if (!m) { console.log(`no <script id="${id}"> block in ${PAGE}`); process.exit(1); }
    return m[1];
};
const ctx = vm.createContext({});
vm.runInContext(block('core') + '\nthis.UF = UF;', ctx);
vm.runInContext(block('levels') + '\nthis.LEVELS = LEVELS;', ctx);
const UF = ctx.UF, LEVELS = ctx.LEVELS, P = UF.P, FX = UF.FX, TILE = UF.TILE, IN = UF.IN;

/* ---------------- the reference model ----------------
   Written from the ROM's bytes, not from the page's constants: SMBData's JumpMForceData,
   FallMForceData, PlayerYSpdData, MaxRightXSpdData and FrictionData. Floats are exact here,
   because every value is a binary fraction. */
const REF = {
    walkMax: 0x18 / 16, runMax: 0x28 / 16,              // px/f
    accWalk: 0x98 / 4096, accRun: 0xE4 / 4096, decFast: 0xD0 / 4096, minWalk: 0x130 / 4096,
    rows: [                                              // [below px/f, v0, rising g, falling g]
        [0x10 / 16, 4, 0x20 / 256, 0x70 / 256],
        [0x19 / 16, 4, 0x1E / 256, 0x60 / 256],
        [Infinity, 5, 0x28 / 256, 0x90 / 256],
    ],
    maxFall: 4.5,
};
const refRow = vx => REF.rows.find(r => Math.abs(vx) < r[0]);
// a jump from flat ground: height above take-off after each frame, until it is back down
function refJump(vx, hold = Infinity) {
    const [, v0, gu, gd] = refRow(vx);
    let y = 0, vy = -v0, fall = false;
    const hs = [];
    for (let f = 1; f < 400; f++) {
        if (vy >= 0 || f > hold) fall = true;
        y -= vy;
        if (y <= 0 && f > 1) { hs.push(0); break; }
        hs.push(y);
        vy = Math.min(REF.maxFall, vy + (fall ? gd : gu));
    }
    return {apex: Math.max(...hs), frames: hs.length, dist: Math.abs(vx) * hs.length};
}

/* ---------------- helpers ---------------- */
// A test room: `w` wide, `h` high, floor on row h-2 (so the player stands on y = h-2 tiles),
// start at column sx. `edit(g)` may change the grid before it is parsed.
function room(w, h, sx, edit) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(Array(w).fill(y >= h - 2 ? '#' : '.'));
    g[h - 3][sx] = '@';
    if (edit) edit(g);
    return UF.parseLevel({id: 'test', rows: g.map(r => r.join(''))});
}
const game = (level, opts = {}) => UF.newGame(level, opts);
const px = v => v / FX;
const tiles = v => v / TILE;
function run(s, n, h = 0, until) {
    for (let i = 0; i < n; i++) {
        UF.step(s, {h});
        if (until && until(s)) return i + 1;
    }
    return n;
}
// press `h` from a standstill until the player's speed stops changing; returns frames taken
function rampTo(s, h, max) {
    let f = 0;
    while (Math.abs(s.p.vx) < max && f < 500) { UF.step(s, {h}); f++; }
    return f;
}
// Jump from the ground holding the button `hold` frames (and `dir` the whole time); returns
// the apex in px and the frames in the air (landing frame included).
function jumpFrom(s, hold, dirBits = 0) {
    const y0 = s.p.y, x0 = s.p.x;
    let apex = 0, frames = 0, top = y0;
    for (let f = 1; f < 400; f++) {
        UF.step(s, {h: dirBits | (f <= hold ? IN.J : 0)});
        frames++;
        top = Math.min(top, s.p.y);
        if (s.p.onGround) break;
    }
    apex = px(y0 - top);
    return {apex, frames, dist: px(Math.abs(s.p.x - x0))};
}
const fmt = v => (Math.round(v * 100) / 100).toFixed(2);

/* ================= physics ================= */
if (suites.includes('physics')) {
    section('physics');
    // the page's constants are the ROM bytes
    const table = [
        ['WALK_MAX', px(P.WALK_MAX), REF.walkMax], ['RUN_MAX', px(P.RUN_MAX), REF.runMax],
        ['ACC_WALK', px(P.ACC_WALK), REF.accWalk], ['ACC_RUN', px(P.ACC_RUN), REF.accRun],
        ['DEC_FAST', px(P.DEC_FAST), REF.decFast], ['MIN_WALK', px(P.MIN_WALK), REF.minWalk],
        ['MAX_FALL', px(P.MAX_FALL), REF.maxFall],
    ];
    for (const [k, got, want] of table) check(got === want, `${k} is ${want} px/f`, `got ${got}`);
    P.JUMP_ROWS.forEach((r, i) => {
        const w = REF.rows[i];
        check(px(r[0]) === w[0] && px(r[1]) === w[1] && px(r[2]) === w[2] && px(r[3]) === w[3],
            `jump row ${i} is the ROM's`, `got ${r.map(px)} want ${w}`);
    });

    // take-off speed picks the row
    const row = vx => UF.jumpRow(vx);
    check(row(0) === 0 && row(0x10 * 256 - 1) === 0 && row(0x10 * 256) === 1
        && row(0x19 * 256 - 1) === 1 && row(0x19 * 256) === 2 && row(-P.RUN_MAX) === 2,
        'rows switch at 1.0 and 1.5625 px/f, either direction');

    // ground speed ramps, from a standstill, against the reference
    const ramp = (acc, max) => { let v = 0, f = 0; while (v < max) { v = Math.min(max, Math.max(REF.minWalk, v + acc)); f++; } return f; };
    const flat = room(400, 8, 5);
    let s = game(flat);
    const walkF = rampTo(s, IN.R, P.WALK_MAX);
    check(walkF === ramp(REF.accWalk, REF.walkMax), `0 -> walking speed in ${walkF} frames`,
        `reference ${ramp(REF.accWalk, REF.walkMax)}`);
    s = game(flat);
    const runF = rampTo(s, IN.R | IN.B, P.RUN_MAX);
    check(runF === ramp(REF.accRun, REF.runMax), `0 -> running speed in ${runF} frames`,
        `reference ${ramp(REF.accRun, REF.runMax)}`);
    note(`walk ${walkF} f (${fmt(px(P.WALK_MAX) * 60 / 16)} tiles/s), run ${runF} f (${fmt(px(P.RUN_MAX) * 60 / 16)} tiles/s)`);
    const runUp = px(s.p.x) - (5 * 16 + 8);
    check(Math.abs(runUp / 16 - 3.6) < 0.1, `a run-up to full speed takes ${fmt(runUp / 16)} tiles`);

    // letting go, and skidding round
    s = game(flat); rampTo(s, IN.R, P.WALK_MAX);
    const stopF = run(s, 200, 0, t => t.p.vx === 0);
    check(stopF === Math.ceil(REF.walkMax / REF.accWalk), `let go at walking speed: stops in ${stopF} frames`);
    s = game(flat); rampTo(s, IN.R | IN.B, P.RUN_MAX);
    let skidFrames = 0, sawSkid = false;
    const turnF = run(s, 200, IN.L | IN.B, t => { if (t.p.skid) { sawSkid = true; skidFrames++; } return t.p.vx <= 0; });
    check(sawSkid && turnF >= 18 && turnF <= 26, `skid from a full run turns round in ${turnF} frames`);
    note(`let go from walking: ${stopF} f; skid from running to a turn: ${turnF} f`);

    // full-height jumps at the three speeds, against the reference, and the plan's numbers
    const cases = [
        ['standing', 0, 0, 4.125, 0],
        ['walking', IN.R, P.WALK_MAX, 4.39, 5.34],
        ['running', IN.R | IN.B, P.RUN_MAX, 5.16, 8.59],
    ];
    for (const [name, h, v, planApex, planDist] of cases) {
        s = game(flat);
        if (v) rampTo(s, h, v);
        run(s, 5, h);
        const got = jumpFrom(s, 999, h);
        const ref = refJump(px(v));
        check(got.apex === ref.apex && got.frames === ref.frames,
            `${name} jump: apex ${fmt(got.apex / 16)} tiles, ${got.frames} frames in the air`,
            `reference apex ${ref.apex} px in ${ref.frames} f, got ${got.apex} px in ${got.frames} f`);
        check(Math.abs(got.apex / 16 - planApex) < 0.006, `${name} apex matches the plan (${planApex})`);
        check(Math.abs(got.dist / 16 - planDist) < 0.01, `${name} jump covers ${fmt(got.dist / 16)} tiles (plan ${planDist})`);
    }

    // variable height: apex by how long the button is held, from a standstill
    const holds = [1, 4, 8, 12, 16, 20, 24, 32];
    const apexes = holds.map(k => { const t = game(flat); run(t, 3); return jumpFrom(t, k).apex; });
    const refs = holds.map(k => refJump(0, k).apex);
    check(apexes.every((a, i) => a === refs[i]), 'apex for each hold length matches the reference',
        `got ${apexes.map(a => fmt(a / 16))} want ${refs.map(a => fmt(a / 16))}`);
    check(apexes.every((a, i) => i === 0 || a > apexes[i - 1]), 'holding longer always jumps higher');
    note('apex by frames held: ' + holds.map((k, i) => `${k}f ${fmt(apexes[i] / 16)}`).join('  '));
    check(fmt(apexes[0] / 16) === '1.45', `a tap still clears ${fmt(apexes[0] / 16)} tiles`);

    // the air keeps its momentum, and keeps the take-off's speed limit
    s = game(flat); rampTo(s, IN.R | IN.B, P.RUN_MAX); run(s, 3, IN.R | IN.B);
    const vxs = [];
    UF.step(s, {h: IN.J});
    while (!s.p.onGround) { vxs.push(s.p.vx); UF.step(s, {h: IN.J}); }
    check(vxs.every(v => v === P.RUN_MAX), 'no drag in the air: a run jump with no direction keeps 2.5 px/f');
    s = game(flat); rampTo(s, IN.R, P.WALK_MAX); run(s, 3, IN.R);
    let maxAir = 0;
    UF.step(s, {h: IN.J | IN.R | IN.B});
    while (!s.p.onGround) { maxAir = Math.max(maxAir, s.p.vx); UF.step(s, {h: IN.J | IN.R | IN.B}); }
    check(maxAir === P.WALK_MAX, 'a walking jump cannot reach running speed in the air, even holding run');

    // terminal speed
    const tall = room(10, 80, 4, g => { for (let x = 0; x < 10; x++) g[77][x] = '.'; g[77][4] = '@'; for (let y = 0; y < 60; y++) g[y].fill('.'); });
    s = game(tall);
    s.p.y = 2 * TILE; s.p.onGround = false; s.p.fall = true;
    let vmax = 0;
    run(s, 300, 0, t => { vmax = Math.max(vmax, t.p.vy); return t.p.onGround; });
    check(vmax === P.MAX_FALL, `falling tops out at ${px(vmax)} px/f`);

    // head against a block: the jump dies at once
    const lowCeil = room(20, 12, 5, g => { g[6][5] = 'X'; });
    s = game(lowCeil);
    let bonkVy = null;
    UF.step(s, {h: IN.J});
    run(s, 60, IN.J, t => { if (t.events.some(e => e.type === 'bump')) { bonkVy = t.p.vy; return true; } });
    check(bonkVy === P.BONK_VY, `a head bump sends you down at ${bonkVy === null ? '?' : px(bonkVy)} px/f`);
}

/* ================= assists ================= */
if (suites.includes('assists')) {
    section('assists');
    // walk off a ledge and press jump k frames after the frame the ground went away
    const ledge = room(60, 12, 3, g => { for (let x = 12; x < 60; x++) { g[10][x] = '.'; g[11][x] = '.'; } g[11].fill('.', 12); });
    function coyote(k, assist) {
        const s = game(ledge, {assist});
        let w = -1;
        for (let f = 0; f < 200; f++) {
            UF.step(s, {h: IN.R});
            if (s.events.some(e => e.type === 'ledge')) { w = f; break; }
        }
        // the ledge frame itself counts as k = 0: the jump is read before the move
        let jumped = false;
        const s2 = game(ledge, {assist});
        for (let f = 0; f < 200; f++) {
            UF.step(s2, {h: IN.R | (f === w + k ? IN.J : 0)});
            if (s2.events.some(e => e.type === 'jump')) { jumped = true; break; }
            if (f > w + k) break;
        }
        return jumped;
    }
    const on = [], off = [];
    for (let k = 0; k <= 8; k++) { on.push(coyote(k, {})); off.push(coyote(k, {coyote: false})); }
    check(on.slice(0, 7).every(x => x) && !on[7] && !on[8], 'coyote time: a jump up to 6 frames late still happens, 7 does not',
        `got ${on.map(x => x ? 'J' : '.').join('')}`);
    check(off[0] && off.slice(1).every(x => !x), 'with coyote time off, only the last frame on the ledge jumps',
        `got ${off.map(x => x ? 'J' : '.').join('')}`);

    // fall onto the floor and press jump k frames before the jump could happen
    const drop = room(20, 20, 5);
    function buffer(k, assist) {
        const s = game(drop, {assist});
        s.p.y -= 6 * TILE; s.p.onGround = false; s.p.fall = true;
        let landF = -1;
        for (let f = 0; f < 200; f++) { UF.step(s, {}); if (s.p.onGround) { landF = f; break; } }
        const first = landF + 1;                       // the first frame a jump can start
        const s2 = game(drop, {assist});
        s2.p.y -= 6 * TILE; s2.p.onGround = false; s2.p.fall = true;
        for (let f = 0; f <= first + 1; f++) {
            UF.step(s2, {h: f >= first - k ? IN.J : 0});
            if (s2.events.some(e => e.type === 'jump')) return f === first;
        }
        return false;
    }
    const bOn = [], bOff = [];
    for (let k = 0; k <= 8; k++) { bOn.push(buffer(k, {})); bOff.push(buffer(k, {buffer: false})); }
    check(bOn.slice(0, 7).every(x => x) && !bOn[7] && !bOn[8], 'jump buffer: a press up to 6 frames early still jumps on landing, 7 does not',
        `got ${bOn.map(x => x ? 'J' : '.').join('')}`);
    check(bOff[0] && bOff.slice(1).every(x => !x), 'with the buffer off, only a press on the frame itself jumps',
        `got ${bOff.map(x => x ? 'J' : '.').join('')}`);
    // held from before landing does not bunny-hop: only a fresh press counts
    const s = game(drop);
    s.p.y -= 3 * TILE; s.p.onGround = false; s.p.fall = true;
    UF.step(s, {h: IN.J});
    let hopped = false;
    for (let f = 0; f < 60; f++) { UF.step(s, {h: IN.J}); if (s.events.some(e => e.type === 'jump')) hopped = true; }
    check(!hopped, 'holding jump through a landing does not jump again (buffer lasts 6 frames)');

    // corner correction: the head overlaps a block's corner by d px, and the jump goes straight up
    function corner(d, side, assist) {
        const lv = room(20, 14, 2, g => { g[7][8] = 'X'; });
        const s = game(lv, {assist});
        const b = 8 * TILE;                           // block spans [8, 9) tiles
        s.p.x = side > 0 ? (b + TILE) - d * FX + P.W / 2   // left edge d px inside the block's right side
                         : b + d * FX - P.W / 2;           // right edge d px inside its left side
        const x0 = s.p.x;
        let bump = false, slid = false, inside = false;
        UF.step(s, {h: IN.J});
        for (let f = 0; f < 80 && !s.p.onGround; f++) {
            UF.step(s, {h: IN.J});
            if (s.events.some(e => e.type === 'bump')) bump = true;
            if (s.events.some(e => e.type === 'corner')) slid = true;
            if (UF.overlaps(lv, s.p.x, s.p.y, s.p.w, s.p.h)) inside = true;
        }
        // a slide must move the player clear by exactly the overlap, away from the block
        const moved = (s.p.x - x0) / FX;
        if (slid && moved !== side * d) slid = false;
        return {bump, slid: slid && !inside, inside};
    }
    for (const side of [1, -1]) {
        const name = side > 0 ? 'right' : 'left';
        const r = [1, 3, 4, 5, 6].map(d => corner(d, side, {}));
        check(r.slice(0, 3).every(x => x.slid && !x.bump) && r[3].bump && r[4].bump,
            `corner correction on a block's ${name} corner: 1, 3, 4 px slide past; 5, 6 px bump`,
            `got ${r.map(x => x.bump ? 'B' : x.slid ? 's' : '?').join('')}`);
        const o = corner(1, side, {corner: false});
        check(o.bump && !o.slid, `with correction off, 1 px on the ${name} corner bumps`);
    }
}

/* ================= collision ================= */
if (suites.includes('collision')) {
    section('collision');
    // falls from any height stop on a floor one tile thick
    const floor = room(12, 60, 5, g => { for (let y = 0; y < 60; y++) g[y].fill('.'); g[40].fill('#'); g[39][5] = '@'; });
    let s = game(floor);
    s.p.y = 1 * TILE; s.p.onGround = false; s.p.fall = true;
    run(s, 400, 0, t => t.p.onGround);
    check(s.p.onGround && s.p.y === 40 * TILE, 'a 39-tile fall lands on a 1-tile floor');

    // running into a wall stops flush against it
    const wall = room(40, 10, 3, g => { g[7][30] = 'X'; });
    s = game(wall);
    run(s, 300, IN.R | IN.B);
    check(s.p.x === 30 * TILE - P.W / 2 && s.p.vx === 0, 'a full run into a wall stops flush, speed 0');

    // one-way platforms: through from below, onto from above, never from the side
    const oneway = room(30, 14, 5, g => { for (let x = 3; x < 9; x++) g[9][x] = '-'; g[11][12] = '-'; });
    s = game(oneway);
    UF.step(s, {h: IN.J});
    run(s, 120, IN.J, t => t.p.onGround && t.p.vy === 0 && t.frame > 3);
    check(s.p.y === 9 * TILE, 'jump up through a one-way platform and stand on it');
    s = game(oneway);
    s.p.x = 10 * TILE; s.p.y = 12 * TILE;
    run(s, 100, IN.R);
    check(s.p.x > 13 * TILE, 'walk through a one-way platform from the side');

    // a big player fits a two-tile tunnel, and cannot grow where there is no room
    const tunnel = room(30, 12, 3, g => { for (let x = 8; x < 20; x++) g[7][x] = 'X'; });
    s = game(tunnel, {big: true});
    run(s, 200, IN.R);
    check(s.p.x > 20 * TILE, 'a big player walks through a two-tile tunnel');
    const low = room(30, 12, 3, g => { for (let x = 0; x < 30; x++) g[8][x] = 'X'; });
    s = game(low);
    check(UF.setBig(s, true) === false && !s.p.big, 'cannot grow under a one-tile ceiling');
    // ducking under a low block and standing up again once clear
    const duck = room(30, 12, 3, g => { g[8][8] = 'X'; });
    s = game(duck, {big: true});
    s.p.x = 8 * TILE + TILE / 2; s.p.duck = true; s.p.h = P.H_SMALL;
    UF.step(s, {});
    check(s.p.duck, 'a big player ducked under a low block stays ducked');

    // fuzz: random play on the course never leaves the player inside a solid tile
    const course = UF.parseLevel(LEVELS[0]);
    s = game(course, {viewW: 16});
    let seed = 12345;
    const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6D2B79F5 | 0) >>> 0) / 4294967296;
    let held = 0, left = 0, bad = null, deaths = 0, clears = 0, maxX = 0;
    const N = 100000;
    // every 2,000 frames the player is put down somewhere else, so the whole course gets played
    const spots = [];
    for (let tx = 1; tx < course.w - 1; tx++)
        for (let ty = 1; ty < course.h; ty++)
            if (UF.SOLID[UF.tileAt(course, tx, ty)] || UF.tileAt(course, tx, ty) === UF.T.ONEWAY) {
                if (!UF.overlaps(course, tx * TILE + TILE / 2, ty * TILE, P.W, P.H_BIG)) spots.push([tx, ty]);
            }
    const visited = new Set();
    for (let i = 0; i < N && !bad; i++) {
        if (i % 2000 === 0 && s.p.mode === 'play') {
            const [tx, ty] = spots[rnd() * spots.length | 0];
            Object.assign(s.p, {x: tx * TILE + TILE / 2, y: ty * TILE, vx: 0, vy: 0, onGround: true, fall: true, jumped: false, air: 0});
        }
        visited.add(Math.floor(s.p.x / TILE / 10));
        if (--left <= 0) {
            held = 0;
            const r = rnd();
            if (r < 0.7) held |= IN.R; else if (r < 0.85) held |= IN.L;
            if (rnd() < 0.5) held |= IN.B;
            if (rnd() < 0.45) held |= IN.J;
            if (rnd() < 0.08) held |= IN.D;
            left = 1 + (rnd() * 30 | 0);
            if (rnd() < 0.01) UF.setBig(s, !s.p.big);
        }
        UF.step(s, {h: held});
        const p = s.p;
        maxX = Math.max(maxX, p.x);
        if (s.events.some(e => e.type === 'die')) deaths++;
        if (p.mode === 'clear') { clears++; s = game(course, {viewW: 16}); continue; }
        if (p.mode !== 'play') continue;
        if (UF.overlaps(course, p.x, p.y, p.w, p.h)) bad = `inside a solid at frame ${i}: ${px(p.x)},${px(p.y)} v ${px(p.vx)},${px(p.vy)}`;
        else if (![p.x, p.y, p.vx, p.vy].every(Number.isInteger)) bad = `non-integer state at frame ${i}`;
        else if (p.vy > P.MAX_FALL || Math.abs(p.vx) > P.RUN_MAX) bad = `speed out of range at frame ${i}`;
    }
    check(!bad, `${N} random frames on the course: never inside a solid, state always integer`, bad);
    check(visited.size >= Math.floor(course.w / 10) - 2, `the fuzz visited ${visited.size} of ${Math.ceil(course.w / 10)} ten-tile stretches of the course`);
    note(`fuzz: ${deaths} deaths, ${clears} clears`);

    // determinism: the same inputs give the same run
    const replay = () => {
        const g = game(course, {viewW: 20});
        let sd = 99;
        const r = () => ((sd = Math.imul(sd ^ (sd >>> 15), 2246822507) + 0x6D2B79F5 | 0) >>> 0) / 4294967296;
        let h = 0;
        for (let i = 0; i < 20000; i++) {
            if (i % 11 === 0) h = (r() < 0.8 ? IN.R : IN.L) | (r() < 0.5 ? IN.J : 0) | (r() < 0.5 ? IN.B : 0);
            UF.step(g, {h});
        }
        return UF.hash(g);
    };
    const h1 = replay(), h2 = replay();
    check(h1 === h2, `the same 20,000 inputs replay to the same state (${h1})`);
}

/* ================= course ================= */
if (suites.includes('course')) {
    section('course');
    for (const def of LEVELS) {
        let L = null;
        try { L = UF.parseLevel(def); } catch (e) { fail(`${def.id} parses`, e.message); continue; }
        pass(`${def.id} parses`);
        check(L.flag && L.flag.base < L.h, `${def.id} has a flag on the ground`);
        check(!UF.overlaps(L, L.start.tx * TILE + TILE / 2, (L.start.ty + 1) * TILE, P.W, P.H_BIG), `${def.id} starts with room to stand, even big`);
        const under = UF.tileAt(L, L.start.tx, L.start.ty + 1);
        check(UF.SOLID[under] === 1, `${def.id} starts on solid ground`);
        for (const c of L.checkpoints) check(UF.SOLID[UF.tileAt(L, c.tx, c.ty + 1)] === 1, `${def.id} checkpoint at ${c.tx} stands on ground`);
    }
    // A jumping bot gets from the start to the flag, small, with the fairness layer off.
    // Each move is: hold right (walking or running) for `wait` frames, then press jump and
    // hold it `hold` frames, and keep holding right until the landing. It takes the move
    // that lands furthest along, and counts how many `wait` values would have landed on the
    // same spot: the timing window of that jump, in frames.
    const course = UF.parseLevel(LEVELS[0]);
    const copy = s => Object.assign({}, s, {p: Object.assign({}, s.p), cam: Object.assign({}, s.cam),
        checkpoint: Object.assign({}, s.checkpoint), events: [], dry: true});
    function tryMove(s, dir, wait, hold) {
        const c = copy(s), inputs = [];
        for (let f = 0; f < wait + 240; f++) {
            const h = dir | (f >= wait && f < wait + hold ? IN.J : 0);
            inputs.push(h);
            UF.step(c, {h});
            if (c.p.mode === 'pole') return {inputs, x: Infinity, y: 0};
            if (c.p.mode !== 'play') return null;
            if (f > wait + 2 && c.p.onGround) return {inputs, x: c.p.x, y: c.p.y};
        }
        return null;
    }
    // the stretch of standable tiles a landing is on: landings on the same stretch are the same outcome
    const stand = (L, tx, ty) => (UF.SOLID[UF.tileAt(L, tx, ty)] === 1 || UF.tileAt(L, tx, ty) === UF.T.ONEWAY)
        && UF.SOLID[UF.tileAt(L, tx, ty - 1)] !== 1;
    function stretch(L, r) {
        if (r.x === Infinity) return {key: 'flag', start: Infinity};
        const ty = r.y / TILE;
        let a = Math.floor(r.x / TILE);
        if (!stand(L, a, ty)) a = Math.floor((r.x - P.W / 2) / TILE);
        if (!stand(L, a, ty)) a = Math.floor((r.x + P.W / 2 - 1) / TILE);
        while (stand(L, a - 1, ty)) a--;
        return {key: ty + ':' + a, start: a};
    }
    const bot = game(course, {assist: {coyote: false, buffer: false, corner: false}, viewW: 16});
    const moves = [];
    let stuck = false;
    for (let n = 0; n < 200 && bot.p.mode === 'play'; n++) {
        // every move, grouped by where it lands
        const results = [];
        for (const dir of [IN.R, IN.R | IN.B])
            for (const hold of [4, 10, 16, 24, 40])
                for (let wait = 0; wait <= 36; wait++) {
                    const r = tryMove(bot, dir, wait, hold);
                    if (r) results.push(Object.assign(r, {dir, hold, wait}, {seg: stretch(course, r)}));
                }
        if (!results.length) { stuck = true; break; }
        // like a careful person: the furthest stretch that can be reached with 6 frames to spare,
        // or failing that the one with the most room for error
        const byStretch = new Map();
        for (const r of results) {
            const k = r.seg.key;
            if (!byStretch.has(k)) byStretch.set(k, {start: r.seg.start, groups: new Map()});
            const gs = byStretch.get(k).groups, g = r.dir + '/' + r.hold;
            if (!gs.has(g)) gs.set(g, []);
            gs.get(g).push(r);
        }
        let choice = null;
        for (const st of byStretch.values()) {
            let group = null;
            for (const g of st.groups.values()) if (!group || g.length > group.length) group = g;
            const cand = {start: st.start, group};
            const ok = group.length >= 6, cOk = choice && choice.group.length >= 6;
            if (!choice || (ok && !cOk) || (ok === cOk && (ok ? cand.start > choice.start : group.length > choice.group.length))) choice = cand;
        }
        const group = choice.group, far = choice.start;
        group.sort((a, b) => a.wait - b.wait);
        let pick = group[group.length >> 1];
        if (pick.x <= bot.p.x) pick = group.reduce((a, b) => b.x > a.x ? b : a);
        if (pick.x <= bot.p.x) { stuck = true; break; }
        const from = tiles(bot.p.x);
        for (const h of pick.inputs) UF.step(bot, {h});
        moves.push({from, to: bot.p.mode === 'play' ? fmt(tiles(bot.p.x)) : 'flag', window: group.length,
            run: !!(pick.dir & IN.B), hold: pick.hold, newStretch: far !== stretch(course, {x: from * TILE, y: pick.y}).start});
    }
    check(!stuck && bot.p.mode !== 'play', `a jumping bot reaches the flag in ${moves.length} moves, small, fairness layer off`,
        stuck ? `stuck at x = ${fmt(tiles(bot.p.x))}` : '');
    const tight = moves.filter(m => m.window < 4);
    check(tight.length === 0, 'every jump on the way has a timing window of 4 frames or more',
        tight.map(m => `${fmt(m.from)} -> ${m.to}: ${m.window} f`).join(', '));
    const narrow = moves.slice().sort((a, b) => a.window - b.window).slice(0, 6);
    note('narrowest windows: ' + narrow.map(m => `x ${Math.round(m.from)}->${m.to} ${m.run ? 'run' : 'walk'} hold ${m.hold} ${m.window}f`).join(', '));

    // the camera keeps the player on screen at every view width, through the whole course
    for (const vw of [16, 20, 26]) {
        const s = game(course, {viewW: vw});
        let off = null, seed = vw;
        const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6D2B79F5 | 0) >>> 0) / 4294967296;
        let held = 0;
        for (let i = 0; i < 30000 && !off; i++) {
            if (i % 9 === 0) held = (rnd() < 0.75 ? IN.R : IN.L) | (rnd() < 0.5 ? IN.J : 0) | (rnd() < 0.6 ? IN.B : 0);
            UF.step(s, {h: held});
            const p = s.p, c = s.cam;
            if (p.mode === 'clear') break;
            if (p.mode !== 'play' || p.y > course.h * TILE) continue;   // falling out of the level
            const l = p.x - P.W / 2, r = p.x + P.W / 2;
            if (l < c.x || r > c.x + vw * TILE || p.y - p.h < c.y || p.y > c.y + UF.VIEW_H * TILE)
                off = `frame ${i}: player ${fmt(tiles(p.x))},${fmt(tiles(p.y))} camera ${fmt(tiles(c.x))},${fmt(tiles(c.y))}`;
        }
        check(!off, `camera keeps the player in view at ${vw} tiles wide`, off);
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
