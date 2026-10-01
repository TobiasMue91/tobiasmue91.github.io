#!/usr/bin/env node
// Test suite for games/mystery_ai.html (Under the Lamp).
//
// Runs the page's DOM-free <script id="core"> block in Node. A detective game makes one promise
// nobody can check from the page: every case is fair. The murderer and the one other liar must share
// the trait left at the scene, each lie must break on the cards that contradict it and on nothing else,
// every card that breaks a lie must be reachable, and a player who has seen everything must be able to
// name the murderer, the weapon and the motive with nothing left ambiguous. A change to one room, one
// role or one line of the generator can quietly break that for a few seeds out of thousands, so this
// suite builds thousands. No browser, no server.
//
//   node test/mystery_ai.mjs                 # everything
//   node test/mystery_ai.mjs fair play       # named suites only
//   node test/mystery_ai.mjs --cases=5000    # more cases (default 1500)
//   node test/mystery_ai.mjs --page=path.html
//
// Suites: build, fair, play, text.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'mystery_ai.html'));
const CASES = +opt('cases', 1500);
const ALL = ['build', 'fair', 'play', 'text'];
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
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.Lamp = Lamp;', ctx);
const Lamp = ctx.Lamp;
const seeds = Array.from({length: Math.min(CASES, 9000)}, (_, i) => 1000 + (i * 37) % 9000);
const TOPICS = ['where', 'victim', 'saw'];

if (suites.includes('build')) {
    section('build');
    for (const s of seeds.slice(0, 300)) {
        const a = JSON.stringify(Lamp.makeCase(s)), b = JSON.stringify(Lamp.makeCase(s));
        check(a === b, 'a seed always builds the same case', `seed ${s}`);
    }
    for (const s of seeds) {
        const c = Lamp.makeCase(s);
        check(c.people.length === 4, 'four people in the house', `seed ${s}`);
        check(new Set(c.people.map(p => p.first)).size === 4 && !c.people.some(p => c.V.name.includes(' ' + p.first + ' ')), 'nobody shares a first name, with each other or the victim', `seed ${s}`);
        check(new Set(c.people.map(p => p.motive)).size === 4, 'four different motives', `seed ${s}: ${c.people.map(p => p.motive)}`);
        check(c.people.filter(p => /^the (husband|wife)$/.test(p.role)).length <= 1, 'at most one spouse', `seed ${s}`);
        check(new Set(c.rooms.map(r => r.id)).size === 6, 'six different rooms', `seed ${s}: ${c.rooms.map(r => r.id)}`);
        check(c.T >= 9 * 60 + 20 && c.T <= 10 * 60 + 55, 'the clock stops between 9:20 and 10:55', `seed ${s}`);
        check(new Set(c.people.map(p => Lamp.hello(c, p.id))).size === 4, 'nobody opens with the same line as anyone else', `seed ${s}`);
        const looks = c.people.map(p => p.look);
        check(new Set(looks.map(l => l.hair)).size === 4 && new Set(looks.map(l => l.coat)).size === 4, 'no two people share a hair colour or a coat', `seed ${s}`);
        const all = c.rooms.flatMap(r => r.items);
        check(new Set(all).size === all.length, 'no card lies in two rooms', `seed ${s}`);
        for (const e of Object.values(c.ev)) if (e.kind !== 'testimony' && e.id !== 'coroner') check(all.includes(e.id), 'every object is in some room', `seed ${s}: ${e.id}`);
    }
    const days = Array.from({length: 400}, (_, d) => Lamp.dailySeed(d));
    check(days.every(n => n >= 1000 && n <= 9999), 'daily case numbers are four digits');
    check(days.every((n, i) => i === 0 || n !== days[i - 1]), 'no two days in a row share a case');
    check(new Set(days).size === days.length, 'a year of daily cases never repeats');
}

if (suites.includes('fair')) {
    section('fair');
    for (const s of seeds) {
        const c = Lamp.makeCase(s), {A, B, L, C} = c;
        const k = c.traitKey;
        check(C.look[k] && L.look[k] && !A.look[k] && !B.look[k], 'the trait at the scene belongs to the two liars and nobody else', `seed ${s}`);
        check(c.claims[A.id] === c.truth[A.id] && c.claims[B.id] === c.truth[B.id] && c.claims[A.id] === c.claims[B.id], 'the honest two claim the same room, and it is true', `seed ${s}`);
        check(c.claims[L.id] !== c.truth[L.id] && c.claims[C.id] !== c.truth[C.id], 'both liars claim a room they were not in', `seed ${s}`);
        check(c.truth[C.id] === c.R.id && Object.values(c.truth).filter(r => r === c.R.id).length === 1, 'only the murderer was at the scene', `seed ${s}`);
        check(c.claims[L.id] !== c.claims[C.id] && c.claims[L.id] !== c.R.id && c.claims[C.id] !== c.R.id, 'the liars claim different rooms, and neither claims the scene', `seed ${s}`);
        check(c.solution.who === C.id && c.ev[c.solution.weapon].right && c.solution.motive === C.motive, 'the solution is the murderer, the right weapon and their motive', `seed ${s}`);
        check(['w0', 'w1', 'w2'].filter(w => c.ev[w].right).length === 1, 'exactly one weapon fits the coroner', `seed ${s}`);
        // Every card, to every person, from a fresh state: only the cards that contradict a claim break it.
        for (const p of c.people) for (const id of Object.keys(c.ev)) {
            const st = Lamp.newState(c);
            const r = Lamp.present(c, st, p.id, id);
            const should = (p === L && (id === 'passby' || id === 'hide')) || (p === C && (id === 'xroom' || id === 'heard'));
            check(r.crack === should, 'a lie breaks on exactly the cards that contradict it', `seed ${s}: ${p.part} + ${id} -> ${r.crack}`);
            check(typeof r.text === 'string' && r.text.length > 8, 'every card gets an answer from everyone', `seed ${s}: ${p.part} + ${id}`);
        }
        // A lie breaks once.
        const st = Lamp.newState(c);
        Lamp.present(c, st, L.id, 'passby');
        check(!Lamp.present(c, st, L.id, 'hide').crack, 'a broken lie does not break twice', `seed ${s}`);
    }
}

// A player who reads nothing but what the page shows: asks everything, searches everything, presents
// everything, then reasons only from the cards in hand.
function playThrough(c) {
    const st = Lamp.newState(c);
    const order = [...c.people].reverse();
    for (const p of order) for (const t of TOPICS) Lamp.ask(c, st, p.id, t);
    for (const r of c.rooms) for (const id of Lamp.left(c, st, r.id)) Lamp.take(c, st, id);
    let progress = true;
    while (progress) {
        progress = false;
        for (const p of c.people) for (const id of [...st.found]) {
            if (Lamp.present(c, st, p.id, id).crack) progress = true;
        }
        for (const p of c.people) for (const t of TOPICS) Lamp.ask(c, st, p.id, t);
    }
    return st;
}

if (suites.includes('play')) {
    section('play');
    for (const s of seeds) {
        const c = Lamp.makeCase(s), st = playThrough(c), {L, C} = c;
        check(st.cracked[L.id] && st.cracked[C.id], 'a thorough player breaks both lies', `seed ${s}`);
        check(!c.people.some(p => p.part === 'honest' && st.cracked[p.id]), 'nobody honest is ever broken', `seed ${s}`);
        check(Object.keys(c.ev).every(id => st.found.includes(id)), 'every card can be found', `seed ${s}: missing ${Object.keys(c.ev).filter(id => !st.found.includes(id))}`);
        // Reason from what is on the table: who carries the trait and has no alibi left.
        const alibied = new Set(c.people.filter(p => p.part === 'honest' || (st.cracked[p.id] && p === L)).map(p => p.id));
        const left = c.people.filter(p => p.look[c.traitKey] && !alibied.has(p.id));
        check(left.length === 1 && left[0] === C, 'the cards leave exactly one suspect', `seed ${s}: ${left.map(p => p.part)}`);
        // The accusation offers the answer, and only the answer is accepted.
        const o = Lamp.options(c, st);
        check(o.weapon.length === 3 && o.motive.length === 4, 'every weapon and every motive is on offer once found', `seed ${s}: ${o.weapon.length}/${o.motive.length}`);
        check(o.motive.some(m => m.id === C.motive), 'the murderer\'s motive can be chosen', `seed ${s}`);
        let rights = 0;
        for (const w of o.who) for (const x of o.weapon) for (const m of o.motive) {
            const t = {...st, wrong: 0, solved: false};
            if (Lamp.accuse(c, t, {who: w.id, weapon: x.id, motive: m.id}).ok) rights++;
        }
        check(rights === 1, 'exactly one accusation is right', `seed ${s}: ${rights}`);
        // Without the papers, the murderer's motive is not on the list.
        const st2 = Lamp.newState(c);
        for (const p of c.people) for (const t of TOPICS) Lamp.ask(c, st2, p.id, t);
        check(!Lamp.options(c, st2).motive.some(m => m.id === C.motive), 'the murderer never volunteers a motive', `seed ${s}`);
    }
    const c = Lamp.makeCase(1234), st = Lamp.newState(c);
    for (let i = 0; i < 5; i++) Lamp.accuse(c, st, {who: c.A.id, weapon: 'w1', motive: c.A.motive});
    check(Lamp.rank(st) === 'Constable' && Lamp.rank({wrong: 0}) === 'Chief Inspector', 'rank falls one step per wrong accusation and stops at Constable');
}

if (suites.includes('text')) {
    section('text');
    const bad = /undefined|NaN|\[object|null|\$\{|\s,|\s\.(?!\.)|\.\.(?!\.)|  /;
    for (const s of seeds) {
        const c = Lamp.makeCase(s);
        const texts = [c.title, ...Object.values(c.ev).flatMap(e => [e.name, e.text]), ...c.rooms.map(r => r.desc), ...Lamp.solution(c).flat()];
        const st = Lamp.newState(c);
        for (const p of c.people) {
            texts.push(Lamp.hello(c, p.id));
            for (const t of TOPICS) texts.push(Lamp.ask(c, st, p.id, t).text);
            for (const id of Object.keys(c.ev)) texts.push(Lamp.present(c, Lamp.newState(c), p.id, id).text);
        }
        const full = playThrough(c);
        for (const p of c.people) {
            for (const t of TOPICS) texts.push(Lamp.answer(c, full, p.id, t).text);
            texts.push(Lamp.sheet(c, full, p.id), Lamp.sheet(c, Lamp.newState(c), p.id));
        }
        for (const t of texts) {
            check(!bad.test(t), 'no broken text', `seed ${s}: ${JSON.stringify(t)}`);
            check((t.match(/«/g) || []).length === (t.match(/»/g) || []).length, 'claim marks come in pairs', `seed ${s}: ${t}`);
        }
        // What the model is told never holds a secret the player has not uncovered.
        const fresh = Lamp.newState(c);
        const sheetL = Lamp.sheet(c, fresh, c.L.id), sheetC = Lamp.sheet(c, fresh, c.C.id);
        check(!sheetL.includes(c.H.name.toLowerCase()) && !sheetL.includes(c.C.first + '\'s'), 'the model cannot give away the hidden room before the lie breaks', `seed ${s}`);
        check(!sheetC.includes(`went to the ${c.R.name.toLowerCase()}`) && !sheetC.includes(`went to see`), 'the model cannot place the murderer at the scene before the lie breaks', `seed ${s}`);
        check(!sheetC.includes(Lamp.MOTIVES[c.C.motive].word) && !sheetC.includes(c.ev['doc' + c.C.id].text), 'the model cannot give away the motive before the papers are found', `seed ${s}`);
    }
    const c = Lamp.makeCase(2000);
    const cls = [['Where were you at ten?', 'where'], ['Did you hear anything odd?', 'saw'], ['Did you owe him money?', 'victim'], ['Nice weather', null]];
    for (const [q, want] of cls) check(Lamp.classify(c, q) === want, `a typed question finds its topic: "${q}"`, `got ${Lamp.classify(c, q)}`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
