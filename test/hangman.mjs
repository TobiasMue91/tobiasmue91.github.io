#!/usr/bin/env node
// Test suite for games/hangman.html (Last Words).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page is a woodcut and a type
// case around a small set of rules - which letters are in, how many marks hang a man, which word
// is today's - and a list of 800 words. What can go quietly wrong is mostly in the list: a word a
// player cannot reach from its clue, a sheet that repeats or lands on the same category two days
// running, a share line that gives the word away, a streak that miscounts. No browser, no server.
//
//   node test/hangman.mjs                  # everything
//   node test/hangman.mjs words fair       # named suites only
//   node test/hangman.mjs --page=path.html # run against another copy of the page
//
// Suites: words, rules, daily, fair, docket, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'hangman.html'));
const ALL = ['words', 'rules', 'daily', 'fair', 'docket', 'saves'];
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
vm.runInContext(core[1] + '\nthis.LW = LW;', ctx);
const LW = ctx.LW;
const play = (s, letters) => { for (const L of letters) LW.guess(s, L); return s; };

// A player who knows some of the words: each word of each clue comes to mind with the given
// chance (the answer too, decided once per round). They guess the letter most of the words they
// can think of would need, and fall back on how common letters are when nothing they know fits.
function player(know, r) {
    const known = new Map(LW.CATS.map(c => [c.id, c.words.filter(() => r() < know)]));
    let round = null, pool0 = null;
    return s => {
        if (round !== s) { round = s; pool0 = known.get(s.cat).filter(w => w !== s.word).concat(r() < know ? [s.word] : []); }
        const pool = pool0.filter(w => w.length === s.word.length && [...w].every((c, i) => s.guesses.includes(c) ? s.word[i] === c : !s.guesses.includes(c)) && ![...s.word].some((c, i) => s.guesses.includes(c) && w[i] !== c));
        const counts = {};
        for (const w of pool) for (const L of new Set(w)) if (!s.guesses.includes(L)) counts[L] = (counts[L] || 0) + 1;
        let best = null;
        for (const L of 'EAIROTNSLCUDPMHGBFYWKVXZJQ') if (!s.guesses.includes(L) && (best === null || (counts[L] || 0) > (counts[best] || 0))) best = L;
        return best;
    };
}
function playOut(s, pick) { while (!LW.isOver(s)) LW.guess(s, pick(s)); return s; }

if (suites.includes('words')) {
    section('words');
    const seen = new Map();
    for (const c of LW.CATS) {
        check(c.words.length >= 30, `${c.id} has enough words to share a day`, `${c.words.length}`);
        check(/^[a-z]/.test(c.label) && c.label.length <= 26, `${c.id}'s clue reads after "His last word was" and fits one line on a phone`, c.label);
        for (const w of c.words) {
            if (!/^[A-Z]{4,11}$/.test(w)) fail(`${w} (${c.id}) is 4-11 plain letters`);
            if (seen.has(w)) fail(`${w} is in ${seen.get(w)} and ${c.id}`, 'a word belongs to one clue');
            seen.set(w, c.id);
        }
    }
    check(LW.WORDS.length === seen.size, 'every word is listed once', `${LW.WORDS.length} entries, ${seen.size} words`);
    check(LW.WORDS.length >= 700, 'there are enough words for two years of sheets and long dockets', `${LW.WORDS.length}`);
}

if (suites.includes('rules')) {
    section('rules');
    const s = LW.round('KETTLE', 'kitchen', 'Ned Blackwood', {mode: 'endless', no: 1});
    let r = LW.guess(s, 'e');
    check(r.kind === 'hit' && r.at.join() === '1,5', 'a hit names every slot it fills, in lower case or upper', JSON.stringify(r));
    r = LW.guess(s, 'T');
    check(r.kind === 'hit' && r.at.join() === '2,3', 'a double letter fills both slots at once');
    r = LW.guess(s, 'E');
    check(r.kind === 'again' && LW.missesOf(s) === 0 && s.guesses.length === 2, 'a letter already tried costs nothing and is not recorded twice');
    r = LW.guess(s, 'S');
    check(r.kind === 'miss' && r.misses === 1, 'a miss reports the marks so far');
    check(LW.guess(s, '').kind === 'bad' && LW.guess(s, '1').kind === 'bad' && LW.guess(s, 'AB').kind === 'bad' && LW.guess(s, 'É').kind === 'bad', 'anything but one plain letter is refused');
    check(LW.shown(s).join('') === 'ETTE' && LW.shown(s).length === 6, 'what shows is the word with only the found letters', JSON.stringify(LW.shown(s)));
    play(s, 'AIOU');
    check(LW.missesOf(s) === 5 && !LW.isOver(s), 'five marks and he still stands');
    r = LW.guess(s, 'R');
    check(r.kind === 'miss' && r.lost && LW.isLost(s) && LW.isOver(s), 'the sixth mark hangs him');
    check(LW.guess(s, 'K').kind === 'over' && !s.guesses.includes('K'), 'nothing more is taken once he is hanged');
    const w = LW.round('KETTLE', 'kitchen', 'x', {mode: 'endless', no: 1});
    play(w, 'ZQXJV');
    r = null; for (const L of 'KETL') r = LW.guess(w, L);
    check(r.won && LW.isWon(w) && !LW.isLost(w) && LW.missesOf(w) === 5, 'the last letter found pardons him, even at five marks');
    check(LW.guess(w, 'A').kind === 'over', 'nothing more is taken once he is pardoned');
    const share = LW.shareText(Object.assign(w, {no: 12}));
    check(!/K|E|T|L/.test(share.replace(/Last Words|gptgames\.dev\/games\/hangman\.html/g, '')) && /Nº 12/.test(share) && /5 marks/.test(share), 'the share line names the sheet and the marks and gives nothing of the word away', share);
}

if (suites.includes('daily')) {
    section('daily');
    check(LW.dayNumber(new Date(2026, 9, 1, 0, 0, 1)) === 1 && LW.dayNumber(new Date(2026, 9, 1, 23, 59, 59)) === 1, 'Nº 1 is the whole of the 1st of October 2026, local time');
    check(LW.dayNumber(new Date(2026, 9, 2, 0, 0, 0)) === 2, 'Nº 2 starts at local midnight');
    check(LW.dayNumber(new Date(2027, 2, 28, 12)) - LW.dayNumber(new Date(2027, 2, 27, 12)) === 1 && LW.dayNumber(new Date(2026, 9, 25, 12)) - LW.dayNumber(new Date(2026, 9, 24, 12)) === 1, 'clocks changing does not skip or repeat a sheet');
    const list = LW.dailyList();
    const a = LW.daily(40), b = LW.daily(40);
    check(a.word === b.word && a.name === b.name && a.cat === b.cat && a.no === 40, 'a sheet is the same for everyone who opens it');
    const days = Array.from({length: list.length}, (_, i) => LW.daily(i + 1));
    check(new Set(days.map(d => d.word)).size === list.length, `every eligible word comes round once before any repeats (${list.length} days)`);
    let runs = 0; for (let i = 1; i < days.length; i++) if (days[i].cat === days[i - 1].cat) runs++;
    check(runs === 0, 'no clue two days running', `${runs} repeats`);
    check(days.every(d => d.word.length >= 5 && d.word.length <= 10 && LW.difficulty(d.word) >= 2 && LW.difficulty(d.word) <= 9), 'every sheet is a fair cold start: 5-10 letters, neither a giveaway nor a lottery');
    const cats = new Set(days.slice(0, 40).map(d => d.cat));
    check(cats.size >= 15, 'the first weeks range over the clues', `${cats.size} of ${LW.CATS.length}`);
    check(new Set(days.slice(0, 60).map(d => d.name)).size >= 50, 'a different man hangs most days');
    check(LW.daily(0).word && LW.daily(-5).word && LW.daily(list.length + 3).word === LW.daily(3).word, 'a clock set before Nº 1, or a list that has run out, still gives a sheet');
}

if (suites.includes('fair')) {
    section('fair');
    // A player who knows every word in the clue can always reach it. A word this player loses is a
    // trap of the _ATCH kind, where several words fit and only guessing can tell them apart.
    let worst = 0, worstWord = '';
    for (const e of LW.WORDS) { const m = LW.smartMisses(e.w, e.c); if (m > worst) { worst = m; worstWord = e.w; } if (m >= 4) fail(`${e.w} (${e.c}) can be lost even by someone who knows every word in its clue`, `${m} marks`); }
    pass('no trap words');
    console.log(`  hardest for a player who knows the clue: ${worstWord}, ${worst} marks`);
    // And a person who knows only some of the words should win most sheets.
    const r = (s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(7);
    for (const [know, floor] of [[0.8, 0.82], [0.5, 0.58], [0.2, 0.32]]) {
        let won = 0; const N = 300;
        for (let n = 1; n <= N; n++) { const s = LW.daily(n); if (LW.isWon(playOut(s, player(know, r)))) won++; }
        check(won / N >= floor, `a player who knows ${know * 100}% of each clue's words wins at least ${Math.round(floor * 100)}% of sheets`, `${won}/${N}`);
        console.log(`  knows ${String(know * 100).padStart(2)}% of a clue: wins ${(100 * won / N).toFixed(0)}% of the first ${N} sheets`);
    }
}

if (suites.includes('docket')) {
    section('docket');
    let prev = [-1, -1], rising = true;
    for (let c = 1; c <= 30; c++) { const b = LW.band(c); if (b[0] < prev[0] || b[1] < prev[1]) rising = false; prev = b; }
    check(rising, 'cases never get easier as the docket goes on');
    const r = (s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(11);
    const seen = [];
    for (let c = 1; c <= 40; c++) { const s = LW.endless(c, r, seen); const [lo, hi] = LW.band(c); if (LW.difficulty(s.word) < lo || LW.difficulty(s.word) > hi) fail(`case ${c} (${s.word}) is in its band`); seen.push(s.word); }
    check(new Set(seen).size === seen.length, 'forty cases in a row without a repeat');
    // A person who knows some of each clue's words: the docket should let them in, then wear them down.
    const lens = [];
    const early = [0, 0], late = [0, 0];
    for (let run = 0; run < 300; run++) {
        const p = player(0.5, r), seenRun = [];
        let c = 1;
        for (; c <= 60; c++) {
            const s = playOut(LW.endless(c, r, seenRun), p); seenRun.push(s.word);
            const bucket = c <= 5 ? early : c >= 15 ? late : null;
            if (bucket) { bucket[0]++; if (LW.isWon(s)) bucket[1]++; }
            if (LW.isLost(s)) break;
        }
        lens.push(c);
    }
    lens.sort((a, b) => a - b);
    const med = lens[lens.length >> 1];
    console.log(`  a player who knows half of each clue: median docket ${med} cases, early cases won ${(100 * early[1] / early[0]).toFixed(0)}%, from case 15 on ${(100 * late[1] / Math.max(1, late[0])).toFixed(0)}%`);
    check(early[1] / early[0] >= 0.9, 'the first five cases are won nine times in ten');
    check(late[0] === 0 || late[1] / late[0] < early[1] / early[0] - 0.05, 'later cases are harder than the first ones');
    check(med >= 6 && med <= 40, 'a docket lasts long enough to matter and ends', `median ${med}`);
}

if (suites.includes('saves')) {
    section('saves');
    const save = LW.fresh();
    const d = play(LW.daily(5), 'EAR');
    save.daily = d;
    const back = LW.load(JSON.stringify(save));
    check(JSON.stringify(back.daily) === JSON.stringify(d), 'a sheet half played comes back exactly');
    check(LW.load(JSON.stringify(Object.assign(LW.fresh(), {mode: 'endless'}))).mode === 'endless' && !LW.load(JSON.stringify(Object.assign(LW.fresh(), {mode: 'nonsense'}))).mode,
        'a reload opens the kind of round that was open');
    for (const junk of ['', 'null', '{', '[]', '{"v":2}', JSON.stringify({v: 1, daily: {word: 'kettle', cat: 'kitchen', name: 'x', guesses: [], no: 1, mode: 'daily'}}),
        JSON.stringify({v: 1, daily: Object.assign({}, d, {guesses: ['E', 'E']})}), JSON.stringify({v: 1, daily: Object.assign({}, d, {cat: 'nope'})}), JSON.stringify({v: 1, stats: {streak: -3, marks: [1, 2]}})]) {
        const o = LW.load(junk);
        if (o.daily || o.stats.streak !== 0 || o.stats.marks.length !== 7) fail('a damaged save is dropped, not trusted', junk);
    }
    pass('damaged saves are dropped');
    const won = n => play(LW.round('KETTLE', 'kitchen', 'x', {mode: 'daily', no: n}), 'KETL');
    const lost = n => play(LW.round('KETTLE', 'kitchen', 'x', {mode: 'daily', no: n}), 'ABCDFG');
    const st = LW.fresh();
    LW.record(st, won(3)); LW.record(st, won(4)); LW.record(st, won(5));
    check(st.stats.streak === 3 && st.stats.bestStreak === 3 && st.stats.played === 3, 'three sheets won on three days is a streak of three');
    check(LW.record(st, won(5)) === false && st.stats.played === 3, 'a sheet is counted once however often it is finished');
    check(LW.record(st, won(4)) === false, 'an older sheet does not count after a newer one');
    LW.record(st, won(7));
    check(st.stats.streak === 1 && st.stats.bestStreak === 3, 'a day missed starts the streak again');
    LW.record(st, lost(8));
    check(st.stats.streak === 0 && st.stats.marks[6] === 1 && st.stats.won === 4, 'a hanging ends the streak and is counted as one');
    check(LW.liveStreak({stats: {lastNo: 9, streak: 4}}, 10) === 4 && LW.liveStreak({stats: {lastNo: 8, streak: 4}}, 10) === 0, 'a streak shows only while yesterday\'s sheet was the last one won');
    const m = LW.fresh();
    check(LW.migrate(m, JSON.stringify({score: 420, gamesPlayed: 12, gamesWon: 9, difficulty: 'hard', maxGuesses: 8, darkMode: true})) && m.stats.played === 12 && m.stats.won === 9 && m.stats.streak === 0,
        'games played and won on the old page carry over into the record');
    for (const junk of ['', '{', 'null', '{"gamesPlayed":3,"gamesWon":5}', '{"gamesPlayed":-1,"gamesWon":0}', '{"gamesPlayed":"7","gamesWon":"2"}', '{"score":50}']) {
        const f = LW.fresh();
        if (LW.migrate(f, junk) || f.stats.played !== 0) fail('an old save that does not add up is left behind', junk);
    }
    pass('old saves that do not add up are left behind');
    const unfinished = LW.round('KETTLE', 'kitchen', 'x', {mode: 'daily', no: 9});
    check(LW.record(st, unfinished) === false, 'an unfinished sheet is not counted');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
