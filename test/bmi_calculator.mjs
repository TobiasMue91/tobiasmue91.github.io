#!/usr/bin/env node
// Test suite for tools/bmi_calculator.html (BMI Calculator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises a BMI and a category a
// person can trust without checking elsewhere, so the expected values here come from the sources, not
// the page: WHO's adult cut-offs (TRS 894) and the lower ones of the WHO 2004 consultation / NICE,
// exact unit definitions (1 lb = 0.45359237 kg, 1 in = 2.54 cm), and for children the percentile
// curves CDC publishes beside its LMS table (bmiagerev.csv, columns P5, P50, P85, P95), which the core
// must reproduce from L, M and S alone. Also: what people type (decimal commas, units, feet and inches,
// stone), the inputs that break tools, and the old page's saved bmiData.
//
//   node test/bmi_calculator.mjs                # everything
//   node test/bmi_calculator.mjs adult child    # named suites only
//
// Suites: adult, child, parse, edges, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'bmi_calculator.html');
const ALL = ['adult', 'child', 'parse', 'edges', 'saves'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URLSearchParams};
vm.runInNewContext(src, ctx);
const B = ctx.module.exports;
const run = f => B.compute(Object.assign({units: 'metric', height: '', weight: '', age: '', sex: '', cut: ''}, f));

if (suites.includes('adult')) {
  section('adult');
  // weight = BMI x h^2 at h = 2 m gives exact boundaries
  const cats = [[63.6, 'Severely underweight'], [64, 'Underweight'], [73.7, 'Underweight'], [73.8, 'Healthy weight'], [74, 'Healthy weight'],
    [99.6, 'Healthy weight'], [100, 'Overweight'], [119.6, 'Overweight'], [120, 'Obesity class I'], [140, 'Obesity class II'], [160, 'Obesity class III'], [400, 'Obesity class III']];
  for (const [kg, name] of cats) eq(run({height: '200', weight: String(kg)}).r.cat.name, name, `200 cm ${kg} kg -> ${name}`);
  eq(run({height: '175', weight: '70'}).r.bmi, 22.9, '175 cm 70 kg -> 22.9');
  near(run({height: '175', weight: '70'}).r.raw, 70 / 1.75 ** 2, 1e-12, 'exact BMI');
  // the number shown and the class always agree: 24.96 shows 25.0 and is Overweight
  const r = run({height: '200', weight: String(24.96 * 4)}).r; eq([r.bmi, r.cat.name], [25, 'Overweight'], 'display and class agree at 24.96');
  const r2 = run({height: '200', weight: String(18.46 * 4)}).r; eq([r2.bmi, r2.cat.name], [18.5, 'Healthy weight'], 'display and class agree at 18.46');
  const r3 = run({height: '200', weight: String(24.94 * 4)}).r; eq([r3.bmi, r3.cat.name], [24.9, 'Healthy weight'], '24.94 stays 24.9');
  // imperial: 5 ft 11 in, 150 lb -> 703 x 150 / 71^2 = 20.92 (the 703 factor is exact to 0.01 %)
  near(run({units: 'us', height: "5'11", weight: '150'}).r.raw, 150 * 0.45359237 / (71 * 0.0254) ** 2, 1e-9, '5 ft 11, 150 lb');
  eq(run({units: 'us', height: "5'11", weight: '150'}).r.bmi, 20.9, '5 ft 11, 150 lb -> 20.9');
  eq(run({units: 'uk', height: '5 9', weight: '11 0'}).r.bmi, 22.7, '5 ft 9, 11 st -> 22.7');
  // lower cut-offs
  const a = (kg) => run({height: '200', weight: String(kg), cut: 'asian'}).r.cat.name;
  eq([a(91.6), a(92), a(109.6), a(110)], ['Healthy weight', 'Overweight', 'Overweight', 'Obesity'], 'Asian cut-offs 23 and 27.5');
  // healthy range: every weight inside it shows a BMI from 18.5 to 24.9, and 0.1 kg outside it does not
  for (const cm of [150, 162.5, 175, 188, 201]) {
    for (const cut of ['standard', 'asian']) {
      const m = cm / 100, rr = B.adult(70, m, cut), top = cut === 'asian' ? 23 : 25;
      const [lo, hi] = rr.range;
      check(B.round1(lo / m / m) >= 18.5 && B.round1(hi / m / m) < top, `${cm} cm ${cut}: range ends are healthy`);
      check(B.round1((lo - 0.1) / m / m) < 18.5 && B.round1((hi + 0.1) / m / m) >= top, `${cm} cm ${cut}: range is not too narrow by 0.1 kg`);
    }
  }
  eq(B.adult(70, 1.75, 'standard').range, [56.6, 76.4], '175 cm healthy range 56.6-76.4 kg (76.5 kg is BMI 24.98, shown as 25.0)');
  near(B.adult(90, 1.75, 'standard').toGo, 76.4 - 90, 1e-9, 'to go, overweight');
  near(B.adult(50, 1.75, 'standard').toGo, 56.6 - 50, 1e-9, 'to go, underweight');
  eq(B.adult(70, 1.75, 'standard').prime, 0.91, 'BMI Prime');
}

if (suites.includes('child')) {
  section('child');
  // CDC's published P5, P50, P85, P95 for every 17th row, reproduced from L, M, S
  const PV = [
  [1,24,14.73731947,16.57502768,18.16219473,19.33801062],
  [1,40.5,14.21868433,15.85824093,17.15266201,18.03986198],
  [1,57.5,13.87808525,15.45545692,16.83580365,17.87335318],
  [1,74.5,13.72764072,15.39422883,17.06504953,18.52151524],
  [1,91.5,13.753551,15.65468563,17.70735632,19.6697383],
  [1,108.5,13.9621189,16.16712234,18.63222223,21.08892746],
  [1,125.5,14.35100623,16.86907238,19.72221531,22.59867744],
  [1,142.5,14.90305549,17.70891811,20.88550554,24.06468566],
  [1,159.5,15.58801305,18.64112567,22.05595776,25.4028856],
  [1,176.5,16.3642691,19.62359571,23.19157996,26.58150994],
  [1,193.5,17.18060709,20.6155114,24.2729073,27.62246873],
  [1,210.5,17.97833773,21.57417053,25.30172632,28.60329919],
  [1,227.5,18.69233437,22.45257182,26.30170723,29.65857091],
  [2,25.5,14.34527262,16.3189719,17.88748812,18.9659499],
  [2,42.5,13.84696678,15.46470384,16.93312378,18.07759336],
  [2,59.5,13.53335941,15.15543107,16.78956298,18.22354893],
  [2,76.5,13.41680692,15.27853728,17.25289572,19.09324243],
  [2,93.5,13.50432278,15.7225673,18.13187166,20.42846182],
  [2,110.5,13.78684956,16.39418118,19.26034062,22.00995586],
  [2,127.5,14.2413266,17.21174424,20.50051644,23.6620644],
  [2,144.5,14.83262428,18.10148804,21.74262677,25.25564304],
  [2,161.5,15.51402643,18.99660055,22.90493747,26.70852876],
  [2,178.5,16.22695676,19.83763907,23.93412338,27.98509093],
  [2,195.5,16.90025476,20.57349387,24.80603342,29.0955805],
  [2,212.5,17.44935184,21.16206171,25.52684029,30.09599042],
  [2,229.5,17.77632308,21.56920824,26.13351285,31.08956357],
  ];
  const Z = {5: -1.6448536269514722, 50: 0, 85: 1.0364333894937898, 95: 1.6448536269514722};
  for (const [sex, mo, p5, p50, p85, p95] of PV) {
    const lms = B.lmsAt(sex === 1 ? 'm' : 'f', mo);
    [[5, p5], [50, p50], [85, p85], [95, p95]].forEach(([p, v]) => {
      near(B.xAt(Z[p], lms), v, 1e-4, `sex ${sex} ${mo} mo P${p}`);
      near(B.phi(B.zOf(v, lms)) * 100, p, 0.01, `sex ${sex} ${mo} mo percentile of P${p}`);
    });
  }
  // the normal CDF at known points
  for (const [z, p] of [[0, 0.5], [1, 0.8413447], [-1.959964, 0.025], [2.326348, 0.99], [-3, 0.0013499]]) near(B.phi(z), p, 2e-7, `phi(${z})`);
  // between table rows the curve is interpolated, never stepped
  const a = B.lmsAt('m', 120.5)[1], b = B.lmsAt('m', 121.5)[1], mid = B.lmsAt('m', 121)[1];
  near(mid, (a + b) / 2, 1e-12, 'interpolation between rows');
  // categories at the percentile boundaries for a 10-year-old boy (read at 120.5 months)
  const lms = B.lmsAt('m', 120.5), at = z => B.xAt(z, lms), kgFor = (bmi) => bmi * 1.4 * 1.4;
  const cat = bmi => B.child(kgFor(bmi), 1.4, 120, 'm').cat.name;
  eq(cat(at(Z[5]) - 0.01), 'Underweight', 'just under P5');
  eq(cat(at(Z[5]) + 0.01), 'Healthy weight', 'just over P5');
  eq(cat(at(Z[85]) + 0.01), 'Overweight', 'just over P85');
  eq(cat(at(Z[95]) + 0.01), 'Obesity', 'just over P95');
  eq(cat(at(Z[95]) * 1.2 + 0.01), 'Severe obesity (class 2)', '120 % of P95');
  eq(cat(at(Z[95]) * 1.4 + 0.01), 'Severe obesity (class 3)', '140 % of P95');
  // age read as completed months + 0.5; 9 6 means 114 months
  eq(B.parseAge('9 6').months, 114, '9 6 -> 114 months');
  eq(run({height: '134', weight: '38.5', age: '9 6', sex: 'f'}).r.months, 114.5, 'read at 114.5 months');
  eq(run({height: '134', weight: '38.5', age: '9', sex: ''}).needSex, true, 'a child needs a sex');
  eq(run({height: '180', weight: '70', age: '20'}).r.kind, 'adult', '20 is an adult');
  eq(run({height: '180', weight: '70', age: '19 11', sex: 'm'}).r.kind, 'child', '19 y 11 m is a child');
  check(!!B.parseAge('1 11').error, 'under 2 refused');
  eq(['the 50th', 'the 1st', 'the 2nd', 'the 3rd', 'the 11th', 'the 12th', 'the 13th', 'the 21st', 'the 92nd', 'the 99.4th', 'the 0.5th', 'below the 0.1st', 'above the 99.9th'],
    [50.2, 1.4, 2, 3.2, 11, 12, 13, 21, 92.3, 99.43, 0.5, 0.05, 99.95].map(B.percentileText), 'ordinals');
}

if (suites.includes('parse')) {
  section('parse');
  const H = (t, u = 'cm') => { const o = B.parseHeight(t, u); return o.m != null ? Math.round(o.m * 1e4) / 1e4 : o.error ? 'E' : 'empty'; };
  const cases = [['175', 1.75], ['175 cm', 1.75], ['175cm', 1.75], ['1.75', 1.75], ['1,75', 1.75], ['1.75 m', 1.75], ['1750 mm', 1.75], ['175,5', 1.755],
    [' 175 ', 1.75], ['5\'11', 1.8034], ['5\'11"', 1.8034], ['5′11″', 1.8034], ['5’11”', 1.8034], ['5 ft 11 in', 1.8034], ['5ft11', 1.8034], ['71 in', 1.8034], ['71"', 1.8034],
    ["5'", 1.524], ['5 ft', 1.524], ['', 'empty'], ['   ', 'empty'], ['abc', 'E'], ['-170', 'E'], ['0', 'E'], ['1e2', 'E'], ['17 5', 'E'], ['3000', 'E'], ['49', 'E'], ['1.234.5', 'E']];
  for (const [t, want] of cases) eq(H(t), want, `height "${t}"`);
  const fc = [['5 11', 1.8034], ['5.5', 1.6764], ['71', 1.8034], ['5 11.5', 1.8161], ['175 cm', 1.75], ['2', 'E'], ['5 13', 1.8542], ['175', 'E']];
  check(B.parseHeight('175', 'ft').cm === true, 'a cm height in ft mode offers cm');
  for (const [t, want] of fc) eq(H(t, 'ft'), want, `height "${t}" in ft mode`);
  const W = (t, u = 'kg') => { const o = B.parseWeight(t, u); return o.kg != null ? Math.round(o.kg * 1e4) / 1e4 : o.error ? 'E' : 'empty'; };
  const wc = [['70', 'kg', 70], ['70,5', 'kg', 70.5], ['70 kg', 'kg', 70], ['70kgs', 'kg', 70], ['154 lb', 'kg', 69.8532], ['154', 'lb', 69.8532], ['154lbs', 'lb', 69.8532],
    ['11 st', 'kg', 69.8532], ['11 st 4', 'kg', 71.6676], ['11st 4lb', 'kg', 71.6676], ['11 4', 'st', 71.6676], ['11', 'st', 69.8532], ['70 kg', 'lb', 70],
    ['', 'kg', 'empty'], ['seventy', 'kg', 'E'], ['-70', 'kg', 'E'], ['0', 'kg', 'E'], ['1', 'kg', 'E'], ['700', 'kg', 'E'], ['1433', 'lb', 649.9979], ['70 kilo s', 'st', 70], ['70 K G', 'lb', 70]];
  for (const [t, u, want] of wc) eq(W(t, u), want, `weight "${t}" (${u})`);
  eq(B.parseAge('').empty, true, 'blank age is an adult');
  eq(B.parseAge('8.5').months, 102, '8.5 years');
  eq(B.parseAge('8,5').months, 102, '8,5 years');
  eq(B.parseAge('8y 6m').months, 102, '8y 6m');
  eq(B.parseAge('30 months').months, 30, '30 months');
  eq(B.parseAge('45').adult, true, '45 is an adult');
  check(!!B.parseAge('ten').error, 'age in words refused');
}

if (suites.includes('edges')) {
  section('edges');
  check(run({height: '50', weight: '650'}).implausible, '50 cm 650 kg is a typo, not a result');
  check(run({height: '272', weight: '2'}).implausible, '272 cm 2 kg is a typo, not a result');
  check(!run({height: '', weight: '70'}).r, 'no height, no result');
  check(!run({height: '175', weight: 'x'}).r, 'bad weight, no result');
  check(!!run({height: '175', weight: 'x'}).w.error, 'bad weight error is on the weight');
  check(!run({height: '175', weight: 'x'}).h.error, 'and not on the height');
  const big = '9'.repeat(100000);
  const t0 = Date.now(); const o = run({height: big, weight: big, age: big}); check(Date.now() - t0 < 200 && !o.r, 'a 100,000-digit paste is refused quickly');
  check(!!run({height: '1' + 'e'.repeat(5000), weight: '70'}).h.error, 'junk paste refused');
  for (let i = 0; i < 2000; i++) {
    const cm = 120 + Math.random() * 100, kg = 30 + Math.random() * 150, o = run({height: cm.toFixed(1), weight: kg.toFixed(1)}), r = o.r;
    if (o.implausible) continue;
    const want = B.round1(+kg.toFixed(1) / (+cm.toFixed(1) / 100) ** 2);
    if (r.bmi !== want || B.band(r.bmi, 'standard').name !== r.cat.name) { check(false, `random ${cm} ${kg}`); break; }
  }
  passes++;
}

if (suites.includes('saves')) {
  section('saves');
  eq(B.fromOld('{"metric":true,"height":"175","weight":"70","heightFeet":"","heightInches":"","weightPounds":""}'), {units: 'metric', height: '175', weight: '70'}, 'old metric save');
  eq(B.fromOld('{"metric":false,"height":"","weight":"","heightFeet":"5","heightInches":"11","weightPounds":"150"}'), {units: 'us', height: '5 11', weight: '150'}, 'old imperial save');
  eq(B.fromOld('{"metric":false,"heightFeet":"6","heightInches":"","weightPounds":"200"}'), {units: 'us', height: '6 0', weight: '200'}, 'old save, no inches');
  eq(B.fromOld('not json'), null, 'broken save ignored');
  eq(B.fromOld('null'), null, 'null save ignored');
  eq(B.fromOld('{"metric":true,"height":{"x":1},"weight":"70"}'), {units: 'metric', height: '', weight: '70'}, 'odd field dropped');
  const f = {height: "5'11", weight: '150', age: '', sex: '', units: 'us', cut: 'asian'};
  eq(B.fromQuery('?' + B.toQuery(f)), {height: "5'11", weight: '150', units: 'us', cut: 'asian'}, 'link round trip');
  eq(B.fromQuery('?units=evil&sex=x&cut=1'), {}, 'link values that are not allowed are dropped');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
