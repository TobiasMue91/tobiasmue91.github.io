#!/usr/bin/env node
// Test suite for playground/underfoot_tempo.html, the "tempo" prototype.
//
// The prototype's claims are about speed: that it builds only by running on without a stop, that
// every move keeps it or loses it the way the page says, that the escape home is fair, and that
// the ranks mean something. The first two are checked in small rooms with the real physics; the
// last two by bots that play the real level: a search bot for the fastest line, and the same
// search with the tiers switched off, which is the most a player who never gets past running
// speed could do.
//
//   node test/underfoot_tempo.mjs                  # everything (about a minute)
//   node test/underfoot_tempo.mjs moves escape     # named suites only
//   node test/underfoot_tempo.mjs route --record   # print a new LINE for the page's ghost
//   node test/underfoot_tempo.mjs --page=other.html
//
// Suites: moves, escape, route.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'playground', 'underfoot_tempo.html');
const RECORD = args.includes('--record');
const ALL = ['moves', 'escape', 'route'];
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
// two copies of the rules: one as the page has them, one with the tiers switched off
function load(noTiers) {
    const ctx = vm.createContext({});
    vm.runInContext(block('core') + '\nthis.UF = UF;', ctx);
    vm.runInContext(block('levels') + '\nthis.LEVELS = LEVELS; this.LINE = LINE; this.LINE_FRAMES = LINE_FRAMES;', ctx);
    if (noTiers) vm.runInContext('UF.P.TIERS[1] = UF.P.TIERS[2] = UF.P.TIERS[0]; UF.P.CHARGE = 1e9;', ctx);
    return ctx;
}
const CTX = load(false);
const {UF, LEVELS, LINE, LINE_FRAMES} = CTX;
const P = UF.P, FX = UF.FX, TILE = UF.TILE, IN = UF.IN, T = UF.T;
const DEF = LEVELS[0];
const fmt = v => (Math.round(v * 100) / 100).toFixed(2);
const secs = frames => (frames / 60).toFixed(2) + ' s';
const RUN = IN.R | IN.B, RUN_L = IN.L | IN.B;

// a small room: `rows` of characters, the player at '@'
const room = (rows, opts = {}) => UF.newGame(UF.parseLevel({id: 't', rows}), Object.assign({viewW: 16}, opts));
const run = (s, n, h = 0, until) => {
    for (let i = 0; i < n; i++) { UF.step(s, {h}); if (until && until(s)) return i + 1; }
    return n;
};
const flat = (w = 300, extra = []) => {
    const rows = [];
    for (let y = 0; y < 8; y++) rows.push('.'.repeat(w));
    rows.push('..@' + '.'.repeat(w - 3));
    rows.push('#'.repeat(w), '#'.repeat(w));
    for (const [x, y, c] of extra) rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + c.length);
    return rows;
};
// step n frames (or until `until`), collecting the events of one type; h is an input or i => input
const events = (s, n, h, type, until) => {
    const got = [];
    for (let i = 0; i < n; i++) {
        const v = typeof h === 'function' ? h(i) : h;
        UF.step(s, typeof v === 'object' ? v : {h: v});
        for (const e of s.events) if (e.type === type) got.push(Object.assign({at: i}, e));
        if (until && until(s)) break;
    }
    return got;
};

/* ================= moves ================= */
if (suites.includes('moves')) {
    section('moves');
    // the tiers: running flat out on open ground steps up twice
    let s = room(flat());
    const ups = events(s, 200, RUN, 'tier');
    check(ups.length === 2, 'running flat out steps up twice, and no more', `${ups.length} tier events`);
    if (ups.length === 2) {
        note(`dash after ${secs(ups[0].at)}, blaze after ${secs(ups[1].at)}`);
        check(ups[0].at >= 45 && ups[0].at <= 75, `the first step up comes after about a second (${ups[0].at} frames)`);
        check(ups[1].at - ups[0].at >= 45 && ups[1].at - ups[0].at <= 60, `the second as long again (${ups[1].at - ups[0].at} frames)`);
    }
    check(s.p.tier === 2 && Math.abs(s.p.vx) === P.TIERS[2], `blaze runs at ${P.TIERS[2] / FX} px/f`, `vx ${s.p.vx / FX}`);
    const blaze = UF.clone(s);
    // what takes it away
    s = UF.clone(blaze); run(s, 1, 0);
    check(s.p.tier === 0, 'letting go of the stick for one frame loses the tier');
    s = UF.clone(blaze); run(s, 1, RUN_L);
    check(s.p.tier === 0, 'turning round loses it');
    s = UF.clone(blaze); run(s, P.RUN_TIMER + 1, IN.R);
    check(s.p.tier === 0, 'so does letting go of run');
    s = UF.clone(blaze);
    UF.step(s, {h: RUN | IN.J, p: IN.J}); run(s, 20, RUN | IN.J);
    check(!s.p.onGround && s.p.tier === 2 && Math.abs(s.p.vx) === P.TIERS[2], 'a jump keeps the tier, and the speed in the air');
    run(s, 80, RUN, t => t.p.onGround);
    check(s.p.onGround && s.p.tier === 2, 'and it is still there on landing');
    s = UF.clone(blaze);
    UF.step(s, {h: RUN | IN.J, p: IN.J}); run(s, 5, RUN | IN.J); run(s, 20, RUN_L | IN.J);
    check(s.p.tier === 0 && Math.abs(s.p.vx) <= P.RUN_MAX, 'turning round in the air loses the tier, and the speed with it',
        `tier ${s.p.tier}, vx ${s.p.vx / FX}`);
    // speed without the tier behind it is not kept by hopping
    s = room(flat());
    run(s, 30, RUN);
    s.p.vx = P.TIERS[2];
    UF.step(s, {h: RUN | IN.J, p: IN.J}); run(s, 8, RUN | IN.J);
    check(s.p.tier === 0 && s.p.vx <= P.RUN_MAX, 'at the bottom tier, a hop does not keep more than running speed', `vx ${s.p.vx / FX}`);

    // walls: sliding down one, kicking off it
    const shaft = [];
    for (let y = 0; y < 30; y++) shaft.push(y >= 28 ? '##########' : y === 27 ? '#@...#....' : '#....#....');
    s = room(shaft);
    run(s, 10, IN.R);
    UF.step(s, {h: IN.R | IN.J, p: IN.J});
    run(s, 12, IN.R | IN.J);
    let maxVy = 0, touched = 0;
    for (let i = 0; i < 90 && !s.p.onGround; i++) { UF.step(s, {h: IN.R}); if (s.p.touchWall) { touched++; if (s.p.vy > maxVy) maxVy = s.p.vy; } }
    check(touched > 10 && maxVy <= P.WALL_SLIDE, `pressed against a wall you slide down it no faster than ${P.WALL_SLIDE / FX} px/f`,
        `touched ${touched} frames, fastest ${maxVy / FX}`);
    const kickRoom = () => {
        const t = room(shaft);
        run(t, 10, IN.R);
        UF.step(t, {h: IN.R | IN.J, p: IN.J});
        run(t, 40, IN.R | IN.J, u => u.p.touchWall);
        return t;
    };
    s = kickRoom();
    check(s.p.touchWall, 'a jump towards a wall reaches it');
    const y0 = s.p.y;
    UF.step(s, {h: IN.R, p: IN.J});
    check(s.events.some(e => e.type === 'kick') && s.p.vx === -P.RUN_MAX && s.p.vy <= -P.KICK_VY + P.JUMP_ROWS[2][2],
        'jumping while touching it kicks off, away from it', `vx ${s.p.vx / FX} vy ${s.p.vy / FX}`);
    const vxs = [];
    for (let i = 0; i < P.KICK_LOCK + 6; i++) { UF.step(s, {h: IN.R | IN.J}); vxs.push(s.p.vx); }
    check(vxs.slice(0, P.KICK_LOCK - 1).every(v => v === -P.RUN_MAX), `for ${P.KICK_LOCK} frames the stick cannot pull you back`);
    check(vxs[vxs.length - 1] > -P.RUN_MAX, 'after that it can');
    check(Math.min(s.p.y, y0) < y0 - 2 * TILE, 'a kick gains height');
    // the jump may come a little early: find the frame the wall is first touched, then press before it
    const jumped = () => { const t = room(shaft); run(t, 10, IN.R); UF.step(t, {h: IN.R | IN.J, p: IN.J}); return t; };
    s = jumped();
    const touch = run(s, 60, IN.R | IN.J, t => t.p.touchWall) - 1;
    const pressEarly = k => events(jumped(), 40, i => ({h: IN.R | IN.J, p: i === touch - k ? IN.J : 0}), 'kick').length > 0;
    check(touch > 8 && pressEarly(P.BUFFER), `a jump pressed ${P.BUFFER} frames before touching the wall still kicks`);
    check(!pressEarly(P.BUFFER + 1), `one pressed ${P.BUFFER + 1} frames before does not`);
    // climbing a shaft four tiles wide, kicking from side to side
    const tall = [];
    for (let y = 0; y < 26; y++) tall.push(y >= 24 ? '#######' : y === 23 ? '#@....#' : y < 4 ? '.......' : '#....#.');
    s = room(tall);
    UF.step(s, {h: IN.R | IN.J, p: IN.J});
    let dir = IN.R, top = s.p.y;
    for (let i = 0; i < 400; i++) {
        const touching = s.p.touchWall;
        UF.step(s, {h: dir | IN.J, p: touching ? IN.J : 0});
        if (s.events.some(e => e.type === 'kick')) dir = dir === IN.R ? IN.L : IN.R;
        top = Math.min(top, s.p.y);
    }
    check(top <= 5 * TILE, `kicking from wall to wall climbs a shaft (from row 24 to row ${fmt(top / TILE)})`);

    // slides: under anything a tile high, for as long as it goes on
    const tunnel = flat(200, [[40, 7, '#'.repeat(30)], [40, 8, '.'.repeat(30)]]);
    tunnel[6] = tunnel[6].slice(0, 40) + '#'.repeat(30) + tunnel[6].slice(70);
    s = room(tunnel);
    run(s, 50, RUN);
    const slides = events(s, 200, RUN | IN.D, 'slide');
    check(slides.length === 1, 'down while running starts one slide, however long it is held');
    // the way a thumb does it: pulled down well before the tunnel (down alone, no direction), held
    // all the way through and out the other side, then pushed forward again. Nothing is lost.
    s = room(tunnel);
    run(s, 400, RUN, t => t.p.x > 16 * TILE);
    const held0 = {vx: s.p.vx, tier: s.p.tier};
    let least = Infinity, lowest = 9;
    for (let i = 0; i < 400 && s.p.x < 80 * TILE; i++) {
        UF.step(s, {h: IN.D});
        least = Math.min(least, Math.abs(s.p.vx));
        lowest = Math.min(lowest, s.p.tier);
    }
    check(s.p.x >= 80 * TILE && least === Math.abs(held0.vx) && lowest === held0.tier,
        `down held from 24 tiles before a tunnel to 10 past it keeps the speed and the tier (${fmt(held0.vx / FX)} px/f, tier ${held0.tier})`,
        `reached x ${fmt(s.p.x / TILE)}, slowest ${least / FX}, lowest tier ${lowest}`);
    run(s, 3, RUN);
    check(!s.p.duck && s.p.tier === held0.tier && Math.abs(s.p.vx) === Math.abs(held0.vx), 'let go and push on: up and running, as fast as before');
    s = room(flat());
    run(s, 400, RUN, t => t.p.tier === 2);
    UF.step(s, {h: RUN | IN.D});
    run(s, P.SLIDE + 5, RUN);
    check(!s.p.duck && s.p.tier === 2, 'a slide tapped in the open runs its course and leaves the tier as it was');
    s = room(tunnel);
    run(s, 400, RUN, t => t.p.x > 37 * TILE);
    const v0 = Math.abs(s.p.vx);
    UF.step(s, {h: RUN | IN.D});
    let slow = Infinity, inside = 0;
    for (let i = 0; i < 400 && s.p.x < 72 * TILE; i++) {
        UF.step(s, {h: RUN});                       // down tapped once: the slide carries on
        if (s.p.x > 41 * TILE && s.p.x < 69 * TILE) { inside++; slow = Math.min(slow, Math.abs(s.p.vx)); }
    }
    check(s.p.x >= 72 * TILE && slow === v0, `a slide goes through a 30-tile tunnel at the speed it started with (${fmt(v0 / FX)} px/f)`,
        `reached x ${fmt(s.p.x / TILE)}, slowest ${slow / FX}`);
    run(s, P.SLIDE + 1, RUN);
    check(!s.p.duck && s.p.slide === 0, 'and once out, it runs its course and you are up again');
    s = room(tunnel);
    run(s, 200, RUN);
    check(s.p.x < 40 * TILE, 'running at it without a slide gets you nowhere');
    s = room(flat());
    run(s, 5, IN.D); run(s, 60, IN.R | IN.D);
    check(s.p.duck && s.p.vx === P.CRAWL, `ducking with a direction held crawls at ${P.CRAWL / FX} px/f`);

    // clods, walls and beetles, at speed and without it
    const clods = flat(300, [[60, 7, 'BB'], [60, 8, 'BB']]);
    s = room(clods);
    const broke = events(s, 600, RUN, 'break', t => t.p.x > 64 * TILE);
    check(broke.length === 4 && broke.every(e => e.smash) && s.p.x > 64 * TILE && s.p.tier === 2,
        'at a dash a clod wall bursts, and the run goes on', `${broke.length} breaks, x ${fmt(s.p.x / TILE)}`);
    s = room(flat(300, [[14, 7, 'BB'], [14, 8, 'BB']]));
    const early = events(s, 300, RUN, 'break', t => t.p.x > 17 * TILE);
    check(early.length === 4 && s.p.tier === 1, 'the first step up is enough', `${early.length} breaks at tier ${s.p.tier}`);
    s = room(flat(300, [[7, 7, 'BB'], [7, 8, 'BB']]));
    run(s, 120, RUN);
    check(s.p.x < 7 * TILE && s.p.tier === 0, 'at running speed it stops you');
    const wall = flat(300, [[60, 7, 'X'], [60, 8, 'X']]);
    s = room(wall);
    const crash = events(s, 600, RUN, 'crash', t => t.p.x > 58 * TILE && t.p.onGround && t.p.stun === 0 && t.p.vx > 0 && false);
    check(crash.length >= 1 && crash[0].at < 400, 'running into a wall at a dash is a crash');
    s = room(wall);
    run(s, 600, RUN, t => t.events.some(e => e.type === 'crash'));
    check(s.p.vx < 0 && s.p.stun > 0 && s.p.tier === 0 && s.p.mode === 'play', 'which throws you back, dazed, with the tier gone');
    const high = flat(300, [[60, 0, 'X'], [60, 1, 'X'], [60, 2, 'X'], [60, 3, 'X'], [60, 4, 'X'], [60, 5, 'X']]);
    s = room(high);
    run(s, 600, RUN, t => t.p.x > 55 * TILE);
    UF.step(s, {h: RUN | IN.J, p: IN.J});
    let met = false;
    const airCrash = events(s, 40, RUN | IN.J, 'crash', t => { met = met || t.p.touchWall; return false; });
    check(met && airCrash.length === 0 && s.p.tier === 2, 'meeting a wall in the air is no crash, and the tier stays for a kick');
    const beetles = flat(300, [[60, 8, 'b']]);
    s = room(beetles);
    const knocks = events(s, 400, RUN, 'knock');
    check(knocks.length === 1 && knocks[0].run && s.p.combo === 1 && s.p.tier === 2, 'at a dash a beetle in the way is bowled over');
    s = room(flat(300, [[12, 8, 'b']]));
    const hit = events(s, 120, RUN, 'bonked');
    check(hit.length === 1 && s.p.mode === 'play' && s.deaths === 0, 'slower, it knocks you back, and that is all');

    // pits: back on the last ground you stood on
    const gap = flat(300, [[30, 9, '.'.repeat(40)], [30, 10, '.'.repeat(40)]]);
    s = room(gap);
    let down = false;
    const fell = events(s, 400, () => down ? 0 : RUN, 'fell', t => { down = down || t.events.some(e => e.type === 'fell'); return false; });
    check(fell.length === 1 && s.p.mode === 'play' && s.p.onGround && Math.abs(s.p.x - 30 * TILE) < TILE && s.deaths === 1,
        'running into a pit puts you back at its edge', `at x ${fmt(s.p.x / TILE)}`);
}

/* ================= escape ================= */
if (suites.includes('escape')) {
    section('escape');
    const L0 = UF.parseLevel(DEF);
    const find = t => { for (let i = 0; i < L0.tiles.length; i++) if (L0.tiles[i] === t) return {tx: i % L0.w, ty: (i / L0.w) | 0}; return null; };
    const bag = find(T.BAG), board = find(T.ESC_OFF), crate = find(T.ESC_ON), home = find(T.HOME);
    check(bag && board && crate && home, 'the level has a sack, boards, crates and a way home');
    // stand beside the sack and step onto it
    const atSack = () => {
        const s = UF.newGame(UF.parseLevel(DEF), {viewW: 20});
        s.p.x = (bag.tx - 2) * TILE + TILE / 2;
        s.p.y = (bag.ty + 1) * TILE;
        s.p.onGround = true;
        UF.snapCamera(s);
        return s;
    };
    let s = atSack();
    check(UF.solidAt(s.level, board.tx, board.ty) && !UF.solidAt(s.level, crate.tx, crate.ty), 'before the sack: boards are solid, crates are not there');
    const start = events(s, 60, IN.R, 'escape', t => t.escape);
    check(start.length === 1 && s.escape, 'taking the sack starts the escape');
    check(!UF.solidAt(s.level, board.tx, board.ty) && UF.solidAt(s.level, crate.tx, crate.ty), 'and swaps them: the boards give way, the crates are in the way');
    check(s.escapeT === DEF.escapeTime * 60, `the clock starts at ${DEF.escapeTime} s`);
    check(s.ents.length === s.level.spawns.length && s.ents.every(e => !e.gone && !e.active && e.state === 'walk'), 'every creature is back where it started');
    run(s, 120, 0);
    check(s.p.onGround && s.p.y > (bag.ty + 3) * TILE, 'the sack sat on a loose board: you drop to the way underneath', `feet at row ${fmt(s.p.y / TILE)}`);
    // too slow: back to the sack, and the level as it was when the sack was taken
    const clodAt = (() => { for (let i = 0; i < s.level.tiles.length; i++) if (s.level.tiles[i] === T.BRICK && (i % s.level.w) > 120) return i; return -1; })();
    s.level.tiles[clodAt] = T.EMPTY;
    s.escapeT = 2;
    const late = events(s, 3, 0, 'late');
    check(late.length === 1 && s.escape && s.escapeT === DEF.escapeTime * 60 - 1, 'when the clock runs out the escape starts again, clock and all');
    check(s.level.tiles[clodAt] === T.BRICK, 'with what was smashed on the way back put back');
    check(Math.abs(s.p.x - (bag.tx * TILE + TILE / 2)) < TILE, 'from the sack');
    // a pit on the way home costs time
    s = atSack(); run(s, 60, IN.R); run(s, 120, 0);
    const before = s.escapeT;
    s.p.y = (s.level.h + 6) * TILE; s.p.onGround = false;
    const f = events(s, 1, 0, 'fell');
    check(f.length === 1 && before - s.escapeT === P.FALL_COST + 1, `a fall on the way home costs ${P.FALL_COST / 60} s`);
    // home: nothing before the sack, the end after it
    s = UF.newGame(UF.parseLevel(DEF), {viewW: 20});
    run(s, 200, RUN_L);
    check(s.p.mode === 'play', 'the mouse hole does nothing before the sack is taken');
    s = atSack(); run(s, 60, IN.R);
    s.p.x = (home.tx + 3) * TILE; s.p.y = (home.ty + 2) * TILE; s.p.onGround = true; s.p.vx = 0;
    const clear = events(s, 120, RUN_L, 'clear');
    check(clear.length === 1 && s.p.mode === 'clear', 'after it, the mouse hole ends the run');
}

/* ================= route ================= */
// Beam search over short held inputs, steered along the level's route: out to the sack, then home.
function searchBot(ctx, chunk = 6, beam = 60, coarse = false) {
    const U = ctx.UF, D = ctx.LEVELS[0];
    const acts = [RUN, RUN_L, 0, RUN | IN.J, RUN_L | IN.J, IN.J, IN.D, -RUN, -RUN_L];     // negative: a short hop
    const score = (s, w) => {
        const p = s.p, route = s.escape ? D.route.back : D.route.out;
        let i = s.escape ? w.b : w.o;
        const px = p.x / TILE, py = p.y / TILE;
        while (i < route.length && p.onGround && Math.abs(px - route[i][0]) < 1.2 && Math.abs(py - route[i][1]) < 1.2) i++;
        if (s.escape) w.b = i; else w.o = i;
        const [wx, wy] = route[Math.min(i, route.length - 1)];
        return (s.escape ? 1e6 : 0) + i * 1e4 - Math.hypot(px - wx, py - wy) * 10 + p.tier * 2;
    };
    const key = s => {
        const p = s.p;
        return coarse ? [Math.round(p.x / FX / 8), Math.round(p.y / FX / 8), Math.sign(p.vx), p.tier, s.escape ? 1 : 0].join()
            : [Math.round(p.x / FX / 3), Math.round(p.y / FX / 3), Math.round(p.vx / FX * 2), Math.round(p.vy / FX * 2), p.tier, p.onGround ? 1 : 0, s.escape ? 1 : 0].join();
    };
    let nodes = [{s: U.newGame(D, {viewW: 20}), w: {o: 0, b: 0}, log: []}], best = null;
    for (let c = 0; c < 1500 && !best; c++) {
        const next = new Map();
        for (const n of nodes) for (const a of acts) {
            const s = U.clone(n.s), w = Object.assign({}, n.w), log = n.log.slice();
            for (let f = 0; f < chunk; f++) {
                const h = a < 0 ? -a | (f < 2 ? IN.J : 0) : a;
                U.step(s, {h});
                log.push(h);
                if (s.p.mode === 'clear') break;
            }
            if (s.p.mode === 'clear') { if (!best || s.time < best.s.time) best = {s, log}; continue; }
            const sc = score(s, w), k = key(s), old = next.get(k);
            if (!old || old.sc < sc) next.set(k, {s, w, log, sc});
        }
        nodes = [...next.values()].sort((a, b) => b.sc - a.sc).slice(0, beam);
    }
    return best;
}
const replay = (ctx, log, until) => {
    const s = ctx.UF.newGame(ctx.LEVELS[0], {viewW: 20}), seen = new Set();
    for (const [v, n] of log) for (let i = 0; i < n; i++) {
        ctx.UF.step(s, {h: v & 63, p: v >> 6});
        for (const e of s.events) seen.add(e.type);
        if (until && until(s)) return {s, seen};
    }
    return {s, seen};
};
const rle = frames => {
    const out = [];
    for (const v of frames) { const l = out[out.length - 1]; if (l && l[0] === v) l[1]++; else out.push([v, 1]); }
    return out;
};

if (suites.includes('route')) {
    section('route');
    const [S, A, B] = DEF.ranks;
    const t0 = Date.now();
    const fast = searchBot(CTX);
    check(!!fast, 'the search bot gets out to the sack and home again');
    if (fast) {
        const s = fast.s, out = s.bagTime, back = s.time - s.bagTime;
        note(`fastest line: ${secs(s.time)} (out ${secs(out)}, home ${secs(back)}), ${s.bestCombo} hits in a row, ${s.deaths} falls (${((Date.now() - t0) / 1000).toFixed(0)} s to find)`);
        const {seen} = replay(CTX, rle(fast.log));
        for (const move of ['tier', 'kick', 'slide', 'break', 'knock'])
            check(seen.has(move), `the fastest line uses '${move}'`);
        check(s.time <= S * 60 * 0.9, `S (${S} s) is within reach: the line beats it by ${secs(S * 60 - s.time)}`);
        check(back * 2 <= DEF.escapeTime * 60, `the fastest way home takes under half the escape clock (${secs(back)} of ${DEF.escapeTime} s)`);
        if (RECORD) {
            console.log(`\nconst LINE = ${JSON.stringify(rle(fast.log))};\nconst LINE_FRAMES = ${s.time};\n`);
        }
    }
    // the same search with the tiers switched off: never faster than running
    const t1 = Date.now();
    const slow = searchBot(load(true), 6, 80, true);
    check(!!slow, 'the level can be finished without ever getting past running speed');
    if (slow) {
        const s = slow.s, back = s.time - s.bagTime;
        note(`never faster than running: ${secs(s.time)} (out ${secs(s.bagTime)}, home ${secs(back)}) (${((Date.now() - t1) / 1000).toFixed(0)} s to find)`);
        check(s.time > S * 60, `S needs the tiers: the best run without them takes ${secs(s.time)}, over ${S} s`);
        check(s.time <= A * 60, `A (${A} s) is what a flawless run at running speed gets`);
        check(B >= A * 1.3, `B (${B} s) leaves room for mistakes`);
        check(DEF.escapeTime * 60 - back >= 8 * 60, `even at running speed the way home leaves ${secs(DEF.escapeTime * 60 - back)} of the clock for mistakes`);
    }
    // the ghost on the page: the stored line still plays out, frame for frame
    const line = replay(CTX, LINE, t => t.p.mode === 'clear').s;
    check(line.p.mode === 'clear' && line.time === LINE_FRAMES, `the page's fastest-line ghost still reaches home, in ${secs(LINE_FRAMES)}`,
        `mode ${line.p.mode} at ${secs(line.time)}; re-record with: node test/underfoot_tempo.mjs route --record`);
    const a = replay(CTX, LINE).s, b = replay(CTX, LINE).s;
    check(UF.hash(a) === UF.hash(b), 'a replayed run comes out the same every time');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
