#!/usr/bin/env node
// Test suite for games/emoji_horde_survival.html (Last Smile).
//
// Runs the page's DOM-free <script id="core"> block in Node: the night's schedule, the gifts, the
// level-up offers and the evolutions. A player cannot see from the page that a card offered a gift
// they had already maxed, that a fifth gift slipped into four slots, that an evolution never came
// although its recipe was complete, or that a change to one price made the night unwinnable -
// those all come from one number somewhere else. No browser, no server.
//
//   node test/last_smile.mjs                 # everything
//   node test/last_smile.mjs offers night    # named suites only
//   node test/last_smile.mjs --page=path.html
//
// Suites:
//   offers - thousands of level-ups chosen at random: no duplicate or maxed card, slots respected,
//            an evolution offered exactly when its gift is at level 5 with its partner charm owned
//   night  - the same seed and inputs give the same night; every set piece arrives; faces stay under
//            the cap; lightning hurts inside its ring only; the night freezes while a card is up;
//            sunrise cheers every face left
//   bots   - players with a person's habits play whole nights: standing still loses within the first
//            couple of minutes, a careful kiter sees the sunrise, a kiter who picks cards at random
//            still lasts past the first boss, and the first level comes within seconds

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'emoji_horde_survival.html');
const ALL = ['offers', 'night', 'bots'];
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
vm.runInContext(core[1] + '\nthis.C = SmileCore;', ctx);
const C = ctx.C;
const DT = 1 / 60;

// a deterministic stream for the tests' own choices
function lcg(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ------------------------------------------------------------------ bots
// a player who keeps away from faces, steps out of lightning, and walks to sparkle when it is safe
function kite(s) {
    const p = s.p; let fx = 0, fy = 0, danger = 0;
    for (const f of s.faces) {
        const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) - f.r - p.r;
        if (d < 160) { const w = (f.mood === 'boss' ? 3 : 1) / Math.max(6, d) ** 2; fx += dx / (d + f.r + p.r) * w; fy += dy / (d + f.r + p.r) * w; danger += w; }
    }
    for (const k of s.strikes) {
        if (k.done) continue;
        const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
        if (d < C.STRIKE_R + 30) { fx += dx / d * .1; fy += dy / d * .1; danger += .1; }
    }
    let gx = 0, gy = 0;
    for (const g of s.gems.concat(s.drops)) {
        const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy);
        if (d < 420 && !g.pull) { const w = (g.v || 8) / (d + 40); gx += dx / d * w; gy += dy / d * w; }
    }
    const gl = Math.hypot(gx, gy) || 1, fl = Math.hypot(fx, fy) || 1, fear = Math.min(1, danger * 900);
    const mx = fx / fl * fear + gx / gl * (1 - fear * .8) - fy / fl * fear * .5;
    const my = fy / fl * fear + gy / gl * (1 - fear * .8) + fx / fl * fear * .5;
    const l = Math.hypot(mx, my);
    return l > .05 ? {x: mx / l, y: my / l} : {x: 0, y: 0};
}
// cards: an evolution first, then a gift you already have, then any gift, then anything
const sensible = s => {
    const o = s.offer;
    let k = o.findIndex(x => x.type === 'evo');
    if (k < 0) k = o.findIndex(x => x.type === 'gift' && x.lv > 1);
    if (k < 0) k = o.findIndex(x => x.type === 'gift');
    return k < 0 ? 0 : k;
};
function play(seed, move, choose, limit = C.NIGHT + 1) {
    const s = C.create({seed, w: 1000, h: 640}), firstLevel = [];
    while (!s.over && s.t < limit) {
        if (s.offer) { C.choose(s, choose(s)); continue; }
        for (const e of C.step(s, DT, move(s))) if (e.type === 'level') firstLevel.push(s.t);
    }
    return {s, firstLevel};
}

// ------------------------------------------------------------------ offers
function offers() {
    section('offers');
    let seen = 0, evoSeen = 0, bad = [];
    for (let seed = 1; seed <= 300; seed++) {
        const s = C.create({seed}), r = lcg(seed);
        for (let n = 0; n < 60; n++) {
            s.offer = C.makeOffer(s);
            const o = s.offer, ids = o.map(x => x.id);
            seen++;
            if (new Set(ids).size !== ids.length) bad.push(`seed ${seed}: duplicate card ${ids}`);
            for (const c of o) {
                if (c.type === 'gift' && C.GIFTS[c.id].from) bad.push(`seed ${seed}: an evolved gift offered as a plain one`);
                if (c.type === 'gift' && (s.gifts[c.id] || 0) + 1 !== c.lv) bad.push(`seed ${seed}: ${c.id} offered at lv ${c.lv}, owned at ${s.gifts[c.id] || 0}`);
                if (c.type === 'charm' && (s.charms[c.id] || 0) + 1 !== c.lv) bad.push(`seed ${seed}: ${c.id} offered at lv ${c.lv}`);
                if (c.lv > C.MAX_LV) bad.push(`seed ${seed}: ${c.id} past level ${C.MAX_LV}`);
                if (c.type === 'gift' && c.lv === 1 && s.giftOrder.length >= C.GIFT_SLOTS) bad.push(`seed ${seed}: a fifth gift offered`);
                if (c.type === 'charm' && c.lv === 1 && s.charmOrder.length >= C.CHARM_SLOTS) bad.push(`seed ${seed}: a fifth charm offered`);
                if (c.type === 'gift' && c.lv === 1 && s.gifts[C.GIFTS[c.id].evo]) bad.push(`seed ${seed}: ${c.id} offered again after it evolved`);
            }
            const ready = s.giftOrder.filter(id => !C.GIFTS[id].from && s.gifts[id] === C.MAX_LV && s.charms[C.GIFTS[id].partner]);
            const evo = o.filter(x => x.type === 'evo');
            if (ready.length && !evo.length) bad.push(`seed ${seed}: ${ready} ready to evolve but no evolution offered`);
            if (!ready.length && evo.length) bad.push(`seed ${seed}: an evolution offered with no recipe complete`);
            if (evo.length) evoSeen++;
            if (o.length < Math.min(3, C.pool(s).length + evo.length)) bad.push(`seed ${seed}: only ${o.length} cards with more to offer`);
            const k = Math.floor(r() * o.length), before = s.giftOrder.length;
            C.choose(s, k);
            if (s.giftOrder.length > C.GIFT_SLOTS || s.charmOrder.length > C.CHARM_SLOTS) bad.push(`seed ${seed}: more items than slots`);
            if (o[k].type === 'evo' && s.giftOrder.length !== before) bad.push(`seed ${seed}: an evolution changed the number of gifts`);
        }
    }
    check(!bad.length, `${seen} offers: no duplicate, maxed, extra-slot or misplaced card`, bad.slice(0, 5).join('\n          '));
    check(evoSeen > 200, `evolutions come up in random play (${evoSeen} times)`);
    // a full build: nothing left to take still gives the player a card
    const s = C.create({seed: 5});
    for (let i = 0; i < 200; i++) { s.offer = C.makeOffer(s); C.choose(s, 0); }
    s.offer = C.makeOffer(s);
    check(s.offer.length === 1 && s.offer[0].type === 'snack', 'a finished build is offered a cookie, not an empty screen', JSON.stringify(s.offer));
    // every evolution's recipe is a real gift with a real charm, and none shares a partner
    const partners = C.BASE_GIFTS.map(id => C.GIFTS[id].partner);
    check(partners.every(p => C.CHARMS[p]) && new Set(partners).size === partners.length, 'each gift evolves with its own charm');
    check(C.BASE_GIFTS.every(id => C.GIFTS[C.GIFTS[id].evo].from === id && C.GIFTS[id].lines.length === C.MAX_LV), 'each gift has an evolution and a line for every level');
    // levels pile up: two at once give two offers in a row
    const t = C.create({seed: 9}); t.xp = C.need(1) + C.need(2) + 0.5; t.gems.push({x: 0, y: 0, v: 0, tier: 0, pull: 0, id: 1});
    C.step(t, DT, {x: 0, y: 0});
    let shown = 0; while (t.offer && shown < 5) { shown++; C.choose(t, 0); }
    check(shown === 2 && t.level === 3, 'two levels at once give two offers', `offers ${shown}, level ${t.level}`);
}

// ------------------------------------------------------------------ night
function night() {
    section('night');
    const trace = seed => { const r = lcg(seed); const {s} = play(seed, () => ({x: Math.cos(r() * 6.28), y: Math.sin(r() * 6.28)}), () => 0, 120); return [s.t, s.cheered, s.level, s.p.hp, s.faces.length, s.p.x].map(v => v.toFixed(6)).join(); };
    check(trace(11) === trace(11), 'the same seed and inputs give the same night');
    check(trace(11) !== trace(12), 'different seeds give different nights');

    // set pieces arrive on time and the horde stays under its cap
    const s = C.create({seed: 3, w: 1000, h: 640}), got = [];
    let peak = 0;
    while (s.t < 590) {
        if (s.offer) { C.choose(s, sensible(s)); continue; }
        s.p.hp = s.p.max;
        for (const e of C.step(s, DT, kite(s))) if (['ring', 'stream', 'boss'].includes(e.type)) got.push([e.type, Math.round(s.t), e.name]);
        peak = Math.max(peak, s.faces.length);
    }
    const want = C.EVENTS.map(e => [e.kind, e.t]);
    check(got.length === want.length && got.every((g, i) => g[0] === want[i][0] && Math.abs(g[1] - want[i][1]) <= 1), 'every ring, stream and boss arrives when the night says', JSON.stringify(got));
    check(got.filter(g => g[0] === 'boss').every(g => g[2]), 'every boss has a name for its bar');
    check(peak <= C.MAX_FACES + 100, `the horde stays near its cap (peak ${peak}, cap ${C.MAX_FACES} plus a set piece)`);

    // lightning: a ring, then a strike that hurts only inside it
    for (const [dist, hurts] of [[0, true], [C.STRIKE_R - 4, true], [C.STRIKE_R + 20, false]]) {
        const t = C.create({seed: 4}); t.nextSpawn = 0; t.ev = C.EVENTS.length;
        t.strikes.push({x: dist, y: 0, t: 0, id: 99});
        const hp0 = t.p.hp; let warned = false, struck = false;
        t.t = 30;                               // past the opening trickle; nothing else nearby
        for (let i = 0; i < 90; i++) { t.faces.length = 0; for (const e of C.step(t, DT, {x: 0, y: 0})) { if (e.type === 'strike') struck = true; } }
        check(struck && (t.p.hp < hp0) === hurts, `a strike ${dist} from you ${hurts ? 'hurts' : 'misses'}`, `hp ${hp0} -> ${t.p.hp}`);
    }
    // a boss calls lightning on you only after a warning
    const b = C.create({seed: 6}); b.ev = C.EVENTS.length; b.t = 200;
    const boss = {id: 500, mood: 'boss', x: 300, y: 0, r: 60, hp: 1e9, max: 1e9, vx: 0, vy: 0, kx: 0, ky: 0, bite: 0, hitT: -9, slowT: 0, life: 0};
    b.faces.push(boss); let warnAt = -1, strikeAt = -1;
    for (let i = 0; i < 60 * 5 && strikeAt < 0; i++) {
        b.faces = [boss]; b.p.hp = b.p.max;
        for (const e of C.step(b, DT, {x: 0, y: 0})) { if (e.type === 'warn' && warnAt < 0) warnAt = b.t; if (e.type === 'strike') strikeAt = b.t; }
    }
    check(warnAt > 0 && Math.abs(strikeAt - warnAt - C.STRIKE_WARN) < .05, `the storm warns ${C.STRIKE_WARN}s before it strikes`, `warn ${warnAt}, strike ${strikeAt}`);

    // the night stands still while a card is up
    const f = C.create({seed: 7}); f.offer = C.makeOffer(f); const t0 = f.t, x0 = f.p.x;
    for (let i = 0; i < 30; i++) C.step(f, DT, {x: 1, y: 0});
    check(f.t === t0 && f.p.x === x0, 'nothing moves while a level-up card is up');

    // sunrise: every face left is cheered, nearest first, and the night is won
    const d = C.create({seed: 8}); d.t = C.NIGHT - 0.01;
    for (let i = 0; i < 40; i++) d.faces.push({id: 1000 + i, mood: 'meh', x: 60 + i * 13, y: 0, r: 12, hp: 5, max: 5, vx: 0, vy: 0, kx: 0, ky: 0, bite: 9, hitT: -9, slowT: 0, life: 1});
    const ev = C.step(d, DT, {x: 0, y: 0}), cheers = ev.filter(e => e.type === 'cheer');
    check(d.over && d.won && d.faces.length === 0, 'sunrise ends the night as a win with no face left');
    check(cheers.length === 40 && cheers.every((c, i) => !i || c.dawn >= cheers[i - 1].dawn), 'sunrise cheers all forty, nearest first');
}

// ------------------------------------------------------------------ bots
function bots() {
    section('bots');
    const idle = [1, 2, 3].map(seed => play(seed, () => ({x: 0, y: 0}), () => 0).s.t);
    check(idle.every(t => t > 15 && t < 150), `standing still loses, but not in the first 15 s (${idle.map(t => t | 0).join(', ')} s)`);

    const careful = [1, 2, 3].map(seed => play(seed, kite, sensible));
    const wins = careful.filter(r => r.s.won).length;
    check(wins >= 2, `a careful kiter sees the sunrise (${wins} of 3; ${careful.map(r => (r.s.t | 0) + 's lv' + r.s.level).join(', ')})`);
    check(careful.every(r => r.firstLevel[0] < 20), `the first level comes within 20 s (${careful.map(r => r.firstLevel[0].toFixed(1)).join(', ')})`);
    check(careful.every(r => r.firstLevel.filter(t => t < 180).length >= 9), `a careful kiter reaches level 10 inside 3 minutes (${careful.map(r => r.firstLevel.filter(t => t < 180).length + 1).join(', ')})`);
    check(careful.some(r => r.s.evolved > 0), 'a careful kiter evolves a gift');

    const r = lcg(77);
    const random = [4, 5, 6].map(seed => play(seed, kite, s => Math.floor(r() * s.offer.length)).s.t);
    check(random.filter(t => t > 200).length >= 2, `a kiter who picks cards at random still outlasts the first boss (${random.map(t => t | 0).join(', ')} s)`);
}

const RUN = {offers, night, bots};
for (const name of suites) {
    if (!RUN[name]) { console.log(`unknown suite ${name}; have ${ALL.join(', ')}`); process.exit(1); }
    RUN[name]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
