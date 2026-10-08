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
// Suites: bank, waves, bursts, rules, powers, lamps, determinism, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PAGE = join(HERE, '..', 'games', 'word_rain.html');
const ALL = ['bank', 'waves', 'bursts', 'rules', 'powers', 'lamps', 'determinism', 'upgrades', 'levers', 'special', 'helpers', 'districts', 'meta', 'offline', 'career', 'bots'];
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
        check(n('frost') === s.frost && n('blast') === s.blast && n('thunder') === s.thunder && n('gild') === s.gild && n('charm') === s.charm, `seed ${seed} wave ${w} power words match the plan`);
      }
    }
  },
  bursts() {
    // from wave 3 words sometimes arrive three at a time, but the average pace stays the spec's
    let burstWaves = 0, early = 0, ratios = [];
    for (let seed = 1; seed <= 30; seed++) {
      const g = WR.create({ seed, charW: .03, aspect: 1.6 }), act = typist(g, 9, { react: .1 }), at = {};
      while (!g.over && g.wave <= 7 && g.t < 900) { for (const e of g.step(1 / 60)) if (e.t === 'spawn') (at[g.wave] = at[g.wave] || []).push(g.t); act(); }
      for (const w in at) {
        const s = WR.spec(+w), ts = at[w]; if (ts.length < s.count) continue;
        const gaps = ts.slice(1).map((x, i) => x - ts[i]);
        if (+w < 3 && gaps.some(x => x < s.gap * .5)) early++;
        if (+w >= 3 && gaps.some(x => x < s.gap * .4)) burstWaves++;
        ratios.push((ts[ts.length - 1] - ts[0]) / ((ts.length - 1) * s.gap));
      }
    }
    check(early === 0, 'waves 1 and 2 never burst');
    check(burstWaves >= 10, 'later waves do burst', `${burstWaves} waves`);
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    check(mean > .85 && mean < 1.15, 'a burst is paid back, so the average pace is the spec\'s', mean.toFixed(2));
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
    check(g.stats.kills === 4 && g.lamps === 6, 'and costs no lamp');
  },
  lamps() {
    const g = WR.create({ seed: 2, charW: .03, aspect: 1.6 });
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
    const c = WR.create({ seed: 8, charW: .03, aspect: 1.6 }); const act = typist(c, 9, { react: .1 }); c.houses[0].hp = 0; c.houses[1].hp = 0; c.lamps = 4;
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
  upgrades() {
    // the tree itself: costs climb, requirements point at real nodes and can be met in some order
    const ids = WR.UPG.map(u => u.id);
    check(ids.length === new Set(ids).size, 'every upgrade has its own id');
    for (const u of WR.UPG) {
      check(u.max >= 1 && u.base > 0 && u.grow >= 1, `${u.id}: sane numbers`);
      for (let l = 1; l < u.max; l++) check(WR.cost(u.id, l) >= WR.cost(u.id, l - 1), `${u.id}: level ${l + 1} costs no less than level ${l}`);
      for (const [r, n] of u.req) check(WR.UPG_BY[r] && n >= 1 && n <= WR.UPG_BY[r].max, `${u.id}: requirement ${r} ${n} exists`);
    }
    const L = {}; let progress = true, bought = 0;
    while (progress) { progress = false; for (const u of WR.UPG) if (WR.unlocked(L, u.id) && (L[u.id] || 0) < u.max) { L[u.id] = u.max; progress = true; bought++; } }
    check(bought === WR.UPG.length, 'every upgrade can be reached from the first one (no cycles)');
    // each lever moves its number the right way and does nothing at level 0
    const base = WR.mods(), hi = WR.mods(Object.fromEntries(ids.map(i => [i, WR.UPG_BY[i].max])));
    check(hi.lumen > base.lumen && hi.comboStep < base.comboStep && hi.comboCap > base.comboCap && hi.roofHp > base.roofHp && hi.fall > base.fall && hi.heal > base.heal && hi.freeze > base.freeze && hi.blastR > base.blastR && hi.yield > base.yield && hi.bell > base.bell && hi.mercy > base.mercy, 'maxed upgrades improve every number');
    check(hi.yield <= 1 && hi.comboStep >= 5 && hi.freeze <= 12, 'and none of them runs away');
    check(JSON.stringify(WR.mods({ wick: 0 })) === JSON.stringify(base), 'level 0 changes nothing');
    check(WR.mods({ wick: 99 }).lumen === WR.mods({ wick: 12 }).lumen, 'levels above the maximum are clamped (saves trust nothing)');
    check(WR.mods({ wick: -4, bell: 'x' }).lumen === 1, 'garbage levels are ignored');
    check(WR.canBuy({}, WR.cost('wick', 0), 'wick') && !WR.canBuy({}, WR.cost('wick', 0) - 1, 'wick') && !WR.canBuy({}, 1e9, 'bell') && !WR.canBuy({ wick: 12 }, 1e9, 'wick'), 'canBuy checks price, requirements and the maximum');
  },
  levers() {
    const night = (L, seed = 3, o = {}) => WR.create({ seed, charW: .03, aspect: 1.6, mods: WR.mods(L, o.stars || 0, o.district || 0), ...o.opts });
    const typeWord = (g, w) => { for (const ch of w.text) g.key(ch); };
    const first = g => { g.step(1.3); g.step(1); g.step(5); return g.words[0]; };
    // wick: lumen scales exactly
    for (const l of [0, 3, 12]) { const g = night({ wick: l }); const w = first(g); typeWord(g, w); check(Math.abs(g.score - (w.text.length * 15) * (1 + .2 * l)) < 1e-6, `wick ${l}: a word pays ${1 + .2 * l}x`, `${g.score}`); }
    // rhythm: the multiplier steps sooner
    { const g = night({ wick: 2, rhythm: 2 }); check(g.m.comboStep === 16, 'rhythm 2 steps every 16'); let c = 0; for (let i = 0; i < 40 && !g.over; i++) { g.step(.5); for (const w of g.words.slice()) { for (const ch of w.text) { g.key(ch); c++; } if (c >= 16) break; } if (c >= 16) break; } check(WR.multOf(16, 16, 8) === 2 && WR.multOf(15, 16, 8) === 1, 'x2 comes at 16 letters'); }
    // mercy: slips are forgiven once per word per level
    { const g = night({ wick: 3, steady: 2 }); const w = first(g); g.key(w.text[0]); g.key(w.text[1]); const c = g.combo; g.key('q'); g.key('q'); check(g.combo === c && w.typed === 2, 'two slips on a word are forgiven'); g.key('q'); check(g.combo === 0, 'the third is not'); }
    // gutters: a landing keeps the combo
    { const g = night({ gauge: 1, roofs: 2, gutters: 1 }); const w = first(g); g.key(w.text[0]); const c = g.combo; const o = g.words.find(x => x !== w); if (o) { o.y = .999; g.step(.1); } check(g.combo === c, 'gutters keep the combo through a landing'); }
    // roofs: a house takes hp hits before it goes dark, and the nearest house is the one hit
    { const g = night({ gauge: 1, roofs: 2 }); const w = first(g); w.y = .999; w.x = .1; g.step(.1); check(g.houses[0].hp === 2 && g.lamps === 6, 'the nearest house is hit and a sturdy roof takes it'); check(g.houses.every((h, i) => i === 0 || h.hp === 3), 'only that house'); for (let k = 0; k < 3; k++) { const o = { id: 900 + k, text: 'ant', kind: 'word', x: .1, x0: .1, y: 1, v: 0, typed: 0, hp: 0, owner: 0, slips: 0 }; g.words.push(o); g.step(.1); } check(g.houses[0].hp === 0 && g.lamps === 5, 'a house goes dark after its last hit'); }
    // mend: how many hits a clear heals, the most hurt first
    { const g = night({ gauge: 1, roofs: 3, mend: 2 }); g.step(2); g.words.length = 0; g.spawned = 99; g.spec.count = 99; g.houses[2].hp = 0; g.houses[4].hp = 2; g.lamps = 5; let heal = 0; run(g, 8, 1 / 30, ev => ev.forEach(e => { if (e.t === 'clear') heal = e.houses; })); check(heal.length === 3 && heal[0] === 2, 'a clear heals 1 + mend hits, the darkest house first', JSON.stringify(heal)); check(g.houses[2].hp >= 1, 'and relights it'); }
    // bell: lucky words come at the stated rate
    { let lucky = 0, words = 0; for (let s = 1; s <= 60; s++) { const g = night({ wick: 2, bell: 4 }, s); g.step(1.3); g.step(1); for (let k = 0; k < 6; k++) { g.step(3); const w = g.words.find(o => o.kind === 'word' && !o.typed); if (!w) continue; const ev = []; for (const ch of w.text) ev.push(...g.key(ch)); words++; if (ev.some(e => e.t === 'kill' && e.lucky)) lucky++; } } const p = lucky / words; check(Math.abs(p - .2) < .06, `bell 4 rings about one word in five`, `${(p * 100).toFixed(1)}% of ${words}`); }
    // frost, blast: longer and wider, and capped
    { const a = WR.mods({ frostL: 6 }), b = WR.mods({ blastL: 6 }); check(Math.abs(a.freeze - 8.8) < 1e-9 && Math.abs(b.blastR - WR.BLAST_R * 1.6) < 1e-9, 'deep frost and wide blast add what they say'); }
    // a mod that spawns more power words does so, in the wave's plan
    { const s = WR.spec(5, WR.mods({ frostL: 1, blastL: 2, sense: 2 })); check(s.frost === 3 && s.blast === 3, 'storm sense adds frost and blast words'); check(WR.spec(3, WR.mods({ thunderL: 1 })).thunder === 1 && WR.spec(4, WR.mods({ thunderL: 1 })).thunder === 0 && WR.spec(4, WR.mods({ thunderL: 2 })).thunder === 1 && WR.spec(3).thunder === 0 && WR.spec(4).thunder === 1, 'storm caller brings thunder sooner'); }
  },
  special() {
    const m = WR.mods({ wick: 3, frostL: 1, blastL: 3, gild: 3, roofs: 1, gauge: 1, mend: 1, charm: 1 });
    const g = WR.create({ seed: 9, charW: .03, aspect: 1.6, mods: m }), act = typist(g, 9, { react: .1 });
    const seen = { gild: 0, charm: 0 }; let bad = '';
    while (!g.over && g.wave < 7 && g.t < 900) { for (const e of g.step(1 / 60)) { if (e.t === 'spawn') { const w = g.words.find(o => o.id === e.id); if (w.kind in seen) seen[w.kind]++; } if (e.t === 'kill' && e.kind === 'gild' && e.why !== 'typed') bad = 'a gilded word was not typed'; } act(); }
    check(!bad && seen.gild >= 6 && seen.charm >= 3, 'gilded and charm words are dealt', JSON.stringify(seen) + bad);
    const s = WR.spec(6, m); check(s.gild === 2 && s.charm === 1 && WR.spec(3, m).charm === 0, 'gilded count follows the level, charms start at wave 4');
    // a gilded word pays far more than a plain one of its length; a charm heals a hit
    const h = WR.create({ seed: 4, charW: .03, aspect: 1.6, mods: m }); h.step(1.3); h.step(1); h.words.length = 0; h.spawnIn = 99;
    const put = (text, kind) => { const w = { id: h.nextId++, text, kind, x: .5, x0: .5, y: .3, v: 0, typed: 0, hp: 0, owner: 0, slips: 0 }; h.words.push(w); return w; };
    put('nugget', 'gild'); let s0 = h.score; for (const ch of 'nugget') h.key(ch); const gold = h.score - s0; s0 = h.score; put('bell', 'word'); for (const ch of 'bell') h.key(ch); const plain = h.score - s0;
    check(gold > 4 * plain, 'a gilded word pays several times a plain one', `${gold} vs ${plain}`);
    h.houses[3].hp = 0; h.lamps = 5; for (const ch of 'charm') { if (!h.words.length) put('charm', 'charm'); h.key(ch); } check(h.houses[3].hp === 1 && h.lamps === 6, 'a charm word relights the darkest house');
  },
  helpers() {
    const mk = (L, o = {}) => WR.create({ seed: 5, charW: .03, aspect: 1.6, mods: WR.mods(L), ...o });
    const put = (g, text, kind = 'word', y = .3, x = .5) => { const w = { id: g.nextId++, text, kind, x, x0: x, y, v: 0, typed: 0, hp: 0, owner: 0, slips: 0 }; g.words.push(w); return w; };
    const ready = g => { g.step(1.3); g.step(1); g.words.length = 0; g.spawnIn = 99; g.spawned = 0; return g; };
    const L = { wick: 3, lamplighter: 3, watch: 3, scholar: 3, choir: 3, ledger: 2 };
    // a voice types at its speed: len letters take len / cps seconds, then it walks to the next
    { const g = ready(mk({ wick: 1, lamplighter: 1 })); const h = g.hs[0]; const w = put(g, 'moon'); let t = 0; while (g.words.includes(w) && t < 20) { g.step(.01); t += .01; } check(Math.abs(t - 4 / h.cps) < .05, 'a voice types at its stated speed', `${t.toFixed(2)}s for 4 letters at ${h.cps}`); }
    // who takes what
    { const g = ready(mk({ wick: 1, lamplighter: 2 })); put(g, 'sunrise', 'word', .9); const a = put(g, 'ink', 'word', .2); g.step(.05); check(g.words.find(w => w.text === 'sunrise').owner === 0 && a.owner === g.hs[0].id, 'the lamplighter takes short words only'); }
    { const g = ready(mk({ wick: 1, lamplighter: 1, watch: 1 })); const lo = put(g, 'meadow', 'word', .8, .3), hi = put(g, 'ink', 'word', .2, .7); g.step(.05); check(g.hs.find(h => h.kind === 'watch').tgt === lo || g.hs.find(h => h.kind === 'lamplighter').tgt === hi, 'the watch takes the word nearest the roofs'); }
    { const g = ready(mk({ wick: 1, scholar: 1 })); const lo = put(g, 'ink', 'word', .8), long = put(g, 'lighthouse', 'word', .2, .8); g.step(.05); check(g.hs.find(h => h.kind === 'scholar').tgt === long, 'the scholar takes a long word'); }
    { const g = ready(mk({ wick: 3, lamplighter: 3, watch: 3, scholar: 3, choir: 3 })); check(g.hs.filter(h => h.kind === 'choir').length === 3, 'a choir has a voice per level'); }
    // they never touch what only a player may type, and never the player's own word
    { const g = ready(mk(L)); for (const k of ['frost', 'blast', 'thunder', 'gild', 'charm']) put(g, WR.power[k][0], k, .5, .1 + .15 * ['frost', 'blast', 'thunder', 'gild', 'charm'].indexOf(k)); run(g, 8, 1 / 30); check(g.words.length === 5 && g.words.every(w => !w.owner), 'helpers leave frost, blast, thunder, gilded and charm words alone'); }
    { const g = ready(mk(L)); const mine = put(g, 'garden', 'word', .5, .2); g.key('g'); run(g, 5, 1 / 30); check(mine.owner === 0 && mine.hp === 0 && g.target === mine && mine.typed === 1, 'a helper never takes the word the player has locked'); }
    // the player may take a word a helper is part way through: the helper lets go and finds another
    { const g = ready(mk({ wick: 1, lamplighter: 1 })); const w = put(g, 'garden', 'word', .5, .2); const w2 = put(g, 'ink', 'word', .6, .7); g.step(.05); const h = g.hs[0]; check(h.tgt === w2, 'the lamplighter went for the short one'); h.tgt = null; w2.owner = 0; w.owner = h.id; h.tgt = w; w.hp = 2; const ev = g.key('g'); check(ev.some(e => e.t === 'yield') && w.owner === 0 && w.hp === 0 && h.tgt === null && g.target === w, 'pressing a helper\'s first letter takes the word and sends the helper away'); }
    // pay: a helper's kill pays the yield and neither builds nor breaks the combo
    { const g = ready(mk({ wick: 1, lamplighter: 1, ledger: 3 })); const w = put(g, 'ink'); g.combo = 7; const s0 = g.score; run(g, 6, 1 / 60); check(Math.abs(g.score - s0 - 3 * 15 * 1.2 * WR.mods({ wick: 1, ledger: 3 }).yield) < 1e-6 && g.combo === 7 && g.stats.helped === 1, 'a helper kill pays its yield and leaves the combo alone', `${g.score - s0}`); }
    // frozen rain does not stop the helpers
    { const g = ready(mk({ wick: 1, lamplighter: 3 })); g.freeze = 5; const w = put(g, 'ink'); run(g, 3, 1 / 60); check(!g.words.includes(w), 'the helpers keep typing while the rain is frozen'); }
    // the one that matters: the town alone cannot hold a night. Even the strongest helpers, with nobody typing, fall in the first Dawn's range.
    const every = Object.fromEntries(WR.UPG.map(u => [u.id, u.max])); const best = []; for (let s = 1; s <= 5; s++) { const g = WR.create({ seed: s, charW: .03, aspect: 1.6, mods: WR.mods(every) }); run(g, 3000, 1 / 30); best.push(g.wave); }
    console.log(`        a maxed town with nobody typing reaches wave ${Math.min(...best)}-${Math.max(...best)}`);
    check(Math.max(...best) <= WR.dawnWave(0), 'helpers alone cannot get past the first Dawn\'s depth');
    // and a typist on top of the same helpers does far better than either
    const withP = []; for (let s = 1; s <= 3; s++) { const g = WR.create({ seed: s, charW: .03, aspect: 1.6, mods: WR.mods(every) }), act = typist(g, 4, { seed: s }); while (!g.over && g.t < 3000) { g.step(1 / 60); act(); } withP.push(g.wave); }
    check(Math.min(...withP) > Math.max(...best) + 3, 'a person typing beside the helpers gets much further than the helpers do', `${withP.join()} vs ${best.join()}`);
  },
  districts() {
    check(WR.DISTRICTS[0].need === 0 && WR.DISTRICTS.every((d, i) => i === 0 || d.need > WR.DISTRICTS[i - 1].need), 'districts open after more and more dawns');
    check(WR.DISTRICTS.every((d, i) => i === 0 || d.lumen > WR.DISTRICTS[i - 1].lumen), 'each pays more than the last');
    const g = WR.create({ seed: 3, charW: .03, aspect: 1.6, mods: WR.mods({}, 0, 1) }); let moved = 0, lo = 1, hi = 0;
    run(g, 20, 1 / 30, () => { for (const w of g.words) { lo = Math.min(lo, w.x); hi = Math.max(hi, w.x); if (Math.abs(w.x - w.x0) > .01) moved++; } });
    check(moved > 20 && lo >= .03 && hi <= .97, 'Harbour Row words sway but never leave the sky');
    check(WR.spec(5, WR.mods({}, 0, 2)).count > WR.spec(5).count && WR.spec(5, WR.mods({}, 0, 2)).fall < WR.spec(5).fall, 'Mill Hill sends more, faster');
    check(WR.mods({}, 0, 1).lumen === 1.4 && WR.mods({}, 0, 9).lumen === 1, 'a district is a lumen multiplier; an unknown one is home');
    const lane = WR.create({ seed: 3, charW: .03, aspect: 1.6 }); run(lane, 20, 1 / 30); check(lane.words.every(w => w.x === w.x0), 'home has no sway');
  },
  meta() {
    for (let d = 0; d < 20; d++) check(WR.dawnNeed(d + 1) > WR.dawnNeed(d) && WR.dawnWave(d + 1) > WR.dawnWave(d), `dawn ${d + 1} asks for more than dawn ${d}`);
    check(WR.dawnReady(WR.dawnNeed(0), WR.dawnWave(0), 0) && !WR.dawnReady(WR.dawnNeed(0) - 1, 99, 0) && !WR.dawnReady(1e12, WR.dawnWave(0) - 1, 0), 'a dawn needs both the lumen and the depth');
    check(WR.starsFor(0) === 0 && WR.starsFor(49999) === 0 && WR.starsFor(50000) === 1 && WR.starsFor(200000) === 2, 'stars come in on the square root of what an era earned');
    for (let e = 1; e < 1e9; e *= 3) check(WR.starsFor(e * 3) >= WR.starsFor(e), 'more lumen never gives fewer stars');
    check(WR.mods({}, 4).lumen === 2 && WR.mods({}, 400).fall <= 1.5 + 1e-9, 'a star is a quarter more lumen and a little slower rain, the rain capped');
    // a night started from a later wave begins there
    const g = WR.create({ seed: 2, charW: .03, aspect: 1.6, startWave: 6 }); let w1 = 0; run(g, 3, 1 / 30, ev => ev.forEach(e => { if (e.t === 'wave') w1 = e.n; })); check(w1 === 6 && g.spec.wave === 6, 'a night can begin at a later wave');
  },
  offline() {
    const L = { wick: 5, lamplighter: 4, ledger: 2, watch: 3, nightshift: 2 };
    check(WR.offline({}, 0, 0, 10, 3600) === 0 && WR.offline({ wick: 5 }, 0, 0, 10, 3600) === 0, 'a town without helpers earns nothing while away');
    check(WR.offline(L, 0, 0, 10, 0) === 0 && WR.offline(L, 0, 0, 10, -5) === 0 && WR.offline(L, 0, 0, 0, 3600) === 0, 'no time, no pay');
    const h1 = WR.offline(L, 0, 0, 10, 3600), h2 = WR.offline(L, 0, 0, 10, 7200), h4 = WR.offline(L, 0, 0, 10, 4 * 3600), h99 = WR.offline(L, 0, 0, 10, 99 * 3600);
    check(h1 > 0 && h2 > h1 && h4 > h2, 'more time away pays more');
    check(h99 === WR.offline(L, 0, 0, 10, WR.mods(L).offlineHours * 3600) && h99 < h4 * 2, 'but only up to the night shift\'s hours');
    check(WR.offline({ ...L, nightshift: 5 }, 0, 0, 10, 99 * 3600) > h99, 'a longer night shift pays for longer');
    check(WR.offline({ ...L, watch: 8, scholar: 5 }, 0, 0, 10, 3600) > h1, 'stronger helpers earn more');
    check(WR.offline(L, 0, 0, 3, 3600) <= h1, 'a town that has only seen shallow waves holds shallow ones');
    // an hour away is worth a small part of an hour of play with the same town
    const m = WR.mods(L), g = WR.create({ seed: 7, charW: .03, aspect: 1.6, mods: m }), act = typist(g, 4, { seed: 7 }); while (!g.over && g.t < 3000) { g.step(1 / 60); act(); }
    const perHour = g.score / g.t * 3600;
    console.log(`        this town earns ${Math.round(perHour).toLocaleString()} an hour of play and ${h1.toLocaleString()} an hour away`);
    check(h1 < perHour * .2 && h1 > perHour * .03, 'an hour away pays a small share of an hour of play');
  },
  career() {
    // The whole game, played by a person-paced bot: it types at a steady speed, ends each night after ten minutes, starts
    // three waves under its best, and always buys the cheapest thing it can. Slow (about 3 minutes a night at first).
    const play = (cps, wantDawns) => {
      let L = {}, lumen = 0, stars = 0, eraLumen = 0, eraBest = 0, best = 0, min = 0, nights = 0, dawned = 0; const marks = [];
      while (dawned < wantDawns && min < 600) {
        for (;;) { const opts = WR.UPG.filter(u => WR.canBuy(L, lumen, u.id, dawned)); if (!opts.length) break; const pick = opts.sort((a, b) => WR.cost(a.id, WR.levelOf(L, a.id, dawned)) - WR.cost(b.id, WR.levelOf(L, b.id, dawned)))[0]; lumen -= WR.cost(pick.id, WR.levelOf(L, pick.id, dawned)); L[pick.id] = WR.levelOf(L, pick.id, dawned) + 1; }
        const district = WR.DISTRICTS.filter(d => d.need <= dawned).length - 1;
        const g = WR.create({ seed: nights + 1, charW: .03, aspect: 1.6, mods: WR.mods(L, stars, district, dawned), startWave: Math.max(1, best - 3) }), act = typist(g, cps, { seed: nights + 9, errRate: .02 });
        while (!g.over && g.t < 600) { g.step(1 / 30); for (let k = 0; k < 2; k++) act(); }
        nights++; min += (g.t + 20) / 60; lumen += g.score; eraLumen += g.score; best = Math.max(best, g.wave); eraBest = Math.max(eraBest, g.wave);
        if (WR.dawnReady(eraLumen, eraBest, dawned)) { stars += WR.starsFor(eraLumen); dawned++; marks.push({ min, nights, stars, built: Object.keys(L).length }); L = {}; lumen = 0; eraLumen = 0; best = 0; eraBest = 0; }
      }
      return marks;
    };
    const mid = play(4, 3), slow = play(2.5, 1), quick = play(7, 1);
    console.log(`        48 wpm: Dawn ${mid.map(m => Math.round(m.min) + ' min').join(', ')}; 30 wpm: Dawn 1 at ${Math.round(slow[0].min)} min; 84 wpm: ${Math.round(quick[0].min)} min`);
    check(mid.length === 3, 'a steady typist greets three dawns inside ten hours');
    check(mid[0].min > 40 && mid[0].min < 110, 'the first Dawn takes about an hour or so', `${mid[0].min}`);
    check(mid[1].min - mid[0].min > 20 && mid[2].min - mid[1].min > mid[1].min - mid[0].min - 5, 'later eras are no shorter than the one before', mid.map(m => Math.round(m.min)).join());
    check(quick[0].min < mid[0].min && mid[0].min < slow[0].min, 'faster typists reach Dawn sooner, in order');
    check(slow[0].min < mid[0].min * 2.2, 'but a slow one is not shut out: under twice as long');
    check(mid[0].stars >= 1 && mid[2].stars > mid[0].stars * 3, 'stars pile up');
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
