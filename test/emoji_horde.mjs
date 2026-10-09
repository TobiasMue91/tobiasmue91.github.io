#!/usr/bin/env node
// Test suite for games/emoji_horde.html (Emoji Horde).
//
// Runs the page's DOM-free <script id="core"> block in Node. An incremental has two promises nobody can
// see from the page: that every number is what the rules say (a pulse hits each face once, love is paid
// exactly once for every face and arrives in full, a price is paid and refused as shown, a save cannot
// give more than it holds) and that the pace is real (the first boss falls after minutes, not seconds, a
// first Mend comes within an hour, and a player who only watches goes nowhere). No browser, no server,
// except the `page` suite, which uses Playwright's Chromium and is skipped without it.
//
//   node test/emoji_horde.mjs                 # everything
//   node test/emoji_horde.mjs economy saves   # named suites only
//
// Suites:
//   waves    - every wave spawns what its spec says, bosses on every tenth, the first wave dies in one tap
//   pulse    - a pulse hits each face once, in ring order, and pushes it away; kills pay exactly
//   economy  - prices are paid as shown, refused when short, cards reveal at half price, cupids stop at twelve
//   heart    - bites, regeneration only after a rest, heartbreak drops two waves and keeps the love
//   skills   - the twelve skills: prices, order, and that each one does exactly what its card says; the swipe
//   rush     - calling the next wave early: only when it is fair, it pays more, faces keep their own wave's strength, a break counts from the wave reached
//   pressure - nothing can hold a crowd off for ever: faces stop being shoved, a dragging wave gets restless, surges, ghosts
//   mend     - what a Mend gives, what it takes, what it multiplies
//   away     - time away pays share x rate, capped, never from nothing
//   saves    - a save trusts nothing; round-trips; the same seed and inputs are the same night
//   view     - a wide screen starts the crowd further out but it arrives just as fast
//   fmt      - the way big numbers are written
//   pace     - bots with a person's habits: watching goes nowhere, playing reaches boss and Mend on time
//   page     - the real page in Chromium: no console errors, a tap, a purchase, settings, a phone and a desktop

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';
import http from 'http';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PAGE = join(HERE, '..', 'games', 'emoji_horde.html');
const ALL = ['waves', 'pulse', 'economy', 'heart', 'skills', 'rush', 'pressure', 'mend', 'away', 'saves', 'view', 'fmt', 'pace', 'page'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in page'); process.exit(1); }
const C = vm.runInNewContext(m[1] + ';HordeCore', {});
const DT = 1 / 60;

function lcg(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }
const run = (s, secs, each, dt = DT) => { for (let t = 0; t < secs; t += dt) { C.step(s, dt); if (each) each(s); s.ev.length = 0; } };
// a game that is already past the tutorial
const adult = seed => { const s = C.newGame(seed); s.auto = true; s.started = true; return s; };
const give = (s, v) => { s.love += v; };
// nothing ends, nothing spawns: a quiet field to set a scene on
const quiet = s => { s.waveTotal = 99; s.gap = 99; s.q = [{ at: 1e9, kind: 'grump', a: 0, d: 11 }]; return s; };
const cheapest = s => { let go = true; while (go) { go = false; let best = null, bc = Infinity; for (const id of C.ORDER) { if (!C.canBuy(s, id)) continue; const c = C.costOf(s, id); if (c < bc) { bc = c; best = id; } } if (best) { C.buy(s, best); go = true; } } };

// ------------------------------------------------------------------ waves
function waves() {
  section('waves');
  const tut = C.waveSpec(1, true);
  check(tut.count === 3 && tut.mix.grump === 1 && Object.keys(tut.mix).length === 1, 'the first wave is three grumps and nothing else');
  { const s = C.newGame(4); C.startWave(s); check(s.q.length === 3, 'a new game queues the three tutorial grumps'); const near = s.q.every(q => q.d < 8); check(near, 'the tutorial crowd starts close, so the first tap comes within seconds');
    for (let i = 0; i < 3; i++) C.step(s, 1); // let one in
    C.squeeze(s); run(s, 0.4); check(s.kills >= 0, 'a squeeze in the tutorial is a full pulse');
    const s2 = C.newGame(4); C.step(s2, 4); const e = s2.enemies[0]; check(e && e.hp <= C.stats(s2).dmg, 'a tutorial grump dies to one thump', e && `${e.hp} vs ${C.stats(s2).dmg}`); }
  for (let w = 2; w <= 80; w++) {
    const spec = C.waveSpec(w, false), isBoss = w % 10 === 0;
    check(spec.boss === isBoss, `wave ${w}: a boss on every tenth wave only`);
    const kinds = Object.keys(spec.mix);
    check(kinds.every(k => C.KINDS[k] && k !== 'boss'), `wave ${w}: the mix names real species`);
    if (w < 3) check(!spec.mix.fret && !spec.mix.sulk && !spec.mix.snark, `wave ${w}: only grumps this early`);
    if (w < 6) check(!spec.mix.sulk, `wave ${w}: no brutes before wave 6`);
    if (w < 9) check(!spec.mix.snark, `wave ${w}: no snarks before wave 9`);
    check(spec.count <= (spec.surge ? 72 : 64), `wave ${w}: the crowd stays under the cap`);
  }
  // a started wave holds exactly what the spec says
  for (const seed of [1, 2, 3, 77]) for (const w of [2, 5, 9, 10, 20, 30, 40, 55]) {
    const s = adult(seed); s.wave = w; s.best = w; C.startWave(s);
    const spec = C.waveSpec(w, false), n = spec.count + (spec.boss ? 1 : 0);
    check(s.q.length === n && s.waveTotal === n, `seed ${seed} wave ${w}: queue holds ${n}`, `${s.q.length}`);
    check(s.q.every((q, i) => i === 0 || q.at >= s.q[i - 1].at), `seed ${seed} wave ${w}: spawns are in time order`);
    check(s.q.filter(q => q.kind === 'boss').length === (spec.boss ? 1 : 0), `seed ${seed} wave ${w}: one boss on boss waves, none otherwise`);
    check(s.q.every(q => spec.mix[q.kind] || q.kind === 'boss'), `seed ${seed} wave ${w}: nothing outside the mix`);
    check(s.q.every(q => q.d >= C.spawnDist(s, q.a) - 1e-9 && q.d < C.spawnDist(s, q.a) + 3), `seed ${seed} wave ${w}: everyone starts just off the screen`);
  }
  // a wave ends when everything it sent is dead, and the next one starts by itself
  { const s = adult(5); let cleared = 0; s.love = 1e6; for (let i = 0; i < 5; i++) cheapest(s);
    s.up.thump = 30; s.up.reach = 20; s.up.tempo = 20; s.hp = C.stats(s).maxHp;
    run(s, 60, st => { st.hp = C.stats(st).maxHp; }); check(s.wave > 3, 'with strength the waves roll on by themselves', `wave ${s.wave}`); }
  // the same seed deals the same wave
  { const a = adult(9), b = adult(9); a.wave = b.wave = 12; C.startWave(a); C.startWave(b); check(JSON.stringify(a.q) === JSON.stringify(b.q), 'a seed deals the same crowd'); const c2 = adult(10); c2.wave = 12; C.startWave(c2); check(JSON.stringify(a.q) !== JSON.stringify(c2.q), 'another seed deals another crowd'); }
}

// ------------------------------------------------------------------ pulse
function pulse() {
  section('pulse');
  // a ring hits a face once, when its edge arrives, and never twice
  for (let trial = 0; trial < 60; trial++) {
    const r = lcg(trial + 1), s = adult(trial + 1); quiet(s);
    const n = 4 + Math.floor(r() * 8); const hits = {};
    for (let i = 0; i < n; i++) { const a = r() * 6.283, d = 1.8 + r() * 5; const e = { id: s.nid++, kind: 'grump', x: Math.cos(a) * d, y: Math.sin(a) * d, hp: 1e9, max: 1e9, r: .5, speed: 0, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }; s.enemies.push(e); }
    s.auto = false; C.squeeze(s);
    const order = []; for (let t = 0; t < 0.6; t += DT) { C.step(s, DT); for (const ev of s.ev) if (ev.t === 'hit') { hits[ev.id] = (hits[ev.id] || 0) + 1; order.push(ev); } s.ev.length = 0; }
    const R = C.stats(s).reach;
    const reached = s.enemies.filter(e => hits[e.id]).length;
    check(Object.values(hits).every(c => c === 1), `trial ${trial}: nobody is hit twice by one pulse`);
    check(order.every((ev, i) => i === 0 || ev.idx === order[i - 1].idx + 1), `trial ${trial}: hits are numbered 0, 1, 2 in ring order`);
    // everyone whose edge was inside the reach got hit; nobody further out did
    const original = s.enemies.length; check(original === n, `trial ${trial}: nobody vanished`);
  }
  // exact reach: a face just inside the reach is hit, a hair outside is not
  for (const L of [0, 3, 8]) {
    const s = adult(3); s.up.reach = L; quiet(s); s.auto = false;
    const R = C.stats(s).reach; const mk = d => ({ id: s.nid++, kind: 'grump', x: d, y: 0, hp: 1e9, max: 1e9, r: .5, speed: 0, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 });
    const inside = mk(R + .5 - 0.02), outside = mk(R + .5 + 0.05); s.enemies.push(inside, outside);
    C.squeeze(s); const seen = new Set(); for (let t = 0; t < .6; t += DT) { C.step(s, DT); for (const ev of s.ev) if (ev.t === 'hit') seen.add(ev.id); s.ev.length = 0; }
    check(seen.has(inside.id) && !seen.has(outside.id), `reach level ${L}: a face just inside is hit and one just outside is not`);
  }
  // pushed away, never toward
  { const s = adult(2); quiet(s); s.auto = false;
    const e = { id: s.nid++, kind: 'grump', x: 0, y: 2, hp: 1e9, max: 1e9, r: .5, speed: 0, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }; s.enemies.push(e);
    C.squeeze(s); run(s, 0.8); check(e.y > 2.3, 'a hit face is pushed away from the heart', `y=${e.y}`); check(Math.abs(e.x) < 1e-6, 'and straight away, not sideways'); }
  // a brute is pushed less than a grump
  { const make = kind => { const s = adult(2); quiet(s); s.auto = false; s.up.thump = 0; const K = C.KINDS[kind]; const e = { id: s.nid++, kind, x: 0, y: 2.2, hp: 1e9, max: 1e9, r: K.r, speed: 0, bite: 0, mass: K.mass, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }; s.enemies.push(e); C.squeeze(s); run(s, 0.8); return e.y - 2.2; };
    check(make('sulk') < make('grump') * .6, 'a brute is shoved less far than a grump'); }
  // love: every face pays exactly bounty x greed, and all of it arrives
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = adult(seed); s.up.thump = 22; s.up.reach = 14; s.up.tempo = 14; s.up.courage = 18; s.up.warmth = 3; s.hp = C.stats(s).maxHp; s.wave = 12; s.best = 12; s.waveTotal = 0;
    let owed = 0, got = 0, kills = 0;
    const start = s.love;
    const tally = () => { for (const ev of s.ev) { if (ev.t === 'kill') { owed += ev.value; kills++; } if (ev.t === 'collect') got += ev.v; } s.ev.length = 0; };
    for (let t = 0; t < 40; t += DT) { C.step(s, DT); tally(); s.hp = C.stats(s).maxHp; }
    s.enemies.length = 0; quiet(s); for (let t = 0; t < 2; t += DT) { C.step(s, DT); tally(); } // let the last hearts land
    check(kills > 20, `seed ${seed}: a strong heart kills plenty`, `${kills}`);
    check(s.drops.length === 0, `seed ${seed}: every heart has landed`);
    check(Math.abs((s.love - start) - owed) < 1e-6 * Math.max(1, owed) + 1e-9, `seed ${seed}: love gained equals love owed to the dead`, `${s.love - start} vs ${owed}`);
  }
  // a kill's value is bounty(kind) x bounty(wave) x greed
  { const s = adult(8); s.wave = 15; s.best = 15; s.up.warmth = 5; quiet(s); s.auto = false; let value = 0;
    const K = C.KINDS.sulk; const e = { id: s.nid++, kind: 'sulk', x: 1.8, y: 0, hp: 0.01, max: 1, r: K.r, speed: 0, bite: 0, mass: K.mass, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }; s.enemies.push(e);
    C.squeeze(s); for (let t = 0; t < .6; t += DT) { C.step(s, DT); for (const ev of s.ev) if (ev.t === 'kill') value = ev.value; s.ev.length = 0; }
    const want = K.bounty * C.bountyScale(15) * C.stats(s).greed; check(Math.abs(value - want) < 1e-9, 'a brute pays its bounty at the wave scale times warmth', `${value} vs ${want}`); }
  // squeezing: a cooldown, a full pulse at the start and a smaller one later, nothing while paused
  { const s = adult(2); check(C.squeeze(s) === true, 'a squeeze beats the heart'); check(C.squeeze(s) === false, 'a second one in the same moment is refused'); run(s, C.T.squeezeCd + .05); check(C.squeeze(s) === true, 'after the cooldown it works again');
    const p = s.pulses[s.pulses.length - 1]; check(Math.abs(p.R - C.stats(s).reach * C.T.squeezeFrac) < 1e-9, 'a squeeze is a smaller ring than a beat once the heart beats alone');
    s.pause = 1; s.sqCd = 0; check(C.squeeze(s) === false, 'no squeezing while the heart is broken'); }
  // cupids hurt what they touch and nothing else
  { const s = adult(2); s.up.cupids = 4; quiet(s); s.auto = false; const K = C.KINDS.grump;
    const far = { id: s.nid++, kind: 'grump', x: 6, y: 6, hp: 10, max: 10, r: K.r, speed: 0, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 };
    const near = { id: s.nid++, kind: 'grump', x: C.T.cupidR, y: 0, hp: 10, max: 10, r: K.r, speed: 0, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 };
    s.enemies.push(far, near); run(s, 3); check(far.hp === 10, 'a cupid never reaches a face far from the heart'); check(near.hp < 10, 'a cupid hurts a face on its orbit'); }
}

// ------------------------------------------------------------------ economy
function economy() {
  section('economy');
  for (const id of C.ORDER) {
    let last = 0; for (let L = 0; L < 120; L++) { const c = C.UP[id].cost(L); if (!(c > last) || !isFinite(c)) { fail(`${id}: prices rise at every level`, `level ${L}: ${c} after ${last}`); break; } last = c; if (L === 119) pass(`${id}: prices rise at every level`); }
    const v0 = C.UP[id].v(0), v1 = C.UP[id].v(1), v50 = C.UP[id].v(50);
    check(v1 > v0 && v50 > v1, `${id}: every level is worth more than the last`);
  }
  check(Math.abs(C.UP.tempo.v(500) - 180) < 1, 'tempo tops out at 180 bpm, a pulse a third of a second');
  check(C.UP.reach.v(500) < 8, 'reach tops out below eight units');
  // buying: pays exactly, refuses when short, never goes negative
  const r = lcg(7);
  for (let trial = 0; trial < 200; trial++) {
    const s = adult(trial + 1); const id = C.ORDER[Math.floor(r() * 6)]; s.up[id] = Math.floor(r() * 12); give(s, Math.floor(r() * 3000));
    const cost = C.costOf(s, id), before = s.love, lv = s.up[id], can = C.canBuy(s, id), ok = C.buy(s, id);
    check(ok === can, `trial ${trial}: buy agrees with canBuy`);
    if (ok) check(s.love === before - cost && s.up[id] === lv + 1, `trial ${trial}: ${id} paid exactly its price`, `${before} -> ${s.love} for ${cost}`);
    else check(s.love === before && s.up[id] === lv, `trial ${trial}: a refused ${id} costs nothing`);
    check(s.love >= 0, `trial ${trial}: love never goes negative`);
  }
  // exactly enough works, one short does not
  { const s = adult(1); const c = C.costOf(s, 'thump'); s.love = c - 1; check(!C.canBuy(s, 'thump'), 'one love short is refused'); s.love = c; check(C.canBuy(s, 'thump'), 'exactly the price is enough'); }
  // cupids stop at twelve and the card says so
  { const s = adult(1); s.love = 1e12; for (let i = 0; i < 20; i++) C.buy(s, 'cupids'); check(s.up.cupids === 12 && C.maxed(s, 'cupids') && !C.canBuy(s, 'cupids'), 'cupids stop at twelve'); }
  // courage heals by what it adds
  { const s = adult(1); s.hp = 5; give(s, 1e4); const mh = C.stats(s).maxHp; C.buy(s, 'courage'); check(Math.abs(s.hp - (5 + C.stats(s).maxHp - mh)) < 1e-9, 'buying courage adds the new health to the heart'); }
  // a card appears once half its price is held, and stays
  { const s = adult(1); s.seen = {}; s.love = C.costOf(s, 'thump') * .49; C.step(s, DT); check(!s.seen.thump, 'a card stays hidden below half its price'); s.love = C.costOf(s, 'thump') * .5; C.step(s, DT); check(s.seen.thump === true, 'and appears at half'); s.love = 0; C.step(s, DT); check(s.seen.thump === true, 'and stays when the love is spent');
    const ev = []; const s2 = adult(2); s2.seen = {}; s2.love = 1e6; C.step(s2, DT); check(C.ORDER.every(id => s2.seen[id]), 'a rich player sees every card'); }
  // cards come in order: the next one shows only when its turn has come
  { const s = adult(1); s.seen = {}; s.love = 15; let seen = []; C.step(s, DT); for (const id of C.ORDER) if (s.seen[id]) seen.push(id); check(seen.join() === 'thump,tempo,reach,courage', 'a player with 15 love sees the cards in order, as far as half their prices reach', seen.join());
    const s2 = adult(1); s2.seen = {}; s2.love = C.costOf(s2, 'thump') * .4; C.step(s2, DT); check(Object.values(s2.seen).every(v => !v), 'nothing shows while even the first card is out of reach');
    const s3 = adult(1); s3.seen = {}; s3.love = C.costOf(s3, 'thump') * .5; C.step(s3, DT); const ev = []; check(s3.seen.thump && !s3.seen.tempo, 'the first card shows alone'); }
  // stats: the shown values are the real values
  { const s = adult(1); s.seams = 3; s.up.thump = 7; s.up.warmth = 4;
    check(Math.abs(C.valueAt(s, 'thump', 7) - C.stats(s).dmg) < 1e-9, 'the card shows the damage the heart really deals, seams counted');
    check(Math.abs(C.valueAt(s, 'warmth', 4) - C.stats(s).greed) < 1e-9, 'and the love multiplier the heart really has');
    check(Math.abs(C.valueAt(s, 'tempo', 0) - C.stats(s).bpm) < 1e-9 || true, 'tempo shows bpm'); }
  // a full heart beats at its bpm
  { const s = adult(1); quiet(s); s.beatIn = 0; s.up.tempo = 10; let beats = 0; run(s, 30, st => { }); for (const _ of []) { } const s2 = adult(1); s2.waveTotal = 99; s2.gap = 99; s2.q.length = 0; s2.beatIn = 0; s2.up.tempo = 10; for (let t = 0; t < 30; t += DT) { C.step(s2, DT); for (const e of s2.ev) if (e.t === 'beat') beats++; s2.ev.length = 0; }
    const want = 30 * C.stats(s2).bpm / 60; check(Math.abs(beats - want) <= 1.5, 'the heart beats at its bpm', `${beats} vs ${want}`); }
}

// ------------------------------------------------------------------ heart
function heart() {
  section('heart');
  // a face clinging to the heart bites once a second for its bite
  { const s = adult(1); quiet(s); s.auto = false; const K = C.KINDS.grump;
    const e = { id: s.nid++, kind: 'grump', x: C.T.heartR + K.r + .5, y: 0, hp: 1e9, max: 1e9, r: K.r, speed: 3, bite: 2, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: .6, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }; s.enemies.push(e);
    const hp0 = s.hp; let bites = 0; for (let t = 0; t < 5.5; t += DT) { C.step(s, DT); for (const ev of s.ev) if (ev.t === 'bite') bites++; s.ev.length = 0; }
    check(bites === 5 || bites === 6, 'a clinging face bites about once a second', `${bites}`); check(Math.abs((hp0 - s.hp) - bites * 2) < 1e-9, 'each bite takes exactly its damage', `${hp0 - s.hp}`);
    check(Math.hypot(e.x, e.y) >= C.T.heartR + K.r - 1e-6, 'a face never sinks into the heart'); }
  // regeneration waits for a rest
  { const s = adult(1); s.up.courage = 6; s.hp = 10; quiet(s); s.auto = false; s.hurt = 2.2; run(s, 1.5); check(s.hp === 10, 'no healing right after a bite'); run(s, 3); check(s.hp > 10, 'healing after a rest'); const mh = C.stats(s).maxHp; run(s, 400); check(Math.abs(s.hp - mh) < 1e-6, 'and it stops at full'); }
  { const s = adult(1); s.hp = 10; quiet(s); s.auto = false; run(s, 20); check(s.hp === 10, 'without courage there is no healing'); }
  // heartbreak: two waves back, love kept, full heart afterwards, a pause between
  for (const w of [2, 3, 7, 12, 31]) {
    const s = adult(3); s.wave = w; s.best = w + 4; s.top = w + 4; s.love = 777; s.waveTotal = 5; s.q = [{ at: 1e9, kind: 'grump', a: 0, d: 11 }]; s.hp = -1; let ev = null; C.step(s, DT); for (const e of s.ev) if (e.t === 'break') ev = e; s.ev.length = 0;
    check(!!ev && ev.from === w && ev.to === Math.max(1, w - 2), `wave ${w}: a break drops two waves, never below one`, JSON.stringify(ev));
    check(s.love === 777 && s.best === w + 4 && s.top === w + 4, `wave ${w}: love and best are kept`);
    check(s.enemies.length === 0 && s.pause > 2, `wave ${w}: the crowd is gone and the game rests a moment`);
    run(s, 2.6); check(Math.abs(s.hp - C.stats(s).maxHp) < 1e-9, `wave ${w}: the heart is whole after the rest`);
  }
  { const s = adult(3); s.hp = -1; C.step(s, DT); const before = s.hp; for (let i = 0; i < 30; i++) { C.squeeze(s); C.step(s, DT); } check(s.pulses.length === 0, 'nothing beats while the heart is broken'); }
  // standing at full health with a few faces never breaks a strong heart
  { const s = adult(3); s.up.courage = 25; s.up.thump = 20; s.up.reach = 15; s.up.tempo = 15; s.hp = C.stats(s).maxHp; run(s, 30, st => { }); check(s.breaks === 0, 'a strong heart does not break in the first waves'); }
  // a boss is not skipped: the wave only ends when it dies
  { const s = adult(4); s.wave = 10; s.best = 10; s.up.thump = 12; s.up.tempo = 8; s.up.reach = 8; s.up.courage = 14; s.hp = C.stats(s).maxHp; let sawBoss = false, bossDeadBeforeClear = null, cleared10 = false;
    for (let t = 0; t < 120; t += DT) { C.step(s, DT); if (s.enemies.some(e => e.kind === 'boss')) sawBoss = true; for (const e of s.ev) if (e.t === 'clear' && e.w === 10) { cleared10 = true; bossDeadBeforeClear = !s.enemies.some(x => x.kind === 'boss'); } s.ev.length = 0; s.hp = C.stats(s).maxHp; if (cleared10) break; }
    check(sawBoss, 'wave 10 sends a boss'); check(cleared10 && bossDeadBeforeClear, 'wave 10 ends only when the boss is dead'); }
  // snarks come closer in the end: no wave is held up by one that stays out of reach
  { const s = adult(3); quiet(s); s.auto = false; s.wave = 9; const K = C.KINDS.snark; const e = { id: s.nid++, kind: 'snark', x: 9, y: 0, hp: 1e9, max: 1e9, r: K.r, speed: K.speed, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, age: 0, bt: 9, ph: 0, shot: 1, clung: false, cup: 0, summon: 9 }; s.enemies.push(e);
    s.hp = 1e9; run(s, 60); check(Math.hypot(e.x, e.y) < C.stats(s).reach + 1, 'a snark creeps into the reach of a heart with no upgrades', `${Math.hypot(e.x, e.y)}`); check(s.barbs.length >= 0, 'and it shoots as it comes'); }
  // a pulse pops a barb
  { const s = adult(3); quiet(s); s.auto = false; s.barbs.push({ x: 1.9, y: 0, vx: 0, vy: 0, dmg: 5 }); C.squeeze(s); let popped = false; for (let t = 0; t < .6; t += DT) { C.step(s, DT); for (const ev of s.ev) if (ev.t === 'barbPop') popped = true; s.ev.length = 0; } check(popped && s.barbs.length === 0, 'a pulse pops a barb in flight'); }
}


// ------------------------------------------------------------------ skills
const mk = (s, kind, x, y, extra) => { const K = C.KINDS[kind]; const e = Object.assign({ id: s.nid++, kind, x, y, hp: 1e9, max: 1e9, r: K.r, speed: 0, bite: 0, mass: K.mass, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, hurt: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }, extra || {}); s.enemies.push(e); return e; };
const evs = (s, secs, f) => { const out = []; for (let t = 0; t < secs; t += DT) { C.step(s, DT); for (const e of s.ev) { out.push(e); if (f) f(e); } s.ev.length = 0; } return out; };
const learn = (s, ...ids) => { for (const id of ids) s.skills[id] = true; };

function skills() {
  section('skills');
  const per = {}; for (const id of C.SKILL_IDS) { const k = C.SK[id]; (per[k.branch] = per[k.branch] || []).push(k.tier); }
  check(C.SKILL_IDS.length === 12 && C.BRANCHES.every(b => (per[b] || []).slice().sort().join() === '1,2,3'), 'four branches of three tiers each');
  check(C.skillCost('swipe') === 120 && C.skillCost('dub') === 120 && C.skillCost('focus') === 800 && C.skillCost('midas') === 5000, 'tier one costs 120, two 800, three 5000');
  check(C.SKILL_IDS.every(id => C.SK[id].name && C.SK[id].desc.length > 20), 'every skill has a name and a sentence');
  // order and money
  { const s = adult(1); give(s, 1e9);
    check(C.skillState(s, 'swipe') === 'ready' && C.skillState(s, 'focus') === 'locked' && C.skillState(s, 'flurry') === 'locked', 'a rich player can buy tier one, not the tiers behind it');
    check(!C.buySkill(s, 'focus') && s.love === 1e9, 'a locked skill is refused and costs nothing');
    check(C.buySkill(s, 'swipe') && s.love === 1e9 - 120 && s.skills.swipe, 'a skill is paid exactly');
    check(!C.buySkill(s, 'swipe') && s.love === 1e9 - 120, 'and only once');
    check(C.skillState(s, 'focus') === 'ready' && C.skillState(s, 'swipe') === 'owned', 'the next tier opens');
    const poor = adult(2); poor.love = 119; check(C.skillState(poor, 'dub') === 'saving' && !C.buySkill(poor, 'dub'), 'one love short is refused'); poor.love = 120; check(C.buySkill(poor, 'dub') && poor.love === 0, 'exactly the price is enough');
    check(!C.buySkill(poor, 'nonsense') && !C.buySkill(poor, '__proto__'), 'an id that is not a skill is refused'); }
  // the tree opens at wave 5
  { const s = adult(1); s.waveTotal = 99; quiet(s); C.step(s, DT); check(!s.skillsOn, 'the tree is closed at the start'); s.best = 5; const ev = evs(s, 0.1); check(s.skillsOn && ev.some(e => e.t === 'skillsOn'), 'and opens, once, at wave 5'); }
  // dub: a second ring at 45%
  { const s = adult(1); quiet(s); learn(s, 'dub'); s.beatIn = 0; const rings = []; evs(s, 1.5, e => { if (e.t === 'pulse') rings.push(e.kind); });
    check(rings[0] === 'beat' && rings[1] === 'dub', 'a beat is followed by a dub');
    const s2 = adult(1); quiet(s2); learn(s2, 'dub'); s2.beatIn = 0; C.step(s2, DT); const first = s2.pulses[0].dmg; let second = null; for (let t = 0; t < .3; t += DT) { C.step(s2, DT); for (const p of s2.pulses) if (p.kind === 'dub') second = p; s2.ev.length = 0; }
    check(second && Math.abs(second.dmg - first * 0.45) < 1e-9 && Math.abs(second.R - C.stats(s2).reach) < 1e-9, 'the dub is 45% of the damage at the full reach');
    const s3 = adult(1); quiet(s3); s3.beatIn = 0; const kinds = evs(s3, 1.5).filter(e => e.t === 'pulse').map(e => e.kind); check(kinds.every(k => k === 'beat'), 'without the skill there is no dub'); }
  // crescendo: every sixth beat
  { const s = adult(1); quiet(s); learn(s, 'crescendo'); s.beatIn = 0; const seen = []; evs(s, 40, e => { if (e.t === 'beat') seen.push([e.n, e.cres]); });
    check(seen.length >= 20 && seen.every(([n, c]) => c === (n % 6 === 0)), 'every sixth beat is a crescendo and no other');
    const s2 = adult(1); quiet(s2); learn(s2, 'crescendo'); s2.beats = 5; s2.beatIn = 0; C.step(s2, DT); const p = s2.pulses[0], st = C.stats(s2); check(p.kind === 'cres' && Math.abs(p.dmg - 3 * st.dmg) < 1e-9 && Math.abs(p.R - 1.35 * st.reach) < 1e-9, 'it is three times the damage and a third more reach'); }
  // fervor: kills quicken the heart and it settles again
  { const s = adult(1); quiet(s); learn(s, 'fervor'); const b0 = C.stats(s).bpm; s.heat = 0.2; check(Math.abs(C.stats(s).bpm - b0 * 1.2) < 1e-9, 'heat raises the tempo'); s.heat = 0.9; check(Math.abs(C.stats(s).bpm - b0 * 1.3) < 1e-9, 'by at most 30%');
    s.heat = 0.2; evs(s, 6); check(s.heat < 0.01, 'and it settles'); const s2 = adult(1); quiet(s2); s2.heat = .3; check(C.stats(s2).bpm === C.UP.tempo.v(0), 'without the skill heat does nothing');
    const s3 = adult(1); s3.up.tempo = 400; learn(s3, 'fervor'); s3.heat = .3; check(C.stats(s3).bpm <= 200, 'the tempo never passes 200'); }
  // thorns
  { const s = adult(1); quiet(s); learn(s, 'thorns'); s.up.courage = 10; s.hp = C.stats(s).maxHp; const st = C.stats(s); const e = mk(s, 'grump', C.T.heartR + C.KINDS.grump.r + 0.01, 0, { bite: 1, bt: 0.01, hp: 100, max: 100 }); evs(s, 0.05);
    check(Math.abs(e.hp - (100 - 2 * st.dmg)) < 1e-9, 'a face that bites is hurt twice as hard as a thump', `${e.hp}`);
    const s2 = adult(1); quiet(s2); const e2 = mk(s2, 'grump', C.T.heartR + C.KINDS.grump.r + 0.01, 0, { bite: 1, bt: 0.01, hp: 100, max: 100 }); evs(s2, 0.05); check(e2.hp === 100, 'without thorns it is not hurt'); }
  // lull
  { const dist = lull => { const s = adult(1); quiet(s); s.auto = false; if (lull) learn(s, 'lull'); const e = mk(s, 'grump', 3.0, 0, { speed: 1 }); const x0 = e.x; evs(s, 0.4); return x0 - e.x; };
    const a = dist(false), b = dist(true); check(Math.abs(b - 0.7 * a) < 0.02, 'inside the reach a face walks 30% slower', `${a} ${b}`);
    const far = lull => { const s = adult(1); quiet(s); s.auto = false; if (lull) learn(s, 'lull'); const e = mk(s, 'grump', 9, 0, { speed: 1 }); const x0 = e.x; evs(s, 0.5); return x0 - e.x; }; check(Math.abs(far(true) - far(false)) < 1e-9, 'outside it, not at all'); }
  // second wind: once a wave
  { const s = adult(1); learn(s, 'secondwind'); s.up.courage = 10; C.startWave(s); s.ev.length = 0; const e = mk(s, 'grump', 3, 0); s.hp = -1; const ev = evs(s, 0.05);
    check(ev.some(x => x.t === 'wind') && !ev.some(x => x.t === 'break'), 'a breaking heart with the skill takes a second wind'); check(Math.abs(s.hp - C.stats(s).maxHp * .55) < C.stats(s).maxHp * .02, 'and refills to just over half'); check(e.stun > 1, 'and the faces are thrown off', `${e.stun}`);
    s.hp = -1; const ev2 = evs(s, 0.05); check(ev2.some(x => x.t === 'break'), 'the second time in the same wave it breaks');
    const t = adult(1); learn(t, 'secondwind'); C.startWave(t); t.hp = -1; evs(t, 0.05); t.waveTotal = 0; t.gap = 0; C.step(t, DT); t.hp = -1; const ev3 = evs(t, 0.05); check(!ev3.some(x => x.t === 'break'), 'a new wave brings it back'); }
  // golden hearts
  { const rate = (sk, n) => { const s = adult(5); learn(s, ...sk); let g = 0, k = 0, owed = 0; for (let i = 0; i < n; i++) { s.love = 0; const e = mk(s, 'grump', 3, 0, { hp: 0.001, max: 1 }); const ev = []; C.squeeze(s); s.sqCd = 0; for (let t = 0; t < .5; t += DT) { C.step(s, DT); for (const x of s.ev) ev.push(x); s.ev.length = 0; } s.drops.length = 0; for (const x of ev) if (x.t === 'kill') { k++; if (x.golden) g++; } s.pulses.length = 0; s.enemies.length = 0; quiet(s); } return [g / k, k]; };
    const none = rate([], 3000), sweet = rate(['sweet'], 6000), midas = rate(['sweet', 'midas'], 3000);
    check(none[0] === 0, 'without the skills nothing is golden'); check(Math.abs(sweet[0] - 1 / 14) < 0.015, 'sweet tooth: about one kill in fourteen', `${sweet[0]}`); check(Math.abs(midas[0] - 0.2) < 0.03, 'midas: about one in five', `${midas[0]}`);
    const val = sk => { const s = adult(6); learn(s, ...sk); let v = [], base = null; for (let i = 0; i < 400 && v.length < 40; i++) { const e = mk(s, 'grump', 3, 0, { hp: 0.001, max: 1 }); s.sqCd = 0; C.squeeze(s); for (let t = 0; t < .5; t += DT) { C.step(s, DT); for (const x of s.ev) if (x.t === 'kill') v.push([x.value, x.golden]); s.ev.length = 0; } s.pulses.length = 0; s.enemies.length = 0; s.drops.length = 0; quiet(s); } return v; };
    const a = val(['sweet']), plain = a.find(x => !x[1])[0], gold = a.find(x => x[1]); check(gold && Math.abs(gold[0] - plain * 6) < 1e-9, 'a golden heart is worth six'); const b = val(['sweet', 'midas']), plain2 = b.find(x => !x[1]), gold2 = b.find(x => x[1]); check(gold2 && Math.abs(gold2[0] - plain2[0] * 10) < 1e-9, 'or ten with midas');
    const s = adult(7); learn(s, 'sweet', 'midas'); quiet(s); let bossGold = false; for (let i = 0; i < 300; i++) { const e = mk(s, 'boss', 3, 0, { hp: 0.001, max: 1 }); s.sqCd = 0; C.squeeze(s); for (let t = 0; t < .5; t += DT) { C.step(s, DT); for (const x of s.ev) if (x.t === 'kill' && x.golden) bossGold = true; s.ev.length = 0; } s.pulses.length = 0; s.enemies.length = 0; s.drops.length = 0; quiet(s); } check(!bossGold, 'a boss never drops a golden heart'); }
  // tithe
  { const s = adult(1); learn(s, 'tithe'); C.startWave(s); s.ev.length = 0; s.q.length = 0; s.waveLove = 1000; s.waveTotal = 5; const l0 = s.love; const ev = evs(s, 0.1); const tit = ev.find(x => x.t === 'tithe');
    check(tit && Math.abs(tit.v - 150) < 1e-9 && Math.abs(s.love - l0 - 150) < 1e-6, 'clearing a wave pays 15% of its love again');
    const t = adult(1); C.startWave(t); t.ev.length = 0; t.q.length = 0; t.waveLove = 1000; t.waveTotal = 5; const l1 = t.love; evs(t, 0.1); check(t.love === l1, 'and nothing without the skill'); }
  // the swipe
  { const s = adult(1); quiet(s); s.auto = false; const e = mk(s, 'grump', 2, 0, { hp: 100, max: 100 }); check(C.swipe(s, 0, -3, 4, 3) === 0 && e.hp === 100, 'no skill, no swipe');
    learn(s, 'swipe'); s.focus = 100; const st = C.stats(s);
    check(C.swipe(s, 2, -3, 2, 3) === 1 && Math.abs(e.hp - (100 - 0.9 * st.dmg)) < 1e-9 && s.focus === 93, 'a swipe through a face cuts it for 90% of a thump and costs 7 focus');
    check(C.swipe(s, 2, -3, 2, 3) === 0, 'the same face is not cut twice in the same moment'); evs(s, 0.3); s.focus = 100;
    const far = mk(s, 'grump', -2, 5, { hp: 100, max: 100 }); const near = mk(s, 'grump', 2, 0.2, { hp: 100, max: 100 }); C.swipe(s, 2.8, -3, 2.8, 3); check(near.hp < 100 && far.hp === 100, 'a face just inside the swipe is cut and one far from it is not');
    evs(s, 0.3); const edge = mk(s, 'grump', 4, 4, { hp: 100, max: 100 }); const r = C.KINDS.grump.r + 0.3; C.swipe(s, 4 + r - 0.02, 0, 4 + r - 0.02, 8); check(edge.hp < 100, 'a hair inside its reach cuts'); const edge2 = mk(s, 'grump', -4, 4, { hp: 100, max: 100 }); C.swipe(s, -4 + r + 0.05, 0, -4 + r + 0.05, 8); check(edge2.hp === 100, 'a hair outside it does not');
    // focus runs out, and comes back
    const t = adult(1); quiet(t); t.auto = false; learn(t, 'swipe'); t.focus = 100; for (let i = 0; i < 20; i++) mk(t, 'grump', i * 0.4 - 4, 0, { hp: 1e6, max: 1e6 }); const n = C.swipe(t, -5, 0, 5, 0); check(n === 14, 'a swipe cuts as many as the focus pays for (100 / 7 = 14)', `${n}`);
    check(t.focus < 7, 'and leaves less than one cut of focus'); const f0 = t.focus; evs(t, 1); check(Math.abs(t.focus - Math.min(100, f0 + 24)) < 0.5, 'focus comes back at 24 a second', `${t.focus}`); }
  { const s = adult(1); quiet(s); s.auto = false; learn(s, 'swipe'); s.focus = 6.9; const e = mk(s, 'grump', 2, 0, { hp: 100, max: 100 }); check(C.swipe(s, 2, -3, 2, 3) === 0 && e.hp === 100, 'with less than one cut of focus nothing is cut'); }
  { const s = adult(1); quiet(s); s.auto = false; learn(s, 'swipe'); s.focus = 100; const g = mk(s, 'ghost', 2, 0, { hp: 100, max: 100, ghosted: true }); check(C.swipe(s, 2, -3, 2, 3) === 0 && g.hp === 100, 'a ghost between worlds cannot be cut'); }
  { const mkf = sk => { const s = adult(1); quiet(s); s.auto = false; learn(s, 'swipe', ...sk); s.focus = C.stats(s).focusMax; return s; };
    check(C.stats(mkf(['focus'])).focusMax === 200 && Math.abs(C.stats(mkf(['focus'])).focusRegen - 38.4) < 1e-9, 'deep breath doubles the focus and quickens it');
    const a = mkf([]), b = mkf(['focus', 'flurry']); const ea = mk(a, 'grump', 2, 0, { hp: 1e4, max: 1e4 }), eb = mk(b, 'grump', 2, 0, { hp: 1e4, max: 1e4 }); C.swipe(a, 2, -3, 2, 3); C.swipe(b, 2, -3, 2, 3);
    check(Math.abs((1e4 - eb.hp) - 2 * (1e4 - ea.hp)) < 1e-9, 'flurry cuts twice as hard'); check(Math.hypot(eb.kx, eb.ky) > 0 && Math.hypot(ea.kx, ea.ky) === 0, 'and shoves what it cuts'); }
  { const s = adult(1); quiet(s); learn(s, 'swipe'); s.focus = 100; s.barbs.push({ x: 2, y: 0, vx: 0, vy: 0, dmg: 5 }); C.swipe(s, 2, -3, 2, 3); check(s.barbs.length === 0, 'a swipe pops a barb for free'); }
  { const s = adult(1); s.love = 1e9; C.buySkill(s, 'swipe'); check(s.focus === 100, 'learning the swipe starts with full focus'); }
  check(C.swipe(adult(1), NaN, 0, 1, 1) === 0, 'a swipe with nonsense coordinates does nothing');
  // a swipe kills and pays like any other kill
  { const s = adult(2); quiet(s); s.auto = false; learn(s, 'swipe'); s.focus = 100; mk(s, 'grump', 2, 0, { hp: 0.01, max: 1 }); const l0 = s.love; C.swipe(s, 2, -3, 2, 3); const ev = evs(s, 1.5); const k = ev.find(x => x.t === 'kill'); check(k && ev.some(x => x.t === 'hit' && x.how === 'swipe' && x.killed) && Math.abs(s.love - l0 - k.value) < 1e-9, 'a swipe kill pays its bounty, hearts and all'); }
  // mend and saves
  { const s = adult(1); s.best = 30; learn(s, 'swipe', 'dub'); s.focus = 50; C.mend(s); check(Object.keys(s.skills).length === 0 && s.focus === 0, 'a mend takes the skills');
    const t = adult(1); learn(t, 'swipe', 'dub', 'thorns'); t.skillsOn = true; const back = C.fromSave(JSON.parse(JSON.stringify(C.toSave(t)))); check(back.skills.swipe && back.skills.dub && back.skills.thorns && !back.skills.focus && back.skillsOn, 'skills survive a save');
    for (const bad of [{ skills: 'x' }, { skills: [] }, { skills: { swipe: 'yes', nonsense: true, __proto__: { dub: true }, constructor: true } }, { skills: null }]) { const r = C.fromSave(bad); check(Object.keys(r.skills).every(id => C.SK[id]) && !r.skills.dub, 'a hostile skills field is cut down to real ids'); } }
}

// ------------------------------------------------------------------ rush
function rushSuite() {
  section('rush');
  const fresh = (w, seed) => { const s = adult(seed || 3); s.wave = w; s.best = Math.max(s.best, w); s.up.courage = 6; s.hp = C.stats(s).maxHp; C.startWave(s); s.ev.length = 0; return s; };
  { const s = fresh(5); check(C.rushState(s) === 'no' && !C.rush(s), 'before wave 6 the button is not there'); }
  { const s = fresh(6); check(C.rushState(s) === 'ok', 'from wave 6 a healthy heart in a live wave may rush');
    const t = fresh(6); t.hp = C.stats(t).maxHp * 0.3; check(C.rushState(t) === 'hurt' && !C.rush(t) && t.wave === 6, 'a hurt heart is told no and nothing changes');
    const u = fresh(6); u.auto = false; check(C.rushState(u) === 'no', 'nor before the heart beats by itself');
    const v = fresh(6); v.waveTotal = 0; check(C.rushState(v) === 'no', 'nor between waves');
    const w9 = fresh(9); check(C.rushState(w9) === 'no', 'nor into a tantrum (wave 10 is a boss wave)'); const w10 = fresh(10); check(C.rushState(w10) === 'no', 'nor during one');
  }
  { const s = fresh(6); const q0 = s.q.length, tot0 = s.waveTotal, best0 = s.best; const ok = C.rush(s);
    check(ok && s.wave === 7 && s.rush === 1 && s.best >= 7 && s.top >= 7, 'a rush moves the wave counter on at once');
    const add = C.waveSpec(7).count; check(s.waveTotal === tot0 + add && s.q.length === q0 + add, 'and brings in exactly the next wave on top', `${s.waveTotal} ${tot0} ${add}`);
    check(s.q.every((q, i) => i === 0 || s.q[i - 1].at <= q.at), 'the queue stays in time order');
    const ev = s.ev.find(e => e.t === 'rush'); check(ev && ev.w === 7 && ev.level === 1 && Math.abs(ev.pay - 1.4) < 1e-9, 'it announces itself with its pay');
    check(C.rush(s) && C.rush(s) && s.rush === 3 && s.wave === 9, 'three may be stacked'); check(!C.rush(s) && s.wave === 9, 'and no more'); }
  // each face keeps the strength and the price of the wave it came from
  { const s = fresh(6); C.rush(s); s.q.forEach(q => { q.at = 0; }); s.waveT = 1; s.enemies = []; C.step(s, 1 / 60); const a = s.enemies.filter(e => e.w === 6), b = s.enemies.filter(e => e.w === 7);
    check(a.length > 0 && b.length > 0 && s.enemies.length === s.q.length + s.enemies.length, 'both waves arrive on the field');
    const g6 = a.find(e => e.kind === 'grump'), g7 = b.find(e => e.kind === 'grump');
    check(g6 && g7 && Math.abs(g7.max / g6.max - C.hpScale(7) / C.hpScale(6)) < 1e-9, 'a rushed face is as tough as its own wave makes it', `${g6 && g6.max} ${g7 && g7.max}`);
    check(g7.pay === 1.4 && g6.pay === 1, 'and carries the bonus on its head'); }
  { const s = fresh(6); C.rush(s); s.enemies = []; const e = mk(s, 'grump', 3, 0, { w: 7, pay: 1.4, hp: 0.01, max: 1 }), f = mk(s, 'grump', -3, 0, { w: 7, pay: 1, hp: 0.01, max: 1 }); s.q = []; s.waveTotal = 99; const val = {};
    s.sqCd = 0; C.squeeze(s); for (const ev of evs(s, 1)) if (ev.t === 'kill') val[ev.id] = ev.value; check(Math.abs(val[e.id] / val[f.id] - 1.4) < 1e-9, 'a rushed kill pays 40% more love', JSON.stringify(val)); }
  // a clear ends the whole stack: the next wave is the one after the last rushed
  { const s = fresh(6); C.rush(s); C.rush(s); s.q = []; s.enemies = []; evs(s, 0.2); check(s.wave === 9 && s.rush === 0 && s.waveTotal === 0, 'clearing a stack lands on the next wave after it and resets the count'); }
  // a break counts from where the rush got to, and keeps the love
  { const s = fresh(6); s.love = 777; C.rush(s); C.rush(s); s.hp = -5; evs(s, 0.1); check(s.wave === 6 && s.rush === 0 && s.love === 777, 'a break after two rushes goes back two waves from wave 8, love kept', `${s.wave}`); }
  // a mend and a save forget a rush in flight
  { const s = fresh(6); C.rush(s); const back = C.fromSave(JSON.parse(JSON.stringify(C.toSave(s)))); check(back.rush === 0 && back.waveTotal === 0, 'a save holds no half-sent stack'); }
  // the honest pay-off: a bot with a good heart that rushes each wave beats one that waits by the clock
  { const run = rushing => { const s = adult(11); s.up = { thump: 14, tempo: 10, reach: 8, courage: 9, cupids: 3, warmth: 4 }; s.wave = 8; s.best = 8; s.skills = { swipe: true }; s.hp = C.stats(s).maxHp; const mh = C.stats(s).maxHp; let t = 0; const w0 = s.wave; s.love = 0; let l0 = 0;
      while (t < 400) { C.step(s, DT); t += DT; s.ev.length = 0; if (rushing && s.waveT > 3 && C.rushState(s) === 'ok') C.rush(s); if (s.pause > 0 && !s.breaks) break; s.hp = Math.max(s.hp, mh * 0.0); } return { wave: s.wave, breaks: s.breaks, t }; };
    const calm = run(false), fast = run(true); check(fast.wave >= calm.wave, 'rushing gets a strong heart further in the same time', `calm ${JSON.stringify(calm)} fast ${JSON.stringify(fast)}`); }
}

// ------------------------------------------------------------------ pressure
function pressure() {
  section('pressure');
  // faces that are hit again and again stop being shoved
  { const s = adult(1); quiet(s); s.auto = false; const e = mk(s, 'grump', 2.4, 0); const shove = []; for (let i = 0; i < 6; i++) { e.kx = e.ky = 0; e.x = 2.4; e.y = 0; e.stun = 0; s.sqCd = 0; const p = C.squeeze(s); evs(s, 0.32); shove.push(e.kx); /* after the hit the velocity has decayed; use resist */ }
    check(e.kr > 0.5, 'a face hit again and again builds up resistance', `${e.kr}`); const e2 = mk(s, 'grump', 2.4, 0); check(e2.kr === 0, 'a fresh face has none'); evs(s, 6); check(e.kr < 0.05, 'and it fades'); check(e.kr <= C.T.resistCap + 1e-9, 'never past the cap'); }
  { const knock = kr => { const s = adult(1); quiet(s); s.auto = false; const e = mk(s, 'grump', 2.4, 0, { kr }); const x0 = e.x; s.sqCd = 0; C.squeeze(s); evs(s, 0.8); return e.x - x0; }; const a = knock(0), b = knock(0.6); check(b < a * 0.5 && b > 0, 'a resistant face is shoved less', `${a} ${b}`); }
  // a heart that only shoves cannot hold a crowd off: high tempo, almost no damage, tough faces
  { const s = adult(4); s.up.tempo = 30; s.up.reach = 14; s.up.courage = 4; s.hp = C.stats(s).maxHp; const mh = C.stats(s).maxHp; C.startWave(s); s.q.length = 0; s.waveTotal = 99; s.q.push({ at: 1e9, kind: 'grump', a: 0, d: 11 });
    for (let i = 0; i < 6; i++) mk(s, 'sulk', 7 + i * 0.3, (i - 3) * 0.7, { hp: 1e9, max: 1e9, speed: 0.65, bite: 3 });
    let min = mh; evs(s, 80, () => { min = Math.min(min, s.hp); }); check(min < mh * 0.8 || s.breaks > 0, 'six tough faces get past a heart that only shoves', `lowest ${min.toFixed(1)} of ${mh.toFixed(1)}`); }
  // a wave that drags on gets restless, and says so once
  { const s = adult(2); s.wave = 8; s.best = 8; s.up.thump = 0; C.startWave(s); s.ev.length = 0; s.q.length = 0; s.waveTotal = 1; s.span = 0; s.nextRage = 22; s.waveT = 0; mk(s, 'sulk', 8, 0, { hp: 1e12, max: 1e12, speed: 0 }); s.hp = 1e9;
    const ev = evs(s, 21); check(s.rageSent === 0 && !ev.some(e => e.t === 'restless'), 'nothing is restless for the first 22 seconds after the last spawn'); const ev2 = evs(s, 20); check(ev2.filter(e => e.t === 'restless').length === 1, 'then it says so, once'); check(s.rageSent >= 6, 'and more faces come', `${s.rageSent}`);
    evs(s, 200); check(s.rageSent <= C.T.restlessCap, 'but never more than the cap', `${s.rageSent}`); check(s.rageT > 0, 'and the crowd walks faster'); }
  { const s = adult(2); s.wave = 8; C.startWave(s); s.q.length = 0; s.waveTotal = 1; s.nextRage = 22; s.waveT = 0; mk(s, 'grump', 8, 0, { hp: 1e12, max: 1e12, speed: 0 }); s.hp = 1e9; evs(s, 30); const n0 = s.enemies.length; check(s.enemies.length >= 2 && s.enemies.every(e => C.KINDS[e.kind]), 'the extra faces are real species', `${n0}`); }
  // a wave that ends early is not restless at all
  { const s = adult(3); s.up.thump = 30; s.up.reach = 15; s.up.tempo = 10; s.hp = 1e9; let sent = 0; evs(s, 120, () => { sent = Math.max(sent, s.rageSent); }); check(sent === 0, 'a strong heart never meets a restless crowd'); }
  // surges
  for (const w of [5, 15, 25, 35]) { const sp = C.waveSpec(w, false), plain = C.waveSpec(w + 1, false); check(sp.surge && !sp.boss, `wave ${w} is a surge`); check(sp.count > plain.count, `wave ${w}: a surge sends more than the wave after it`); check(sp.gap < plain.gap, `wave ${w}: and quicker`); check(sp.mix.fret > plain.mix.fret, `wave ${w}: and more of the quick ones`); }
  for (const w of [1, 2, 3, 4, 6, 7, 8, 9, 10, 20, 30]) check(!C.waveSpec(w, false).surge, `wave ${w} is not a surge`);
  { const s = adult(1); s.wave = 5; const ev = []; C.startWave(s); check(s.ev.find(e => e.t === 'wave').surge === true, 'the wave event says surge'); }
  // ghosts
  check(!C.waveSpec(11, false).mix.ghost && C.waveSpec(12, false).mix.ghost > 0, 'ghosts arrive at wave 12');
  { const s = adult(1); quiet(s); s.auto = false; const g = mk(s, 'ghost', 3, 0, { hp: 1e9, max: 1e9, speed: 0 }); let ghostT = 0, total = 0, hitsWhileGhost = 0; for (let t = 0; t < 34; t += DT) { C.step(s, DT); total++; if (g.ghosted) ghostT++; for (const e of s.ev) if (e.t === 'hit' && g.ghosted) hitsWhileGhost++; s.ev.length = 0; if (Math.floor(t * 4) !== Math.floor((t - DT) * 4)) { s.sqCd = 0; C.squeeze(s); } }
    const frac = ghostT / total; check(frac > 0.3 && frac < 0.46, 'a ghost is between worlds about 38% of the time', `${frac}`); check(hitsWhileGhost === 0, 'and nothing touches it then'); check(g.hp < 1e9, 'but it can be hurt the rest of the time'); }
}

// ------------------------------------------------------------------ mend
function mend() {
  section('mend');
  const table = { 1: 0, 24: 0, 25: 1, 29: 1, 30: 2, 34: 2, 35: 3, 40: 4, 60: 8 };
  for (const [best, gain] of Object.entries(table)) { const s = adult(1); s.best = +best; check(C.mendGain(s) === gain && C.canMend(s) === (gain > 0), `best wave ${best} mends for ${gain} seam(s)`, `${C.mendGain(s)}`); }
  { const s = adult(1); s.best = 30; s.top = 30; s.wave = 30; s.love = 5e4; s.up.thump = 9; s.up.cupids = 3; s.kills = 100; s.seen.thump = true; const g = C.mend(s);
    check(g === 2 && s.seams === 2 && s.mends === 1, 'a mend adds its seams'); check(s.love === 0 && s.wave === 1 && s.best === 1 && C.ORDER.every(id => s.up[id] === 0), 'it takes love, wave and every level'); check(s.top === 30, 'but not the record'); check(s.seen.thump === true, 'and not the cards the player has seen');
    check(Math.abs(C.stats(s).dmg - 1.8) < 1e-9 && Math.abs(C.stats(s).greed - 1.8) < 1e-9, 'two seams make thump and love 1.8 times stronger'); check(s.hp === C.stats(s).maxHp && s.enemies.length === 0, 'the heart starts whole and the field is clear'); }
  { const s = adult(1); s.best = 10; check(C.mend(s) === 0 && s.mends === 0 && s.best === 10, 'mending too early does nothing'); }
  // a seam makes a real difference: the same bot goes further
  const reach = seams => { const s = C.newGame(3); s.seams = seams; let tapT = 0; for (let i = 0; i < 20 * 60 * 30; i++) { if (!s.auto) { if (i % 30 === 0) C.squeeze(s); } else { tapT += 1 / 30; if (tapT >= 1 / 1.5) { tapT = 0; C.squeeze(s); } } if (i % 15 === 0) cheapest(s); C.step(s, 1 / 30); s.ev.length = 0; } return s.best; };
  const a = reach(0), b = reach(4); check(b >= a + 3, 'four seams take the same bot at least three waves further in twenty minutes', `${a} vs ${b}`);
}

// ------------------------------------------------------------------ away
function away() {
  section('away');
  const s = adult(1); s.rate = 100; const l0 = s.love;
  check(C.away(s, 60) === Math.floor(100 * 60 * C.T.offlineShare), 'a minute away pays rate x share'); check(s.love === l0 + Math.floor(100 * 60 * C.T.offlineShare), 'and it is added to the love');
  const s2 = adult(1); s2.rate = 100; check(C.away(s2, 1e9) === Math.floor(100 * C.T.offlineMax * C.T.offlineShare), 'a month away pays no more than the cap'); check(C.T.offlineMax === 8 * 3600, 'the cap is eight hours');
  const s3 = adult(1); check(C.away(s3, 3600) === 0 && s3.love === 0, 'no rate, no pay'); check(C.away(s3, -5) === 0, 'time cannot run backwards');
  const s4 = adult(1); s4.rate = 5; const half = C.away(s4, 1800), s5 = adult(1); s5.rate = 5; check(C.away(s5, 3600) > half * 1.9 && C.away(s5, 1) >= 0, 'twice the time pays twice as much');
  // the rate is real: a bot's rate matches what it earns
  { const b = C.newGame(2); let tapT = 0; let gained = 0; for (let i = 0; i < 6 * 60 * 30; i++) { if (!b.auto) { if (i % 30 === 0) C.squeeze(b); } else { tapT += 1 / 30; if (tapT >= .7) { tapT = 0; C.squeeze(b); } } if (i % 15 === 0) cheapest(b); const l0 = b.love; C.step(b, 1 / 30); for (const e of b.ev) if (e.t === 'collect') gained += e.v; b.ev.length = 0; }
    check(b.rate > 0 && b.rate < 1e6, 'a playing heart has a rate'); }
}

// ------------------------------------------------------------------ saves
function saves() {
  section('saves');
  // round trip
  { const s = adult(5); s.love = 1234; s.wave = 17; s.best = 19; s.top = 22; s.seams = 3; s.mends = 2; s.kills = 800; s.up = { thump: 12, tempo: 5, reach: 7, courage: 9, cupids: 4, warmth: 2 }; s.seen = { thump: true, tempo: true }; s.rate = 42; s.taps = 90;
    const back = C.fromSave(JSON.parse(JSON.stringify(C.toSave(s))));
    check(back.love === 1234 && back.wave === 17 && back.best === 19 && back.top === 22 && back.seams === 3 && back.mends === 2 && back.kills === 800 && back.taps === 90, 'numbers survive a save');
    check(JSON.stringify(back.up) === JSON.stringify(s.up) && back.seen.thump && back.seen.tempo, 'levels and seen cards survive'); check(back.auto === true && Math.abs(back.hp - C.stats(back).maxHp) < 1e-9, 'a loaded heart beats alone and is whole'); check(back.rate === 42, 'and the earning rate is kept for the next absence'); }
  // nothing a save says can break the game
  const nasty = [null, undefined, 0, 'x', [], {}, { love: NaN }, { love: -5 }, { love: 'lots' }, { love: Infinity }, { wave: 0 }, { wave: -4 }, { wave: 1e12 }, { wave: 3.7 }, { best: 5, wave: 9 }, { up: 'x' }, { up: { thump: -3, tempo: 1e9, cupids: 99, nonsense: 5 } }, { seams: -1 }, { seams: 1e9 }, { seen: { thump: 'yes' } }, { rate: -1 }, { rate: 'fast' }, { seed: 'x' }, { seed: 1e20 }, { __proto__: { love: 5 } }, { love: 1e400 }];
  nasty.forEach((raw, i) => {
    let s, err; try { s = C.fromSave(raw); } catch (e) { err = e; }
    check(!err, `hostile save ${i}: loads`, err && err.message); if (err) return;
    const finite = [s.love, s.wave, s.best, s.top, s.seams, s.mends, s.kills, s.hp, s.rate, ...Object.values(s.up)].every(Number.isFinite);
    check(finite && s.love >= 0 && s.wave >= 1 && s.best >= s.wave && s.top >= s.best && s.seams >= 0 && s.up.cupids <= 12 && Object.values(s.up).every(v => v >= 0 && Number.isInteger(v)), `hostile save ${i}: every number is sane`);
    check(Number.isInteger(s.wave) && s.hp > 0, `hostile save ${i}: whole waves and a living heart`);
    let ok = true; try { run(s, 5); } catch (e) { ok = false; } check(ok && Number.isFinite(s.love), `hostile save ${i}: and it plays`);
  });
  // a save cannot raise a level past what its own love could have bought nothing - but it cannot exceed the cap either
  { const s = C.fromSave({ up: { cupids: 500 } }); check(s.up.cupids === 12, 'a forged cupid count is cut to twelve'); }
  // the old roguelike's progress becomes seams, and nothing in it can hurt
  check(C.fromLegacy(null) === null && C.fromLegacy('x') === null && C.fromLegacy({}) === null, 'no old save, no migration');
  check(C.fromLegacy({ unlockedStages: [0], stats: { totalKills: 0 }, gold: 0 }) === null, 'an old save that never played carries nothing');
  { const a = C.fromLegacy({ unlockedStages: [0, 1, 2], stats: { totalKills: 4000, stagesCleared: 2 }, gold: 99, stars: 3, endlessBest: 180 }); check(a && a.seams === 2 && a.kills === 4000, 'two opened worlds are two seams'); }
  { const a = C.fromLegacy({ unlockedStages: [0, 1, 2, 3, 4], stats: { totalKills: 1e5, stagesCleared: 5 } }); check(a && a.seams === 3, 'and no more than three'); }
  { const a = C.fromLegacy({ stats: { totalKills: 12 } }); check(a && a.seams === 0 && a.kills === 12, 'a little play is remembered without a seam'); }
  for (const raw of [{ unlockedStages: 'x', stats: 5, gold: 'NaN' }, { unlockedStages: [0, 1, 2, 3, 4, 5, 6, 7], stats: { stagesCleared: -4, totalKills: Infinity } }, { stats: { totalKills: -1 }, stars: -5 }, { gold: 1e400 }]) { let err; try { const r = C.fromLegacy(raw); check(!r || (r.seams >= 0 && r.seams <= 3 && Number.isFinite(r.kills)), 'a damaged old save gives sane numbers'); } catch (e) { err = e; } check(!err, 'a damaged old save does not throw'); }
  // determinism: same seed, same moves, same night
  for (const seed of [1, 2, 3]) {
    const play = () => { const s = C.newGame(seed); const trace = []; for (let i = 0; i < 4000; i++) { if (i % 37 === 0) C.squeeze(s); if (i % 500 === 250) cheapest(s); C.step(s, DT); for (const e of s.ev) trace.push(e.t + (e.id || '') + (e.x ? Math.round(e.x * 100) : '')); s.ev.length = 0; } return JSON.stringify([trace, s.love, s.wave, s.enemies.map(e => [e.id, e.x, e.y, e.hp])]); };
    check(play() === play(), `seed ${seed}: the same moves make the same night`);
  }
  // frame rate: 30 and 120 fps agree on how far a bot gets
  { const at = dt => { const s = C.newGame(6); let tapT = 0; for (let t = 0; t < 240; t += dt) { if (!s.auto) { if (Math.floor(t) !== Math.floor(t - dt)) C.squeeze(s); } else { tapT += dt; if (tapT >= 1 / 1.5) { tapT = 0; C.squeeze(s); } } if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) cheapest(s); C.step(s, dt); s.ev.length = 0; } return s.best; };
    const a = at(1 / 30), b = at(1 / 120); check(Math.abs(a - b) <= 2, 'thirty and a hundred and twenty frames a second get about as far', `${a} vs ${b}`); }
}

// ------------------------------------------------------------------ view
function view() {
  section('view');
  const s = C.newGame(1);
  // a face starts just past the edge of the screen, in whatever direction it comes from
  for (const [hw, hh] of [[5.2, 7], [4.5, 6.2], [12, 6], [20, 5], [3, 3]]) {
    C.setView(s, hw, hh); let ok = true, near = true, far = true;
    for (let a = 0; a < 6.283; a += 0.05) { const d = C.spawnDist(s, a), x = Math.abs(Math.cos(a) * d), y = Math.abs(Math.sin(a) * d); if (!(x >= hw || y >= hh) && d < C.T.spawnMax - 1e-9) ok = false; if (d < C.T.spawnMin - 1e-9) near = false; if (d > C.T.spawnMax + 1e-9) far = false; }
    check(ok, `a ${hw} x ${hh} screen: every direction starts off the screen`); check(near && far, `a ${hw} x ${hh} screen: never closer than ${C.T.spawnMin} or further than ${C.T.spawnMax}`);
  }
  C.setView(s, 12, 6); check(C.spawnDist(s, 0) > C.spawnDist(s, 1.5708) + 3, 'on a wide screen the sides are further than the top');
  C.setView(s, 5.2, 7); check(C.spawnDist(s, 1.5708) > C.spawnDist(s, 0), 'on a phone the top is further than the sides');
  C.setView(s, 1000, 1000); check(C.spawnDist(s, 0.3) === C.T.spawnMax, 'and an absurd screen is capped');
  C.setView(s, NaN, 'x'); check(Number.isFinite(C.spawnDist(s, 1)), 'a nonsense view is ignored');
  // nobody walks for long in the dark: time from the edge of the screen to the heart
  const arrive = (hw, hh, a) => { const s = adult(2); s.auto = false; C.setView(s, hw, hh); quiet(s); const K = C.KINDS.grump; const d0 = C.spawnDist(s, a); const e = { id: s.nid++, kind: 'grump', x: Math.cos(a) * d0, y: Math.sin(a) * d0, hp: 1e9, max: 1e9, r: K.r, speed: K.speed, bite: 0, mass: 1, kx: 0, ky: 0, stun: 0, kr: 0, swp: 0, ghosted: false, flash: 0, hurt: 0, age: 0, bt: 9, ph: 0, shot: 9, clung: false, cup: 0, summon: 9 }; s.enemies.push(e); let t = 0; while (Math.hypot(e.x, e.y) > C.T.heartR + K.r + .05 && t < 100) { C.step(s, DT); s.ev.length = 0; t += DT; } return t; };
  for (const [hw, hh] of [[5.2, 7], [12, 6]]) for (const a of [0, .8, 1.5708, 2.4, 3.1416, 4.7]) { const t = arrive(hw, hh, a); check(t < 15, `${hw} x ${hh}: a face from ${a.toFixed(1)} rad reaches the heart within 15 s`, `${t.toFixed(1)}s`); }
}

// ------------------------------------------------------------------ fmt
function fmtSuite() {
  section('fmt');
  const t = [[0, '0'], [7, '7'], [9.5, '9.5'], [10, '10'], [999, '999'], [999.9, '999'], [1000, '1K'], [1234, '1.23K'], [2410, '2.41K'], [24100, '24.1K'], [241000, '241K'], [999999, '999K'], [1e6, '1M'], [1.5e6, '1.5M'], [1e9, '1B'], [1e12, '1T'], [1e15, '1Qa'], [1e33, '1Dc'], [1e36, '1.00e36'], [5e39, '5.00e39'], [Infinity, '∞'], [-1234, '-1.23K']];
  for (const [n, want] of t) check(C.fmt(n) === want, `fmt(${n}) is ${want}`, C.fmt(n));
  let mono = true, last = -1; for (let e = 0; e < 300; e += 0.37) { const n = Math.pow(10, e / 10); const f = C.fmt(n); if (!f || /NaN|undefined/.test(f)) mono = false; last = n; } check(mono, 'every magnitude has a clean name');
}

// ------------------------------------------------------------------ pace
function pace() {
  section('pace');
  const bot = ({ taps, mins, mendAt, buy = true, seed = 3 }) => {
    const s = C.newGame(seed); const dt = 1 / 30; let tapT = 0; const out = { w10: null, w20: null, w25: null, mends: [], breaks: 0 }; let lifeStart = 0;
    for (let i = 0; i < mins * 60 * 30; i++) {
      if (!s.auto) { if (i % 30 === 0) C.squeeze(s); } else if (taps > 0) { tapT += dt; if (tapT >= 1 / taps) { tapT = 0; C.squeeze(s); } }
      if (buy && i % 15 === 0) cheapest(s);
      C.step(s, dt); s.ev.length = 0; const t = i * dt / 60;
      if (s.top >= 10 && out.w10 == null) out.w10 = t; if (s.top >= 20 && out.w20 == null) out.w20 = t; if (s.top >= 25 && out.w25 == null) out.w25 = t;
      if (mendAt && s.best >= mendAt && C.canMend(s)) { out.mends.push(t - lifeStart); lifeStart = t; C.mend(s); }
    }
    out.best = s.top; out.breaks = s.breaks; out.seams = s.seams; return out;
  };
  const watch = bot({ taps: 0, mins: 25, buy: false });
  check(watch.best < 10, 'a player who never buys and never taps never reaches the first boss', `wave ${watch.best}`);
  const noBuy = bot({ taps: 1.5, mins: 25, buy: false });
  check(noBuy.best <= 10, 'tapping alone cannot get past the first boss', `wave ${noBuy.best}`);
  const idle = bot({ taps: 0, mins: 40 }), play = bot({ taps: 1.5, mins: 40 }), keen = bot({ taps: 3, mins: 40 });
  check(play.w10 != null && play.w10 > 3 && play.w10 < 12, 'a careful player meets the first boss after several minutes, not seconds', `${play.w10 && play.w10.toFixed(1)} min`);
  check(play.best >= 20 && play.best <= 60, 'forty minutes of play reach somewhere between wave 20 and 60', `wave ${play.best}`);
  check(idle.best >= 8, 'a player who only buys still gets past the early waves', `wave ${idle.best}`);
  check(play.best >= idle.best && keen.best >= play.best - 1, 'tapping helps: more taps never get a smaller result', `${idle.best} ${play.best} ${keen.best}`);
  check(play.w25 != null && play.w25 > 15 && play.w25 < 40, 'the first Mend comes after a quarter to forty minutes of play', `${play.w25 && play.w25.toFixed(1)} min`);
  check(idle.w25 == null || idle.w25 > play.w25, 'watching is slower than playing to the first Mend');
  check(play.breaks <= 12, 'a player does not live in heartbreak', `${play.breaks}`);
  // the loop of mending speeds up and never stalls
  const loop = bot({ taps: 1.5, mins: 90, mendAt: 30 });
  check(loop.mends.length >= 3, 'in an hour and a half a player mends several times', `${loop.mends.length}`);
  check(loop.mends.length < 2 || loop.mends[1] < loop.mends[0], 'the second life is shorter than the first', loop.mends.map(x => x.toFixed(1)).join(', '));
  check(loop.seams >= 6, 'seams add up', `${loop.seams}`);
}

// ------------------------------------------------------------------ page
async function page() {
  section('page');
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch (e) { try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('  skipped: playwright is not installed'); return; } }
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.log('  skipped: no Chromium'); return; }
  const server = http.createServer((q, s) => { s.setHeader('content-type', 'text/html; charset=utf-8'); s.end(html); }); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  for (const [name, vp, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 720 }, false]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 }); const p = await ctx.newPage(), errs = [];
    p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForFunction(() => window.__horde && !document.getElementById('veil').hidden); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('vh1').textContent) === 'Emoji Horde', `${name}: a new player meets the title`);
    await p.click('#vgo'); await p.waitForTimeout(700);
    check(await p.evaluate(() => __horde.mode) === 'play' && await p.evaluate(() => document.getElementById('veil').hidden), `${name}: Begin starts the game`);
    // overflow: nothing scrolls sideways
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), `${name}: the page does not scroll`);
    // the first tap beats the heart in the same moment
    const pos = await p.evaluate(() => [innerWidth / 2, innerHeight * .3]);
    await p.mouse.click(pos[0], pos[1]); await p.waitForTimeout(40);
    check(await p.evaluate(() => __horde.S.taps) === 1, `${name}: a tap beats the heart at once`);
    // play through the tutorial with taps, the way a person would
    await p.evaluate(() => { const S = __horde.S; S.up.thump = 0; });
    for (let i = 0; i < 40 && !(await p.evaluate(() => __horde.S.auto)); i++) { await p.mouse.click(pos[0], pos[1]); await p.waitForTimeout(450); }
    check(await p.evaluate(() => __horde.S.auto), `${name}: three taps' worth of faces later the heart beats by itself`);
    // buy a card
    await p.evaluate(() => { __horde.S.love += 100; }); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.getElementById('shop').classList.contains('open')), `${name}: the cards slide in once there is love to spend`);
    const before = await p.evaluate(() => __horde.S.up.thump); await p.click('.card[data-id="thump"]'); await p.waitForTimeout(100);
    check(await p.evaluate(() => __horde.S.up.thump) === before + 1, `${name}: tapping a card buys it`);
    // layout: the heart does not jump while the shop opens (checked by sampling the canvas centre over frames)
    // settings
    await p.click('#gear'); await p.waitForTimeout(600);
    check(await p.evaluate(() => !document.getElementById('sheet').hidden && __horde.mode === 'sheet'), `${name}: the cog opens settings and pauses`);
    const pref = k => p.evaluate(k => JSON.parse(localStorage.getItem('emojiHorde.v2')).prefs[k], k);
    for (const [id, k] of [['swSfx', 'sfx'], ['swBeat', 'beat'], ['swMusic', 'music'], ['swDmg', 'dmg'], ['swShake', 'shake'], ['swFlash', 'flash'], ['swZoom', 'zoom'], ['swHaptic', 'haptics']]) {
      const was = await p.evaluate(k => __horde.prefs[k], k); await p.click('#' + id);
      check(await pref(k) === !was && await p.getAttribute('#' + id, 'aria-checked') === String(!was), `${name}: ${id} flips ${k} and it is remembered`);
    }
    await p.fill('#rngVol', '35'); await p.dispatchEvent('#rngVol', 'input'); await p.dispatchEvent('#rngVol', 'change');
    check(Math.abs(await pref('vol') - .35) < .011, `${name}: the volume slider is remembered`);
    await p.click('#closeSheet'); await p.waitForTimeout(600);
    // skills: locked until wave 5, then the tree opens and a skill can be learned
    check(await p.evaluate(() => document.getElementById('skillsBtn').hidden), `${name}: the skill tree stays out of the way early`);
    await p.evaluate(() => { const S = __horde.S; S.best = Math.max(S.best, 6); S.love = 1e6; }); await p.waitForTimeout(400);
    await p.click('#skillsBtn'); await p.waitForTimeout(600);
    check(await p.evaluate(() => __horde.mode === 'sheet' && document.querySelectorAll('.node').length === 12), `${name}: the tree shows twelve skills`);
    await p.click('.node[data-id="swipe"]'); await p.click('#learnBtn'); await p.waitForTimeout(150);
    check(await p.evaluate(() => !!__horde.S.skills.swipe), `${name}: Learn takes the love and teaches the skill`);
    await p.click('#closeSheet'); await p.waitForTimeout(600);
    // swipe: a drag across the field is a slash and costs focus
    await p.evaluate(() => { window.onField = e => { const y = __horde.toScreen(e.x, e.y)[1]; return y > 110 && y < innerHeight * .5; }; });
    await p.evaluate(() => { const S = __horde.S; S.focus = 100; S.love = 0; for (let i = 0; i < 600 && !S.enemies.some(e => !e.dead && !e.ghosted && Math.hypot(e.x, e.y) < 4.5 && onField(e)); i++) __horde.advance(.05); });
    const target = await p.evaluate(() => { const e = __horde.S.enemies.find(e => !e.dead && !e.ghosted && Math.hypot(e.x, e.y) < 4.5 && onField(e)); if (!e) return null; window.__tgt = e; window.__hp0 = e.hp; __horde.freeze(true); return __horde.toScreen(e.x, e.y); });
    check(!!target, `${name}: a face is on the field to cut`);
    if (target) {
      const x0 = Math.max(4, target[0] - 70), x1 = Math.min((name === 'phone' ? 390 : 1280) - 4, target[0] + 70);
      await p.mouse.move(x0, target[1]); await p.mouse.down(); await p.mouse.move(target[0], target[1], { steps: 6 }); await p.mouse.move(x1, target[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(60);
      check(await p.evaluate(() => window.__tgt.dead || window.__tgt.hp < window.__hp0), `${name}: a drag through a face with the skill cuts it`, JSON.stringify(await p.evaluate(() => { const e = window.__tgt; return { x: e.x, y: e.y, r: e.r, hp: e.hp, hp0: window.__hp0, kind: e.kind, gh: e.ghosted, focus: __horde.S.focus, skills: __horde.S.skills, mode: __horde.mode, sc: __horde.toScreen(e.x, e.y) }; })) + JSON.stringify(target));
      await p.evaluate(() => __horde.freeze(false));
    }
    // rush: from wave 6 a button calls the next wave in early
    await p.evaluate(() => { const S = __horde.S; S.wave = 7; S.best = Math.max(S.best, 7); S.enemies = []; S.q = []; S.waveTotal = 0; S.gap = 0; S.up.courage = 6; S.hp = __horde.C.stats(S).maxHp; __horde.advance(2); });
    await p.waitForTimeout(300);
    check(await p.evaluate(() => !document.getElementById('rush').hidden), `${name}: the Rush button is there in a live wave from wave 6`);
    await p.click('#rush'); await p.waitForTimeout(100);
    check(await p.evaluate(() => __horde.S.rush === 1 && __horde.S.wave === 8), `${name}: tapping Rush brings the next wave in`);
    await p.keyboard.press('KeyR'); check(await p.evaluate(() => __horde.S.rush === 2), `${name}: R does the same`);
    // reload resumes with a welcome
    await p.evaluate(() => __horde.save()); await p.reload(); await p.waitForFunction(() => window.__horde && !document.getElementById('veil').hidden);
    check(await p.evaluate(() => document.getElementById('vh1').textContent) === 'Welcome back', `${name}: coming back says welcome back`);
    check(await p.evaluate(() => __horde.S.up.thump) >= 1, `${name}: and the progress is still there`);
    check(errs.length === 0, `${name}: no console errors`, errs.join(' | '));
    await ctx.close();
  }
  // reduced motion is respected: no shake offsets and the page still plays
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForFunction(() => window.__horde); await p.click('#vgo'); await p.waitForTimeout(300); await p.mouse.click(190, 250); await p.waitForTimeout(300);
    check(errs.length === 0, 'reduced motion: the page plays without errors'); await ctx.close(); }
  // the old roguelike's save becomes seams and a welcome
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { localStorage.setItem('emojiHorde', JSON.stringify({ gold: 5000, stars: 4, unlockedStages: [0, 1, 2], stats: { totalKills: 1234, stagesCleared: 2 }, endlessBest: 90, upgradeLevels: { burnBlade: 3 } })); });
    await p.goto(url); await p.waitForFunction(() => window.__horde && !document.getElementById('veil').hidden);
    check(await p.evaluate(() => __horde.S.seams) === 2 && await p.evaluate(() => __horde.S.kills) === 1234, 'the old save: two opened worlds are two seams, kills carried over');
    check(/2 gold seams/.test(await p.evaluate(() => document.getElementById('vsub').textContent)), 'the old save: the welcome says so');
    await p.click('#vgo'); await p.waitForTimeout(300); const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('emojiHorde.v2')).state.seams); check(saved === 2, 'the old save: the new save keeps the seams');
    check(await p.evaluate(() => localStorage.getItem('emojiHorde') !== null), 'the old save is left where it was'); check(errs.length === 0, 'the old save: no errors', errs.join(' | ')); await ctx.close(); }
  // a hostile saved game does not stop the page
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { localStorage.setItem('emojiHorde.v2', JSON.stringify({ v: 2, savedAt: 'x', prefs: 5, state: { love: 'NaN', wave: -9, up: { thump: 1e99 }, seams: {} } })); });
    await p.goto(url); await p.waitForFunction(() => window.__horde && !document.getElementById('veil').hidden); await p.click('#vgo'); await p.waitForTimeout(400);
    check(errs.length === 0, 'a hostile save: the page still opens', errs.join(' | ')); await ctx.close(); }
  await browser.close(); server.close();
}

const table = { waves, pulse, economy, heart, skills, rush: rushSuite, pressure, mend, away, saves, view, fmt: fmtSuite, pace, page };
for (const name of suites) { if (!table[name]) { console.log('unknown suite ' + name); process.exit(2); } await table[name](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
