#!/usr/bin/env node
// Test suite for games/asteroids.html (Asteroids: Afterglow).
//
// Runs the page's DOM-free <script id="core"> block in Node: rocks splitting, the combo, armour,
// shields and lives, the draft, both bosses, hyperspace, the saved meta and whole runs played by
// a bot. A boss whose core can never be hit, a draft with nothing left to offer, a wave that never
// ends - none of these shows on a first look at the page, and each has already happened once while
// the game was being built. No browser, no server.
//
//   node test/asteroids.mjs                  # everything
//   node test/asteroids.mjs rules bosses     # named suites only
//   node test/asteroids.mjs --page=path.html # run against another copy of the page
//
// Suites:
//   rules   - splits (two, three with Fragmenter or crystal), scores and the combo multiplier,
//             armoured rocks, shields before lives, extra ships on a rising scale, the end of a run
//   draft   - offers are distinct and never past an upgrade's cap, a boss wave offers a rare one,
//             an exhausted pool still offers Bounty, choosing starts the next wave
//   bosses  - a bot kills the Dreadnought (turrets, then the open core) and the Void Serpent
//             (segments split the chain) within a time limit, in several sectors
//   hyper   - a jump lands clear of rocks when the field has room, and waits for its recharge
//   meta    - settle() unlocks Wasp at wave 5 and Bastion at a boss kill; the old page's nd_meta
//             shape is read as it is
//   bots    - seeded runs replay identically; a bot plays every hull for many waves and no phase
//             ever stalls (every wave ends, every draft is offered, game over comes)

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'asteroids.html');
const ALL = ['rules', 'draft', 'bosses', 'hyper', 'meta', 'bots'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.A = AfterCore;', ctx);
const A = ctx.A;

const DT = 1 / 120;
const W = 1100, H = 720;
const fresh = (o = {}) => A.create(Object.assign({seed: 5, w: W, h: H}, o));
const clearField = s => { s.rocks.length = 0; s.saucers.length = 0; s.eshots.length = 0; s.shots.length = 0; s.boss = null; };
const run = (s, secs, inp) => { const ev = []; for (let t = 0; t < secs; t += DT) ev.push(...A.step(s, DT, typeof inp === 'function' ? inp(s) : inp)); return ev; };
const play = s => { s.phase = 'play'; s.phaseT = 0; };

// A bot with perfect aim: turn toward the nearest target with lead, fire, jump when crowded,
// side-step enemy fire. It is the yardstick for "can this be done", not for difficulty.
function bot(s) {
    const sh = s.ship; let best = null, bd = 1e9;
    const tg = [...s.rocks, ...s.saucers];
    if (s.boss && s.boss.kind === 'dread') {
        for (const t of s.boss.turrets) if (t.hp > 0) { const [x, y] = A.turretPos(s.boss, t); tg.push({x, y, vx: s.boss.vx, vy: 0}); }
        if (s.boss.core.open) tg.push(s.boss);
    } else if (s.boss) for (const c of s.boss.chains) for (const g of c.segs) tg.push(g);
    for (const k of tg) { const [dx, dy] = A.wd(s, sh.x, sh.y, k.x, k.y), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = k; } }
    let aim = null, thrust = 0, hyper = false;
    if (best) { const [dx, dy] = A.wd(s, sh.x, sh.y, best.x, best.y), t = Math.hypot(dx, dy) / 760; aim = Math.atan2(dy + ((best.vy || 0) - sh.vy) * t, dx + ((best.vx || 0) - sh.vx) * t); }
    let danger = 0;
    for (const k of s.rocks) { const [dx, dy] = A.wd(s, sh.x, sh.y, k.x, k.y); if (Math.hypot(dx, dy) - k.r < 60) danger++; }
    for (const e of s.eshots) {
        const [dx, dy] = A.wd(s, sh.x, sh.y, e.x, e.y), d = Math.hypot(dx, dy);
        if (d < 45) danger++;
        if (d < 170 && -(dx * e.vx + dy * e.vy) / d > 100) { aim = Math.atan2(e.vy, e.vx) + Math.PI / 2; thrust = 1; }
    }
    if (danger && s.hyperCd <= 0) hyper = true;
    if (bd > 380 && !thrust) thrust = .4;
    return {aim, thrust, fire: true, hyper, turn: 0};
}

// ------------------------------------------------------------------ rules
function rules() {
    section('rules');
    const shotAt = (s, k) => { s.shots.push({x: k.x - 30, y: k.y, px: k.x - 30, py: k.y, vx: 700, vy: 0, life: 1, pierce: 0, heavy: false, hitIds: []}); };
    // splitting
    for (const [label, mods, kind, want] of [['a large rock', {}, 'rock', 2], ['with Fragmenter', {frag: 1}, 'rock', 3], ['a crystal', {}, 'crystal', 3]]) {
        const s = fresh(); clearField(s); play(s); Object.assign(s.mods, mods);
        s.ship.x = 100; s.ship.y = 100;
        s.rocks.push({id: 999, size: 3, r: 54, x: 600, y: 400, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind, born: 0, hp: 1, maxHp: 1});
        shotAt(s, s.rocks[0]);
        const ev = run(s, .1);
        const kids = s.rocks.filter(k => k.size === 2);
        check(ev.some(e => e.t === 'split' && e.size === 3) && kids.length === want, `${label} breaks into ${want}`, kids.length);
        check(kids.every(k => Math.hypot(k.vx, k.vy) > 20), `${label}: the pieces fly apart`);
    }
    // smallest rocks vanish
    {
        const s = fresh(); clearField(s); play(s); s.ship.x = 100; s.ship.y = 100;
        s.rocks.push({id: 1, size: 1, r: 15, x: 600, y: 400, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 1, maxHp: 1});
        shotAt(s, s.rocks[0]); run(s, .1);
        check(s.rocks.length === 0, 'a small rock leaves nothing behind');
    }
    // combo
    {
        const s = fresh(); clearField(s); play(s); const ev = [];
        check(A.mult(s) === 1, 'the multiplier starts at x1');
        for (let i = 0; i < A.COMBO_STEP; i++) { s.rocks.push({id: 50 + i, size: 1, r: 15, x: 300 + i * 40, y: 300, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 1, maxHp: 1}); }
        s.ship.x = 900; s.ship.y = 600;
        for (const k of s.rocks.slice()) { shotAt(s, k); ev.push(...run(s, .06)); }
        check(A.mult(s) === 2, `${A.COMBO_STEP} quick kills make x2`, A.mult(s));
        check(ev.some(e => e.t === 'combo' && e.m === 2), 'the step up is announced');
        const before = s.score;
        s.rocks.push({id: 77, size: 1, r: 15, x: 300, y: 500, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 1, maxHp: 1});
        shotAt(s, s.rocks[0]); run(s, .06);
        check(s.score - before === 200, 'a small rock at x2 scores 200', s.score - before);
        run(s, A.comboWindow(s) + .1);
        check(A.mult(s) === 1 && s.chain === 0, 'the combo runs out after its window');
        s.chain = 999; check(A.mult(s) === A.COMBO_MAX, `the multiplier caps at x${A.COMBO_MAX}`);
        const sv = fresh(); sv.mods.salvage = 2; clearField(sv); play(sv); sv.ship.x = 900; sv.ship.y = 600;
        sv.rocks.push({id: 1, size: 3, r: 54, x: 300, y: 300, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 1, maxHp: 1});
        shotAt(sv, sv.rocks[0]); run(sv, .06);
        check(sv.score === 30, 'Salvage Rig II adds half again to a large rock', sv.score);
    }
    // armour
    {
        const s = fresh({wave: 16}); clearField(s); play(s); s.ship.x = 100; s.ship.y = 100;
        const k = {id: 5, size: 3, r: 54, x: 600, y: 400, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 3, maxHp: 3};
        s.rocks.push(k);
        for (let i = 0; i < 2; i++) { shotAt(s, k); run(s, .1); }
        check(s.rocks.includes(k) && k.hp === 1, 'an armoured rock takes a hit per layer', k.hp);
        shotAt(s, k); run(s, .1);
        check(!s.rocks.includes(k), 'and breaks on the last');
        const late = fresh({wave: 21});
        check(late.rocks.some(r => r.maxHp > 1), 'deep sectors bring armoured rocks');
        check(fresh({wave: 1}).rocks.every(r => r.maxHp === 1), 'sector I has none');
    }
    // shields, lives, the end
    {
        const s = fresh({hull: 'bastion'}); play(s);
        check(s.shield === 2 && s.lives === 2, 'Bastion starts with two shields and two ships', `${s.shield}/${s.lives}`);
        s.ship.inv = 0; clearField(s);
        s.rocks.push({id: 9, size: 2, r: 29, x: s.ship.x + 10, y: s.ship.y, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 1, maxHp: 1});
        const ev = run(s, .05);
        check(ev.some(e => e.t === 'shield') && s.lives === 2 && s.shield === 1 && s.ship.alive, 'a hit spends a shield before a ship');
        const d = fresh(); play(d); clearField(d); d.lives = 1; d.ship.inv = 0;
        d.eshots.push({x: d.ship.x + 2, y: d.ship.y, vx: 0, vy: 0, life: 1, grazed: false, src: 'saucer'});
        const ev2 = run(d, .05);
        check(ev2.some(e => e.t === 'death') && ev2.some(e => e.t === 'over') && d.phase === 'over', 'the last ship lost ends the run');
        const r = fresh(); play(r); clearField(r); r.ship.inv = 0;
        r.eshots.push({x: r.ship.x + 2, y: r.ship.y, vx: 0, vy: 0, life: 1, grazed: false, src: 'saucer'});
        run(r, .05); const evr = run(r, 2);
        check(r.ship.alive && r.ship.inv > 0 && evr.some(e => e.t === 'respawn'), 'a lost ship comes back, protected for a moment');
    }
    // extra ships
    {
        // drive the threshold through real kills
        const k = fresh(); clearField(k); play(k); k.lives = 1; k.ship.x = 900; k.ship.y = 600;
        const at = [];
        for (let i = 0; i < 120; i++) {
            k.score = 1000 * i * 1.5 | 0; const lv = k.lives;
            k.rocks.push({id: 300 + i, size: 1, r: 15, x: 300, y: 300, vx: 0, vy: 0, a: 0, va: 0, shape: 1, kind: 'rock', born: 0, hp: 1, maxHp: 1});
            k.shots.push({x: 270, y: 300, px: 270, py: 300, vx: 700, vy: 0, life: 1, pierce: 0, heavy: false, hitIds: []});
            run(k, .06); if (k.lives > lv) at.push(k.score);
        }
        check(at.length >= 3 && at[0] >= 10000 && at[0] < 12000, 'the first extra ship comes at 10 000', at.slice(0, 4).join(' '));
        check(at.every((v, i) => !i || v - at[i - 1] > (at[i - 1] - (at[i - 2] || 0)) * .9), 'each later one costs more than the last', at.join(' '));
    }
}

// ------------------------------------------------------------------ draft
function draft() {
    section('draft');
    for (let seed = 1; seed <= 40; seed++) {
        const s = fresh({seed}); clearField(s); play(s);
        run(s, 2);
        if (s.phase !== 'draft') { fail(`seed ${seed}: an empty field leads to a draft`, s.phase); continue; }
        const o = s.offer;
        const ok = o.length === 3 && new Set(o).size === 3 && o.every(id => A.UP[id] && A.lvl(s, id) < A.UP[id].max);
        if (!ok) fail(`seed ${seed}: three distinct offers under their caps`, o.join(','));
        const w = s.wave; A.choose(s, o[0]);
        if (s.wave !== w + 1 || s.phase !== 'intro' || A.lvl(s, o[0]) !== 1) fail(`seed ${seed}: choosing starts wave ${w + 1}`, `${s.wave} ${s.phase}`);
    }
    pass('forty drafts offered and taken');
    let rareAfterBoss = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const s = fresh({seed, wave: 5}); clearField(s); play(s); run(s, 2);
        if (s.phase === 'draft' && s.offer.some(id => A.UP[id].r >= 2)) rareAfterBoss++;
    }
    check(rareAfterBoss === 30, 'after a boss wave a rare upgrade is always on offer', rareAfterBoss);
    const s = fresh(); s.lives = 1;
    for (const u of A.UPGRADES) if (!u.filler) s.mods[u.id] = u.max;
    clearField(s); play(s); run(s, 2);
    check(s.phase === 'draft' && s.offer.includes('bounty'), 'a run that has taken everything is offered Bounty', s.offer && s.offer.join(','));
    const before = s.score; A.choose(s, 'bounty');
    check(s.score - before === Math.round(2500 * A.sectorOf(s.wave - 1) * (1 + .25 * A.lvl(s, 'salvage'))), 'Bounty pays out (Salvage Rig counts)', s.score - before);
    const m = fresh(); m.mods.twin = 2; clearField(m); play(m); run(m, 2);
    check(!m.offer.includes('twin'), 'a capped upgrade is not offered again');
    check(!A.choose(m, 'nonsense') && m.phase === 'draft', 'an id that was not offered is refused');
}

// ------------------------------------------------------------------ bosses
function bosses() {
    section('bosses');
    for (const wave of [5, 10, 15, 20, 25]) {
        for (const seed of [1, 2]) {
            const s = fresh({seed, wave}); s.lives = 99;
            const kind = s.boss && s.boss.kind;
            const ev = [];
            let t = 0;
            while (s.boss && t < 150) { ev.push(...A.step(s, DT, bot(s))); t += DT; if (s.phase === 'draft') break; }
            check(!s.boss && ev.some(e => e.t === 'bossDown'), `wave ${wave} (${kind}), seed ${seed}: the bot brings it down`, s.boss ? 'still alive after 150 s' : '');
            if (kind === 'dread') check(ev.some(e => e.t === 'coreOpen') && ev.some(e => e.t === 'bossHit' && e.core), `wave ${wave}: the core opens and can be hit`);
            if (kind === 'serpent' && wave === 10) check(ev.filter(e => e.t === 'partDown').length >= s.bossKilled * 14 - 1, 'the serpent dies segment by segment');
        }
    }
    const s = fresh({wave: 10}); s.lives = 99;
    let most = 1;
    for (let t = 0; t < 60 && s.boss; t += DT) { A.step(s, DT, bot(s)); if (s.boss) most = Math.max(most, s.boss.chains.length); }
    check(most > 1, 'shooting a middle segment splits the serpent in two', most);
    check(A.isBossWave(5) && A.isBossWave(10) && !A.isBossWave(6), 'every fifth wave is a boss wave');
}

// ------------------------------------------------------------------ hyper
function hyper() {
    section('hyper');
    let clear = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const s = fresh({seed, wave: 4}); play(s);
        s.ship.inv = 0;
        const ev = A.step(s, DT, {hyper: true});
        const inn = ev.find(e => e.t === 'hyperIn');
        if (inn) { const near = Math.min(...s.rocks.map(k => Math.hypot(...A.wd(s, s.ship.x, s.ship.y, k.x, k.y)) - k.r)); if (near > 60) clear++; }
    }
    check(clear === 30, 'a jump lands at least 60 units clear of every rock', clear + '/30');
    const s = fresh(); play(s);
    A.step(s, DT, {hyper: true});
    const ev = A.step(s, DT, {hyper: true});
    check(!ev.some(e => e.t === 'hyperIn') && s.hyperCd > 0, 'a second jump waits for the recharge');
    const p = fresh(); p.mods.phase = 1; play(p); A.step(p, DT, {hyper: true});
    check(p.hyperCd < A.hyperCd(fresh()) * .6, 'Phase Drive shortens the recharge');
}

// ------------------------------------------------------------------ meta
function meta() {
    section('meta');
    const old = {best: 22682, bestWave: 2, bossKills: 0, runs: 1};   // what the old page saved under nd_meta
    check(A.unlocked(old, 'drifter') && !A.unlocked(old, 'wasp') && !A.unlocked(old, 'bastion'), 'an old save keeps its hulls locked as they were');
    const s = fresh(); s.wave = 5; s.score = 30000;
    const r = A.settle(old, s);
    check(r.meta.best === 30000 && r.meta.bestWave === 5 && r.meta.runs === 2 && r.fresh.includes('wasp'), 'reaching wave 5 unlocks Wasp and sets the bests', JSON.stringify(r));
    const b = fresh(); b.bossKilled = 1; b.score = 10;
    const r2 = A.settle(r.meta, b);
    check(r2.meta.best === 30000 && r2.fresh.includes('bastion') && !r2.meta.newBest, 'a boss kill unlocks Bastion; a lower score keeps the best');
    const r3 = A.settle({}, fresh());
    check(r3.meta.runs === 1 && r3.meta.best === 0, 'an empty save is fine');
}

// ------------------------------------------------------------------ bots
function bots() {
    section('bots');
    const replay = () => { const s = fresh({seed: 99}); for (let i = 0; i < 120 * 40; i++) { A.step(s, DT, bot(s)); if (s.phase === 'draft') A.choose(s, s.offer[0]); } return JSON.stringify([s.score, s.wave, s.kills, s.lives, s.ship.x.toFixed(3), s.rocks.length]); };
    check(replay() === replay(), 'a seed with the same inputs replays exactly');
    for (const hull of Object.keys(A.HULLS)) {
        for (const seed of [3, 4]) {
            const s = fresh({seed, hull});
            let phaseT = 0, lastPhase = s.phase, stall = null, waves = 0, drafts = 0, t = 0;
            while (t < 400 && s.phase !== 'over') {
                const ev = A.step(s, DT, bot(s)); t += DT;
                for (const e of ev) { if (e.t === 'clear') waves++; if (e.t === 'draft') drafts++; }
                if (s.phase === 'draft') A.choose(s, s.offer[(seed + drafts) % s.offer.length]);
                if (s.phase !== lastPhase) { lastPhase = s.phase; phaseT = 0; } else phaseT += DT;
                if (phaseT > (s.boss ? 160 : 90)) { stall = `${s.phase} on wave ${s.wave} for ${phaseT | 0} s with ${s.rocks.length} rocks`; break; }
                if (!Number.isFinite(s.ship.x) || s.rocks.some(k => !Number.isFinite(k.x))) { stall = 'a position became NaN'; break; }
            }
            check(!stall, `${hull}, seed ${seed}: no phase stalls`, stall);
            check(waves >= 6, `${hull}, seed ${seed}: the bot clears at least six waves`, waves);
            check(drafts === waves - (s.phase === 'clear' ? 1 : 0) || drafts >= waves - 1, `${hull}, seed ${seed}: every cleared wave offers a draft`, `${waves} waves, ${drafts} drafts`);
        }
    }
    // the first wave is gentle: a bot that never fires survives it for a while
    let survived = 0;
    for (let seed = 1; seed <= 10; seed++) { const s = fresh({seed}); run(s, 12, {}); if (s.lives === A.HULLS.drifter.lives) survived++; }
    check(survived >= 6, 'drifting idle through the first twelve seconds of wave 1 is usually safe', survived + '/10');
}

const fns = {rules, draft, bosses, hyper, meta, bots};
for (const s of suites) { if (!fns[s]) { console.log('unknown suite ' + s); process.exit(1); } fns[s](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
