#!/usr/bin/env node
// Test suite for games/two_truths_one_lie.html (Two Truths & a Lie).
//
// Runs the page's DOM-free <script id="core"> block in Node. A lie-spotting game promises that the
// lie cannot be found by anything but knowing: it is on each place equally often, it is no longer or
// shorter than the truths more often than chance, a run climbs from easy to hard, a day is the same
// for everyone, and what a language model sends back is checked before it becomes a case. No
// browser, no server.
//
//   node test/two_truths.mjs                 # everything
//   node test/two_truths.mjs bank deal       # named suites only
//   node test/two_truths.mjs --page=path.html
//
// Suites: bank, deal, runs, days, save, ai.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'two_truths_one_lie.html'));
const ALL = ['bank', 'deal', 'runs', 'days', 'save', 'ai'];
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
vm.runInContext(core[1] + '\nthis.Fibs = Fibs;', ctx);
const F = ctx.Fibs;
const J = x => JSON.parse(JSON.stringify(x));
const seeds = Array.from({length: 600}, (_, i) => 7 + i * 131);

if (suites.includes('bank')) {
    section('bank');
    const ids = new Set(), texts = new Set();
    for (const c of F.CASES) {
        check(!ids.has(c.id), 'case ids are unique', c.id); ids.add(c.id);
        check(c.truths.length === 2, 'two truths', c.id);
        for (const s of [...c.truths, c.lie]) {
            check(typeof s === 'string' && s.length >= 12 && s.length <= 125, 'statement length fits a card', `${c.id}: ${s}`);
            check(!texts.has(s.toLowerCase()), 'no statement appears twice', `${c.id}: ${s}`); texts.add(s.toLowerCase());
            check(/[.!?'"]$/.test(s), 'statement ends like a sentence', `${c.id}: ${s}`);
        }
        check(c.fix.length >= 5 && c.fix.length <= 200, 'correction length', c.id);
        check(c.fix !== c.lie, 'the correction is not the lie', c.id);
        check([1, 2, 3].includes(c.d), 'difficulty is 1-3', c.id);
    }
    for (const t of F.TOPICS) check(F.CASES.filter(c => c.topic === t.id).length === 10, 'every file holds ten cases', t.id);
    for (const d of [1, 2, 3]) check(F.CASES.filter(c => c.d === d).length >= 12, 'enough cases of each difficulty', 'difficulty ' + d);
    check(F.CASES.every(c => F.TOPICS.some(t => t.id === c.topic)), 'every case belongs to a file');
}

if (suites.includes('deal')) {
    section('deal');
    const pos = [0, 0, 0]; let longest = 0, shortest = 0, n = 0, orders = new Set();
    for (const s of seeds) {
        const rng = F.prng(s);
        for (const c of F.CASES) {
            const d = F.deal(c, rng);
            pos[d.lie]++; n++;
            check(d.lines.length === 3 && d.lines[d.lie] === c.lie, 'the lie is where the deal says', c.id);
            check(c.truths.every(t => d.lines.includes(t)), 'both truths are on the card', c.id);
            const len = d.lines.map(l => l.length);
            if (len[d.lie] === Math.max(...len)) longest++;
            if (len[d.lie] === Math.min(...len)) shortest++;
            if (c.id === 'animals-1') orders.add(d.lines.join('|'));
        }
    }
    for (let i = 0; i < 3; i++) check(Math.abs(pos[i] / n - 1 / 3) < .02, 'the lie lands on each place equally often', `place ${i}: ${(pos[i] / n).toFixed(3)}`);
    check(orders.size === 6, 'all six orders of one case occur', orders.size + ' orders');
    // Chance for "the longest" is a third. A bank where the lie is long or short gives itself away.
    check(longest / n < .45, 'the lie is not the longest statement too often', (longest / n).toFixed(3));
    check(shortest / n < .45, 'the lie is not the shortest statement too often', (shortest / n).toFixed(3));
    console.log(`  lie longest ${(longest / n * 100).toFixed(1)}%  shortest ${(shortest / n * 100).toFixed(1)}%  places ${pos.map(p => (p / n * 100).toFixed(1)).join('/')}`);
}

if (suites.includes('runs')) {
    section('runs');
    const sig = r => r.map(c => c.id + ':' + c.lines.join('~')).join('#');
    for (const s of seeds) {
        const a = F.build({seed: s}), b = F.build({seed: s});
        check(sig(a) === sig(b), 'a seed is the same run');
        check(a.length === 10, 'a run is ten cases', 'seed ' + s);
        check(new Set(a.map(c => c.id)).size === 10, 'no case twice in a run');
        check(a.every((c, i) => c.d === F.RAMP[i]), 'a mixed run climbs 1-1-1-2-2-2-2-3-3-3', a.map(c => c.d).join(''));
        const per = {}; a.forEach(c => per[c.topic] = (per[c.topic] || 0) + 1);
        check(Math.max(...Object.values(per)) <= 3, 'a mixed run spreads across files', JSON.stringify(per));
    }
    const distinct = new Set(seeds.map(s => sig(F.build({seed: s})))).size;
    check(distinct > seeds.length * .95, 'different seeds give different runs', distinct + ' of ' + seeds.length);
    for (const t of F.TOPICS) for (const s of seeds.slice(0, 40)) {
        const r = F.build({seed: s, topic: t.id});
        check(r.length === 10 && r.every(c => c.topic === t.id) && new Set(r.map(c => c.id)).size === 10, 'a file run is that file, all ten', t.id);
        check(r.every((c, i) => i === 0 || r[i - 1].d <= c.d), 'a file run goes gentlest first', t.id);
    }
    // cases already seen come last: with 30 cases seen a run takes only fresh ones
    const old = F.CASES.slice(0, 30).map(c => c.id), fresh = F.CASES.slice(30).length;
    for (const s of seeds.slice(0, 200)) {
        const r = F.build({seed: s, seen: old});
        check(r.every(c => !old.includes(c.id)), 'unseen cases are dealt before seen ones', r.filter(c => old.includes(c.id)).map(c => c.id).join());
    }
    check(fresh >= 10, 'enough fresh cases for the test above');
    // a random guesser and a "pick the first" guesser both score a third; knowing is the only way up
    const rng = F.prng(99); let tot = 0, runs = 0;
    for (const s of seeds) for (const c of F.build({seed: s})) { tot += Math.floor(rng() * 3) === c.lie ? 1 : 0; runs++; }
    check(Math.abs(tot / runs - 1 / 3) < .02, 'a guesser scores a third', (tot / runs).toFixed(3));
    for (const p of [0, 1, 2]) {
        let hit = 0, k = 0;
        for (const s of seeds) for (const c of F.build({seed: s})) { hit += c.lie === p ? 1 : 0; k++; }
        check(Math.abs(hit / k - 1 / 3) < .03, 'always picking one place scores a third', `place ${p}: ${(hit / k).toFixed(3)}`);
    }
}

if (suites.includes('days')) {
    section('days');
    check(F.dayKey(new Date(2026, 0, 5)) === '2026-01-05', 'dayKey pads');
    check(F.dayBefore('2026-03-01') === '2026-02-28', 'day before a March 1st');
    check(F.dayBefore('2024-03-01') === '2024-02-29', 'day before a leap March 1st');
    check(F.dayBefore('2026-01-01') === '2025-12-31', 'day before New Year');
    const sig = r => r.map(c => c.id + ':' + c.lines.join('~')).join('#');
    const week = Array.from({length: 120}, (_, i) => F.dayKey(new Date(2026, 0, 1 + i)));
    const runs = week.map(d => sig(F.build({seed: F.hash('day:' + d)})));
    check(new Set(runs).size === week.length, 'every day has its own file');
    check(runs.every((r, i) => r === sig(F.build({seed: F.hash('day:' + week[i])}))), 'a day is the same on every call');
    let s = F.freshSave();
    F.touchDay(s, '2026-05-01'); check(s.streak === 1, 'first day starts a streak');
    F.touchDay(s, '2026-05-01'); check(s.streak === 1, 'the same day twice counts once');
    F.touchDay(s, '2026-05-02'); F.touchDay(s, '2026-05-03'); check(s.streak === 3, 'consecutive days extend it');
    F.touchDay(s, '2026-05-06'); check(s.streak === 1, 'a gap restarts it');
}

if (suites.includes('save')) {
    section('save');
    const bad = [null, 7, 'x', [], {best: 'many'}, {v: 2, best: 99, solved: -4, streak: 1e99, lastDay: 'tomorrow', seen: ['nope', 5], cleared: 'all', daily: {day: 'x', results: [1]}}, {daily: {day: '2026-01-01', results: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]}}];
    for (const b of bad) {
        const s = F.sanitize(J(b) ?? b);
        check(s.best >= 0 && s.best <= 10 && s.solved >= 0 && s.streak <= 99999, 'numbers are clamped', JSON.stringify(b));
        check(Array.isArray(s.seen) && s.seen.every(x => F.CASES.some(c => c.id === x)) && Array.isArray(s.cleared), 'only real cases are remembered');
        check(s.lastDay === null || /^\d{4}-\d{2}-\d{2}$/.test(s.lastDay), 'a bad day is dropped');
    }
    const ok = F.sanitize({daily: {day: '2026-01-01', results: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]}});
    check(ok.daily && ok.daily.results.filter(Boolean).length === 5, 'a good daily result survives');
    const s = F.freshSave(), run = F.build({seed: 3});
    const res = run.map((_, i) => i % 2 === 0);
    const score = F.finish(s, run, res);
    check(score === 5 && s.best === 5 && s.solved === 5 && s.cleared.length === 5 && s.seen.length === 10, 'finishing a run records it');
    const again = F.sanitize(J(s));
    check(JSON.stringify(again) === JSON.stringify(s), 'a save round-trips');
    let prev = '';
    const names = Array.from({length: 11}, (_, i) => F.rank(i));
    check(new Set(names).size >= 6 && names[10] !== names[0], 'ranks climb with the score', names.join());
    check(F.shareText('Today', res, 'https://x').split('\n')[1] === '5/10 🟩🟥🟩🟥🟩🟥🟩🟥🟩🟥', 'the share line carries the tape');
    const t = F.freshSave();
    for (let i = 0; i < 12; i++) { const r = F.build({seed: i, seen: t.seen}); F.finish(t, r, r.map(() => true)); }
    check(t.seen.length <= F.CASES.length, 'seen never outgrows the bank');
    check(F.build({seed: 1, seen: t.seen}).length === 10, 'a run can always be dealt after the bank is used up');
}

if (suites.includes('ai')) {
    section('ai');
    const good = i => ({truths: [`Truth number ${i} is a perfectly fine one.`, `Truth number ${i + 100} is another fine one.`], lie: `This is the made-up statement ${i}.`, fix: `Actually it was something else entirely, number ${i}.`});
    const ten = {cases: Array.from({length: 12}, (_, i) => good(i))};
    const out = F.cleanAI(ten, 'cheese');
    check(out.length === 10, 'at most ten cases are kept', out.length);
    check(out.every((c, i) => c.ai && c.d === F.RAMP[i]), 'AI cases climb too');
    check(F.cleanAI(J(ten).cases, 'x').length === 10, 'a bare array is accepted');
    const junk = [null, 5, 'x', {}, {cases: 'no'}, {cases: [null, {}, {truths: ['a'], lie: 'b', fix: 'c'}]}, {cases: [{truths: ['same statement here', 'same statement here'], lie: 'a different one here', fix: 'because'}]}, {cases: [{truths: ['one fine statement here', 'two fine statement here'], lie: 'ONE FINE STATEMENT HERE', fix: 'because yes'}]}, {cases: [{truths: ['x'.repeat(300), 'two fine statement here'], lie: 'a lie that is fine', fix: 'because yes'}]}, {cases: [{truths: [1, 2], lie: 3, fix: 4}]}];
    for (const j of junk) check(F.cleanAI(j, 'x').length === 0, 'junk from the model is refused', JSON.stringify(j).slice(0, 60));
    check(F.cleanAI({cases: [good(1), good(1)]}, 'x').length === 1, 'a repeated case is dropped');
    const dealt = F.dealAll(out, 5);
    check(dealt.every((d, i) => d.lines[d.lie] === out[i].lie && d.ai), 'AI cases are dealt like any other');
}

console.log(`\n${failures ? failures + ' failed, ' : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
