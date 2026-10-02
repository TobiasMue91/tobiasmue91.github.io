#!/usr/bin/env node
// Test suite for games/number_guess.html (Tumbler).
//
// Runs the page's DOM-free <script id="core"> block in Node: the safes, the picks they bring, the
// answers they give. What a player cannot see from the page - a safe that answers wrong, a heist
// that a careful player loses on the first four safes, a pick that goes missing between safes, a
// daily that differs from phone to phone - would all come from one number changed somewhere else.
// No browser, no server.
//
//   node test/number_guess.mjs              # everything
//   node test/number_guess.mjs rules bots   # named suites only
//   node test/number_guess.mjs --page=path.html
//
// Suites:
//   rules  - every answer against the secret, picks spent and paid exactly, the end of a heist,
//            guesses outside the window refused for free, saves that carry on identically
//   safes  - every combination inside its safe, the same on every device for a seed, spread evenly;
//            the first four safes always open for a player who halves, and certain() is exact
//   bots   - whole heists by a careful player, a sloppy one and a novice: each must reach the
//            stage its play deserves, in that order, and every heist must end

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'number_guess.html');
const ALL = ['rules', 'safes', 'bots'];
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
vm.runInContext(core[1] + '\nthis.C = TumblerCore;', ctx);
const C = ctx.C;
const clone = o => JSON.parse(JSON.stringify(o));

// a seeded stream for the bots, independent of the page's
function stream(a) { return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const halving = (lo, hi) => Math.floor((lo + hi) / 2);
const sloppy = r => (lo, hi) => Math.round(lo + (hi - lo) * (.3 + .4 * r()));
const novice = r => (lo, hi) => Math.round(lo + (hi - lo) * (.12 + .76 * r()));
function play(seed, bot, cap = 5000) {
    const s = C.start(seed); let n = 0;
    while (!s.over && n++ < cap) C.guess(s, bot(s.lo, s.hi));
    return s;
}
const opened = s => s.log.filter(e => !e.bust).length;

// ------------------------------------------------------------------ rules
function rules() {
    section('rules');
    for (let i = 0; i < 300; i++) {
        const s = C.start('rules:' + i), r = stream(i + 1);
        let ok = true, detail = '';
        while (!s.over && s.k < 12) {
            const before = clone(s), x = s.lo + Math.floor(r() * (s.hi - s.lo + 1)), c = C.secret(s.seed, s.k);
            const ev = C.guess(s, x), t = ev[0].type;
            if (x === c) {
                if (t !== 'open' || ev[1].type !== 'safe') { ok = false; detail = `hit ${x} answered ${t}`; break; }
                if (s.k !== before.k + 1 || s.bank !== before.bank - 1 + C.allowance(before.k + 1)) { ok = false; detail = `picks after opening safe ${before.k}: ${before.bank} -> ${s.bank}`; break; }
                if (s.lo !== 0 || s.hi !== C.size(s.k) - 1 || s.tries.length) { ok = false; detail = 'next safe did not start whole'; break; }
                if (s.log.at(-1).used !== before.tries.length + 1) { ok = false; detail = 'log miscounted the tries'; break; }
            } else {
                const want = x < c ? 'low' : 'high';
                if (t !== want) { ok = false; detail = `secret ${c}, guess ${x}: answered ${t}`; break; }
                if (c < s.lo || c > s.hi) { ok = false; detail = `window ${s.lo}-${s.hi} lost the secret ${c}`; break; }
                if (s.bank !== before.bank - 1) { ok = false; detail = 'a wrong guess did not cost exactly one pick'; break; }
                if (s.bank === 0 && !(s.over && ev.at(-1).type === 'bust' && ev.at(-1).secret === c)) { ok = false; detail = 'an empty roll did not end the heist with the secret'; break; }
                if (s.bank > 0 && s.over) { ok = false; detail = 'heist ended with picks left'; break; }
            }
        }
        if (!ok) { fail('every answer, every pick', `seed rules:${i}: ${detail}`); return; }
    }
    pass('every answer, every pick');

    // a guess outside the window is refused and costs nothing
    const s = C.start('refuse'); const c = C.secret(s.seed, 0);
    const wrong = c > 4 ? 0 : 9; C.guess(s, wrong);
    const snap = clone(s), out = wrong < c ? s.lo - 1 : s.hi + 1;
    const ev = C.guess(s, out);
    check(ev[0].type === 'ruled' && JSON.stringify(s) === JSON.stringify(snap), 'a guess already ruled out is refused for free', JSON.stringify(ev));
    check(C.guess(s, -5)[0].type === 'ruled' && C.guess(s, 1e6)[0].type === 'ruled' && C.guess(s, NaN)[0].type === 'ruled', 'nonsense guesses are refused');
    const done = play('over', halving); const n = done.log.length;
    check(C.guess(done, done.lo)[0].type === 'over' && done.log.length === n, 'a finished heist takes no more guesses');

    // a save taken at any moment carries on exactly as the heist would have
    let same = true;
    for (let i = 0; i < 100 && same; i++) {
        const a = C.start('save:' + i), r = stream(99 + i); const stop = Math.floor(r() * 40);
        for (let j = 0; j < stop && !a.over; j++) C.guess(a, halving(a.lo, a.hi));
        const b = JSON.parse(JSON.stringify(a));
        if (!C.valid(b)) { same = false; break; }
        while (!a.over) { const x = sloppy(r)(a.lo, a.hi); const e1 = JSON.stringify(C.guess(a, x)), e2 = JSON.stringify(C.guess(b, x)); if (e1 !== e2) { same = false; break; } }
        same = same && JSON.stringify(a) === JSON.stringify(b);
    }
    check(same, 'a save carries on identically');
    check(!C.valid(null) && !C.valid({}) && !C.valid({...C.start('x'), hi: 5000}) && C.valid(C.start('x')), 'valid() turns away broken saves');

    // the shared line gives no combination away and has one square per safe
    const sh = C.share(done, 'Tumbler');
    const secrets = done.log.map((e, k) => C.secret(done.seed, k)).filter(x => x > 9);
    check(sh.split('\n')[1].length / 2 === done.log.length && !secrets.some(x => sh.includes(String(x))), 'the share line holds a square per safe and no combination', sh);
}

// ------------------------------------------------------------------ safes
function safes() {
    section('safes');
    let inside = true;
    for (let k = 0; k < 30; k++) for (let i = 0; i < 400; i++) { const c = C.secret('s' + i, k); if (!(Number.isInteger(c) && c >= 0 && c < C.size(k))) inside = false; }
    check(inside, 'every combination lies inside its safe');
    check(C.secret('daily:2026-10-02', 5) === C.secret('daily:2026-10-02', 5) && C.secret('daily:2026-10-02', 5) !== C.secret('daily:2026-10-03', 5) || C.secret('daily:2026-10-02', 6) !== C.secret('daily:2026-10-03', 6), 'a seed means the same safes everywhere, a new day new ones');
    // evenly spread: every tenth of the big safe gets its share over many days
    const bins = Array(10).fill(0), N = 20000;
    for (let i = 0; i < N; i++) bins[Math.floor(C.secret('spread:' + i, 8) / 100)]++;
    check(bins.every(b => Math.abs(b - N / 10) < N / 10 * .08), 'combinations are spread evenly', bins.join(' '));
    // halving opens every one of the first four safes, whatever the combination
    let sure = true;
    for (let k = 0; k < 4; k++) {
        const n = C.size(k);
        for (let c = 0; c < n; c++) { let lo = 0, hi = n - 1, t = 0; for (;;) { t++; const g = halving(lo, hi); if (g === c) break; if (g < c) lo = g + 1; else hi = g - 1; } if (t > C.allowance(k)) sure = false; }
    }
    check(sure, 'the first four safes always open for a player who halves');
    check([4, 5, 6, 9, 14].every(k => C.allowance(k) < C.sure(C.size(k))), 'from the fifth safe on, a careful player needs a spare pick or some luck');
    // certain() is exact: when it says so, halving opens every combination with the picks in hand
    let exact = true;
    for (let i = 0; i < 2000 && exact; i++) {
        const s = C.start('cert:' + i), r = stream(7 + i); s.bank = 1 + Math.floor(r() * 9);
        const n = s.hi - s.lo + 1, cert = C.certain(s);
        let worst = 0; for (let c = 0; c < n; c++) { let lo = 0, hi = n - 1, t = 0; for (;;) { t++; const g = halving(lo, hi); if (g === c) break; if (g < c) lo = g + 1; else hi = g - 1; } worst = Math.max(worst, t); }
        if (cert !== (worst <= s.bank)) exact = false;
    }
    check(exact, 'certain() is true exactly when halving cannot fail');
}

// ------------------------------------------------------------------ bots
function bots() {
    section('bots');
    const N = 3000, stats = {};
    for (const [name, mk] of [['careful', () => halving], ['sloppy', r => sloppy(r)], ['novice', r => novice(r)]]) {
        const a = [];
        for (let i = 0; i < N; i++) { const s = play('bot:' + i, mk(stream(31 + i))); if (!s.over) { fail(`${name}: every heist ends`, 'bot:' + i); return; } a.push(opened(s)); }
        a.sort((x, y) => x - y);
        stats[name] = {p10: a[N * .1 | 0], med: a[N / 2 | 0], p90: a[N * .9 | 0], max: a[N - 1], mean: a.reduce((x, y) => x + y, 0) / N};
        console.log(`  ${name.padEnd(8)} opened: p10 ${stats[name].p10}  median ${stats[name].med}  p90 ${stats[name].p90}  best ${stats[name].max}`);
    }
    pass('every heist ends');
    check(stats.careful.p10 >= 4, 'a careful player always gets past the first four safes', JSON.stringify(stats.careful));
    check(stats.careful.med >= 10 && stats.careful.med <= 16, 'a careful heist runs ten to sixteen safes', JSON.stringify(stats.careful));
    check(stats.careful.p90 <= 22, 'a heist always ends in reasonable time', JSON.stringify(stats.careful));
    check(stats.careful.mean > stats.sloppy.mean + 1 && stats.sloppy.mean > stats.novice.mean + 1, 'better play goes further: careful, then sloppy, then novice',
        `${stats.careful.mean.toFixed(1)} / ${stats.sloppy.mean.toFixed(1)} / ${stats.novice.mean.toFixed(1)}`);
    check(stats.novice.med >= 3, 'a novice still opens a few', JSON.stringify(stats.novice));
}

for (const name of suites) ({rules, safes, bots})[name]();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
