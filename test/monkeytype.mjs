#!/usr/bin/env node
// Test suite for games/monkeytype.html (Monkeytype Clone).
//
// Runs the page's DOM-free <script id="core"> block in Node. A typing test has one promise
// nobody can check from the page: that the number it shows is true. Bots type whole tests the
// way people do - letter by letter at a steady or a ragged pace, with slips they fix and slips
// they leave, or a word at a time the way a phone's autocorrect hands it over - and each keeps
// its own tally of what it typed. The page's wpm and accuracy must agree with that tally.
//
//   node test/monkeytype.mjs                  # everything
//   node test/monkeytype.mjs input bots       # named suites only
//   node test/monkeytype.mjs --page=path.html # run against another copy of the page
//
// Suites: words, input, scoring, bots, store, page (page needs Playwright's Chromium and is
// skipped without it).

import {readFileSync} from 'fs';
import {fileURLToPath, pathToFileURL} from 'url';
import {dirname, join} from 'path';
import {execSync} from 'child_process';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'monkeytype.html'));
const ALL = ['words', 'input', 'scoring', 'bots', 'store', 'page'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({Math, Date, JSON, String, Number, Array, Object, isFinite});
vm.runInContext(core[1] + '\nthis.T = TypeCore;', ctx);
const T = ctx.T;

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
// Feed the core the way the page does: each value is what the text field holds after one edit.
function feed(t, field, value, time) { field.v = T.input(t, value, time); return field.v; }
function typeChar(t, field, ch, time) { return feed(t, field, field.v + ch, time); }
function backspace(t, field, time) { return feed(t, field, field.v.slice(0, -1), time); }
const newField = () => ({v: ' '});

// ---------------------------------------------------------------- words
if (suites.includes('words')) {
    section('words');
    for (const [name, list] of Object.entries(T.LISTS)) {
        const arr = Array.from(list);
        check(arr.every(w => /^[a-z]+$/.test(w)), `${name}: every word is plain lowercase letters`, arr.filter(w => !/^[a-z]+$/.test(w)).join(' '));
        check(new Set(arr).size === arr.length, `${name}: no duplicates`, `${arr.length - new Set(arr).size} repeated`);
    }
    check(T.LISTS.english.length === 200, 'english has 200 words', T.LISTS.english.length);
    check(T.LISTS.english_1k.length === 1000, 'english 1k has 1000 words', T.LISTS.english_1k.length);

    const words = (cfg, seed, n = 300) => {
        const t = T.create({...cfg, mode: 'time', amount: 120}, {seed});
        while (t.words.length < n) T.input(t, ' ' + t.words[t.wi] + ' ', 0);
        return Array.from(t.words).slice(0, n);
    };
    const cfgs = [
        {mode: 'time', amount: 30}, {mode: 'time', amount: 60, list: 'english_1k'},
        {mode: 'time', amount: 30, punctuation: true}, {mode: 'time', amount: 30, numbers: true},
        {mode: 'time', amount: 30, punctuation: true, numbers: true}
    ];
    for (const cfg of cfgs) {
        const a = words(cfg, 'abc123'), b = words(cfg, 'abc123'), c = words(cfg, 'abc124');
        const label = JSON.stringify(cfg);
        check(a.join(' ') === b.join(' '), `${label}: a seed always gives the same words`);
        check(a.join(' ') !== c.join(' '), `${label}: another seed gives other words`);
        let rep = 0;
        for (let i = 1; i < a.length; i++) if (a[i] === a[i - 1]) rep++;
        check(rep === 0, `${label}: never the same word twice in a row`, rep);
    }
    // the same words whatever gets typed in between
    {
        const t = T.create({mode: 'time', amount: 120}, {seed: 'zz'}), f = newField();
        let time = 0;
        for (let i = 0; i < 150; i++) { feed(t, f, ' ' + t.words[t.wi] + ' ', time += 50); }
        check(Array.from(t.words).slice(0, 200).join(' ') === words({mode: 'time', amount: 120}, 'zz', 200).join(' '),
            'time mode: words arriving while typing are the seed\'s words');
    }
    for (const n of T.AMOUNTS.words) {
        const t = T.create({mode: 'words', amount: n}, {seed: 's'});
        check(t.words.length === n, `words ${n}: exactly ${n} words`, t.words.length);
    }
    {
        const w = words({mode: 'time', amount: 30, punctuation: true}, 'punct', 3000);
        check(/^[A-Z]/.test(w[0]), 'punctuation: the first word is capitalised', w[0]);
        let afterStop = 0, capsAfterStop = 0, ends = 0, commas = 0;
        for (let i = 1; i < w.length; i++) {
            if (/[.?!]$/.test(w[i - 1])) { afterStop++; if (/^["(]?[A-Z]/.test(w[i])) capsAfterStop++; }
            if (/[.?!]$/.test(w[i])) ends++;
            if (/,$/.test(w[i])) commas++;
        }
        check(afterStop > 0 && capsAfterStop === afterStop, 'punctuation: every sentence starts with a capital', `${capsAfterStop}/${afterStop}`);
        const avgSentence = w.length / ends;
        check(avgSentence > 5 && avgSentence < 14, 'punctuation: sentences run 5 to 14 words on average', avgSentence.toFixed(1));
        check(commas / w.length > 0.03 && commas / w.length < 0.12, 'punctuation: a comma every 8 to 30 words', (commas / w.length).toFixed(3));
        const n = words({mode: 'time', amount: 30, numbers: true}, 'num', 3000);
        const share = n.filter(x => /^\d+$/.test(x)).length / n.length;
        check(share > 0.08 && share < 0.16, 'numbers: about one word in eight is a number', share.toFixed(3));
    }
}

// ---------------------------------------------------------------- input
if (suites.includes('input')) {
    section('input');
    const mk = (words, mode = 'words') => {
        const t = T.create({mode, amount: mode === 'time' ? 15 : 10}, {words});
        if (mode === 'time') { t.custom = null; }
        return t;
    };
    {   // letter by letter, space between words
        const t = mk(['the', 'cat']), f = newField();
        let time = 0;
        for (const ch of 'the') typeChar(t, f, ch, time += 100);
        check(t.start === 100, 'the clock starts at the first keystroke', t.start);
        typeChar(t, f, ' ', time += 100);
        check(t.wi === 1 && f.v === ' ', 'a space moves to the next word and empties the field', `${t.wi} ${JSON.stringify(f.v)}`);
        for (const ch of 'cat') typeChar(t, f, ch, time += 100);
        check(t.done && t.end === 700, 'words mode ends the moment the last word is right, without a space', `${t.done} ${t.end}`);
        const r = T.result(t);
        check(r.chars.correct === 6 && r.keys === 7 && r.acc === 100, 'seven keystrokes, all right', JSON.stringify(r.chars) + ' ' + r.keys);
    }
    {   // space on an empty word, backspace rules
        const t = mk(['one', 'two', 'three']), f = newField();
        let time = 0;
        typeChar(t, f, ' ', time += 100);
        check(t.start === null && t.wi === 0, 'a space before anything is typed does nothing');
        for (const ch of 'one ') typeChar(t, f, ch, time += 100);
        typeChar(t, f, ' ', time += 100);
        check(t.wi === 1 && t.keys === 4, 'a second space on an empty word does nothing', `${t.wi} ${t.keys}`);
        backspace(t, f, time += 100);
        check(t.wi === 1 && f.v === ' ', 'backspace cannot go back into a word typed right');
        for (const ch of 'tw ') typeChar(t, f, ch, time += 100);
        check(t.wi === 2, 'a space in the middle of a word skips the rest of it');
        backspace(t, f, time += 100);
        check(t.wi === 1 && f.v === ' tw', 'backspace on an empty word goes back into a wrong one', `${t.wi} ${JSON.stringify(f.v)}`);
        typeChar(t, f, 'o', time += 100); typeChar(t, f, ' ', time += 100);
        check(t.wi === 2 && t.typed[1] === 'two', 'and it can be fixed');
        backspace(t, f, time += 100);
        check(t.wi === 2, 'once fixed it stays behind');
        const r = T.result(t);
        check(r.missed.includes('two'), 'a word that took a wrong keystroke is listed as missed even once fixed', r.missed.join(','));
    }
    {   // wrong letters, extra letters
        const t = mk(['cat', 'dog']), f = newField();
        let time = 0;
        for (const ch of 'cut') typeChar(t, f, ch, time += 100);
        check(t.keys === 3 && t.correctKeys === 2, 'a wrong letter is a wrong keystroke');
        for (let i = 0; i < 40; i++) typeChar(t, f, 'x', time += 10);
        check(t.typed[0].length === 23, 'no more than 20 letters past the end of a word', t.typed[0].length);
        typeChar(t, f, ' ', time += 100);
        for (const ch of 'dog') typeChar(t, f, ch, time += 100);
        const r = T.result(t);
        check(r.chars.correct === 5 && r.chars.incorrect === 1 && r.chars.extra === 20 && r.chars.missed === 0,
            'characters: 5 right, 1 wrong, 20 extra', JSON.stringify(r.chars));
    }
    {   // a phone: autocorrect replaces the word, whole words arrive at once
        const t = mk(['the', 'quick', 'brown']), f = newField();
        feed(t, f, ' teh', 100);
        feed(t, f, ' the ', 400);
        check(t.wi === 1 && t.typed[0] === 'the', 'autocorrect replacing a word is taken as the new word');
        feed(t, f, ' quick brown', 900);
        check(t.done && t.typed[1] === 'quick' && t.typed[2] === 'brown', 'two words in one input event are both typed');
        const t2 = mk(['one', 'two']), f2 = newField();
        feed(t2, f2, ' one\ntwo', 100);
        check(t2.done, 'a newline counts as a space');
    }
    {   // an IME or dead key composes a letter in steps
        const t = mk(['café']), f = newField();
        let time = 0;
        for (const v of [' c', ' ca', ' caf', ' caf´', ' café']) feed(t, f, v, time += 100);
        check(t.done && t.typed[0] === 'café', 'a composed letter replaces the dead key');
    }
    {   // time mode
        const t = T.create({mode: 'time', amount: 15}, {seed: 'q'}), f = newField();
        let time = 1000;
        for (let i = 0; i < 20; i++) feed(t, f, ' ' + t.words[t.wi] + ' ', time += 300);
        check(t.start === 1300 && !T.tick(t, 16299) && T.tick(t, 16300), 'a 15 second test ends at exactly 15 seconds after the first key');
        check(t.end === 16300, 'and says so', t.end);
        const k = t.keys;
        feed(t, f, ' abc', 16800);
        check(t.keys === k, 'nothing typed after the end counts');
        const r = T.result(t);
        check(r.time === 15 && r.graph.length === 15, 'the graph has one point per second', r.graph.length);
    }
    {   // the field's value round trips
        const t = mk(['alpha', 'beta']), f = newField();
        feed(t, f, ' al', 100);
        check(f.v === ' al', 'the field holds a space and the word so far', JSON.stringify(f.v));
        feed(t, f, 'al', 200);
        check(f.v === ' al', 'a field that lost its leading space gets it back');
    }
}

// ---------------------------------------------------------------- scoring
if (suites.includes('scoring')) {
    section('scoring');
    // a perfect typist at exactly 60 wpm: one character (spaces too) every 200 ms
    for (const amount of [15, 30, 60]) {
        const t = T.create({mode: 'time', amount}, {seed: 'steady'}), f = newField();
        let time = 0;
        while (!t.done) {
            const w = t.words[t.wi];
            for (const ch of w + ' ') { if (T.tick(t, time)) break; typeChar(t, f, ch, time); time += 200; }
        }
        const r = T.result(t);
        // count by hand: chars of whole words plus their spaces, plus the correct part of the last
        let chars = 0;
        for (let i = 0; i < t.wi; i++) chars += t.words[i].length + 1;
        chars += t.typed[t.wi].length;
        const want = chars / 5 / (amount / 60);
        check(near(r.wpm, want, 1e-9), `time ${amount}: wpm is correct characters / 5 per minute`, `${r.wpm} vs ${want}`);
        check(near(r.wpm, 60, 0.5), `time ${amount}: a steady 60 wpm typist scores 60`, r.wpm.toFixed(2));
        check(near(r.raw, 60, 0.5) && r.acc === 100, `time ${amount}: raw 60 and accuracy 100`, `${r.raw.toFixed(2)} ${r.acc}`);
        check(r.consistency > 95, `time ${amount}: an even pace is consistent`, r.consistency.toFixed(1));
        check(near(r.graph[r.graph.length - 1].wpm, r.wpm, 1e-9), `time ${amount}: the graph ends on the final wpm`);
        check(r.graph.every((g, i) => i < 2 || near(g.raw, 60, 12)), `time ${amount}: the raw line stays near 60`, r.graph.map(g => Math.round(g.raw)).join(' '));
    }
    {   // a wrong word does not count toward wpm, but does toward raw
        const t = T.create({mode: 'words', amount: 2}, {words: ['aaaaa', 'bbbbb']}), f = newField();
        feed(t, f, ' aaaab', 0); feed(t, f, ' aaaab ', 3000); feed(t, f, ' bbbbb', 6000);
        const r = T.result(t);
        check(near(r.wpm, 5 / 5 / 0.1, 1e-9), 'a wrong word earns no wpm', r.wpm);
        check(near(r.raw, 11 / 5 / 0.1, 1e-9), 'but every typed character is raw', r.raw);
    }
    {
        check(T.consistency([50, 50, 50, 50]) === 100, 'consistency: an even pace is 100');
        check(T.consistency([100, 0, 100, 0]) < 40, 'consistency: stop and go is low', T.consistency([100, 0, 100, 0]).toFixed(1));
        check(T.consistency([60, 70, 65, 55]) > T.consistency([30, 90, 40, 100]), 'consistency: less spread is more consistent');
    }
}

// ---------------------------------------------------------------- bots
// A bot types at a pace in wpm with jitter, slips on a share of letters and notices a share of
// its slips (then backspaces and retypes). It keeps its own count of what it did.
function bot({wpm, jitter = 0.25, slip = 0, notice = 1, pauses = 0, phone = false, seed = 1}) {
    const r = mulberry(seed);
    return (t) => {
        const f = newField();
        let time = 0, keys = 0, goodKeys = 0;
        const ms = () => 12000 / wpm * Math.max(0.2, 1 + (r() * 2 - 1) * jitter);
        const done = () => T.tick(t, time) || t.done;
        while (!done()) {
            const w = t.words[t.wi];
            if (phone) {   // a phone hands over whole words; the bot's slips are fixed by autocorrect or left
                for (let k = 0; k <= w.length; k++) time += ms();
                if (done()) break;
                let typed = w;
                if (r() < slip * w.length && r() > notice) typed = w.slice(0, -1) + (w.endsWith('z') ? 'y' : 'z');
                for (let k = 0; k < typed.length; k++) { keys++; if (typed[k] === w[k]) goodKeys++; }
                const finishes = t.mode === 'words' && t.wi === t.words.length - 1 && typed === w;
                if (!finishes) { keys++; if (typed === w) goodKeys++; }
                feed(t, f, ' ' + typed + ' ', time);
                continue;
            }
            for (let k = 0; k < w.length && !done(); k++) {
                if (r() < slip) {
                    const wrong = w[k] === 'q' ? 'w' : 'q';
                    typeChar(t, f, wrong, time); keys++; time += ms();
                    if (r() < notice) { if (done()) break; backspace(t, f, time); time += ms(); }
                    else continue;
                    if (done()) break;
                }
                typeChar(t, f, w[k], time); keys++; goodKeys++; time += ms();
                if (pauses && r() < pauses) time += 1500 + r() * 2500;
            }
            if (done()) break;
            if (t.mode === 'words' && t.wi === t.words.length - 1 && t.typed[t.wi] === w) break;
            const right = t.typed[t.wi] === w;
            typeChar(t, f, ' ', time); keys++; if (right) goodKeys++; time += ms();
        }
        return {keys, goodKeys};
    };
}
if (suites.includes('bots')) {
    section('bots');
    const players = [
        ['beginner', {wpm: 30, jitter: 0.5, slip: 0.06, notice: 0.7, pauses: 0.02}],
        ['casual', {wpm: 55, jitter: 0.35, slip: 0.03, notice: 0.9}],
        ['typist', {wpm: 90, jitter: 0.25, slip: 0.015, notice: 1}],
        ['fast', {wpm: 140, jitter: 0.2, slip: 0.01, notice: 1}],
        ['sloppy', {wpm: 80, jitter: 0.3, slip: 0.05, notice: 0}],
        ['phone', {wpm: 40, jitter: 0.3, slip: 0.02, notice: 0.5, phone: true}]
    ];
    const rows = [];
    for (const [name, p] of players) {
        for (const cfg of [{mode: 'time', amount: 30}, {mode: 'time', amount: 60, punctuation: true}, {mode: 'words', amount: 50}]) {
            let wpm = 0, acc = 0, cons = 0, n = 6, bad = 0;
            for (let g = 0; g < n; g++) {
                const t = T.create(cfg, {seed: `${name}${g}`});
                const tally = bot({...p, seed: g + 1})(t);
                const r = T.result(t);
                // the bot's own count of wpm: whole words it got right, the spaces after them,
                // and the right beginning of the word it was on
                let chars = 0;
                for (let i = 0; i <= Math.min(t.wi, t.words.length - 1); i++) {
                    const w = t.words[i], typed = t.typed[i];
                    const closed = i < t.wi || t.mode === 'words';
                    if (closed ? typed === w : w.startsWith(typed)) chars += typed.length + (i < t.wi ? 1 : 0);
                }
                const own = chars / 5 / (r.time / 60);
                if (!near(r.wpm, own, 1e-6)) bad++;
                if (!near(r.acc, tally.goodKeys / tally.keys * 100, 1e-6)) bad++;
                if (r.keys !== tally.keys) bad++;
                wpm += r.wpm / n; acc += r.acc / n; cons += r.consistency / n;
            }
            check(bad === 0, `${name} ${cfg.mode} ${cfg.amount}${cfg.punctuation ? ' punctuation' : ''}: wpm, accuracy and keystrokes match the bot's own count`, `${bad} mismatches`);
            rows.push({name, test: `${cfg.mode} ${cfg.amount}${cfg.punctuation ? ' p' : ''}`, pace: p.wpm, wpm, acc, cons});
        }
    }
    console.log('\n  player    test          pace   wpm   acc   consistency');
    for (const r of rows) console.log(`  ${r.name.padEnd(9)} ${r.test.padEnd(12)} ${String(r.pace).padStart(5)} ${r.wpm.toFixed(1).padStart(5)} ${r.acc.toFixed(1).padStart(5)}% ${r.cons.toFixed(0).padStart(6)}%`);
    const by = n => rows.filter(r => r.name === n && r.test === 'time 30');
    const w = n => by(n)[0].wpm;
    check(w('beginner') < w('casual') && w('casual') < w('typist') && w('typist') < w('fast'), 'faster typists score higher, in order');
    for (const n of ['casual', 'typist', 'fast']) check(near(w(n), players.find(p => p[0] === n)[1].wpm * (1 - 0.06), players.find(p => p[0] === n)[1].wpm * 0.12),
        `${n}: scores close to the pace it types at`, `${w(n).toFixed(1)} at ${players.find(p => p[0] === n)[1].wpm}`);
    check(w('sloppy') < 80 * 0.85, 'sloppy: leaving slips in costs real wpm', w('sloppy').toFixed(1));
    check(by('sloppy')[0].acc < by('typist')[0].acc, 'sloppy: and accuracy');
    check(by('beginner')[0].cons < by('fast')[0].cons, 'pauses and an uneven pace show as lower consistency');

    {   // a masher gets nothing and does not count
        const t = T.create({mode: 'time', amount: 15}, {seed: 'mash'}), f = newField(), r = mulberry(9);
        let time = 0;
        while (!T.tick(t, time)) { typeChar(t, f, r() < 0.15 ? ' ' : String.fromCharCode(97 + Math.floor(r() * 26)), time); time += 40; }
        const res = T.result(t);
        check(res.wpm < 5 && res.raw > 200 && !res.valid, 'mashing keys: fast raw, no wpm, not counted', `${res.wpm.toFixed(1)} raw ${res.raw.toFixed(0)} acc ${res.acc.toFixed(0)}`);
    }
    {   // afk
        const t = T.create({mode: 'time', amount: 30}, {seed: 'afk'}), f = newField();
        feed(t, f, ' ' + t.words[0] + ' ', 0); feed(t, f, ' ' + t.words[1] + ' ', 500);
        T.tick(t, 30000);
        const r = T.result(t);
        check(r.afk && !r.valid, 'a test left alone after two words does not count');
        const t2 = T.create({mode: 'time', amount: 30}, {seed: 'afk'});
        bot({wpm: 50, pauses: 0.03, seed: 4})(t2);
        check(!T.result(t2).afk, 'pauses of a few seconds to think are not afk');
    }
}

// ---------------------------------------------------------------- store
if (suites.includes('store')) {
    section('store');
    for (const junk of [null, '', '{', '[]', '"x"', '{"pb":5,"history":{}}', '{"pb":{"a":{"wpm":"x"}},"history":[1,null,{"key":3}]}', '{"config":{"mode":"words","amount":7}}']) {
        let s, threw = false;
        try { s = T.loadStore(junk); } catch (e) { threw = true; }
        check(!threw && s && typeof s.pb === 'object' && Array.isArray(s.history) && T.AMOUNTS[s.config.mode].includes(s.config.amount),
            `a broken save (${String(junk).slice(0, 30)}) loads as a clean one`);
    }
    const s = T.loadStore(null);
    const cfg = {mode: 'time', amount: 30};
    const res = w => ({wpm: w, raw: w + 5, acc: 96, consistency: 70, valid: true});
    let r = T.record(s, cfg, res(60), 1);
    check(r.pb && !r.previous, 'the first test is the personal best');
    r = T.record(s, cfg, res(55), 2);
    check(!r.pb && r.previous.wpm === 60, 'a slower one is not');
    r = T.record(s, cfg, res(70), 3);
    check(r.pb && r.previous.wpm === 60 && s.pb[T.configKey(cfg)].wpm === 70, 'a faster one is, and says what it beat');
    r = T.record(s, {mode: 'time', amount: 30, punctuation: true}, res(40), 4);
    check(r.pb, 'punctuation keeps its own best');
    r = T.record(s, cfg, {...res(200), valid: false}, 5);
    check(!r.pb && !r.counted && s.pb[T.configKey(cfg)].wpm === 70, 'a test that does not count cannot set a best');
    check(Math.round(T.average(s, T.configKey(cfg)).wpm) === 62, 'average of the recent tests of one kind', T.average(s, T.configKey(cfg)).wpm);
    const again = T.loadStore(JSON.stringify(s));
    check(JSON.stringify(again.pb) === JSON.stringify(s.pb) && again.history.length === s.history.length, 'a save round trips');
    for (let i = 0; i < 300; i++) T.record(s, cfg, res(10), 10 + i);
    check(s.history.length === 200, 'history keeps the last 200 tests', s.history.length);

    const missed = ['about', 'world', 'the', 'people', 'x'];
    const p = Array.from(T.practice(missed, 'seed'));
    check(p.length === 15 && missed.every(w => p.filter(x => x === w).length === 3), 'practice: each missed word three times');
    check(p.every((w, i) => i === 0 || w !== p[i - 1]), 'practice: never the same word twice in a row', p.join(' '));
    for (const few of [['the'], ['world', 'people']]) {
        const q = Array.from(T.practice(few, 'seed'));
        check(q.length >= 15 && few.every(w => q.filter(x => x === w).length === 3) && q.every((w, i) => i === 0 || w !== q[i - 1]),
            `practice: ${few.length} missed word(s) are padded to 15 with common words, none twice in a row`, q.join(' '));
    }
    const t = T.create({mode: 'time', amount: 60}, {words: p});
    check(t.mode === 'words' && t.amount === 15 && !T.result(t).valid, 'practice: a words test that never counts toward a best');
}

// ---------------------------------------------------------------- page
if (suites.includes('page')) {
    section('page');
    let chromium = null;
    try { ({chromium} = await import('playwright')); } catch (e) {
        try { chromium = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright').chromium; } catch (e2) { }
    }
    if (!chromium) console.log('  skipped: Playwright is not installed');
    else {
        const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
        const url = pathToFileURL(PAGE).href;
        const errors = [];
        const words = p => p.evaluate(() => [...document.querySelectorAll('.word')].map(w => w.textContent));
        const shown = p => p.evaluate(() => document.getElementById('result').classList.contains('show'));
        {
            const ctx = await browser.newContext({viewport: {width: 1280, height: 800}});
            await ctx.route(/^https?:/, r => r.abort());
            const p = await ctx.newPage();
            p.on('pageerror', e => errors.push(e.message));
            await p.goto(url);
            await p.click('[data-mode="words"]'); await p.click('[data-amount="10"]');
            const w = await words(p);
            check(w.length === 10, 'desktop: words 10 shows ten words', w.length);
            await p.keyboard.press('Shift'); await p.keyboard.press('Control'); await p.keyboard.press('Backspace'); await p.keyboard.press('Enter');
            check(!(await p.evaluate(() => document.body.classList.contains('typing'))), 'desktop: Shift, Ctrl, Backspace and Enter do not start the test');
            await p.keyboard.type(w.join(' '), {delay: 15});
            await p.waitForTimeout(100);
            check(await shown(p), 'desktop: typing all ten words shows the result');
            check(await p.evaluate(() => document.getElementById('rAcc').textContent) === '100%', 'desktop: with 100% accuracy');
            await p.keyboard.type('xx ');
            check(await shown(p), 'desktop: keys typed just after the end do not start another test');
            await p.waitForTimeout(400);
            await p.keyboard.press('Tab');
            check(!(await shown(p)) && (await words(p)).join() !== w.join(), 'desktop: Tab starts a new test with new words');
            await p.keyboard.type(w[0].slice(0, 2));
            await p.keyboard.press('Escape');
            check(await p.evaluate(() => document.querySelectorAll('.word span.c').length) === 0, 'desktop: Escape restarts mid test');
            const cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('monkeytype-clone')));
            check(cfg && cfg.config.mode === 'words' && cfg.config.amount === 10 && Object.keys(cfg.pb).length === 1, 'desktop: the config and the best are saved');
            // the caret stays inside the three visible lines through a long test
            await p.click('[data-mode="time"]'); await p.click('[data-amount="60"]');
            let outside = 0;
            for (let i = 0; i < 80; i++) {
                const cur = await p.evaluate(k => document.querySelectorAll('.word')[k].textContent, i);
                await p.keyboard.type(cur + ' ');
                await p.waitForTimeout(140);   // the lines scroll in 120 ms
                outside += await p.evaluate(() => {
                    const c = document.getElementById('caret').getBoundingClientRect(), wr = document.getElementById('wordsWrap').getBoundingClientRect();
                    return c.top >= wr.top - 1 && c.bottom <= wr.bottom + 1 ? 0 : 1;
                });
            }
            check(outside === 0, 'desktop: the caret never leaves the three visible lines in 80 words', outside);
            await ctx.close();
        }
        {
            const ctx = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
            await ctx.route(/^https?:/, r => r.abort());
            const p = await ctx.newPage();
            p.on('pageerror', e => errors.push(e.message));
            await p.goto(url);
            check(await p.evaluate(() => document.getElementById('test').classList.contains('blurred')), 'phone: before a tap the words ask to be tapped');
            await p.tap('#wordsWrap');
            check(await p.evaluate(() => document.activeElement.id) === 'wordsInput', 'phone: a tap on the words focuses the text field');
            const w = await words(p);
            // a phone keyboard: whole-value edits, autocorrect, and a backspace on the empty field
            await p.keyboard.insertText(w[0].slice(0, 2));
            await p.keyboard.insertText(w[0].slice(2) + ' ');
            await p.keyboard.insertText('zz');
            await p.evaluate(v => { const i = document.getElementById('wordsInput'); i.value = v; i.dispatchEvent(new Event('input')); }, ' ' + w[1] + ' ');
            check(await p.evaluate(() => document.querySelectorAll('.word.err').length) === 0, 'phone: a word autocorrected into the right one is right');
            await p.evaluate(() => { const i = document.getElementById('wordsInput'); i.value = ''; i.dispatchEvent(new Event('input')); });
            check(await p.evaluate(() => document.getElementById('wordsInput').value) === ' ', 'phone: a backspace on an empty field gets its space back');
            const scroll = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
            check(scroll, 'phone: nothing is wider than the screen');
            await ctx.close();
        }
        check(errors.length === 0, 'no page errors', errors.join(' | '));
        await browser.close();
    }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
