#!/usr/bin/env node
// Test suite for games/2048.html.
//
// Runs the page's DOM-free <script id="core"> block in Node. The page animates each move from
// the plan the core returns, so a plan that disagrees with the board it came with draws tiles
// that are not there - and a merge rule that is almost right (the old page merged 2 2 4 into 8)
// looks right on most moves. No browser, no server.
//
//   node test/2048.mjs                  # everything
//   node test/2048.mjs rules plan       # named suites only
//   node test/2048.mjs --page=path.html # run against another copy of the page
//   node test/2048.mjs bots --games=40  # more games per bot (default 16)
//
// Suites: rules, plan, seed, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', '2048.html'));
const GAMES = +opt('games', 16);
const ALL = ['rules', 'plan', 'seed', 'bots'];
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
vm.runInContext(core[1] + '\nthis.G = G2048;', ctx);
const G = ctx.G;
const DIRS = ['left', 'right', 'up', 'down'];

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const arr = x => Array.from(x);

// The rule as the original states it, written the plain way: squeeze out the gaps, merge each
// equal pair once from the leading edge, squeeze again.
function refRow(row) {
    const t = row.filter(v => v), out = [];
    let gained = 0;
    for (let i = 0; i < t.length; i++) {
        if (i + 1 < t.length && t[i] === t[i + 1]) { out.push(t[i] * 2); gained += t[i] * 2; i++; }
        else out.push(t[i]);
    }
    while (out.length < 4) out.push(0);
    return {out, gained};
}
function refSlide(cells, dir) {
    const res = new Array(16).fill(0);
    let gained = 0;
    for (const line of G.LINES[dir]) {
        const r = refRow(line.map(i => cells[i]));
        line.forEach((i, k) => res[i] = r.out[k]);
        gained += r.gained;
    }
    return {cells: res, gained};
}
function randomBoard(rnd, fill = 0.6, top = 7) {
    return Array.from({length: 16}, () => rnd() < fill ? 2 ** (1 + Math.floor(rnd() * top)) : 0);
}

// ---------------------------------------------------------------- rules
if (suites.includes('rules')) {
    section('rules');
    const cases = [
        ['2 2 4 0', '4 4 0 0'], ['2 2 2 2', '4 4 0 0'], ['4 2 2 0', '4 4 0 0'], ['2 2 2 0', '4 2 0 0'],
        ['0 0 0 2', '2 0 0 0'], ['2 0 0 2', '4 0 0 0'], ['4 4 8 8', '8 16 0 0'], ['8 4 4 8', '8 8 8 0'],
        ['2 4 8 16', '2 4 8 16'], ['0 2 0 2', '4 0 0 0']
    ];
    for (const [a, b] of cases) {
        const row = a.split(' ').map(Number);
        const cells = [...row, ...new Array(12).fill(0)];
        const got = arr(G.slide(cells, 'left').cells).slice(0, 4).join(' ');
        check(got === b, `left ${a} -> ${b}`, `got ${got}`);
    }
    // every row of 0..32 in every direction, against the reference
    let bad = 0, n = 0;
    const vals = [0, 2, 4, 8, 16, 32];
    const rnd = mulberry(7);
    for (let x = 0; x < 6 ** 4; x++) {
        const row = [x % 6, (x / 6 | 0) % 6, (x / 36 | 0) % 6, (x / 216 | 0) % 6].map(k => vals[k]);
        for (const dir of DIRS) {
            const cells = randomBoard(rnd);
            const line = G.LINES[dir][x % 4];
            line.forEach((i, k) => cells[i] = row[k]);
            const got = G.slide(cells, dir), want = refSlide(cells, dir);
            n++;
            if (arr(got.cells).join() !== want.cells.join() || got.gained !== want.gained) {
                if (bad++ < 3) fail(`slide ${dir} ${cells.join(',')}`, `got ${arr(got.cells)} want ${want.cells}`);
            }
            const changed = arr(got.cells).join() !== cells.join();
            if (got.moved !== changed && bad++ < 3) fail(`moved flag ${dir} ${cells.join(',')}`, `moved=${got.moved} changed=${changed}`);
        }
    }
    check(bad === 0, `${n} slides agree with the reference rule`, `${bad} disagreements`);

    // canMove is exactly "some direction changes the board"
    let cm = 0;
    for (let k = 0; k < 20000; k++) {
        const cells = randomBoard(rnd, k % 2 ? 1 : 0.95, 4);
        const any = DIRS.some(d => G.slide(cells, d).moved);
        if (G.canMove(cells) !== any) cm++;
    }
    check(cm === 0, 'canMove agrees with trying all four directions on 20000 full-ish boards', `${cm} wrong`);

    // a move that changes nothing is not a move
    const g = G.newGame('noop');
    g.cells = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 0, 0, 0, 0];
    check(G.move(g, 'up') === null && G.move(g, 'left') === null, 'a move that changes nothing returns null');
    check(G.move(g, 'down') !== null, 'a move into space is a move');

    // spawns: a 4 one time in ten, on every empty cell equally
    const counts = new Array(16).fill(0);
    let fours = 0, total = 0;
    for (let s = 0; s < 20000; s++) {
        const game = {rng: s * 2654435761 >>> 0, cells: new Array(16).fill(0)};
        game.cells[5] = 2;
        const sp = G.spawn(game);
        counts[sp.at]++; total++;
        if (sp.value === 4) fours++;
    }
    const share = fours / total;
    check(Math.abs(share - 0.1) < 0.01, `a 4 spawns ${(share * 100).toFixed(1)}% of the time`);
    const others = counts.filter((c, i) => i !== 5);
    check(counts[5] === 0, 'never spawns on a filled cell');
    check(Math.max(...others) / Math.min(...others) < 1.2, `empty cells are hit evenly (${Math.min(...others)}..${Math.max(...others)})`);

    // win and game over flags
    const w = G.newGame('win');
    w.cells = [1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const wr = G.move(w, 'left');
    check(wr.justWon && wr.game.won, 'merging two 1024s wins');
    const wr2 = G.move(Object.assign({}, wr.game, {cells: [2048, 2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}), 'left');
    check(wr2 && !wr2.justWon, 'winning only happens once');
    const o = G.newGame('over');
    o.cells = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 8, 8];
    const or = G.move(o, 'left');
    check(or && or.game.over === !G.canMove(or.game.cells), 'over is set exactly when no move is left');
    check(G.move(Object.assign({}, o, {over: true}), 'left') === null, 'a finished game takes no moves');
}

// ---------------------------------------------------------------- plan
// The page moves one element per tile along the plan and pops a new one on each merge.
// Replaying the plan on the old board must give the new board, with no tile passing another.
if (suites.includes('plan')) {
    section('plan');
    const rnd = mulberry(99);
    let bad = 0, n = 0;
    for (let k = 0; k < 40000; k++) {
        const cells = randomBoard(rnd, 0.4 + rnd() * 0.6, 5);
        const dir = DIRS[k % 4];
        const s = G.slide(cells, dir);
        const sums = new Array(16).fill(0), hits = new Array(16).fill(0), used = new Array(16).fill(0);
        let why = '';
        for (const p of s.plan) { sums[p.to] += cells[p.from]; hits[p.to]++; used[p.from]++; }
        for (let i = 0; i < 16; i++) {
            if (cells[i] && used[i] !== 1) why = `tile ${i} moved ${used[i]} times`;
            if (!cells[i] && used[i]) why = `empty cell ${i} moved`;
            if (sums[i] !== s.cells[i]) why = `cell ${i}: plan gives ${sums[i]}, board has ${s.cells[i]}`;
            if (hits[i] > 2) why = `cell ${i} reached by ${hits[i]} tiles`;
        }
        const mergeCells = arr(s.merges).map(m => m.at).sort((a, b) => a - b).join();
        const twoHit = hits.map((h, i) => h === 2 ? i : -1).filter(i => i >= 0).join();
        if (mergeCells !== twoHit) why = `merges ${mergeCells} but two tiles reached ${twoHit}`;
        for (const m of s.merges) if (s.cells[m.at] !== m.value) why = `merge at ${m.at} says ${m.value}`;
        // order is kept along each line, and a tile only ever moves toward the edge
        for (const line of G.LINES[dir]) {
            const pos = i => line.indexOf(i);
            const mine = s.plan.filter(p => line.includes(p.from)).sort((a, b) => pos(a.from) - pos(b.from));
            for (let j = 0; j < mine.length; j++) {
                if (!line.includes(mine[j].to)) why = 'a tile left its line';
                if (pos(mine[j].to) > pos(mine[j].from)) why = 'a tile moved backwards';
                if (j && pos(mine[j].to) < pos(mine[j - 1].to)) why = 'a tile passed another';
            }
        }
        n++;
        if (why && bad++ < 3) fail(`plan ${dir} ${cells.join(',')}`, why);
    }
    check(bad === 0, `${n} plans replay to the board they came with`, `${bad} bad`);
}

// ---------------------------------------------------------------- seed
if (suites.includes('seed')) {
    section('seed');
    const play = (seed, moves) => {
        let g = G.newGame(seed);
        for (const d of moves) { const r = G.move(g, d); if (r) g = r.game; }
        return g;
    };
    const rnd = mulberry(3);
    const moves = Array.from({length: 300}, () => DIRS[Math.floor(rnd() * 4)]);
    const a = play('k3x9q', moves), b = play('k3x9q', moves);
    check(a.cells.join() === b.cells.join() && a.score === b.score && a.rng === b.rng, 'a seed and a list of moves always give the same game');
    const c = play('k3x9r', moves);
    check(a.cells.join() !== c.cells.join(), 'a different seed gives a different game');
    check(G.newGame('daily-2026-09-29').cells.join() === G.newGame('daily-2026-09-29').cells.join(), 'the daily board opens the same for everyone');

    // a game saved to JSON halfway carries on exactly as if it had never been saved
    let g1 = G.newGame('save'), g2 = null;
    for (let i = 0; i < moves.length; i++) {
        if (i === 120) g2 = JSON.parse(JSON.stringify(g1));
        const r1 = G.move(g1, moves[i]); if (r1) g1 = r1.game;
        if (g2) { const r2 = G.move(g2, moves[i]); if (r2) g2 = r2.game; }
    }
    check(g1.cells.join() === g2.cells.join() && g1.score === g2.score, 'a saved and reloaded game continues identically');
    check(G.valid(JSON.parse(JSON.stringify(g1))), 'a saved game passes validation');
    const broken = [null, {}, Object.assign({}, g1, {cells: g1.cells.slice(0, 15)}), Object.assign({}, g1, {cells: [...g1.cells.slice(0, 15), 3]}),
        Object.assign({}, g1, {score: 'x'}), Object.assign({}, g1, {v: 2})];
    check(broken.every(x => !G.valid(x)), 'broken saves are refused, not loaded');
    const fresh = G.newGame('x');
    check(fresh.cells.filter(Boolean).length === 2 && fresh.score === 0 && fresh.moves === 0, 'a new game starts with two tiles');
}

// ---------------------------------------------------------------- bots
// 2048's balance is the original's and is not tuned here; the bots show the rebuilt rules play
// like it: random play stalls around 128, a corner habit gets further, and a player who looks
// ahead reaches 2048.
if (suites.includes('bots')) {
    section('bots');
    const W = [
        [65536, 32768, 16384, 8192], [512, 1024, 2048, 4096], [256, 128, 64, 32], [2, 4, 8, 16]
    ].flat();   // a snake from the top-left corner
    const evalBoard = cells => {
        let s = 0, empty = 0;
        for (let i = 0; i < 16; i++) { s += cells[i] * W[i]; if (!cells[i]) empty++; }
        return s + empty * 20000;
    };
    function chance(cells, depth) {
        const empty = [];
        for (let i = 0; i < 16; i++) if (!cells[i]) empty.push(i);
        if (!empty.length) return evalBoard(cells);
        let tot = 0;
        const pick = empty.length > 6 ? empty.filter((_, k) => k % 2 === 0) : empty;
        for (const i of pick) for (const [v, p] of [[2, 0.9], [4, 0.1]]) {
            const c = cells.slice(); c[i] = v;
            tot += p * maxNode(c, depth - 1);
        }
        return tot / pick.length;
    }
    function maxNode(cells, depth) {
        if (depth <= 0) return evalBoard(cells);
        let best = -1;
        for (const d of DIRS) {
            const s = G.slide(cells, d);
            if (!s.moved) continue;
            best = Math.max(best, chance(arr(s.cells), depth));
        }
        return best < 0 ? evalBoard(cells) - 1e9 : best;
    }
    const bots = {
        random: rnd => (g) => DIRS[Math.floor(rnd() * 4)],
        corner: () => (g) => ['up', 'left', 'right', 'down'].find(d => G.slide(g.cells, d).moved),
        lookahead: () => (g) => {
            const empties = g.cells.filter(v => !v).length;
            const depth = empties <= 3 ? 3 : 2;
            let best = null, bv = -Infinity;
            for (const d of DIRS) {
                const s = G.slide(g.cells, d);
                if (!s.moved) continue;
                const v = chance(arr(s.cells), depth);
                if (v > bv) { bv = v; best = d; }
            }
            return best;
        }
    };
    const results = {};
    for (const [name, make] of Object.entries(bots)) {
        const games = name === 'lookahead' ? Math.max(4, Math.round(GAMES / 2)) : GAMES * 4;
        const scores = [], tops = [], moves = [];
        const t0 = Date.now();
        for (let k = 0; k < games; k++) {
            let g = G.newGame('bot-' + k);
            const bot = make(mulberry(k + 1));
            let stuck = 0;
            while (!g.over && g.moves < 20000) {
                const r = G.move(g, bot(g));
                if (r) { g = r.game; stuck = 0; } else if (++stuck > 50) break;
            }
            scores.push(g.score); tops.push(G.maxTile(g.cells)); moves.push(g.moves);
        }
        const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
        const reach = v => tops.filter(t => t >= v).length / games;
        results[name] = {reach, med: med(scores)};
        console.log(`  ${name.padEnd(9)} ${String(games).padStart(3)} games  median score ${String(med(scores)).padStart(6)}  median moves ${String(med(moves)).padStart(5)}` +
            `  reached 256 ${(reach(256) * 100).toFixed(0).padStart(3)}%  512 ${(reach(512) * 100).toFixed(0).padStart(3)}%` +
            `  1024 ${(reach(1024) * 100).toFixed(0).padStart(3)}%  2048 ${(reach(2048) * 100).toFixed(0).padStart(3)}%  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
    check(results.random.reach(512) === 0, 'random play never reaches 512');
    check(results.corner.med > results.random.med, 'a corner habit beats random play');
    check(results.lookahead.reach(2048) >= 0.5, 'a player who looks ahead makes 2048 in at least half the games');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
