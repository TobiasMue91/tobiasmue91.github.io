#!/usr/bin/env node
// Test suite for games/bubble_break.html.
//
// An incremental is a web of numbers where every constant pulls on all the others: a
// cheaper node, a bigger sheet or one more second of break time can quietly turn a two-and-
// a-half-hour game into a twenty-minute one, or a break into one that never ends. None of
// that shows in a diff or on a screenshot. The page keeps its sheets, verbs, trees and
// economy in a <script id="core"> block with no DOM; this runs that block alone in Node.
//
//   node test/bubble_break.mjs                  # everything (about three minutes)
//   node test/bubble_break.mjs sheet rules      # named suites only
//   node test/bubble_break.mjs --page=old.html  # run against another copy of the page
//
// Suites: sheet, rules, idle, pacing.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'bubble_break.html');
const ALL = ['sheet', 'rules', 'idle', 'pacing'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if(process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if(!core){ console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.BB = BB;', ctx);
const BB = ctx.BB, SQ = BB.SQ, T = BB.T;

// a run on a sheet without specials, for exact geometry
function plainRun(size, aspect, seed){
  const S = BB.newState();
  const run = BB.startRun(S, { aspect, seed });
  const P = Object.assign({}, run.P, { size, flat:0, thick:0, gold:0, espresso:0, bang:0, giants:0 });
  run.P = P; run.sheet = BB.makeSheet(P, aspect, BB.mulberry(seed));
  return run;
}
function intactSet(sh){ const s = new Set(); for(let j = 0; j < sh.rows; j++) for(let i = 0; i < sh.cols; i++) if(BB.isIntact(sh, i, j)) s.add(j*sh.cols + i); return s; }

/* ---------------- sheet ---------------- */
if(suites.includes('sheet')){
  section('sheet');
  const rnd = BB.mulberry(11);
  let bad = 0, cases = 0;
  for(let n = 0; n < 40; n++){
    const run = plainRun([54, 450, 2600, 30000][n % 4], [.5, 1, 1.5, 2.2][n % 4], 100 + n), sh = run.sheet;
    for(let k = 0; k < 12; k++){
      const x = rnd()*sh.W, y = rnd()*sh.H, R = .3 + rnd()*Math.min(12, sh.W/4);
      // the popper behind bangs, waves and shockwaves: pops everything within R of (x, y)
      const before = intactSet(sh);
      run.pending = [{ at: run.t, x, y, r: R, who: 'chain' }];
      BB.step(run, 0);
      const after = intactSet(sh);
      const gone = [...before].filter(i => !after.has(i));
      const expect = [...before].filter(idx => { const j = (idx / sh.cols)|0, i = idx - j*sh.cols; return Math.hypot(BB.cx(i, j) - x, BB.cy(j) - y) <= R; });
      cases++;
      if(gone.length !== expect.length || !expect.every(i => !after.has(i))) bad++;
      if(run.over) break;
    }
  }
  check(bad === 0, `a circle pops exactly the bubbles whose centres lie inside it (${cases} circles on 40 sheets)`, `${bad} mismatches`);

  // the running count agrees with the bitset after presses, swipes with budgets and machines
  {
    const S = BB.newState(); Object.assign(S.lv, { thumb:2, strength:4, delivery:4, machine:3, gold:2, espresso:2, bang:2, giant:2, qc:1 });
    const run = BB.startRun(S, { aspect: 1.4, seed: 5 }); let off = 0;
    for(let k = 0; k < 400 && !run.over; k++){
      const sh = run.sheet;
      BB.press(run, rnd()*sh.W, rnd()*sh.H);
      BB.drag(run, rnd()*sh.W, rnd()*sh.H); BB.release(run);
      BB.step(run, 1/20);
      const s2 = run.sheet; let c = 0; for(let j = 0; j < s2.rows; j++) for(let i = 0; i < s2.cols; i++){ const kk = BB.specialAt(s2, i, j); if(BB.isIntact(s2, i, j) && !(kk >= 0 && s2.spT[j][kk] === T.FLAT)) c++; }
      if(c !== s2.left) off++;
    }
    check(off === 0, 'the sheet\'s count of bubbles left matches its bitset after 400 mixed actions', `${off} frames out of step`);
  }

  // a swipe never pops more than its strength
  {
    const run = plainRun(4200, 1.5, 3); run.P.budget = 25; run.budget = 25; run.P.reach = 2.5; let worst = 0;
    for(let k = 0; k < 30; k++){ const sh = run.sheet, y = 1 + (k % 20)*1.5; const b = BB.intactCount(sh); run.budget = 25; BB.press(run, 1, y); const a = BB.intactCount(sh); BB.drag(run, sh.W - 1, y); const c = BB.intactCount(sh); BB.release(run); worst = Math.max(worst, a - c); }
    check(worst <= 25, `a swipe with strength 25 pops at most 25 (most seen: ${worst})`);
    check(worst >= 20, `and uses most of it on a full sheet (most seen: ${worst})`);
  }

  // half a million bubbles stay cheap
  {
    const run = plainRun(560000, 1.6, 9), sh = run.sheet; run.P.budget = 1e5; run.budget = 1e5; run.P.reach = 36;
    let t0 = performance.now(); for(let k = 0; k < 20; k++) BB.press(run, 40 + k*20, 200), BB.release(run); const tPress = (performance.now() - t0)/20;
    t0 = performance.now(); BB.press(run, 10, 400); BB.drag(run, sh.W - 10, 420); BB.release(run); const tSwipe = performance.now() - t0;
    t0 = performance.now(); BB.makeSheet(Object.assign({}, run.P, { size:560000 }), 1.6, BB.mulberry(4)); const tMake = performance.now() - t0;
    check(tPress < 25, `a press over ~4,000 bubbles of a 560,000-bubble sheet takes ${tPress.toFixed(1)} ms`);
    check(tSwipe < 120, `a swipe across it takes ${tSwipe.toFixed(1)} ms`);
    check(tMake < 120, `making the sheet takes ${tMake.toFixed(1)} ms`);
  }

  // the lasso's fill: exactly the bubbles whose centres lie inside the loop, against brute force
  {
    const inside = (poly, x, y) => { let c = false; const n = poly.length/2; for(let a = 0, b = n - 1; a < n; b = a++){ const xa = poly[2*a], ya = poly[2*a+1], xb = poly[2*b], yb = poly[2*b+1]; if((ya <= y) !== (yb <= y) && x < xa + (y - ya)*(xb - xa)/(yb - ya)) c = !c; } return c; };
    let bad = 0, cases = 0;
    for(let n = 0; n < 30; n++){
      const run = plainRun([450, 2600, 30000][n % 3], 1.5, 300 + n), sh = run.sheet;
      // a random star-shaped loop, like a hand draws one: a centre and wobbling radii
      const cx0 = sh.W*(.3 + .4*rnd()), cy0 = sh.H*(.3 + .4*rnd()), R0 = Math.min(sh.W, sh.H)*(.1 + .25*rnd()), k = 5 + Math.floor(rnd()*60), poly = [];
      for(let q = 0; q < k; q++){ const a = q/k*6.283, r = R0*(.55 + .45*rnd()); poly.push(cx0 + Math.cos(a)*r, cy0 + Math.sin(a)*r); }
      const before = intactSet(sh); BB.popPolygon(run, poly, 'player'); const after = intactSet(sh);
      const want = [...before].filter(idx => { const j = (idx/sh.cols)|0, i = idx - j*sh.cols; return inside(poly, BB.cx(i, j), BB.cy(j)); });
      const gone = [...before].filter(i => !after.has(i));
      cases++; if(gone.length !== want.length || !want.every(i => !after.has(i))) bad++;
    }
    check(bad === 0, `a loop pops exactly the bubbles whose centres lie inside it (${cases} hand-drawn loops)`, `${bad} mismatches`);
  }

  // thirty million bubbles: the city
  {
    const S = BB.newState(); S.stage = S.unlocked = 3; Object.assign(S.lv, { delivery:6, thumb:4, strength:6 }); S.cl.lasso = 1;
    let t0 = performance.now(); const run = BB.startRun(S, { aspect: 1.5, seed: 4 }); const tMake = performance.now() - t0, sh = run.sheet;
    t0 = performance.now(); for(let k = 0; k < 10; k++){ BB.press(run, sh.W*(.1 + .08*k), sh.H/2); BB.release(run); } const tPress = (performance.now() - t0)/10;
    const r = sh.H*.35; t0 = performance.now(); BB.press(run, sh.W/2 + r, sh.H/2); for(let a = 0; a <= 6.6; a += .05) BB.drag(run, sh.W/2 + Math.cos(a)*r, sh.H/2 + Math.sin(a)*r); BB.release(run); const tLoop = performance.now() - t0;
    check(sh.N > 3e7 && tMake < 400, `a sheet of ${(sh.N/1e6).toFixed(0)} million bubbles takes ${tMake.toFixed(0)} ms to make`);
    check(tPress < 25, `a press on it takes ${tPress.toFixed(1)} ms`);
    check(run.bestLoop > 5e6 && tLoop < 250, `a loop around ${(run.bestLoop/1e6).toFixed(0)} million of them takes ${tLoop.toFixed(0)} ms, stroke included`);
  }
}

/* ---------------- rules ---------------- */
const fmtN = n => n >= 1e6 ? (n/1e6).toFixed(1) + ' million' : Math.round(n).toLocaleString('en-US');
function findSpecial(sh, type){ for(let j = 0; j < sh.rows; j++){ const a = sh.spI[j]; for(let k = 0; k < a.length; k++) if(sh.spT[j][k] === type && BB.isIntact(sh, a[k], j)) return [a[k], j]; } return null; }
function runWith(lv, cl, opts){ const S = BB.newState(); Object.assign(S.lv, lv || {}); Object.assign(S.cl, cl || {}); if(opts && opts.stage){ S.stage = S.unlocked = opts.stage; } return [S, BB.startRun(S, Object.assign({ aspect: 1.5, seed: 21 }, opts || {}))]; }
if(suites.includes('rules')){
  section('rules');
  // thick bubbles: a press alone does nothing, holding still pops them
  {
    const [, run] = runWith({ delivery:6 }); const sh = run.sheet, p = findSpecial(sh, T.THICK);
    if(!p) fail('a thick bubble to test on'); else {
      const x = BB.cx(p[0], p[1]), y = BB.cy(p[1]);
      BB.press(run, x, y); const after = BB.isIntact(sh, p[0], p[1]);
      for(let k = 0; k < 4; k++) BB.step(run, run.P.holdTime/3);
      check(after && !BB.isIntact(sh, p[0], p[1]), 'a thick bubble survives a press and gives way to a held one');
      BB.release(run);
      // wobbling the thumb around on it does not start the hold over
      const q = findSpecial(sh, T.THICK); if(q){ const qx = BB.cx(q[0], q[1]), qy = BB.cy(q[1]); BB.press(run, qx, qy);
        for(let k = 0; k < 8; k++){ BB.drag(run, qx + (k % 2 ? .3 : -.3), qy); BB.step(run, run.P.holdTime/6); }
        check(!BB.isIntact(sh, q[0], q[1]), 'moving the held thumb while the thick bubble stays under it still pops it'); BB.release(run); }
    }
  }
  // flat bubbles: pressing spoils the combo, swiping over one only costs strength
  {
    const [, run] = runWith({ thumb:1, strength:3, delivery:6 }); const sh = run.sheet, p = findSpecial(sh, T.FLAT);
    const x = BB.cx(p[0], p[1]), y = BB.cy(p[1]);
    run.combo = 30; run.lastPop = run.t; BB.press(run, x, y); BB.release(run);
    check(run.combo === 0 && run.flats === 1, 'pressing a flat bubble resets the combo');
    const q = findSpecial(sh, T.FLAT); const qx = BB.cx(q[0], q[1]), qy = BB.cy(q[1]);
    run.budget = run.P.budget; BB.press(run, qx - 3, qy); run.combo = 30; run.lastPop = run.t;
    const b0 = run.budget; BB.drag(run, qx + 3, qy); BB.release(run);
    check(run.combo >= 30 && run.flats === 1 && !BB.isIntact(sh, q[0], q[1]) && run.budget < b0, 'swiping over a flat bubble keeps the combo and costs strength');
  }
  // machines leave gold and espresso for the player, and do pop thick ones
  {
    const [, run] = runWith({ delivery:6, machine:4, gold:4, espresso:3 });
    for(let k = 0; k < 20*60 && !run.over; k++){ BB.step(run, 1/60); if(run.sheets) break; }
    const sh = run.sheet; let gold = 0, esp = 0, thickLeft = 0, thickAll = 0;
    for(let j = 0; j < sh.rows; j++) for(let k = 0; k < sh.spI[j].length; k++){ const t = sh.spT[j][k], on = BB.isIntact(sh, sh.spI[j][k], j); if(t === T.GOLD && on) gold++; if(t === T.ESPRESSO && on) esp++; if(t === T.THICK){ thickAll++; if(on) thickLeft++; } }
    const ordinary = BB.intactCount(sh);
    check(gold > 0 && esp > 0, `after a break of machine work, gold (${gold}) and espresso (${esp}) bubbles are still there`);
    check(thickLeft < thickAll, `the machine popped thick bubbles (${thickAll - thickLeft} of ${thickAll})`);
    check(ordinary < sh.N*.5, `and most ordinary ones (${ordinary} of ${sh.N} left)`);
  }
  // espresso time: never more than three quarters of the break on top
  {
    // pop every espresso bubble of sixty sheets
    const [, r2] = runWith({ cup:5, delivery:3, espresso:3, strength:6, thumb:4 }); const b2 = r2.P.time;
    let popped = 0;
    for(let n = 0; n < 60 && !r2.over; n++){
      const sh = r2.sheet; for(let j = 0; j < sh.rows; j++) for(let k = 0; k < sh.spI[j].length; k++) if(sh.spT[j][k] === T.ESPRESSO && BB.isIntact(sh, sh.spI[j][k], j)){ BB.press(r2, BB.cx(sh.spI[j][k], j), BB.cy(j)); BB.release(r2); popped++; }
      sh.left = 0; BB.step(r2, .001); r2.slide = 0;   // on to a fresh sheet
    }
    check(popped > 100 && r2.bonusT <= b2*.75 + 1e-9, `${popped} espresso bubbles add ${r2.bonusT.toFixed(1)} s to a ${b2} s break, never more than 75 %`);
  }
  // giant bubbles
  {
    const [, run] = runWith({ gold:1, giant:2 }); const sh = run.sheet, gi = sh.giants[0];
    check(sh.giants.length === 2, 'Giant bubble 2 puts two giants on each sheet');
    for(let k = 0; k < gi.need - 1; k++){ BB.press(run, gi.x, gi.y); BB.release(run); }
    const alive = gi.alive; BB.press(run, gi.x, gi.y); BB.release(run);
    const [, run2] = runWith({ gold:1, giant:1, strength:6, thumb:1 }); const g2 = run2.sheet.giants[0];
    run2.budget = 60; BB.press(run2, g2.x - 3, g2.y); BB.drag(run2, g2.x - 1, g2.y); BB.drag(run2, g2.x + 1, g2.y); BB.drag(run2, g2.x + 3, g2.y); BB.release(run2);
    check(alive && !gi.alive, `a giant needs exactly ${gi.need} presses`);
    check(g2.hits === 1, 'a swipe across a giant counts as one hit, however many steps it takes');
    const before = BB.intactCount(sh); BB.step(run, .2);
    check(BB.intactCount(sh) < before, 'a giant\'s shockwave pops bubbles around it');
  }
  // a cleared sheet pays, and the next one arrives without costing break time
  {
    const [, run] = runWith({}); const sh = run.sheet;
    for(let j = 0; j < sh.rows; j++) for(let i = 0; i < sh.cols; i++){ const k = BB.specialAt(sh, i, j), t = k >= 0 ? sh.spT[j][k] : -1; if(t === T.THICK){ BB.press(run, BB.cx(i, j), BB.cy(j)); BB.step(run, run.P.holdTime + .01); BB.release(run); } else if(t !== T.FLAT){ BB.press(run, BB.cx(i, j), BB.cy(j)); BB.release(run); } }
    const e0 = run.earned; BB.step(run, 1/60); const ev = BB.takeEvents(run);
    check(run.sheets === 1 && ev.sheet && run.earned > e0, 'popping every bubble clears the sheet and pays a bonus');
    const t0 = run.time; BB.step(run, .2);
    check(run.slide > 0 && run.time === t0, 'the clock stops while the next sheet slides in');
  }
  // forks and the intern
  {
    const S = BB.newState(); S.plopps = 1e9; S.lv.cup = 1;
    BB.buyRun(S, 'rhythm');
    check(!BB.canBuyRun(S, BB.RUN_BY.thorough), 'taking Rhythm rules out Thoroughness in this job');
    S.cl.flexible = 1;
    check(BB.canBuyRun(S, BB.RUN_BY.thorough), 'Flexible allows both sides of a fork');
    const S2 = BB.newState(); S2.plopps = 1e12; Object.assign(S2.lv, { cup:1, thumb:1, strength:1 });
    BB.autoBuy(S2);
    check(!BB.lv(S2, 'rhythm') && !BB.lv(S2, 'thorough') && !BB.lv(S2, 'bang') && !BB.lv(S2, 'wave'), 'the intern never picks a fork for you');
  }
  // quitting
  {
    const S = BB.newState();
    check(BB.quitGain(S) === 0, 'nothing to take away before the gate');
    const g0 = BB.STAGES[0].gate; S.cycleEarned = g0*.99; const below = BB.quitGain(S); S.cycleEarned = g0; const at = BB.quitGain(S); S.cycleEarned = g0*8; const x8 = BB.quitGain(S);
    check(below === 0 && at === BB.STAGES[0].gain && x8 === 2*at, `the gate pays ${at} calluses, eight times the gate twice that`);
    S.plopps = 1e6; S.lv.cup = 3; S.cl.memory = 2; S.cl.pinsub = 1; S.cl.savings = 2;
    const g = BB.quit(S);
    check(g === x8 && S.calluses === g && S.plopps === 0 && S.lv.cup === undefined && S.lv.strength === 2 && S.lv.machine === 1, 'quitting pays calluses, empties Plopps and the break tree, and applies the start bonuses');
    const first = BB.startRun(S, { seed: 1 }).P.value, second = BB.startRun(S, { seed: 2 }).P.value;
    check(Math.abs(first - 3*second) < 1e-9, 'the coffee fund triples what the first break of a job pays');
    S.cycleRuns = 0; S.cycleEarned = 0;
    S.calluses = 100; S.cl.memory = 2; BB.buyCareer(S, 'ship');
    check(S.stage === 1, 'buying the warehouse before the first break of a job moves you there at once');
    const [S2, run] = runWith({}); S2.calluses = 100; S2.cl.memory = 1; BB.finish(run); BB.buyCareer(S2, 'ship');
    check(S2.stage === 0 && S2.unlocked === 1, 'buying it in the middle of a job waits for the next one');
  }
  // sugar: a frenzy multiplies everything and holds the combo; machines leave sugar alone
  {
    const [, run] = runWith({ delivery:6, sugar:3, sweettooth:1 }); const sh = run.sheet, p = findSpecial(sh, T.SUGAR);
    if(!p) fail('a sugar bubble to test on'); else {
      const v0 = BB.valueNow(run); BB.press(run, BB.cx(p[0], p[1]), BB.cy(p[1])); BB.release(run);
      const v1 = BB.valueNow(run), f = run.frenzy;
      run.combo = 40; run.lastPop = run.t; for(let k = 0; k < 60; k++) BB.step(run, 1/30);
      const kept = run.combo === 40;
      for(let k = 0; k < Math.ceil(f*30) + 30; k++) BB.step(run, 1/30);
      check(Math.abs(v1/v0 - run.P.frenzyMul) < 1e-9 && f === run.P.frenzyT, `a sugar bubble starts a ${f} s frenzy paying ×${run.P.frenzyMul}`);
      check(kept && run.combo === 0 && run.frenzy === 0, 'during the frenzy the combo waits, after it the combo lapses again');
    }
    const [, r2] = runWith({ delivery:6, machine:4, sugar:3 });
    for(let k = 0; k < 20*60 && !r2.over && !r2.sheets; k++) BB.step(r2, 1/60);
    check(findSpecial(r2.sheet, T.SUGAR) && r2.frenzies === 0, 'a break of machine work leaves the sugar bubbles for the player');
  }
  // zippers open their row, and with Cross stitch their column too
  {
    const rowLeft = (sh, j) => { let c = 0; for(let i = 0; i < sh.cols; i++){ const k = BB.specialAt(sh, i, j); if(BB.isIntact(sh, i, j) && !(k >= 0 && sh.spT[j][k] === T.GIANT)) c++; } return c; };
    const [, run] = runWith({ delivery:6, zipper:3 }); const sh = run.sheet, p = findSpecial(sh, T.ZIP);
    BB.press(run, BB.cx(p[0], p[1]), BB.cy(p[1])); BB.release(run);
    const e0 = run.earned; let steps = 0; while(run.zips.length && steps < 200){ BB.step(run, 1/30); steps++; }
    check(rowLeft(sh, p[1]) === 0 && steps < 45 && run.earned > e0, `a zipper opens its whole row of ${sh.cols} in ${(steps/30).toFixed(2)} s`);
    const [, r2] = runWith({ delivery:6, zipper:3, crosszip:1 }, {}, { seed: 22 }); const s2 = r2.sheet, q = findSpecial(s2, T.ZIP);
    BB.press(r2, BB.cx(q[0], q[1]), BB.cy(q[1])); BB.release(r2); for(let k = 0; k < 200 && r2.zips.length; k++) BB.step(r2, 1/30);
    let colLeft = 0; const x = BB.cx(q[0], q[1]); for(let j = 0; j < s2.rows; j++){ const i = Math.round(x - .5 - .5*(j & 1)), k = BB.specialAt(s2, i, j); if(BB.isIntact(s2, i, j) && !(k >= 0 && s2.spT[j][k] === T.GIANT)) colLeft++; }
    check(rowLeft(s2, q[1]) === 0 && colLeft === 0, 'with Cross stitch it opens its column as well');
  }
  // the lasso: a closed loop pops what is inside it, an open curve does not
  {
    const loopRun = (lasso, closed) => { const [, run] = runWith({ delivery:6, thumb:1, strength:1 }, { lasso }, { stage: 1, seed: 31 }); const sh = run.sheet, r = sh.H*.3, c = [sh.W/2, sh.H/2];
      run.budget = 0; BB.press(run, c[0] + r, c[1]); for(let a = 0; a <= (closed ? 6.7 : 4.5); a += .02) BB.drag(run, c[0] + Math.cos(a)*r, c[1] + Math.sin(a)*r); BB.release(run);
      let left = 0; for(let j = 0; j < sh.rows; j++) for(let i = 0; i < sh.cols; i++){ const k = BB.specialAt(sh, i, j); if(Math.hypot(BB.cx(i, j) - c[0], BB.cy(j) - c[1]) < r*.8 && BB.isIntact(sh, i, j) && !(k >= 0 && sh.spT[j][k] === T.THICK)) left++; }
      return [run, 0, left]; };
    const [a, , leftA] = loopRun(1, true), [, , leftB] = loopRun(1, false), [, , leftC] = loopRun(0, true);
    check(a.loops === 1 && leftA === 0, `a closed loop pops everything inside it but the thick ones (${fmtN(a.bestLoop)} bubbles)`);
    check(leftB > 100 && leftC > 100, 'an open curve, or a loop without Cordon tape, leaves the inside alone');
    const [, r2] = runWith({ delivery:6 }, { lasso:1 }, { seed: 31 }); r2.combo = 0; const e0 = r2.earned; const n0 = BB.popPolygon(r2, [0, 0, 6, 0, 6, 6, 0, 6], 'loop'); const e1 = r2.earned - e0;
    const [, r3] = runWith({ delivery:6 }, { lasso:1 }, { seed: 31 }); const f0 = r3.earned; const n1 = BB.popPolygon(r3, [0, 0, 6, 0, 6, 6, 0, 6], 'player'); const e2 = r3.earned - f0;
    check(n0 === n1 && e1 > 2.5*e2, 'bubbles roped in by a loop pay triple');
  }
  // chain reactions die out by themselves
  {
    const blast = (domino, seed) => { const [, run] = runWith({ delivery:6 }, { domino }, { stage: 3, seed }); const sh = run.sheet;
      run.pending.push({ at: 0, x: sh.W/2, y: sh.H/2, r: 60, who:'chain', ring:true, gen:0 }); let most = 0, k = 0;
      for(; k < 30*30 && (run.pending.length || k === 0); k++){ BB.step(run, 1/30); most = Math.max(most, run.pending.length); }
      return { popped: sh.N - BB.intactCount(sh), gens: run.domino, secs: k/30, most }; };
    const none = blast(0, 40), a = blast(2, 40), b = blast(2, 41);
    check(a.gens >= 8 && a.popped > 20*none.popped, `with Chain reaction one blast sets off ${a.gens} generations and pops ${fmtN(a.popped)} (alone: ${fmtN(none.popped)})`);
    check(Math.max(a.secs, b.secs) < 12 && Math.max(a.most, b.most) <= 170, `and dies out by itself within ${Math.max(a.secs, b.secs).toFixed(1)} s, never more than ${Math.max(a.most, b.most)} blasts waiting`);
  }
  // Iron thumb: thick bubbles give way under a swipe
  {
    const swipeOver = iron => { const [, run] = runWith({ delivery:6, thumb:1, strength:3, iron }, {}, { seed: 50 }); const sh = run.sheet, p = findSpecial(sh, T.THICK); const x = BB.cx(p[0], p[1]), y = BB.cy(p[1]);
      BB.press(run, x - 3, y); BB.drag(run, x + 3, y); BB.release(run); return !BB.isIntact(sh, p[0], p[1]); };
    check(!swipeOver(0) && swipeOver(1), 'a swipe passes over thick bubbles, with Iron thumb it pops them');
  }
  // orders and stickers
  {
    const S = BB.newState();
    check(S.orders.map(o => o.id).join() === 'sheets,combo,gold', 'the first job asks for sheets, a combo and gold');
    S.cycleEarned = BB.STAGES[0].gate; const g0 = BB.quitGain(S); S.orders[0].done = true; S.orders[1].done = true; const g2 = BB.quitGain(S);
    check(g2 === Math.floor(BB.STAGES[0].gain*1.5), `two orders done turn ${g0} calluses into ${g2}`);
    const S5 = BB.newState(), r5 = BB.startRun(S5, { seed: 3 }); r5.maxCombo = 1e9; BB.finish(r5); const r6 = BB.startRun(S5, { seed: 4 }); BB.finish(r6);
    check(r5.ordersDone.join() === '1' && S5.orders[1].done && !S5.orders[2].done && r6.ordersDone.length === 0, 'orders are met by what a break did, and stay met');
    BB.quit(S);
    check(S.orders.length === 3 && new Set(S.orders.map(o => o.id)).size === 3 && S.orders.every(o => !o.done && !BB.ORDERS_BY[o.id].car), 'quitting brings three new, different orders');
    const S2 = BB.newState(); S2.stage = S2.unlocked = 3; S2.quits = 4; S2.cl.lasso = 1; S2.cl.headhunter = 1; let sawLoop = false, sizes = new Set();
    for(let k = 0; k < 40; k++){ const o = BB.newOrders(S2); sizes.add(o.length); if(o.some(x => x.id === 'loop' && x.n === 2e6)) sawLoop = true; }
    check(sawLoop && sizes.size === 1 && sizes.has(4), 'in the city with Cordon tape a loop order can come up, and Headhunter makes it four orders');
    const S3 = BB.newState(); const v0 = BB.derive(S3).value; S3.stickers = { first:1, pop1k:1, sheet1:1 }; const v3 = BB.derive(S3).value;
    check(Math.abs(v3/v0 - 1.03) < 1e-9, 'three stickers add 3 % to everything');
    const S4 = BB.newState(); const r4 = BB.startRun(S4, { seed: 1 }); BB.press(r4, BB.cx(1, 1), BB.cy(1)); BB.release(r4); BB.finish(r4);
    check(r4.stickers.includes('first') && S4.stickers.first, 'the first pop earns the first sticker');
  }
  // an older save still loads, and a world bought before the city existed keeps its way there
  {
    const old = { v:1, stage:2, unlocked:2, plopps:5, cycleEarned:0, lifePops:1e9, runs:80, cycleRuns:0, lv:{ break:1 }, cl:{ cv:1, ship:1, factory:1, world:1 }, calluses:3, callusesEarned:900, quits:6, best:{ run:1, combo:1, sheets:1 }, finale:{ done:false, pops:0 } };
    const S = BB.load(JSON.stringify(old));
    check(S.stats && S.stats.sheets === 0 && S.orders.length === 3 && S.cl.city === 1 && S.unlocked === 3 && S.finale.act === 0, 'a first-version save loads with orders, stats and the city');
    const mid = Object.assign({}, old, { stage:1, unlocked:1, cl:{ cv:1, ship:1 }, orders:[{ id:'clean', n:1, best:0, done:false }, { id:'combo', n:250, best:300, done:true }, { id:'gold', n:6, best:2, done:false }] });
    const S2 = BB.load(JSON.stringify(mid));
    check(S2.orders.length === 3 && !S2.orders.some(o => o.id === 'clean') && S2.orders.find(o => o.id === 'combo').done, 'an order the warehouse no longer gives is swapped for one it does, and what was done stays done');
  }
}

/* ---------------- players ----------------
   A human-limited player: taps five a second with a few pixels of aim error, swipes at 1,500 px
   a second across a sheet drawn 900 px wide, goes for special bubbles first (sugar before the
   rest), holds thick ones. With the lasso it draws loops at the same speed instead of swipes.
   Between breaks the intern's rule (cheapest first) buys; forks alternate from job to job. It
   quits when its callus gain stops growing, and in its career it saves for the next workplace. */
const human = { taps: 4.5, swipe: 1500, aim: 5, screen: 900 };
function gaussFrom(rnd){ return () => { let u = 0, v = 0; while(!u) u = rnd(); while(!v) v = rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }; }
function playBreak(S, seed, who){
  const run = BB.startRun(S, { aspect: 1.5, seed });
  if(who === 'idle'){ while(!run.over) BB.step(run, 1/30); return run; }
  const rnd = BB.mulberry(seed ^ 0x5bd1e995), gauss = gaussFrom(rnd), dt = 1/30;
  let wait = 0, mode = 'idle', stroke = null, hold = 0;
  const targets = () => { const sh = run.sheet, out = []; for(let j = 0; j < sh.rows; j++){ const a = sh.spI[j]; for(let k = 0; k < a.length; k++){ const t = sh.spT[j][k]; if(t >= 2 && t !== 6 && BB.isIntact(sh, a[k], j)) out.push({ x: BB.cx(a[k], j), y: BB.cy(j), t }); } } for(const g of sh.giants) if(g.alive) out.push({ x: g.x, y: g.y, t: 6 }); return out; };
  const firstIntact = () => { const sh = run.sheet; for(let j = 0; j < sh.rows; j++) for(let w = 0; w < sh.words; w++){ const m = sh.bits[j*sh.words + w] & ~sh.smask[j*sh.words + w]; if(m){ const i = w*32 + (31 - Math.clz32(m & -m)); return { x: BB.cx(i, j), y: BB.cy(j) }; } } return null; };
  while(!run.over && run.t < 400){
    BB.takeEvents(run);
    const sh = run.sheet, s = human.screen / sh.W;
    if(run.slide > 0){ if(run.down) BB.release(run); mode = 'idle'; BB.step(run, dt); continue; }
    wait -= dt;
    if(mode === 'hold'){ hold -= dt; if(hold <= 0){ BB.release(run); mode = 'idle'; wait = .05; } }
    else if(mode === 'stroke'){ stroke.x += human.swipe/s*dt; BB.drag(run, stroke.x, stroke.y); if(run.budget < 1 || stroke.x > sh.W + 1){ BB.release(run); mode = 'idle'; wait = .12 + run.P.refill*(1 - run.budget/Math.max(1, run.P.budget)); } }
    else if(mode === 'loop'){ stroke.a += human.swipe/s/stroke.r*dt; BB.drag(run, stroke.x + Math.cos(stroke.a)*stroke.r, stroke.y + Math.sin(stroke.a)*stroke.r); if(stroke.a > 2*Math.PI + .6){ BB.release(run); mode = 'idle'; wait = .15; } }
    else if(wait <= 0){
      const P = run.P, ts = targets();
      const perTap = Math.max(1, Math.PI*P.reach*P.reach/SQ*.8)*(P.wave ? P.wave*P.wave : 1), perPitch = Math.max(1, 2*P.reach/SQ);
      const swipeYield = P.budget ? P.budget/(P.budget/perPitch/(human.swipe/s) + P.refill + .12) : 0;
      let tgt = null, bd = Infinity; for(const t of ts){ const d = Math.hypot(t.x - run.x, t.y - run.y) - (t.t === 7 ? 1e6 : 0); if(d < bd){ bd = d; tgt = t; } }
      if(tgt){ BB.press(run, tgt.x + gauss()*human.aim/s, tgt.y + gauss()*human.aim/s); if(tgt.t === 2 && !P.iron){ mode = 'hold'; hold = P.holdTime + .08; } else { BB.release(run); wait = 1/human.taps; } }
      else { const f = firstIntact(); if(!f) wait = .1;
        else if(P.lasso){ const r = Math.min(sh.W, sh.H)*.3, cxl = Math.min(sh.W - r, Math.max(r, f.x + r*.6)), cyl = Math.min(sh.H - r, Math.max(r, f.y + r*.6)); stroke = { x: cxl, y: cyl, r, a: 0 }; BB.press(run, cxl + r, cyl); mode = 'loop'; }
        else if(swipeYield > perTap*human.taps){ const y = f.y + Math.min(P.reach, 1)*.5; BB.press(run, f.x - .2, y); mode = 'stroke'; stroke = { x: f.x - .2, y }; }
        else { BB.press(run, f.x + gauss()*human.aim/s + Math.min(P.reach*.6, 3), f.y + gauss()*human.aim/s + Math.min(P.reach*.5, 3)); BB.release(run); wait = 1/human.taps; } }
    }
    BB.step(run, dt);
  }
  return run;
}
const STAGE_NODES = ['ship', 'factory', 'city', 'world'];
function career(seed, maxMin){
  const S = BB.newState(), rnd = BB.mulberry(seed);
  let clock = 0, gains = [], since = 0; const log = [], at = {}, cycles = [], jobs = [];
  const mark = k => { if(at[k] == null) at[k] = clock/60; };
  while(clock < maxMin*60){
    const fresh = S.cycleRuns === 0;
    const run = playBreak(S, (rnd()*1e9)|0); clock += run.t + 4; since++;
    BB.autoBuy(S, n => n.id === (S.quits % 2 ? { A:'thorough', B:'wave' } : { A:'rhythm', B:'bang' })[n.fork]);
    const levels = Object.values(S.lv).reduce((a, b) => a + b, 0) - 1, maxLevels = BB.RUN.reduce((a, n) => a + (n.fork ? n.max/2 : n.max), 0) - 1;
    if(fresh) cycles.push({ stage: S.stage, firstBreakLevels: levels, of: maxLevels });
    log.push({ min: clock/60, stage: S.stage, t: run.t, pops: run.pops, pps: run.pops/run.t, earned: run.earned, orders: BB.ordersDone(S) });
    const g = BB.quitGain(S); gains.push(g); if(gains.length > 4) gains.shift();
    const stalled = gains.length === 4 && g > 0 && g < gains[0]*1.12;
    if(g > 0 && (g >= 2*(S.callusesEarned + 2) || stalled || since > 60)){
      const job = { stage: S.stage, breaks: S.cycleRuns, earned: S.cycleEarned, min: clock/60, orders: BB.ordersDone(S) }; job.gain = BB.quit(S); jobs.push(job); since = 0; gains = []; if(S.quits === 1) mark('firstQuit');
      for(let guard = 0; guard < 60; guard++){
        const pri = STAGE_NODES.map(id => BB.CAREER_BY[id]).find(n => BB.careerVisible(S, n) && BB.cl(S, n.id) < n.max);
        if(pri && BB.canBuyCareer(S, pri)){ BB.buyCareer(S, pri.id); continue; }
        const cand = BB.CAREER.filter(n => BB.canBuyCareer(S, n) && !STAGE_NODES.includes(n.id)).sort((a, b) => BB.careerCost(S, a) - BB.careerCost(S, b));
        if(pri && cand.length && BB.careerCost(S, pri) < 3*S.calluses && BB.careerCost(S, cand[0]) > .15*S.calluses) break;
        if(!cand.length) break; BB.buyCareer(S, cand[0].id);
      }
      for(const id of STAGE_NODES) if(BB.cl(S, id)) mark(id);
      if(BB.cl(S, 'world')) break;
    }
  }
  return { S, log, at, cycles, jobs };
}

/* ---------------- idle ---------------- */
if(suites.includes('idle')){
  section('idle');
  const S = BB.newState(); const run = playBreak(S, 7, 'idle');
  check(run.earned === 0, 'a break without touching the wrap earns nothing');
  // with every machine level bought, the machine alone is still well behind a player
  const mk = () => { const S = BB.newState(); Object.assign(S.lv, { cup:5, thumb:4, premium:10, strength:6, delivery:6, gold:4, machine:4, shift:3, stamina:3 }); return S; };
  let idle = 0, played = 0; for(let k = 0; k < 4; k++){ idle += playBreak(mk(), 30 + k, 'idle').earned; played += playBreak(mk(), 30 + k).earned; }
  console.log(`  machine alone: ${(idle/played*100).toFixed(1)} % of a player`);
  check(idle > 0 && idle < played*.4, `a fully built machine earns ${(idle/played*100).toFixed(0)} % of what a player earns in the same break (under 40 %)`);
  const mkCity = () => { const S = mk(); S.stage = S.unlocked = 3; S.cl.hydraulic = 2; return S; };
  let idleC = 0, playedC = 0; for(let k = 0; k < 2; k++){ idleC += playBreak(mkCity(), 60 + k, 'idle').earned; playedC += playBreak(mkCity(), 60 + k).earned; }
  console.log(`  city convoy alone: ${(idleC/playedC*100).toFixed(1)} % of a player`);
  check(idleC > 0 && idleC < playedC*.4, `in the city too: the convoy earns ${(idleC/playedC*100).toFixed(0)} % of a player (under 40 %)`);
}

/* ---------------- pacing ---------------- */
if(suites.includes('pacing')){
  section('pacing');
  const win = { firstQuit: [8, 25], ship: [14, 45], factory: [30, 80], city: [55, 120], world: [110, 200] };
  for(const seed of [1, 2]){
    const t0 = performance.now(), c = career(seed, 300), dur = ((performance.now() - t0)/1000).toFixed(0);
    console.log(`  seed ${seed}: first quit ${c.at.firstQuit?.toFixed(0)} min, warehouse ${c.at.ship?.toFixed(0)}, factory ${c.at.factory?.toFixed(0)}, city ${c.at.city?.toFixed(0)}, world ${c.at.world?.toFixed(0)} (${dur} s to simulate)`);
    for(const [k, [lo, hi]] of Object.entries(win)) check(c.at[k] != null && c.at[k] >= lo && c.at[k] <= hi, `seed ${seed}: ${k} within ${lo}-${hi} min`, `at ${c.at[k] == null ? 'never' : c.at[k].toFixed(1)}`);
    const longest = Math.max(...c.log.map(r => r.t));
    check(longest <= 90, `seed ${seed}: no break runs past 90 s (longest ${longest.toFixed(0)} s)`);
    check(c.log.every(r => r.pops > 0), `seed ${seed}: every break pops something`);
    const pps = [0, 1, 2, 3].map(k => c.log.filter(r => r.stage === k).map(r => r.pps)), top = pps.map(a => Math.max(...a));
    check(pps.every(a => a.length) && top[2] > 100*top[0] && top[3] > 20*top[2], `seed ${seed}: each workplace pops far faster than the last (desk ${fmtN(top[0])}/s, factory ${fmtN(top[2])}/s, city ${fmtN(top[3])}/s)`);
    const easy = c.cycles.filter(x => x.firstBreakLevels > .5*x.of);
    check(!easy.length, `seed ${seed}: no job hands over more than half its break tree after one break`, easy.map(x => `stage ${x.stage}: ${x.firstBreakLevels}/${x.of}`).join(', '));
    const perStage = [0, 1, 2, 3].map(k => c.cycles.filter(x => x.stage === k).length);
    check(perStage.every(n => n >= 1 && n <= 4), `seed ${seed}: one to four jobs per workplace (${perStage.join(', ')})`);
    const withOrders = c.jobs.filter(j => j.orders > 0).length;
    check(withOrders >= c.jobs.length*.6, `seed ${seed}: orders get done along the way (in ${withOrders} of ${c.jobs.length} jobs)`);
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
