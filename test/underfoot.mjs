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
// Suites: physics, assists, collision, creatures, levels; and 'hands' (slow, opt-in: a
// bot whose timing is off by a frame or two plays each level, and its deaths are counted).

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'playground', 'underfoot.html');
const ALL = ['physics', 'assists', 'collision', 'creatures', 'levels'];   // 'hands' is slow and opt-in
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
const game = (level, opts = {}) => UF.newGame(level, Object.assign({feel: 'classic'}, opts));
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

    // the responsive profile, the page's default: how many frames each change of speed takes
    const snap = (lv, o = {}) => UF.newGame(lv, Object.assign({feel: 'snappy'}, o));
    const until = (s, h, cond) => { let f = 0, dist = 0; const x0 = s.p.x; while (!cond(s) && f < 300) { UF.step(s, {h}); f++; } return {f, dist: px(Math.abs(s.p.x - x0))}; };
    const want = [];
    s = snap(flat);
    want.push(['standstill to walking', until(s, IN.R, t => t.p.vx === P.WALK_MAX).f, 3]);
    s = snap(flat);
    want.push(['standstill to running', until(s, IN.R | IN.B, t => t.p.vx === P.RUN_MAX).f, 11]);
    s = snap(flat); until(s, IN.R, t => t.p.vx === P.WALK_MAX);
    const stopWalk = until(s, 0, t => t.p.vx === 0);
    want.push(['let go at walking speed', stopWalk.f, 3]);
    s = snap(flat); until(s, IN.R | IN.B, t => t.p.vx === P.RUN_MAX);
    const stopRun = until(s, 0, t => t.p.vx === 0);
    want.push(['let go at running speed', stopRun.f, 5]);
    s = snap(flat); until(s, IN.R, t => t.p.vx === P.WALK_MAX);
    want.push(['turn round from walking', until(s, IN.L, t => t.p.vx === -P.WALK_MAX).f, 5]);
    s = snap(flat); until(s, IN.R | IN.B, t => t.p.vx === P.RUN_MAX);
    want.push(['turn round from running to walking speed the other way', until(s, IN.L | IN.B, t => t.p.vx <= -P.WALK_MAX).f, 6]);
    s = snap(flat); until(s, IN.R, t => t.p.vx === P.WALK_MAX); UF.step(s, {h: IN.R | IN.J});
    want.push(['turn round in the air at walking speed', until(s, IN.L | IN.J, t => t.p.vx === -P.WALK_MAX).f, 6]);
    s = snap(flat); until(s, IN.R | IN.B, t => t.p.vx === P.RUN_MAX); UF.step(s, {h: IN.R | IN.B | IN.J});
    want.push(['turn round in the air at running speed', until(s, IN.L | IN.J, t => t.p.vx === -P.RUN_MAX).f, 10]);
    s = snap(flat); until(s, IN.R | IN.B, t => t.p.vx === P.RUN_MAX); UF.step(s, {h: IN.R | IN.B | IN.J});
    want.push(['let go in the air at running speed, to a standstill', until(s, IN.J, t => t.p.vx === 0 || t.p.onGround).f, 20]);
    for (const [what, got, w] of want) check(got === w, `responsive: ${what} in ${w} frames`, `got ${got}`);
    // how far the mouse slides after letting go, both ways
    const cl = game(flat); rampTo(cl, IN.R, P.WALK_MAX);
    const clStop = until(cl, 0, t => t.p.vx === 0);
    note(`let go at walking speed: 1985 slides ${fmt(clStop.dist)} px in ${clStop.f} f, responsive ${fmt(stopWalk.dist)} px in ${stopWalk.f} f; from running ${fmt(stopRun.dist)} px`);
    check(stopWalk.dist <= 2 && stopRun.dist <= 8, 'responsive: letting go stops within half a tile');
    // and the jumps are still the ROM's, whatever speed they start from
    for (const [name, h, v] of [['standing', 0, 0], ['walking', IN.R, P.WALK_MAX], ['running', IN.R | IN.B, P.RUN_MAX]]) {
        s = snap(flat);
        if (v) until(s, h, t => Math.abs(t.p.vx) === v);
        run(s, 3, h);
        const got = jumpFrom(s, 999, h), ref = refJump(px(v));
        check(got.apex === ref.apex && got.frames === ref.frames, `responsive: a ${name} jump is the ROM's (${fmt(got.apex / 16)} tiles high)`,
            `reference ${ref.apex} px in ${ref.frames} f, got ${got.apex} px in ${got.frames} f`);
    }

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
    const course = UF.parseLevel(LEVELS.find(l => l.id === 'course'));
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

/* ================= creatures ================= */
if (suites.includes('creatures')) {
    section('creatures');
    const S = (rows, opts = {}) => UF.newGame(UF.parseLevel({id: 't', rows}), Object.assign({feel: 'snappy'}, opts));
    // a room: floor on row 10 (the player stands on y = 10 tiles), `put` places characters on row 9
    const flatRoom = (w, put, extra) => {
        const g = [];
        for (let y = 0; y < 12; y++) g.push(Array(w).fill(y >= 10 ? '#' : '.'));
        for (const [x, c, y = 9] of put) g[y][x] = c;
        if (extra) extra(g);
        return g.map(r => r.join(''));
    };
    const ent = (s, kind) => s.ents.find(e => e.kind === kind && !e.gone);
    const evs = (s, type) => s.events.filter(e => e.type === type);

    // a beetle walks at the goomba's speed towards the player and turns at a wall
    let s = S(flatRoom(30, [[3, '@'], [12, 'b']], g => { g[9][5] = 'X'; }));
    UF.step(s); const x0 = s.ents[0].x; UF.step(s);
    check(s.ents[0].x - x0 === -UF.E.WALK, 'a beetle walks at 0.5 px/f towards the player');
    run(s, 400);
    check(s.ents[0].dir === 1, 'and turns round at a wall');

    // only what is near the player moves, so the screen's width never changes the game
    s = S(flatRoom(60, [[3, '@'], [40, 'b']]));
    run(s, 30);
    check(!s.ents[0].active && s.ents[0].x === 40 * TILE + TILE / 2, 'a beetle 37 tiles off stays asleep');
    const w16 = S(flatRoom(60, [[3, '@'], [25, 'b'], [30, 's']]), {viewW: 16});
    const w26 = S(flatRoom(60, [[3, '@'], [25, 'b'], [30, 's']]), {viewW: 26});
    for (let i = 0; i < 600; i++) { UF.step(w16, {h: i % 90 < 60 ? IN.R : IN.J}); UF.step(w26, {h: i % 90 < 60 ? IN.R : IN.J}); }
    check(UF.hash(w16) === UF.hash(w26), 'the same inputs play out identically at 16 and 26 tiles wide');

    // ledges: beetles and yellow snails walk off, red snails turn back
    const ledge = put => flatRoom(40, put, g => { for (let x = 16; x < 24; x++) { g[10][x] = '.'; g[11][x] = '.'; } g[8][30] = 'X'; });
    s = S(ledge([[35, '@'], [26, 'b']]));
    run(s, 200);
    check(s.ents[0].gone || s.ents[0].y > 12 * TILE, 'a beetle walks off a ledge');
    s = S(ledge([[35, '@'], [26, 'r']]));
    run(s, 400);
    check(!s.ents[0].gone && s.ents[0].y === 10 * TILE && s.ents[0].x > 24 * TILE, 'a red snail turns back at the edge');
    s = S(ledge([[35, '@'], [26, 's']]));
    run(s, 400);
    check(s.ents[0].gone || s.ents[0].y > 12 * TILE, 'a yellow snail walks off');

    // stomping: coming down with the feet above the creature's middle a frame ago
    function drop(kind, feetAboveMiddle, opts = {}) {
        const s = S(flatRoom(30, [[5, '@'], [15, kind]]), opts);
        UF.step(s);
        const e = s.ents[0];
        e.x = 15 * TILE + TILE / 2;
        const mid = e.y - e.h / 2;
        Object.assign(s.p, {x: e.x, y: mid - feetAboveMiddle * FX, vy: 2 * FX, vx: 0, onGround: false, fall: true, jumped: true});
        UF.step(s, {h: opts.hold ? IN.J : 0});
        return s;
    }
    s = drop('b', 1);
    check(s.ents[0].state === 'flat' && s.p.vy < 0 && evs(s, 'stomp').length === 1, 'feet 1 px above a beetle\'s middle: a stomp, and a bounce');
    s = drop('b', -1);
    check(s.p.mode === 'dead', 'feet 1 px below its middle: hurt');
    s = drop('b', -1, {big: true});
    check(s.p.mode === 'play' && !s.p.big && s.p.inv === P.INVULNERABLE && evs(s, 'shrink').length === 1, 'big and hurt: small again, and blinking for 2 s');
    run(s, 60);
    check(s.p.mode === 'play', 'while blinking, a beetle cannot hurt');
    // bounce height: holding jump through the stomp is a full jump
    const peak = hold => { const t = drop('b', 1, {hold}); let top = t.p.y; for (let i = 0; i < 80; i++) { UF.step(t, {h: hold ? IN.J : 0}); top = Math.min(top, t.p.y); } return px(t.p.y - top) / 16; };
    const hi = peak(true), lo = peak(false);
    check(hi > lo + 1, `a stomp holding jump bounces ${fmt(hi)} tiles, letting go ${fmt(lo)}`);

    // snails, shells, kicks
    s = drop('s', 1);
    let e = s.ents[0];
    check(e.kind === 'shell' && e.state === 'still', 'a stomped snail leaves its shell lying still');
    s.p.y = 10 * TILE; s.p.onGround = true; s.p.vy = 0; s.p.x = e.x - 20 * FX;
    run(s, 40, IN.R, t => t.ents[0].state === 'slide');
    check(e.state === 'slide' && e.dir === 1, 'walking into a still shell kicks it away');
    UF.step(s); const sx0 = e.x; UF.step(s);
    check(e.x - sx0 === UF.E.SHELL, 'a kicked shell slides at 3 px/f, faster than a run');
    // kicking by jumping on it: the shell shoots off under the player's feet, and must not hurt
    s = drop('s', 1); e = s.ents[0];
    s.p.inv = 0;
    let ok = true;
    for (const dx of [-5, -2, 2, 5]) {
        const t2 = UF.clone(s), sh = t2.ents[0];
        Object.assign(t2.p, {x: sh.x + dx * FX, y: sh.y - sh.h / 2 - FX, vy: 2 * FX, vx: 0, onGround: false, fall: true, jumped: true});
        UF.step(t2);
        if (sh.state !== 'slide') ok = false;
        run(t2, 14);
        if (t2.p.mode !== 'play') ok = false;
    }
    check(ok, 'a shell kicked by jumping on it slides off without hurting the player: a moment\'s grace');
    // a shell knocking out a row of beetles, bouncing off a wall, and coming back to hurt
    s = S(flatRoom(40, [[4, '@'], [8, 's'], [14, 'b'], [16, 'b']], g => { g[9][22] = 'X'; }));
    UF.step(s);
    const sn = s.ents[0];
    sn.kind = 'shell'; sn.state = 'still'; sn.h = 13 * FX; sn.w = 14 * FX; sn.active = true;
    const knocks = [], thuds = [];
    let hurtBy = null;
    for (let i = 0; i < 300; i++) {
        UF.step(s, {h: i < 40 ? IN.R : 0});
        for (const k of evs(s, 'knock')) knocks.push(k.chain);
        if (evs(s, 'thud').length) thuds.push(i);
        if (s.p.mode === 'dead') { hurtBy = i; break; }
    }
    check(knocks.join() === '1,2', 'a sliding shell knocks out two beetles in a chain', `chains ${knocks}`);
    check(thuds.length >= 1 && hurtBy !== null, 'bounces off the wall and comes back to hurt its kicker');
    // stomping a sliding shell stops it
    s = drop('s', 1); e = s.ents[0];
    e.state = 'slide'; e.dir = 1; e.grace = 0;
    Object.assign(s.p, {x: e.x, y: e.y - e.h / 2 - FX, vy: 2 * FX, onGround: false, fall: true, jumped: true});
    UF.step(s);
    check(e.state === 'still', 'a stomp stops a sliding shell');
    // an empty shell left alone: the snail comes back out
    s = drop('s', 1); e = s.ents[0];
    s.p.x = 4 * TILE;
    run(s, UF.E.WAKE + 5);
    check(e.kind === 'snail' && e.state === 'walk', `after ${UF.E.WAKE} frames the snail comes back out`);

    // a block struck from below knocks off whatever stands on it
    s = S(flatRoom(30, [[5, '@'], [12, 'b', 6]], g => { for (let x = 10; x < 15; x++) g[7][x] = 'X'; }));
    s.p.x = 12 * TILE + TILE / 2;
    let knocked = false;
    for (let i = 0; i < 60 && !knocked; i++) { UF.step(s, {h: IN.J}); if (evs(s, 'knock').length) knocked = true; }
    check(knocked && s.ents[0].state === 'flip', 'hitting the block under a beetle knocks it out');

    // two beetles meeting turn round
    s = S(flatRoom(30, [[3, '@'], [10, 'b'], [16, 'b']]));
    s.ents[1].dir = -1; s.ents[0].dir = 1;
    run(s, 2); s.ents[0].dir = 1;
    run(s, 200);
    check(s.ents[0].dir === -1 && s.ents[1].dir === 1, 'two beetles meeting walk apart again');

    // the strawberry: out of its block, rolling right, back off a wall, and growing the player
    s = S(flatRoom(30, [[8, '@']], g => { g[6][8] = '*'; g[9][16] = 'X'; }));
    let sprout = false;
    for (let i = 0; i < 30; i++) { UF.step(s, {h: i < 20 ? IN.J : 0}); if (evs(s, 'sprout').length) sprout = true; }
    const berry = ent(s, 'berry');
    check(sprout && berry && berry.state === 'rise', 'a strawberry block, struck small, grows a strawberry');
    s.p.x = 3 * TILE;
    run(s, 40);
    check(berry.state === 'walk' && berry.dir === 1, 'which climbs out and rolls right');
    let turned = false;
    for (let i = 0; i < 300 && !turned; i++) { UF.step(s); turned = berry.dir === -1; }
    check(turned, 'and rolls back off a wall');
    let grew = false;
    for (let i = 0; i < 400 && !grew; i++) { UF.step(s, {h: IN.R}); grew = evs(s, 'grow').length > 0; }
    check(grew && s.p.big && s.p.h === P.H_BIG, 'touching it makes the player big');
    s = S(flatRoom(30, [[8, '@']], g => { g[5][8] = '*'; }), {big: true});
    const seeds0 = s.seeds;
    for (let i = 0; i < 30; i++) UF.step(s, {h: IN.J});
    check(s.seeds === seeds0 + 1 && !ent(s, 'berry'), 'struck big, the same block gives a seed instead');

    // dying: back at the checkpoint, small, with the level as it was there
    s = S(flatRoom(40, [[3, '@'], [8, '!'], [20, 'b']], g => { g[6][12] = '?'; }), {big: true});
    run(s, 60, IN.R);
    check(s.checkpoint.i === 0, 'passing the checkpoint marks it');
    s.p.x = 12 * TILE + TILE / 2; s.p.vx = 0;
    for (let i = 0; i < 30; i++) UF.step(s, {h: IN.J});
    check(UF.tileAt(s.level, 12, 6) === UF.T.USED && s.seeds === 1, 'a seed block used after it');
    s.p.inv = 0; s.p.big = false; s.p.h = P.H_SMALL;
    let died = false;
    for (let i = 0; i < 400 && s.p.mode === 'play'; i++) UF.step(s, {h: IN.R});
    died = s.p.mode === 'dead';
    run(s, 200, 0, t => t.events.some(e => e.type === 'respawn'));
    check(s.ents[0].x === 20 * TILE + TILE / 2 && s.ents[0].state === 'walk', 'the beetle is back where it started');
    run(s, 10);
    check(died && s.p.mode === 'play' && s.p.x === 8 * TILE + TILE / 2 && !s.p.big, 'walking into a beetle small: dead, and back at the checkpoint');
    check(UF.tileAt(s.level, 12, 6) === UF.T.QBLOCK && s.seeds === 0 && s.ents[0].state === 'walk', 'with the block, the seeds and the beetle as they were');
}

/* ================= the level validator ================= */
// Two instruments. The careful bot plays a level from start to flag the way a cautious person
// would, and measures each jump it had to make. The reachability graph ignores the creatures
// and asks about the ground itself: from everywhere you can get to, can you still finish (or
// at least fall to your death and start again)? Neither is trusted until it has rejected
// something, so each is first run on a level built to fail it.
const OFF = {coyote: false, buffer: false, corner: false};
const stand = (L, tx, ty) => (UF.SOLID[UF.tileAt(L, tx, ty)] === 1 || UF.tileAt(L, tx, ty) === UF.T.ONEWAY)
    && UF.SOLID[UF.tileAt(L, tx, ty - 1)] !== 1;
// the stretch of standable tiles a landing is on: landings on the same stretch are the same outcome
function stretch(L, x, y) {
    if (x === Infinity) return {key: 'flag', start: Infinity, end: Infinity, ty: -1};
    const ty = y / TILE;
    let a = Math.floor(x / TILE);
    if (!stand(L, a, ty)) a = Math.floor((x - P.W / 2) / TILE);
    if (!stand(L, a, ty)) a = Math.floor((x + P.W / 2 - 1) / TILE);
    let b = a;
    while (stand(L, a - 1, ty)) a--;
    while (stand(L, b + 1, ty)) b++;
    return {key: ty + ':' + a, start: a, end: b, ty};
}
const noCreatures = def => Object.assign({}, def, {rows: def.rows.map(r => r.replace(/[bsr]/g, '.'))});

// One move: hold `dir` for `wait` frames, then jump and hold it `hold` frames (0: no jump), keep
// holding `dir` until the player comes down somewhere. The camera at the moment of the jump is
// kept, to ask afterwards whether the landing was on screen when the jump was made.
function tryMove(s, dir, wait, hold, limit = 240) {
    const c = UF.clone(s), inputs = [], golds = [];
    let cam = null;
    const from = stretch(c.level, c.p.x, c.p.y).key;
    for (let f = 0; f < wait + limit; f++) {
        const h = dir | (hold && f >= wait && f < wait + hold ? IN.J : 0);
        if (f === wait) cam = {x: c.cam.x, y: c.cam.y};
        inputs.push(h);
        UF.step(c, {h});
        for (const e of c.events) if (e.type === 'gold') golds.push(e.tx + ',' + e.ty);
        if (c.p.mode === 'pole') return {inputs, x: Infinity, y: 0, cam, golds, dead: false};
        if (c.p.mode !== 'play') return {inputs, dead: true, golds};
        if (f > wait + 2 && c.p.onGround && (hold || stretch(c.level, c.p.x, c.p.y).key !== from))
            return {inputs, x: c.p.x, y: c.p.y, cam, golds, dead: false};
    }
    return null;
}

// After a move, is there still a way on? Standing still for a moment, or some jump soon after.
function safeAfter(s, inputs) {
    const c = UF.clone(s);
    for (const h of inputs) UF.step(c, {h});
    if (c.p.mode !== 'play') return c.p.mode !== 'dead';
    const idle = UF.clone(c);
    let alive = true;
    for (let i = 0; i < 20 && alive; i++) { UF.step(idle, {h: 0}); alive = idle.p.mode === 'play'; }
    if (alive) return true;
    for (const dir of [IN.R, IN.R | IN.B, IN.L])
        for (const hold of [16, 40])
            for (let wait = 0; wait <= 10; wait += 2) {
                const r = tryMove(c, dir, wait, hold);
                if (r && !r.dead) return true;
            }
    return false;
}

// The careful bot: the furthest stretch it can reach with `want` frames to spare, or failing that the
// one with the most room for error, jumping from the middle of the window, and never onto a
// spot it could not get away from.
function decide(bot, want, measure) {
    const byStretch = new Map();
    const here = stretch(bot.level, bot.p.x, bot.p.y);
    for (const dir of [IN.R, IN.R | IN.B])
        for (const hold of [4, 10, 16, 24, 40])
            for (let wait = 0; wait <= 36; wait++) {
                const r = tryMove(bot, dir, wait, hold);
                if (!r || r.dead) continue;
                const st = stretch(bot.level, r.x, r.y);
                if (st.key === here.key && r.x <= bot.p.x) continue;
                if (!byStretch.has(st.key)) byStretch.set(st.key, {st, groups: new Map()});
                const gs = byStretch.get(st.key).groups, k = dir + '/' + hold;
                if (!gs.has(k)) gs.set(k, []);
                gs.get(k).push(Object.assign(r, {dir, hold, wait}));
            }
    // candidates in order of preference; the first whose landing is not a trap is taken
    const cands = [];
    for (const {st, groups} of byStretch.values()) {
        let group = null;
        for (const g of groups.values()) if (!group || g.length > group.length) group = g;
        cands.push({st, group});
    }
    cands.sort((a, b) => {
        const ok = a.group.length >= want, bOk = b.group.length >= want;
        if (ok !== bOk) return ok ? -1 : 1;
        return ok ? b.st.start - a.st.start : b.group.length - a.group.length;
    });
    let choice = null, pick = null;
    for (const cand of cands) {
        const group = cand.group.sort((a, b) => a.wait - b.wait);
        let p = group[group.length >> 1];
        if (p.x <= bot.p.x && cand.st.key === here.key) p = group.reduce((a, b) => b.x > a.x ? b : a);
        if (p.x === Infinity || safeAfter(bot, p.inputs)) { choice = cand; pick = p; break; }
    }
    if (!choice) {
        // nothing safe ahead: wait, hop in place or step back, the way a person lets trouble come
        for (const dir of [0, IN.L, IN.L | IN.B])
            for (const hold of [0, 16, 40])
                for (const wait of [6, 14, 24, 36]) {
                    let r;
                    if (!dir && !hold) {
                        const inputs = Array(wait).fill(0), c = UF.clone(bot);
                        for (const h of inputs) UF.step(c, {h});
                        r = c.p.mode === 'play' ? {inputs, x: c.p.x, y: c.p.y} : null;
                    } else r = tryMove(bot, dir, wait, hold);
                    if (r && !r.dead && safeAfter(bot, r.inputs)) return {pick: Object.assign(r, {dir, hold, wait}), window: null};
                }
        return null;
    }
    // The window belongs to the level, not to where the bot happened to stop: measure it
    // again from the back of the stretch the bot stands on, as a person taking a run-up would.
    let window = choice.group.length;
    if (measure && window < 12 && here.start * TILE + TILE < bot.p.x) {
        const back = UF.clone(bot);
        back.p.x = here.start * TILE + TILE / 2;
        back.p.vx = 0;
        if (!UF.overlaps(back.level, back.p.x, back.p.y, back.p.w, back.p.h)) {
            const counts = new Map();
            for (const dir of [IN.R, IN.R | IN.B])
                for (const hold of [4, 10, 16, 24, 40])
                    for (let wait = 0; wait <= 60; wait++) {
                        const r = tryMove(back, dir, wait, hold);
                        if (!r || r.dead) continue;
                        if (stretch(back.level, r.x, r.y).key !== choice.st.key) continue;
                        const k = dir + '/' + hold;
                        counts.set(k, (counts.get(k) || 0) + 1);
                    }
            window = Math.max(window, ...counts.values());
        }
    }
    return {pick, window};
}

function carefulRun(def, feel, maxMoves = 160, want = 6) {
    const L = UF.parseLevel(def);
    const bot = UF.newGame(L, {feel, assist: OFF, viewW: 16});
    const moves = [], blind = [];
    let stuck = false;
    for (let n = 0; n < maxMoves && bot.p.mode === 'play'; n++) {
        const d = decide(bot, want, true);
        if (!d) { stuck = true; break; }
        const {pick, window} = d;
        // was the landing on a 16-tile screen at the moment of the jump?
        if (pick.x !== Infinity && pick.cam) {
            const inView = pick.x >= pick.cam.x && pick.x <= pick.cam.x + 16 * TILE
                && pick.y >= pick.cam.y && pick.y <= pick.cam.y + UF.VIEW_H * TILE;
            const allowed = (def.blindOk || []).some(([a, b]) => tiles(bot.p.x) >= a && tiles(bot.p.x) <= b);
            if (!inView && !allowed) blind.push(`${fmt(tiles(bot.p.x))} -> ${fmt(tiles(pick.x))}`);
        }
        const from = tiles(bot.p.x);
        for (const h of pick.inputs) UF.step(bot, {h});
        moves.push({from, to: bot.p.mode === 'play' ? fmt(tiles(bot.p.x)) : 'flag', window,
            run: !!(pick.dir & IN.B), dead: bot.p.mode === 'dead'});
        if (bot.p.mode === 'dead') break;
    }
    return {moves, blind, stuck, finished: bot.p.mode !== 'play' && bot.p.mode !== 'dead', deaths: bot.deaths};
}

// The same plan carried out by a hand that is off by a frame or two: every take-off and every
// release lands `sigma` frames either side of where it was meant to, at random. It plays on
// through its deaths, from the checkpoint, the way a person does.
function sloppyRun(def, sigma, seed, assist = OFF, maxMoves = 160) {
    const L = UF.parseLevel(def);
    const bot = UF.newGame(L, {assist, viewW: 16});
    let sd = seed;
    const rnd = () => ((sd = Math.imul(sd ^ (sd >>> 15), 2246822507) + 0x6D2B79F5 | 0) >>> 0) / 4294967296;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const where = [];
    let reason = 'moves';
    for (let n = 0; n < maxMoves && bot.p.mode !== 'clear' && bot.p.mode !== 'pole' && bot.p.mode !== 'walk'; n++) {
        while (bot.p.mode === 'dead') UF.step(bot);
        // with nothing safe in sight a person still does something: a jump forward, and maybe a death
        const d = decide(bot, 8, false) || {pick: {dir: IN.R, wait: 0, hold: 24}};
        const {pick} = d;
        const wait = Math.max(0, pick.wait + Math.round(gauss() * sigma));
        const hold = Math.max(1, pick.hold + Math.round(gauss() * sigma));
        for (let f = 0; f < wait + 240; f++) {
            UF.step(bot, {h: pick.dir | (f >= wait && f < wait + hold ? IN.J : 0)});
            if (bot.p.mode !== 'play') break;
            if (f > wait + 2 && bot.p.onGround) break;
        }
        if (bot.p.mode === 'dead') where.push(Math.round(tiles(bot.p.x)));
        if (bot.deaths >= 12) break;
    }
    return {finished: ['pole', 'walk', 'clear'].includes(bot.p.mode), deaths: bot.deaths, where, reason,
        x: fmt(tiles(bot.p.x)), y: fmt(tiles(bot.p.y)), big: bot.p.big};
}

// The reachability graph over stretches of ground, creatures left out.
function explore(def, feel) {
    const L = UF.parseLevel(noCreatures(def));
    const base = UF.newGame(L, {feel, assist: OFF, viewW: 16});
    const nodes = new Map();
    const node = st => {
        if (!nodes.has(st.key)) nodes.set(st.key, Object.assign({}, st, {out: new Set(), die: false, flag: false, done: false}));
        return nodes.get(st.key);
    };
    const first = node(stretch(L, base.p.x, base.p.y));
    const queue = [first], golds = new Set();
    let sims = 0;
    while (queue.length) {
        const n = queue.shift();
        if (n.done) continue;
        n.done = true;
        const xs = [...new Set([n.start, Math.round((n.start + n.end) / 2), n.end])];
        for (const tx of xs) {
            const s = UF.clone(base);
            Object.assign(s.p, {x: tx * TILE + TILE / 2, y: n.ty * TILE, vx: 0, vy: 0, onGround: true,
                fall: true, jumped: false, air: 0});
            UF.snapCamera(s);
            for (const dir of [0, IN.L, IN.R, IN.L | IN.B, IN.R | IN.B])
                for (const hold of [0, 6, 14, 24, 40])
                    for (const wait of hold ? [0, 5, 10, 16, 24, 34] : [40]) {
                        if (!dir && !hold) continue;
                        sims++;
                        const r = tryMove(s, dir, wait, hold, 200);
                        if (!r) continue;
                        for (const g of r.golds) golds.add(g);
                        if (r.dead) { n.die = true; continue; }
                        if (r.x === Infinity) { n.flag = true; continue; }
                        const to = node(stretch(L, r.x, r.y));
                        if (to.key !== n.key) {
                            n.out.add(to.key);
                            if (!to.done) queue.push(to);
                        }
                    }
        }
    }
    // everything reached must lead to the flag, or at least to a fall that starts you again
    const good = new Set([...nodes.values()].filter(n => n.flag || n.die).map(n => n.key));
    let grew = true;
    while (grew) {
        grew = false;
        for (const n of nodes.values()) if (!good.has(n.key) && [...n.out].some(k => good.has(k))) { good.add(n.key); grew = true; }
    }
    const softlocks = [...nodes.values()].filter(n => !good.has(n.key)).map(n => `x ${n.start}-${n.end}, y ${n.ty}`);
    const flagReached = [...nodes.values()].some(n => n.flag);
    const allGolds = [];
    for (let i = 0; i < L.tiles.length; i++) if (L.orig[i] === UF.T.GOLD) allGolds.push((i % L.w) + ',' + Math.floor(i / L.w));
    return {nodes: nodes.size, sims, softlocks, flagReached, missingGolds: allGolds.filter(g => !golds.has(g)), golds: allGolds.length};
}

if (suites.includes('levels')) {
    section('levels');
    // the instruments first: each must reject a level built to fail it
    const bad = (edit) => {
        const g = [];
        for (let y = 0; y < 15; y++) g.push(Array(60).fill(y >= 13 ? '#' : '.'));
        g[12][3] = '@';
        g[4][55] = 'F'; g[12][55] = 'X';
        edit(g);
        return {id: 'bad', rows: g.map(r => r.join(''))};
    };
    const gap = bad(g => { for (let x = 20; x < 31; x++) { g[13][x] = '.'; g[14][x] = '.'; } });
    const pit = bad(g => {
        for (let x = 20; x < 25; x++) { g[13][x] = '.'; }         // a pit one tile deep ...
        for (let y = 7; y < 13; y++) { g[y][19] = 'X'; g[y][25] = 'X'; }   // ... walled in, open above
        for (let x = 16; x < 19; x++) g[12][x] = 'X';
        g[11][18] = 'X'; g[10][18] = 'X';
    });
    const gapRun = carefulRun(gap, 'snappy', 40), gapGraph = explore(gap, 'snappy');
    check(!gapRun.finished && !gapGraph.flagReached, 'the validator rejects an 11-tile gap: no bot and no graph path reach the flag');
    const pitGraph = explore(pit, 'snappy');
    check(pitGraph.softlocks.length > 0, 'the validator finds a walled pit you can fall into and never leave', `softlocks: ${pitGraph.softlocks}`);

    for (const def of LEVELS) {
        let L = null;
        try { L = UF.parseLevel(def); } catch (e) { fail(`${def.id} parses`, e.message); continue; }
        pass(`${def.id} parses`);
        check(L.flag && L.flag.base < L.h, `${def.id} has a flag on the ground`);
        check(!UF.overlaps(L, L.start.tx * TILE + TILE / 2, (L.start.ty + 1) * TILE, P.W, P.H_BIG), `${def.id} starts with room to stand, even big`);
        check(UF.SOLID[UF.tileAt(L, L.start.tx, L.start.ty + 1)] === 1, `${def.id} starts on solid ground`);
        for (const c of L.checkpoints) check(UF.SOLID[UF.tileAt(L, c.tx, c.ty + 1)] === 1, `${def.id} checkpoint at ${c.tx} stands on ground`);
        for (const sp of L.spawns) check(UF.SOLID[UF.tileAt(L, sp.tx, sp.ty + 1)] === 1 || UF.tileAt(L, sp.tx, sp.ty + 1) === UF.T.ONEWAY,
            `${def.id} ${sp.kind} at ${sp.tx} starts on ground`);

        const minWindow = def.id === 'course' ? 6 : 8;
        for (const feel of def.id === 'course' ? ['snappy', 'classic'] : ['snappy']) {
            const r = carefulRun(def, feel, 160, minWindow);
            check(r.finished, `${def.id} (${feel}): the careful bot reaches the flag in ${r.moves.length} moves, small, fairness layer off`,
                r.stuck ? `stuck at ${r.moves.length ? r.moves[r.moves.length - 1].to : 'the start'}` : r.deaths ? `died after ${r.moves.map(m => m.to).join(' ')}` : '');
            const tight = r.moves.filter(m => m.window !== null && m.window < minWindow);
            check(tight.length === 0, `${def.id} (${feel}): every jump on the way has ${minWindow} frames or more to spare`,
                tight.map(m => `${fmt(m.from)} -> ${m.to}: ${m.window} f`).join(', '));
            check(r.blind.length === 0, `${def.id} (${feel}): every landing is on a 16-tile screen when the jump is made`, r.blind.join(', '));
            const narrow = r.moves.filter(m => m.window !== null).sort((a, b) => a.window - b.window).slice(0, 4);
            note(`${def.id} (${feel}) narrowest: ` + narrow.map(m => `x ${Math.round(m.from)}->${m.to} ${m.run ? 'run' : 'walk'} ${m.window}f`).join(', '));
        }
        const g = explore(def, 'snappy');
        check(g.flagReached, `${def.id}: the graph reaches the flag (${g.nodes} stretches, ${g.sims} moves tried)`);
        check(g.softlocks.length === 0, `${def.id}: nowhere you can get to is a dead end`, g.softlocks.join('; '));
        check(g.missingGolds.length === 0, `${def.id}: all ${g.golds} golden seeds can be reached`, `missing ${g.missingGolds.join(' ')}`);
    }

    // the camera keeps the player on screen at every view width, through the whole course
    const course = UF.parseLevel(LEVELS.find(l => l.id === 'course'));
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

if (suites.includes('hands')) {
    section('hands');
    for (const def of LEVELS.filter(l => l.id !== 'course')) {
        for (const [sigma, label] of [[1, '±1 f'], [2, '±2 f'], [3, '±3 f']]) {
            for (const [assist, aName] of [[OFF, 'fairness off'], [{coyote: true, buffer: true, corner: true}, 'fairness on']]) {
                const runs = [];
                for (let i = 0; i < 6; i++) runs.push(sloppyRun(def, sigma, 1000 * sigma + i, assist));
                const fin = runs.filter(r => r.finished).length;
                const deaths = runs.map(r => r.deaths);
                const spots = {};
                for (const r of runs) for (const w of r.where) spots[w] = (spots[w] || 0) + 1;
                const worst = Object.entries(spots).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([x, n]) => `x ${x} (${n})`).join(', ');
                const stuckAt = runs.filter(r => !r.finished).map(r => `${r.reason} at ${r.x}`);
                note(`${def.id}, timing ${label}, ${aName}: finished ${fin}/6, deaths ${deaths.join(' ')}; most at ${worst || '-'}${stuckAt.length ? '; unfinished: ' + stuckAt.join(', ') : ''}`);
                if (sigma === 1) check(fin === 6, `${def.id}: a hand off by a frame always finishes (${aName})`);
            }
        }
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
