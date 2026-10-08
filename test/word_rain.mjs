#!/usr/bin/env node
// Test suite for games/word_rain.html (Word Rain).
//
// Runs the page's DOM-free <script id="core"> block in Node. The game's promises are that a word is
// always the one you can tell apart by its first letter, that every number a player sees (score,
// multiplier, lamps, freeze) is what the rules say, that a seed deals the same storm to everyone at any
// frame rate, and that the storm rewards typing speed in order. No browser, no server.
//
//   node test/word_rain.mjs               # everything
//   node test/word_rain.mjs rules bots    # named suites only
//
// Suites: bank, waves, rules, powers, lamps, determinism, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PAGE = join(HERE, '..', 'games', 'word_rain.html');
const ALL = ['bank', 'waves', 'rules', 'powers', 'lamps', 'determinism', 'bots'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);

const html = readFileSync(PAGE, 'utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in page'); process.exit(1); }
const WR = vm.runInNewContext(m[1] + ';WR', {});

const run = (g, secs, dt = 1 / 60, each) => { for (let t = 0; t < secs && !g.over; t += dt) { const ev = g.step(dt); if (each) each(ev); } };
const clearAll = g => { while (g.words.length) { const w = g.words[0]; for (const ch of w.text) g.key(ch); } };
// a typist: cps characters a second, a half-second look at each new word
function typist(g, cps, { react = .4, errRate = 0, seed = 5 } = {}) {
  const r = WR.rng(seed); let acc = 0, wait = 0;
  return () => {
    acc = Math.min(3, acc + cps / 60);
    if (wait > 0) { wait -= 1 / 60; return; }
    while (acc >= 1) {
      acc -= 1;
      if (!g.target) {
        const w = g.words.slice().sort((a, b) => b.y - a.y)[0];
        if (!w) { acc = 0; return; }
        g.key(w.text[0]); wait = react * .5;
      } else if (r() < errRate) g.key('q'); else g.key(g.target.text[g.target.typed]);
      if (wait > 0) return;
    }
  };
}
function bot(cps, seed, opts) {
  const g = WR.create({ seed, charW: .03, aspect: 1.6 }), act = typist(g, cps, opts);
  while (!g.over && g.t < 1500) { g.step(1 / 60); act(); }
  return g;
}

const S = {
  bank() {
    const all = Object.values(WR.bank).flat(), seen = new Set();
    check(all.every(w => /^[a-z]+$/.test(w)), 'every word is lowercase a-z');
    check(all.length === new Set(all).size, 'no word twice');
    for (let len = 3; len <= 9; len++) {
      const ws = WR.bank[len] || [];
      check(ws.length >= 20, `length ${len} has 20+ words`, `has ${ws.length}`);
      check(new Set(ws.map(w => w[0])).size >= 10, `length ${len} starts with 10+ letters`);
    }
    for (const k in WR.power) for (const w of WR.power[k]) { check(!all.includes(w) && !seen.has(w), `power word ${w} is its own`); seen.add(w); check(/^[a-z]+$/.test(w), `power word ${w} is a-z`); }
  },
  waves() {
    let p = WR.spec(1);
    for (let w = 2; w <= 40; w++) {
      const s = WR.spec(w);
      check(s.gap <= p.gap && s.fall <= p.fall && s.count >= p.count && s.lo >= p.lo && s.hi >= p.hi, `wave ${w} is no easier than ${w - 1}`);
      check(s.lo <= s.hi && s.hi <= 9 && s.lo >= 3, `wave ${w} lengths sane`);
      p = s;
    }
    check(WR.spec(1).hi <= 4, 'wave 1 words are short');
    // every wave on every seed: counts, power words, one live word per first letter, room on the sky
    for (let seed = 1; seed <= 25; seed++) {
      const g = WR.create({ seed, charW: .03, aspect: 1.6 });
      const perWave = {}; let bad = '';
      const act = typist(g, 6, { react: .15 });
      while (!g.over && g.wave <= 9 && g.t < 900) {
        for (const e of g.step(1 / 60)) if (e.t === 'spawn') { const w = g.words.find(o => o.id === e.id); (perWave[g.wave] = perWave[g.wave] || []).push(w.kind); if (w.x - w.text.length * .015 < 0 || w.x + w.text.length * .015 > 1) bad = `word ${w.text} off the sky at ${w.x}`; }
        const f = g.words.map(w => w.text[0]); if (new Set(f).size !== f.length) bad = 'two live words share a first letter';
        act();
      }
      check(!bad, `seed ${seed}: spawn rules hold`, bad);
      for (const w in perWave) {
        const s = WR.spec(+w), kinds = perWave[w];
        if (g.wave === +w && kinds.length < s.count) continue; // wave in progress
        const n = k => kinds.filter(x => x === k).length;
        check(kinds.length === s.count, `seed ${seed} wave ${w} spawns ${s.count}`, `got ${kinds.length}`);
        check(n('frost') === (s.frost ? 1 : 0) && n('blast') === (s.blast ? 1 : 0) && n('thunder') === (s.thunder ? 1 : 0), `seed ${seed} wave ${w} power words match the plan`);
      }
    }
  },
  rules() {
    const g = WR.create({ seed: 3, intro: true, charW: .03, aspect: 1.6 });
    run(g, 5);
    const w = g.words[0];
    check(w && w.text === 'rain', 'the first word of a first-ever run is "rain"');
    // reference score of typing one word from combo 0: 10 a letter plus 5 a letter, multiplier 1
    g.key('r'); check(g.target === w && w.typed === 1 && g.score === 10, 'first letter locks and scores 10');
    g.key('x'); check(w.typed === 1 && g.combo === 0 && g.target === w, 'a wrong key does not move the word, breaks the combo and keeps the lock');
    g.release(); check(g.target === null && w.typed === 0, 'release lets go and forgets progress');
    const before = g.score;
    for (const ch of 'rain') g.key(ch);
    check(!g.words.includes(w), 'typing the whole word removes it');
    check(g.score === before + 40 + 4 * 5, 'a four-letter word is worth 10 a letter plus 5 a letter', `${g.score - before}`);
    check(g.key('z').some(e => e.t === 'miss' && e.id === 0), 'a key that starts nothing is a miss');
    // multiplier: x2 from the 20th correct letter on, never above 8, reset by a slip
    for (const [c, mult] of [[0, 1], [19, 1], [20, 2], [39, 2], [40, 3], [140, 8], [999, 8]]) check(WR.multOf(c) === mult, `combo ${c} is x${mult}`);
    const h = WR.create({ seed: 9, charW: .03, aspect: 1.6 });
    run(h, 16);
    let ref = 0, combo = 0;
    const act = () => { const w = h.words.slice().sort((a, b) => b.y - a.y)[0]; if (!w) return; for (const ch of w.text) { combo++; ref += 10 * WR.multOf(combo); h.key(ch); } ref += w.text.length * 5 * WR.multOf(combo); };
    const start = h.score; act(); act(); act();
    check(h.score - start === ref, 'three words score what a separate tally says', `${h.score - start} vs ${ref}`);
    // unique first letters make the lock unambiguous: key picks the only word that starts with it
    const k = WR.create({ seed: 4, charW: .03, aspect: 1.6 }); run(k, 12);
    for (const w of k.words) { const hits = k.words.filter(o => o.text[0] === w.text[0]); check(hits.length === 1, `only one live word starts with ${w.text[0]}`); }
  },
  powers() {
    const mk = () => { const g = WR.create({ seed: 12, charW: .03, aspect: 2 }); g.rest = 0; g.step(.01); g.step(1); g.words.length = 0; g.spawned = 99; g.spec.count = 99; return g; };
    const put = (g, text, kind, x, y) => { const w = { id: g.nextId++, text, kind, x, y, v: 1 / g.spec.fall, typed: 0 }; g.words.push(w); return w; };
    const type = (g, w) => { for (const ch of w.text) g.key(ch); };
    // freeze
    let g = mk(); const a = put(g, 'frost', 'frost', .5, .3), b = put(g, 'lantern', 'word', .2, .3);
    type(g, a); check(g.freeze === WR.FREEZE, 'a frost word freezes the rain for its seconds');
    const y0 = b.y; run(g, 3); check(b.y === y0, 'frozen words do not move');
    run(g, 1.5); check(b.y > y0, 'and move again once it thaws');
    g.freeze = 5; type(g, put(g, 'chill', 'frost', .7, .1)); check(g.freeze <= 6, 'freezes do not stack past six seconds');
    // blast: every word inside the radius, none outside, against brute force
    const r = WR.create({ seed: 1 }); const rng = WR.rng(77);
    for (let trial = 0; trial < 200; trial++) {
      g = mk(); g.cfg.aspect = 1 + rng() * 1.5;
      const centre = put(g, 'spark', 'blast', rng(), rng() * .9), others = [];
      for (let i = 0; i < 6; i++) others.push(put(g, ['ant', 'bat', 'cap', 'den', 'eel', 'fir'][i], 'word', rng(), rng() * .9));
      const expect = others.filter(o => Math.hypot((o.x - centre.x) * g.cfg.aspect, o.y - centre.y) < WR.BLAST_R).map(o => o.id).sort();
      type(g, centre);
      const gone = others.filter(o => !g.words.includes(o)).map(o => o.id).sort();
      if (JSON.stringify(gone) !== JSON.stringify(expect)) { fail('blast takes exactly the words inside its radius', `trial ${trial}`); break; }
      if (trial === 199) pass('blast takes exactly the words inside its radius (200 boards)');
    }
    // thunder
    g = mk(); const t = put(g, 'thunder', 'thunder', .5, .5); for (const [i, w] of ['ant', 'bat', 'cap'].entries()) put(g, w, 'word', .1 + i * .3, .2 + i * .2);
    type(g, t); check(g.words.length === 0, 'thunder clears the sky');
    check(g.stats.kills === 4 && g.lamps === g.cfg.lamps, 'and costs no lamp');
  },
  lamps() {
    const g = WR.create({ seed: 2, lamps: 6, charW: .03, aspect: 1.6 });
    const lost = []; let overs = 0;
    run(g, 400, 1 / 30, ev => ev.forEach(e => { if (e.t === 'lost') lost.push(e.lamps); if (e.t === 'over') overs++; }));
    check(g.over && overs === 1, 'an idle player loses once, and the game ends exactly once');
    check(lost.join() === '5,4,3,2,1,0', 'each word that lands costs one lamp', lost.join());
    check(g.wave === 1, 'idle players never leave wave 1');
    // landing resets the combo and lets go of a locked word
    const h = WR.create({ seed: 6, charW: .03, aspect: 1.6 }); run(h, 6);
    const w = h.words[0]; h.key(w.text[0]); check(h.target === w, 'locked');
    w.y = .999; run(h, .1); check(h.target === null && h.combo === 0 && h.lamps === 5, 'landing frees the lock, breaks the combo, costs a lamp');
    // a clear wave heals one lamp up to the number it began with
    const c = WR.create({ seed: 8, charW: .03, aspect: 1.6 }); const act = typist(c, 9, { react: .1 }); c.lamps = 4;
    let healed = 0; while (c.wave < 4 && c.t < 600) { for (const e of c.step(1 / 60)) if (e.t === 'clear' && e.heal) healed++; act(); }
    check(healed === 2 && c.lamps === 6, 'clearing a wave relights a lamp, never more than six', `healed ${healed}, lamps ${c.lamps}`);
  },
  determinism() {
    const trace = (dt, seed) => { const g = WR.create({ seed, charW: .03, aspect: 1.6 }); const texts = []; run(g, 40, dt, ev => ev.forEach(e => { if (e.t === 'spawn') texts.push(g.words.find(w => w.id === e.id).text); })); return { texts, ys: g.words.map(w => [w.text, w.y]) }; };
    const a = trace(1 / 30, 5), b = trace(1 / 120, 5), c = trace(1 / 60, 6);
    check(a.texts.join() === b.texts.join() || a.texts.slice(0, 9).join() === b.texts.slice(0, 9).join(), 'a seed deals the same words at 30 and 120 fps');
    check(a.texts.join() !== c.texts.join(), 'another seed deals another storm');
    const same = a.ys.every(([t, y]) => { const o = b.ys.find(p => p[0] === t); return o && Math.abs(o[1] - y) < .012; });
    check(a.ys.length > 0 && same, 'words are in the same place at any frame rate');
    const s1 = bot(4, 3, {}), s2 = bot(4, 3, {});
    check(s1.score === s2.score && s1.wave === s2.wave, 'the same seed and the same hands give the same night');
    check(WR.hashSeed('2026-10-08') === WR.hashSeed('2026-10-08') && WR.hashSeed('a') !== WR.hashSeed('b'), 'a date hashes to one seed');
  },
  bots() {
    const waveOf = (cps, o) => { const w = []; for (let s = 1; s <= 4; s++) w.push(bot(cps, s, o).wave); return Math.min(...w); };
    const idle = waveOf(0), slow = waveOf(1.5), mid = waveOf(3), fast = waveOf(5), quick = waveOf(8);
    console.log(`        waves reached: idle ${idle}, 18wpm ${slow}, 36wpm ${mid}, 60wpm ${fast}, 96wpm ${quick}`);
    check(idle === 1, 'a player who never types is gone in wave 1');
    check(idle < slow && slow < mid && mid < fast && fast < quick, 'faster typists get further, in order');
    check(slow >= 3, 'a hunt-and-peck beginner still sees wave 3');
    check(fast >= 12 && quick >= 17, 'a quick typist is carried deep, a very quick one deeper');
    const sloppy = waveOf(5, { errRate: .25 });
    check(sloppy < fast, 'a quarter of the keys wrong is worse than none');
    check(quick < 60, 'the storm eventually beats everyone');
  },
};

for (const name of suites) {
  if (!S[name]) { console.log(`unknown suite ${name}`); failures++; continue; }
  console.log(`# ${name}`); S[name]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
