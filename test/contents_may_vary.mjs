#!/usr/bin/env node
// Test suite for games/contents_may_vary.html.
//
// The page is an anthology: a shell, a kit, and one box after another, each a whole incremental
// game with its rules in a <script type="text/x-core" data-world="<id>"> block that has no DOM.
// This suite holds every box to the promises it makes the shell (the contract, saves that survive a
// round trip, a pace between half an hour and an hour and a half for a person), holds the shell to
// the promises it makes players (boxes only ever append, so no save loses its place), and keeps the
// whole file inside its budget. Each box can add a suite of its own, named after its id.
//
//   node test/contents_may_vary.mjs                         # everything but the browser
//   node test/contents_may_vary.mjs registry contract       # named suites only
//   node test/contents_may_vary.mjs pacing --world=starter --report
//   node test/contents_may_vary.mjs browser                 # needs Playwright's Chromium
//   node test/contents_may_vary.mjs --page=old.html
//
// Suites: registry, budget, contract, saves, pacing, starter, lawn, clew, flurry, warren, browser.

import {readFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const PAGE = opt('page') || join(ROOT, 'games', 'contents_may_vary.html');
const ONLY = opt('world');
const REPORT = args.includes('--report');
const ALL = ['registry', 'budget', 'contract', 'saves', 'pacing', 'starter', 'lawn', 'clew', 'flurry', 'warren'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

/* Boxes that have shipped, in play order. Saves refer to boxes by id and the page plays them in
   file order, so this list may only ever grow at the end. Append a box's id here when it ships. */
const SHIPPED = ['starter', 'lawn', 'clew', 'flurry', 'warren'];
// the budget: what one box and the shell may weigh, unminified, in bytes
const BOX_MAX = 130 * 1024, BOX_AIM = 100 * 1024, SHELL_MAX = 96 * 1024;
// boxes the owner gave more room, by name (CONTENTS_MAY_VARY.md, rule 2)
const BOX_CAP = { warren: 210 * 1024 };
// a person's pace, in minutes, for every box: the eager bot may not finish sooner, the casual one not later
const PACE = { eager: 30, casual: 90 };

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);
const min = s => (s / 60).toFixed(1) + ' min';

const HTML = readFileSync(PAGE, 'utf8');
const kitSrc = (HTML.match(/<script id="core-kit">([\s\S]*?)<\/script>/) || [])[1];
const marker = HTML.indexOf('<!-- ═══════════════════════════════ WORLDS');
const worlds = [...HTML.matchAll(/<template data-world="([^"]+)"([^>]*)>/g)].map(m => {
  const id = m[1], attrs = m[2], start = m.index, end = HTML.indexOf('</template>', start) + 11;
  const coreM = HTML.match(new RegExp(`<script type="text/x-core" data-world="${id}">([\\s\\S]*?)</script>`));
  const at = k => (attrs.match(new RegExp(`data-${k}="([^"]*)"`)) || [])[1];
  return { id, draft: /data-draft/.test(attrs), title: at('title'), handling: at('handling'), tpl: HTML.slice(start, end), core: coreM ? coreM[1] : null };
}).filter(w => !ONLY || w.id === ONLY);
if (!kitSrc) { console.log('no <script id="core-kit"> in ' + PAGE); process.exit(1); }

// every box's core runs in a context of its own, with the kit
function load(w) {
  const ctx = vm.createContext({});
  vm.runInContext(kitSrc + '\n' + w.core + '\nthis.CORE = CORE; this.KIT = KIT;', ctx, { filename: w.id + '.core.js' });
  return { CORE: ctx.CORE, KIT: ctx.KIT };
}

/* ---------------- registry ---------------- */
if (suites.includes('registry')) {
  section('registry');
  const ids = [...HTML.matchAll(/<template data-world="([^"]+)"/g)].map(m => m[1]);
  check(new Set(ids).size === ids.length, 'every box has its own id', ids.join(', '));
  check(SHIPPED.every((id, i) => ids[i] === id), `the shipped boxes keep their ids and their order (${SHIPPED.join(', ')})`, `page has ${ids.join(', ')}`);
  check(marker > 0 && worlds.every(w => HTML.indexOf(`data-world="${w.id}"`) > marker), 'every box comes after the WORLDS marker');
  const firstDraft = ids.findIndex(id => worlds.find(w => w.id === id && w.draft));
  check(firstDraft < 0 || ids.slice(firstDraft).every(id => worlds.find(w => w.id === id).draft), 'drafts come after every box in the stack');
  check(SHIPPED.every(id => !worlds.find(w => w.id === id).draft), 'no shipped box is a draft');
  for (const w of worlds) {
    check(!!w.core, `${w.id}: has a <script type="text/x-core"> block`);
    check(!!w.title && !!w.handling, `${w.id}: has a title and a handling note for its box`, `title=${w.title} handling=${w.handling}`);
    check(/data-part="souvenir"/.test(w.tpl), `${w.id}: has a souvenir for the shelf`);
    check(/K\.world\(/.test(w.tpl) && /K\.complete\(/.test(w.tpl), `${w.id}: registers with K.world and ends with K.complete`);
    check(!/localStorage|sessionStorage/.test(w.tpl + w.core), `${w.id}: keeps its state through the shell, not in storage of its own`);
    check(!/Math\.random/.test(w.core), `${w.id}: its core never calls Math.random (the state carries its own PRNG)`);
  }
}

/* ---------------- budget ---------------- */
if (suites.includes('budget')) {
  section('budget');
  const kb = n => (n / 1024).toFixed(1) + ' KB';
  const shell = Buffer.byteLength(HTML.slice(0, marker));
  check(shell <= SHELL_MAX, `the shell and kit weigh ${kb(shell)} (at most ${kb(SHELL_MAX)})`);
  for (const w of worlds) {
    const n = Buffer.byteLength(w.tpl) + Buffer.byteLength(w.core || '');
    const cap = BOX_CAP[w.id] || BOX_MAX;
    check(n <= cap, `${w.id}: weighs ${kb(n)} (at most ${kb(cap)})`);
    if (n > BOX_AIM) console.log(`  note  ${w.id} is over the ${kb(BOX_AIM)} a box should aim for`);
  }
}

/* ---------------- contract ---------------- */
if (suites.includes('contract')) {
  section('contract');
  for (const w of worlds) {
    let L; try { L = load(w); } catch (e) { fail(`${w.id}: its core runs in Node`, e.message); continue; }
    const { CORE } = L;
    check(Number.isInteger(CORE.version) && CORE.version >= 1, `${w.id}: has an integer version`);
    for (const f of ['init', 'step', 'act', 'done', 'progress', 'milestones']) check(typeof CORE[f] === 'function', `${w.id}: has ${f}()`);
    check(CORE.bots && typeof CORE.bots.eager === 'function' && typeof CORE.bots.casual === 'function', `${w.id}: has an eager and a casual bot`);
    const S = CORE.init(1);
    check(!CORE.done(S) && CORE.progress(S) >= 0 && CORE.progress(S) < .05, `${w.id}: a fresh state is not done and has made no progress`);
    check(JSON.stringify(CORE.init(7)) === JSON.stringify(CORE.init(7)), `${w.id}: the same seed gives the same start`);
    check(CORE.act(S, 'no-such-thing') === false || CORE.act(S, 'no-such-thing') == null, `${w.id}: an unknown action does nothing`);
    // stickers: five per shipped box, [id, name, what earns it, a pure test on the state], none earned at the start
    if (!SHIPPED.includes(w.id)) continue;
    const F = CORE.feats || [];
    check(F.length === 5 && new Set(F.map(f => f[0])).size === 5, `${w.id}: has five stickers with their own ids`, F.map(f => f[0]).join(', '));
    check(F.every(f => /^[a-z]+$/.test(f[0]) && f[1] && f[2] && typeof f[3] === 'function'), `${w.id}: every sticker has an id, a name, a description and a test`);
    let threw = null; const got = F.filter(f => { try { return f[3](CORE.init(3)) === true; } catch (e) { threw = e.message; return false; } });
    check(!threw && !got.length, `${w.id}: no sticker is earned in a fresh state, and none throws`, threw || got.map(f => f[0]).join(', '));
  }
}

/* ---------------- saves ---------------- */
if (suites.includes('saves')) {
  section('saves');
  const clean = (o, path = '') => {
    if (typeof o === 'number' && !isFinite(o)) return path + ' is ' + o;
    if (typeof o === 'function') return path + ' is a function';
    if (o && typeof o === 'object') for (const k in o) { const r = clean(o[k], path + '.' + k); if (r) return r; }
    return null;
  };
  for (const w of worlds) {
    const { CORE, KIT } = load(w);
    for (const at of [3, 15, 40]) {
      const r = KIT.simulate(CORE, 'eager', { minutes: at, seed: 3 });
      const bad = clean(r.S);
      check(!bad, `${w.id}: after ${at} min the state is plain data`, bad);
      const json = JSON.stringify(r.S);
      check(json.length < 100 * 1024, `${w.id}: after ${at} min the save is ${(json.length / 1024).toFixed(1)} KB`);
      // a saved and loaded state goes on exactly like the one that never left
      const copy = JSON.parse(json);
      for (let k = 0; k < 600; k++) { CORE.step(r.S, .1); CORE.step(copy, .1); }
      check(JSON.stringify(r.S) === JSON.stringify(copy), `${w.id}: after ${at} min a saved and loaded state carries on identically for a minute`);
      // the shell may hand back a long absence in one go
      const away = JSON.parse(json); let ok = true;
      try { CORE.step(away, 600); } catch (e) { ok = false; }
      check(ok && !clean(away), `${w.id}: ten minutes away in a single step leave a valid state`);
    }
  }
}

/* ---------------- pacing ---------------- */
if (suites.includes('pacing')) {
  section('pacing');
  for (const w of worlds) {
    const { CORE, KIT } = load(w);
    const aim = Object.assign({}, PACE, CORE.pace || {});
    for (const bot of ['eager', 'casual']) {
      const runs = [1, 2, 3].map(seed => KIT.simulate(CORE, bot, { seed, minutes: 150, every: 30 }));
      const t = runs.map(r => r.minutes), gap = Math.max(...runs.map(r => r.gap));
      console.log(`  ${w.id} ${bot}: ${t.map(x => x.toFixed(1)).join(', ')} min; longest wait for something new ${min(gap)}`);
      check(runs.every(r => r.done), `${w.id}: the ${bot} bot opens the box within 150 minutes`);
      if (bot === 'eager') check(Math.min(...t) >= aim.eager, `${w.id}: the eager bot takes at least ${aim.eager} min`, t.join(', '));
      else check(Math.max(...t) <= aim.casual, `${w.id}: the casual bot takes at most ${aim.casual} min`, t.join(', '));
      const gapMax = (aim.gap || 5) * (bot === 'casual' ? 1.6 : 1);
      check(gap <= gapMax * 60, `${w.id}: the ${bot} bot never waits more than ${gapMax.toFixed(1)} min for something new`, min(gap));
      const first = Math.min(...runs.map(r => r.marks.length ? r.marks[0][0] : 1e9));
      check(first <= 60, `${w.id}: something can be bought or unlocked within the first minute (${first.toFixed(0)} s)`);
      for (const r of runs) {
        const ps = r.samples.map(s => s.p);
        const dips = ps.filter((p, i) => i && p < ps[i - 1] - .02).length;
        check(dips === 0, `${w.id}: progress never goes backwards for the ${bot} bot`, ps.map(p => p.toFixed(2)).join(' '));
        check(CORE.progress(r.S) >= .99, `${w.id}: progress reaches the end with the box`);
      }
      // a whole game earns some of the box's stickers but never all of them: the rest want a purpose
      if (CORE.feats && SHIPPED.includes(w.id)) {
        const n = runs.map(r => CORE.feats.filter(f => f[3](r.S)).length);
        check(n.every(k => k >= 1 && k <= 4), `${w.id}: the ${bot} bot earns between one and four stickers in a whole game`, n.join(', '));
      }
      if (REPORT) for (const r of runs.slice(0, 1)) console.log('   ', r.marks.map(([s, m]) => (s / 60).toFixed(1)).join(' '));
    }
  }
}

/* ---------------- starter ---------------- */
const starter = worlds.find(w => w.id === 'starter');
if (suites.includes('starter') && starter) {
  section('starter');
  const { CORE, KIT } = load(starter);
  const S0 = () => CORE.init(5);
  const at = (S, p) => { const j = S.jars[0]; j.t = p * CORE.rise(S, j); };
  {
    const S = S0(); at(S, CORE.P.early * .9);
    check(!CORE.act(S, 'tap', 0) && S.$ === 0, 'a tap before she has risen does nothing and earns nothing');
    at(S, 1.1); CORE.act(S, 'tap', 0); const perfect = S.$;
    const S2 = S0(); at(S2, 1.9); CORE.act(S2, 'tap', 0);
    check(perfect > S2.$ * 1.5, `a tap at the peak pays well over a late one (${perfect.toFixed(3)} against ${S2.$.toFixed(3)})`);
    check(S.streak === 1 && S2.streak === 0, 'a perfect tap starts a streak and a late one does not');
    S.streak = 8; at(S, 1.8); CORE.act(S, 'tap', 0);
    check(S.streak === 4, 'a tap off the peak halves the streak');
  }
  {
    const S = S0(); S.lv.appr = 3; S.streak = 5; let worst = 0, best = 0;
    for (let k = 0; k < 4000; k++) { CORE.step(S, .1); for (const e of S.ev) if (e.k === 'bake' && e.who === 'appr') { best = Math.max(best, e.q); worst = Math.max(worst, e.perfect ? 1 : 0); } S.ev.length = 0; }
    check(best > 0 && best < 1 && !worst, `the apprentice bakes, never at the peak (best ${best.toFixed(2)})`);
    check(S.streak === 5, 'the apprentice leaves the player’s streak alone');
  }
  {
    // automation cannot replace the player: a fully built act 1 left alone earns well under the eager bot
    const r = KIT.simulate(CORE, 'eager', { minutes: 7.5, seed: 2 });
    const a = JSON.parse(JSON.stringify(r.S)), b = JSON.parse(JSON.stringify(r.S));
    a.lv.appr = b.lv.appr = 3; const a0 = a.earned, b0 = b.earned;
    for (let k = 0; k < 1800; k++) CORE.step(a, .1);
    const m = { seed: 9 }; for (let k = 0; k < 1800; k++) { CORE.bots.eager(b, m, .1); CORE.step(b, .1); }
    const alone = a.earned - a0, played = b.earned - b0;
    check(alone < played * .75, `a kitchen left to the apprentice earns ${(100 * alone / played).toFixed(0)}% of one that is played (under 75%)`);
  }
  {
    const r = KIT.simulate(CORE, 'eager', { minutes: 26, seed: 4 }); const S = r.S;
    check(S.act === 3, 'the eager bot is downstairs with Mother by minute 26');
    S.lv.pin = 3; let early = 0;
    for (let k = 0; k < 3000; k++) {
      const before = Object.fromEntries(S.bulges.map(b => [b.slot, b.age]));
      CORE.step(S, .1);
      for (const e of S.ev) if (e.k === 'punch' && e.who === 'pin' && before[e.slot] < CORE.ripeAt(S) - .2) early++;
      S.ev.length = 0;
    }
    check(early === 0, 'rolling pins only take bulges that have ripened', early + ' taken early');
    {
      // a ripe bulge pays more than a fresh one: waiting is a choice, and beams make room for it
      const a = { age: CORE.P.bulgeGrow }, b = { age: CORE.P.bulgeGrow + 2 };
      check(CORE.ripe(S, b) > CORE.ripe(S, a) * 1.4, 'a bulge left to ripen two seconds pays at least 40% more');
    }
    {
      // the end of the cellar is played, not waited for: money alone never opens the Last Loaf, and a
      // kitchen left to its rolling pins proves far slower than one whose cook punches her down
      const T = JSON.parse(JSON.stringify(S)); T.$ = 1e12;
      check(!CORE.act(T, 'buy', 'last') && T.act === 3, 'a trillion dollars does not buy the Last Loaf before she has risen');
      const idle = JSON.parse(JSON.stringify(r.S)), busy = JSON.parse(JSON.stringify(r.S)), m = { seed: 4 };
      for (const X of [idle, busy]) Object.assign(X.lv, { pin: 3, heave: 3, beams: 3 });
      for (let k = 0; k < 1800; k++) { CORE.step(idle, .1); const $ = busy.$; busy.$ = 0; CORE.bots.eager(busy, m, .1); busy.$ += $; CORE.step(busy, .1); idle.ev.length = busy.ev.length = 0; }
      const gain = X => X.proof - r.S.proof;
      check(gain(idle) < gain(busy) * .35, `left to its pins she proves ${(100 * gain(idle) / gain(busy)).toFixed(0)}% as far as when she is punched (under 35%)`);
      const G = JSON.parse(JSON.stringify(r.S)); G.bulges = []; G.heave = 99; G.proof = .25; G.great = 0; CORE.step(G, .1);
      check(G.bulges.length === CORE.SLOTS && G.great === 1, 'a quarter risen, she heaves through every place at once');
      const old = JSON.parse(JSON.stringify(r.S)); delete old.proof; delete old.great; old.earned = 2e6; old.note = 8;
      const M = CORE.migrate(old, 1);
      check(M.proof > .3 && M.proof < .95 && M.note === 9 && CORE.NOTES[M.note - 1][0] === 'ALL OF IT', `a save from when the Last Loaf cost ten million keeps its place (${(100 * M.proof).toFixed(0)}% risen)`);
    }
    S.$ = 1e12; S.proof = 1; check(CORE.act(S, 'buy', 'last') && S.act === 4, 'the Last Loaf ends the bakery');
    CORE.step(S, .1);
    check(S.finale === 1, 'once bought, she rises by herself');
    check(!CORE.act(S, 'finale', 3) && S.finale === 1, 'the end cannot be skipped ahead');
    for (const k of [2, 3, 4, 5]) CORE.act(S, 'finale', k);
    check(CORE.done(S) && CORE.progress(S) >= .99, 'scored, baked, sliced and opened, the box is done');
  }
  {
    const S = S0(); S.act = 2; S.bench.push({ v: 1, age: 0, pat: 0 });
    check(CORE.scoreQ(S, 0) === 1 && CORE.scoreQ(S, CORE.tol(S)) === 0, 'a perfect score is worth everything and a score a whole tolerance off is worth nothing');
    const before = S.$; CORE.act(S, 'score', 0, 0);
    check(Math.abs(S.$ - before - CORE.scoreMax(S)) < 1e-9, 'a perfect score multiplies the loaf by the pattern’s maximum');
    S.bench.push({ v: 1, age: 0, pat: 0 }); S.lv.pattern = 2; const b2 = S.$; CORE.act(S, 'score', 0, 0);
    check(Math.abs(S.$ - b2 - CORE.scoreMax(S, 0)) < 1e-9, 'a loaf shaped before a new pattern is paid by the pattern it was given');
    S.bench.push({ v: 1, age: CORE.bakerAt(S) + 1, pat: 0 }); S.lv.baker = 1; CORE.act(S, 'hold', 0); CORE.step(S, .1);
    check(S.bench.length === 1, 'the baker leaves alone a loaf you are scoring');
    check(!CORE.act(S, 'name', 0, 'Bob') && S.jars[0].name === 'Mother', 'Mother keeps her name');
  }
}

/* ---------------- lawn ---------------- */
const lawn = worlds.find(w => w.id === 'lawn');
if (suites.includes('lawn') && lawn) {
  section('lawn');
  const { CORE } = load(lawn);
  const drive = (S, x, y, sec) => { CORE.act(S, 'go', x, y); for (let t = 0; t < sec; t += .1) CORE.step(S, .1); };
  {
    // a full grass box stops the cutting; tipping it in the bin pays
    const S = CORE.init(3); S.lv.deck = 3;
    drive(S, 15.5, 14, 6); drive(S, 16.5, 5, 6); drive(S, 17.5, 14, 6); drive(S, 18.5, 5, 6);
    check(S.bag >= CORE.cap(S) - 1 && S.$ === 0, `mowing fills the grass box and pays nothing yet (${S.bag.toFixed(1)} of ${CORE.cap(S)})`);
    S.bag = CORE.cap(S); const before = S.h.slice(); drive(S, 13.2, 14, 6);
    check(S.h.every((h, i) => h === before[i] || h > before[i]), 'with the box full the mower cuts nothing');
    drive(S, 20.5, 12.5, 8); drive(S, 20.6, 13.4, 2);
    check(S.$ > 0 && S.bag === 0, `the compost bin empties the box and pays (${S.$.toFixed(2)})`);
  }
  {
    // a lawn stays cut until it is finished, then grows back, and the owner pays once
    const S = CORE.init(4); S.lv.mulch = 1; const L = CORE.layout('street', 0), cells = L.reg[1];
    for (const i of cells.slice(0, cells.length >> 1)) S.h[i] = CORE.P.cutTo;
    CORE.step(S, 30);
    check(cells.slice(0, cells.length >> 1).every(i => S.h[i] === CORE.P.cutTo), 'half a lawn stays cut while the rest waits');
    for (const i of cells) S.h[i] = CORE.P.cutTo; S.ev.length = 0; CORE.step(S, 1);
    const jobs = S.ev.filter(e => e.k === 'job' && e.g === 1).length; CORE.step(S, 3);
    check(jobs === 1 && S.ev.filter(e => e.k === 'job').length === 1, 'a finished lawn pays its owner once');
    CORE.step(S, CORE.growT(S) + 1);
    check(cells.every(i => S.h[i] >= CORE.top(S) * .95), 'and then it grows back in full');
  }
  {
    // the judges: nothing for an unmown show lawn, more for straight stripes than for a ragged mow
    const S = CORE.init(5); S.act = 3; S.lv.show1 = 1; S.lv.ride = 1; S.lv.mulch = 1;
    CORE.act(S, 'buy', 'show1'); // already owned: refused
    const mk = straight => { const T = JSON.parse(JSON.stringify(S)); T.site = 'green'; T.tier = 1; const L = CORE.layout('green', 1); T.h = new Array(L.W * L.H).fill(0); T.d = new Array(L.W * L.H).fill(0); T.gw = [0, 0, 0, 0];
      for (let i = 0; i < L.K.length; i++) if (L.K[i] === 1) { const x = i % L.W, y = (i / L.W) | 0; T.h[i] = CORE.P.cutTo; T.d[i] = straight ? (x >> 1) % 2 + 1 : (x + y) % 4 + 1; } T.m = { x: 20, y: 2, a: 0, go: 0 }; return T; };
    const A = mk(true), B = mk(false), C = mk(true); for (let i = 0; i < C.h.length; i++) if (C.h[i] === CORE.P.cutTo) C.h[i] = 1000;
    check(!CORE.canJudge(C), 'the judges will not come out to a lawn nobody has mown');
    CORE.act(A, 'judge'); CORE.act(B, 'judge');
    check(A.gold === 1 && A.$ > B.$ * 2, `straight stripes win gold and pay well over a ragged mow (${A.$.toFixed(0)} against ${B.$.toFixed(0)})`);
    check(!CORE.act(A, 'judge'), 'the judges do not come straight back');
  }
  {
    // on a show ground the cutters lift off the lawn: a turn on the headland cuts nothing, even with
    // gangs wide enough to reach well into the lawn
    const S = CORE.init(8); S.act = 2; S.$ = 1e9; check(CORE.act(S, 'buy', 'show1'), 'lift test: at the Village Show'); S.lv.ride = 1; S.lv.gang = 4; S.lv.deck = 8;
    const L = CORE.layout('green', 1), s = L.show, onLawn = () => L.K.reduce((n, k, i) => n + (k === 1 && S.h[i] <= CORE.P.cutAt ? 1 : 0), 0);
    S.m.x = s.x0 + 3; S.m.y = s.y0 - 1.5; drive(S, s.x1 - 2, s.y0 - 1.5, 6);
    check(CORE.cutW(S) / 2 > 2 && onLawn() === 0 && S.m.up === 1, `driving along the headland with ${CORE.cutW(S).toFixed(1)} cells of gangs cuts nothing on the lawn`);
    drive(S, s.x1 - 2, s.y0 + 4, 3);
    check(onLawn() > 0 && S.m.up === 0, 'on the lawn they come down and cut');
  }
  {
    // something gets onto a mown show lawn; the judges will not come while it is there; driving at it
    // twice sees it off for a bonus, and one left alone wanders off with nothing paid
    const mk = () => { const S = CORE.init(9); S.act = 2; S.$ = 1e9; CORE.act(S, 'buy', 'show1'); S.$ = 0; const L = CORE.layout('green', 1), s = L.show;
      for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) { S.h[y * L.W + x] = CORE.P.cutTo; S.d[y * L.W + x] = (x >> 1) % 2 + 1; } S.pestT = 0; S.m.x = 2; S.m.y = 2; CORE.step(S, .1); return S; };
    const S = mk();
    check(S.pest && S.pest.k === 0 && !CORE.canJudge(S) && S.ev.some(e => e.k === 'pest' && e.kind === 'dog'), 'a dog gets onto the Village Show lawn and the judges will not come out');
    let shoo = null; for (let t = 0; t < 30 && !shoo; t += .1) { if (S.pest && !S.pest.flee) { S.m.x = S.pest.x; S.m.y = S.pest.y; } CORE.step(S, .1); shoo = S.ev.find(e => e.k === 'shoo'); }
    check(shoo && shoo.by === 1 && shoo.v > 0 && S.$ > 0 && !S.pest && S.ev.some(e => e.k === 'dodge'), `it dodges once, then runs, and seeing it off pays (${shoo && shoo.v.toFixed(0)})`);
    const T = mk(); let left = null; for (let t = 0; t < 60 && !left; t += .1) { CORE.step(T, .1); left = T.ev.find(e => e.k === 'shoo'); }
    const L = CORE.layout('green', 1), sc = L.show; let scuffed = 0; for (let y = sc.y0; y <= sc.y1; y++) for (let x = sc.x0; x <= sc.x1; x++) if (!(T.d[y * L.W + x] & 7)) scuffed++;
    check(left && left.by === 2 && left.v === 0 && scuffed > 5, `left alone it scuffs the stripes (${scuffed} cells) and wanders off, paying nothing`);
  }
  {
    // midnight: the end needs the string mown, and nothing else will do
    const S = CORE.init(6); S.act = 3; S.gold = CORE.SHOWS.length; S.$ = 1; CORE.act(S, 'buy', 'night');
    const L = CORE.layout('field', 0), on = new Set(L.stencil);
    for (let i = 0; i < S.h.length; i++) if (!on.has(i)) S.h[i] = CORE.P.cutTo;
    CORE.step(S, 2);
    check(S.act === 4 && S.finale === 0, 'mowing the whole field but the string opens nothing');
    for (const i of L.stencil) S.h[i] = CORE.P.cutTo; CORE.step(S, .2);
    check(S.finale === 1 && !CORE.done(S) && !CORE.act(S, 'finale', 3) && CORE.act(S, 'finale', 2) && CORE.act(S, 'finale', 3) && CORE.done(S), 'the string mown, the box folds up and opens, one step at a time');
  }
}

/* ---------------- clew ---------------- */
const clew = worlds.find(w => w.id === 'clew');
if (suites.includes('clew') && clew) {
  section('clew');
  const { CORE } = load(clew);
  const run = (S, sec, f) => { for (let t = 0; t < sec; t += .1) { if (f) f(S, t); CORE.step(S, .1); } };
  const onBoard = (b, lv) => { const S = CORE.init(3); S.lv = Object.assign({}, lv || {}); S.bought = 99; S.board = b; S.big = CORE.BIG[b]; S.phase = 'tree'; CORE.act(S, 'run'); return S; };
  {
    // every board lets a ball through: no ball dropped anywhere is still on the board a minute later
    let stuck = [];
    for (let b = 0; b < 5; b++) for (const tul of [0, 3]) {
      const S = onBoard(b, { t_tulip: tul }); S.big = 1e30; S.tray = 0;
      for (let x = 3; x <= 97; x += 2) S.balls.push({ x, y: 1.5, vx: 0, vy: 12, k: 0, s: 0, h: 0, w: 0, ax: x, ay: 1.5 });
      run(S, 60);
      if (S.balls.length) stuck.push(`board ${b + 1}${tul ? ' with tulips' : ''}: ${S.balls.map(q => q.x.toFixed(0) + ',' + q.y.toFixed(0)).join(' ')}`);
    }
    check(!stuck.length, 'on every board, every ball dropped from the rail has left within a minute', stuck.join('; '));
  }
  {
    // nothing rests on a closed tulip: a ball dropped anywhere over one, on every board with every tulip, is gone in a second and a half
    let worst = 0, where = '';
    for (let b = 0; b < 5; b++) for (const p of CORE.board(b, 3).pockets) for (let k = 0; k < 12; k++) {
      const S = onBoard(b, { t_tulip: 3 }); S.big = 1e30; S.tray = 0; S.cap = S.cap.map(() => 0);
      const x = p.cx + (k / 11 - .5) * (p.w + 6); S.balls = [{ x, y: p.y - 8, vx: (k % 3 - 1) * 4, vy: 10, k: 0, s: 0, h: 0, w: 0, ax: x, ay: p.y - 8 }];
      let near = 0; for (let t2 = 0; t2 < 3; t2 += .05) { CORE.step(S, .05); const q = S.balls[0]; if (!q) break; if (Math.abs(q.x - p.cx) < p.w / 2 + 3 && Math.abs(q.y - p.y) < 5) near += .05; }
      if (near > worst) { worst = near; where = `board ${b + 1}, tulip at ${p.cx},${p.y}`; }
    }
    check(worst < 1.5, `no ball rests on a closed tulip (longest ${worst.toFixed(2)} s, ${where})`);
  }
  {
    // the first game: short, and it pays for a bulb
    const S = CORE.init(1), m = { seed: 5 }; let t = 0;
    while (S.phase === 'run' && t < 60) { CORE.bots.eager(S, m, .1); CORE.step(S, .1); t += .1; }
    check(S.phase === 'tree' && t >= 8 && t <= 30, `the first game is over in 8 to 30 seconds (${t.toFixed(1)} s)`);
    check(CORE.UP.some(u => CORE.can(S, u)), `and its ${S.$.toFixed(0)} coins buy a bulb straight away`);
    check(S.big < CORE.BIG[0] && S.big > CORE.BIG[0] * .9, `it chips the Big One (${Math.ceil(S.big)} of ${CORE.BIG[0]})`);
  }
  {
    // the thumb pours out of the tray at its rate, and letting go stops it
    const S = CORE.init(2), n0 = S.tray; CORE.act(S, 'hold', 50); run(S, 1);
    const poured = n0 - S.tray + 0; check(poured >= 3 && poured <= 5, `holding for a second pours about four balls (${poured})`);
    CORE.act(S, 'let'); const n1 = S.tray; run(S, 1);
    check(S.tray >= n1, 'letting go stops the pour');
    check(!CORE.act(S, 'hold', NaN) && !CORE.act(S, 'run'), 'nonsense and a second game in the middle of one are refused');
  }
  {
    // a tulip pays a prize in coins and fires the ball back up for the balls it holds, then closes into a dome
    const S = CORE.init(4), B = CORE.board(0, 0), p = B.pockets[0];
    const drop = () => { S.balls = [{ x: p.cx, y: p.y - 6, vx: 0, vy: 0, k: 0, s: 0, h: 0, w: 0, ax: p.cx, ay: p.y - 6 }]; S.ev.length = 0; run(S, .6); };
    const cap = S.cap[p.i], t0 = S.tray; let paid = 0, fired = 0;
    for (let i = 0; i < cap; i++) { const c0 = S.$; drop(); paid += S.$ - c0; fired += S.ev.filter(e => e.k === 'catch').reduce((a, e) => a + e.n, 0); }
    check(S.cap[p.i] === 0 && paid >= cap * CORE.tulipPay(S) * .99 && fired === cap && S.tray === t0, `a tulip pays a prize of coins and shoots each of the ${cap} balls it holds back up (tray unchanged)`);
    const c1 = S.$; S.ev.length = 0; drop(); run(S, 1);
    check(!S.ev.some(e => e.k === 'catch') && S.$ - c1 < CORE.tulipPay(S) * .5, 'then it is closed and pays nothing more this game');
    check(S.balls.every(q => q.y > p.y + 4 || Math.abs(q.x - p.cx) > p.w), 'and a ball that lands on its dome rolls off');
  }
  {
    // coins land when a block breaks, the Big One keeps its damage between games, and the game ends with the tray
    const S = CORE.init(6), r = CORE.board(0, 0).blocks[0]; S.hp[r.i] = .1; const c0 = S.$;
    S.balls.push({ x: r.x + 3, y: r.y - 8, vx: 0, vy: 30, k: 0, s: 0, h: 0, w: 0, ax: 0, ay: 0 }); run(S, .5);
    const brk = S.ev.find(e => e.k === 'brk'); check(brk && S.$ - c0 >= brk.v - 1e-9 && S.hp[r.i] === 0, 'a broken block pays when it breaks');
    S.big = 700; S.tray = 0; S.balls = []; run(S, .2);
    check(S.phase === 'tree' && S.runs === 1, 'with the tray empty and the last ball gone, the game is over');
    CORE.act(S, 'run'); check(S.big === 700 && S.tray === CORE.stats(S).balls && S.hp.every((h, i) => h === CORE.board(0, 0).blocks[i].hp), 'the next game refills the tray and the blocks, and the Big One stays as broken as it was');
  }
  {
    // a run with everything bought still ends: tulips close, last call empties the tray
    const lv = Object.fromEntries(CORE.UP.map(u => [u.id, u.max])), S = onBoard(4, lv); S.big = 1e30; let t = 0;
    while (S.phase === 'run' && t < 400) { if (S.tray > 0) CORE.act(S, 'hold', 20 + (t * 7) % 60); CORE.step(S, .1); t += .1; }
    check(S.phase === 'tree' && t < 300, `with every bulb lit, a game on the mountain still ends (${t.toFixed(0)} s)`);
  }
  {
    // the auto-launcher pours only once it has been set this game, and a new game forgets it
    const S = CORE.init(12); S.lv.auto = 1; S.bought++; const n0 = S.tray; run(S, 1);
    check(S.tray === n0 && !S.balls.length, 'a bought auto-launcher pours nothing until it is set');
    check(CORE.act(S, 'launch', 70), 'a tap sets it'); run(S, 2);
    check(S.tray < n0 && S.balls.some(q => Math.abs(q.x - 70) < 25), `then it pours at its column (${n0 - S.tray} balls)`);
    const T = CORE.init(12); check(!CORE.act(T, 'launch', 70), 'without the bulb a tap sets nothing');
  }
  {
    // a lantern drifts down now and then from the third game; caught, it is fever, missed, it is gone
    const S = CORE.init(13); S.runs = 2; S.tray = 400; S.lanT = .5; CORE.act(S, 'hold', 50); run(S, 3);
    check(!!S.lan, 'a lantern comes down the glass');
    const L = S.lan; check(!CORE.act(S, 'tap', L.x + 30, L.y) && S.fever <= 0, 'a tap beside it misses');
    check(CORE.act(S, 'tap', L.x, L.y) && S.fever > 0 && !S.lan, 'a tap on it catches it and starts a fever');
    const T = CORE.init(13); T.runs = 2; T.tray = 400; T.lanT = .5; CORE.act(T, 'hold', 50); run(T, 1); run(T, CORE.P.lanLife + 1);
    check(T.ev.some(e => e.k === 'lanlost') || !T.lan || T.lan.id > 1, 'one left alone drifts away');
  }
  {
    // three of a kind is fever: balls rain from the whole top edge, and pay double
    const S = CORE.init(7); S.lv.start = 1; S.bought++; S.tray = 0; S.fever = 5; const xs = new Set();
    run(S, 1, () => S.balls.forEach(b => b.y < 3 && xs.add(b.x / 10 | 0)));
    check(xs.size >= 7, `fever rains across the board (${xs.size} of 10 columns in a second)`);
  }
  {
    // a bomb takes out the blocks round it; at the cap, pouring fuses into mega balls
    const S = CORE.init(8), B = CORE.board(0, 0), r = B.blocks[0]; S.lv.bomb = 1; S.bought++;
    S.balls.push({ x: r.x + 3, y: r.y - 6, vx: 0, vy: 30, k: 1, s: 0, h: 0, w: 0, ax: 0, ay: 0 }); S.hp = S.hp.map(() => 5); run(S, .5);
    check(S.ev.some(e => e.k === 'boom') && S.hp.filter(h => h === 0).length >= 3, `a bomb ball breaks the blocks round it (${S.hp.filter(h => h === 0).length})`);
    const T = onBoard(1, { mega: 1, rate: 5, t_rate: 3, m_rate: 3, s_fev: 3 }); T.tray = 2000; T.big = 1e30; T.fever = 40; CORE.act(T, 'hold', 50); let megas = 0;
    run(T, 40, () => { megas += T.ev.filter(e => e.k === 'mega').length; T.ev.length = 0; });
    check(T.balls.length <= CORE.CAP + 4 && megas > 0, `the board never holds more than ${CORE.CAP} balls, and the overflow becomes mega balls (${megas})`);
  }
  {
    // the Big One opens the next board and a new panel of the sign; the last one is a box
    const S = CORE.init(9); S.$ = 1e30; S.lv.heavy = S.lv.prize = 1; S.bought += 2; check(!CORE.act(S, 'buy', 't_coin'), 'the tall machine’s ring stays dark until its board is reached');
    S.big = 1; S.balls = [{ x: 50, y: CORE.board(0, 0).big.y - 5, vx: 0, vy: 40, k: 0, s: 0, h: 0, w: 0, ax: 0, ay: 0 }]; S.tray = 0; run(S, .5);
    check(S.board === 1 && S.phase === 'tree' && S.big === CORE.BIG[1] && CORE.act(S, 'buy', 't_coin'), 'breaking the Big One opens board 2 and its ring of the sign');
    const T = onBoard(4); T.big = 1; T.balls = [{ x: 50, y: CORE.board(4, 0).big.y - 5, vx: 0, vy: 40, k: 0, s: 0, h: 0, w: 0, ax: 0, ay: 0 }]; T.tray = 0; run(T, .5);
    check(T.fin === 1 && !CORE.done(T) && !CORE.act(T, 'run'), 'the last Big One is a box: breaking it ends the games, and nothing is open yet');
    check(CORE.act(T, 'open') && CORE.done(T) && CORE.progress(T) >= .99, 'opening it finishes the box');
  }
  {
    // the box was a survey, a jailbreak and a demolition firm before it was a parlour: old saves start again
    const a = CORE.migrate({ ms: 3, mp: [1, 2, 3] }, 1), b = CORE.migrate({ ms: 3, cells: '...' }, 3);
    check(JSON.stringify(a) === JSON.stringify(CORE.init(3)) && JSON.stringify(b) === JSON.stringify(CORE.init(3)), 'saves from the three earlier versions start the parlour fresh');
  }
}

/* ---------------- flurry ---------------- */
const flurry = worlds.find(w => w.id === 'flurry');
if (suites.includes('flurry') && flurry) {
  section('flurry');
  const { CORE } = load(flurry);
  const fresh = (seed = 3) => { const S = CORE.init(seed); CORE.act(S, 'run'); S.ev.length = 0; return S; };
  const run = (S, sec, f) => { for (let t = 0; t < sec && S.phase === 'run'; t += .1) { if (f) f(S, t); CORE.step(S, .1); } };
  {
    // a snowball lands where the kid will be: a running kid is hit, one behind cover is not, ice goes through cover
    const S = fresh(); S.lv.ice = 1; S.lv.pile = 4; S.ammo = 9; S.warm = S.warmMax = 1e9;
    const k = S.kids[0]; k.st = 'run'; k.tx = k.x + 4; k.tz = k.z + 2; k.t = 0;
    const r0 = k.r; CORE.act(S, 'throw', 0); run(S, 1);
    check(k.r < r0, `a snowball thrown at a running kid lands on them (${r0} → ${k.r})`);
    const q = S.kids[1]; q.st = 'hide'; q.t = 99; const q0 = q.r; S.throws = 0; CORE.act(S, 'throw', 1); run(S, 1.2);
    check(q.r === q0 && S.kids.filter(x => x !== q).every(x => x.st !== 'down' || x === k), 'a kid crouched behind cover is not hit by a plain snowball');
    S.throws = 4; S.ammo = 9; CORE.act(S, 'throw', 1); run(S, 1.2);
    check(q.r < q0, 'an ice ball goes straight through cover');
  }
  {
    // resolve is kept between runs, and a kid with none left comes over and throws for you
    const S = fresh(); const k = S.kids[0]; k.r = 1; S.warm = 0; run(S, .2);
    check(S.phase === 'shop', 'a run ends when you are too cold');
    CORE.act(S, 'run'); check(S.kids[0].r === 1, 'a kid’s resolve stays down between runs');
    k.st = 'up'; k.t = 9; S.ammo = 3; S.warm = S.warmMax = 1e9; CORE.act(S, 'throw', 0); run(S, 1);
    check(k.ally && S.allies.length === 1, 'a kid with no resolve left comes over to your side');
    let thrown = 0; run(S, 12, X => { thrown += X.balls.filter(b => b.by === 1 && b.t === 0).length; });
    check(S.balls.some(b => b.by === 1) || S.kids.some(x => x.r < x.R), 'kids on your side throw by themselves');
  }
  {
    // a swatted snowball costs no warmth; one that gets through does; every run ends, even with nobody throwing
    const S = fresh(); const k = S.kids[0]; k.st = 'wind'; k.t = .01;
    let b = null; run(S, .3, X => { b = b || X.inc.find(q => !q.miss); });
    if (!b) { S.inc.push({ id: 999, who: 0, x: 0, z: 8, t: 0, T: 1.3, miss: 0, ex: 0, big: 0 }); b = S.inc[S.inc.length - 1]; }
    CORE.step(S, .2); const w = S.warm; check(CORE.act(S, 'swat', b.id) && S.inc.every(q => q.id !== b.id), 'a snowball in the air can be swatted');
    S.inc.push({ id: 1000, who: 0, x: 0, z: 8, t: 1.29, T: 1.3, miss: 0, ex: 0, big: 0 }); const w2 = S.warm; CORE.step(S, .05);
    check(S.warm < w2 - 2, 'one that gets through costs warmth');
    const T = fresh(); T.lv.scarf = 6; T.lv.coat = 4; T.lv.hat = 3; T.lv.boot = 3; CORE.act(T, 'no'); T.phase = 'shop'; CORE.act(T, 'run');
    for (const q of T.kids) q.t = 1e9; let t = 0; while (T.phase === 'run' && t < 600) { CORE.step(T, .5); t += .5; }
    check(T.phase === 'shop' && t < 200, `with every warmth upgrade and nobody throwing, a run still ends (${t.toFixed(0)} s)`);
  }
  {
    // the sledge rides in front of the nearest cover on every yard, never through it
    let bad = [];
    for (let y = 0; y < CORE.YARDS.length; y++) {
      const S = CORE.init(7); S.yard = y; S.tier = y; S.kids = CORE.makeKids(y); CORE.act(S, 'run'); S.warm = S.warmMax = 1e9; S.sledgeT = 0; CORE.step(S, .1);
      const front = Math.min(...CORE.YARDS[y].cover.map(c => c[1] - .3));
      if (!S.sledge || S.sledge.z + .35 > front - .1) bad.push(`${CORE.YARDS[y].name}: ${S.sledge && S.sledge.z.toFixed(2)} against ${front.toFixed(2)}`);
    }
    check(!bad.length, 'the sledge passes in front of every cover', bad.join('; '));
  }
  {
    // the last yard: the yeti comes over, he brings a present, and opening it is the end
    const T = CORE.init(5); T.yard = 3; T.tier = 3; T.kids = CORE.makeKids(3); CORE.act(T, 'run');
    for (const k of T.kids) { k.r = 1e-9; k.st = 'up'; k.t = 99; } T.ammo = 99; T.lv.pile = 4; T.warm = T.warmMax = 1e12;
    for (let j = 0; j < T.kids.length; j++) { if (T.phase !== 'run') break; T.ammo = 9; CORE.act(T, 'throw', j); CORE.step(T, 1); }
    check(T.yard === 4 && T.phase === 'shop' && T.allies.length >= 9, 'winning a yard moves the war on and keeps your side');
    CORE.act(T, 'run'); for (const k of T.kids) { k.r = 1e-9; k.st = 'up'; k.t = 99; } T.warm = T.warmMax = 1e12;
    for (let j = 0; j < T.kids.length && !T.fin; j++) { T.ammo = 9; CORE.act(T, 'throw', j); CORE.step(T, 1); }
    check(T.fin === 1 && !CORE.done(T) && CORE.progress(T) < 1, 'the yeti comes over and the box is not open yet');
    check(CORE.act(T, 'open') && CORE.done(T) && CORE.progress(T) === 1, 'opening his present is the end');
  }
}

/* ---------------- warren ---------------- */
const warren = worlds.find(w => w.id === 'warren');
if (suites.includes('warren') && warren) {
  section('warren');
  const { CORE, KIT } = load(warren);
  {
    // every folio's horde has a way to the castle
    const bad = [];
    for (let f = 0; f < CORE.FOLIOS.length; f++) { const S = CORE.init(1); S.folio = f; const F = CORE.flow(S); const cut = F.src.filter((c, k) => !(k & 1) && F.dist[c] >= 1e9).length; if (cut || !F.src.length) bad.push(`folio ${f}: ${cut} of ${F.src.length / 2} entrances cut off`); }
    check(!bad.length, 'every folio’s horde can reach the castle from every entrance', bad.join('; '));
  }
  {
    // no rabbit is lost or made: every rabbit that came in is slain, gone home from the wall, or still on the land
    const S = CORE.init(4); S.lv = { snail: 3, treb: 1, keep: 1 }; S.folio = 4; S.ch = 1;
    CORE.act(S, 'run'); for (const t of S.tw) { const at = t.t === 'snail' ? -1 : CORE.bestSpot(S, t); if (at >= 0) CORE.act(S, 'place', t.id, at); }
    let worst = 0, k = 0;
    for (; k < 1500 && S.phase === 'run'; k++) { if (S.prep) CORE.act(S, 'go'); CORE.step(S, .1); if (k === 200) { const th = CORE.thick(S, 0); if (th) CORE.act(S, 'dragon', [th.x - 40, th.y], [th.x + 40, th.y]); } if (S.phase !== 'run') break; worst = Math.max(worst, Math.abs(S.came - (S.runKills + S.runFed + S.onMap))); }
    check(worst === 0, `the horde is conserved through waves with engines and the dragon (off by at most ${worst})`);
  }
  {
    // a folio always ends, even with nobody defending and the strongest wall, and a lost one starts over
    const S = CORE.init(2); S.lv = { wall: 3, wall2: 2, wall3: 2 }; S.folio = 11; S.ch = 3; CORE.act(S, 'run'); for (const t of S.tw) t.at = -1;
    let t = 0; while (S.phase === 'run' && t < 900) { if (S.prep) CORE.act(S, 'go'); CORE.step(S, .5); t += .5; }
    check(S.phase === 'tree' && S.folio === 11 && S.lostHere === 1, `an undefended folio is lost in ${t.toFixed(0)} s and waits to be played again`);
    CORE.act(S, 'run'); check(S.wave === 0 && S.prep === 1 && S.wall === S.wallMax, 'it starts again at the first wave with a whole wall');
  }
  {
    // the pause between waves: the next wave comes by itself, and calling it early pays
    const S = CORE.init(3); S.lv = { monk1: 1, arrow: 3, wall: 3 }; CORE.act(S, 'run'); for (const t of S.tw) CORE.act(S, 'place', t.id, CORE.bestSpot(S, t));
    CORE.act(S, 'go'); let k = 0; while (!S.prep && k++ < 600) CORE.step(S, .1);
    const leaf = S.leaf; check(S.prep && S.called === 1 && CORE.act(S, 'go') && S.leaf > leaf && S.wave === 1, 'once a wave is all in, the next can be called early, for leaf');
    while (!S.prep && k++ < 1200) CORE.step(S, .1); k = 0; while (S.prep && k++ < 200) CORE.step(S, .1);
    check(S.wave === 2 && k * .1 <= CORE.P.prep + .2, `left alone, the next wave comes by itself after ${(k * .1).toFixed(1)} s`);
  }
  {
    // no farming: the bots never need more than four lost runs on one folio
    for (const bot of ['eager', 'casual']) { const r = KIT.simulate(CORE, bot, { seed: 2, minutes: 150 }); check(r.done && r.S.maxLost <= 4, `the ${bot} bot never loses a folio more than four times (worst ${r.S.maxLost})`); }
  }
}

/* ---------------- browser ---------------- */
if (suites.includes('browser')) {
  section('browser');
  let chromium = null;
  try { ({ chromium } = await import('playwright')); } catch (e) {
    for (const p of ['/opt/node22/lib/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright/index.mjs']) { if (!chromium && existsSync(p)) try { ({ chromium } = await import(p)); } catch (e2) {} }
  }
  if (!chromium) console.log('  skip  (no Playwright)');
  else {
    // serve the repository ourselves, so the suite needs nothing running
    const http = await import('http');
    const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
    const srv = http.createServer((q, s) => { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f)); });
    await new Promise(r => srv.listen(0, r));
    const base = `http://127.0.0.1:${srv.address().port}/games/contents_may_vary.html`;
    const launch = process.env.HTTPS_PROXY ? { args: [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] } : {};
    const b = await chromium.launch(launch);
    const page = async (q, w = 390, h = 844) => { const p = await b.newPage({ viewport: { width: w, height: h } }); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(m.text())); await p.goto(base + (q || '')); return p; };
    const until = async (p, fn, ms = 15000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
    {
      const p = await page('');
      await p.evaluate(() => localStorage.clear()); await p.reload();
      check(await until(p, () => !document.querySelector('#title').hidden), 'a first visit shows the title box');
      await p.click('#tGo');
      check(await until(p, () => CMV.state === 'playing'), 'opening it lands in box 1');
      const stack = worlds.filter(w => !w.draft);
      check(await p.evaluate(() => CMV.save.current) === stack[0].id, `box 1 is ${stack[0].id}`);
      if (stack.length > 1) {
        await p.evaluate(() => CMV._complete(CMV.live.token, null));
        check(await until(p, () => CMV.state === 'playing' && CMV.live && CMV.live.w.n === 2), 'finishing box 1 lands in box 2');
        const sv = await p.evaluate(() => CMV.save);
        check(sv.opened[0] === stack[0].id && sv.current === stack[1].id, 'the save remembers the opened box and the open one');
        await p.reload();
        check(await until(p, () => !document.querySelector('#title').hidden && /Back in the box/.test(document.querySelector('#tGo').textContent)), 'coming back offers the open box');
        check(await p.evaluate(() => !document.querySelector('#tShelf').hidden), 'the title offers the shelf once a box is opened');
        await p.click('#tShelf');
        check(await until(p, () => !document.querySelector('#shelf').hidden && document.querySelector('#title').hidden), 'the shelf button on the title opens the shelf');
        await p.click('#shClose');
        check(await until(p, () => !document.querySelector('#title').hidden && document.querySelector('#shelf').hidden), 'closing the shelf goes back to the title');
      }
      check(p.errs.length === 0, 'no errors on the way', p.errs.join(' | '));
      await p.close();
    }
    {
      // a box is left and taken up again: its state goes into the save, survives a reload, and the box comes back
      // to it as it was, at any point of the game; a box opened at the very end goes on into the next one
      const p = await page('');
      const KEY = 'cmv.save', stack = worlds.filter(w => !w.draft).map(w => w.id);
      const enterWith = async (id, state, v) => {
        // (the page saves on its way out, so the hand-made save goes in from an empty page of the same origin)
        await p.goto(base.replace(/[^/]*$/, '__blank')); await p.evaluate(([KEY, id, state, v, before]) => localStorage.setItem(KEY, JSON.stringify({ v: 1, started: Date.now(), last: Date.now(), current: id, opened: before, worlds: { [id]: { state, v, time: 60, done: false, progress: .3 } }, replay: null, settings: { sound: 0, music: 0, motion: 'full' } })), [KEY, id, state, v, stack.slice(0, Math.max(0, stack.indexOf(id)))]);
        await p.goto(base);
        if (!await until(p, () => !document.querySelector('#title').hidden && /Back in the box/.test(document.querySelector('#tGo').textContent))) return false;
        await p.click('#tGo'); return until(p, () => CMV.state === 'playing' && CMV.live && CMV.live.ready, 30000);
      };
      const inner = () => p.frames().find(f => f !== p.mainFrame() && f.url() === 'about:srcdoc');
      for (const w of worlds) {
        const { CORE, KIT } = load(w);
        // early, in the middle, and seconds before the box is opened (Starter's finale, the crop circle, the last game)
        const whole = KIT.simulate(CORE, 'eager', { minutes: 150, seed: 2 }).minutes;
        for (const at of [4, 16, whole - 8 / 60]) {
          const S = JSON.parse(JSON.stringify(KIT.simulate(CORE, 'eager', { minutes: at, seed: 2 }).S));
          if (CORE.done(S)) { fail(`${w.id}: minute ${at.toFixed(1)} is still before the end`); continue; }
          if (!await enterWith(w.id, S, CORE.version)) { fail(`${w.id}: a save from minute ${at.toFixed(1)} is offered and opens`); continue; }
          const got = await inner().evaluate(() => { const S = K.debug.state(); return { lv: S.lv, earned: S.earned, end: document.body.classList.contains('end'), hold: S.hold }; });
          check(JSON.stringify(got.lv) === JSON.stringify(S.lv) && got.earned >= S.earned - 1e-6, `${w.id}: minute ${at.toFixed(1)} comes back with everything bought and earned`, JSON.stringify(got).slice(0, 200));
          if (w.id === 'starter') check(got.end === (S.act >= 4), `${w.id}: minute ${at.toFixed(1)}: the recipe box is ${S.act >= 4 ? 'put away' : 'out'}`);
          if (w.id === 'clew') check(got.hold == null, `${w.id}: minute ${at.toFixed(1)}: nobody's thumb is on the board after a reload`);
          // and once more through the shell's own save and a reload
          await p.evaluate(() => CMV.writeSave()); await p.reload();
          await until(p, () => !document.querySelector('#title').hidden); await p.click('#tGo');
          const ok = await until(p, () => CMV.state === 'playing' && CMV.live && CMV.live.ready, 30000);
          const again = ok && await inner().evaluate(() => { const S = K.debug.state(); return { lv: S.lv, earned: S.earned }; });
          check(again && JSON.stringify(again.lv) === JSON.stringify(S.lv) && again.earned >= got.earned - 1e-6, `${w.id}: minute ${at.toFixed(1)} survives the page's own save and a reload`, JSON.stringify({ ok, again, was: got.earned }).slice(0, 300));
        }
        // the box was opened, but the page closed before the trip inside: it goes on by itself
        const end = KIT.simulate(CORE, 'eager', { minutes: 150, seed: 2 }).S;
        if (!CORE.done(end)) { fail(`${w.id}: the bot reaches the end for the resume test`); continue; }
        if (!await enterWith(w.id, JSON.parse(JSON.stringify(end)), CORE.version)) { fail(`${w.id}: an opened box is offered`); continue; }
        const n = stack.indexOf(w.id) + 1;
        check(await until(p, n => CMV.save.opened.length >= n && (CMV.state === 'empty' || (CMV.live && CMV.live.w.n === n + 1)), 30000, n), `${w.id}: a box opened just before the page closed goes on into the next one`);
      }
      check(p.errs.length === 0, 'no errors while leaving and taking up boxes', p.errs.join(' | '));
      await p.close();
    }
    for (const w of worlds) for (const [q, wd, ht] of [[`?world=${w.id}`, 390, 844], [`?world=${w.id}&at=12`, 1280, 800]]) {
      const p = await page(q, wd, ht);
      check(await until(p, () => CMV.state === 'playing'), `${w.id}: ${q} starts (${wd}×${ht})`);
      await p.waitForTimeout(1500);
      check(p.errs.length === 0, `${w.id}: ${q} runs without errors`, p.errs.join(' | '));
      await p.close();
    }
    if (worlds.find(w => w.id === 'lawn')) {
      // Keep Off the Grass learns how many blades a device can draw: fed frames that the blades make slow, it
      // thins the lawn until they are quick; fed frames that are slow for some other reason, it puts back what
      // it took and leaves it there
      const p = await page('?world=lawn');
      check(await until(p, () => CMV.state === 'playing'), 'lawn: starts for the blade count');
      const f = p.frames()[1], r = await f.evaluate(() => {
        const D = K.debug, n0 = D.blades().drawn; let t = 1e7;
        const run = (ms, frames = 121) => { for (let i = 0; i < frames; i++) { t += ms(D.blades().drawn); D.watch(t); } return D.blades(); };
        let b; for (let k = 0; k < 10; k++) b = run(n => 12 + n / 2000);
        const thinned = b.drawn, quick = b.med;
        for (let k = 0; k < 4; k++) b = run(() => 40);
        return { n0, thinned, quick, after: b.drawn, lock: b.lock };
      });
      check(r.thinned < r.n0 && r.quick < 24, `lawn: a device slowed by the blades gets fewer (${r.n0} → ${r.thinned}, median ${r.quick.toFixed(0)} ms)`);
      check(r.after === r.thinned && r.lock, 'lawn: frames slow for another reason do not thin it further', JSON.stringify(r));
      check(p.errs.length === 0, 'lawn: no errors while counting blades', p.errs.join(' | '));
      await p.close();
    }
    if (worlds.find(w => w.id === 'lawn')) {
      // every place Keep Off the Grass moves to is built and drawn without an error: buying a show once
      // crashed the view for a moment, between the rules moving on and the veil hiding the old place
      const p = await page('?world=lawn');
      check(await until(p, () => CMV.state === 'playing'), 'lawn: starts for the trip through its places');
      const f = p.frames()[1];
      await f.evaluate(() => { window.__frames = 0; K.loop(() => window.__frames++); });
      for (const [id, gold, site] of [['street', 0, 'street'], ['show1', 0, 'green'], ['show2', 1, 'green'], ['show3', 2, 'green'], ['show4', 3, 'green'], ['night', 4, 'field']]) {
        const ok = await f.evaluate(([id, gold]) => { const S = K.debug.state(); S.$ = 1e15; S.lv.blade = Math.max(S.lv.blade, 3); S.gold = gold; return CORE.act(S, 'buy', id); }, [id, gold]);
        const n0 = await f.evaluate(() => window.__frames);
        const moved = ok && await until(f, ([site, n0]) => K.debug.state().site === site && getComputedStyle(document.getElementById('veil')).opacity === '0' && window.__frames > n0 + 4, 120000, [site, n0]);
        check(moved, `lawn: buying ${id} moves to the ${site} and draws it`);
        check(p.errs.length === 0, `lawn: no errors on the way to ${id}`, p.errs.join(' | '));
      }
      await p.close();
    }
    {
      // stickers, return to sender and the post office: the anthology's own round, played with real input
      const stack = worlds.filter(w => !w.draft).map(w => w.id);
      const p = await page('');
      p.on('dialog', d => d.accept());
      const seed = async save => { await p.goto(base.replace(/[^/]*$/, '__blank')); await p.evaluate(s => localStorage.setItem('cmv.save', JSON.stringify(Object.assign({ v: 1, started: Date.now(), last: Date.now(), current: null, opened: [], worlds: {}, replay: null, settings: { sound: 0, music: 0, motion: 'full' } }, s))), save); await p.goto(base); await until(p, () => CMV.state === 'title'); };
      const playing = id => until(p, id => CMV.state === 'playing' && CMV.live && CMV.live.ready && CMV.live.w.id === id, 60000, id);
      // a sticker shows up once the box's state earns it, and stays in the save
      await seed({ current: stack[0] }); await p.click('#tGo');
      check(await playing(stack[0]), `stickers: ${stack[0]} opens`);
      await p.evaluate(() => { const K = CMV.win().K, S = K.debug.state(); if (CMV.live.w.id === 'starter') S.best = 10; });
      if (stack[0] === 'starter') check(await until(p, () => !!CMV.save.feats['starter.streak'] && document.querySelector('#toast').classList.contains('on'), 6000), 'stickers: earning one shows it and keeps it');
      await p.keyboard.press('Escape');
      check(await until(p, () => document.querySelectorAll('#mFeats .stk').length === 5 && !/S =>/.test(document.querySelector('#mFeats').textContent)), 'stickers: the packing slip lists the box’s five by name');
      // return to sender: tape three seams along the moving box, stamp it, and the next box opens
      await p.click('#sReturn');
      check(await until(p, () => !!CMV.ret()), 'return: the button opens the taping');
      for (let k = 0; k < 3; k++) {
        let d = await p.evaluate(() => CMV.ret()); await p.mouse.move(d.ax, d.ay); await p.mouse.down();
        for (let u = .03; u <= 1.04; u += .03) { d = await p.evaluate(() => CMV.ret()); if (!d || d.k !== k) break; await p.mouse.move(d.ax + (d.bx - d.ax) * u, d.ay + (d.by - d.ay) * u); }
        await p.mouse.up();
      }
      const d = await p.evaluate(() => CMV.ret()); check(d && d.k === 3, 'return: three seams taped');
      if (d) await p.mouse.click(d.cx, d.cy);
      check(await playing(stack[1]), 'return: stamping it sends it back and opens the next box');
      const sv = await p.evaluate(() => CMV.save);
      check(sv.skipped[0] === stack[0] && sv.opened.includes(stack[0]) && sv.feats['cmv.return'], 'return: the save keeps it as returned, with its sticker', JSON.stringify([sv.skipped, sv.opened]));
      // a wobble off the seam tears the tape and the seam starts again
      await p.keyboard.press('Escape'); await p.click('#sReturn'); await until(p, () => !!CMV.ret());
      let e = await p.evaluate(() => CMV.ret()); await p.mouse.move(e.ax, e.ay); await p.mouse.down(); await p.mouse.move(e.ax + (e.bx - e.ax) * .2, e.ay + (e.by - e.ay) * .2 + 120); await p.mouse.up();
      e = await p.evaluate(() => CMV.ret()); check(e.k === 0 && e.p === 0, 'return: straying off the seam tears it');
      await p.click('#retNo'); check(await until(p, () => CMV.state === 'playing' && !CMV.ret()), 'return: Keep it goes back into the box');
      // the post office: every box open, postage for each, perks bought, the stack repacked with a head start
      await seed({ opened: stack, worlds: Object.fromEntries(stack.map(id => [id, { state: null, v: 1, time: 1500, done: true, progress: 1 }])) });
      check(await p.evaluate(() => !document.querySelector('#tPost').hidden && CMV.save.postage === 2 * CMV.worlds.length && !!CMV.save.feats['cmv.careful']), 'post: an old finished save has its postage and stickers');
      await p.click('#tPost'); await p.click('#poPerks .perk:nth-child(2) button');
      check(await p.evaluate(() => CMV.save.perks.h === 1), 'post: postage buys a head start');
      await p.click('#poRepack');
      check(await until(p, () => CMV.state === 'title' && CMV.save.printing === 2 && !CMV.save.opened.length && CMV.save.ever.length === CMV.worlds.length), 'post: repacking starts the second printing and keeps the shelf');
      await p.click('#tGo');
      check(await playing(stack[0]), 'post: the second printing opens box 1 again');
      if (stack[0] === 'starter') check(await p.evaluate(() => CMV.win().K.debug.state().t >= 100), 'post: a fresh box starts with its head start');
      check(p.errs.length === 0, 'stickers, return and post office: no errors on the way', p.errs.join(' | '));
      await p.close();
    }
    await b.close(); srv.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
