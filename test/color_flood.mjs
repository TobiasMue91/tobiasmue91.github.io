#!/usr/bin/env node
// Test suite for games/color_flood.html (Color Flood).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises things nobody can see
// from the page: that a move captures exactly what the rules say, that "par" is a number a solver really
// reached, that the ladder of 40 levels climbs, that hints lead somewhere, and that saves and streaks
// count the way the cards say. No browser, no server.
//
//   node test/color_flood.mjs                 # everything
//   node test/color_flood.mjs rules solver    # named suites only
//   node test/color_flood.mjs --page=path.html
//
// Suites: rules, deal, solver, levels, hint, bots, daily, save, page (needs Playwright's Chromium; skipped without it).

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'color_flood.html'));
const ALL = ['rules', 'deal', 'solver', 'levels', 'hint', 'bots', 'daily', 'save', 'page'];
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
vm.runInContext(core[1] + '\nthis.F = FLOOD;', ctx);
const F = ctx.F;

// A little seeded generator of our own, so a failure repeats.
let seed = 20261009;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const ri = n => Math.floor(rnd() * n);
const randomBoard = (n, k) => Uint8Array.from({length: n * n}, () => ri(k));
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const nbrs = (i, n) => { const x = i % n, y = (i / n) | 0, o = []; for (const [dx, dy] of NB) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) o.push(b * n + a); } return o; };

// Reference for one move, written the slow way round: recolour the territory, then keep adding any cell of the
// new ink that touches it until nothing changes. Returns the new cells array and the territory mask.
const refMove = (cells, n, c) => {
  const region = new Set([0]); const c0 = cells[0];
  for (let grew = true; grew;) { grew = false; for (let i = 0; i < n * n; i++) if (!region.has(i) && cells[i] === c0 && nbrs(i, n).some(j => region.has(j))) { region.add(i); grew = true; } }
  const next = Uint8Array.from(cells); for (const i of region) next[i] = c;
  for (let grew = true; grew;) { grew = false; for (let i = 0; i < n * n; i++) if (!region.has(i) && next[i] === c && nbrs(i, n).some(j => region.has(j))) { region.add(i); grew = true; } }
  return {cells: next, region};
};
// Fewest moves by breadth-first search over every position (small boards only).
const bfsOptimum = (cells, n, k) => {
  const key = st => st.cells.join('');
  const mk = cs => ({cells: cs});
  const regionOf = cs => { const r = new Set([0]); const q = [0]; for (let h = 0; h < q.length; h++) for (const j of nbrs(q[h], n)) if (!r.has(j) && cs[j] === cs[0]) { r.add(j); q.push(j); } return r; };
  const done = cs => regionOf(cs).size === n * n;
  if (done(cells)) return 0;
  let layer = [cells], seen = new Set([key(mk(cells))]);
  for (let d = 1; d < 40; d++) {
    const next = [];
    for (const cs of layer) for (let c = 0; c < k; c++) {
      if (c === cs[0]) continue;
      const m = refMove(cs, n, c).cells; if (m.join('') === cs.join('')) continue;
      if (done(m)) return d;
      const kk = m.join(''); if (!seen.has(kk)) { seen.add(kk); next.push(m); }
    }
    layer = next;
  }
  return -1;
};
const replay = (cells, n, k, moves) => {
  const st = F.newGame(cells, n, k); let legal = true;
  for (const c of moves) if (!F.play(st, c)) { legal = false; break; }
  return {st, legal};
};

// ---------------------------------------------------------------------------------------------------------
if (suites.includes('rules')) {
  section('rules: a move captures what the rules say, and nothing else');
  let bad = 0, moves = 0, zero = 0;
  for (let t = 0; t < 600; t++) {
    const n = 3 + ri(8), k = 2 + ri(5), cells = randomBoard(n, k), st = F.newGame(cells, n, k);
    for (let m = 0; m < 14 && !F.solved(st); m++) {
      const c = ri(k), before = Uint8Array.from(st.cells), ref = refMove(before, n, c);
      const peek = F.peekCount(st, c), cap = F.capture(st, c);
      const res = F.play(st, c);
      const changed = ref.cells.join('') !== before.join('');
      if (!res) { zero++; if (ref.region.size !== st.size) { bad++; fail(`board ${t} move ${m}: refused a move that would swallow cells`); } if (st.cells.join('') !== before.join('')) { bad++; fail('a refused move changed the board'); } continue; }
      moves++;
      if (st.cells.join('') !== ref.cells.join('')) { bad++; fail(`board ${t} move ${m}: cells differ from the reference`); }
      const mask = [...st.reg].map((v, i) => v ? i : -1).filter(i => i >= 0).join(), rm = [...ref.region].sort((a, b) => a - b).join();
      if (mask !== rm) { bad++; fail(`board ${t} move ${m}: territory differs from the reference`); }
      if (peek !== res.captured.length || cap.cells.length !== res.captured.length) { bad++; fail('peekCount/capture disagrees with play'); }
      if (st.size !== ref.region.size) { bad++; fail('size does not match the territory'); }
      // rings: every cell joins one ring after something already in; rings ascend; ring 1 touches the old territory
      let lastRing = 0, ok = true; const old = new Set(); for (let i = 0; i < n * n; i++) if (before[i] === before[0] && ref.region.has(i) && !res.captured.includes(i)) old.add(i);
      const ringOf = new Map(res.captured.map((i, j) => [i, res.rings[j]]));
      for (let j = 0; j < res.captured.length; j++) {
        const i = res.captured[j], r = res.rings[j]; if (r < lastRing) ok = false; lastRing = r;
        const touches = nbrs(i, n).some(q => r === 1 ? old.has(q) : ringOf.get(q) === r - 1);
        if (!touches) ok = false;
      }
      if (!ok) { bad++; fail(`board ${t} move ${m}: rings are not breadth-first from the old territory`); }
    }
    if (bad > 5) break;
  }
  check(!bad, `600 random games: ${moves} moves match a fixpoint reference, ${zero} refusals`);

  const st = F.newGame(Uint8Array.from([0, 0, 1, 1, 0, 1, 2, 2, 1]), 3, 4);
  check(F.play(st, 0) === null, 'playing the ink you already hold is refused');
  check(F.play(st, 3) === null && st.moves.length === 0 && st.cells.join('') === '001101221', 'an ink that touches nothing is refused, and costs nothing');
  const r = F.play(st, 1);
  check(r && st.moves.length === 1 && st.cur === 1 && r.from === 0, 'a real move records itself');
  let undone = 0, same = true;
  for (let t = 0; t < 200; t++) {
    const n = 4 + ri(6), k = 3 + ri(3), g = F.newGame(randomBoard(n, k), n, k), snaps = [];
    for (let m = 0; m < 8 && !F.solved(g); m++) { snaps.push([g.cells.join(''), [...g.reg].join(''), g.cur, g.size, g.moves.length]); if (!F.play(g, ri(k))) snaps.pop(); }
    while (snaps.length) { const s = snaps.pop(); F.undo(g); undone++; if (g.cells.join('') !== s[0] || [...g.reg].join('') !== s[1] || g.cur !== s[2] || g.size !== s[3] || g.moves.length !== s[4]) same = false; }
    if (F.undo(g)) same = false;
  }
  check(same, `undo restores cells, territory, ink, size and move list exactly (${undone} undos), and does nothing at the start`);
}

if (suites.includes('deal')) {
  section('deal: a seed is a board');
  let same = true, allInks = true, notSolved = true, corner = true, diff = 0, total = 0;
  for (let l = 1; l <= F.LEVELS; l++) {
    const sp = F.spec(l), a = F.deal(sp.seed, sp.n, sp.k), b = F.deal(sp.seed, sp.n, sp.k);
    if (a.join('') !== b.join('')) same = false;
    if (new Set(a).size !== sp.k) allInks = false;
    if (F.regionSize(a, sp.n) === sp.n * sp.n) notSolved = false;
    if (sp.n >= 6 && F.regionSize(a, sp.n) > Math.round(sp.n * sp.n * 0.1)) corner = false;
    if (a.some(v => v >= sp.k)) allInks = false;
    total++; if (F.deal('other-' + sp.seed, sp.n, sp.k).join('') !== a.join('')) diff++;
  }
  check(same, 'the same seed deals the same board, every time');
  check(allInks, 'every ink in play appears on every level and none outside it');
  check(notSolved, 'no level starts solved');
  check(corner, 'the corner territory never starts bigger than a tenth of the board (6x6 and up)');
  check(diff === total, 'a different seed deals a different board');
  let fine = true; for (let t = 0; t < 400; t++) { const n = 3 + ri(14), k = 2 + ri(5), c = F.deal('fuzz' + t, n, k); if (c.length !== n * n || c.some(v => v >= k)) fine = false; }
  check(fine, '400 random sizes and ink counts all deal a full board in range');
}

if (suites.includes('solver')) {
  section('solver: par is a number someone reached');
  let sound = true, tiny = 0, equal = 0, worse2 = 0, lbOk = true, exactOk = true, solveOk = true;
  for (let t = 0; t < 150; t++) {
    const n = 3 + ri(3), k = 2 + ri(3), cells = F.deal('s' + t, n, k);
    const opt = bfsOptimum(cells, n, k); if (opt < 0) continue;
    const lb = F.lowerBound(cells, n, k); if (lb > opt) { lbOk = false; fail(`board ${t}: lower bound ${lb} above the true optimum ${opt}`); }
    const G = F.graph(cells, n), ex = F.exact(G, k, 200000);
    if (!ex || ex.length !== opt) { exactOk = false; fail(`board ${t} ${n}x${n}/${k}: exact search says ${ex && ex.length}, breadth-first says ${opt}`); }
    const r = F.solve(cells, n, k), {st, legal} = replay(cells, n, k, r.moves);
    if (!legal || !F.solved(st) || r.moves.length < opt) { solveOk = false; fail(`board ${t}: solve() returned an unsound or impossible answer`); }
    const bm = F.beam(G, k, 40), bst = replay(cells, n, k, bm || []);
    if (!bm || !bst.legal || !F.solved(bst.st)) sound = false; else { tiny++; if (bm.length === opt) equal++; if (bm.length > opt + 2) worse2++; }
  }
  check(lbOk, 'the lower bound never exceeds the true optimum (150 small boards)');
  check(exactOk, 'exact search equals breadth-first search over every position');
  check(solveOk, 'solve() always replays to a solved board in legal moves, never beating the optimum');
  check(sound, 'every beam answer is a legal, finishing sequence');
  check(equal / tiny >= 0.85, `beam width 40 finds the optimum on at least 85% of small boards (${equal}/${tiny})`);
  check(worse2 === 0, 'beam width 40 is never more than two moves over the optimum on small boards');

  let big = true, shorter = 0, trials = 0;
  for (let t = 0; t < 20; t++) {
    const n = 8 + ri(8), k = 4 + ri(3), cells = F.deal('big' + t, n, k), G = F.graph(cells, n);
    const a = F.beam(G, k, 6), b = F.beam(G, k, 60), ra = replay(cells, n, k, a), rb = replay(cells, n, k, b);
    if (!ra.legal || !rb.legal || !F.solved(ra.st) || !F.solved(rb.st)) big = false;
    trials++; if (b.length <= a.length) shorter++;
    const lb = F.lowerBound(cells, n, k); if (b.length < lb) big = false;
  }
  check(big, 'on 8x8 to 15x15 boards both beams finish legally and never beat the lower bound');
  check(shorter >= trials - 2, `a wider beam is almost never worse (${shorter}/${trials})`);
}

if (suites.includes('levels')) {
  section('levels: forty boards that climb');
  const L = F.LEVELS; check(L === 40, 'forty levels');
  let ramp = true, prevN = 0, prevK = 0;
  for (let l = 1; l <= L; l++) { const sp = F.spec(l); if (sp.n < prevN || sp.k < prevK) ramp = false; prevN = sp.n; prevK = sp.k; }
  check(ramp, 'board size and ink count never go down from one level to the next');
  check(F.spec(1).n === 4 && F.spec(1).k === 3, 'the first level is 4x4 with three inks, small enough to learn by pressing');
  let replays = true, parsOk = true, lbOk = true, limitOk = true, starsOk = true; const pars = [];
  for (let l = 1; l <= L; l++) {
    const sp = F.spec(l), cells = F.deal(sp.seed, sp.n, sp.k), par = F.parOf(l), sol = F.solutionOf(l);
    pars.push(par);
    const {st, legal} = replay(cells, sp.n, sp.k, sol);
    if (!legal || !F.solved(st) || sol.length !== par) { replays = false; fail(`level ${l}: the stored solution does not solve it in ${par} moves`); }
    if (par < F.lowerBound(cells, sp.n, sp.k)) { lbOk = false; fail(`level ${l}: par ${par} is below the lower bound`); }
    const p = F.plan(par);
    if (!(p.par < p.two + 1 && p.two <= p.limit && p.limit > p.par)) limitOk = false;
    if (F.stars(p, par, false) !== 3 || F.stars(p, p.two, false) !== 2 || F.stars(p, p.limit, false) !== 1 || F.stars(p, p.limit + 1, false) !== 0 || F.stars(p, par, true) !== 2) starsOk = false;
  }
  check(replays, 'every level\'s stored solution replays move for move to a solved board, in exactly par moves');
  check(lbOk, 'no par is below what the board provably needs');
  check(limitOk && starsOk, 'par <= two-star line < limit, and 3/2/1/0 stars fall exactly on the lines; a hint caps the result at two stars');
  let climbs = true; for (let t = 0; t < 4; t++) { const a = pars.slice(t * 10, t * 10 + 10).reduce((x, y) => x + y) / 10, b = pars.slice(t * 10 + 10, t * 10 + 20).reduce((x, y) => x + y, 0) / 10; if (t < 3 && b <= a) climbs = false; }
  check(climbs, 'the average par rises from tier to tier (Pond, Lake, Sea, Ocean)');
  let mono = true; for (let l = 1; l < L; l++) if (pars[l] < pars[l - 1] - 2) mono = false;
  check(mono, 'par never drops by more than two from one level to the next');
  check(pars[0] <= 4 && pars[L - 1] >= 20, `par runs from ${pars[0]} to ${pars[L - 1]}`);
  check(F.verdict(F.plan(9), 8) === 'Under par' && F.verdict(F.plan(9), 9) === 'Par' && F.verdict(F.plan(9), 10) === 'One over', 'the verdict words follow the count');
}

if (suites.includes('hint')) {
  section('hint: it names a move that leads somewhere');
  let legal = true, finishes = 0, trials = 0, within = 0;
  for (let t = 0; t < 40; t++) {
    const n = 4 + ri(7), k = 3 + ri(3), cells = F.deal('h' + t, n, k), st = F.newGame(cells, n, k), par = F.solve(cells, n, k).moves.length;
    let guard = 0;
    while (!F.solved(st) && guard++ < 60) { const h = F.hint(st); if (h === null || F.peekCount(st, h) === 0) { legal = false; break; } F.play(st, h); }
    trials++; if (F.solved(st)) finishes++; if (F.solved(st) && st.moves.length <= par + 3) within++;
  }
  check(legal, 'a hint is always an ink that captures something');
  check(finishes === trials, 'following hints alone always finishes the board');
  check(within >= trials - 2, `following hints from the start costs at most par + 3 (${within}/${trials})`);
  const st = F.newGame(Uint8Array.from([0, 0, 0, 0]), 2, 2); check(F.hint(st) === null, 'a solved board has no hint');
}

if (suites.includes('bots')) {
  section('bots: the limit is fair, and skill is paid');
  const greedy = (cells, n, k, limit) => { const st = F.newGame(cells, n, k); for (let m = 0; m < limit && !F.solved(st); m++) { let best = -1, bc = -1; for (let c = 0; c < k; c++) { const v = F.peekCount(st, c); if (v > bc) { bc = v; best = c; } } if (bc <= 0) break; F.play(st, best); } return F.solved(st) ? st.moves.length : 0; };
  const randomBot = (cells, n, k, limit) => { const st = F.newGame(cells, n, k); for (let m = 0; m < limit && !F.solved(st); m++) { const opts = []; for (let c = 0; c < k; c++) if (F.peekCount(st, c) > 0) opts.push(c); if (!opts.length) break; F.play(st, opts[ri(opts.length)]); } return F.solved(st) ? st.moves.length : 0; };
  const tally = (lo, hi, bot) => { let won = 0, stars = 0, cnt = 0; for (let l = lo; l <= hi; l++) { const sp = F.spec(l), cells = F.deal(sp.seed, sp.n, sp.k), p = F.plan(F.parOf(l)); const mv = bot(cells, sp.n, sp.k, p.limit); cnt++; if (mv) { won++; stars += F.stars(p, mv, false); } } return {won: won / cnt, stars: stars / cnt}; };
  const gEarly = tally(1, 10, greedy), gLate = tally(21, 40, greedy);
  let rEarly = {won: 0}, rLate = {won: 0}; for (let r = 0; r < 20; r++) { const a = tally(1, 10, randomBot), b = tally(21, 40, randomBot); rEarly.won += a.won / 20; rLate.won += b.won / 20; }
  console.log(`  greedy: ponds ${(gEarly.won * 100).toFixed(0)}% won, ${gEarly.stars.toFixed(2)} stars; seas and oceans ${(gLate.won * 100).toFixed(0)}% won, ${gLate.stars.toFixed(2)} stars;  random: ponds ${(rEarly.won * 100).toFixed(0)}%, late ${(rLate.won * 100).toFixed(0)}%`);
  check(gEarly.won >= 0.8, 'a player who always takes the biggest bite clears most ponds inside the limit');
  check(gLate.won < gEarly.won + 0.001 || gLate.won < 0.9, 'greedy play is not enough later: the late levels reward planning');
  check(rLate.won < 0.35, 'a player who picks any legal ink at random mostly fails the late levels');
  check(gEarly.stars > rEarly.won * 0 + 1, 'greedy play earns more than one star on average in the ponds');
  check(rEarly.won < gEarly.won, 'random play does worse than greedy play on the early levels');
}

if (suites.includes('daily')) {
  section('daily: one board a day for everyone');
  const a = F.dailySpec('2026-10-09'), b = F.dailySpec('2026-10-09'), c = F.dailySpec('2026-10-10');
  check(a.seed === b.seed && F.deal(a.seed, a.n, a.k).join('') === F.deal(b.seed, b.n, b.k).join(''), 'a date is the same board on every device');
  check(F.deal(a.seed, a.n, a.k).join('') !== F.deal(c.seed, c.n, c.k).join().slice(0, a.n * a.n) || a.n !== c.n, 'a different day is a different board');
  const sizes = []; for (let d = 0; d < 7; d++) { const s = F.dailySpec(F.dayKey(new Date(2026, 9, 11 + d, 12))); sizes.push([new Date(2026, 9, 11 + d).getDay(), s.n, s.k]); }
  const mon = sizes.find(s => s[0] === 1), sun = sizes.find(s => s[0] === 0);
  check(mon[1] * mon[1] < sun[1] * sun[1] && mon[2] <= sun[2], `Monday (${mon[1]}x${mon[1]}) is smaller than Sunday (${sun[1]}x${sun[1]})`);
  check(F.prevKey('2026-03-01') === '2026-02-28' && F.prevKey('2024-03-01') === '2024-02-29' && F.prevKey('2027-01-01') === '2026-12-31', 'the day before works across month, leap-year and year ends');
  check(F.prevKey('2026-10-26') === '2026-10-25' && F.prevKey('2026-03-30') === '2026-03-29', 'and across the clock changes');
  const sh = F.sharedSpec('abc', 99, 99); check(sh.n <= F.MAXN && sh.k <= 6, 'a shared board in the address is clamped to something playable');
  const bad = F.sharedSpec('x', -4, 0); check(bad.n >= 3 && bad.k >= 2, 'and so is nonsense');
}

if (suites.includes('save')) {
  section('save: nothing a stored value says can break the page');
  const hostile = [null, undefined, 5, 'x', [], {stars: 'a'}, {stars: {1: 99, 2: -5, 3: 'x', 77: 3}, best: {1: 1e9}, level: 'a'}, {daily: {last: 'not-a-date', streak: -3, results: {'2026-01-01': {moves: 'x', stars: 9}, 'zzz': 1}}}, {sound: 3, marks: 'yes'}];
  let fine = true;
  for (const h of hostile) { try { const s = F.sanitize(h); if (!s || typeof s.level !== 'number' || s.level < 1 || s.level > 40 || Object.values(s.stars).some(v => v < 1 || v > 3) || s.daily.streak < 0 || (s.daily.last !== '' && !F.keyDate(s.daily.last))) fine = false; } catch (e) { fine = false; } }
  check(fine, 'null, numbers, strings and out-of-range values all come back as a valid save');
  const s0 = F.sanitize({stars: {1: 2}, best: {1: 7}, level: 3, sound: false, marks: true}); check(s0.stars[1] === 2 && s0.best[1] === 7 && s0.level === 3 && s0.sound === false && s0.marks === true, 'a good save is kept as it was');
  const s = F.defaultSave(); F.recordLevel(s, 4, 9, 2); F.recordLevel(s, 4, 11, 1); F.recordLevel(s, 4, 8, 3);
  check(s.stars[4] === 3 && s.best[4] === 8, 'stars and best only ever improve');
  F.recordLevel(s, 4, 20, 1); check(s.stars[4] === 3 && s.best[4] === 8, 'a worse replay never takes anything away');
  check(F.nextOpen(F.defaultSave()) === 1 && F.nextOpen(s) === 1, 'a returning player lands on the first level without stars');
  const t = F.defaultSave(); for (let l = 1; l <= 7; l++) F.recordLevel(t, l, 5, 3); check(F.nextOpen(t) === 8, 'after seven levels it is the eighth');
  const d = F.defaultSave();
  F.recordDaily(d, '2026-10-07', 12, 2); F.recordDaily(d, '2026-10-08', 12, 3); check(d.daily.streak === 2, 'two days in a row is a streak of two');
  F.recordDaily(d, '2026-10-08', 9, 3); check(d.daily.streak === 2 && d.daily.results['2026-10-08'].moves === 9, 'playing the same day again keeps the streak and improves the result');
  F.recordDaily(d, '2026-10-12', 12, 1); check(d.daily.streak === 1, 'a missed day starts the streak again');
  check(F.streakNow(d, '2026-10-12') === 1 && F.streakNow(d, '2026-10-13') === 1 && F.streakNow(d, '2026-10-14') === 0, 'a streak still counts the day after and is gone after two');
  for (let i = 0; i < 40; i++) F.recordDaily(d, F.dayKey(new Date(2027, 0, 1 + i, 12)), 10, 1); check(Object.keys(d.daily.results).length <= 21, 'only the last three weeks of results are kept');
  // players of the page before the remake
  const old = F.migrateLegacy({gamesPlayed: 12, gamesWon: 9, bestScores: {easy: 14, medium: null, hard: null}, byConfig: {'16x5': 33}}, {soundEffects: false, showTimer: true}, '1');
  check(old.legacy && old.legacy.easy === 14 && !old.legacy.medium && old.level === 11 && old.sound === false && old.seen === true && Object.keys(old.stars).length === 0, 'an old Easy best starts the player in the Lakes, keeps the number, keeps sound off and gives no free stars');
  check(F.migrateLegacy({bestScores: {easy: 14, medium: 29, hard: 51}}, null, null).level === 31 && F.migrateLegacy({bestScores: {easy: 14, medium: 29, hard: null}}, null, null).level === 21, 'a beaten Medium starts at Sea, a beaten Hard at Ocean');
  let safe = true; for (const h of [null, undefined, 5, 'x', [], {bestScores: 'x'}, {bestScores: {easy: 'a', medium: -3, hard: Infinity}}, {bestScores: {easy: 1e12}}]) { try { const m = F.migrateLegacy(h, h, h); if (m.level < 1 || m.level > 40 || (m.legacy && Object.values(m.legacy).some(v => v < 1 || v > 9999))) safe = false; } catch (e) { safe = false; } }
  check(safe, 'null, strings, Infinity and absurd numbers in the old storage cannot break the migration');
  check(F.migrateLegacy(null, null, null).legacy === null && F.migrateLegacy(null, null, null).seen === false, 'a new player is untouched');
  check(JSON.stringify(F.sanitize(JSON.parse(JSON.stringify(old))).legacy) === JSON.stringify(old.legacy), 'the old bests survive being saved and loaded again');
  const txt = F.shareText({title: 'Color Flood · Fri 9 Oct', stars: 2, moves: 11, par: 9, seq: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4], url: 'https://www.gptgames.dev/games/color_flood.html?daily'});
  const squares = [...txt.split('\n')[2]]; check(squares.length === 11 && txt.includes('★★☆') && txt.includes('par 9') && !/seed=/.test(txt), 'the share line has one square per move, the stars, and gives nothing of the board away');
}

if (suites.includes('page')) {
  section('page: the real page, in Chromium');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) { try { ({chromium} = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('  skipped: playwright is not installed'); chromium = null; } }
  let browser = null;
  if (chromium) { try { browser = await chromium.launch(); } catch (e) { try { browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); } catch (e2) { console.log('  skipped: no Chromium'); } } }
  if (browser) {
    const url = 'file://' + PAGE.replace(/\\/g, '/');
    const noise = m => /fonts\.g|Failed to load resource|ERR_/.test(m);   // the web font may be unreachable offline
    const watch = p => { const errs = []; p.on('console', m => m.type() === 'error' && !noise(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message)); return errs; };
    const playSolution = async (p, tap) => {
      const sol = await p.evaluate(() => window.__colorFlood.game().sol);
      for (const c of sol) {
        const b = await p.locator('#sw .sw').nth(c).boundingBox();
        if (tap) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await p.waitForTimeout(650);
      }
      await p.waitForTimeout(1500);
      return sol.length;
    };
    for (const [name, vp, touch] of [['desktop', {width: 1280, height: 800}, false], ['phone', {width: 390, height: 844}, true]]) {
      const ctxp = await browser.newContext({viewport: vp, hasTouch: touch, isMobile: touch});
      const p = await ctxp.newPage(), errs = watch(p);
      await p.goto(url + '?level=1'); await p.waitForTimeout(700);
      check(await p.evaluate(() => !!window.__colorFlood && window.__colorFlood.game().ready), `${name}: the page boots on level 1 with its par ready`);
      check(await p.locator('#coach.on').count() === 1, `${name}: a new player gets the one-line coach tip`);
      const first = await p.evaluate(() => window.__colorFlood.game().sol[0]);
      const b = await p.locator('#sw .sw').nth(first).boundingBox();
      if (touch) { await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } else { await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); }
      if (!touch) { check(await p.evaluate(() => document.querySelector('#sw .pressed') !== null), `${name}: pressing an ink sinks it`); await p.mouse.up(); }
      await p.waitForTimeout(700);
      check(await p.evaluate(() => window.__colorFlood.game().st.moves.length === 1 && document.getElementById('count').textContent === '1'), `${name}: a ${touch ? 'tap' : 'press and release'} plays the move and the counter follows in the same breath`);
      check(await p.locator('#coach.on').count() === 0, `${name}: the tip goes after the first move`);
      await p.keyboard.press('u'); await p.waitForTimeout(500);
      check(await p.evaluate(() => window.__colorFlood.game().st.moves.length === 0), `${name}: U undoes it`);
      await p.keyboard.press('1'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
      await playSolution(p, touch);
      check(await p.evaluate(() => !document.getElementById('card').hidden && document.getElementById('card').textContent.includes('Par')), `${name}: playing the stored solution wins at par and shows the card`);
      check(await p.evaluate(() => window.__colorFlood.save().stars[1] === 3), `${name}: three stars are saved`);
      check(await p.evaluate(() => document.querySelector('#card').textContent.length > 0 && document.querySelectorAll('#card .big svg.lit').length === 3), `${name}: the card shows the three stars that were earned`);
      await p.goto(url); await p.waitForTimeout(700);
      check(await p.evaluate(() => window.__colorFlood.game().spec.level === 2), `${name}: coming back opens the next level`);
      check(errs.length === 0, `${name}: no console errors through a whole level`, errs.join(' | '));
      await ctxp.close();
    }
    { // reduced motion: the same level, nothing waits on an animation
      const c = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'}), p = await c.newPage(), errs = watch(p);
      await p.goto(url + '?level=2'); await p.waitForTimeout(600);
      await playSolution(p, false);
      check(await p.evaluate(() => !document.getElementById('card').hidden), 'reduced motion: a level can be won and the card shows');
      check(await p.evaluate(() => document.getElementById('fx').children.length === 0), 'reduced motion: no tiles burst');
      check(errs.length === 0, 'reduced motion: no console errors', errs.join(' | ')); await c.close();
    }
    { // a hostile save and the old page's saved data
      const c = await browser.newContext({viewport: {width: 390, height: 844}}), p = await c.newPage(), errs = watch(p);
      await p.addInitScript(() => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('colorFlood.v2', '{"stars":{"1":999,"x":3},"level":"zzz","daily":{"last":5,"results":[]},"marks":1}'); } });
      await p.goto(url); await p.waitForTimeout(600);
      check(await p.evaluate(() => window.__colorFlood.game().ready && window.__colorFlood.save().level === 1 && window.__colorFlood.save().stars[1] === 3), 'a lying save is clamped and the page still opens');
      check(errs.length === 0, 'a lying save: no console errors', errs.join(' | ')); await c.close();
      const c2 = await browser.newContext({viewport: {width: 390, height: 844}}), q = await c2.newPage(), errs2 = watch(q);
      await q.addInitScript(() => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('colorFloodStatistics', JSON.stringify({gamesPlayed: 5, gamesWon: 4, bestScores: {easy: 14, medium: null, hard: null}, byConfig: {}})); localStorage.setItem('colorFloodSettings', JSON.stringify({soundEffects: false})); } });
      await q.goto(url); await q.waitForTimeout(600);
      check(await q.evaluate(() => window.__colorFlood.game().spec.level === 11 && window.__colorFlood.save().sound === false && !document.getElementById('coach').classList.contains('on')), 'the old page\'s Easy best opens the Lakes, keeps sound off and skips the tip');
      await q.click('#lv'); await q.waitForTimeout(400);
      check((await q.textContent('#legacy')).includes('Easy 14'), 'the old best is shown in the levels sheet');
      await q.keyboard.press('Escape');
      check(errs2.length === 0, 'old data: no console errors', errs2.join(' | ')); await c2.close();
    }
    { // a shared board and a daily board, solved in the worker
      const c = await browser.newContext({viewport: {width: 390, height: 844}}), p = await c.newPage(), errs = watch(p);
      await p.goto(url + '?seed=hello&n=7&k=4'); await p.waitForFunction(() => window.__colorFlood && window.__colorFlood.game() && window.__colorFlood.game().ready, null, {timeout: 20000});
      check(await p.evaluate(() => { const g = window.__colorFlood.game(); return g.spec.kind === 'shared' && g.spec.n === 7 && g.par >= 3; }), 'a seed in the address deals a shared board and finds its par');
      await p.goto(url + '?daily'); await p.waitForFunction(() => window.__colorFlood.game().ready, null, {timeout: 20000});
      check(await p.evaluate(() => window.__colorFlood.game().spec.kind === 'daily' && window.__colorFlood.game().par >= 4), 'the daily board loads with a par');
      await playSolution(p, false);
      check(await p.evaluate(() => document.getElementById('card').textContent.includes('streak') && window.__colorFlood.save().daily.streak === 1), 'winning the daily board starts a streak');
      check(errs.length === 0, 'shared and daily: no console errors', errs.join(' | ')); await c.close();
    }
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
