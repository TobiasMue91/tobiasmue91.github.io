// Saltline (Fishing Game) suite. Runs the DOM-free <script id="core"> block of games/fishing.html in Node.
// The page promises things nobody can see from it: every species lives somewhere in the bay at some hour, the float
// says the truth (a strike on the bite hooks, a strike on a nibble spooks, a late one misses), a fight is won by
// timing and lost by greed or neglect, a seed and the same inputs replay exactly, saves trust nothing and the old
// page's log carries over.
// Suites: species, seed, float, strike, fight, pace, save, migrate. `node test/fishing.mjs [suite...]`
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'games', 'fishing.html'), 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block'); process.exit(1); }
const load = () => { const ctx = {}; vm.createContext(ctx); vm.runInContext(core[1] + '\nthis.S = SALT;', ctx); return ctx.S; };
const S = load();

let fails = 0, passes = 0;
const check = (ok, msg) => { if (ok) passes++; else { fails++; console.log('  FAIL ' + msg); } };
const HOURS = {d: .07, D: .3, k: .57, n: .8};

// one hooked fish of a species and size, fought by a policy with a reaction delay
function fight(id, size, react, policy, seed = 1) {
  const st = S.create({seed, W: 18}); st.fish = [];
  const sp = S.BY[id], f = S.spawn(st, true, sp, {single: 1});
  f.size = size; f.cm = Math.round(sp.len[0] + (sp.len[1] - sp.len[0]) * size);
  S.cast(st, st.boat + 6, Math.min(12, sp.depth[1])); st.line.phase = 'set'; st.line.hookY = st.line.y;
  f.state = 'bite'; st.line.fish = f.id; S.tap(st);
  let t = 0, q = [], out = null, held = 0;
  while (!out && t < 180) {
    t += S.STEP;
    q = q.filter(([a, v]) => a <= t ? (S.hold(st, v), false) : true);
    const L = st.line;
    if (L.phase === 'fight') { const w = policy(L); if (L._w !== w) { L._w = w; q.push([t + react, w]); } if (L.hold) held += S.STEP; }
    for (const e of S.step(st)) if (['land', 'snap', 'slack', 'thrown'].includes(e.type)) out = e.type;
  }
  return {out, t, held};
}
const careful = L => L.mode === 'rest', always = () => true, never = () => false;

// a person in the boat: casts ahead of a shadow, strikes `strike` s after the plunge, fights carefully
function session(seed, minutes, o = {}) {
  const st = S.create({seed, W: o.W || 18, clock: o.clock ?? .25}), R = S.rng(seed * 7 + 1);
  let t = 0, q = [], idle = 0, wait = 0; const out = {bites: 0, lands: [], loss: {}, firstBite: null, events: []};
  for (let i = 0; i < minutes * 60 / S.STEP; i++) {
    t += S.STEP;
    q = q.filter(([a, fn]) => a <= t ? (fn(), false) : true);
    const L = st.line;
    if (L.phase === 'idle' && (idle += S.STEP) > 1.5) {
      idle = 0; wait = 0;
      const c = st.fish.filter(f => f.state === 'swim' && f.x > 2 && f.x < st.W - 2), f = c[Math.floor(R() * c.length)];
      if (f) S.cast(st, f.x + f.dir * 2.5, f.y); else S.cast(st, 2 + R() * (st.W - 4), 2 + R() * 18);
    }
    if (L.phase === 'set' && !L.fish && (wait += S.STEP) > 25) S.release(st, 'bored');
    if (L.phase === 'landed' && !L._q) { L._q = 1; q.push([t + 1.5, () => S.putBack(st)]); }
    if (L.phase === 'fight') { const w = careful(L); if (L._w !== w) { L._w = w; q.push([t + .3, () => S.hold(st, w)]); } }
    for (const e of S.step(st)) {
      out.events.push(e.type);
      if (e.type === 'bite') { out.bites++; if (out.firstBite == null) out.firstBite = t; q.push([t + (o.strike ?? .3), () => S.tap(st)]); }
      if (e.type === 'land') out.lands.push(e.rec);
      if (['snap', 'slack', 'thrown'].includes(e.type)) out.loss[e.type] = (out.loss[e.type] || 0) + 1;
    }
  }
  out.st = st;
  return out;
}

const suites = {
  species() {
    check(S.SPECIES.length === 21, '21 species in the bay');
    const ids = new Set();
    for (const sp of S.SPECIES) {
      check(!ids.has(sp.id), `${sp.id}: one entry`); ids.add(sp.id);
      check(sp.depth[0] >= .5 && sp.depth[1] <= S.BED - .4 && sp.depth[0] < sp.depth[1], `${sp.id}: lives inside the water (${sp.depth})`);
      check(/^[dDkn]+$/.test(sp.t), `${sp.id}: about at some hour`);
      check(sp.len[0] > 0 && sp.len[0] < sp.len[1], `${sp.id}: a length range`);
      check(sp.win >= .45, `${sp.id}: a strike window a person can answer (${sp.win} s)`);
      check(['steady', 'darter', 'diver', 'jumper'].includes(sp.temper), `${sp.id}: a known temper`);
      check(S.kgOf(sp, sp.len[1]) > S.kgOf(sp, sp.len[0]), `${sp.id}: a longer fish weighs more`);
      // turns up at each hour it claims, from an empty bay
      for (const c of sp.t) {
        const st = S.create({seed: 3, W: 40, clock: HOURS[c]}); let seen = false;
        for (let k = 0; k < 4000 && !seen; k++) { st.fish = []; for (let i = 0; i < 8; i++) if (S.spawn(st, true).sp === sp) seen = true; }
        check(seen, `${sp.id}: turns up at ${c}`);
      }
    }
    // no hour leaves a band empty, and only species about at that hour are stocked
    for (const [c, clock] of Object.entries(HOURS)) {
      const st = S.create({seed: 9, W: 40, clock}), bands = new Set(st.fish.map(f => f.sp.band));
      check(bands.size >= 3, `${c}: the bay is stocked across depths (${[...bands]})`);
      check(st.fish.every(f => S.about(f.sp, clock)), `${c}: only fish about at this hour`);
    }
  },
  seed() {
    const run = seed => { const st = S.create({seed, W: 20}); const ev = []; S.cast(st, 7, 6); for (let i = 0; i < 120 * 40; i++) { for (const e of S.step(st)) { ev.push(e.type + (e.id || '')); if (e.type === 'bite') S.tap(st); } if (st.line.phase === 'fight') S.hold(st, st.line.mode === 'rest'); if (st.line.phase === 'landed') S.putBack(st); if (st.line.phase === 'idle') S.cast(st, 12, 9); } return ev.join(',') + JSON.stringify(S.save(st)); };
    check(run(5) === run(5), 'a seed and the same inputs replay exactly');
    check(run(5) !== run(6), 'another seed is another bay');
  },
  float() {
    const st = S.create({seed: 2, W: 18});
    check(S.cast(st, -5, 99) && st.line.x >= .6 && st.line.y <= S.BED - .5, 'a cast past the edge lands in the bay');
    let set = false; for (let i = 0; i < 120 * 6 && !set; i++) for (const e of S.step(st)) if (e.type === 'set') set = true;
    check(set && Math.abs(st.line.hookY - st.line.y) < 1e-9, 'the hook settles exactly at the depth the stop is set to');
    check(S.tap(st) === 'twitch' && st.line.twitch > 0, 'a tap with nothing on twitches the bait');
    S.release(st, 'x'); check(st.line.phase === 'idle', 'the float can be reeled home');
    // only one fish at a time goes for the hook, and it comes to the hook's depth
    const s2 = session(11, 3); check(s2.bites > 4, `fish come to the hook (${s2.bites} bites in 3 min)`);
  },
  strike() {
    const setup = (state, t) => {
      const st = S.create({seed: 4, W: 18}); st.fish = [];
      const f = S.spawn(st, true, S.BY.bass, {single: 1});
      S.cast(st, 8, 5); st.line.phase = 'set'; st.line.hookY = 5; f.state = state; f.t = t; f.gap = 1; f.nibbles = 1; f.win = f.sp.win; st.line.fish = f.id;
      return {st, f};
    };
    { const {st} = setup('bite', .1); check(S.tap(st) === 'hook' && st.line.phase === 'fight', 'a tap on the bite hooks'); }
    { const {st} = setup('nibble', .1); S.tap(st); const ev = S.step(st).map(e => e.type); check(ev.includes('spook'), 'what a tap does between steps reaches the page with the next step (the "Too soon")'); }
    { const {st} = setup('bite', .1); S.tap(st); check(S.step(st).some(e => e.type === 'hook'), 'the strike that hooks is heard'); }
    { const {st, f} = setup('nibble', .1); check(S.tap(st) === 'early' && f.state === 'flee' && st.line.phase === 'set', 'a tap on a nibble spooks the fish and leaves the float out'); }
    { const {st, f} = setup('bite', 0); let missed = false; for (let i = 0; i < 120 * 2 && !missed; i++) for (const e of S.step(st)) if (e.type === 'missed') missed = true;
      check(missed && f.state === 'flee' && S.tap(st) !== 'hook', 'a bite left unanswered past its window is lost'); }
    // the window is exactly the species' window
    for (const sp of S.SPECIES) {
      const st = S.create({seed: 1, W: 18}); st.fish = []; const f = S.spawn(st, true, sp, {single: 1});
      S.cast(st, 8, 5); st.line.phase = 'set'; st.line.hookY = 5; f.state = 'wait'; f.t = 0; f.gap = 0; f.nibbles = 0; st.line.fish = f.id;
      let bitAt = null, open = 0;
      for (let i = 0; i < 120 * 3; i++) { for (const e of S.step(st)) if (e.type === 'bite') bitAt = i; if (f.state === 'bite') open++; }
      check(bitAt !== null && Math.abs(open * S.STEP - sp.win) < 2 * S.STEP, `${sp.id}: the bite stays open ${sp.win} s (${(open * S.STEP).toFixed(3)})`);
    }
  },
  fight() {
    for (const sp of S.SPECIES) {
      let ok = 0, slow = 0, greedy = 0, lazy = 0, dur = 0;
      for (let s = 1; s <= 8; s++) {
        const a = fight(sp.id, 1, .3, careful, s); if (a.out === 'land') { ok++; dur += a.t; }
        if (fight(sp.id, 1, .6, careful, s).out === 'land') slow++;
        if (fight(sp.id, 1, .1, always, s).out === 'land') greedy++;
        if (fight(sp.id, .5, .1, never, s).out === 'land') lazy++;
      }
      check(ok === 8, `${sp.id}: a careful angler lands the biggest every time (${ok}/8)`);
      check(slow >= 6, `${sp.id}: so does a slow one, mostly (${slow}/8)`);
      check(dur / 8 < 50, `${sp.id}: the fight lasts under a minute (${(dur / 8).toFixed(0)} s)`);
      check(lazy === 0, `${sp.id}: a fish left on a slack line works free (${lazy}/8)`);
      if (S.strength({sp, size: 1}) >= .75) check(greedy <= 2, `${sp.id}: reeling through every run snaps the line (${greedy}/8 landed)`);
      if (S.strength({sp, size: 1}) <= .35) check(greedy === 8, `${sp.id}: a small fish can simply be wound in (${greedy}/8)`);
    }
    // a jumper held through its leap throws the hook
    let thrown = 0;
    for (let s = 1; s <= 12; s++) {
      const st = S.create({seed: s, W: 18}); st.fish = []; const f = S.spawn(st, true, S.BY.garfish, {single: 1});
      S.cast(st, st.boat + 7, 3); st.line.phase = 'set'; st.line.hookY = 3; f.state = 'bite'; st.line.fish = f.id; S.tap(st);
      for (let i = 0; i < 120 * 40 && st.line.phase === 'fight'; i++) {
        S.hold(st, st.line.mode === 'rest' || st.line.mode === 'air');
        for (const e of S.step(st)) if (e.type === 'thrown') thrown++;
      }
    }
    check(thrown >= 6, `holding a leaping garfish throws the hook (${thrown}/12)`);
    // load only ever comes from the fish and the reel: a fight held still neither snaps nor lands
    const r = fight('cod', 1, .1, never, 3); check(r.out === 'slack' && r.held === 0, 'a fish never reeled is lost to slack, not to a snap');
  },
  pace() {
    let first = [], lands = 0, species = new Set(), losses = 0, early = 0;
    for (let s = 1; s <= 8; s++) {
      const r = session(s, 6); first.push(r.firstBite ?? 999); lands += r.lands.length; r.lands.forEach(x => species.add(x.id));
      losses += Object.values(r.loss).reduce((a, b) => a + b, 0);
    }
    first.sort((a, b) => a - b);
    check(first[4] < 25, `the first bite comes inside half a minute (median ${first[4].toFixed(1)} s)`);
    check(lands / 8 >= 6 && lands / 8 <= 24, `a careful angler lands one to four fish a minute (${(lands / 8).toFixed(1)} in 6 min)`);
    check(species.size >= 8, `a morning's fishing meets many species (${species.size})`);
    // a late hand misses most bites
    const late = session(1, 6, {strike: .8}); check(late.lands.length <= 2, `striking a second late lands almost nothing (${late.lands.length})`);
    // a whole day turns up every hour's fish: run the clock round
    const day = new Set(); for (let s = 1; s <= 3; s++) { const r = session(s, 10, {W: 40, clock: 0}); r.lands.forEach(x => day.add(x.id)); }
    check(day.size >= 9, `ten minutes from dawn to night logs about ten species (${day.size})`);
  },
  save() {
    const st = S.create({seed: 1}); st.journal = {cod: {n: 2, best: 90}}; st.total = 2; st.clock = .42;
    const back = S.create({seed: 2, save: JSON.parse(JSON.stringify(S.save(st)))});
    check(JSON.stringify(back.journal) === JSON.stringify(st.journal) && back.total === 2 && Math.abs(back.clock - .42) < 1e-3, 'a save comes back exactly');
    const evil = S.create({seed: 1, save: {clock: 'x', total: -5, journal: {cod: {n: 1e12, best: 9999}, kraken: {n: 3, best: 10}, tuna: {n: 0, best: 200}, ling: 'x', __proto__: {n: 1}}}});
    check(evil.journal.cod.n === 1e6 && evil.journal.cod.best === S.BY.cod.len[1], 'a lying count and record are clamped');
    check(!evil.journal.kraken && !evil.journal.tuna && !evil.journal.ling, 'unknown species, empty entries and junk are dropped');
    check(evil.total >= 1e6 && Number.isFinite(evil.clock), 'the total is never below the log, the clock stays a number');
    for (const junk of [null, 5, 'x', [], {journal: null}]) check(S.create({seed: 1, save: junk}).total === 0, `a save of ${JSON.stringify(junk)} starts fresh`);
    // landing logs, firsts and bests the way the card says
    const s2 = session(2, 4), j = s2.st.journal, n = Object.values(j).reduce((a, b) => a + b.n, 0);
    check(n === s2.lands.length && s2.st.total === n, 'every landing is logged once');
    const firsts = s2.lands.filter(r => r.first).length; check(firsts === Object.keys(j).length, 'each species is "new" exactly once');
    check(s2.lands.every(r => !r.best || r.cm > r.prev), 'a personal best always beats the old one');
  },
  migrate() {
    const m = S.migrate({coins: 50, landed: 14, muted: true, up: {line: 2}, log: {mackerel: {n: 3, rec: 47}, anchovy: {n: 4, rec: 12}, tuna: {n: 1, rec: 170}, sword: {n: 'x'}, oarfish: {n: 2, rec: 9999}, bass: {n: 5, rec: 40}}});
    check(m.journal.mackerel.n === 3 && m.journal.mackerel.best === S.BY.mackerel.len[1], 'the old mackerel log carries over, its record clamped to this bay');
    check(m.journal.tuna.best === 170 && m.journal.oarfish.n === 2, 'tuna and oarfish carry over');
    check(!m.journal.anchovy && !m.journal.bass && !m.journal.sword, 'species with no place here (and a forged count) do not');
    check(m.total === 14 && m.prefs.muted === true && m.prefs.taught === 1, 'fish landed and the mute choice carry over, and the title is skipped');
    check(S.migrate(null) === null && S.migrate('x') === null, 'no old save, no migration');
    const st = S.create({seed: 1, save: m}); check(st.journal.tuna.n === 1 && st.total === 14, 'the migrated save loads');
  },
};

const pick = process.argv.slice(2).filter(a => suites[a]);
for (const name of pick.length ? pick : Object.keys(suites)) { const f0 = fails; suites[name](); console.log(`${name}: ${fails === f0 ? 'ok' : 'FAILED'}`); }
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
