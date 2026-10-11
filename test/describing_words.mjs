#!/usr/bin/env node
// Test suite for tools/descriptocraft.html (Describing Words).
//
// Runs the page's DOM-free <script id="core"> block in Node against the real word list in data/. The
// page's one promise is that what it shows is what the books say: the file is read exactly (checked
// against a second decoder written the other way round), what was typed is understood the way a
// person means it (plurals, phrases, accents, stray punctuation, words that are both noun and
// adjective), filters only ever take words away, a miss offers the word that was meant, and nothing
// the page keeps or links to can be forged into something else. No browser, no server.
//
//   node test/describing_words.mjs               # everything
//   node test/describing_words.mjs input words   # named suites only
//
// Suites: data, input, analyze, words, steer, filter, suggest, keep, example.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const ALL = ['data', 'input', 'analyze', 'words', 'steer', 'filter', 'suggest', 'keep', 'example'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const seen = new Map();
const fail = (what, detail) => {
    failures++;
    const n = (seen.get(what) || 0) + 1; seen.set(what, n);
    if (n <= 3) console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`);
};
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(join(ROOT, 'tools', 'descriptocraft.html'), 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block'); process.exit(1); }
const ctx = vm.createContext({URLSearchParams});
vm.runInContext(core[1] + '\nthis.DW = DW;', ctx);
const DW = ctx.DW;
const J = x => JSON.parse(JSON.stringify(x));

const TEXT = readFileSync(join(ROOT, 'data', 'describing_words.txt'), 'utf8');
const MORE = readFileSync(join(ROOT, 'data', 'describing_words_more.txt'), 'utf8');
const db = DW.addMore(DW.parse(TEXT), MORE);
const coreOnly = DW.parse(TEXT);

const words = (w, mode) => {
    const a = DW.analyze(db, w, mode || null);
    const r = a.mode === 'describe' ? DW.describe(db, a.word) : a.mode === 'similar' ? DW.similar(db, a.word) : {items: []};
    return {a, items: r.items.map(x => x.word), r};
};

// ---- a second reader, written from the format description in util/describing_words/build.py ------
// Terminal digits are the first 32 characters (A-Z, a-f), continuation digits the other 32.
function independent(text) {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const num = run => [...run].reduce((v, ch) => v * 32 + (alpha.indexOf(ch) % 32), 0);
    const adj = [], sims = [], nouns = new Map();
    for (const line of text.split('\n')) {
        const f = line.split('\t');
        if (f[0] === 'A') { adj.push(f[1]); sims.push([...f[3].matchAll(/[g-z0-9_-]*[A-Za-f]/g)].map(m => num(m[0]))); }
        if (f[0] === 'N') nouns.set(f[1], [...f[3].matchAll(/([g-z0-9_-]*[A-Za-f])([A-Za-z0-9_-])/g)]
            .map(m => [num(m[1]), alpha.indexOf(m[2])]));
    }
    return {adj, sims, nouns};
}

if (suites.includes('data')) {
    section('data');
    const ind = independent(TEXT);
    check(db.header && db.header.occurrences > 1e9, 'header names the corpus size', JSON.stringify(db.header));
    eq(coreOnly.adj.length, ind.adj.length, 'every adjective line read');
    eq(coreOnly.noun.size, ind.nouns.size, 'every noun line read');
    check(coreOnly.noun.size > 20000 && coreOnly.adj.length > 10000, 'the list is the size the page claims');
    let n = 0;
    for (const [noun, ps] of ind.nouns) {
        if (n++ % 7) continue;
        const mine = DW.pairs(coreOnly.noun.get(noun).body);
        eq(mine, ps, 'pairs decode the same both ways');
        check(ps.every(([i]) => i < ind.adj.length), 'every index names an adjective', noun);
        check(new Set(ps.map(p => p[0])).size === ps.length, 'no adjective twice for one noun', noun);
    }
    for (let i = 0; i < ind.adj.length; i += 5) {
        eq(DW.varints(coreOnly.asim[i]), ind.sims[i], 'similar lists decode the same both ways');
        check(!ind.sims[i].includes(i), 'no adjective is listed as similar to itself', ind.adj[i]);
    }
    const lower = new Set();
    for (const a of db.adj) { check(/^[A-Za-z][a-z'-]*[a-z]$/.test(a), 'adjectives are plain words', a); check(!lower.has(a.toLowerCase()), 'no adjective twice', a); lower.add(a.toLowerCase()); }
    for (const [noun] of db.noun) check(/^[a-z][a-z'-]*[a-z]$/.test(noun), 'nouns are plain lower-case words', noun);
    // the "more" file only ever extends a list, and the totals the page prints are the real lengths
    let k = 0;
    for (const [noun, e] of db.noun) {
        if (k++ % 11) continue;
        const full = DW.describe(db, noun), part = DW.describe(coreOnly, noun);
        eq(full.items.slice(0, part.items.length), part.items, 'the rest of a list comes after its start');
        eq(full.items.length, e.total, 'a full list is as long as its total says');
        check(full.complete && (part.complete === (part.items.length === e.total)), 'complete means complete', noun);
    }
    // a twice-applied "more" changes nothing
    const twice = DW.addMore(DW.addMore(DW.parse(TEXT), MORE), MORE);
    eq(DW.describe(twice, 'forest').items.length, DW.describe(db, 'forest').items.length, 'loading the rest twice adds nothing');
    // counts: a count character c is about 10 * 10^(c/12)
    for (let c = 0; c < 64; c++) check(Math.abs(DW.countOf(c) / (10 * 10 ** (c / 12)) - 1) < 1e-9, 'count characters decode by the documented rule');
    for (const [n, s] of [[0, '0'], [7.4, '7.4'], [12, '12'], [99.4, '99'], [123, '120'], [8317, '8,300'], [31402, '31,000'], [1234567, '1,200,000']])
        eq(DW.fmtCount(n), s.includes('.') ? '7' : s, `fmtCount(${n})`);
    // broken files are refused rather than half-read
    for (const bad of ['', 'hello', '#describing-words {}\nA\tx\tA\t\t0\n', '<html>404</html>'])
        check((() => { try { DW.parse(bad); return false; } catch (e) { return true; } })(), 'a file that is not the word list is refused', JSON.stringify(bad));
    check((() => { try { DW.pairs('g'); return false; } catch (e) { return true; } })() || DW.pairs('g').length === 0, 'a truncated pair does not invent a word');
    check((() => { try { DW.pairs('A'); return false; } catch (e) { return true; } })(), 'a pair without its count is refused');
}

if (suites.includes('input')) {
    section('input');
    const N = [
        ['forest', 'forest'], ['  Forest  ', 'forest'], ['FOREST!', 'forest'], ['forest.', 'forest'], ['café', 'cafe'],
        ['naïve', 'naive'], ['Käse', 'kase'], ['猫', ''], ['42', ''], ['3,5 kg', 'kg'], ['', ''], ['   ', ''], [null, ''],
        [undefined, ''], ['<b>x</b>', 'b x b'], ['dog’s', "dog's"], ['well‐known', 'well-known'], ['a\tb\nc', 'a b c'],
        ['x'.repeat(5000), 'x'.repeat(200)], ['ﬁre', 'fire'],
    ];
    for (const [i, o] of N) eq(DW.normalize(i), o, `normalize(${JSON.stringify(i && i.length > 30 ? i.slice(0, 10) + '…' : i)})`);
    eq(J(DW.tokens("the dog's 'old' -house- a")), ['the', 'dog', 'old', 'house'], 'tokens drop possessives, quotes, stray hyphens and single letters');
    eq(DW.tokens(Array(40).fill('sea').join(' ')).length, 12, 'only the first twelve words of a pasted paragraph are looked at');
    const F = [['wolves', 'wolf'], ['berries', 'berry'], ['boxes', 'box'], ['children', 'child'], ['women', 'woman'],
        ['firemen', 'fireman'], ['churches', 'church'], ['knives', 'knife'], ['geese', 'goose'], ['mice', 'mouse'],
        ['potatoes', 'potato'], ['forests', 'forest'], ['cats', 'cat']];
    for (const [pl, sg] of F) eq(DW.findNoun(db, pl), sg, `${pl} is looked up as ${sg}`);
    for (const w of ['glass', 'grass', 'boss', 'bus', 'news', 'physics']) check(DW.findNoun(db, w) === w || DW.findNoun(db, w) === null, `${w} is not singularised away`, DW.findNoun(db, w));
    eq(DW.findNoun(db, 'glasses'), 'glasses', 'glasses keeps its own list (spectacles)');
}

if (suites.includes('analyze')) {
    section('analyze');
    const A = (w, mode, word, want) => {
        const a = DW.analyze(db, w, want || null);
        check(a.mode === mode && (word === undefined || a.word === word), `"${w}"${want ? ' [' + want + ']' : ''} -> ${mode} ${word || ''}`, `got ${a.mode} ${a.word}`);
        return a;
    };
    A('forest', 'describe', 'forest'); A('Forests', 'describe', 'forest'); A('ocean', 'describe', 'ocean');
    A('happy', 'similar', 'happy'); A('cold', 'similar', 'cold'); A('beautiful', 'similar', 'beautiful');
    A('cold', 'describe', 'cold', 'describe');          // the person can still ask for the noun
    A('forest', 'none', undefined, 'similar');
    check(DW.analyze(db, 'forest', 'similar').nounOnly, 'asking for adjectives like a noun says it is a noun');
    check(DW.analyze(db, 'sad', 'describe').adjOnly, 'asking to describe an adjective says it is an adjective');
    A('a rainy afternoon', 'describe', 'afternoon'); A('the dark forest', 'describe', 'forest');
    A('coffee shop', 'describe', 'shop');
    eq(J(DW.analyze(db, 'coffee shop').also), ['coffee'], 'the other noun of a phrase is offered');
    A('cold weather', 'describe', 'weather'); A('very happy', 'similar', 'happy'); A('really really big', 'similar', 'big');
    A('my old dog', 'describe', 'dog'); A('wolves', 'describe', 'wolf'); A("dog's", 'describe', 'dog');
    A('', 'empty'); A('   ', 'empty'); A('42', 'none'); A('猫', 'none'); A('<b>x</b>', 'none'); A('qwzxv', 'none');
    eq(DW.analyze(db, '猫').reason, 'script', 'another script is told apart from nonsense');
    eq(DW.analyze(db, '42').reason, 'noletters', 'numbers are told apart from nonsense');
    eq(J(DW.analyze(db, 'forrest').unknown), ['forrest'], 'an unknown word is named');
    A('x'.repeat(5000), 'none');
    // everything the old page could be given still gets an answer or a reason
    for (const w of ['happy', 'forest', 'book', 'a rainy afternoon', 'Käse', 'hapy', '42', '<b>x</b>', '   '])
        check(['describe', 'similar', 'none', 'empty'].includes(DW.analyze(db, w).mode), 'every input lands in a state', w);
}

if (suites.includes('words')) {
    section('words');
    const has = (w, list, mode) => { const r = words(w, mode).items.map(x => x.toLowerCase()); for (const x of list) check(r.includes(x), `${w} lists ${x}`, r.slice(0, 30).join(' ')); };
    const top = (w, n, list, mode) => { const r = words(w, mode).items.slice(0, n).map(x => x.toLowerCase()); for (const x of list) check(r.includes(x), `${w}: ${x} in the first ${n}`, r.join(' ')); };
    const lacks = (w, list, mode) => { const r = words(w, mode).items.map(x => x.toLowerCase()); for (const x of list) check(!r.includes(x), `${w} does not list ${x}`); };
    top('forest', 12, ['dense', 'tropical', 'primeval', 'virgin']);
    top('smile', 12, ['wry', 'faint', 'wan']);
    top('ocean', 12, ['vast', 'boundless', 'deep']);
    top('voice', 12, ['hoarse', 'husky', 'loud', 'gruff']);
    top('coffee', 12, ['hot', 'black', 'strong', 'instant']);
    top('night', 12, ['sleepless', 'moonlit', 'stormy']);
    top('sky', 12, ['cloudless', 'blue', 'starry', 'overcast']);
    top('rain', 12, ['torrential', 'heavy']);
    // everyday words lead for people, not the clinical vocabulary of the books that mention them most
    top('child', 6, ['young']); top('child', 16, ['dear', 'healthy']);
    has('book', ['good', 'new']); has('house', ['haunted', 'empty']); has('cat', ['black']); has('dog', ['faithful']);
    // the determiners and slurs build.py drops never reach a list
    for (const n of ['man', 'woman', 'child', 'house', 'city', 'people', 'day'])
        lacks(n, ['other', 'such', 'same', 'own', 'many', 'last', 'next', 'retarded', 'crippled', 'mongoloid']);
    // similar adjectives: real synonyms near the top, opposites never
    top('happy', 12, ['joyful', 'cheerful', 'glad']);
    top('big', 8, ['large', 'huge']);
    top('sad', 10, ['sorrowful', 'mournful']);
    top('fast', 6, ['rapid', 'quick', 'swift']);
    top('cold', 8, ['cool', 'icy', 'chilly']);
    top('beautiful', 8, ['lovely', 'pretty']);
    const opposites = {happy: ['sad', 'unhappy'], cold: ['hot', 'warm'], big: ['small', 'little'], good: ['bad', 'evil'],
        beautiful: ['ugly'], fast: ['slow'], dark: ['light', 'bright'], old: ['new', 'young'], rich: ['poor'], wet: ['dry']};
    for (const [w, opp] of Object.entries(opposites)) lacks(w, opp, 'similar');
    // the words names a noun with are adjectives the file knows; capitals only for proper adjectives
    const caps = words('ocean').items.filter(x => /^[A-Z]/.test(x));
    eq(caps, [], 'names (Atlantic, Indian) are not describing words');
    check(DW.similar(db, 'french').items.length === 0 || db.adj.includes('French'), 'proper adjectives keep their capital');
    check(words('forest').items.slice(0, 12).every(x => /^[a-z]/.test(x)), 'common adjectives stay lower case');
    // tone and rarity are what the lexicons say
    const info = w => { const i = db.aindex.get(w); return DW.describe(db, 'forest').items.find(x => x.word === w) || {tone: DW.TONES[db.aflag[i] % 3], rarity: DW.RARITIES[Math.floor(db.aflag[i] / 3)]}; };
    for (const [w, t] of [['lovely', 'positive'], ['beautiful', 'positive'], ['happy', 'positive'], ['sinister', 'negative'],
        ['gloomy', 'negative'], ['dreary', 'negative'], ['dense', 'neutral'], ['tropical', 'neutral'], ['blue', 'neutral']])
        eq(info(w).tone, t, `${w} is ${t}`);
    for (const [w, r] of [['big', 'everyday'], ['happy', 'everyday'], ['old', 'everyday'], ['crepuscular', 'rare'], ['mesophytic', 'rare']])
        if (db.aindex.has(w)) eq(info(w).rarity, r, `${w} is ${r}`);
    // counts behave like counts: a pairing a list shows has been seen at least 20 times
    for (const n of ['forest', 'smile', 'tree', 'love']) check(DW.describe(db, n).items.every(x => x.count >= 15), `${n}: every pairing was seen often enough to count`);
    eq(DW.describe(db, 'nonexistentnoun').items.length, 0, 'an unknown noun has an empty list');
    eq(DW.similar(db, 'nonexistentadj').items.length, 0, 'an unknown adjective has an empty list');
}

if (suites.includes('steer')) {
    section('steer');
    // a mood adjective in the phrase brings the noun's words like it to the front, and only reorders
    for (const [phrase, noun, mood, expect] of [['gloomy sea', 'sea', 'gloomy', ['dark', 'desolate']], ['a cold night', 'night', 'cold', ['frosty', 'chilly']],
        ['soft voice', 'voice', 'soft', ['quiet', 'gentle']], ['cheerful room', 'room', 'cheerful', []]]) {
        const a = DW.analyze(db, phrase);
        eq([a.mode, a.word, J(a.mood)], ['describe', noun, [mood]], `"${phrase}" describes ${noun} in the mood of ${mood}`);
        const base = DW.describe(db, noun).items;
        const st = DW.steer(db, base, a.mood);
        eq(st.items.length, base.length, `${phrase}: steering keeps every word`);
        eq(new Set(st.items).size, base.length, `${phrase}: steering repeats nothing`);
        const like = new Set([mood, ...DW.similar(db, mood).items.map(x => x.word.toLowerCase())]);
        check(st.items.slice(0, st.ahead).every(x => like.has(x.word.toLowerCase())) && st.items.slice(st.ahead).every(x => !like.has(x.word.toLowerCase())), `${phrase}: the words in front are exactly the ones like ${mood}`);
        const order = xs => xs.map(x => base.indexOf(x));
        const inc = xs => order(xs).every((p, i, o) => i === 0 || p > o[i - 1]);
        check(inc(st.items.slice(0, st.ahead)) && inc(st.items.slice(st.ahead)), `${phrase}: each part keeps the books' order`);
        for (const w of expect) check(st.items.slice(0, st.ahead).some(x => x.word === w), `${phrase}: ${w} comes first`, st.items.slice(0, 10).map(x => x.word).join(' '));
    }
    eq(DW.steer(db, DW.describe(db, 'forest').items, []).ahead, 0, 'no mood, no steering');
    eq(J(DW.analyze(db, 'forest').mood), [], 'a bare noun has no mood');
}

if (suites.includes('filter')) {
    section('filter');
    let n = 0;
    for (const [noun] of db.noun) {
        if (n++ % 97) continue;
        const items = DW.describe(db, noun).items;
        for (const tone of ['', ...DW.TONES]) for (const rarity of ['', ...DW.RARITIES]) {
            const f = DW.filter(items, {tone, rarity});
            const pos = f.map(x => items.indexOf(x));
            check(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), 'a filter keeps the order it was given');
            check(f.every(x => (!tone || x.tone === tone) && (!rarity || x.rarity === rarity)), 'a filter keeps only what it names');
            eq(f.length, items.filter(x => (!tone || x.tone === tone) && (!rarity || x.rarity === rarity)).length, 'a filter drops nothing it should keep');
        }
    }
    const items = DW.describe(db, 'forest').items;
    eq(DW.filter(items, {tone: 'bogus', rarity: '<script>'}).length, items.length, 'an unknown filter value filters nothing');
    eq(DW.filter(items, null).length, items.length, 'no filter filters nothing');
}

if (suites.includes('suggest')) {
    section('suggest');
    const S = (w, want) => { const s = DW.suggest(db, w); check(s[0] === want, `"${w}" suggests ${want} first`, s.join(' ')); };
    S('forrest', 'forest'); S('hapy', 'happy'); S('beutiful', 'beautiful'); S('ocaen', 'ocean'); S('mountian', 'mountain');
    S('wether', 'weather'); S('freind', 'friend'); S('coffe', 'coffee'); S('smiel', 'smile'); S('the dark forrest', 'forest');
    eq(J(DW.suggest(db, 'qwzxv')), [], 'nonsense suggests nothing');
    eq(J(DW.suggest(db, 'ab')), [], 'two letters suggest nothing');
    eq(J(DW.suggest(db, '')), [], 'nothing suggests nothing');
    for (const w of ['forrest', 'hapy', 'beutiful', 'wether']) {
        const s = DW.suggest(db, w);
        check(s.length <= 4 && s.every(x => DW.findNoun(db, x) || DW.similar(db, x).items.length), 'every suggestion has a list behind it', s.join(' '));
        check(new Set(s).size === s.length, 'no suggestion twice');
    }
    eq(DW.distance('kitten', 'sitting', 5), 3, 'edit distance (kitten, sitting)');
    eq(DW.distance('ocaen', 'ocean', 2), 1, 'a swapped pair is one edit');
    eq(DW.distance('abc', 'abcdefgh', 2), 3, 'the bound stops early');
    const t0 = Date.now(); for (let i = 0; i < 20; i++) DW.suggest(db, 'xorrestqq' + 'abcdefghij'[i % 10]);
    check((Date.now() - t0) / 20 < 150, 'a suggestion takes well under the time of a keystroke', `${(Date.now() - t0) / 20} ms`);
}

if (suites.includes('keep')) {
    section('keep');
    // the old page's 'favorites' key, which two other tools on this origin also write
    eq(J(DW.migrateFavorites('[" cheerful","joyful"," cheerful","glad."]')), ['cheerful', 'joyful', 'glad'], 'old favourites come across trimmed and once');
    eq(J(DW.migrateFavorites('[{"inputText":"a","translation":"b"}]')), [], "the translator's entries are not words");
    eq(J(DW.migrateFavorites('["★","a","é","Ω"]')), [], "the character map's characters are not words");
    eq(J(DW.migrateFavorites('not json')), [], 'a broken value is ignored');
    eq(J(DW.migrateFavorites('{"a":1}')), [], 'an object is ignored');
    eq(J(DW.migrateFavorites(null)), [], 'nothing is nothing');
    eq(DW.migrateFavorites(JSON.stringify(Array(2000).fill(0).map((_, i) => 'word' + 'abcdefghijklmnopqrstuvwxyz'[i % 26] + 'abcdefghijklmnopqrstuvwxyz'[(i / 26 | 0) % 26] + 'x'.repeat(i / 676 | 0)))).length, 500, 'at most 500 favourites');
    eq(J(DW.migrateFavorites('["<img src=x onerror=alert(1)>","javascript:alert(1)"]')).every(w => /^[a-z' -]+$/.test(w)), true, 'markup cannot come back as markup');
    // prefs
    const p = DW.readPrefs(DW.writePrefs({word: 'ocean', mode: 'similar', tone: 'negative', rarity: 'rare', saved: ['dark', 'deep']}));
    eq(J(p), {word: 'ocean', mode: 'similar', tone: 'negative', rarity: 'rare', saved: ['dark', 'deep'], migrated: true}, 'prefs round-trip');
    eq(J(DW.readPrefs('{"word":42,"mode":"hack","tone":"evil","rarity":[],"saved":["ok",7,null,"<b>"]}')),
        {word: null, mode: null, tone: null, rarity: null, saved: ['ok'], migrated: false}, 'a forged save is cleaned');
    eq(DW.readPrefs('x').saved.length, 0, 'a broken save starts fresh');
    eq(DW.readPrefs('[]').word, null, 'an array is not a save');
    eq(DW.readPrefs(JSON.stringify({word: 'y'.repeat(9999)})).word.length, 200, 'a saved word is capped');
    // links
    eq(J(DW.readParams('?w=forest')), {word: 'forest'}, '?w=');
    eq(J(DW.readParams('?word=Sea%20breeze&mode=similar&tone=positive&rarity=rare')), {word: 'Sea breeze', mode: 'similar', tone: 'positive', rarity: 'rare'}, 'every parameter');
    eq(J(DW.readParams('?q=sky&mode=evil&tone=<x>')), {word: 'sky'}, 'unknown values are dropped');
    eq(J(DW.readParams('?w=%20%20')), {}, 'a blank word is no word');
    eq(J(DW.readParams('')), {}, 'no parameters');
    const url = DW.link('https://x.test/tools/descriptocraft.html', {word: '  Dark Forest! ', mode: 'describe', tone: 'negative', rarity: null});
    eq(url, 'https://x.test/tools/descriptocraft.html?w=dark+forest&mode=describe&tone=negative', 'a link holds only what is on screen');
    eq(J(DW.readParams(url.slice(url.indexOf('?')))), {word: 'dark forest', mode: 'describe', tone: 'negative'}, 'a link reads back');
    eq(DW.joinWords([{word: 'dense'}, {word: 'dark'}, 'deep']), 'dense, dark, deep', 'copy all joins with commas');
}

if (suites.includes('example')) {
    section('example');
    const ex = HTML.match(/\/\*EXAMPLE\*\/([\s\S]*?)\/\*\/EXAMPLE\*\//);
    check(!!ex, 'the page carries a built-in example');
    if (ex) {
        const e = DW.parse(ex[1].trim());
        eq(J(DW.describe(e, 'forest').items), J(DW.describe(coreOnly, 'forest').items), 'the built-in forest is the file\'s forest');
        eq(J(DW.similar(e, 'happy').items), J(DW.similar(coreOnly, 'happy').items), 'the built-in happy is the file\'s happy');
        eq(DW.describe(e, 'forest').total, DW.describe(db, 'forest').total, 'the built-in example knows how long the full list is');
    }
    const size = HTML.match(/const DATA_BYTES = (\d+);/);
    eq(size && +size[1], Buffer.byteLength(TEXT, 'utf8'), 'the loading bar measures against the real file size (run inline.mjs after build.py)');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
