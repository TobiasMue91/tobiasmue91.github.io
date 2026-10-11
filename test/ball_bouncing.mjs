#!/usr/bin/env node
// Test suite for games/ball_bouncing.html (Kemari, keepie-uppie on a court that turns through the year).
//
// Runs the page's DOM-free <script id="core"> block in Node. The promises a player cannot check from the page:
// the same taps at the same moments give the same rally at any frame rate; a kick never sends the ball out of
// the court or above its top, on any screen shape and at any tempo; a tap touches the ball exactly when it is
// within reach (and a thumb reaches further than a mouse); a rising ball cannot be kicked again, so drumming on
// it earns nothing; the side you touch sends the ball the other way and a clean touch sends it straight up; the
// seasons turn every 25 kicks and a year every 100; a dropped ball comes to rest; the wind never makes a rally
// impossible; players with a person's reaction time are paid in order of their care; and the record trusts
// nothing it reads. No browser, no server.
//
//   node test/ball_bouncing.mjs            all suites
//   node test/ball_bouncing.mjs bots wind  some of them

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'ball_bouncing.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core');
const T = Core.TUNE, r = T.r;

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; if (fails < 200) console.log('  FAIL', m); } };
// court half-widths of a phone, a tablet, a laptop and an ultra-wide screen
const HWS = [0.27, 0.42, 0.9, 1.5];

// a player: sees the ball as it was a reaction time ago and, as people do with a falling ball, carries that
// sighting forward along its arc to judge where it is now, a little wrong; taps once it judges the ball low enough.
// care: how well they aim the offset that steers the ball home; noise: how far their taps stray (in radii);
// slack: how much their sense of the arc drifts, in radii per second of reaction time.
function player(s, {rt = 0.22, noise = 0.25, care = 1, low = 0.3, slack = 1, jit = 0.03, seed = 1, dt = 1 / 60, max = 600, touch = true, until} = {}) {
  const R = Core.rng(seed * 7919 + 1);
  const seen = [];
  let t = 0, ev = [], aim = r * 1.8 + R() * (low - r * 1.8), cool = 0;
  ev.push(...Core.kick(s, (R() - 0.5) * 0.3));
  while (t < max && s.phase === 'air') {
    ev.push(...Core.step(s, dt)); t += dt; cool -= dt;
    seen.push({x: s.x, y: s.y, vx: s.vx, vy: s.vy});
    const v = seen[seen.length - 1 - Math.round(rt / dt)];
    if (!v || cool > 0) continue;
    const g = Core.gravity(s.kicks), gauss = () => (R() + R() + R() - 1.5) * 2;
    if (v.vy + -g * rt > 0 || v.y + v.vy * rt - g * rt * rt / 2 > aim + r * 0.2) continue;
    // the finger lands a little early or late: the ball has moved on by then
    const lt = rt + gauss() * jit;
    const ex = v.x + v.vx * lt + (R() - 0.5) * slack * rt * r, ey = v.y + v.vy * lt - g * lt * lt / 2 + (R() - 0.5) * slack * rt * r;
    // steer: touch the side away from where it should go, more the further it is from the middle
    const want = -Math.max(-1, Math.min(1, (ex / s.hw) * 1.6)) * care;
    const u = Math.max(-1, Math.min(1, -want * 0.6 + (R() - 0.5) * 2 * noise));
    const e = Core.tap(s, ex + u * r, ey + (R() - 0.5) * noise * r, touch);
    ev.push(...e);
    cool = 0.12;
    if (e[0].type === 'kick') { seen.length = 0; aim = r * 1.8 + R() * (low - r * 1.8); }
    if (until && until(s)) break;
  }
  return {kicks: s.kicks, ev, t};
}

const suites = {
  // the same taps at the same times are the same rally at 30, 60 and 144 fps
  frames() {
    for (const hw of HWS) {
      const runs = [1 / 30, 1 / 60, 1 / 144].map(dt => {
        const s = Core.create({hw, seed: 5}); const out = [];
        Core.kick(s, 0.4);
        let t = 0, next = 0.9, i = 0;
        while (t < 30 && s.phase === 'air') {
          // a tap is applied at the start of the frame it lands in; times are multiples of 1/720 so all agree
          const e = Core.step(s, dt); t += dt;
          if (t >= next) { const u = [-0.6, 0.1, 0.8, -0.2][i++ % 4]; Core.kick(s, u); next += 0.9; out.push([s.x.toFixed(3), s.y.toFixed(3)]); }
          void e;
        }
        return {kicks: s.kicks, out};
      });
      // frame rates disagree only by up to one frame of tap timing; the rally length must match closely
      const ks = runs.map(r => r.kicks);
      ok(Math.max(...ks) - Math.min(...ks) <= 1, `hw ${hw}: kicks at 30/60/144 fps ${ks}`);
    }
    // physics alone (no taps) is exactly frame-rate independent
    for (const hw of HWS) {
      const end = [1 / 30, 1 / 60, 1 / 144, 1 / 37].map(dt => {
        const s = Core.create({hw, seed: 9}); Core.kick(s, 0.7);
        for (let t = 0; t < 4; t += dt) Core.step(s, dt);
        return [s.x, s.y, s.phase].join();
      });
      ok(new Set(end).size === 1, `hw ${hw}: a free flight differs by frame rate: ${end.join(' | ')}`);
    }
  },

  // no kick, at any tempo, from anywhere, sends the ball above the court or out of its sides
  bounds() {
    for (const hw of HWS) for (let k = 0; k <= 400; k += 7) for (const y0 of [r, 0.2, 0.4, 0.6]) for (const u of [-1, -0.5, 0, 0.3, 1]) {
      const s = Core.create({hw, seed: k + 1}); Core.kick(s, 0); s.kicks = k; s.x = (u * 0.7) * (hw - r); s.y = y0; s.vy = -0.5; s.vx = u * 2;
      Core.kick(s, u);
      let top = 0;
      for (let t = 0; t < 6 && s.phase === 'air'; t += 1 / 60) {
        Core.step(s, 1 / 60); top = Math.max(top, s.y + r);
        if (s.x < -hw + r - 1e-9 || s.x > hw - r + 1e-9) { ok(false, `hw ${hw} k ${k}: ball left the court at x ${s.x}`); break; }
      }
      ok(top <= 1 + 1e-9, `hw ${hw} k ${k} y ${y0} u ${u}: ball rose to ${top.toFixed(3)}`);
    }
    // a kick taken low always gives the player time: at least 0.6 s before the ball is back at kicking height, at any tempo
    for (const k of [0, 25, 100, 200, 400]) {
      const s = Core.create({hw: 0.5}); Core.kick(s, 0); s.kicks = k; s.y = 2 * r; s.vy = -1;
      Core.kick(s, 0.5); let t = 0;
      while (!(s.vy < 0 && s.y <= 2 * r) && t < 5) { Core.step(s, 1 / 240); t += 1 / 240; }
      ok(t >= 0.6, `k ${k}: back at kicking height after ${t.toFixed(2)} s`);
      ok(t <= 1.8, `k ${k}: a rally this slow is no game (${t.toFixed(2)} s)`);
    }
  },

  // a tap touches the ball when it is within reach and not beyond it; a thumb reaches further than a mouse
  reach() {
    const s = Core.create({hw: 0.6}); Core.kick(s, 0);
    for (let t = 0; t < 0.4; t += 1 / 60) Core.step(s, 1 / 60);
    const cx = s.x, cy = s.y - T.below * r;
    for (let a = 0; a < 6.28; a += 0.2) for (const [kind, reach] of [[false, T.reach], [true, T.reachTouch]]) {
      const inside = Core.touch(s, cx + Math.cos(a) * reach * r * 0.995, cy + Math.sin(a) * reach * r * 0.995, kind);
      const outside = Core.touch(s, cx + Math.cos(a) * reach * r * 1.005, cy + Math.sin(a) * reach * r * 1.005, kind);
      ok(inside !== null, `${kind ? 'thumb' : 'mouse'} just inside reach at angle ${a.toFixed(1)} missed`);
      ok(outside === null, `${kind ? 'thumb' : 'mouse'} just outside reach at angle ${a.toFixed(1)} touched`);
    }
    ok(T.reachTouch > T.reach, 'a thumb must reach further than a mouse');
    // the offset across the ball is where the tap is, left to right
    ok(Core.touch(s, s.x - 0.5 * r, s.y, true) < 0 && Core.touch(s, s.x + 0.5 * r, s.y, true) > 0, 'offset has the wrong sign');
  },

  // you kick a falling ball: drumming on a rising one earns nothing
  drum() {
    for (const hw of HWS) {
      const s = Core.create({hw}); Core.kick(s, 0); let early = 0, peaks = 0, prevVy = s.vy;
      for (let t = 0; t < 8 && s.phase === 'air'; t += 1 / 60) {
        Core.step(s, 1 / 60);
        if (prevVy > 0 && s.vy <= 0) peaks++;
        prevVy = s.vy;
        // a drummer taps the middle of the ball every frame
        const e = Core.tap(s, s.x, s.y, true);
        if (e[0].type === 'early') early++;
      }
      ok(s.kicks <= peaks + 1, `hw ${hw}: drumming made ${s.kicks} kicks over ${peaks} peaks`);
      ok(early > 0, `hw ${hw}: a rising ball was never refused`);
    }
  },

  // touching the left of the ball sends it right, the right sends it left, the middle straight up
  steer() {
    for (const hw of HWS) {
      const kickAt = u => { const s = Core.create({hw}); Core.kick(s, 0); s.vx = 0; s.vy = -1; s.y = 0.2; const e = Core.kick(s, u); return {s, e}; };
      ok(kickAt(-0.8).s.vx > 0, `hw ${hw}: a touch on the left did not send it right`);
      ok(kickAt(0.8).s.vx < 0, `hw ${hw}: a touch on the right did not send it left`);
      const c = kickAt(0.1);
      ok(c.s.vx === 0 && c.e[0].clean, `hw ${hw}: a touch near the middle is not clean and straight`);
      ok(kickAt(-1).s.vx > kickAt(-0.5).s.vx, `hw ${hw}: a touch further out does not steer harder`);
      // a clean kick climbs a little higher than an off-centre one
      ok(kickAt(0).s.vy > kickAt(0.6).s.vy, `hw ${hw}: a clean kick does not climb higher`);
    }
    // a run of clean kicks is counted, and an off-centre one ends it
    const s = Core.create({hw: 0.6}); let st = [];
    for (const u of [0, 0.1, -0.1, 0.7, 0]) { s.vy = -1; s.phase = s.phase === 'ready' ? 'ready' : 'air'; st.push(Core.kick(s, u)[0].streak); }
    ok(st.join() === '1,2,3,0,1', `streaks ${st}`);
  },

  // seasons turn every 25 kicks, years every 100, and each is announced exactly once
  seasons() {
    const s = Core.create({hw: 0.6}); const seen = [];
    for (let i = 0; i < 260; i++) { s.vy = -1; for (const e of Core.kick(s, 0)) if (e.type === 'season') seen.push([e.kicks, e.season, e.year].join(':')); }
    ok(seen.join(' ') === '25:1:1 50:2:1 75:3:1 100:0:2 125:1:2 150:2:2 175:3:2 200:0:3 225:1:3 250:2:3', `season events ${seen.join(' ')}`);
    ok(Core.season(24) === 0 && Core.season(25) === 1 && Core.season(99) === 3 && Core.season(100) === 0, 'season boundaries');
    // the tempo only ever tightens
    for (let k = 1; k < 500; k++) ok(Core.gravity(k) >= Core.gravity(k - 1) && Core.apex(k) <= Core.apex(k - 1), `tempo loosened at ${k}`);
    // a new rally starts from one, whatever came before
    const t = Core.create({hw: 0.6}); Core.kick(t, 0); t.kicks = 77; t.phase = 'rest';
    Core.kick(t, 0); ok(t.kicks === 1, `a new rally started at ${t.kicks}`);
  },

  // a dropped ball bounces, rolls and stops: round things must come to rest
  rest() {
    for (const hw of HWS) for (let seed = 1; seed <= 20; seed++) {
      const R = Core.rng(seed), s = Core.create({hw, seed});
      Core.kick(s, (R() - 0.5) * 2); s.kicks = Math.floor(R() * 200);
      const ev = []; let t = 0;
      while (s.phase !== 'rest' && t < 12) { ev.push(...Core.step(s, 1 / 60)); t += 1 / 60; }
      ok(s.phase === 'rest', `hw ${hw} seed ${seed}: the ball never came to rest`);
      ok(t < 6, `hw ${hw} seed ${seed}: took ${t.toFixed(1)} s to come to rest`);
      ok(ev.filter(e => e.type === 'drop').length === 1, `hw ${hw} seed ${seed}: dropped other than once`);
      ok(Math.abs(s.y - r) < 1e-9 && s.vx === 0 && s.spin === 0, `hw ${hw} seed ${seed}: at rest but still moving`);
      // and a ball at rest stays put
      const x = s.x; for (let i = 0; i < 300; i++) Core.step(s, 1 / 60);
      ok(s.x === x && s.phase === 'rest', `hw ${hw} seed ${seed}: a resting ball moved`);
    }
  },

  // autumn and winter blow, but a careful player can still keep a rally going through them
  wind() {
    const s = Core.create({hw: 0.6, seed: 3}); Core.kick(s, 0);
    s.kicks = 10; ok(Core.windAt(s, 5) === 0, 'spring should be calm');
    s.kicks = 60; const w = []; for (let t = 0; t < 60; t += 0.5) w.push(Core.windAt(s, t));
    ok(w.some(v => v > 0.02) && w.some(v => v < -0.02), 'autumn wind never changes side');
    ok(Math.max(...w.map(Math.abs)) <= T.wind[2] * Core.span(s) + 1e-9, 'autumn wind stronger than its setting');
    s.kicks = 80; ok(Math.max(...Array.from({length: 120}, (_, i) => Math.abs(Core.windAt(s, i * 0.5)))) > Math.max(...w.map(Math.abs)) * 0.8, 'winter is not windier');
    // a careful player on a phone gets through the windy half of the year on most seeds
    let through = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const t = Core.create({hw: 0.27, seed}); player(t, {seed, rt: 0.2, noise: 0.15, care: 1, slack: 0.6, jit: 0.025, max: 400, until: s => s.kicks >= 100});
      if (t.kicks >= 100) through++;
    }
    ok(through >= 14, `only ${through}/20 careful phone rallies got through a whole year`);
  },

  // players are paid in order of their care; one who never steers drifts into the walls and the sand
  bots() {
    const kinds = [
      ['careful', {rt: 0.2, noise: 0.15, care: 1, slack: 0.6, jit: 0.025}],
      ['casual', {rt: 0.25, noise: 0.45, care: 0.6, slack: 1.5, jit: 0.045}],
      ['sloppy', {rt: 0.3, noise: 0.8, care: 0.2, slack: 3, jit: 0.07}],
    ];
    for (const [hw, touch] of [[0.27, true], [0.9, false]]) {
      const med = {};
      for (const [name, o] of kinds) {
        const ks = [];
        for (let seed = 1; seed <= 25; seed++) { const s = Core.create({hw, seed}); ks.push(player(s, {...o, seed, touch, max: 300}).kicks); }
        ks.sort((a, b) => a - b); med[name] = ks[12];
      }
      console.log(`    hw ${hw}: median kicks careful ${med.careful}, casual ${med.casual}, sloppy ${med.sloppy}`);
      ok(med.careful > med.casual && med.casual > med.sloppy, `hw ${hw}: not ordered by care ${JSON.stringify(med)}`);
      ok(med.sloppy >= 2, `hw ${hw}: a sloppy player gets nothing (${med.sloppy})`);
      ok(med.casual >= 15 && med.casual <= 120, `hw ${hw}: a casual player's rally ${med.casual} is out of the 15..120 band`);
      ok(med.careful >= 60, `hw ${hw}: a careful player only reaches ${med.careful}`);
    }
    // nobody keeps it up by doing nothing
    const s = Core.create({hw: 0.6}); Core.kick(s, 0); let t = 0;
    while (s.phase === 'air' && t < 10) { Core.step(s, 1 / 60); t += 1 / 60; }
    ok(s.phase !== 'air' && s.kicks === 1, 'an untouched ball stayed up');
  },

  // the record kept between visits trusts nothing it reads
  record() {
    const c = Core.clean;
    ok(JSON.stringify(c(null)) === JSON.stringify({best: 0, plays: 0, kicks: 0, muted: false, taught: 0, legacy: 0}), 'empty record');
    // the replaced page's paddle score is kept, never made a best, and marks its player as returning
    const m = Core.migrate(null, '418');
    ok(m.legacy === 418 && m.best === 0 && m.plays === 1, `migrated ${JSON.stringify(m)}`);
    for (const bad of [null, '', 'x', '-3', 'Infinity', '1e99']) { const o = Core.migrate({best: 7}, bad); ok(o.best === 7 && o.legacy >= 0 && o.legacy <= 1e7, `migrate ${bad} -> ${JSON.stringify(o)}`); }
    for (const bad of [{best: -5}, {best: 'x'}, {best: NaN}, {best: Infinity}, {best: 1e99}, {best: [3]}, {best: {}}]) {
      const o = c(bad); ok(Number.isInteger(o.best) && o.best >= 0 && o.best <= 100000, `best from ${JSON.stringify(bad)} -> ${o.best}`);
    }
    ok(c({best: 41.7}).best === 41, 'best not floored');
    ok(c({muted: 'yes'}).muted === false && c({muted: true}).muted === true, 'muted');
    let rec = c({});
    let f = Core.finish(rec, 12); ok(f.best && f.rec.best === 12 && f.rec.plays === 1, 'first rally is a best');
    f = Core.finish(f.rec, 12); ok(!f.best && f.rec.best === 12, 'equalling the best is not a new best');
    f = Core.finish(f.rec, 30); ok(f.best && f.rec.best === 30 && f.rec.plays === 3 && f.rec.kicks === 54, 'a better rally');
    f = Core.finish(f.rec, -4); ok(!f.best && f.rec.best === 30, 'a negative rally');
  },
};

const pick = process.argv.slice(2);
for (const [name, fn] of Object.entries(suites)) {
  if (pick.length && !pick.includes(name)) continue;
  const f0 = fails; console.log(name); fn();
  console.log(fails === f0 ? '  ok' : `  ${fails - f0} failed`);
}
console.log(`${n} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
