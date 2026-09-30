#!/usr/bin/env node
// Test suite for games/emoji_puzzle_mania.html (Peel & Seek).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page is a visual search: one
// target on the stamp, one sticker on the sheet that matches it. The rules it stands on are easy
// to break from a corner nobody looks at - a decoy drawn as the target, a turned moon that now
// reads as another moon, a tape that grows past its end, a pause that eats time - and the page
// looks the same either way. Bots with a person's search speed then play whole runs, and each
// must last and score what its skill deserves. No browser, no server.
//
//   node test/emoji_puzzle_mania.mjs                  # everything
//   node test/emoji_puzzle_mania.mjs boards clock     # named suites only
//   node test/emoji_puzzle_mania.mjs --page=path.html # run against another copy of the page
//   node test/emoji_puzzle_mania.mjs runs --runs=80   # more runs per bot (default 30)
//
// Suites: boards, clock, score, seed, runs.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'emoji_puzzle_mania.html'));
const RUNS = +opt('runs', 30);
const ALL = ['boards', 'clock', 'score', 'seed', 'runs'];
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
vm.runInContext(core[1] + '\nthis.P = Peel;', ctx);
const P = ctx.P;
const familyOf = new Map();
for (const f of P.FAMILIES) for (const e of f.items) familyOf.set(e, f);

// Starts a run and finds the starter at t = 1000. Returns [run, t].
function started(seed) {
    const run = P.newRun(seed);
    const t = 1000;
    const r = P.tap(run, run.board.answers[0], t);
    if (!r || r.type !== 'start') throw new Error('starter did not start the run');
    return [run, t];
}
const wrongCell = b => b.cells.findIndex(c => c && c.e !== b.target);

if (suites.includes('boards')) {
    section('boards: one target, honest decoys, nothing turned that changes meaning');
    const everything = P.FAMILIES.flatMap(f => f.items);
    check(new Set(everything).size === everything.length, 'no emoji is in two families',
        everything.filter((e, i) => everything.indexOf(e) !== i).join(' '));
    for (const f of P.FAMILIES) check(f.items.length >= 8, `family ${f.id} has enough lookalikes to fill a sheet with them`);
    let boards = 0, bad = [];
    for (let n = 1; n <= 20; n++) {
        const spec = P.sheetSpec(n);
        for (let s = 0; s < 150; s++) {
            const rand = P.rng(n * 7919 + s);
            const b = P.makeBoard(rand, spec, null);
            boards++;
            const hits = b.cells.map((c, i) => c.e === b.target ? i : -1).filter(i => i >= 0);
            const want = Math.max(1, spec.copies);
            if (b.cells.length !== spec.cells) bad.push(`round ${n}: ${b.cells.length} cells, want ${spec.cells}`);
            if (hits.length !== want || hits.join() !== [...b.answers].sort((a, c) => a - c).join())
                bad.push(`round ${n} seed ${s}: target ${b.target} on ${hits.length} stickers, answers ${b.answers}`);
            if (familyOf.get(b.target).tier > spec.tier) bad.push(`round ${n}: target from tier ${familyOf.get(b.target).tier}`);
            for (const c of b.cells) {
                if (!familyOf.has(c.e)) bad.push(`round ${n}: unknown emoji ${c.e}`);
                if (familyOf.get(c.e).still && (Math.abs(c.tilt) > 7 || c.spin)) bad.push(`round ${n}: ${c.e} turned ${c.tilt}°/${c.spin}`);
                if (!spec.tilt && Math.abs(c.tilt) > 7) bad.push(`round ${n}: tilted ${c.tilt}° before tilting starts`);
                if (!spec.spin && c.spin) bad.push(`round ${n}: spinning before spinning starts`);
            }
            if (spec.cells <= 9) {
                const decoys = b.cells.filter(c => c.e !== b.target).map(c => c.e);
                if (new Set(decoys).size < decoys.length) bad.push(`round ${n}: small sheet repeats decoys ${decoys.join('')}`);
            }
        }
    }
    check(!bad.length, `${boards} boards: exactly the stated number of targets, no stray target, no turned moon or clock, nine different things on a 3×3`, bad.slice(0, 5).join('\n          '));

    // The lookalike share must actually show: late rounds are mostly the target's own family.
    const share = n => {
        let near = 0, all = 0;
        for (let s = 0; s < 200; s++) {
            const b = P.makeBoard(P.rng(s + 1), P.sheetSpec(n), null);
            const fam = familyOf.get(b.target);
            for (const c of b.cells) if (c.e !== b.target) { all++; if (familyOf.get(c.e) === fam) near++; }
        }
        return near / all;
    };
    const early = share(1), late = share(11);
    check(early > .15 && early < .5, `round 1 shows some lookalikes (${(early * 100).toFixed(0)}%)`);
    check(late > .9, `round 11 is nearly all lookalikes (${(late * 100).toFixed(0)}%)`);
    const turned = n => {
        let k = 0, all = 0;
        for (let s = 0; s < 200; s++) for (const c of P.makeBoard(P.rng(s + 3), P.sheetSpec(n), null).cells) { all++; if (Math.abs(c.tilt) > 7 || c.spin) k++; }
        return k / all;
    };
    check(turned(5) === 0 && turned(7) > .2 && turned(14) > turned(7), 'stickers start turning at round 6 and turn more later');
    const sizes = [...Array(16)].map((_, i) => P.sheetSpec(i + 1).cols);
    check(sizes.every((c, i) => i === 0 || c >= sizes[i - 1]) && sizes[0] === 3 && Math.max(...sizes) === 6,
        `sheets only grow, from 3×3 to 6×6 (${sizes.join(' ')})`);
    let repeats = 0;
    for (let s = 0; s < 40; s++) {
        const [run] = started(s);
        let t = 2000, last = run.board.target;
        for (let k = 0; k < 30 && !run.over; k++) {
            const r = P.tap(run, run.board.left[0], Math.max(t, run.shownAt) + 300);
            t = Math.max(t, run.shownAt) + 300;
            if (!r) break;
            if (r.type === 'find' && run.board.target === last) repeats++;
            last = run.board.target;
        }
    }
    check(repeats === 0, 'a find never shows the same target again straight away', `${repeats} repeats`);
}

if (suites.includes('clock')) {
    section('clock: the tape, the starter, misses, pauses');
    const run = P.newRun(42);
    check(P.remaining(run, 99999) === P.START_MS && !P.update(run, 99999), 'the clock does not run on the starter sheet');
    const bad = P.tap(run, wrongCell(run.board), 500);
    check(bad && bad.type === 'miss' && bad.free && !run.started && run.misses === 0, 'a wrong sticker on the starter costs nothing');
    P.tap(run, run.board.answers[0], 1000);
    check(run.started && run.sheet === 1, 'finding the starter begins round 1');
    check(P.remaining(run, 1000) === P.REFRESH_MS + P.START_MS, 'the flip after a find does not come out of the tape');
    check(P.tap(run, run.board.answers[0], 1000 + P.REFRESH_MS - 1) === null, 'a tap while the stickers are still flipping does not count');
    const before = P.remaining(run, 2000);
    const m = P.tap(run, wrongCell(run.board), 2000);
    check(m.type === 'miss' && P.remaining(run, 2000) === before - P.MISS_MS && run.streak === 0, 'a wrong sticker tears off exactly the miss cost and ends the streak');

    // The tape never grows past its end, however fast the finds come.
    const [fast] = started(7);
    let t = 1000, over = 0;
    for (let k = 0; k < 60 && !fast.over; k++) {
        t = fast.shownAt + 50;
        P.tap(fast, fast.board.left[0], t);
        over = Math.max(over, P.remaining(fast, Math.max(t, fast.shownAt)) - P.MAX_MS);
    }
    check(over <= 0, 'the tape is never longer than its maximum once the stickers are down', `${over} ms over`);

    // A pause stops everything: the tape, and the speed a find is judged by.
    const [a] = started(9), [b] = started(9);
    t = a.shownAt;
    P.pause(a, t + 100);
    check(P.tap(a, a.board.answers[0], t + 500) === null, 'no taps count while paused');
    P.resume(a, t + 60100);
    const ra = P.tap(a, a.board.answers[0], t + 60600);
    const rb = P.tap(b, b.board.answers[0], t + 600);
    check(ra.points === rb.points && P.remaining(a, t + 60600) === P.remaining(b, t + 600), 'a minute paused changes neither the tape nor the score');

    // Running out ends the run; a miss that empties the tape ends it at once.
    const [c] = started(11);
    check(!P.update(c, c.deadline - 1) && P.update(c, c.deadline) && c.over, 'the run ends when the tape is empty, not before');
    const [d] = started(12);
    let e = null;
    t = d.shownAt;
    while (!d.over) { e = P.tap(d, wrongCell(d.board), t); t += 10; }
    check(e.over && P.remaining(d, t) === 0 && P.tap(d, d.board.answers[0], t) === null, 'misses alone empty the tape and nothing counts after');
}

if (suites.includes('score')) {
    section('score: speed, streak, rounds, collector sheets');
    const [a] = started(21), [b] = started(21);
    const quick = P.tap(a, a.board.answers[0], a.shownAt + 200);
    const slow = P.tap(b, b.board.answers[0], b.shownAt + 4000);
    check(quick.points > slow.points && quick.points <= 2 * slow.points + 5, `a quick find pays more, at most double (${quick.points} vs ${slow.points})`);
    check([1, 2, 3, 5, 6, 9, 15, 30].map(P.multiplier).join() === '1,1,2,2,3,4,6,6', 'the multiplier rises every third find in a row, up to ×6');
    const [r] = started(33);
    let t, sheets = [r.sheet], sum = 0, types = new Set();
    for (let k = 0; k < 40; k++) {
        t = r.shownAt + 400;
        const res = P.tap(r, r.board.left[0], t);
        sum += res.points;
        types.add(res.type);
        if (res.newSheet) sheets.push(r.sheet);
    }
    check(sum === r.score, 'the score is the sum of what each find said it paid');
    check(sheets.slice(0, 4).join() === '1,2,3,4', `five finds make a round (${sheets.join(' ')})`);
    check(types.has('copy') && types.has('clear'), 'round 4 is a collector sheet with several copies to find');
    // A collector sheet: found copies leave their spot empty; tapping the empty spot does nothing.
    const [c] = started(44);
    while (!P.sheetSpec(c.sheet).copies) P.tap(c, c.board.left[0], c.shownAt + 300);
    const spots = [...c.board.answers];
    t = c.shownAt + 300;
    const first = P.tap(c, spots[0], t);
    check(first.type === 'copy' && first.left === spots.length - 1 && c.board.cells[spots[0]] === null, 'a collector copy peels off and leaves its spot empty');
    check(P.tap(c, spots[0], t + 50) === null, 'tapping the empty spot does nothing');
    let last;
    for (const i of spots.slice(1)) last = P.tap(c, i, t += 200);
    check(last.type === 'clear' && last.newSheet && c.sheet === 5, 'the last copy clears the sheet and the next round begins');
}

if (suites.includes('seed')) {
    section('seed: the same seed is the same run');
    const play = seed => {
        const [run] = started(seed);
        const out = [];
        for (let k = 0; k < 25 && !run.over; k++) {
            const t = run.shownAt + 350 + k * 13;
            out.push(run.board.target + run.board.cells.map(c => c ? c.e + c.tilt : '_').join(''));
            P.tap(run, k % 7 === 3 ? wrongCell(run.board) : run.board.left[0], t);
        }
        return out.join('|') + run.score;
    };
    check(play(P.hash('peel-and-seek:2026-09-30')) === play(P.hash('peel-and-seek:2026-09-30')), 'today\'s sheet is the same for everyone who plays it the same way');
    check(play(P.hash('peel-and-seek:2026-09-30')) !== play(P.hash('peel-and-seek:2026-10-01')), 'tomorrow\'s sheet is a different one');
    check(P.hash('a') !== P.hash('b') && P.hash('abc') === P.hash('abc'), 'the day hash is stable');
}

if (suites.includes('runs')) {
    section(`runs: bots with a person's search speed, ${RUNS} runs each`);
    // Search time grows with the number of stickers and with how alike and how turned they are;
    // a bot sometimes taps a lookalike first. Numbers are per sticker on the sheet.
    function play(seed, {base, per, slip}) {
        const [run] = started(seed);
        const r = P.rng(seed ^ 0x5eed);
        let t = run.shownAt;
        while (!run.over) {
            const spec = P.sheetSpec(run.sheet);
            const look = (base + per * spec.cells * (1 + spec.similar * .8 + spec.tilt * .6 + spec.spin))
                * (.65 + r() * .7) / (spec.copies ? spec.copies * .8 : 1);
            t = Math.max(t, run.shownAt) + look;
            if (P.update(run, t)) break;
            if (r() < slip * spec.similar) { P.tap(run, wrongCell(run.board), t); t += 250; if (run.over) break; }
            P.tap(run, run.board.left[0], t);
        }
        return {round: run.sheet, score: run.score, secs: (t - 1000) / 1000};
    }
    const bots = {
        sharp: {base: 350, per: 22, slip: .05},
        average: {base: 550, per: 45, slip: .15},
        slow: {base: 800, per: 70, slip: .25},
    };
    const stats = {};
    for (const [name, bot] of Object.entries(bots)) {
        const res = [...Array(RUNS)].map((_, i) => play(500 + i, bot));
        const mean = k => res.reduce((s, x) => s + x[k], 0) / res.length;
        stats[name] = {round: mean('round'), score: mean('score'), secs: mean('secs'), minRound: Math.min(...res.map(x => x.round))};
        console.log(`  ${name.padEnd(8)} round ${stats[name].round.toFixed(1)} (min ${stats[name].minRound})  ${stats[name].secs.toFixed(0)} s  score ${stats[name].score.toFixed(0)}`);
    }
    const {sharp, average, slow} = stats;
    check(sharp.score > average.score * 1.5 && average.score > slow.score * 1.5, 'score follows skill: each step up is worth half as much again');
    check(sharp.round > average.round && average.round > slow.round, 'better eyes reach later rounds');
    check(slow.minRound >= 3, 'a slow player always sees at least three rounds, a collector sheet next');
    check(slow.secs > 45 && sharp.secs < 200, `runs last a minute or so for a slow player and never drag on for a sharp one (${slow.secs.toFixed(0)} s, ${sharp.secs.toFixed(0)} s)`);
    check(sharp.round >= 10, 'a sharp player reaches the 6×6 sheets with turning stickers');
    const mashing = [...Array(RUNS)].map((_, s) => {
        const [run] = started(900 + s);
        let t = run.shownAt;
        const r = P.rng(s);
        while (!run.over) { t += 120; P.tap(run, r.int(run.board.cells.length), t); P.update(run, t); }
        return run.score;
    });
    const mash = mashing.reduce((a, b) => a + b, 0) / RUNS;
    check(mash < slow.score / 2, `tapping at random scores far less than looking (${mash.toFixed(0)} vs ${slow.score.toFixed(0)})`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
