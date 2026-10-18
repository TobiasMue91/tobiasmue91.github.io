#!/usr/bin/env node
// Test suite for tools/timer.html (Online Timer).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that what a person types
// becomes the length they meant, that the countdown never shows a second it has not reached (ceil, like
// every kitchen timer: a fresh 5:00 shows 5:00 and 0:00 only at the end), that "Ends" names the right
// wall-clock time across midnight and DST, and that the old page's saved timerSettings survive. Expected
// values are worked out by hand from the unit definitions, not taken from the page.
//
//   node test/timer.mjs                 # everything
//   node test/timer.mjs parse clock     # named suites only
//
// Suites: parse, format, clock, saves, query.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'timer.html');
const ALL = ['parse', 'format', 'clock', 'saves', 'query'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URLSearchParams, Intl, Date, JSON, decodeURIComponent};
vm.runInNewContext(src, ctx);
const T = ctx.module.exports;
const secs = s => { const p = T.parse(s); return p.state === 'ok' ? p.secs : p.state; };

if (suites.includes('parse')) {
  section('parse');
  const ok = [
    ['5', 300], ['25', 1500], ['0.5', 30], ['1,5', 90], ['1.5', 90], [' 5 ', 300], ['05', 300], ['999', 59940],
    ['1:30', 90], ['0:05', 5], [':45', 45], ['90:00', 5400], ['1:00:00', 3600], ['1:30:15', 5415], ['0:75', 75], ['1 : 30', 90],
    ['1.30.00', 5400],
    ['90s', 90], ['90 s', 90], ['90 sec', 90], ['45 seconds', 45], ['1 second', 1], ['1.5 s', 2],
    ['5m', 300], ['5 min', 300], ['5 Minutes', 300], ['10 MIN', 600], ['5 minuten', 300],
    ['1h', 3600], ['2 hours', 7200], ['1.5h', 5400], ['1,5 h', 5400], ['1 Stunde', 3600],
    ['1h 20m', 4800], ['1h20m', 4800], ['1h 20', 4800], ['5m30', 330], ['5m 30s', 330], ['1 hour and 30 minutes', 5400],
    ['1h, 30m', 5400], ['2 h 3 m 4 s', 7384], ['99:59:59', 359999],
    ['timer 5 minutes', 300], ['set a timer for 10 minutes', 600], ['for 3 min', 180], ['countdown 1:00', 60], ['bake for 1 hr, 15 mins', 4500], ['Simmer 20 minutes', 1200],
    ['5 min', 300], ['5 min', 300],
  ];
  for (const [s, n] of ok) eq(secs(s), n, `"${s}" -> ${n} s`);
  const bad = ['abc', '5x', '5 minutes ago', '1:2:3:4', '30m 1h', '5 5', 'm', '1h1h', '٥', '五分', 'NaN', 'Infinity', '1e3', '5..5', '#5'];
  for (const s of bad) eq(T.parse(s).state, 'error', `"${s}" is an error`);
  eq(T.parse('').state, 'empty', 'empty');
  eq(T.parse('   ').state, 'empty', 'whitespace');
  eq(T.parse(null).state, 'empty', 'null');
  eq(T.parse('0').state, 'zero', '0 is zero');
  eq(T.parse('0:00').state, 'zero', '0:00 is zero');
  eq(T.parse('0.004').state, 'zero', 'rounds to zero');
  eq(T.parse('-5').state, 'error', 'negative');
  eq(T.parse('−5').state, 'error', 'minus sign');
  check(/negative/.test(T.parse('-5').msg), 'negative says so');
  eq(T.parse('100:00:00').state, 'error', 'over the maximum');
  eq(T.parse('6000').state, 'error', '6000 minutes is over 99:59:59');
  eq(secs('5999'), 359940, '5999 minutes fits');
  check(/99 hours/.test(T.parse('100h').msg), 'maximum is named');
  eq(T.parse('5'.repeat(65)).state, 'error', 'huge paste is an error');
  const t0 = Date.now(); T.parse('1h '.repeat(21)); T.parse('9'.repeat(64)); check(Date.now() - t0 < 50, 'no slow paths');
  check(/“furlong”/.test(T.parse('5 furlong').msg), 'unknown unit is named');
  for (const s of ['abc', '-5', '0', '']) check(/1:30/.test(T.parse(s).msg), `"${s}" message says what works`);
}

if (suites.includes('format')) {
  section('format');
  const f = [[0, '0:00'], [5, '0:05'], [59, '0:59'], [60, '1:00'], [300, '5:00'], [3599, '59:59'], [3600, '1:00:00'], [5400, '1:30:00'],
    [36000, '10:00:00'], [359999, '99:59:59'], [-12, '−0:12'], [-3725, '−1:02:05'], [59.6, '1:00']];
  for (const [n, s] of f) eq(T.format(n), s, `format ${n}`);
  eq(T.words(300), '5 minutes', 'words 5 min'); eq(T.words(61), '1 minute 1 second', 'words singular');
  eq(T.words(3600), '1 hour', 'words hour'); eq(T.words(0), '0 seconds', 'words zero'); eq(T.words(7384), '2 hours 3 minutes 4 seconds', 'words all');
  eq(T.short(300), '5', 'short 5'); eq(T.short(45), '45s', 'short 45s'); eq(T.short(90), '1:30', 'short 1:30'); eq(T.short(3600), '1:00:00', 'short hour'); eq(T.short(5400), '1:30:00', 'short 90 min');
  for (const n of [1, 59, 60, 90, 300, 3599, 3600, 5415, 359999]) eq(secs(T.short(n)), n, `short ${n} reads back`);
  // the countdown: full length at the start, 0 only at the end, never below
  const end = 1e12 + 300000;
  eq(T.left(end, 1e12), 300, 'starts at 5:00'); eq(T.left(end, 1e12 + 1), 300, '1 ms in still 5:00');
  eq(T.left(end, 1e12 + 1000), 299, '1 s in 4:59'); eq(T.left(end, end - 1), 1, 'last ms shows 0:01');
  eq(T.left(end, end), 0, 'end is 0'); eq(T.left(end, end + 5e3), 0, 'never negative');
  eq(T.over(end, end + 999), 0, 'overtime 0'); eq(T.over(end, end + 12000), 12, 'overtime 12'); eq(T.over(end, end - 500), 0, 'no overtime before end');
}

if (suites.includes('clock')) {
  section('clock');
  const at = (iso) => Date.parse(iso);
  eq(T.clock(at('2026-10-18T14:35:00Z'), at('2026-10-18T14:30:00Z'), 'en-US', 'UTC'), '2:35 PM', 'en-US 12 h');
  eq(T.clock(at('2026-10-18T14:35:00Z'), at('2026-10-18T14:30:00Z'), 'de-DE', 'UTC'), '14:35', 'de 24 h');
  eq(T.clock(at('2026-10-18T00:05:00Z'), at('2026-10-18T00:00:00Z'), 'en-US', 'UTC'), '12:05 AM', 'midnight hour is 12');
  eq(T.clock(at('2026-10-19T00:10:00Z'), at('2026-10-18T23:55:00Z'), 'en-GB', 'UTC'), '00:10 tomorrow', 'crosses midnight');
  eq(T.clock(at('2026-10-21T10:00:00Z'), at('2026-10-18T10:00:00Z'), 'en-US', 'UTC'), 'Wed 10:00 AM', 'days away get a weekday');
  eq(T.clock(at('2026-12-31T23:30:00Z'), at('2026-12-31T23:00:00Z'), 'en-GB', 'UTC'), '23:30', 'new year eve same day');
  eq(T.clock(at('2027-01-01T00:30:00Z'), at('2026-12-31T23:00:00Z'), 'en-GB', 'UTC'), '00:30 tomorrow', 'into new year');
  eq(T.clock(at('2028-03-01T00:30:00Z'), at('2028-02-29T23:00:00Z'), 'en-GB', 'UTC'), '00:30 tomorrow', 'leap day to March');
  eq(T.clock(at('2028-02-29T00:30:00Z'), at('2028-02-28T23:00:00Z'), 'en-GB', 'UTC'), '00:30 tomorrow', 'into leap day');
  // DST: Berlin falls back at 03:00 CEST -> 02:00 CET on 2026-10-25. A 2 h timer from 01:30 local ends at 02:30 CET.
  eq(T.clock(at('2026-10-25T01:30:00Z'), at('2026-10-24T23:30:00Z'), 'de-DE', 'Europe/Berlin'), '02:30', 'DST fall back counts real time');
  // spring forward 2026-03-29 02:00 CET -> 03:00 CEST: 1 h from 01:30 is 03:30
  eq(T.clock(at('2026-03-29T01:30:00Z'), at('2026-03-29T00:30:00Z'), 'de-DE', 'Europe/Berlin'), '03:30', 'DST spring forward');
  eq(T.clock(at('2026-10-19T00:30:00Z'), at('2026-10-18T21:30:00Z'), 'en-US', 'America/New_York'), '8:30 PM', 'local day, not UTC day');
}

if (suites.includes('saves')) {
  section('saves');
  const old = JSON.stringify({mins: '25', secs: '0', sound: false, notif: true, theme: 'dark', advancedShown: true, alarmDuration: '12', alarmVolume: '0', loopAlarm: true});
  const s = T.settings(old);
  eq([s.last, s.sound, s.notif, s.theme, s.advancedShown, s.alarmDuration, s.alarmVolume, s.loopAlarm, s.wake], ['25', false, true, 'dark', true, 12, 0, true, true], 'old save read');
  eq(T.settings(JSON.stringify({mins: '1', secs: '30'})).last, '1:30', 'old 1:30');
  eq(T.settings(JSON.stringify({mins: 0, secs: 0})).last, '5', 'old empty -> example');
  eq(T.settings(JSON.stringify({mins: '90', secs: '0'})).last, '1:30:00', 'old 90 min');
  eq(T.settings(JSON.stringify({mins: '999', secs: '59'})).last, '16:39:59', 'old maximum');
  eq(T.settings(JSON.stringify({theme: 'light'})).theme, 'light', 'light theme kept');
  const d = T.settings(null);
  eq([d.last, d.sound, d.notif, d.theme, d.alarmDuration, d.alarmVolume, d.loopAlarm], ['5', true, false, null, 5, 80, false], 'defaults');
  for (const j of ['{', '[]', '"x"', '42', 'null', '{"alarmVolume":"loud","alarmDuration":99}']) {
    const r = T.settings(j); check(r.alarmVolume >= 0 && r.alarmVolume <= 100 && r.alarmDuration >= 1 && r.alarmDuration <= 30 && typeof r.last === 'string', `corrupt ${j} gives sane settings`);
  }
  eq(T.settings('{"alarmDuration":99}').alarmDuration, 30, 'duration clamped');
  // written back: old readers still find mins/secs
  const w = JSON.parse(T.store(Object.assign({}, d, {last: '1:30'}), 90));
  eq([w.mins, w.secs, w.last, w.alarmVolume], ['1', '30', '1:30', 80], 'store keeps old shape');
  eq(T.settings(T.store(Object.assign({}, d, {last: '1h 20m'}), 4800)).last, '1h 20m', 'round trip keeps what was typed');
}

if (suites.includes('query')) {
  section('query');
  eq(T.fromQuery('?t=5'), 300, '?t=5'); eq(T.fromQuery('?t=1%3A30'), 90, '?t=1:30'); eq(T.fromQuery('?t=1h20m'), 4800, '?t=1h20m');
  eq(T.fromQuery('?time=90s'), 90, '?time='); eq(T.fromQuery('?5m'), 300, 'bare ?5m'); eq(T.fromQuery('?t=1+h'), 3600, 'plus as space');
  eq(T.fromQuery(''), null, 'none'); eq(T.fromQuery('?t=abc'), null, 'bad'); eq(T.fromQuery('?t=0'), null, 'zero'); eq(T.fromQuery('?utm_source=x'), null, 'unrelated');
  eq(T.fromQuery('?%E0%A4%A'), null, 'malformed escape does not throw');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
