#!/usr/bin/env node
// Test suite for tools/chord_identifier.html (Chord Identifier).
//
// The page promises the name a lead sheet would print for the notes given, spelled correctly, with the bass and the
// inversion right, and, from the microphone, the notes that were actually played. The logic lives in the page's
// DOM-free <script id="core"> block, which this suite runs in Node's vm. What checks each promise:
//   parse    note names as people type them: sharps and flats in ASCII and Unicode, double accidentals, lowercase,
//            run together (CEG), solfège, German (H, Fis, Es, and B meaning B flat once German is in use), octave
//            numbers, stray punctuation, empty, whitespace, junk, chord symbols typed by mistake, a huge paste
//   tab      guitar, drop D and ukulele tab in every common shape, frets over 9, wrong string counts, past the neck
//   name     the reference table: triads, sixths, sevenths, extended and altered chords and their inversions, each
//            against the name in standard lead-sheet usage (Berklee / Real Book conventions), and the open-chord
//            shapes every guitarist learns first
//   spell    the chosen root letter (Db major, C# minor, Eb minor, G# minor, F#) and every chord tone spelled from it
//   round    every chord symbol the parser knows, at all 12 roots: its notes named back give the same root and notes
//   hear     multiple-pitch estimation on synthesized chords (harmonic tones, random detune, inharmonicity, noise,
//            a phone microphone's missing low end) must recover the chord's notes
//   page     (Chromium, needs `npx http-server -p 8099`) the real page on a phone: the example on arrival, typing,
//            keys, frets, partial input, a chord symbol offered as notes, undo, state kept over a reload, no console
//            errors, no request leaving the site except fonts
//
//   npm run test:chord                          # or: node test/chord_identifier.mjs
//   node test/chord_identifier.mjs name spell   # named suites only

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['parse', 'tab', 'name', 'spell', 'round', 'hear', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const URL_BASE = 'http://localhost:8099/tools/chord_identifier.html';

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(join(ROOT, 'tools', 'chord_identifier.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

const fromText = t => (C.looksLikeTab(t) ? C.parseTab(t, 'standard').notes : C.parseNotes(t).notes);
const best = t => { const r = C.identify(fromText(t)); return r.candidates[0] ? r.candidates[0].name : r.status; };
const pcsOf = t => C.parseNotes(t).notes.map(n => n.pc);

let seed = 20261120;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('parse')) {
  section('parse');
  const P = (t, want, what) => eq(pcsOf(t), want, `${what}: ${JSON.stringify(t)}`);
  P('C E G', [0, 4, 7], 'spaces');
  P('C,E,G', [0, 4, 7], 'commas');
  P('C-E-G', [0, 4, 7], 'dashes');
  P('  C   E\tG \n', [0, 4, 7], 'stray whitespace');
  P('c e g', [0, 4, 7], 'lowercase');
  P('CEG', [0, 4, 7], 'run together');
  P('C#EG#', [1, 4, 8], 'run together with sharps');
  P('Bb D F', [10, 2, 5], 'B flat');
  P('bb d f', [10, 2, 5], 'lowercase b flat');
  P('B♭ D F', [10, 2, 5], 'Unicode flat');
  P('F♯ A C♯', [6, 9, 1], 'Unicode sharp');
  P('Cx', [2], 'double sharp x');
  P('Ebb', [2], 'double flat');
  P('E# Fb B# Cb', [5, 4, 0, 11], 'enharmonic oddities');
  P('Do Mi Sol', [0, 4, 7], 'solfège');
  P('la do mi', [9, 0, 4], 'solfège lowercase');
  P('Re Fa# La', [2, 6, 9], 'solfège with accidental');
  P('H Dis Fis', [11, 3, 6], 'German H and -is');
  P('Es G B', [3, 7, 10], 'German: Es and B meaning B flat');
  P('C4 E4 G4', [0, 4, 7], 'octave numbers');
  P('C E G.', [0, 4, 7], 'a full stop');
  P('eb,g , bb- d (the D on top)', [3, 7, 10, 2], 'a remark in brackets is skipped');
  P('C E G and Bb on top', [0, 4, 7, 10], 'filler words are skipped');
  P('A C E', [9, 0, 4], 'a lone A is a note, never a filler word');
  eq(C.parseNotes('eb g (the D on top)').skipped, ['(the D on top)'], 'what was skipped is reported');
  const r1 = C.parseNotes('C E Q');
  eq(r1.notes.map(n => n.pc), [0, 4], 'junk token: the rest is read');
  check(r1.errors.length === 1 && /“Q” is not a note/.test(r1.errors[0].msg), 'junk token: named in the error', r1.errors[0] && r1.errors[0].msg);
  const r2 = C.parseNotes('Gmaj7');
  check(r2.errors[0] && /chord name/.test(r2.errors[0].msg) && r2.errors[0].symbol && r2.errors[0].symbol.text === 'G B D F#', 'a chord symbol is recognised and its notes offered', JSON.stringify(r2.errors));
  eq(C.parseNotes('').kind, 'empty', 'empty');
  eq(C.parseNotes('   ').kind, 'empty', 'whitespace only');
  eq(C.parseNotes(null).kind, 'empty', 'null');
  check(C.parseNotes('C####').errors.length === 1, 'four sharps are refused');
  const big = 'C E G '.repeat(200000);
  const t0 = Date.now();
  const rb = C.parseNotes(big);
  check(Date.now() - t0 < 500 && rb.truncated && rb.notes.length > 100, 'a megabyte paste is cut to 4,000 characters, quickly', `${Date.now() - t0} ms`);
  eq(best(big), 'C', 'and still names the chord');
  const emoji = C.parseNotes('🎸 C E G');
  eq(emoji.notes.map(n => n.pc), [0, 4, 7], 'an emoji is an error, the notes still read');
  eq(C.parseNotes('C3 E2').notes.map(n => n.midi), [48, 40], 'octave numbers give MIDI');
  eq(C.identify(C.parseNotes('C3 E2 G3').notes).bass, 4, 'with octaves the lowest note is the bass, not the first');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('tab')) {
  section('tab');
  const T = (tab, tuning, wantMidi, what) => { const r = C.parseTab(tab, tuning); eq(r.ok ? r.notes.map(n => n.midi) : r.msg, wantMidi, `${what}: ${tab}`); };
  T('x32010', 'standard', [48, 52, 55, 60, 64], 'open C');
  T('320003', 'standard', [43, 47, 50, 55, 59, 67], 'open G');
  T('x 3 2 0 1 0', 'standard', [48, 52, 55, 60, 64], 'spaced');
  T('x-3-2-0-1-0', 'standard', [48, 52, 55, 60, 64], 'dashed');
  T('8 10 10 9 8 8', 'standard', [48, 55, 60, 64, 67, 72], 'barre with frets over 9');
  T('X02210', 'standard', [45, 52, 57, 60, 64], 'capital X');
  T('000232', 'dropd', [38, 45, 50, 57, 62, 66], 'drop D');
  T('0003', 'ukulele', [67, 60, 64, 72], 'ukulele C (re-entrant G)');
  check(C.looksLikeTab('x32010') && C.looksLikeTab('8 10 10 9 8 8') && !C.looksLikeTab('C E G') && !C.looksLikeTab('12'), 'what counts as tab');
  check(!C.parseTab('x3201', 'standard').ok, 'five frets for six strings is refused');
  check(/one fret per string/i.test(C.parseTab('x3201', 'standard').msg), '... and the message says what is wanted');
  check(!C.parseTab('8 10 10 9 8', 'standard').ok, 'five spaced frets for six strings is refused');
  check(!C.parseTab('x 30 2 0 1 0', 'standard').ok, 'fret 30 is past the neck');
  eq(C.parseTab('xxxxxx', 'standard').notes.length, 0, 'all muted is no notes');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('name')) {
  section('name');
  // [notes, lead-sheet name]; first note is the bass
  const TABLE = [
    ['C E G', 'C'], ['E G C', 'C/E'], ['G C E', 'C/G'], ['A C E', 'Am'], ['C Eb Gb', 'Cdim'], ['C E G#', 'Caug'],
    ['C D G', 'Csus2'], ['C F G', 'Csus4'], ['C G', 'C5'],
    ['C E G A', 'C6'], ['A C E G', 'Am7'], ['C Eb G A', 'Cm6'], ['C E G A D', 'C6/9'],
    ['C E G Bb', 'C7'], ['C E G B', 'Cmaj7'], ['C Eb G Bb', 'Cm7'], ['C Eb Gb Bb', 'Cm7b5'], ['C Eb Gb A', 'Cdim7'],
    ['C Eb G B', 'Cm(maj7)'], ['C E G# Bb', 'C7#5'], ['C E G# B', 'Cmaj7#5'], ['C E Gb Bb', 'C7b5'], ['C F G Bb', 'C7sus4'],
    ['C E G D', 'Cadd9'], ['C Eb G D', 'Cm(add9)'], ['C E F G', 'Cadd11'],
    ['C E G Bb D', 'C9'], ['C E G B D', 'Cmaj9'], ['C Eb G Bb D', 'Cm9'], ['C F G Bb D', 'C9sus4'],
    ['C Eb G Bb D F', 'Cm11'], ['C E Bb D A', 'C13'], ['C Eb G Bb D F A', 'Cm13'],
    ['C E G Bb Db', 'C7b9'], ['C E G Bb D#', 'C7#9'], ['C E G B F#', 'Cmaj7#11'], ['C E Bb D F#', 'C9#11'],
    ['C E G Bb Db F#', 'C7(b9,#11)'], ['C E G Bb Ab', 'C7b13'],
    ['E G Bb D', 'Em7b5'], ['G Bb D E', 'Gm6'], ['C E G Bb D F# A', 'C13#11'],
    ['G# B D F E', 'E7b9/G#'], ['F# D A', 'D/F#'], ['B G D F', 'G7/B'], ['F G B D', 'G7/F'], ['E C G Bb', 'C7/E'],
    ['Bb D F Ab', 'Bb7'], ['Eb G Bb Db F', 'Eb9'], ['A C# E G B', 'A9'],
    ['C Eb G Ab', 'Abmaj7/C'], ['C# E G#', 'C#m'], ['Db F Ab', 'Db'], ['F# A# C#', 'F#'],
  ];
  for (const [t, want] of TABLE) eq(best(t), want, t);
  const GUITAR = [['x32010', 'C'], ['x02210', 'Am'], ['320003', 'G'], ['022000', 'Em'], ['xx0232', 'D'], ['xx0231', 'Dm'],
    ['133211', 'F'], ['x24432', 'Bm'], ['x24442', 'B'], ['022100', 'E'], ['x02220', 'A'], ['320001', 'G7'], ['x32310', 'C7'], ['x02010', 'Am7'],
    ['020100', 'E7'], ['xx0212', 'D7'], ['x21202', 'B7'], ['x32000', 'Cmaj7'], ['xx3210', 'Fmaj7'], ['xx0233', 'Dsus4'],
    ['x02200', 'Asus2'], ['x13331', 'Bb'], ['2x0232', 'D/F#'], ['x00232', 'D/A'], ['022030', 'Em7'], ['xx0211', 'Dm7'],
    ['x35543', 'Cm'], ['x0221x', 'Am'], ['8 10 10 9 8 8', 'C']];
  for (const [t, want] of GUITAR) eq(best(t), want, `guitar ${t}`);
  // the result knows what the bass is doing
  const pos = t => C.identify(fromText(t)).candidates[0].position;
  eq(pos('C E G'), 'root position', 'root position');
  eq(pos('E G C'), 'first inversion', 'first inversion');
  eq(pos('G C E'), 'second inversion', 'second inversion');
  eq(pos('Bb C E G'), 'third inversion', 'third inversion');
  // states
  eq(C.identify([]).status, 'empty', 'no notes');
  eq(C.identify(C.parseNotes('C').notes).status, 'single', 'one note');
  eq(C.identify(C.parseNotes('C C C').notes).status, 'single', 'one note three times');
  const iv = C.identify(C.parseNotes('C E').notes);
  eq([iv.status, iv.interval.name], ['interval', 'major third'], 'two notes are an interval');
  eq(C.identify(C.parseNotes('E C').notes).interval.name, 'minor sixth', 'interval measured up from the bass');
  eq(C.identify(C.parseNotes('C F#').notes).interval.name, 'tritone', 'tritone');
  eq(C.identify(C.parseNotes('C C# D D# E F F# G G# A A# B').notes).status, 'unnamed', 'all twelve notes have no name');
  // alternatives
  const alts = t => C.identify(fromText(t)).candidates.map(c => c.name);
  check(alts('A C E G').includes('C6/A'), 'Am7 also reads as C6/A');
  check(alts('C E G A').includes('Am7/C'), 'C6 also reads as Am7/C');
  check(alts('D C E G').includes('C/D'), 'D9sus4 without its fifth also reads as C/D'); check(alts('Bb D F A').includes('Dm/Bb'), 'Bbmaj7 also reads as Dm/Bb, a triad over a foreign bass');
  // the same notes in any order, with the same bass, give the same name
  let bad = 0;
  for (const [t] of TABLE) {
    const ns = t.split(' ');
    for (let k = 0; k < 5; k++) {
      const rest = ns.slice(1).sort(() => rnd() - 0.5);
      if (best([ns[0], ...rest].join(' ')) !== best(t)) bad++;
    }
  }
  check(bad === 0, 'order above the bass never changes the name', `${bad} differ`);
  // doubling notes never changes the name
  bad = 0;
  for (const [t] of TABLE) if (best(t + ' ' + t.split(' ').slice(1).join(' ')) !== best(t)) bad++;
  check(bad === 0, 'doubled notes never change the name', `${bad} differ`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('spell')) {
  section('spell');
  const tones = t => C.identify(fromText(t)).candidates[0].tones.map(x => x.name).join(' ');
  // pitch classes given as numbers through MIDI, so no spelling is typed in
  const fromMidi = ms => C.identify(ms.map(m => ({ pc: m % 12, midi: m }))).candidates[0];
  const S = (ms, name, notes) => { const c = fromMidi(ms); eq([c.name, c.tones.map(t => t.name).join(' ')], [name, notes], `${name} spelled`); };
  S([61, 65, 68], 'Db', 'Db F Ab');
  S([61, 64, 68], 'C#m', 'C# E G#');
  S([63, 66, 70], 'Ebm', 'Eb Gb Bb');
  S([68, 71, 75], 'G#m', 'G# B D#');
  S([66, 70, 73], 'F#', 'F# A# C#');
  S([70, 73, 77], 'Bbm', 'Bb Db F');
  S([68, 72, 75], 'Ab', 'Ab C Eb');
  S([63, 67, 70, 74], 'Ebmaj7', 'Eb G Bb D');
  S([61, 64, 67, 70], 'C#dim7', 'C# E G Bb');
  S([62, 66, 69, 72], 'D7', 'D F# A C');
  S([64, 68, 71, 74, 65], 'E7b9', 'E G# B D F');
  S([60, 64, 68], 'Caug', 'C E G#');
  S([64, 67, 70, 74], 'Em7b5', 'E G Bb D');
  // spelling typed by the person is kept
  eq(best('A# C## E#'), 'A#', 'A# major when typed as A#');
  eq(tones('Gb Bb Db'), 'Gb Bb Db', 'Gb kept when typed');
  eq(tones('F# A# C#'), 'F# A# C#', 'F# kept when typed');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('round')) {
  section('round');
  const SYMS = ['', 'm', 'dim', 'aug', '5', 'sus2', 'sus4', '6', 'm6', '7', 'maj7', 'm7', 'm7b5', 'dim7', 'm(maj7)', '7sus4',
    '7b5', '7#5', 'maj7#5', 'add9', 'm(add9)', '6/9', '9', 'maj9', 'm9', '9sus4', '7b9', '7#9', '7#11', 'maj7#11', 'm11', '13', 'maj13', 'm13'];
  const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SYMMETRIC = ['aug', 'dim7'];
  let bad = 0, tried = 0;
  const pcset = a => [...new Set(a)].sort((x, y) => x - y).join();
  for (const r of ROOTS) for (const q of SYMS) {
    const sym = r + q + (q === '' ? '/' + r : '');
    const s = C.parseSymbol(sym);
    if (!s) { bad++; console.log(`  cannot read ${sym}`); continue; }
    tried++;
    const notes = C.parseNotes(s.text).notes;
    const res = C.identify(notes);
    const c = res.candidates[0];
    const ok = c && c.root === C.mod12(notes[0].pc) && pcset(c.tones.map(t => t.pc)) === pcset(notes.map(n => n.pc))
      && (SYMMETRIC.includes(q) || c.quality.replace('m(maj7)', 'm(maj7)') === q || (q === '' && c.quality === ''));
    if (!ok) { bad++; if (bad < 12) console.log(`  ${sym} = ${s.text} named back as ${c && c.name}`); }
  }
  check(bad === 0, `${tried} chord symbols at 12 roots name back to themselves`, `${bad} do not`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('hear')) {
  section('hear');
  const SR = 48000, N = 16384;
  const synth = (midis, o) => {
    const x = new Float64Array(N);
    for (const m of midis) {
      const f0 = 440 * 2 ** ((m - 69 + (rnd() * 2 - 1) * o.detune / 100) / 12);
      const g = 0.5 + rnd() * 0.5;
      for (let k = 1; k <= 14; k++) {
        const f = f0 * k * Math.sqrt(1 + o.inharm * k * k);
        if (f > SR / 2) break;
        let a = g / k ** o.tilt * (0.6 + 0.8 * rnd());
        if (o.highpass && f < o.highpass) a *= (f / o.highpass) ** 2;           // a phone microphone's lost low end
        const ph = rnd() * 6.28;
        const w = 2 * Math.PI * f / SR;
        for (let i = 0; i < N; i++) x[i] += a * Math.sin(w * i + ph);
      }
    }
    for (let i = 0; i < N; i++) x[i] += o.noise * (rnd() * 2 - 1);
    return x;
  };
  const SHAPES = ['x32010', 'x02210', '320003', '022000', 'xx0232', '133211', '022100', 'x02220', 'xx0231', '320001', 'x32310',
    'x02010', '020100', 'xx0212', 'x24432', 'x32000', 'xx3210', 'xx0233', 'x02200', 'x13331', 'x21202'];
  const KINDS = [
    ['plain guitar tone', { tilt: 1, detune: 8, inharm: 0.0001, noise: 0.01 }, 0.9],
    ['bright tone', { tilt: 0.7, detune: 8, inharm: 0.0001, noise: 0.01 }, 0.8],
    ['dull tone with noise', { tilt: 1.5, detune: 8, inharm: 0.0001, noise: 0.05 }, 0.9],
    ['badly tuned (±20 cents)', { tilt: 0.9, detune: 20, inharm: 0.0002, noise: 0.01 }, 0.85],
    ['phone microphone (low end lost below 150 Hz)', { tilt: 1, detune: 8, inharm: 0.0001, noise: 0.01, highpass: 150 }, 0.8],
  ];
  for (const [what, o, need] of KINDS) {
    let ok = 0, tot = 0;
    for (let rep = 0; rep < 3; rep++) for (const sh of SHAPES) {
      const t = C.parseTab(sh, 'standard');
      const mag = C.spectrum(synth(t.notes.map(n => n.midi), o));
      const got = C.identify(C.detectNotes(mag, SR, N).map(d => ({ pc: d.midi % 12, midi: d.midi })));
      const want = C.identify(t.notes).candidates[0].name;
      tot++; if (got.candidates[0] && got.candidates[0].name === want) ok++;
    }
    if (process.env.VERBOSE) console.log(`  ${what}: ${ok}/${tot}`);
    check(ok / tot >= need, `${what}: ${ok}/${tot} chords named right (need ${Math.round(need * 100)} %)`);
  }
  const silence = C.detectNotes(C.spectrum(new Float64Array(N)), SR, N);
  eq(silence.length, 0, 'silence hears nothing');
  const noise = new Float64Array(N); for (let i = 0; i < N; i++) noise[i] = (rnd() * 2 - 1) * 0.1;
  check(C.detectNotes(C.spectrum(noise), SR, N).length <= 2, 'white noise hears at most a stray note or two');
  const one = C.detectNotes(C.spectrum(synth([57], { tilt: 1, detune: 0, inharm: 0, noise: 0.005 })), SR, N);
  eq(one.map(n => n.midi), [57], 'one A3 is one A3, not its overtones');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('page')) {
  section('page');
  let chromium;
  try { ({chromium} = createRequire(import.meta.url)('playwright')); } catch (e) { console.log('  skipped: no playwright'); }
  let up = false;
  try { up = (await fetch(URL_BASE)).ok; } catch (e) { /* no server */ }
  if (!up && chromium) console.log('  skipped: start `npx http-server -p 8099` first');
  if (chromium && up) {
    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = [], outside = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { const u = new URL(r.url()); if (u.hostname !== 'localhost' && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) outside.push(r.url()); });
    const nameText = () => page.$eval('#name', e => e.textContent);
    await page.goto(URL_BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    eq(await nameText(), 'Am7', 'the example is there on arrival');
    check(/Example/.test(await page.$eval('#tag', e => e.textContent)), '... marked as the example');
    const box = await page.$eval('#kb', e => e.getBoundingClientRect().bottom);
    check(box <= 844, 'the keyboard is on screen without scrolling', box);
    await page.fill('#notes', 'D F# A C');
    eq(await nameText(), 'D7', 'typing names the chord at once');
    await page.click('#kb button[data-m="54"]');                       // F#3 below D: now F#3 is the bass? it is above D3=50
    await page.fill('#notes', 'C E G');
    await page.click('#kb button[data-m="58"]');                       // add Bb3
    eq(await nameText(), 'C7', 'a tapped key joins the chord');
    eq(await page.inputValue('#notes'), 'C E G Bb', '... and the field follows');
    await page.keyboard.press('Control+z');
    eq(await nameText(), 'C', 'undo takes the key back');
    await page.fill('#notes', 'C E Q Gmaj7');
    check(await page.$eval('#copy', e => e.disabled), 'partial input: copy is off');
    check(/G B D F♯|G B D F#/.test(await page.textContent('#help')), 'the chord symbol is answered with its notes');
    await page.click('#usesym');
    eq(await page.inputValue('#notes'), 'C E Q G B D F#', 'its notes replace it in the field');
    await page.fill('#notes', 'x32010');
    eq(await page.getAttribute('#t-guitar', 'aria-selected'), 'true', 'tab typed on the piano opens the guitar');
    eq(await nameText(), 'C', 'and is named');
    await page.click('#fb button[data-s="3"][data-f="3"]');            // G string to fret 3: Bb
    eq(await nameText(), 'C7', 'a tapped fret changes the chord');
    eq(await page.inputValue('#notes'), 'x32310', 'and the tab follows');
    await page.reload();
    eq(await nameText(), 'C7', 'the last chord is back after a reload');
    await page.click('#clear');
    eq(await nameText(), 'No notes yet', 'clear empties it');
    await page.click('#undo');
    eq(await nameText(), 'C7', 'and Undo brings it back');
    await page.fill('#notes', 'eb,g , bb- d (the D on top)');
    eq(await nameText(), 'E♭maj7', 'a pasted voicing with a remark is named');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {origin: 'http://localhost:8099'});
    await page.click('#link');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    check(/\?notes=eb\+g\+bb\+d$/.test(link), 'the link carries the notes, cleaned, and nothing else', link);
    await page.goto(URL_BASE + '?notes=' + encodeURIComponent('F A C E'));
    eq(await nameText(), 'Fmaj7', 'a link with notes opens on them');
    check(errors.length === 0, 'no console errors', errors.join(' | '));
    check(outside.length === 0, 'nothing but fonts is fetched from elsewhere', outside.join(' '));
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
