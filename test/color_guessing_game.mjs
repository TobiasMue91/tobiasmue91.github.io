#!/usr/bin/env node
// Test suite for games/color_guessing_game.html (Six Digits).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page asks the player to mix a hex
// code by eye and then tells them how close they came, and what each bar should have been. A wrong
// colour difference, a tick drawn where the target was not, a note that says "too dark" of a mix
// that was too light, or a daily sheet that differs between two phones would all look fine from
// the page. No browser, no server.
//
//   node test/color_guessing_game.mjs                 # everything
//   node test/color_guessing_game.mjs colour notes    # named suites only
//   node test/color_guessing_game.mjs --page=path.html
//
// Suites:
//   colour  - CIEDE2000 against Sharma, Wu & Dalal's published pairs; hex, HSL and Lab round trips
//   score   - the curve: ten for a match, falling steadily, five at dE 10
//   sheet   - the daily sheet: the same on every device, five distinct targets spread round the
//             wheel and through the lightness bands, starts far from the target
//   notes   - every word under every bar is true of the mix, and the ticks sit where the target is
//   record  - stamps once and in order, streaks across days, old or broken saves, the share line
//   bots    - careful, sloppy and random players score in that order, and a perfect one gets 50

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'color_guessing_game.html');
const ALL = ['colour', 'score', 'sheet', 'notes', 'record', 'bots'];
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
vm.runInContext(core[1] + '\nthis.C = SixCore;', ctx);
const C = ctx.C;

function stream(a) { return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const randHex = r => '#' + [0, 0, 0].map(() => Math.floor(r() * 256).toString(16).padStart(2, '0')).join('').toUpperCase();
const days = (from, n) => { const out = []; let t = Date.UTC(...from); for (let i = 0; i < n; i++, t += 864e5) { const d = new Date(t); out.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')); } return out; };

// ---------------------------------------------------------------------------------------------
if (suites.includes('colour')) {
  section('colour');
  // Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula: implementation notes,
  // supplementary test data, and mathematical observations", table 1 - all but pair 14, whose
  // answer turns on the last bit of atan2 (the same exclusion colour-science makes)
  const S = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412], [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0000], [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0000],
    [[50, 0, 0], [50, -1, 2], 2.3669], [[50, -1, 2], [50, 0, 0], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792], [[50, 2.49, -0.001], [50, -2.49, 0.0010], 7.1792],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195], [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
    [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045], [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065], [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977], [[50, 2.5, 0], [56, -27, -3], 31.9030],
    [[50, 2.5, 0], [58, 24, 15], 19.4535], [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0000],
    [[50, 2.5, 0], [50, 3.2972, 0], 1.0000], [[50, 2.5, 0], [50, 1.8634, 0.5757], 1.0000],
    [[50, 2.5, 0], [50, 3.2592, 0.3350], 1.0000], [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630], [[61.2901, 3.7196, -5.3901], [61.4292, 2.2480, -4.9620], 1.8731],
    [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645], [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
    [[36.4612, 47.8580, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146], [[90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441],
    [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381], [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
    [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  let worst = 0;
  for (const [a, b, want] of S) {
    const got = C.deltaE2000(a, b), back = C.deltaE2000(b, a);
    worst = Math.max(worst, Math.abs(got - want));
    check(Math.abs(got - want) < 1e-4, `dE00 ${JSON.stringify(a)} ${JSON.stringify(b)} = ${want}`, `got ${got}`);
    check(Math.abs(got - back) < 1e-9, `dE00 is symmetric for ${JSON.stringify(a)}`, `${got} vs ${back}`);
  }
  console.log(`  ${S.length} Sharma pairs, worst error ${worst.toExponential(2)}`);

  const w = C.rgbToLab([255, 255, 255]), k = C.rgbToLab([0, 0, 0]);
  check(Math.abs(w[0] - 100) < 1e-3 && Math.abs(w[1]) < 1e-3 && Math.abs(w[2]) < 1e-3, 'white is L 100, a 0, b 0', JSON.stringify(w));
  check(Math.abs(k[0]) < 1e-9, 'black is L 0', JSON.stringify(k));
  // sRGB primaries, against the values every colour reference prints
  const red = C.rgbToLab([255, 0, 0]);
  check(Math.abs(red[0] - 53.24) < .02 && Math.abs(red[1] - 80.09) < .03 && Math.abs(red[2] - 67.20) < .03, 'sRGB red is Lab 53.24 80.09 67.20', JSON.stringify(red));

  // every colour the page can show survives hex -> HSL -> hex: the bars can reach every target
  const r = stream(7);
  let bad = 0, firstBad = '';
  for (let i = 0; i < 40000; i++) {
    const hex = randHex(r), [h, s, l] = C.rgbToHsl(C.hexToRgb(hex)), back = C.rgbToHex(C.hslToRgb(h, s, l));
    if (back !== hex) { bad++; firstBad = firstBad || hex + ' -> ' + back; }
  }
  check(bad === 0, '40,000 random colours survive hex -> HSL -> hex', `${bad} did not, e.g. ${firstBad}`);
  for (const hex of ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#808080', '#FFFF00', '#00FFFF', '#FF00FF']) {
    const [h, s, l] = C.rgbToHsl(C.hexToRgb(hex));
    check(C.rgbToHex(C.hslToRgb(h, s, l)) === hex, `${hex} round trips through HSL`);
    check(C.distance(hex, hex) === 0, `${hex} is no distance from itself`);
  }
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('score')) {
  section('score');
  check(C.score(0) === 10, 'a perfect match is 10');
  check(C.score(.4) === 10, 'a difference the eye cannot see is still 10', String(C.score(.4)));
  check(C.score(10) === 5, 'dE 10, plainly a different shade, is 5', String(C.score(10)));
  check(C.score(25) < 2, 'dE 25, a different colour, is under 2', String(C.score(25)));
  let prev = 11, mono = true, oneDp = true, inRange = true;
  for (let d = 0; d <= 120; d += .01) {
    const s = C.score(d);
    if (s > prev) mono = false; prev = s;
    if (Math.abs(s * 10 - Math.round(s * 10)) > 1e-9) oneDp = false;
    if (s < 0 || s > 10) inRange = false;
  }
  check(mono, 'the score never rises as the difference grows');
  check(oneDp, 'every score has one decimal place');
  check(inRange, 'every score is between 0 and 10');
  // the green against blue in the page's first screenshot, for scale
  const s = C.score(C.distance('#10AE28', '#2971B3'));
  check(s < 2, 'green against blue scores under 2', String(s));
  const near = C.score(C.distance('#3A7BD5', '#3E7ED2'));
  check(near >= 9, 'a near-perfect blue scores 9 or more', String(near));
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('sheet')) {
  section('sheet');
  const keys = days([2026, 9, 2], 1500);
  let spreadBad = 0, bandBad = 0, startBad = 0, dupBad = 0, hexBad = 0, greys = 0, easyStart = 0;
  for (const key of keys) {
    const a = C.sheet(key), b = C.sheet(key);
    if (JSON.stringify(a) !== JSON.stringify(b)) { fail('the sheet for ' + key + ' is the same twice'); break; }
    if (a.length !== 5) { fail(key + ' has five rounds', String(a.length)); break; }
    if (a.some(x => !/^#[0-9A-F]{6}$/.test(x.target))) hexBad++;
    if (new Set(a.map(x => x.target)).size !== 5) dupBad++;
    const hsl = a.map(x => C.rgbToHsl(C.hexToRgb(x.target)));
    const chromatic = hsl.filter((x, i) => !C.hueless(a[i].target));
    greys += hsl.filter(x => x[1] < .2).length;
    for (let i = 0; i < chromatic.length; i++) for (let j = i + 1; j < chromatic.length; j++)
      if (Math.abs(C.hueDiff(chromatic[i][0], chromatic[j][0])) < 25) spreadBad++;
    const ls = hsl.map(x => x[2]).sort((x, y) => x - y);
    if (ls[4] - ls[0] < .3) bandBad++;
    for (let i = 0; i < 5; i++) {
      const st = a[i].start, startHex = C.rgbToHex(C.hslToRgb(st.h, st.s, st.l));
      if (Math.abs(C.hueDiff(st.h, hsl[i][0])) < 90) startBad++;
      if (C.score(C.distance(a[i].target, startHex)) >= 6) easyStart++;
    }
  }
  check(hexBad === 0, 'every target is a six-digit hex code', String(hexBad));
  check(dupBad === 0, 'no sheet repeats a target', String(dupBad));
  check(spreadBad === 0, 'the colourful targets of a sheet are at least 25 degrees of hue apart', `${spreadBad} pairs too close`);
  check(bandBad === 0, 'every sheet runs from dark to light (a lightness range of at least .3)', String(bandBad));
  check(startBad === 0, 'every starting mix sits at least 90 degrees round the wheel from its target', String(startBad));
  check(easyStart / (keys.length * 5) < .01, 'leaving the starting mix alone almost never scores 6', `${easyStart} of ${keys.length * 5}`);
  const greyShare = greys / (keys.length * 5);
  check(greyShare > .04 && greyShare < .15, 'near-greys (vividness under .2) turn up now and then, not every day', greyShare.toFixed(3));
  check(JSON.stringify(C.sheet('2026-10-02')) !== JSON.stringify(C.sheet('2026-10-03')), 'tomorrow is a different sheet');

  check(C.dayNo('2026-10-02') === 1, 'the first day is No. 1');
  check(C.dayNo('2027-10-02') === 366, 'a year on is No. 366', String(C.dayNo('2027-10-02')));
  check(C.prevKey('2027-03-01') === '2027-02-28', 'the day before 1 March 2027 is 28 February');
  check(C.prevKey('2028-03-01') === '2028-02-29', 'and in 2028, 29 February');
  check(C.dayKey(new Date(2026, 11, 31, 23, 59)) === '2026-12-31', 'the day is the local date');
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('notes')) {
  section('notes');
  const r = stream(11);
  let wrong = 0, firstWrong = '';
  const note = msg => { wrong++; firstWrong = firstWrong || msg; };
  for (let i = 0; i < 50000; i++) {
    const t = randHex(r), [th, ts, tl] = C.rgbToHsl(C.hexToRgb(t));
    // mixes near the target as often as far from it, so every threshold is crossed
    const near = r() < .5, sp = near ? .12 : 1;
    const y = [((th + (r() - .5) * 360 * sp) + 360) % 360, Math.min(1, Math.max(0, ts + (r() - .5) * 2 * sp)), Math.min(1, Math.max(0, tl + (r() - .5) * 2 * sp))];
    const n = C.notes(t, y), ds = y[1] - ts, dl = y[2] - tl, dh = C.hueDiff(y[0], th);
    // spot on says nothing, close says which way softly, far says it plainly
    const word = (d, lim, soft, lo, hi) => Math.abs(d) <= lim.spot ? '' : (Math.abs(d) <= lim.close ? soft : 'Too ') + (d < 0 ? lo : hi);
    if (n.sat.word !== word(ds, C.SAT, 'A touch ', 'grey', 'vivid')) note(`sat ${t} ${y} said ${n.sat.word}`);
    if (n.light.word !== word(dl, C.LIGHT, 'A touch ', 'dark', 'light')) note(`light ${t} ${y} said ${n.light.word}`);
    if (n.sat.ok !== (Math.abs(ds) <= C.SAT.close) || n.light.ok !== (Math.abs(dl) <= C.LIGHT.close)) note(`ok flags ${t} ${y}`);
    if (C.hueless(t)) { if (n.hue.word !== '' || n.hue.target !== null) note(`grey ${t} said ${n.hue.word}`); }
    else {
      const a = Math.abs(dh);
      if (a <= C.HUE.spot && n.hue.word !== '') note(`hue ${t} ${y} said ${n.hue.word}`);
      else if (a > C.HUE.spot) {
        const lead = a <= C.HUE.close ? 'A touch ' : 'Too ', f = n.hue.word.slice(lead.length);
        // the colour named is the one the mix leaned to: never the target's own family, and on
        // the mix's side of the target
        if (!n.hue.word.startsWith(lead) || f === C.family(th)) note(`hue ${t} ${y} said ${n.hue.word}`);
        // and it lies between the target and the mix, or just past the mix
        let between = false;
        for (let k = 0; k <= Math.abs(dh) + 90; k += 1) if (C.family(th + Math.sign(dh) * k) === f) { between = true; break; }
        if (!between) note(`hue ${t} ${y} named ${f} on the wrong side`);
      }
      if (Math.abs(n.hue.target - th) > 1e-9) note(`hue tick for ${t} at ${n.hue.target}, target ${th}`);
    }
    if (Math.abs(n.sat.target - ts) > 1e-9 || Math.abs(n.light.target - tl) > 1e-9) note(`ticks for ${t}`);
  }
  check(wrong === 0, '50,000 mixes: every word under every bar is true of the mix', `${wrong} wrong, e.g. ${firstWrong}`);

  // a player who puts each knob exactly on its tick has the target
  let off = 0, worstS = 10;
  for (let i = 0; i < 20000; i++) {
    const t = randHex(r), n = C.notes(t, [0, 0, 0]);
    // where the hue bar does not matter, any hue will do: the knob is left wherever it lands
    const h = n.hue.target === null ? r() * 360 : n.hue.target;
    const hex = C.rgbToHex(C.hslToRgb(h, n.sat.target, n.light.target));
    const s = C.score(C.distance(t, hex));
    worstS = Math.min(worstS, s);
    if (s < (n.hue.target === null ? 9.5 : 10)) off++;
  }
  check(off === 0, '20,000 targets: knobs set on the ticks score 10 (9.5 where the hue says any)', `${off} did not, worst ${worstS}`);
  const same = C.notes('#3A7BD5', C.rgbToHsl(C.hexToRgb('#3A7BD5')));
  check(same.hue.level === 'spot' && same.sat.level === 'spot' && same.light.level === 'spot' && !same.hue.word + !same.sat.word + !same.light.word === 3, 'the target itself is spot on three times, and nothing is said');
  const blueViolet = C.notes('#3A7BD5', C.rgbToHsl(C.hexToRgb('#7C66C6')));
  check(blueViolet.hue.word === 'Too violet', 'a violet mix for a blue target is too violet', blueViolet.hue.word);
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('record')) {
  section('record');
  const s = C.blank();
  const t0 = C.sheet('2026-10-02');
  check(C.stamp(s, '2026-10-02', 1, '#000000') === null, 'round 2 cannot be stamped before round 1');
  const rec = C.stamp(s, '2026-10-02', 0, t0[0].target);
  check(rec && rec.s === 10 && rec.t === t0[0].target, 'stamping the target scores 10 and records it');
  check(C.stamp(s, '2026-10-02', 0, '#000000') === null, 'a stamped round cannot be stamped again');
  for (let i = 1; i < 5; i++) C.stamp(s, '2026-10-02', i, '#808080');
  check(C.stamp(s, '2026-10-02', 5, '#808080') === null, 'there is no sixth round');
  check(C.done(s.days['2026-10-02']), 'five stamps finish the day');
  const tot = C.total(s.days['2026-10-02']);
  const want = Math.round(s.days['2026-10-02'].r.reduce((a, x) => a + x.s, 0) * 10) / 10;
  check(tot === want, 'the total is the sum of the five scores', `${tot} vs ${want}`);
  check(C.streak(s, '2026-10-02') === 1, 'one finished day is a streak of 1');
  check(C.streak(s, '2026-10-03') === 1, 'the streak still stands the next morning, before playing');
  check(C.streak(s, '2026-10-04') === 0, 'a missed day ends it');
  for (const k of ['2026-10-03', '2026-10-04']) for (let i = 0; i < 5; i++) C.stamp(s, k, i, '#FFFFFF');
  check(C.streak(s, '2026-10-04') === 3, 'three days running is a streak of 3');
  for (let i = 0; i < 3; i++) C.stamp(s, '2026-10-05', i, '#FFFFFF');
  check(C.streak(s, '2026-10-05') === 3, 'a half-played day neither adds nor breaks', String(C.streak(s, '2026-10-05')));
  check(C.played(s) === 3, 'three sheets played');
  check(C.best(s) >= tot, 'best is the best total');

  const back = C.load(JSON.stringify(s));
  check(JSON.stringify(back.days) === JSON.stringify(s.days), 'a save round trips through storage');
  check(JSON.stringify(C.load('nonsense')) === JSON.stringify(C.blank()), 'a broken save starts fresh');
  check(JSON.stringify(C.load(null)) === JSON.stringify(C.blank()), 'no save starts fresh');
  const dirty = C.load(JSON.stringify({v: 1, days: {'2026-10-02': {r: [{t: '#3A7BD5', y: 'nope', s: 3}, {t: '#3A7BD5', y: '#000000', s: 1}]}, 'yesterday': {r: []}}}));
  check(dirty.days['2026-10-02'].r.length === 1 && !dirty.days.yesterday, 'a save with damaged rounds keeps only the sound ones');

  // the habit named at the end of a sheet is what the bars said, counted again here
  const rt = stream(3);
  let habitBad = 0, kinds = {lean: 0, strong: 0, none: 0};
  for (let i = 0; i < 4000; i++) {
    const e = [];
    const bias = [(rt() - .5) * .3, (rt() - .5) * .2];
    for (let k = 0; k < 5; k++) {
      const t = randHex(rt), [h, sa, l] = C.rgbToHsl(C.hexToRgb(t));
      e.push({t, y: C.rgbToHex(C.hslToRgb(h + (rt() - .5) * 30, Math.min(1, Math.max(0, sa + bias[0] + (rt() - .5) * .2)), Math.min(1, Math.max(0, l + bias[1] + (rt() - .5) * .1)))), s: 0});
    }
    const ns = e.map(x => C.notes(x.t, C.rgbToHsl(C.hexToRgb(x.y))));
    const hb = C.habit(e);
    kinds[hb ? hb.kind : 'none']++;
    if (hb && hb.kind === 'lean') {
      const sign = {grey: -1, vivid: 1, dark: -1, light: 1}[hb.word];
      const n = ns.filter(x => x[hb.bar].level !== 'spot' && Math.sign(x[hb.bar].d) === sign).length;
      if (n !== hb.n || n < 3) habitBad++;
      // and no other lean was more common
      for (const bar of ['sat', 'light']) for (const sg of [-1, 1]) if (ns.filter(x => x[bar].level !== 'spot' && Math.sign(x[bar].d) === sg).length > hb.n) habitBad++;
    } else if (hb) {
      const n = ns.filter(x => x[hb.bar].level === 'spot' && !(hb.bar === 'hue' && x.hue.target === null)).length;
      if (n !== hb.n || n < 2) habitBad++;
    }
  }
  check(habitBad === 0, 'the habit named at the end of a sheet is what the bars said', String(habitBad));
  check(kinds.lean > 0 && kinds.strong > 0, 'sheets end with a lean, or a strong suit', JSON.stringify(kinds));
  check(C.habit([]) === null, 'no rounds, no habit');

  const line = C.shareText(s.days['2026-10-02'], 1, 'https://example.org');
  check(!/#[0-9A-F]{6}/i.test(line), 'the share line gives away no colour', line);
  check(line.includes('No. 1') && line.includes('/50') && line.split('·').length === 5, 'the share line has the number, the total and five scores', line);
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('bots')) {
  section('bots');
  // each bot reads the target, aims for it in HSL with a person's error, and stamps
  const play = (key, err, r) => {
    const s = C.blank();
    for (let i = 0; i < 5; i++) {
      const t = C.sheet(key)[i].target, [h, sa, l] = C.rgbToHsl(C.hexToRgb(t));
      const y = err === null ? [r() * 360, r(), r()] : [h + (r() - .5) * 2 * err.h, Math.min(1, Math.max(0, sa + (r() - .5) * 2 * err.s)), Math.min(1, Math.max(0, l + (r() - .5) * 2 * err.l))];
      C.stamp(s, key, i, C.rgbToHex(C.hslToRgb(y[0], y[1], y[2])));
    }
    return C.total(s.days[key]);
  };
  const keys = days([2026, 9, 2], 600), r = stream(5);
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const perfect = keys.map(k => play(k, {h: 0, s: 0, l: 0}, r));
  const careful = keys.map(k => play(k, {h: 8, s: .08, l: .05}, r));
  const sloppy = keys.map(k => play(k, {h: 30, s: .25, l: .15}, r));
  const random = keys.map(k => play(k, null, r));
  check(perfect.every(x => x === 50), 'a perfect player scores 50 every day');
  const m = [med(careful), med(sloppy), med(random)];
  console.log(`  median sheet: careful ${m[0]}, sloppy ${m[1]}, random ${m[2]}`);
  check(m[0] >= 33 && m[0] <= 47, 'a careful player usually scores between 33 and 47', String(m[0]));
  check(m[1] >= 12 && m[1] <= 30, 'a sloppy one between 12 and 30', String(m[1]));
  check(m[2] <= 10, 'a player who stamps at random about 10 or less', String(m[2]));
  check(m[0] > m[1] && m[1] > m[2], 'better play scores more');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
