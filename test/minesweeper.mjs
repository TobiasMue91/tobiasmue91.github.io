#!/usr/bin/env node
// Test suite for games/minesweeper.html.
//
// The page's promise is "no guessing": with the box ticked, every board can be cleared by
// deduction from the first click. Nothing on the page can show whether that is true - a
// board that secretly needs a coin flip looks exactly like one that does not - so this runs
// the page's own core script (the <script id="core"> block, which has no DOM) in Node and
// checks the solver, the generator and the game rules directly. No browser, no server.
//
//   node test/minesweeper.mjs                  # everything
//   node test/minesweeper.mjs solver game      # named suites only
//   node test/minesweeper.mjs --page=path.html # run against another copy of the page
//
// Suites: solver, generate, game.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'minesweeper.html');
const ALL = ['solver', 'generate', 'game'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) {
    console.log('no <script id="core"> block in ' + PAGE);
    process.exit(1);
}
const ctx = vm.createContext({performance});
vm.runInContext(core[1] + '\nthis.MS = MS;', ctx);
const MS = ctx.MS;

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const LEVELS = [['Beginner', 9, 9, 10], ['Intermediate', 16, 16, 40], ['Expert', 30, 16, 99]];
const board = (W, rows) => Uint8Array.from(rows.join('').split('').map(c => c === '*' ? 1 : 0));

function solverSuite() {
    section('solver');
    // Soundness: on thousands of random boards the solver must never open a mine or flag a
    // safe cell, and "solved" must mean every safe cell is open.
    let bad = 0, solved = 0, total = 0;
    for (const [name, W, H, M] of LEVELS) {
        const rnd = mulberry(11);
        const nb = MS.neighbours(W, H);
        for (let t = 0; t < 1500; t++) {
            const first = (rnd() * W * H) | 0;
            const mine = MS.layMines(W, H, M, first, rnd, nb);
            const r = MS.solve(W, H, M, mine, first, nb);
            total++;
            let wrong = r.boom;
            let openCount = 0;
            for (let i = 0; i < W * H; i++) {
                if (r.open[i] && mine[i]) wrong = true;
                if (r.flag[i] && !mine[i]) wrong = true;
                openCount += r.open[i];
            }
            if (r.solved && openCount !== W * H - M) wrong = true;
            if (wrong) bad++;
            solved += r.solved;
        }
        check(bad === 0, `${name}: solver never opens a mine or flags a safe cell`, `${bad} unsound runs`);
    }
    console.log(`  ${solved}/${total} random boards cleared without a guess`);

    // A validator has to be seen rejecting something. Opening the top-right corner of this
    // board leaves the left column hidden: both 1s touch both cells, and one mine between
    // two cells cannot be split by the count. A true 50/50.
    //   * 1 0
    //   ? 1 0
    const fifty = board(3, ['*..', '...']);
    check(!MS.solve(3, 2, 1, fifty, 2).solved, 'a forced 50/50 is reported as needing a guess');

    // Subset rule: a 1 whose two hidden cells lie inside a 2's three hidden cells settles the third.
    //   row 0:  * . *        mines at the two top corners
    //   row 1:  . . .
    //   row 2:  . . .
    const subset = board(3, ['*.*', '...', '...']);
    check(MS.solve(3, 3, 2, subset, 7).solved, 'the subset rule clears a board single-cell rules cannot');

    // The mine count settles the endgame: once the only mine is flagged, cells no number
    // touches are safe.   0 1 * ? ?
    const count = board(5, ['..*..']);
    check(MS.solve(5, 1, 1, count, 0).solved, 'the total mine count is used');
}

function generateSuite() {
    section('generate');
    for (const [name, W, H, M] of LEVELS) {
        const nb = MS.neighbours(W, H);
        const rnd = mulberry(5);
        let spareOk = true, countOk = true, solvedOk = true, guaranteed = 0;
        const tries = [], ms = [];
        const N = 200;
        for (let t = 0; t < N; t++) {
            const first = (rnd() * W * H) | 0;
            const t0 = performance.now();
            const g = MS.generate(W, H, M, first, {noGuess: true, rnd, nb});
            ms.push(performance.now() - t0);
            tries.push(g.tries);
            if (g.mine.reduce((s, v) => s + v, 0) !== M) countOk = false;
            if (g.mine[first] || nb[first].some(j => g.mine[j])) spareOk = false;
            if (g.guaranteed) {
                guaranteed++;
                if (!MS.solve(W, H, M, g.mine, first, nb).solved) solvedOk = false;
            }
        }
        const sorted = a => a.slice().sort((x, y) => x - y);
        const q = (a, p) => sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))];
        check(countOk, `${name}: every board has exactly ${M} mines`);
        check(spareOk, `${name}: the first click and its neighbours are never mined`);
        check(solvedOk, `${name}: every board marked guaranteed is cleared by the solver`);
        check(guaranteed === N, `${name}: a guess-free board is found every time`, `${guaranteed}/${N}`);
        console.log(`  ${name.padEnd(12)} tries median ${q(tries, .5)}, p95 ${q(tries, .95)};` +
            ` time median ${q(ms, .5).toFixed(1)} ms, p95 ${q(ms, .95).toFixed(1)} ms, max ${Math.max(...ms).toFixed(1)} ms`);
    }

    // The opening has to hold without noGuess too, where no solver would filter a bad deal.
    for (const [name, W, H, M] of LEVELS) {
        const nb = MS.neighbours(W, H), rnd = mulberry(8);
        let spared = 0;
        for (let t = 0; t < 1000; t++) {
            const first = (rnd() * W * H) | 0;
            const g = MS.generate(W, H, M, first, {rnd, nb});
            if (!g.mine[first] && !nb[first].some(j => g.mine[j])) spared++;
        }
        check(spared === 1000, `${name}: a plain deal spares the first click and its neighbours`, `${spared}/1000`);
    }

    // Without noGuess the generator deals once.
    const plain = MS.generate(9, 9, 10, 40, {rnd: mulberry(1)});
    check(plain.tries === 1 && !plain.guaranteed, 'without noGuess a board is dealt once and not guaranteed');

    // Too dense to find a guess-free board: gives up inside its budget and says so.
    const t0 = performance.now();
    const dense = MS.generate(10, 10, 60, 55, {noGuess: true, rnd: mulberry(2), budgetMs: 200});
    const took = performance.now() - t0;
    check(!dense.guaranteed && dense.mine.reduce((s, v) => s + v, 0) === 60 && took < 400,
        'a board too dense for no-guess gives up within its budget, marked not guaranteed',
        `guaranteed=${dense.guaranteed} took ${took.toFixed(0)} ms`);

    // Crowded board: no room for a 3x3 opening, the clicked cell is still spared.
    const crowded = MS.generate(4, 4, 12, 5, {rnd: mulberry(3)});
    check(!crowded.mine[5] && crowded.mine.reduce((s, v) => s + v, 0) === 12,
        'on a board too crowded for an opening the clicked cell is still safe');
}

function gameSuite() {
    section('game');
    const {OPEN, FLAGGED, HIDDEN} = MS;
    // The first click never loses.
    let firstLoss = 0;
    for (let s = 0; s < 1000; s++) {
        const rnd = mulberry(s);
        const g = new MS.Game(9, 9, 10, {rnd});
        g.reveal((rnd() * 81) | 0);
        if (g.status === 'lost') firstLoss++;
    }
    check(firstLoss === 0, 'the first click never hits a mine', `${firstLoss}/1000`);

    // The bug this page was rewritten for: clicking an open number again counted it again
    // toward the win, so ninety clicks on one cell won the game.
    const g = new MS.Game(9, 9, 10, {rnd: mulberry(7)});
    g.reveal(0);
    const num = [...g.state.keys()].find(i => g.state[i] === OPEN && g.cnt[i] > 0);
    const before = g.opened;
    for (let k = 0; k < 200; k++) { g.reveal(num); g.chord(num); }
    check(g.opened === before && g.status === 'playing', 'clicking an open number repeatedly changes nothing',
        `opened ${before} -> ${g.opened}, status ${g.status}`);

    // Flags block opening, count down, and toggle back.
    const hidden = [...g.state.keys()].find(i => g.state[i] === HIDDEN);
    g.toggleFlag(hidden);
    check(g.state[hidden] === FLAGGED && g.flags === 1, 'a flag is placed');
    g.reveal(hidden);
    check(g.state[hidden] === FLAGGED, 'a flagged cell cannot be opened');
    g.toggleFlag(hidden);
    check(g.state[hidden] === HIDDEN && g.flags === 0, 'a flag is removed');
    g.toggleFlag(num);
    check(g.state[num] === OPEN && g.flags === 0, 'an open cell cannot be flagged');

    // Chording: with the right flags it opens the rest; with too few it does nothing;
    // with a wrong flag it loses, as in every Minesweeper.
    const chordable = [...g.state.keys()].find(i => g.state[i] === OPEN && g.cnt[i] > 0 &&
        g.nb[i].some(j => g.state[j] === HIDDEN && !g.mine[j]));
    check(!g.chord(chordable), 'chording without the flags placed does nothing');
    const right = g.nb[chordable].filter(j => g.mine[j]);
    right.forEach(j => g.state[j] === HIDDEN && g.toggleFlag(j));
    g.chord(chordable);
    check(g.nb[chordable].every(j => g.mine[j] ? g.state[j] === FLAGGED : g.state[j] === OPEN) && g.status !== 'lost',
        'chording with the right flags opens every other neighbour');

    let lostByChord = 0;
    for (let s = 0; s < 200 && !lostByChord; s++) {
        const h = new MS.Game(9, 9, 10, {rnd: mulberry(100 + s)});
        h.reveal(40);
        const c = [...h.state.keys()].find(i => h.state[i] === OPEN && h.cnt[i] > 0 &&
            h.nb[i].filter(j => h.state[j] === HIDDEN && !h.mine[j]).length >= h.cnt[i]);
        if (c === undefined) continue;
        h.nb[c].filter(j => h.state[j] === HIDDEN && !h.mine[j]).slice(0, h.cnt[c]).forEach(j => h.toggleFlag(j));
        h.chord(c);
        if (h.status === 'lost' && h.mine[h.hit]) lostByChord++;
    }
    check(lostByChord === 1, 'chording around a wrong flag opens the mine and loses');

    // Playing out whole no-guess games with the solver's own moves always wins, and the
    // game declares the win exactly when the last safe cell opens.
    let wins = 0, early = 0;
    for (let s = 0; s < 100; s++) {
        const [W, H, M] = [[9, 9, 10], [16, 16, 40], [30, 16, 99]][s % 3];
        const h = new MS.Game(W, H, M, {noGuess: true, rnd: mulberry(500 + s)});
        const first = ((W * H) / 2 + W / 2) | 0;
        h.reveal(first);
        const plan = MS.solve(W, H, M, h.mine, first, h.nb);
        for (let i = 0; i < h.N; i++) {
            if (plan.open[i] && h.state[i] === HIDDEN) {
                if (h.status === 'won') early++;
                h.reveal(i);
            }
        }
        if (h.status === 'won' && h.flags === M && h.opened === W * H - M) wins++;
    }
    check(wins === 100 && early === 0, 'no-guess games played by the solver are won, and only at the end',
        `${wins}/100 won, ${early} declared early`);

    // Flags do not count toward the win; only opened cells do.
    const f = new MS.Game(9, 9, 10, {rnd: mulberry(9)});
    f.reveal(40);
    for (let i = 0; i < f.N; i++) if (f.state[i] === HIDDEN) f.toggleFlag(i);
    check(f.status === 'playing', 'flagging every hidden cell does not win');
}

const run = {solver: solverSuite, generate: generateSuite, game: gameSuite};
for (const s of suites) {
    if (!run[s]) {
        console.log(`unknown suite: ${s}`);
        process.exit(1);
    }
    run[s]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
