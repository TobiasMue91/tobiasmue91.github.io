#!/usr/bin/env node
// Test suite for tools/css_filter_playground.html (CSS Filter Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the CSS it prints is the filter
// you see, and that a filter you paste is read the way a browser reads it (Filter Effects 1 §6: an omitted argument
// is 1, or 0 for blur and hue-rotate; numbers and percentages are interchangeable; negatives are invalid;
// grayscale/invert/opacity/sepia clamp at 100%; angles in deg, rad, grad, turn). Expected strings are worked out by
// hand from that text, not taken from the page. The `browser` suite has Chromium judge every pasted string the core
// accepts or rejects, and render what the core prints next to what was pasted, pixel for pixel (skipped without
// Playwright).
//
//   node test/css_filter.mjs              # everything
//   node test/css_filter.mjs read box     # named suites only
//
// Suites: print, read, errors, box, presets, random, storage, hash, huge, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import {execSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'css_filter_playground.html');
const ALL = ['print', 'read', 'errors', 'box', 'presets', 'random', 'storage', 'hash', 'huge', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.runInNewContext(src + '\nthis.FX = FX;', ctx);
const FX = ctx.FX;
const css = s => { const r = FX.read(s); return r.ok ? FX.css(r.state) : 'ERR ' + r.error; };
const with_ = o => { const s = FX.defaults(); Object.assign(s.v, o); return FX.css(s); };

if (suites.includes('print')) {
  section('print');
  eq(with_({}), 'filter: none;', 'all neutral is none, not a list of 100%s');
  eq(with_({sepia: 40}), 'filter: sepia(40%);', 'one changed function');
  eq(with_({blur: 2.5}), 'filter: blur(2.5px);', 'decimal blur');
  eq(with_({blur: 2.5, invert: 50, opacity: 80}), 'filter: blur(2.5px) invert(50%) opacity(80%);', 'canonical order');
  eq(with_({'hue-rotate': 360}), 'filter: hue-rotate(360deg);', 'hue 360 is printed as set');
  eq(with_({blur: 20, brightness: 200, contrast: 200, grayscale: 100, 'hue-rotate': 360, invert: 100, opacity: 100, saturate: 200, sepia: 100}),
    'filter: blur(20px) brightness(200%) contrast(200%) grayscale(100%) hue-rotate(360deg) invert(100%) saturate(200%) sepia(100%);', 'all at maximum (opacity 100 is neutral)');
  eq(with_({brightness: 0, contrast: 0, saturate: 0, opacity: 0}), 'filter: brightness(0%) contrast(0%) opacity(0%) saturate(0%);', 'all at minimum');
  eq(with_({brightness: 100.004}), 'filter: none;', 'rounding to 2 places hides float dust');
  eq(with_({brightness: 99.996}), 'filter: none;', 'and from below');
  eq(with_({brightness: 120.125}), 'filter: brightness(120.13%);', 'two decimals');
  eq(with_({'hue-rotate': -0.001}), 'filter: none;', 'no -0');
  eq(FX.fmt(-0), '0', 'fmt -0');
}

if (suites.includes('read')) {
  section('read');
  eq(css('brightness(120%) contrast(90%)'), 'filter: brightness(120%) contrast(90%);', 'bare value');
  eq(css('filter: brightness(1.2);'), 'filter: brightness(120%);', 'number = ratio');
  eq(css('-webkit-filter: grayscale(1) !important;'), 'filter: grayscale(100%);', 'prefix and !important');
  eq(css('  FILTER :  Sepia( 50% )  ;  '), 'filter: sepia(50%);', 'case and spaces');
  eq(css('none'), 'filter: none;', 'none');
  eq(css(''), 'filter: none;', 'empty');
  eq(css('   \n '), 'filter: none;', 'whitespace');
  eq(css('grayscale()'), 'filter: grayscale(100%);', 'omitted argument is 1 (spec)');
  eq(css('blur()'), 'filter: none;', 'blur() is 0');
  eq(css('hue-rotate()'), 'filter: none;', 'hue-rotate() is 0');
  eq(css('invert(250%)'), 'filter: invert(100%);', 'invert clamps at 100%');
  eq(css('opacity(1.5)'), 'filter: none;', 'opacity 150% clamps to 100% = neutral');
  eq(css('brightness(250%)'), 'filter: brightness(250%);', 'brightness does not clamp');
  eq(css('hue-rotate(0.5turn)'), 'filter: hue-rotate(180deg);', 'turn');
  eq(css('hue-rotate(100grad)'), 'filter: hue-rotate(90deg);', 'grad');
  eq(css('hue-rotate(3.14159265rad)'), 'filter: hue-rotate(180deg);', 'rad');
  eq(css('hue-rotate(-90deg)'), 'filter: hue-rotate(-90deg);', 'negative angle allowed');
  eq(css('blur(0)'), 'filter: none;', 'unitless zero length');
  eq(css('blur(4)'), 'filter: blur(4px);', 'unitless blur taken as px (lenient)');
  eq(css('brightness(1,2)'), 'filter: brightness(120%);', 'decimal comma');
  eq(css('brightness(.5)'), 'filter: brightness(50%);', 'leading dot');
  eq(css('brightness(1e1%)'), 'filter: brightness(10%);', 'exponent');
  eq(css('brightness(120%), contrast(90%)'), 'filter: brightness(120%) contrast(90%);', 'stray comma between functions');
  eq(css('/* warm */ sepia(20%)'), 'filter: sepia(20%);', 'comment');
  eq(css('brightness(1.2) drop-shadow(2px 4px 6px rgba(0, 0, 0, .5))'), 'filter: brightness(120%) drop-shadow(2px 4px 6px rgba(0, 0, 0, .5));', 'drop-shadow kept verbatim, nested brackets and all');
  eq(css('url(#glow) sepia(1)'), 'filter: url(#glow) sepia(100%);', 'url() kept in place');
  eq(css('drop-shadow(0 0 2px red) drop-shadow(0 0 4px blue)'), 'filter: drop-shadow(0 0 2px red) drop-shadow(0 0 4px blue);', 'stacked drop-shadows');
  eq(css('drop-shadow(0 0 2px rgba(0,0,0,.5)'), 'filter: drop-shadow(0 0 2px rgba(0,0,0,.5));', 'open brackets closed at the end');
  { const r = FX.read('blur(1px) drop-shadow(1px 1px red) sepia(1)'); eq(FX.css(FX.drop(r.state, 'x0')), 'filter: blur(1px) sepia(100%);', 'removing a kept function'); }
  eq(css('sepia(20%) brightness(110%)'), 'filter: sepia(20%) brightness(110%);', 'order is kept');
  const r = FX.read('saturate(2) blur(1px)');
  eq(r.state.order.slice(0, 3), ['saturate', 'blur', 'brightness'], 'pasted functions lead the row order');
  eq(r.state.order.length, 9, 'every function still has a row');
}

if (suites.includes('errors')) {
  section('errors');
  const err = s => { const r = FX.read(s); return r.ok ? null : r.error; };
  check(/Couldn't read/.test(err('brightness(1(2))')), 'nested brackets in a slider function');
  check(/isn't a CSS filter function/.test(err('brightnes(120%)')), 'typo in name');
  check(/negative/.test(err('brightness(-10%)')), 'negative amount');
  check(/negative/.test(err('blur(-2px)')), 'negative blur');
  check(/px/.test(err('blur(1em)')), 'blur only px');
  check(/angle/.test(err('hue-rotate(90%)')), 'hue needs an angle');
  check(/twice/.test(err('blur(1px) blur(2px)')), 'duplicate');
  check(/brackets/.test(err('brightness')), 'name without brackets');
  check(/Couldn't read/.test(err('brightness(120%) ???')), 'trailing junk');
  eq(css('brightness(120%'), 'filter: brightness(120%);', 'a bracket left open at the end is closed, as browsers do');
  check(/Couldn't read/.test(err('brightness(120% contrast(2)')), 'unclosed bracket mid-string');
  check(err('sepia(abc)') !== null, 'non-number');
  check(err('brightness(١٢٠%)') !== null, 'non-ASCII digits rejected, not misread');
  check(err('brightness(120 %)') === null, 'space before % accepted');
}

if (suites.includes('box')) {
  section('box');
  const b = (fn, t) => { const a = FX.arg(fn, t, true); return a.ok ? a.v : 'ERR'; };
  eq(b('brightness', '120'), 120, 'box number is in the box unit');
  eq(b('brightness', ' 120 % '), 120, 'stray spaces and %');
  eq(b('brightness', '1,5'), 1.5, 'decimal comma in the box');
  eq(b('blur', '3px'), 3, 'px suffix');
  eq(b('hue-rotate', '0.25turn'), 90, 'turn in the box');
  eq(b('hue-rotate', '-45'), -45, 'negative hue');
  eq(b('sepia', '150'), 100, 'sepia clamps');
  eq(b('brightness', ''), 'ERR', 'empty box is an error, not zero');
  eq(b('brightness', '-1'), 'ERR', 'negative');
  eq(b('blur', '5000'), 'ERR', 'blur cap');
  eq(b('brightness', '1e400'), 'ERR', 'infinity');
}

if (suites.includes('presets')) {
  section('presets');
  const p = k => FX.css(FX.preset(k));
  eq(p('vintage'), 'filter: brightness(120%) contrast(90%) saturate(85%) sepia(30%);', 'vintage (unchanged from old page)');
  eq(p('grayscale'), 'filter: grayscale(100%);', 'grayscale');
  eq(p('sepia'), 'filter: sepia(100%);', 'sepia');
  eq(p('high-contrast'), 'filter: brightness(110%) contrast(150%) saturate(110%);', 'high contrast');
  eq(p('cool'), 'filter: hue-rotate(180deg) saturate(110%);', 'cool');
  eq(p('warm'), 'filter: brightness(102%) hue-rotate(30deg) saturate(110%) sepia(15%);', 'warm');
  for (const [k] of FX.PRESETS) eq(FX.matchPreset(FX.preset(k)), k, `${k} is recognised as itself`);
  eq(FX.matchPreset(FX.defaults()), null, 'neutral is no preset');
}

if (suites.includes('random')) {
  section('random');
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let ok = true;
  for (let i = 0; i < 2000; i++) {
    const s = FX.random(rand), v = s.v;
    if (!(v.blur >= 0 && v.blur <= 5 && v.brightness >= 80 && v.brightness <= 140 && v.opacity >= 70 && v.opacity <= 100 && v['hue-rotate'] >= 0 && v['hue-rotate'] <= 360)) ok = false;
    if (!FX.read(FX.value(s)).ok || FX.value(FX.read(FX.value(s)).state) !== FX.value(s)) ok = false;
  }
  check(ok, 'random stays in the old ranges and round-trips through the parser');
}

if (suites.includes('storage')) {
  section('storage');
  const s = FX.preset('warm');
  eq(FX.value(FX.load(FX.save(s))), FX.value(s), 'save → load');
  eq(FX.load('nope'), null, 'garbage');
  eq(FX.load('{"v":2,"filter":"blur(1px)"}'), null, 'unknown version');
  eq(FX.load('{"v":1,"filter":"bogus("}'), null, 'bad filter');
  eq(FX.load(null), null, 'nothing stored');
}

if (suites.includes('hash')) {
  section('hash');
  const s = FX.read('sepia(20%) hue-rotate(-30deg) blur(1.5px)').state;
  const h = FX.toHash(s);
  eq(h, '#f=sepia(20%25)+hue-rotate(-30deg)+blur(1.5px)', 'hash form');
  eq(FX.value(FX.fromHash(h)), FX.value(s), 'hash round-trip keeps order');
  eq(FX.value(FX.fromHash('#f=brightness(120%25)%20contrast(90%25)')), 'brightness(120%) contrast(90%)', '%20 also works');
  eq(FX.fromHash('#f=%E0%A4%A'), null, 'broken escape');
  eq(FX.fromHash('#other'), null, 'no f=');
  eq(FX.fromHash(''), null, 'no hash');
}

if (suites.includes('huge')) {
  section('huge');
  const big = 'brightness(120%) '.repeat(20000);
  const t = Date.now(); const r = FX.read(big);
  check(!r.ok && /twice/.test(r.error) && Date.now() - t < 200, 'a 340 kB paste fails fast with a reason');
  const junk = 'x'.repeat(1e6); const t2 = Date.now(); const r2 = FX.read(junk);
  check(!r2.ok && r2.error.length < 200 && Date.now() - t2 < 200, 'a 1 MB junk paste gives a short error, quickly');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) {
    try { ({chromium} = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright')); }
    catch (e2) { console.log('  (skipped: no playwright)'); }
  }
  if (chromium) {
    let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
    const page = await b.newPage();
    await page.setContent('<canvas id=c width=8 height=8></canvas>');
    // Valid CSS by the browser's own reading must be accepted by the core, and vice versa, except where the core
    // is knowingly lenient (prefixes, unitless blur, decimal comma, commas between functions, empty).
    const strict = ['brightness(120%) contrast(90%)', 'brightness(1.2)', 'grayscale()', 'blur()', 'invert(250%)', 'hue-rotate(0.5turn)',
      'hue-rotate(100grad)', 'hue-rotate(-90deg)', 'blur(0)', 'brightness(.5)', 'brightness(1e1%)', 'sepia(20%) brightness(110%)', 'none',
      'brightness(-10%)', 'blur(-2px)', 'hue-rotate(90%)', 'brightnes(120%)', 'brightness', 'brightness(120%', 'sepia(abc)', 'drop-shadow(2px 2px 4px #000) brightness(.9)', 'blur(1px) blur(2px)'];
    for (const s of strict) {
      const browserOk = await page.evaluate(s => CSS.supports('filter', s), s);
      const coreOk = FX.read(s).ok;
      // Duplicates are valid CSS; the core refuses them on purpose (one row per function).
      if (s === 'blur(1px) blur(2px)') { check(browserOk && !coreOk, 'duplicates: valid CSS, refused on purpose'); continue; }
      check(browserOk === coreOk, `browser and core agree on “${s}”`, `browser ${browserOk}, core ${coreOk}`);
    }
    // What the core prints renders identically to what was pasted.
    const pairs = ['brightness(1.1) drop-shadow(3px 3px 0 rgba(0,0,0,.5))', 'brightness(1.2) contrast(0.9) saturate(0.85) sepia(0.3)', 'grayscale() hue-rotate(0.25turn)', 'invert(250%) opacity(1.5)',
      'hue-rotate(3.14159265rad) saturate(2)', 'sepia(.2) brightness(1.1)', 'contrast(150%) invert(30%)'];
    for (const s of pairs) {
      const same = await page.evaluate(([a, b]) => {
        const px = f => { const g = document.getElementById('c').getContext('2d', {willReadFrequently: true}); g.clearRect(0, 0, 8, 8); g.filter = f;
          const grd = g.createLinearGradient(0, 0, 8, 8); grd.addColorStop(0, '#d7263d'); grd.addColorStop(.5, '#2e86de'); grd.addColorStop(1, '#f9c80e');
          g.fillStyle = grd; g.fillRect(0, 0, 8, 8); return Array.from(g.getImageData(0, 0, 8, 8).data); };
        const x = px(a), y = px(b); return x.every((v, i) => Math.abs(v - y[i]) <= 1);
      }, [s, FX.value(FX.read(s).state)]);
      check(same, `“${s}” and the printed “${FX.value(FX.read(s).state)}” render the same`);
    }
    await b.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
