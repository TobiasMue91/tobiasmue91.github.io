#!/usr/bin/env node
// Test suite for tools/text_sound_visualizer.html (Text to Sound).
//
// The page promises that a text always plays the same melody, that the melody follows a fixed, stated rule (a = C3 up the
// C-major scale to z = G6, punctuation as low beats), that what is drawn is what is heard, and that the WAV it saves is
// a real WAV of that sound. The rules live in the page's DOM-free <script id="core"> block, which this suite runs in
// Node (as a plain function, so timings match a browser's) - the same text the page hands its Web Worker. What checks each promise:
//   fold     which characters sound and as what: a-z either case, accents (ä = a), ß = ss, ligatures, full-width forms,
//            Cyrillic and Greek by their Latin spelling, typographic quotes and … as marks, digits / emoji / CJK silent
//   notes    the letter table against MIDI and frequency (A4 = 440 Hz), and note timing against values measured on the
//            previous page (hello, HeLLo hello, a newline, a hyphenated word); loudness from letter counts
//   marks    punctuation sounds where it stands (the old page stacked every repeat on the first one), runs step 0.1 s
//   speed    50 % doubles every time and length, 200 % halves them; speed never changes pitch
//   edge     empty, spaces only, silent only, one letter, a 16+ letter word is capped, 100,000 characters stop at 5:00
//            and say where, Kelvin sign, zero-width joiners, lone surrogates
//   render   deterministic sample for sample; peak 0.9; starts silent before the first note; each sound puts its energy
//            at the note's frequency (Goertzel at C3 against its neighbours); no NaN; tone darkens and brightens
//   wav      RIFF header fields by hand, 16-bit clipping at ±1, volume scales, byte length
//   misc     file names from text, durations as text, share links round-trip and clamp bad values
//   page     (Chromium, needs `npx http-server -p 8099`) the real page on a phone: the example on arrival, live roll while
//            typing, the error state and its fix, silent characters named, Download gives a RIFF/WAVE file, Play starts
//            and stops, a share link opens with its text, settings and text survive a reload, no console errors, no
//            request leaving the site
//
//   npm run test:textsound                         # or: node test/text_sound_visualizer.mjs
//   node test/text_sound_visualizer.mjs notes marks  # named suites only

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['fold', 'notes', 'marks', 'speed', 'edge', 'render', 'wav', 'misc', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
const PAGE = arg('page') || join(ROOT, 'tools', 'text_sound_visualizer.html');
const URL_BASE = arg('url') || 'http://localhost:8099/tools/text_sound_visualizer.html';

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); } };
const J = v => JSON.stringify(v);
const eq = (got, want, what) => check(J(got) === J(want), what, `got ${J(got)}, want ${J(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const mod = {exports: {}};
new Function('module', 'self', src)(mod, {});
const T = mod.exports;
const plain = x => JSON.parse(JSON.stringify(x));
const S = (text, o) => plain(T.schedule(text, o));
const letters = s => s.notes.filter(n => !n.mark);
const names = s => s.notes.map(n => T.midiName(n.midi)).join(' ');
const r4 = x => Math.round(x * 10000) / 10000;

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('fold')) {
  section('fold');
  const F = c => T.fold(c);
  eq(['a', 'Z', 'q', 'Q'].map(F), ['a', 'z', 'q', 'q'], 'a-z in either case');
  eq(['ä', 'Ö', 'é', 'ñ', 'Å', 'ç', 'ł', 'ø', 'đ', 'ı'].map(F), ['a', 'o', 'e', 'n', 'a', 'c', 'l', 'o', 'd', 'i'], 'accented Latin plays as its letter');
  eq(['ß', 'ẞ', 'æ', 'Œ', 'þ'].map(F), ['ss', 'ss', 'ae', 'oe', 'th'], 'letters Unicode does not decompose');
  eq(['ﬁ', 'ｈ', 'Ｚ', 'K'].map(F), ['fi', 'h', 'z', 'k'], 'ligatures, full-width forms and the Kelvin sign');
  eq([...'Привет'].map(F).join(''), 'privet', 'Cyrillic by its Latin spelling');
  eq([...'щёЖЮя'].map(F).join(''), 'shchezhyuya', '  multi-letter Cyrillic');
  eq([...'Γειά'].map(F).join(''), 'geia', 'Greek by its Latin spelling, accents dropped');
  eq(['1', '0', '😀', '中', 'あ', '-', '@', '#', ' ', '‍', 'א'].map(F), Array(11).fill(''), 'digits, emoji, CJK, Hebrew, symbols are silent');
  eq(['.', ',', '!', '?', ';', ':', "'", '"', '(', ')', '[', ']', '{', '}'].map(T.marksOf).join(''), ".,!?;:'\"()[]{}", 'the marks that sound');
  eq(['’', '“', '”', '„', '«', '…', '¡', '¿', '。', '，'].map(T.marksOf), ["'", '"', '"', '"', '"', '...', '!', '?', '.', ','], 'typographic marks as the mark they stand for');
  eq(['-', '—', '@', '/', '&', '*', '<'].map(T.marksOf), Array(7).fill(''), 'dashes and symbols do not sound');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('notes')) {
  section('notes');
  const table = 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => T.midiName(T.letterMidi(l))).join(' ');
  eq(table, 'C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6 E6 F6 G6', 'a = C3 up the white keys to z = G6');
  eq([T.letterMidi('a'), T.letterMidi('h'), T.letterMidi('m'), T.letterMidi('z')], [48, 60, 69, 91], '  as MIDI numbers (C4 = 60)');
  near(T.midiFreq(69), 440, 1e-9, 'A4 = 440 Hz');
  near(T.midiFreq(48), 130.8128, 1e-3, 'C3 = 130.81 Hz');
  near(T.midiFreq(91), 1567.982, 1e-2, 'G6 = 1567.98 Hz');
  // Values measured on the previous page (Tone.js schedule), which this page keeps.
  const h = S('hello');
  eq(h.notes.map(n => [T.midiName(n.midi), r4(n.t), r4(n.d), r4(n.v)]),
    [['C4', 0, 0.35, 0.7], ['G3', 0.175, 0.315, 0.7], ['G4', 0.3325, 0.28, 1], ['G4', 0.4725, 0.245, 1], ['C5', 0.595, 0.21, 0.7]], 'hello: notes, times, lengths, loudness');
  near(h.duration, 0.805, 1e-9, '  ends at 0.805 s');
  eq(names(S('HELLO')), names(h), 'case does not matter');
  const hh = S('HeLLo hello');
  near(letters(hh)[5].t, 0.8, 1e-9, 'HeLLo hello: the second word starts at 0.8 s');
  eq(letters(hh).map(n => r4(n.v)), [0.7, 0.7, 1, 1, 0.7, 0.7, 0.7, 1, 1, 0.7], '  l is the loudest');
  const ll = S('line one\nline two');
  eq(ll.notes.map(n => r4(n.v)), [0.5857, 0.5857, 0.7286, 0.7286, 0.5857, 0.7286, 0.7286, 0.5857, 0.5857, 0.7286, 0.7286, 0.4429, 0.4429, 0.5857], 'a newline separates words; loudness 0.3 + count / (letters / 2)');
  eq(ll.notes.map(n => r4(n.t)).slice(0, 7), [0, 0.15, 0.2813, 0.3938, 0.5875, 0.7125, 0.8167], '  times as measured before');
  const ab = S('abc-def @#');
  eq(letters(ab).map(n => [T.midiName(n.midi), r4(n.v)]), [['C3', 0.6333], ['D3', 0.6333], ['E3', 0.6333], ['F3', 0.6333], ['G3', 0.6333], ['A3', 0.6333]], 'abc-def: the hyphen is silent but part of the word');
  near(ab.notes[0].d, 0.45, 1e-9, '  and counts toward its length (0.1 + 0.05 × 7)');
  eq(S('Straße').notes.map(n => n.ch).join(''), 'strasse', 'Straße plays strasse');
  eq(S('Straße').readAs, [['Straße', 'strasse']], '  and says so');
  eq(S('café latte').readAs, [['café', 'cafe']], 'only words with non-ASCII letters are reported');
  const s = S('Hello, World! 123');
  eq([s.letters, s.words, s.marks], [10, 2, 2], 'counts: letters, words that sound, punctuation');
  eq(s.silent, ['1', '2', '3'], '  silent characters listed once each');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('marks')) {
  section('marks');
  const m = S('Hello, World!').notes.filter(n => n.mark);
  eq(m.map(n => [n.ch, T.midiName(n.midi), r4(n.v), r4(n.d)]), [[',', 'G2', 0.5, 0.1], ['!', 'D1', 0.9, 0.1]], ', is G2, ! is D1');
  near(m[0].t, 0.8333, 1e-4, '  the comma sounds right after "Hello"');
  check(m[1].t > S('Hello, World!').notes.filter(n => !n.mark).pop().t, '  the ! after the last letter');
  eq(S('a. b? c; d"').notes.filter(n => n.mark).map(n => T.midiName(n.midi)), ['C2', 'A1', 'E2', 'E2'], '. C2, ? A1, others E2');
  const w = S('Wait... what?!').notes.filter(n => n.mark);
  eq(w.map(n => r4(n.t)), [0.8036, 0.9036, 1.0036, 1.6036, 1.7036], 'a run of marks steps 0.1 s instead of stacking on one time');
  const at = S('a.b.c.').notes.filter(n => n.mark).map(n => n.at);
  eq(at, [1, 3, 5], 'each . knows where it stands in the text');
  check(new Set(S('a.b.c.').notes.filter(n => n.mark).map(n => n.t)).size === 3, '  repeated marks sound at their own places (the old page stacked them)');
  eq(S('“Hi” … ¿qué?').notes.filter(n => n.mark).sort((a, b) => a.at - b.at).map(n => n.ch).join(''), '""...??', 'typographic quotes, ellipsis and ¿ sound as marks');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('speed')) {
  section('speed');
  const base = S('The quick brown fox.'), slow = S('The quick brown fox.', {speed: 50}), fast = S('The quick brown fox.', {speed: 200});
  near(slow.duration, base.duration * 2, 1e-9, '50 % is twice as long');
  near(fast.duration, base.duration / 2, 1e-9, '200 % is half as long');
  check(slow.notes.every((n, i) => Math.abs(n.t - 2 * base.notes[i].t) < 1e-9 && Math.abs(n.d - 2 * base.notes[i].d) < 1e-9), '  every start and length scales');
  eq(names(fast), names(base), '  pitch never changes with speed');
  eq(S('abc', {speed: 0}).duration, S('abc').duration, 'speed 0 or junk falls back to 100 %');
  eq(T.settings({speed: 7}).speed, 50, 'settings clamp speed to 50…200');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('edge')) {
  section('edge');
  for (const t of ['', '   ', '\n\t', '12345', '😀😀', '中文字', '— – -']) {
    const s = S(t);
    check(s.notes.length === 0 && s.duration === 0, `${J(t)}: no notes, no length`);
  }
  eq(S('😀 1 2').silent, ['😀', '1', '2'], 'an emoji is one silent character, not two halves');
  const one = S('A');
  eq(one.notes.map(n => [T.midiName(n.midi), r4(n.d), r4(n.v)]), [['C3', 0.15, 1]], 'A alone: C3, 0.15 s, full loudness');
  const long = S('x'.repeat(1000));
  near(long.notes[0].d, 0.9, 1e-9, 'a 1000-letter word plays as if it were 16 letters long (the old page held a 50 s note)');
  check(long.notes.every(n => n.d >= 0.45 - 1e-9), '  and its notes get no shorter than half');
  const huge = 'lorem ipsum dolor sit amet, '.repeat(4000);
  const t0 = Date.now(), H = T.schedule(huge), ms = Date.now() - t0;
  check(H.truncated && H.duration <= T.MAX_SECONDS + 2, `112,000 characters: stops at ${T.MAX_SECONDS} s and says so`, J([H.truncated, H.duration]));
  check(H.playedChars > 1000 && H.playedChars < huge.length && huge[H.playedChars - 1] === ' ', '  names the character it stopped at, on a word boundary', H.playedChars);
  check(ms < 1500, `  in ${ms} ms`);
  eq(S('‍ab️').notes.map(n => n.ch).join(''), 'ab', 'zero-width joiners and variation selectors are silent');
  eq(S('a\ud800b').notes.map(n => n.ch).join(''), 'ab', 'a lone surrogate does not break the rest');
  eq(S('tab\tsep').words, 2, 'a tab separates words');
  eq(S('  lead  trail  ').words, 2, 'leading and trailing spaces add nothing');
  eq(S(null).notes.length, 0, 'null is treated as empty');
}

// ---------------------------------------------------------------------------------------------------------------------
function goertzel(x, sr, f, from, to) {
  const w = 2 * Math.PI * f / sr, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = from; i < to; i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2);
}
if (suites.includes('render')) {
  section('render');
  const sch = T.schedule('Hello, World!');
  for (const sound of Object.keys(T.SOUNDS)) {
    const a = T.render(sch.notes, {sound}), b = T.render(sch.notes, {sound});
    let same = a.length === b.length, peak = 0, bad = 0;
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) same = false; if (!isFinite(a[i])) bad++; peak = Math.max(peak, Math.abs(a[i])); }
    check(same, `${sound}: the same text renders the same samples`);
    check(bad === 0, `  no NaN or Infinity`);
    near(peak, 0.9, 1e-6, `  peak at 0.9`);
    check(a.length / 44100 >= sch.duration && a.length / 44100 < sch.duration + 6, `  ${(a.length / 44100).toFixed(2)} s: the melody and its ring-out, no more`);
  }
  eq(T.render([], {}).length, 0, 'no notes: no samples');
  // The pitch that sounds is the pitch on screen: a held "a" puts its energy at C3, not at its neighbours.
  const sr = 44100, note = [{t: 0.1, d: 0.8, midi: 48, v: 1, ch: 'a', mark: false}];
  for (const sound of ['ambient', 'melodic', 'electronic']) {
    const x = T.render(note, {sound}), from = Math.round(0.2 * sr), to = Math.round(0.6 * sr);
    const at = goertzel(x, sr, 130.81, from, to), lo = goertzel(x, sr, 116.54, from, to), hi = goertzel(x, sr, 146.83, from, to);
    check(at > 4 * lo && at > 4 * hi, `${sound}: "a" sounds at C3 130.8 Hz`, J([at, lo, hi].map(Math.round)));
    let pre = 0;
    for (let i = 0; i < Math.round(0.09 * sr); i++) pre = Math.max(pre, Math.abs(x[i]));
    check(pre < 1e-6, '  silent before the note starts');
  }
  const rh = T.render(note, {sound: 'rhythmic'});
  const at = goertzel(rh, sr, 130.81, Math.round(0.15 * sr), Math.round(0.35 * sr)), up = goertzel(rh, sr, 261.6, Math.round(0.15 * sr), Math.round(0.35 * sr));
  check(at > 2 * up, 'rhythmic: a drum tuned to C3 once its pitch drop has settled', J([at, up].map(Math.round)));
  // Tone: a darker setting leaves less energy high up.
  const z = [{t: 0, d: 0.6, midi: 91, v: 1, ch: 'z', mark: false}];
  const hiE = (tone) => { const x = T.render(z, {sound: 'electronic', tone}); return goertzel(x, sr, 3 * 1567.98, 4410, 22050) / goertzel(x, sr, 1567.98, 4410, 22050); };
  check(hiE(0) < hiE(50) && hiE(50) < hiE(100), 'tone 0 is darker than 50, 100 brighter', J([hiE(0), hiE(50), hiE(100)]));
  near(T.cutoff('ambient', 50), 3000, 1e-9, 'tone 50 keeps the sound\'s own brightness');
  eq(T.settings({}).sound, 'melodic', 'the default sound is Melodic: plucked and dry, so each note is heard on its own');
  near(T.cutoff('ambient', 75), 6000, 1e-9, '  each 25 steps is an octave');
  const t0 = Date.now(); T.render(T.schedule('The quick brown fox jumps over the lazy dog. '.repeat(3)).notes, {}); const ms = Date.now() - t0;
  check(ms < 1500, `a sentence three times over renders in ${ms} ms`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('wav')) {
  section('wav');
  const x = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2, 0.25]);
  const b = T.wav(x, 44100, 1), v = new DataView(b.buffer);
  const str = (o, n) => String.fromCharCode(...b.slice(o, o + n));
  eq([str(0, 4), str(8, 4), str(12, 4), str(36, 4)], ['RIFF', 'WAVE', 'fmt ', 'data'], 'RIFF / WAVE / fmt / data chunks');
  eq([v.getUint32(4, true), v.getUint32(16, true), v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true), v.getUint32(40, true)],
    [36 + 16, 16, 1, 1, 44100, 88200, 2, 16, 16], 'PCM, mono, 44.1 kHz, 16-bit, sizes');
  eq(b.length, 44 + 16, 'two bytes a sample after a 44-byte header');
  eq([...Array(8)].map((_, i) => v.getInt16(44 + i * 2, true)), [0, 16384, -16384, 32767, -32768, 32767, -32768, 8192], 'samples, clipped at ±1');
  const h = T.wav(x, 44100, 0.5), hv = new DataView(h.buffer);
  eq(hv.getInt16(44 + 3 * 2, true), 16384, 'volume 50 % halves the samples');
  eq(T.wav(new Float32Array(0)).length, 44, 'an empty sound is a valid empty WAV');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('misc')) {
  section('misc');
  eq(T.fileName('Hello, World!'), 'text-sound-hello-world.wav', 'file name from the first words');
  eq(T.fileName('Ünïcödé façade and more words here'), 'text-sound-unicode-facade-and-more.wav', '  accents dropped, four words');
  eq(T.fileName('😀 ### 中文'), 'text-sound.wav', '  nothing usable: a plain name');
  eq(T.fileName('a'.repeat(100)), 'text-sound-' + 'a'.repeat(40) + '.wav', '  at most 40 characters of text');
  eq([T.clock(0), T.clock(6.44), T.clock(59.96), T.clock(61), T.clock(300)], ['0.0 s', '6.4 s', '60.0 s', '1:01', '5:00'], 'durations as text');
  const q = T.linkQuery('Hi & bye #1', {sound: 'rhythmic', speed: 150, tone: 50, volume: 70});
  eq(q, '?text=Hi+%26+bye+%231&sound=rhythmic&speed=150', 'a share link carries the text and only what differs from the defaults');
  eq(plain(T.readQuery(q)), {sound: 'rhythmic', speed: 150, tone: 50, volume: 70, text: 'Hi & bye #1'}, '  and reads back');
  eq(plain(T.readQuery('?text=x&sound=nope&speed=999&tone=-4&volume=abc')), {sound: 'melodic', speed: 200, tone: 0, volume: 70, text: 'x'}, '  bad values are clamped or ignored');
  eq(T.readQuery('?foo=1'), null, 'no text in the link: nothing to read');
  eq(plain(T.readQuery('?text=')), {sound: 'melodic', speed: 100, tone: 50, volume: 70, text: ''}, 'an empty text in a link is still a text');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('page')) {
  section('page');
  let chromium = null;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { /* not installed */ }
  let up = false;
  try { up = (await fetch(URL_BASE, {method: 'HEAD'})).ok; } catch (e) { /* no server */ }
  if (!chromium || !up) console.log(`  skipped: ${!chromium ? 'Playwright not found' : 'no server at ' + URL_BASE + ' (npx http-server -p 8099)'}`);
  else await pageSuite(chromium);
}

async function pageSuite(chromium) {
  const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const origin = new URL(URL_BASE).origin;
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, acceptDownloads: true});
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin});
  const page = await ctx.newPage();
  const problems = [], outside = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', e => problems.push(e.message));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) outside.push(u); });
  const txt = sel => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  const state = () => page.evaluate(() => window.__textSound.state());
  const ready = () => page.waitForFunction(() => { const s = window.__textSound.state(); return !s.busy && s.buffer && s.buffer.key === JSON.stringify([document.getElementById('text').value, s.S.sound, s.S.speed, s.S.tone]); }, null, {timeout: 10000});

  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready();

  // Arrival: a worked example with its melody already drawn and rendered.
  check((await page.inputValue('#text')).length > 10, 'arrival: an example text, not an empty box');
  check(/example/i.test(await txt('#msg')), '  says it is an example');
  check(/^Play \d/.test(await txt('#play')), '  Play names the length', await txt('#play'));
  check(!(await page.$eval('#dl', e => e.disabled)), '  Download is ready');
  check(await page.$eval('#play', e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight; }), '  Play is on screen without scrolling');

  // Typing: the roll and counts follow every key.
  await page.fill('#text', '');
  await page.type('#text', 'Hi Ann');
  check((await txt('#stats')).startsWith('5 letters · 2 words · 0 punctuation'), 'typing: counts follow without pressing anything', await txt('#stats'));
  await ready();
  check(/WAV file \d+\.\d s: the melody and \d+\.\d s of fade-out/.test(await txt('#stats')), '  once rendered, the file length with its ring-out is named', await txt('#stats'));
  check((await state()).sched.notes.length === 5, '  five notes scheduled');

  // Error state and its fix.
  await page.fill('#text', '12345 😀');
  check(await page.$eval('#text', e => e.getAttribute('aria-invalid') === 'true'), 'only digits and emoji: the box is marked invalid');
  check(/Nothing to play/.test(await txt('#msg')), '  the message says why, next to the box');
  check(await page.$eval('#play', e => e.disabled) && await page.$eval('#dl', e => e.disabled), '  Play and Download are off');
  await page.click('#ex2');
  check(await page.$eval('#text', e => e.getAttribute('aria-invalid') === 'false'), '  "Use the example" mends it');

  // Partly silent text: the silent characters are named; non-Latin words say how they are read.
  await page.fill('#text', 'Room 101 Привет');
  const m = await txt('#msg');
  check(/Silent: 1 0/.test(m) && /Привет → privet/.test(m), 'partly silent: names the silent characters and the reading of Привет', m);

  // Download: a real WAV.
  await page.fill('#text', 'Hello, World!');
  await ready();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dl')]);
  eq(dl.suggestedFilename(), 'text-sound-hello-world.wav', 'Download: named after the text');
  const buf = readFileSync(await dl.path());
  eq([buf.toString('ascii', 0, 4), buf.toString('ascii', 8, 12)], ['RIFF', 'WAVE'], '  a RIFF/WAVE file (the old page saved WebM under a .wav name)');
  check(buf.length > 44 + 2 * 44100 * 2, `  ${(buf.length / 1024).toFixed(0)} KB of sound`);

  // Play and stop.
  await page.click('#play');
  await page.waitForFunction(() => window.__textSound.state().playing, null, {timeout: 5000}).catch(() => {});
  check((await state()).playing, 'Play starts the sound');
  check(/^Stop/.test(await txt('#play')), '  the button turns into Stop');
  await page.click('#play');
  check(!(await state()).playing, '  and Stop stops it');

  // Settings and text survive a reload.
  await page.click('text=Electronic');
  await page.fill('#text', 'Kept over a reload');
  await page.waitForTimeout(500);
  await page.reload();
  eq([await page.inputValue('#text'), (await state()).S.sound], ['Kept over a reload', 'electronic'], 'text and sound survive a reload');

  // A share link opens with its text and settings, and does not override later edits on reload.
  await page.goto(URL_BASE + '?text=' + encodeURIComponent('Shared tune') + '&sound=rhythmic&speed=150');
  eq([await page.inputValue('#text'), (await state()).S.sound, (await state()).S.speed], ['Shared tune', 'rhythmic', 150], 'a share link opens with its text and settings');
  check(!(await page.evaluate(() => location.search)), '  the text leaves the address bar once read');
  await page.fill('#text', 'Edited after');
  await page.waitForTimeout(500);
  await page.reload();
  eq(await page.inputValue('#text'), 'Edited after', '  a reload keeps the edit, not the link');

  // Copy link puts the text in the clipboard only when asked.
  await page.click('#share');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip.includes('text=Edited+after'), 'Copy link: a link carrying the text', clip);

  // A very long paste does not freeze the page and says where it stops.
  await page.evaluate(() => { const t = document.getElementById('text'); t.value = 'lorem ipsum dolor sit amet, '.repeat(20000); t.dispatchEvent(new Event('input')); });
  check(/first 5:00 plays/.test(await txt('#msg')), 'a 560,000-character paste: says the first 5:00 plays', await txt('#msg'));

  check(problems.length === 0, 'no console errors or warnings', J(problems));
  check(outside.length === 0, 'no request leaves the site', J(outside));
  await browser.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
