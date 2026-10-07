#!/usr/bin/env node
// Test suite for games/backgammon.html.
//
// Runs the page's DOM-free <script id="core"> block in Node. Backgammon's rules have more corners than they
// look: the duty to play as many dice as you can (and the bigger one if only one fits), the bar before
// anything else, bearing off with a higher die only from the rearmost point, gammons and backgammons.
// A second, independently written move generator (own-side coordinates, immutable positions, every dice
// order) must agree with the core on every roll of thousands of positions. No browser, no server.
//
//   node test/backgammon.mjs            all suites
//   node test/backgammon.mjs rules ai   named suites: setup rules ref score save undo ai

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'backgammon.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core');
const W = 1, B = -1;

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };
const want = process.argv.slice(2);
const suites = {};
const suite = (name, fn) => { suites[name] = fn; };

// a hand-made position: counts by point for each colour, then bars and borne off
function pos(w, b, o = {}) {
  const s = Core.newGame({seed: o.seed || 1});
  s.pts = new Array(25).fill(0);
  for (const [p, k] of Object.entries(w)) s.pts[p] += k;
  for (const [p, k] of Object.entries(b)) s.pts[p] -= k;
  s.bar = o.bar || [0, 0]; s.off = o.off || [0, 0];
  let cw = s.bar[0] + s.off[0], cb = s.bar[1] + s.off[1];
  for (let p = 1; p <= 24; p++) { if (s.pts[p] > 0) cw += s.pts[p]; else cb -= s.pts[p]; }
  s.off[0] += 15 - cw; s.off[1] += 15 - cb;                        // whatever is not on the board is home already
  s.turn = o.turn || W; s.phase = 'move'; s.dice = o.dice; s.left = o.dice.length === 2 && o.dice[0] === o.dice[1] ? o.dice.concat(o.dice) : o.dice.slice();
  return s;
}
const mv = (s) => Core.legal(s).map(m => `${m.from}>${m.to}/${m.die}`).sort();
const has = (s, f, t, d) => Core.legal(s).some(m => m.from === f && m.to === t && m.die === d);

suite('setup', () => {
  const s = Core.newGame({seed: 5});
  const cnt = c => s.pts.filter(v => v * c > 0).reduce((a, v) => a + Math.abs(v), 0);
  ok(cnt(W) === 15 && cnt(B) === 15, 'fifteen checkers each');
  ok(Core.pip(s, W) === 167 && Core.pip(s, B) === 167, 'both sides start at 167 pips');
  ok(s.pts[24] === 2 && s.pts[13] === 5 && s.pts[8] === 3 && s.pts[6] === 5, 'white starts on 24/13/8/6');
  ok(s.pts[1] === -2 && s.pts[12] === -5 && s.pts[17] === -3 && s.pts[19] === -5, 'black is the mirror image');
  // the opening roll: higher die opens, ties roll again
  let firsts = [0, 0];
  for (let seed = 1; seed <= 300; seed++) {
    const g = Core.newGame({seed}), r = Core.opening(g);
    const last = r[r.length - 1];
    ok(last[0] !== last[1], 'the last opening roll is not a tie');
    ok(r.slice(0, -1).every(x => x[0] === x[1]), 'only ties are rolled again');
    ok(g.turn === (last[0] > last[1] ? W : B), 'the higher die opens');
    ok(g.left.length === 2 && g.left[0] === last[0] && g.left[1] === last[1], 'the opener plays both dice');
    firsts[g.turn === W ? 0 : 1]++;
  }
  ok(firsts[0] > 110 && firsts[1] > 110, 'both sides open about as often');
  // dice are fair and a seed is the same run
  const cs = [0, 0, 0, 0, 0, 0, 0], g = Core.newGame({seed: 9});
  for (let i = 0; i < 6000; i++) cs[Core.rollDie(g)]++;
  ok(cs.slice(1).every(k => k > 850 && k < 1150), 'dice are fair');
  const a = Core.newGame({seed: 77}), b = Core.newGame({seed: 77});
  ok(Array.from({length: 40}, () => Core.rollDie(a)).join() === Array.from({length: 40}, () => Core.rollDie(b)).join(), 'a seed is the same dice');
  Core.roll(a); ok(a.left.length === (a.dice[0] === a.dice[1] ? 4 : 2), 'doubles give four moves');
});

suite('rules', () => {
  // hitting, blocking
  let s = pos({13: 2}, {10: 1, 9: 2}, {dice: [3, 4]});
  ok(has(s, 13, 10, 3), 'a lone opposing checker can be hit');
  ok(!has(s, 13, 9, 4), 'two checkers make a point you cannot land on');
  const t = Core.clone(s); Core.play(t, {from: 13, to: 10, die: 3});
  ok(t.pts[10] === 1 && t.bar[1] === 1, 'a hit puts the blot on the bar');
  // the bar comes first
  s = pos({13: 2, 6: 3}, {20: 2}, {dice: [3, 5], bar: [1, 0]});
  ok(mv(s).every(m => m.startsWith('bar')), 'with a checker on the bar nothing else moves');
  ok(has(s, 'bar', 22, 3) && has(s, 'bar', 20, 5) === false, 'entering from the bar lands on 25 - die, and a made point blocks');
  s = pos({13: 2}, {22: 2, 20: 2}, {dice: [3, 5], bar: [1, 0]});
  ok(mv(s).length === 0, 'a closed entry means no move at all');
  s = pos({13: 2}, {}, {turn: B, dice: [2, 6], bar: [0, 1]});
  ok(has(s, 'bar', 2, 2) && has(s, 'bar', 6, 6), 'black enters on the die itself');
  // bearing off
  s = pos({6: 2, 5: 1, 3: 1}, {}, {dice: [6, 1]});
  ok(has(s, 6, 'off', 6) && !has(s, 5, 'off', 6), 'a six bears off from the six; the five may only go on with a higher die when nothing is behind');
  s = pos({5: 2, 3: 1}, {}, {dice: [6, 1]});
  ok(has(s, 5, 'off', 6), 'a higher die bears off from the rearmost point');
  ok(!has(pos({5: 1, 3: 1}, {}, {dice: [4, 4]}), 3, 'off', 4), 'a higher die may not bear off a forward checker while a rearmost one is behind it');
  s = pos({8: 1, 3: 1}, {}, {dice: [3, 5]});
  ok(!mv(s).some(m => m.includes('off')), 'no bearing off while a checker is outside the home board');
  s = pos({}, {}, {dice: [1, 2], bar: [1, 0]}); s.pts[3] = 1; s.off = [13, 0]; s.pts[1] = -15; s.off[1] = 0;
  s = pos({3: 1}, {1: 2}, {dice: [3, 4], bar: [1, 0]});
  ok(!mv(s).some(m => m.includes('off')), 'no bearing off with a checker on the bar');
  // black mirrors it
  s = pos({}, {19: 1, 22: 1}, {turn: B, dice: [6, 3]});
  ok(has(s, 19, 'off', 6) && has(s, 22, 'off', 3), 'black bears off from 19..24');
  // both dice must be played if they can; the bigger if only one can
  s = pos({6: 1}, {5: 2, 4: 2, 3: 2, 1: 2, 2: 2}, {dice: [1, 5]});
  ok(mv(s).length === 0, 'blocked on both dice: no move');
  s = pos({8: 1}, {6: 2, 4: 2, 2: 2}, {dice: [2, 4]});
  ok(mv(s).length === 0, 'both dice blocked');
  s = pos({13: 1}, {12: 2, 8: 2, 11: 2, 10: 2, 9: 2, 7: 2, 4: 1}, {dice: [1, 4]});
  ok(mv(s).length === 0, 'blocked');
  s = pos({13: 1, 20: 1}, {12: 2, 10: 2, 9: 2, 8: 2, 7: 2}, {dice: [1, 6]});
  const lg = Core.legal(s); ok(lg.length > 0, 'something can be played');
  // only one die can be played (the 2 steps on, the 5 then lands on a made point): it must be the larger when both would do
  s = pos({6: 1}, {2: 2, 4: 2}, {dice: [2, 5]});
  ok(mv(s).join() === '6>1/5', 'if only one die can be played it is the larger');
  s = pos({6: 1}, {1: 2, 4: 2}, {dice: [2, 5]});
  ok(mv(s).join() === '6>1/5'.replace('1/5', '4/2').replace('>4', '>4') || has(s, 6, 4, 2) === false, 'a blocked die is simply not played');
  // playing the smaller first must not be allowed when it kills the larger die
  s = pos({24: 1}, {20: 2, 21: 2, 22: 2, 19: 2, 23: 1}, {dice: [3, 6]});
  const lg2 = Core.legal(s); ok(lg2.every(m => m.from !== 24 || m.die !== 3 || has(s, 24, 21, 3) === false), 'blocked 3 is not offered');
  // an order that uses both dice beats one that uses one
  s = pos({13: 1}, {10: 2, 7: 1}, {dice: [3, 6]});
  ok(has(s, 13, 7, 6) && !has(s, 13, 10, 3), 'the order that lets both dice be played is the only one offered');
  // doubles: four moves, and the same die counts down
  s = pos({13: 2}, {}, {dice: [2, 2]});
  Core.play(s, {from: 13, to: 11, die: 2}); Core.play(s, {from: 11, to: 9, die: 2});
  ok(s.left.length === 2 && Core.legal(s).length > 0, 'doubles run down from four');
  // a turn ends when no die can be played
  s = pos({13: 1}, {}, {dice: [1, 2]}); Core.play(s, {from: 13, to: 12, die: 1}); Core.play(s, {from: 12, to: 10, die: 2});
  ok(Core.turnDone(s), 'a spent roll is done');
});

// ---- a second move generator, written the other way round, to judge the core against ----
function toSide(s, c) {                                          // own coordinates: 1 = my last point, 24 = my first, 25 = bar
  const own = new Array(26).fill(0), opp = new Array(26).fill(0);
  for (let p = 1; p <= 24; p++) { const i = c === W ? p : 25 - p, v = s.pts[p] * c; if (v > 0) own[i] = v; else if (v < 0) opp[i] = -v; }
  own[25] = s.bar[c === W ? 0 : 1]; opp[25] = s.bar[c === W ? 1 : 0];
  return {own, opp, off: s.off[c === W ? 0 : 1], oppOff: s.off[c === W ? 1 : 0]};
}
const refKey = p => p.own.join(',') + '/' + p.opp.join(',') + '/' + p.off + '/' + p.oppOff;
function refMoves(p, d) {
  const out = [];
  const from = [];
  if (p.own[25] > 0) from.push(25); else for (let i = 1; i <= 24; i++) if (p.own[i] > 0) from.push(i);
  for (const f of from) {
    const t = f - d;
    if (t >= 1) {
      if (p.opp[t] > 1) continue;                                // opp[t] is the opponent's count at MY point t
      const q = {own: p.own.slice(), opp: p.opp.slice(), off: p.off, oppOff: p.oppOff};
      q.own[f]--; q.own[t]++; if (q.opp[t] === 1) { q.opp[t] = 0; q.opp[25]++; }
      out.push(q);
    } else {
      let home = p.own[25] === 0; for (let i = 7; i <= 24; i++) if (p.own[i]) home = false;
      if (!home) continue;
      let behind = false; for (let i = f + 1; i <= 24; i++) if (p.own[i]) behind = true;
      if (t === 0 || (t < 0 && !behind)) { const q = {own: p.own.slice(), opp: p.opp.slice(), off: p.off + 1, oppOff: p.oppOff}; q.own[f]--; out.push(q); }
    }
  }
  return out;
}
function refTurns(p, dice) {
  const seqs = dice[0] === dice[1] ? [[dice[0], dice[0], dice[0], dice[0]]] : [[dice[0], dice[1]], [dice[1], dice[0]]];
  let best = 0; const finals = new Map();
  const go = (q, ds, k, used) => {
    const nxt = ds.length ? refMoves(q, ds[0]) : [];
    if (!nxt.length) { if (k > best) { best = k; finals.clear(); } if (k === best) finals.set(refKey(q) + '#' + used.join(), {q, used}); return; }
    for (const r of nxt) go(r, ds.slice(1), k + 1, used.concat(ds[0]));
    // a die that cannot be played is skipped (the next one may still be)
  };
  // try all dice orders; a die with no move is dropped so the other can still be tried
  const run = (q, ds, k, used) => {
    if (!ds.length) { rec(q, k, used); return; }
    const nx = refMoves(q, ds[0]);
    if (!nx.length) { rec(q, k, used); return; }
    for (const r of nx) run(r, ds.slice(1), k + 1, used.concat(ds[0]));
  };
  const rec = (q, k, used) => { if (k > best) { best = k; finals.clear(); } if (k === best) finals.set(refKey(q) + '#' + used.join(), {q, used}); };
  for (const ds of seqs) run(p, ds, 0, []);
  let list = [...finals.values()];
  if (best === 1 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    if (list.some(x => x.used[0] === hi)) list = list.filter(x => x.used[0] === hi);
  }
  return new Set(list.map(x => refKey(x.q)));
}

suite('ref', () => {
  let positions = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = Core.newGame({seed}); Core.opening(s);
    let guard = 0;
    for (;;) {
      if (s.phase === 'roll') Core.roll(s);
      // compare the core with the reference on this very roll
      const c = s.turn, p = toSide(s, c), ref = refTurns(p, s.dice);
      const mine = new Set(Core.turns(s).map(t => refKey(toSide(t.s, c))));
      let same = ref.size === mine.size; for (const k of ref) if (!mine.has(k)) same = false;
      ok(same, `seed ${seed}: the core and the reference agree on ${s.dice} (${mine.size} vs ${ref.size})`);
      positions++;
      // play a random complete turn
      for (let k = 0; k < 8 && Core.legal(s).length; k++) { const ms = Core.legal(s); Core.play(s, ms[Math.floor(Core.rollDie(s) / 7 * ms.length)]); if (s.phase === 'over') break; }
      if (s.phase === 'over') break;
      Core.endTurn(s);
      if (++guard > 400) { ok(false, 'a random game ends'); break; }
    }
  }
  ok(positions > 2500, 'a few thousand rolls were compared (' + positions + ')');
});

suite('score', () => {
  // single
  let s = pos({1: 1}, {20: 14}, {dice: [1, 2], off: [14, 1]});
  ok(Core.legal(s).length > 0, 'the last checker can bear off');
  Core.play(s, {from: 1, to: 'off', die: 1});
  ok(s.phase === 'over' && s.result.kind === 'single' && s.score[0] === 1, 'a single game is one point');
  // gammon: loser has borne none off
  s = pos({1: 1}, {20: 15}, {dice: [1, 2], off: [14, 0]});
  Core.play(s, {from: 1, to: 'off', die: 1});
  ok(s.result.kind === 'gammon' && s.score[0] === 2, 'none borne off: a gammon, two points');
  // backgammon: still in the winner's home or on the bar
  s = pos({1: 1}, {3: 1, 20: 14}, {dice: [1, 2], off: [14, 0]});
  Core.play(s, {from: 1, to: 'off', die: 1});
  ok(s.result.kind === 'backgammon' && s.score[0] === 3, 'a checker in the winner\'s home: a backgammon, three points');
  s = pos({1: 1}, {20: 14}, {dice: [1, 2], off: [14, 0], bar: [0, 1]});
  Core.play(s, {from: 1, to: 'off', die: 1});
  ok(s.result.kind === 'backgammon', 'a checker on the bar: a backgammon');
  // black wins
  s = pos({6: 14}, {24: 1}, {turn: B, dice: [1, 2], off: [1, 14]});
  Core.play(s, {from: 24, to: 'off', die: 1});
  ok(s.result.winner === B && s.result.kind === 'single' && s.score[1] === 1, 'black scores for black');
  s = pos({21: 1, 5: 14}, {24: 1}, {turn: B, dice: [1, 2], off: [0, 14]});
  Core.play(s, {from: 24, to: 'off', die: 1});
  ok(s.result.kind === 'backgammon', 'white left in black\'s home loses a backgammon');
  // matches
  s = Core.newGame({seed: 1, target: 3, score: [2, 1]}); ok(Core.matchWinner(s) === 0, 'no match winner short of the target');
  s.score = [3, 1]; ok(Core.matchWinner(s) === W, 'white wins the match at the target'); s.score = [2, 4]; ok(Core.matchWinner(s) === B, 'black too');
});

suite('undo', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const s = Core.newGame({seed}); Core.opening(s);
    for (let t = 0; t < 30 && s.phase !== 'over'; t++) {
      if (s.phase === 'roll') Core.roll(s);
      const before = Core.key(s) + JSON.stringify(s.bar) + s.turn;
      const k0 = Core.clone(s);
      let moved = 0;
      while (Core.legal(s).length && moved < 3) { const ms = Core.legal(s); Core.play(s, ms[(seed + moved) % ms.length]); moved++; if (s.phase === 'over') break; }
      if (s.phase === 'over') break;
      for (let i = 0; i < moved; i++) Core.undo(s);
      ok(Core.key(s) === Core.key(k0) && JSON.stringify(s.bar) === JSON.stringify(k0.bar) && s.off.join() === k0.off.join(), `undo restores the position (seed ${seed})`);
      // and then play the turn out
      while (Core.legal(s).length) { const ms = Core.legal(s); Core.play(s, ms[0]); if (s.phase === 'over') break; }
      if (s.phase !== 'over') Core.endTurn(s);
    }
  }
  // reach: every offered destination is real, and walking it plays legal moves
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = Core.newGame({seed}); Core.opening(s);
    for (let t = 0; t < 25 && s.phase !== 'over'; t++) {
      if (s.phase === 'roll') Core.roll(s);
      for (const from of new Set(Core.legal(s).map(m => m.from))) for (const r of Core.reach(s, from)) {
        const u = Core.clone(s); let good = true;
        for (const m of r.seq) { if (!Core.legal(u).some(x => x.from === m.from && x.to === m.to && x.die === m.die)) good = false; else Core.play(u, m); }
        ok(good && r.seq[r.seq.length - 1].to === r.to, 'a reach path is a legal run of moves'); checked++;
      }
      while (Core.legal(s).length) { const ms = Core.legal(s); Core.play(s, ms[seed % ms.length]); if (s.phase === 'over') break; }
      if (s.phase !== 'over') Core.endTurn(s);
    }
  }
  ok(checked > 500, 'many reach paths were walked (' + checked + ')');
  const s = pos({24: 1}, {}, {dice: [3, 3]});
  ok(Core.reach(s, 24).map(r => r.to).sort((a, b) => b - a).join() === '21,18,15,12', 'doubles reach up to four steps along');
});

suite('save', () => {
  const s = Core.newGame({seed: 3, target: 5}); Core.opening(s);
  const t = Core.load(Core.save(s));
  ok(t && Core.key(t) === Core.key(s) && t.target === 5 && t.turn === s.turn, 'a save comes back');
  // carries on identically
  const a = Core.load(Core.save(s)), b = Core.clone(s);
  for (let i = 0; i < 20; i++) {
    for (const g of [a, b]) { if (g.phase === 'roll') Core.roll(g); const ms = Core.legal(g); while (Core.legal(g).length) Core.play(g, Core.legal(g)[0]); if (g.phase !== 'over') Core.endTurn(g); }
  }
  ok(Core.key(a) === Core.key(b) && a.rng === b.rng, 'a restored game plays on dice for dice');
  ok(Core.load('nonsense') === null && Core.load('{}') === null, 'rubbish is refused');
  const bad = JSON.parse(Core.save(s)); bad.pts[6] = 9; ok(Core.load(JSON.stringify(bad)) === null, 'a save with the wrong number of checkers is refused');
  const bad2 = JSON.parse(Core.save(s)); bad2.left = [9]; ok(Core.load(JSON.stringify(bad2)) === null, 'a die that is not a die is refused');
  const bad3 = JSON.parse(Core.save(s)); bad3.phase = 'x'; ok(Core.load(JSON.stringify(bad3)) === null, 'an unknown phase is refused');
});

suite('ai', () => {
  const game = (lw, lb, seed) => {
    const s = Core.newGame({seed}); Core.opening(s); let turns = 0;
    for (;;) {
      if (s.phase === 'roll') Core.roll(s);
      const mv2 = Core.plan(s, s.turn === W ? lw : lb);
      for (const m of mv2) { ok(Core.legal(s).some(x => x.from === m.from && x.to === m.to && x.die === m.die), 'the computer only plays legal moves'); Core.play(s, m); }
      if (s.phase === 'over') return s;
      if (Core.legal(s).length) ok(false, 'the computer used every die it could');
      Core.endTurn(s); if (++turns > 800) { ok(false, 'a game ends'); return s; }
    }
  };
  const rate = (a, b, N) => { let w = 0; for (let i = 0; i < N; i++) { const r = i % 2 ? game(a, b, 100 + i) : game(b, a, 100 + i); if (r.result.winner === (i % 2 ? W : B)) w++; } return w / N; };
  const hr = rate('hard', 'random', 30), er = rate('easy', 'random', 30);
  ok(hr >= 0.95, `hard beats random almost always (${hr})`);
  ok(er >= 0.7, `even easy beats random (${er})`);
  const he = rate('hard', 'easy', 60), me = rate('medium', 'easy', 60), hm = rate('hard', 'medium', 80);
  ok(he >= 0.62, `hard beats easy (${he})`);
  ok(me >= 0.55, `medium beats easy (${me})`);
  ok(hm >= 0.52, `hard is not weaker than medium (${hm})`);
  // it hits when hitting is free, and does not leave a blot to a double-digit shot for nothing
  const s = pos({24: 2, 6: 5, 8: 3, 13: 5}, {2: 1, 12: 5, 17: 3, 19: 5, 1: 1}, {dice: [4, 4]});
  const plan = Core.plan(s, 'hard'); ok(plan.length === 4, 'it plays all four moves of a double');
  const u = Core.clone(s); for (const m of plan) Core.play(u, m);
  ok(u.bar[1] === 1 && u.pts[2] >= 2, 'with 4-4 it hits the blot on 2 and makes the point');
  // when it enters from the bar it plays the bar checker first
  const t = pos({13: 5, 6: 5, 8: 3}, {12: 5, 17: 3, 19: 5, 1: 2}, {dice: [3, 4], bar: [1, 1 - 1], turn: W}); t.off = [1, 0];
  ok(Core.plan(t, 'hard')[0].from === 'bar', 'the bar checker moves first');
});

const t0 = Date.now();
for (const [name, fn] of Object.entries(suites)) {
  if (want.length && !want.includes(name)) continue;
  const f0 = fails; fn(); console.log(`${fails === f0 ? 'ok  ' : 'FAIL'} ${name}`);
}
console.log(`${n} checks, ${fails} failed, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(fails ? 1 : 0);
