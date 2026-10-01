#!/usr/bin/env node
// Test suite for games/word_search.html (Highlight).
//
// Runs the page's DOM-free <script id="core"> block in Node. Every puzzle is built from a seed, and
// the promise each one makes cannot be seen from the page: every listed word is in the grid exactly
// once and nowhere by accident, and the cells no word uses spell the theme's message in reading
// order. A word list that grows a word hidden inside another, a message that happens to contain a
// listed word, or a tweak to the generator can break that for one seed in a thousand. No browser,
// no server.
//
//   node test/word_search.mjs                 # everything
//   node test/word_search.mjs puzzles input   # named suites only
//   node test/word_search.mjs --page=path.html
//
// Suites:
//   themes   - word lists and messages: plain letters, no word inside another either way, no
//              word inside the message, every theme usable somewhere
//   puzzles  - the first 300 book puzzles, a year of dailies and every theme at every size it fits:
//              each word once, straight, in an allowed direction, the leftover cells spelling the
//              message, the same seed always the same grid
//   book     - grids grow and directions arrive in order, no theme repeats within a dozen puzzles,
//              neighbouring days never share a theme
//   input    - drags snap to the eight directions and hold one through a wobble, taps join two
//              cells, a word reads the same from either end, part of a word is not the word
//   play     - a bot finds every word through the same calls the page makes: the message is dealt
//              a little per word and whole at the end, and neighbouring strokes get different pens;
//              a guess at the message reads only when it is exactly the part not yet dealt
//   save     - saves of every shape come back clean; the book never goes behind a solved puzzle;
//              streaks count consecutive days

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'word_search.html');
const ALL = ['themes', 'puzzles', 'book', 'input', 'play', 'save'];
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
vm.runInContext(core[1] + '\nthis.C = SeekCore;', ctx);
const C = ctx.C;

const rev = s => [...s].reverse().join('');
const ALL_DIRS = [0, 1, 2, 3, 4, 5, 6, 7];

// Everything a finished puzzle promises, checked from the grid alone.
function audit(p, dirs, label) {
    const n = p.size, bad = [];
    if (p.grid.length !== n * n || !p.grid.every(ch => /^[A-Z]$/.test(ch))) bad.push('grid is not n*n capital letters');
    if (p.words.length < C.MIN_WORDS || p.words.length > C.MAX_WORDS) bad.push(`${p.words.length} words`);
    const covered = new Set();
    for (const w of p.words) {
        const [dr, dc] = C.DIRS[w.dir];
        if (!dirs.includes(w.dir)) bad.push(`${w.word} runs in direction ${w.dir}`);
        const r0 = Math.floor(w.cells[0] / n), c0 = w.cells[0] % n;
        const straight = w.cells.every((ci, k) => ci === (r0 + dr * k) * n + (c0 + dc * k)) && w.cells.every(ci => ci >= 0 && ci < n * n);
        if (!straight) bad.push(`${w.word} is not a straight run`);
        if (w.cells.map(ci => p.grid[ci]).join('') !== w.word) bad.push(`${w.word} does not read from its cells`);
        const occ = C.occurrences(p.grid, n, w.word);
        if (occ.length !== 1) bad.push(`${w.word} reads ${occ.length} times`);
        w.cells.forEach(ci => covered.add(ci));
    }
    const words = p.words.map(w => w.word);
    if (new Set(words).size !== words.length) bad.push('a word is listed twice');
    if (words.join() !== [...words].sort().join()) bad.push('list is not alphabetical');
    const free = [];
    for (let i = 0; i < n * n; i++) if (!covered.has(i)) free.push(i);
    if (free.join() !== p.messageCells.join()) bad.push('message cells are not exactly the unused cells');
    if (free.map(i => p.grid[i]).join('') !== C.letters(p.message)) bad.push('leftover letters do not spell the message');
    const share = free.length / (n * n);
    if (share < C.MSG_MIN - 1e-9 || share > C.MSG_MAX + 1e-9) bad.push(`message takes ${(share * 100).toFixed(0)}% of the grid`);
    check(!bad.length, label, bad.join('; '));
    return !bad.length;
}

// ------------------------------------------------------------------ themes
function themes() {
    section('themes');
    const ids = C.THEMES.map(t => t.id);
    check(new Set(ids).size === ids.length, 'theme ids are unique');
    check(C.THEMES.length >= 30, `at least thirty themes (${C.THEMES.length})`);
    for (const t of C.THEMES) {
        const bad = [];
        if (!/^[A-Z ]+$/.test(t.msg)) bad.push('message is not plain capitals and spaces');
        if (!(t.hue >= 0 && t.hue < 360)) bad.push('hue out of range');
        const msg = C.letters(t.msg);
        if (new Set(t.words).size !== t.words.length) bad.push('a word is listed twice');
        for (const a of t.words) {
            if (!/^[A-Z]{3,10}$/.test(a)) bad.push(`${a} is not 3-10 capitals`);
            for (const b of t.words) if (a !== b && (b.includes(a) || b.includes(rev(a)))) bad.push(`${a} sits inside ${b}`);
            if (msg.includes(a) || msg.includes(rev(a))) bad.push(`the message holds ${a}`);
        }
        const sizes = [8, 9, 10].filter(s => C.fits(t, s));
        if (!sizes.length) bad.push('fits no grid size');
        check(!bad.length, `${t.id}: clean list and message (fits ${sizes.join(', ')})`, bad.join('; '));
    }
}

// ------------------------------------------------------------------ puzzles
function puzzles() {
    section('puzzles');
    let t0 = Date.now(), ok = 0, n = 300;
    for (let i = 1; i <= n; i++) {
        const p = C.bookPuzzle(i);
        if (!p) { fail(`book No. ${i} (${C.themeForBook(i).id}) could not be built`); continue; }
        const lv = C.level(i);
        if (p.size !== lv.size) fail(`book No. ${i} is ${p.size} wide, level says ${lv.size}`);
        if (audit(p, lv.dirs, `book No. ${i}`)) ok++;
    }
    const tBook = Date.now() - t0;
    check(ok === n, `${ok} of ${n} book puzzles keep every promise`);
    check(tBook / n < 25, `a book puzzle builds in ${(tBook / n).toFixed(1)} ms on average`);

    t0 = Date.now(); ok = 0;
    for (let d = 0; d < 365; d++) {
        const key = C.dateKey(new Date(2026, 9, 1 + d));
        const p = C.dailyPuzzle(key);
        if (!p) { fail(`daily ${key} could not be built`); continue; }
        if (audit(p, C.DAILY.dirs, `daily ${key}`)) ok++;
    }
    check(ok === 365, `${ok} of 365 dailies keep every promise (${Date.now() - t0} ms)`);

    let worst = 0;
    for (const t of C.THEMES) for (const size of [8, 9, 10]) {
        if (!C.fits(t, size)) continue;
        let good = 0;
        for (let s = 0; s < 25; s++) {
            const dirs = s % 2 ? ALL_DIRS : [0, 2];
            const p = C.generate({theme: t, size, dirs, seed: 'audit-' + s});
            if (!p) { fail(`${t.id} at ${size}, seed ${s}: no grid`); continue; }
            worst = Math.max(worst, p.attempt);
            if (audit(p, dirs, `${t.id} at ${size}, seed ${s}`)) good++;
        }
        check(good === 25, `${t.id} at ${size}: 25 seeds, every grid sound`);
    }
    check(worst < 200, `no grid needed more than ${worst + 1} attempts (limit 400)`);

    const a = C.bookPuzzle(17), b = C.bookPuzzle(17);
    check(a.grid.join('') === b.grid.join('') && JSON.stringify(a.words) === JSON.stringify(b.words), 'the same seed builds the same grid');
    const d1 = C.dailyPuzzle('2027-03-14'), d2 = C.dailyPuzzle('2027-03-14');
    check(d1.grid.join('') === d2.grid.join(''), 'a daily is the same for everyone');

    // the grid is not all one way
    let lopsided = 0;
    for (let i = 1; i <= 120; i++) {
        const p = C.bookPuzzle(i), count = {};
        p.words.forEach(w => { count[w.dir] = (count[w.dir] || 0) + 1; });
        const most = Math.max(...Object.values(count));
        if (most > Math.ceil(p.words.length * 0.7)) lopsided++;
    }
    check(lopsided === 0, `no book puzzle has more than 70% of its words one way (${lopsided} do)`);
}

// ------------------------------------------------------------------ book
function book() {
    section('book');
    let prev = null, grew = true;
    for (let n = 1; n <= 40; n++) {
        const lv = C.level(n);
        if (prev && (lv.size < prev.size || prev.dirs.some(d => !lv.dirs.includes(d)))) grew = false;
        prev = lv;
    }
    check(grew, 'grids never shrink and directions are never taken away');
    check(C.level(1).dirs.join() === '0,2', 'No. 1 reads across and down only');
    check(C.level(1).size === 8, 'No. 1 is the smallest grid');
    const firstBack = [...Array(60).keys()].map(i => i + 1).find(n => C.level(n).dirs.some(d => d >= 3 && d <= 6));
    check(firstBack >= 10, `words first run backwards at No. ${firstBack}, after the diagonals`);

    const seen = [];
    let repeat = null;
    for (let n = 1; n <= 400; n++) {
        const t = C.themeForBook(n);
        if (!C.fits(t, C.level(n).size)) fail(`No. ${n}: ${t.id} does not fit a ${C.level(n).size} grid`);
        const back = seen.slice(-12).indexOf(t.id);
        if (back >= 0 && !repeat) repeat = `No. ${n} repeats ${t.id}`;
        seen.push(t.id);
    }
    check(!repeat, 'no theme comes back within twelve puzzles', repeat);
    const used = new Set(seen);
    check(used.size === C.THEMES.length, `the book uses every theme (${used.size} of ${C.THEMES.length})`);

    let same = null;
    for (let d = 0; d < 400; d++) {
        const a = C.dateKey(new Date(2026, 0, 1 + d)), b = C.dateKey(new Date(2026, 0, 2 + d));
        if (C.themeForDay(a).id === C.themeForDay(b).id && !same) same = `${a} and ${b}`;
        if (!C.fits(C.themeForDay(a), C.DAILY.size)) fail(`daily ${a} theme does not fit`);
    }
    check(!same, 'neighbouring days never share a theme', same);
    // the clock change does not make a day vanish or repeat
    const keys = [];
    for (let d = 0; d < 400; d++) keys.push(C.dateKey(new Date(2026, 0, 1 + d, 12)));
    check(new Set(keys).size === 400 && keys.every((k, i) => !i || C.prevDay(k) === keys[i - 1]), 'prevDay walks back one calendar day at a time');
}

// ------------------------------------------------------------------ input
function input() {
    section('input');
    const n = 10, at = (r, c) => r * n + c;
    const cases = [
        [[0, 3.2], 'east', [at(4, 4), at(4, 5), at(4, 6), at(4, 7)]],
        [[0, -2.6], 'west', [at(4, 4), at(4, 3), at(4, 2), at(4, 1)]],
        [[2.1, 0.3], 'south', [at(4, 4), at(5, 4), at(6, 4)]],
        [[-3.9, -0.2], 'north', [at(4, 4), at(3, 4), at(2, 4), at(1, 4), at(0, 4)]],
        [[2.2, 1.8], 'south-east', [at(4, 4), at(5, 5), at(6, 6)]],
        [[-1.1, 0.9], 'north-east', [at(4, 4), at(3, 5)]],
        [[1.2, -1.1], 'south-west', [at(4, 4), at(5, 3)]],
        [[-2.8, -3.1], 'north-west', [at(4, 4), at(3, 3), at(2, 2), at(1, 1)]],
        [[0, 30], 'clipped at the edge', [at(4, 4), at(4, 5), at(4, 6), at(4, 7), at(4, 8), at(4, 9)]],
        [[0.2, -0.3], 'a nudge stays one cell', [at(4, 4)]]
    ];
    for (const [[dr, dc], name, want] of cases) {
        const got = C.lineVec(n, at(4, 4), dr, dc).cells;
        check(got.join() === want.join(), `drag ${name}`, `got ${got.join(',')} want ${want.join(',')}`);
    }
    // a drag along a row that wobbles 25 degrees keeps east; a fresh drag at 25 degrees is east too,
    // and one at 40 degrees turns diagonal unless the stroke was already east
    const wob = C.lineVec(n, at(4, 0), Math.tan(25 * Math.PI / 180) * 5, 5, 0);
    check(wob.dir === 0, 'a wobble of 25 degrees keeps the stroke on its row');
    const steep = C.lineVec(n, at(4, 0), Math.tan(40 * Math.PI / 180) * 5, 5, -1);
    check(steep.dir === 1, 'a fresh drag at 40 degrees reads as diagonal');
    const held = C.lineVec(n, at(4, 0), Math.tan(40 * Math.PI / 180) * 5, 5, 1);
    check(held.dir === 1, 'a diagonal is held through a drift back toward the row');
    // sweep: every drag angle and length gives a straight run from the start cell
    let crooked = 0;
    for (let a = 0; a < 360; a += 3) for (let len = 0; len < 12; len += 0.7) {
        const r = C.lineVec(n, at(5, 5), Math.sin(a * Math.PI / 180) * len, Math.cos(a * Math.PI / 180) * len);
        const cells = r.cells;
        if (cells[0] !== at(5, 5)) crooked++;
        for (let k = 1; k < cells.length; k++) {
            const d1 = [Math.floor(cells[k] / n) - Math.floor(cells[k - 1] / n), cells[k] % n - cells[k - 1] % n];
            if (Math.abs(d1[0]) > 1 || Math.abs(d1[1]) > 1 || (k > 1 && (cells[k] - cells[k - 1]) !== (cells[1] - cells[0]))) { crooked++; break; }
        }
    }
    check(!crooked, 'every drag at every angle is a straight run from where it started', `${crooked} crooked`);
    check(C.line(n, at(2, 2), at(2, 7)).join() === [22, 23, 24, 25, 26, 27].join(), 'tap-tap along a row');
    check(C.line(n, at(7, 1), at(2, 6)).join() === [71, 62, 53, 44, 35, 26].join(), 'tap-tap along a diagonal');

    const p = C.bookPuzzle(20);
    const w = p.words[0];
    check(C.match(p, w.cells, {})?.word === w.word, 'a word matches from its first letter');
    check(C.match(p, [...w.cells].reverse(), {})?.word === w.word, 'and from its last');
    check(C.match(p, w.cells.slice(0, -1), {}) === null, 'part of a word is not the word');
    check(C.match(p, [w.cells[0]], {}) === null, 'one cell is never a word');
    check(C.match(p, w.cells, {[w.word]: 1})?.already === true, 'a word found before says so');
}

// ------------------------------------------------------------------ play
function play() {
    section('play');
    let clashes = 0, strokes = 0, dealtBad = 0, games = 0;
    for (let i = 1; i <= 60; i++) {
        const p = i <= 40 ? C.bookPuzzle(i) : C.dailyPuzzle(C.dateKey(new Date(2027, 0, i)));
        const r = C.rng('bot' + i), found = {}, pens = {}, order = [];
        let last = 0, msg = '';
        // the bot finds words in a random order, half of them dragged from the far end
        const todo = p.words.map(w => w.word).sort(() => r() - 0.5);
        for (const word of todo) {
            const w = p.words.find(x => x.word === word);
            const cells = r() < 0.5 ? w.cells : [...w.cells].reverse();
            const m = C.match(p, cells, found);
            if (!m || m.already) { fail(`puzzle ${i}: ${word} was not accepted`); continue; }
            const pen = C.pickPen(p, pens, w.cells);
            // a pen is never shared with a touching stroke while any pen is free of them
            const near = p.words.filter(x => pens[x.word] != null && C.touches(p.size, x.cells, w.cells)).map(x => pens[x.word]);
            strokes++;
            if (near.includes(pen) && new Set(near).size < C.PENS) clashes++;
            pens[word] = pen; found[word] = 1; order.push(word);
            const now = C.dealt(p, order.length);
            if (now < last || now > p.messageCells.length) dealtBad++;
            for (let k = last; k < now; k++) msg += p.grid[p.messageCells[k]];
            last = now;
        }
        if (C.dealt(p, 0) !== 0 || last !== p.messageCells.length || msg !== C.letters(p.message)) dealtBad++;
        games++;
    }
    check(!dealtBad, `${games} games: the message is dealt in order, never back, whole at the end`);
    check(!clashes, `touching strokes never share a pen (${strokes} strokes)`, `${clashes} clashes`);
    const p = C.bookPuzzle(9);
    check(p.words.every((w, k) => C.dealt(p, k + 1) >= C.dealt(p, k)), 'each find deals at least as much as the one before');
    // reading the message early: the guess is the part not yet dealt, in any case, spaces ignored
    const msg = C.letters(p.message), d = C.dealt(p, 4);
    check(C.readsAs(p, d, msg.slice(d)), 'the rest of the message, typed, reads');
    check(C.readsAs(p, d, msg.slice(d).toLowerCase().split('').join(' ')), 'case and spaces do not matter');
    check(!C.readsAs(p, d, msg.slice(d, -1)), 'one letter short does not read');
    check(!C.readsAs(p, d, msg.slice(d, -1) + (msg.at(-1) === 'Z' ? 'Y' : 'Z')), 'one letter wrong does not read');
    check(!C.readsAs(p, d, msg), 'the whole message typed over the dealt letters does not read');
    check(C.dealt(p, Math.floor(p.words.length / 2)) > 0, 'half way through, some of the message is showing');
}

// ------------------------------------------------------------------ save
function save() {
    section('save');
    const fresh = C.cleanSave(null);
    check(fresh.next === 1 && fresh.sound === true && !Object.keys(fresh.solved).length, 'no save gives a fresh book');
    for (const junk of [42, 'x', [], {next: -3}, {next: 'seven'}, {solved: 'all'}, {progress: {'book:1': 'yes'}}]) {
        const s = C.cleanSave(junk);
        check(s.next >= 1 && typeof s.solved === 'object' && typeof s.progress === 'object', `junk save ${JSON.stringify(junk)} gives a usable one`);
    }
    const s = C.cleanSave({
        sound: false, next: 2,
        solved: {'book:5': {t: 90}, 'day:2026-10-01': {t: 200}, 'evil': {t: 1}},
        progress: {'book:6': {found: ['OAK', 7, 'PINE'], pens: {OAK: 2, PINE: 99}, t: 41}, 'nope': {found: []}}
    });
    check(s.sound === false, 'the sound setting survives');
    check(s.next === 6, 'the book moves past the highest puzzle solved');
    check(!s.solved.evil && s.solved['day:2026-10-01'].t === 200, 'only real puzzle keys are kept');
    check(s.progress['book:6'].found.join() === 'OAK,PINE' && s.progress['book:6'].pens.PINE === 0 && s.progress['book:6'].pens.OAK === 2,
        'progress keeps its words and repairs a bad pen');
    check(!s.progress.nope, 'progress under a strange key is dropped');
    const e = C.cleanSave({solved: {'book:3': {t: 50, early: 4}, 'book:4': {t: 9, early: 'x'}}, progress: {'book:7': {found: ['A'], early: 2}, 'book:8': {found: [], early: -1}}});
    check(e.solved['book:3'].early === 4 && e.solved['book:4'].early === undefined, 'an early read survives on a solved puzzle, a bad one is dropped');
    check(e.progress['book:7'].early === 2 && e.progress['book:8'].early === undefined, 'and on a puzzle in progress');

    const days = {};
    ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].forEach(k => { days[k] = 1; });
    check(C.streak(days, '2026-10-01') === 4, 'four days in a row is a streak of four');
    check(C.streak(days, '2026-10-02') === 4, 'the streak holds while today is still open');
    check(C.streak(days, '2026-10-03') === 0, 'a missed day ends it');
    check(C.streak({'2027-03-27': 1, '2027-03-28': 1}, '2027-03-28') === 2, 'a streak runs across the clock change');
}

const run = {themes, puzzles, book, input, play, save};
for (const s of suites) {
    if (!run[s]) { console.log(`unknown suite ${s}; known: ${ALL.join(', ')}`); process.exit(1); }
    run[s]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
