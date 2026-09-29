#!/usr/bin/env node
// Test suite for games/underfoot.html, Underfoot (built as the "tempo" prototype).
//
// The game's claims are about speed: that it builds by running on, that every move keeps it or
// loses it the way the page says, that each level's way home is hard in its own way but fair, and
// that the ranks mean something. The first two are checked in small rooms with the real physics,
// the third on the real levels and on small ones for the mower and the cat. The last are measured
// by bots that play the levels: a search bot for the fastest line; the same search with the tiers
// switched off, which is the most a player who never gets past running speed could do; and that one
// again made to stand still on the ground every few moves on the way home, standing in for a
// player who hesitates.
//
//   node test/underfoot_tempo.mjs                        # moves, escape, lines (about 15 s)
//   node test/underfoot_tempo.mjs moves escape           # named suites only
//   node test/underfoot_tempo.mjs route                  # the bots, every level (several minutes)
//   node test/underfoot_tempo.mjs route --level=drain    # one level's
//   node test/underfoot_tempo.mjs route --record         # and print new LINES for the page's ghost
//   node test/underfoot_tempo.mjs --page=other.html
//
// Suites: moves, escape, lines, and the slow route.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = name => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const PAGE = argOf('page') || join(HERE, '..', 'games', 'underfoot.html');
const RECORD = args.includes('--record');
const ONLY = argOf('level');
const DEFAULT = ['moves', 'escape', 'lines'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : DEFAULT;

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
    vm.runInContext(block('levels') + '\nthis.LEVELS = LEVELS; this.LINES = LINES;', ctx);
    if (noTiers) vm.runInContext('UF.P.TIERS[1] = UF.P.TIERS[2] = UF.P.TIERS[0]; UF.P.CHARGE = 1e9;', ctx);
    return ctx;
}
const CTX = load(false);
const {UF, LEVELS, LINES} = CTX;
const P = UF.P, FX = UF.FX, TILE = UF.TILE, IN = UF.IN, T = UF.T;
const byId = id => LEVELS.find(l => l.id === id);
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
    // what keeps it, and what takes it away: a tier waits a moment for you to get going again
    s = UF.clone(blaze); run(s, 40, RUN_L);
    check(s.p.tier === 2 && s.p.vx === -P.TIERS[2], 'a turn keeps the tier: the other way at full speed within two thirds of a second',
        `tier ${s.p.tier}, vx ${s.p.vx / FX}`);
    s = UF.clone(blaze);
    run(s, 20, 0); const t20 = s.p.tier;
    run(s, 30, 0); const t50 = s.p.tier;
    run(s, 40, 0); const t90 = s.p.tier;
    check(t20 === 2 && t50 === 1 && t90 === 0, `standing still, it waits ${P.HOLD} frames, then goes a step at a time`, `tiers ${t20}, ${t50}, ${t90}`);
    s = UF.clone(blaze); run(s, 5, 0); run(s, 60, RUN);
    check(s.p.tier === 2 && s.p.vx === P.TIERS[2], 'a short stop costs nothing but the time');
    s = UF.clone(blaze); run(s, 8, 0);
    for (let i = 0; i < 4; i++) { run(s, 2, IN.J); run(s, 60, 0, t => t.p.onGround); }
    check(s.p.tier === 0, 'hopping on the spot is standing still: it runs down just the same', `tier ${s.p.tier}`);
    s = UF.clone(blaze);
    run(s, P.RUN_TIMER + 20, IN.R); const w20 = s.p.tier;
    run(s, 100, IN.R);
    check(w20 === 2 && s.p.tier === 0, 'letting go of run runs it down the same way');
    s = UF.clone(blaze);
    UF.step(s, {h: RUN | IN.J, p: IN.J}); run(s, 20, RUN | IN.J);
    check(!s.p.onGround && s.p.tier === 2 && Math.abs(s.p.vx) === P.TIERS[2], 'a jump keeps the tier, and the speed in the air');
    run(s, 80, RUN, t => t.p.onGround);
    check(s.p.onGround && s.p.tier === 2, 'and it is still there on landing');
    s = UF.clone(blaze);
    UF.step(s, {h: RUN | IN.J, p: IN.J}); run(s, 5, RUN | IN.J); run(s, 20, RUN_L | IN.J);
    check(s.p.tier === 2 && Math.abs(s.p.vx) <= P.RUN_MAX, 'turning round in the air keeps the tier, but only a run the other way',
        `tier ${s.p.tier}, vx ${s.p.vx / FX}`);
    run(s, 120, RUN_L, t => t.p.onGround);
    run(s, 20, RUN_L);
    check(s.p.tier === 2 && s.p.vx === -P.TIERS[2], 'and on the ground it is soon full speed again');
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

    // the pond: at a dash the water carries you; slower, or stopping, or turning, it swallows you
    const pond = (x, n = 12, extra = []) => flat(300, [[x, 9, 'w'.repeat(n)], [x, 10, 'w'.repeat(n)], ...extra]);
    s = room(pond(6));
    let splash = events(s, 150, RUN, 'splash', t => t.events.some(e => e.type === 'fell'));
    check(splash.length === 1 && s.deaths === 1 && s.p.onGround && s.p.x < 7 * TILE && UF.firm(s.level, s.p),
        'at running speed you go under, and are put back on the bank', `${splash.length} splashes, x ${fmt(s.p.x / TILE)}`);
    s = room(pond(80));
    run(s, 600, RUN, t => t.p.x > 70 * TILE);
    splash = events(s, 200, RUN, 'splash', t => t.p.x > 95 * TILE);
    check(splash.length === 0 && s.p.x > 95 * TILE, `at a dash or faster you run across (${fmt(P.SKIM / FX)} px/f and up)`);
    const onPond = () => { const s = room(pond(80, 30)); run(s, 600, RUN, t => t.p.x > 85 * TILE); return s; };
    s = onPond();
    const was = s.p.onGround && UF.isWater(UF.tileAt(s.level, Math.floor(s.p.x / TILE), 9));
    check(was && events(s, 60, 0, 'splash').length === 1, 'let go on the water and you go under');
    s = onPond();
    check(events(s, 60, RUN_L, 'splash').length === 1, 'turn round on it and you go under');
    s = onPond();
    UF.step(s, {h: RUN | IN.J, p: IN.J});
    const leap = events(s, 120, RUN | IN.J, 'splash', t => t.p.onGround);
    check(leap.length === 0 && s.p.onGround && s.p.y === 9 * TILE, 'a jump off the water lands back on it, running');
    s = room(pond(6));
    events(s, 150, RUN, 'fell', t => t.events.some(e => e.type === 'fell'));
    check(s.safe === null || UF.firm(s.level, {x: s.safe.x, y: s.safe.y, w: P.W}), 'where you are put back is firm ground, never the water');
    // lily pads: they hold anyone, for a moment
    s = room(flat(60, [[20, 9, 'wwlww'], [20, 10, 'wwwww']]));
    Object.assign(s.p, {x: 22 * TILE + TILE / 2, y: 9 * TILE, onGround: true});
    let went = -1, wet = -1;
    for (let i = 0; i < 90 && wet < 0; i++) {
        UF.step(s, {h: 0});
        if (s.events.some(e => e.type === 'lily' && e.down)) went = i + 1;
        if (s.events.some(e => e.type === 'splash')) wet = i + 1;
    }
    check(went === P.LILY_HOLD && wet > went && wet - went < 10,
        `a lily pad holds you ${P.LILY_HOLD} frames, then goes under with you`, `under at ${went}, splash at ${wet}`);
    run(s, P.LILY_UNDER + 20);
    check(UF.tileAt(s.level, 22, 9) === T.LILY, 'and comes up again');
    // frogs: back and forth, three tiles each leap; land on one and it throws you high
    s = room(flat(60, [[12, 8, 'f']]));
    const xs = [];
    for (let i = 0; i < 400; i++) { UF.step(s, {h: 0}); if (s.ents[0].onGround && (!xs.length || xs[xs.length - 1] !== s.ents[0].x)) xs.push(s.ents[0].x); }
    check(xs.length >= 4 && xs.every((x, i) => Math.abs(x - (i % 2 ? 15 : 12) * TILE - TILE / 2) < 2 * FX), 'a frog leaps back and forth, three tiles',
        xs.map(x => fmt(x / TILE)).join(' '));
    s = room(flat(60, [[12, 8, 'f']]));
    run(s, 5);
    Object.assign(s.p, {x: s.ents[0].x, y: s.ents[0].y - 3 * TILE, onGround: false, vy: 2 * FX, fall: true, jumped: true});
    let frogTop = Infinity, stomped = 0;
    for (let i = 0; i < 120; i++) {
        UF.step(s, {h: IN.J});
        if (s.events.some(e => e.type === 'stomp')) stomped++;
        if (stomped) frogTop = Math.min(frogTop, s.p.y);
        if (stomped && s.p.onGround) break;
    }
    check(stomped === 1 && (9 * TILE - frogTop) / TILE > 7.5 && s.ents[0].state === 'flip', `land on a frog with jump held and it throws you ${fmt((9 * TILE - frogTop) / TILE)} tiles up`);
    // anything else that walks into the water is gone
    s = room(flat(60, [[8, 9, 'wwww'], [8, 10, 'wwww'], [13, 8, 'b']]));
    const plop = events(s, 300, 0, 'splash');
    check(plop.length === 1 && plop[0].id === 0 && s.ents[0].gone, 'a beetle that walks into the pond is gone with a splash');

    // mushrooms in the lawn: on one and you go up, as high as jump is held, speed and tier kept
    const lawn = (w, at) => {
        const rows = [];
        for (let y = 0; y < 14; y++) rows.push('.'.repeat(w));
        rows.push('.@' + '.'.repeat(w - 2));
        rows.push('='.repeat(at) + 'MM' + '='.repeat(w - at - 2));
        rows.push('#'.repeat(w));
        return rows;
    };
    const bounce = (s, h) => {
        let peak = Infinity, boing = 0;
        for (let i = 0; i < 300; i++) {
            UF.step(s, {h});
            if (s.events.some(e => e.type === 'boing')) { boing++; if (boing === 1) peak = s.p.y; }
            if (boing) peak = Math.min(peak, s.p.y);
            if (boing && s.p.onGround) break;
        }
        return {boing, rise: (15 * TILE - peak) / TILE};
    };
    s = room(lawn(80, 20));
    run(s, 60, RUN, t => t.p.x > 12 * TILE);
    let b = bounce(s, RUN);
    check(b.boing >= 1 && b.rise > 1.5 && b.rise < 3, `running over a mushroom throws you up a little (${fmt(b.rise)} tiles)`);
    s = room(lawn(80, 20));
    run(s, 60, RUN, t => t.p.x > 12 * TILE);
    b = bounce(s, RUN | IN.J);
    check(b.boing >= 1 && b.rise > 7.5, `with jump held, higher than any jump (${fmt(b.rise)} tiles)`);
    s = room(lawn(300, 140));
    run(s, 600, RUN, t => t.p.x > 135 * TILE);
    const t0 = s.p.tier;
    run(s, 60, RUN, t => t.events.some(e => e.type === 'boing'));
    run(s, 3, RUN);
    check(t0 === 2 && !s.p.onGround && s.p.tier === 2 && s.p.vx === P.TIERS[2], 'and a blaze stays a blaze, in the air at full speed',
        `tier ${t0} then ${s.p.tier}, vx ${s.p.vx / FX}, ground ${s.p.onGround}, x ${fmt(s.p.x / TILE)}`);
}

/* ================= escape ================= */
// put the mouse on the ground `dx` tiles from a level's item, and step onto it
function atItem(id, dx) {
    const def = byId(id), s = UF.newGame(UF.parseLevel(def), {viewW: 20}), it = s.level.item;
    s.p.x = (it.tx + dx) * TILE + TILE / 2;
    s.p.y = (it.ty + 1) * TILE;
    s.p.onGround = true;
    UF.snapCamera(s);
    const took = events(s, 90, dx < 0 ? IN.R : IN.L, 'escape', t => t.escape);
    return {s, def, took: took.length};
}
if (suites.includes('escape')) {
    section('escape');
    for (const def of LEVELS) {
        const L = UF.parseLevel(def);
        check(L.item && L.home && L.home.tx !== undefined, `${def.id}: the level has an item and a way home`);
        check(def.ranks && def.ranks.length === 3 && def.ranks[0] < def.ranks[1] && def.ranks[1] < def.ranks[2], `${def.id}: three ranks, in order`);
        check(!!(LINES[def.id]), `${def.id}: the page has a fastest line for its ghost`);
    }

    // the seed sack: a clock, and the level turned round
    const SACK = byId('sack');
    const L0 = UF.parseLevel(SACK);
    const find = t => { for (let i = 0; i < L0.tiles.length; i++) if (L0.tiles[i] === t) return {tx: i % L0.w, ty: (i / L0.w) | 0}; return null; };
    const board = find(T.ESC_OFF), crate = find(T.ESC_ON), home = L0.home, item = L0.item;
    let {s, took} = atItem('sack', -2);
    check(took === 1 && s.escape, 'taking the sack starts the escape');
    check(!UF.solidAt(s.level, board.tx, board.ty) && UF.solidAt(s.level, crate.tx, crate.ty), 'and turns the level round: the boards give way, the crates are in the way');
    check(s.escapeT === SACK.escape.time * 60, `the clock starts at ${SACK.escape.time} s`);
    check(s.ents.length === s.level.spawns.length && s.ents.every(e => !e.gone && !e.active && e.state === 'walk'), 'every creature is back where it started');
    const fresh = UF.newGame(UF.parseLevel(SACK), {viewW: 20});
    check(UF.solidAt(fresh.level, board.tx, board.ty) && !UF.solidAt(fresh.level, crate.tx, crate.ty), 'before it, boards were solid and the crates not there');
    run(s, 120, 0);
    check(s.p.onGround && s.p.y > (item.ty + 3) * TILE, 'the sack sat on a loose board: you drop to the way underneath', `feet at row ${fmt(s.p.y / TILE)}`);
    // too slow: back to the sack, and the level as it was when the sack was taken
    const clodAt = (() => { for (let i = 0; i < s.level.tiles.length; i++) if (s.level.tiles[i] === T.BRICK && (i % s.level.w) > 120) return i; return -1; })();
    s.level.tiles[clodAt] = T.EMPTY;
    s.escapeT = 2;
    const late = events(s, 3, 0, 'late');
    check(late.length === 1 && late[0].why === 'time' && s.escape && s.escapeT === SACK.escape.time * 60 - 1, 'when the clock runs out the escape starts again, clock and all');
    check(s.level.tiles[clodAt] === T.BRICK, 'with what was smashed on the way back put back');
    check(Math.abs(s.p.x - (item.tx * TILE + TILE / 2)) < TILE, 'from the sack');
    // a pit on the way home costs time
    ({s} = atItem('sack', -2)); run(s, 120, 0);
    const before = s.escapeT;
    s.p.y = (s.level.h + 6) * TILE; s.p.onGround = false;
    const f = events(s, 1, 0, 'fell');
    check(f.length === 1 && before - s.escapeT === P.FALL_COST + 1, `a fall on the way home costs ${P.FALL_COST / 60} s`);
    // home: nothing before the sack, the end after it
    s = UF.newGame(UF.parseLevel(SACK), {viewW: 20});
    run(s, 200, RUN_L);
    check(s.p.mode === 'play', 'the mouse hole does nothing before the sack is taken');
    ({s} = atItem('sack', -2));
    s.p.x = (home.tx + 3) * TILE; s.p.y = (home.ty + 2) * TILE; s.p.onGround = true; s.p.vx = 0;
    const clear = events(s, 120, RUN_L, 'clear');
    check(clear.length === 1 && s.p.mode === 'clear', 'after it, the mouse hole ends the run');

    // the drain: water rises from below, and waits for nobody
    const DRAIN = byId('drain'), W = DRAIN.escape;
    ({s, took} = atItem('drain', 2));
    check(took === 1 && s.chase && s.escapeT === 0, 'taking the button lets the water in');
    const surface0 = s.chase.pos;
    run(s, W.delay - 2, 0);
    check(s.chase.pos === surface0, `the water waits ${W.delay} frames`);
    run(s, 62, 0);
    check(s.chase.pos < surface0 && s.chase.pos >= surface0 - 62 * W.speed * FX, `then rises at ${W.speed} px/f`);
    const drowned = events(s, 3000, 0, 'late', t => t.events.some(e => e.type === 'late'));
    check(drowned.length === 1 && drowned[0].why === 'water', 'stand still and it catches you');
    check(s.escape && s.chase.pos === surface0 && Math.abs(s.p.x - s.item.x) < 1, 'and it all starts again at the button, the water back down');
    // climb far above it and it hurries to catch up, but never jumps
    ({s} = atItem('drain', 2));
    run(s, W.delay + 5, 0);
    s.p.y -= 30 * TILE;
    const y0 = s.chase.pos;
    run(s, 10, 0);
    check(y0 - s.chase.pos === 10 * 3 * Math.round(W.speed * FX), `left ${W.gap} tiles behind, it rises three times as fast`);

    // the river bank: it falls away behind you, towards home
    const BANK = byId('bank'), K2 = BANK.escape;
    ({s, took} = atItem('bank', 2));
    check(took === 1 && s.chase && s.level.escape.dir === -1, 'taking the strawberry starts the bank crumbling, towards home');
    const edge0 = s.chase.pos;
    run(s, K2.delay + 20, 0);
    check(s.chase.pos < edge0, 'the edge comes on');
    const behind = Math.floor(s.chase.pos / TILE) + 2;               // two columns behind the edge
    let solidBehind = 0, stone = 0;
    for (let ty = 0; ty < s.level.h; ty++) {
        const t = UF.tileAt(s.level, behind, ty);
        if (t === T.GROUND || t === T.GRASS) solidBehind++;
    }
    check(solidBehind === 0, 'and the bank behind it is gone, all the way down');
    // stone stays: a small bank with a stone slab over the path, and the edge sent past it
    const slab = UF.newGame(UF.parseLevel({id: 't', escape: {kind: 'crumble', from: 1, delay: 0, speed: 2, gap: 99}, rows: [
        '............................................................',
        '........................................XX..................',
        '............................................................',
        'HH..@.....................................................Q.',
        '############################################################',
        '############################################################']}), {viewW: 16});
    slab.p.x = 57 * TILE + TILE / 2; slab.p.y = 4 * TILE;
    run(slab, 30, IN.R, t => t.escape);
    run(slab, 400, RUN_L, t => t.chase && t.chase.pos < 39 * TILE);
    for (let tx = 40; tx <= 41; tx++) if (UF.tileAt(slab.level, tx, 1) === T.STONE) stone++;
    check(slab.escape && slab.chase.pos < 39 * TILE && stone === 2 && UF.tileAt(slab.level, 40, 4) === T.EMPTY,
        'stone stays, where the earth under it went', `edge at ${fmt(slab.chase.pos / TILE)}, stone ${stone}`);
    const fellIn = events(s, 3000, 0, 'late', t => t.events.some(e => e.type === 'late'));
    check(fellIn.length === 1 && fellIn[0].why === 'crumble', 'stand still and it takes you with it');
    let restored = 0;
    for (let ty = 0; ty < s.level.h; ty++) if (UF.solidAt(s.level, behind, ty)) restored++;
    check(restored > 0 && s.chase.pos === edge0, 'and it all starts again at the strawberry, the bank whole');

    // the mower: along the lawn towards home, round what stands on it, and it cuts nothing
    const yard = (escape, extra = []) => {
        const rows = [];
        for (let y = 0; y < 13; y++) rows.push('XX' + '.'.repeat(68));
        rows.push('HH' + '.'.repeat(68));
        rows.push('HH..@' + '.'.repeat(63) + 'Q.');
        rows.push('='.repeat(70));
        rows.push('#'.repeat(70));
        for (const [x, y, str] of extra) rows[y] = rows[y].slice(0, x) + str + rows[y].slice(x + str.length);
        return UF.newGame(UF.parseLevel({id: 't', escape, rows}), {viewW: 16});
    };
    const take = s => { s.p.x = 66 * TILE + TILE / 2; s.p.y = 15 * TILE; UF.snapCamera(s); run(s, 30, IN.R, t => t.escape); return s; };
    // hold the mouse where `at(i)` says, as if it walked there: the trail and the lead see only where it is
    const hold = (s, n, at, until) => {
        for (let i = 0; i < n; i++) {
            const [x, y, low] = at(i);
            Object.assign(s.p, {x: Math.round(x * TILE), y: Math.round(y * TILE), vx: 0, vy: 0, h: low ? P.H_DUCK : P.H, duck: !!low, onGround: true});
            UF.step(s, {h: 0});
            if (until && until(s)) return i + 1;
        }
        return n;
    };
    const MOW = {kind: 'mower', from: 1, delay: 0, speed: 2, gap: 99, round: 0.25};
    s = take(yard(MOW, [[40, 14, 'hh']]));
    check(s.escape && s.chase && s.chase.pos > s.p.x, 'taking the item starts the mower, beyond it');
    const steps = [];
    let pos = s.chase.pos;
    const caught = [];
    hold(s, 2000, () => [10.5, 15], t => {
        if (t.events.some(e => e.type === 'late')) { caught.push(...t.events.filter(e => e.type === 'late')); return true; }
        steps.push({d: pos - t.chase.pos, round: t.chase.round}); pos = t.chase.pos; return false;
    });
    const open = steps.filter(x => !x.round), round = steps.filter(x => x.round);
    check(open.length > 100 && open.every(x => x.d === 2 * FX), 'on open lawn it comes on at its speed');
    check(round.length > 20 && round.every(x => x.d === 0.5 * FX), 'round the hedge a quarter as fast', `${round.length} frames going round`);
    let grass = 0;
    for (let tx = 0; tx < 70; tx++) if (UF.tileAt(s.level, tx, 15) === T.GRASS) grass++;
    check(grass === 70 && UF.tileAt(s.level, 40, 14) === T.HEDGE, 'and the lawn and the hedge are all still there');
    check(caught.length === 1 && caught[0].why === 'mower', 'stand in its way and it catches you');
    check(Math.abs(s.p.x - (68 * TILE + TILE / 2)) < TILE && s.chase.pos > s.p.x, 'and it starts again at the item, the mower behind it');

    // the cat: it follows the trail wherever it went, squeezes where you went low, and waits for no one
    const CAT = {kind: 'cat', delay: 30, speed: 2, gap: 99, squeeze: 0.25};
    s = take(yard(CAT));
    check(s.escape && s.chase && s.chase.path.length === 1, 'taking the item wakes the cat, where the item was');
    // out over an arch three tiles high, then low for a stretch, then on at a run
    const trail = i => {
        const x = 68.5 - i * 0.12;
        if (x > 60) return [x, 15];
        if (x > 54) return [x, 15 - 3 * Math.sin((60 - x) / 6 * Math.PI)];
        if (x > 44) return [x, 15, true];
        return [Math.max(x, 12.5), 15];
    };
    let top = Infinity, woke = -1, lowRate = [], runRate = [];
    let last = null;
    const n = hold(s, 1500, trail, t => {
        const c = t.chase;
        if (c.wait === 0 && woke < 0) woke = t.escapeT;
        const a = UF.catAt(c);
        if (a.x > 54 * TILE && a.x < 60 * TILE) top = Math.min(top, a.y);
        if (last && c.wait === 0 && c.path.length > 2) (a.low ? lowRate : runRate).push(Math.abs(a.x - last.x) + Math.abs(a.y - last.y));
        last = a;
        return t.events.some(e => e.type === 'late');
    });
    check(woke === CAT.delay, `it wakes ${CAT.delay} frames after`, `at ${woke}`);
    check(top < 13 * TILE, 'over the arch the cat goes up it, where the mouse went', `highest ${fmt(15 - top / TILE)} tiles up`);
    const mid = arr => arr.slice().sort((a, b) => a - b)[arr.length >> 1];
    check(lowRate.length > 10 && runRate.length > 10 && mid(lowRate) <= mid(runRate) * 0.3,
        'where the mouse went low, the cat squeezes after it, slowly', `low ${fmt(mid(lowRate) / FX)} px/f, running ${fmt(mid(runRate) / FX)} px/f`);
    check(s.events.some(e => e.type === 'late' && e.why === 'cat') && n < 1500, 'and when the mouse stops, the cat catches up');
    // hopping home is no further for the cat than running home
    const trailOf = hop => {
        const s = take(yard(Object.assign({}, CAT, {delay: 1e6}))), x0 = s.p.x;     // a cat that sleeps on
        for (let i = 0; i < 150; i++) UF.step(s, {h: RUN_L | (hop && i % 24 < 12 ? IN.J : 0)});
        return {per: s.chase.len / (x0 - s.p.x), hops: hop};
    };
    const flatRun = trailOf(false), hops = trailOf(true);
    check(flatRun.per < 1.05 && hops.per < 1.1, 'hopping all the way does not make the trail longer for the cat',
        `trail per tile run ${fmt(flatRun.per)}, hopped ${fmt(hops.per)}`);
    // a pit: the trail goes on from its edge, not from the bottom
    s = take(yard(CAT));
    hold(s, 60, i => [66.5 - i * 0.1, 15]);
    s.p.y = (s.level.h + 6) * TILE; s.p.onGround = false;
    UF.step(s, {h: 0});
    check(s.chase.path.every(q => q[1] <= s.level.h * TILE), 'into a pit and back: the cat is not sent down it');
    // a snake is the cat's rules with other numbers: through any gap, but slow wherever the trail climbs
    const SNAKE = {kind: 'cat', animal: 'snake', delay: 40, speed: 2, gap: 99, squeeze: 1, climb: 0.25};
    s = take(yard(SNAKE));
    const upRate = [], flatRate = [];
    let prevAt = null;
    hold(s, 900, i => {
        const x = 68.5 - i * 0.2;
        return x > 50 ? [x, 15] : x > 40 ? [x, 15 - (50 - x) * 0.6] : [Math.max(x, 12.5), 9];
    }, t => {
        const a = UF.catAt(t.chase);
        if (prevAt && t.chase.path.length > 2) {
            const d = Math.abs(a.x - prevAt.x) + Math.abs(a.y - prevAt.y);
            if (a.y < prevAt.y) upRate.push(d); else if (a.y === prevAt.y) flatRate.push(d);
        }
        prevAt = a;
        return t.events.some(e => e.type === 'late');
    });
    check(upRate.length > 10 && flatRate.length > 10 && mid(upRate) <= mid(flatRate) * 0.5,
        'a grass snake follows the trail as the cat does, but slowly where it climbs', `up ${fmt(mid(upRate) / FX)}, flat ${fmt(mid(flatRate) / FX)} px/f`);

    // the race: the pond skater makes for the mouse hole, fast on the water and slow on land
    const RACE = {kind: 'race', delay: 10, water: 3, land: 1};
    const racecourse = () => yard(RACE, [[20, 15, 'w'.repeat(30)], [20, 16, 'w'.repeat(30)]]);
    s = take(racecourse());
    const legs = {wet: [], dry: []};
    let skaterWas = s.chase.pos, lost = null;
    hold(s, 3000, () => [66.5, 15], t => {
        const l = t.events.find(e => e.type === 'late');
        if (l) { lost = l; return true; }
        if (t.chase.wait === 0 && t.chase.pos !== skaterWas) (t.chase.wet ? legs.wet : legs.dry).push(skaterWas - t.chase.pos);
        skaterWas = t.chase.pos;
        return false;
    });
    check(legs.wet.length > 100 && legs.wet.every(d => d === 3 * FX) && legs.dry.length > 100 && legs.dry.every(d => d === FX),
        'across the water the pond skater goes at its water speed, over land at its land speed');
    check(lost && lost.why === 'race', 'stand still and it is home first: the race starts again');
    s = take(racecourse());
    const won = events(s, 800, RUN_L, 'clear', t => t.p.mode === 'clear');
    check(won.length === 1 && !s.events.some(e => e.type === 'late') && UF.danger(s) > 0, 'run home first, over the water at a dash, and it is yours');

    // the flood: the pond rises, and every row it reaches is water
    const FLOOD = {kind: 'flood', from: 1, delay: 0, speed: 1, gap: 99};
    s = take(yard(FLOOD, [[30, 13, 'X']]));
    let rose = -1, sank = null;
    for (let i = 0; i < 200 && !sank; i++) {
        UF.step(s, {h: 0});
        if (rose < 0 && s.events.some(e => e.type === 'flood' && e.row === 14)) rose = i;
        sank = s.events.find(e => e.type === 'late') || null;
        if (rose >= 0 && rose === i) {
            let wet = 0;
            for (let tx = 2; tx < 70; tx++) if (UF.isWater(UF.tileAt(s.level, tx, 14))) wet++;
            check(wet === 68 && UF.tileAt(s.level, 30, 13) === T.STONE, 'the row it reaches fills with water, and nothing else changes', `${wet} tiles of 68`);
        }
    }
    check(rose > 0 && sank && sank.why === 'water' && UF.tileAt(s.level, 20, 14) === T.EMPTY,
        'stand in it and it closes over you: the escape starts again, dry', sank ? sank.why : 'not caught');
    s = take(yard(Object.assign({}, FLOOD, {speed: 0.25})));
    run(s, 400, 0, t => t.events.some(e => e.type === 'flood' && e.row === 14) || t.p.sink > 0);
    Object.assign(s.p, {x: 60 * TILE, y: 14 * TILE, vx: -P.TIERS[2], onGround: true, tier: 2, sink: 0, mode: 'play'});
    const dry = events(s, 40, RUN_L, 'splash');
    check(dry.length === 0 && s.p.y === 14 * TILE && s.p.onGround, 'at a dash you run across the flood as across the pond');
    // and when it comes up round you: at a dash it lifts you and you run on; slower, it closes over you
    const rising = (vx, tier, h) => {
        const t = take(yard(Object.assign({}, FLOOD, {speed: 0.25})));
        run(t, 40, 0);
        Object.assign(t.p, {x: 62 * TILE, y: 15 * TILE, vx: -vx, vy: 0, onGround: true, tier, sink: 0, mode: 'play'});
        const lifts = events(t, 120, h, 'surf', u => u.events.some(e => e.type === 'flood' && e.row === 14));
        const sank = t.p.sink > 0;
        const after = events(t, 30, h, 'splash');
        return {t, lifts, after, sank};
    };
    let r = rising(P.TIERS[2], 2, RUN_L);
    check(r.lifts.length === 1 && r.lifts[0].dy === TILE && r.after.length === 0 && r.t.p.y === 14 * TILE && r.t.p.onGround,
        'the flood coming up round you at a dash lifts you a row, and you run on across it',
        `${r.lifts.length} lifts, ${r.after.length} splashes, feet at row ${r.t.p.y / TILE}`);
    r = rising(P.TIERS[0], 0, IN.L);
    check(r.lifts.length === 0 && r.sank, 'at a walk it closes over you');
    // a roof over you: no room to be lifted, and under you go
    const roofed = take(yard(Object.assign({}, FLOOD, {speed: 0.25}), [[30, 12, 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX']]));
    run(roofed, 40, 0);
    Object.assign(roofed.p, {x: 58 * TILE, y: 15 * TILE, vx: -P.TIERS[2], vy: 0, onGround: true, tier: 2, sink: 0, mode: 'play'});
    const under = events(roofed, 120, RUN_L, 'surf', u => u.events.some(e => e.type === 'flood' && e.row === 14));
    check(under.length === 0 && roofed.p.sink > 0, 'under a roof it cannot lift you: at any speed it closes over you');
    // the heron: it takes aim, locks on and strikes; a mouse still on the spot is caught, one that
    // keeps going gets away, one under cover is safe
    const HERON = {kind: 'heron', delay: 0, speed: 2, fly: 6, gap: 6, reach: 8, watch: 30, aim: 20, lock: 12, strike: 5, recover: 15};
    const cycle = HERON.watch + HERON.aim + HERON.lock + HERON.strike;
    s = take(yard(HERON));
    const phases = [];
    let struck = null;
    for (let i = 0; i < 200 && !struck; i++) {
        UF.step(s, {h: 0});
        for (const e of s.events) { if (e.type === 'heron') phases.push(e.phase); if (e.type === 'late') struck = {why: e.why, at: i}; }
    }
    check(phases.slice(0, 4).join() === 'aim,lock,strike,struck' && struck && struck.why === 'heron' && Math.abs(struck.at - cycle) <= 2,
        'the heron watches, aims, locks on and strikes: stand still and it has you', `${phases.join()} caught ${struck && struck.at} (cycle ${cycle})`);
    s = take(yard(HERON));
    const walk = events(s, 300, IN.L, 'heron');
    check(!s.events.some(e => e.type === 'late') && s.deaths === 0 && walk.filter(e => e.phase === 'struck' && e.hit === 'miss').length >= 2,
        'walk on, even slowly, and every strike misses', `${walk.filter(e => e.phase === 'struck').map(e => e.hit).join()}`);
    const hid = take(yard(HERON, [[60, 11, 'WWWWWWWW']]));
    Object.assign(hid.p, {x: 64 * TILE, y: 15 * TILE, vx: 0});
    const safe = events(hid, cycle + 20, 0, 'heron');
    check(hid.deaths === 0 && safe.some(e => e.phase === 'struck' && e.hit === 'cover'), 'under boards it cannot reach you: the beak hits the wood');
    // far off, it flies after you, and it will not take aim until you are in reach
    const far = take(yard(HERON));
    Object.assign(far.p, {x: 20 * TILE});
    UF.step(far, {h: 0});
    const flew = far.chase.fly;
    let aimedFar = false, closing = 0;
    while (closing++ < 300 && Math.abs(far.p.x - far.chase.pos) > HERON.reach * TILE) {
        UF.step(far, {h: 0});
        if (far.events.some(e => e.type === 'heron' && e.phase === 'aim')) aimedFar = true;
    }
    check(flew && !aimedFar && closing < 300, 'far off it flies after you, and takes aim only once you are in reach', `flew ${flew}, aimed from afar ${aimedFar}, ${closing} frames`);

    // lily pads float up with it, and carry whoever stands on one
    const pool = take(yard(Object.assign({}, FLOOD, {speed: 1}), [[20, 15, 'wwwwwwwwwwlwwwwwwwwww'], [20, 16, 'wwwwwwwwwwwwwwwwwwwww']]));
    Object.assign(pool.p, {x: 30 * TILE + TILE / 2, y: 15 * TILE, vx: 0, vy: 0, onGround: true, tier: 0, sink: 0, mode: 'play'});
    const carried = events(pool, 60, 0, 'surf', u => u.events.some(e => e.type === 'flood' && e.row === 14));
    run(pool, 5, 0);
    check(UF.tileAt(pool.level, 30, 14) === T.LILY && UF.tileAt(pool.level, 30, 15) === T.WATER && carried.length === 1
        && pool.p.y === 14 * TILE && pool.p.onGround && !pool.p.sink,
        'a lily pad floats up with the flood, and carries the mouse standing on it',
        `pad at 14: ${UF.tileAt(pool.level, 30, 14)}, feet row ${pool.p.y / TILE}, sink ${pool.p.sink}`);
    // it takes the seeds with it
    const wash = take(yard(Object.assign({}, FLOOD, {speed: 1}), [[20, 14, 'o']]));
    run(wash, 60, 0, u => u.events.some(e => e.type === 'flood' && e.row === 14));
    check(UF.tileAt(wash.level, 20, 14) === T.WATER, 'a seed the flood reaches is washed away');
}

/* ================= lines ================= */
// each level's stored fastest line: the ghost on the page, and the proof that S can be had
const replay = (ctx, def, log, until) => {
    const s = ctx.UF.newGame(def, {viewW: 20}), seen = new Set();
    for (const [v, n] of log) for (let i = 0; i < n; i++) {
        ctx.UF.step(s, {h: v & 63, p: v >> 6});
        for (const e of s.events) seen.add(e.type);
        if (until && until(s)) return {s, seen};
    }
    return {s, seen};
};
if (suites.includes('lines')) {
    section('lines');
    for (const def of LEVELS) {
        const L = LINES[def.id];
        if (!L) { fail(`${def.id}: no stored line`); continue; }
        const {s, seen} = replay(CTX, def, L.log, t => t.p.mode === 'clear');
        check(s.p.mode === 'clear' && s.time === L.frames, `${def.id}: the stored line still gets home, in ${secs(L.frames)}`,
            `mode ${s.p.mode} at ${secs(s.time)}; re-record with: node test/underfoot_tempo.mjs route --level=${def.id} --record`);
        check(L.frames <= def.ranks[0] * 60 * 0.9, `${def.id}: S (${def.ranks[0]} s) is within reach, with ${secs(def.ranks[0] * 60 - L.frames)} to spare`);
        for (const move of ['tier', 'kick', 'slide', 'knock'])
            check(seen.has(move), `${def.id}: the fastest line uses '${move}'`);
        const a = replay(CTX, def, L.log).s, b = replay(CTX, def, L.log).s;
        check(UF.hash(a) === UF.hash(b), `${def.id}: a replayed run comes out the same every time`);
    }
}

/* ================= route ================= */
// Beam search over short held inputs, steered along the level's route: out to the item, then home.
// `pause`: on the way home, once every `pause` moves the mouse has to stand still for one, at its
// first chance on the ground.
function searchBot(ctx, def, {chunk = 6, beam = 60, coarse = false, pause = 0} = {}) {
    const U = ctx.UF;
    const acts = [RUN, RUN_L, 0, RUN | IN.J, RUN_L | IN.J, IN.J, IN.D, IN.D | IN.R, IN.D | IN.L, -RUN, -RUN_L];     // negative: a short hop; down with a direction: a crawl
    const score = (s, w) => {
        const p = s.p, route = s.escape ? def.route.back : def.route.out;
        let i = s.escape ? w.b : w.o;
        const px = p.x / TILE, py = p.y / TILE;
        while (i < route.length && p.onGround && Math.abs(px - route[i][0]) < 1.2 && Math.abs(py - route[i][1]) < 1.2) i++;
        if (s.escape) w.b = i; else w.o = i;
        const [wx, wy] = route[Math.min(i, route.length - 1)];
        // nearer the next waypoint is better, and a tier, and going: pressed against a wall is not
        return (s.escape ? 1e6 : 0) + i * 1e4 - Math.hypot(px - wx, py - wy) * 10 + p.tier * 2 + (coarse ? 0 : Math.abs(p.vx) / FX * 3);
    };
    const key = s => {
        const p = s.p;
        return coarse ? [Math.round(p.x / FX / 8), Math.round(p.y / FX / 8), Math.sign(p.vx), p.tier, s.escape ? 1 : 0].join()
            : [Math.round(p.x / FX / 3), Math.round(p.y / FX / 3), Math.round(p.vx / FX * 2), Math.round(p.vy / FX * 2), p.tier, p.onGround ? 1 : 0, s.escape ? 1 : 0].join();
    };
    let nodes = [{s: U.newGame(def, {viewW: 20}), w: {o: 0, b: 0}, log: [], k: 0, lead: Infinity, dodged: 0}], best = null;
    for (let c = 0; c < 2500 && !best && nodes.length; c++) {
        const next = new Map();
        for (const n of nodes) {
            // a pause is standing still: it comes at the first chance on the ground once `pause` moves have gone by
            const forced = pause && n.s.escape && n.k + 1 >= pause && n.s.p.onGround;
            for (const a of forced ? [0] : acts) {
                const s = U.clone(n.s), w = Object.assign({}, n.w), log = n.log.slice();
                let lead = n.lead, caught = false, dodged = n.dodged;
                for (let f = 0; f < chunk; f++) {
                    const h = a < 0 ? -a | (f < 2 ? IN.J : 0) : a;
                    U.step(s, {h});
                    log.push(h);
                    if (s.events.some(e => e.type === 'late')) { caught = true; break; }
                    for (const e of s.events) if (e.type === 'heron' && e.phase === 'struck') dodged++;
                    if (s.escape) lead = Math.min(lead, U.danger(s));
                    if (s.p.mode === 'clear') break;
                }
                if (caught) continue;
                if (s.p.mode === 'clear') { if (!best || s.time < best.s.time) best = {s, log, lead, dodged}; continue; }
                const sc = score(s, w), kk = key(s), old = next.get(kk);
                if (!old || old.sc < sc) next.set(kk, {s, w, log, sc, k: n.s.escape && !forced ? n.k + 1 : 0, lead, dodged});
            }
        }
        nodes = [...next.values()].sort((a, b) => b.sc - a.sc).slice(0, beam);
    }
    return best;
}
const rle = frames => {
    const out = [];
    for (const v of frames) { const l = out[out.length - 1]; if (l && l[0] === v) l[1]++; else out.push([v, 1]); }
    return out;
};

if (suites.includes('route')) {
    section('route');
    const record = {};
    const slowCtx = load(true);
    for (const def of LEVELS) {
        if (ONLY && def.id !== ONLY) continue;
        const [S, A, B] = def.ranks, X = def.escape;
        const lead = r => X.kind === 'clock' ? `${secs(X.time * 60 - (r.s.time - r.s.itemTime))} of the clock left`
            : X.kind === 'heron' ? `${r.dodged} strikes dodged` : `never nearer than ${fmt(r.lead)} tiles`;
        const t0 = Date.now();
        const fast = searchBot(CTX, def);
        check(!!fast, `${def.id}: the search bot gets out and home again`);
        if (fast) {
            const s = fast.s;
            note(`${def.id}: fastest line ${secs(s.time)} (out ${secs(s.itemTime)}, home ${secs(s.time - s.itemTime)}, ${lead(fast)}) (${((Date.now() - t0) / 1000).toFixed(0)} s to find)`);
            check(s.time <= S * 60 * 0.9, `${def.id}: S (${S} s) is within reach: the line beats it by ${secs(S * 60 - s.time)}`);
            record[def.id] = {frames: s.time, log: rle(fast.log)};
        }
        const sdef = slowCtx.LEVELS.find(l => l.id === def.id);
        const slow = searchBot(slowCtx, sdef, {beam: 80, coarse: true});
        check(!!slow, `${def.id}: it can be finished without ever getting past running speed`);
        if (slow) {
            const s = slow.s;
            note(`${def.id}: never faster than running ${secs(s.time)} (out ${secs(s.itemTime)}, home ${secs(s.time - s.itemTime)}, ${lead(slow)})`);
            check(s.time > S * 60, `${def.id}: S needs the tiers: the best run without them takes ${secs(s.time)}, over ${S} s`);
            check(s.time <= A * 60, `${def.id}: A (${A} s) is what a flawless run at running speed gets`);
            check(B >= A * 1.3, `${def.id}: B (${B} s) leaves room for mistakes`);
        }
        const halting = searchBot(slowCtx, sdef, {beam: 80, coarse: true, pause: 5});
        check(!!halting, `${def.id}: running speed, and standing still for a moment every half second on the way home, still gets home`);
        if (halting) note(`${def.id}: with the pauses ${secs(halting.s.time)} (home ${secs(halting.s.time - halting.s.itemTime)}, ${lead(halting)})`);
    }
    if (RECORD) {
        console.log('\n// paste into the page, or into the level builder\'s parameters:');
        for (const [id, r] of Object.entries(record)) console.log(`    ${id}: {frames: ${r.frames}, log: ${JSON.stringify(r.log)}},`);
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
