#!/usr/bin/env node
// Test suite for games/connect_four.html.
//
// The page's computer opponent is a search: negamax with alpha-beta, a transposition table,
// history ordering and a narrowed root window. Every one of those is a way to prune a move
// that should have been looked at, and a pruning bug does not crash - it just plays a worse
// move, which nobody can tell from the page. So this runs the page's own AI block in Node
// and checks it against things that are certain. No browser, no server.
//
//   node test/connect_four.mjs                  # everything
//   node test/connect_four.mjs search           # named suites only
//   node test/connect_four.mjs --page=path.html # run against another copy of the page
//
// Suites:
//   search   - the pruned search returns exactly what plain minimax does on random positions
//   tactics  - every level takes a win, blocks a single threat, never plays under the
//              opponent's winning cell when another move exists, and always answers legally

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'connect_four.html');
const ALL = ['search', 'tactics'];
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

// The AI is the block from `const AI_LEVELS` to `function getAIMove()`; it touches no DOM.
// A plain-minimax twin is spliced in beside it so both see the same board and evaluation.
const HTML = readFileSync(PAGE, 'utf8');
const from = HTML.indexOf('  const AI_LEVELS'), to = HTML.indexOf('  function getAIMove()');
if (from < 0 || to < 0) {
    console.log('could not find the AI block (const AI_LEVELS ... function getAIMove) in ' + PAGE);
    process.exit(1);
}
const EXPORT = 'return { chooseMove };';
let src = HTML.slice(from, to);
if (!src.includes(EXPORT)) {
    console.log('the AI block no longer ends in `' + EXPORT + '`; update the test');
    process.exit(1);
}
src = src.replace(EXPORT, `
    function minimax(depth, p, ply) {
      const o = 3 - p;
      for (let c = 0; c < 7; c++) if (winningCol(c, p)) return WIN - ply;
      if (moves === 42) return 0;
      const threats = [];
      for (let c = 0; c < 7; c++) if (winningCol(c, o)) threats.push(c);
      if (threats.length > 1) return -(WIN - ply - 1);
      if (depth <= 0) return evaluate(p);
      let best = -Infinity;
      for (const c of threats.length ? threats : ORDER) {
        if (height[c] >= 6) continue;
        let v;
        if (height[c] < 5 && completes(c * 6 + height[c] + 1, o)) v = -(WIN - ply - 2);
        else { play(c, p); v = -minimax(depth - 1, o, ply + 1); unplay(c); }
        if (v > best) best = v;
      }
      return best;
    }
    return {
      chooseMove, load, minimax,
      pruned: (depth, p) => { deadline = Infinity; return negamax(depth, -Infinity, Infinity, p, 0); },
      root: (depth, p, narrow) => { deadline = Infinity; return scoreRoot(depth, p, null, narrow); }
    };`);
const {ai, AI_LEVELS} = new Function(src + '\nreturn { ai, AI_LEVELS };')();
const LEVELS = Object.keys(AI_LEVELS);

// --- helpers: the page's board is game.board[row][col], row 0 at the bottom ---------------
function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const empty = () => Array.from({length: 6}, () => Array(7).fill(null));
const drop = (bd, c) => { for (let r = 0; r < 6; r++) if (bd[r][c] === null) return r; return -1; };
function wins(bd, p) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++)
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            let k = 0;
            for (; k < 4; k++) {
                const rr = r + k * dr, cc = c + k * dc;
                if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || bd[rr][cc] !== p) break;
            }
            if (k === 4) return true;
        }
    return false;
}
const other = p => p === 'red' ? 'yellow' : 'red';
// A random legal position nobody has won yet, and whose turn it is (red always starts).
function randomPosition(rnd, moves) {
    for (;;) {
        const bd = empty();
        let p = 'red', done = false;
        for (let i = 0; i < moves && !done; i++) {
            const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => drop(bd, c) >= 0);
            const c = cols[Math.floor(rnd() * cols.length)];
            bd[drop(bd, c)][c] = p;
            done = wins(bd, p);
            p = other(p);
        }
        if (!done) return [bd, p];
    }
}
const legal = bd => [0, 1, 2, 3, 4, 5, 6].filter(c => drop(bd, c) >= 0);
function winsWith(bd, c, p) {
    const r = drop(bd, c);
    if (r < 0) return false;
    bd[r][c] = p;
    const w = wins(bd, p);
    bd[r][c] = null;
    return w;
}
// Does playing c let the opponent win on the very next move?
function handsOver(bd, c, p) {
    const r = drop(bd, c);
    bd[r][c] = p;
    const bad = !wins(bd, p) && legal(bd).some(k => winsWith(bd, k, other(p)));
    bd[r][c] = null;
    return bad;
}
const show = bd => bd.slice().reverse().map(row => row.map(v => v ? v[0] : '.').join('')).join('/');

// --- suites ------------------------------------------------------------------------------
function suiteSearch() {
    section('search');
    const rnd = mulberry(1);
    let n = 0, bad = 0, rootBad = 0;
    for (let t = 0; t < 400; t++) {
        const [bd, player] = randomPosition(rnd, 4 + Math.floor(rnd() * 22));
        const p = player === 'red' ? 1 : 2, depth = 1 + (t % 5);
        ai.load(bd);
        const want = ai.minimax(depth, p, 0);
        ai.load(bd);
        const got = ai.pruned(depth, p);
        n++;
        if (got !== want && bad++ < 3) fail(`alpha-beta at depth ${depth}`, `${show(bd)}: pruned ${got}, minimax ${want}`);

        // The narrowed root may leave losing moves as bounds, but the best score and every
        // move that reaches it must come back exact.
        ai.load(bd);
        const full = ai.root(depth, p, false);
        ai.load(bd);
        const narrow = ai.root(depth, p, true);
        const top = s => Math.max(...s.map(x => x.score));
        const best = s => s.filter(x => x.score === top(s)).map(x => x.col).sort().join();
        if ((top(full) !== top(narrow) || best(full) !== best(narrow)) && rootBad++ < 3)
            fail(`narrow root window at depth ${depth}`, `${show(bd)}: full ${JSON.stringify(full)} narrow ${JSON.stringify(narrow)}`);
    }
    check(bad === 0, `pruned search matches plain minimax on ${n} positions`, `${bad} mismatches`);
    check(rootBad === 0, `narrowed root finds the same best moves on ${n} positions`, `${rootBad} mismatches`);
}

function suiteTactics() {
    section('tactics');
    const rnd = mulberry(2);
    const tally = {};
    for (const level of LEVELS) tally[level] = {take: 0, block: 0, under: 0, illegal: 0, cases: 0};
    for (let t = 0; t < 250; t++) {
        const [bd, p] = randomPosition(rnd, 6 + Math.floor(rnd() * 30));
        const cols = legal(bd);
        if (!cols.length) continue;
        const winning = cols.filter(c => winsWith(bd, c, p));
        const threats = cols.filter(c => winsWith(bd, c, other(p)));
        const safe = cols.filter(c => !handsOver(bd, c, p));
        for (const level of LEVELS) {
            const c = ai.chooseMove(bd, p, level), s = tally[level];
            s.cases++;
            if (!cols.includes(c)) { s.illegal++; continue; }
            if (winning.length) { if (!winning.includes(c)) s.take++; continue; }
            if (threats.length === 1 && c !== threats[0]) s.block++;
            if (safe.length && !safe.includes(c)) s.under++;
        }
    }
    for (const level of LEVELS) {
        const s = tally[level];
        check(s.illegal === 0, `${level}: always plays a legal column (${s.cases} positions)`, `${s.illegal} illegal`);
        check(s.take === 0, `${level}: takes a win when one is on the board`, `${s.take} missed`);
        check(s.block === 0, `${level}: blocks a single threat`, `${s.block} not blocked`);
        check(s.under === 0, `${level}: never hands over a win another move would avoid`, `${s.under} times`);
    }

    // A full board but one column: the only move.
    const bd = empty();
    const fill = 'rryyrry' + 'yyrryyr' + 'rryyrry' + 'yyrryyr' + 'rryyrry' + 'yyrryy.';
    for (let i = 0; i < 42; i++) if (fill[i] !== '.') bd[Math.floor(i / 7)][i % 7] = fill[i] === 'r' ? 'red' : 'yellow';
    for (const level of LEVELS)
        check(ai.chooseMove(bd, 'yellow', level) === 6, `${level}: finds the last empty column`);
}

const RUN = {search: suiteSearch, tactics: suiteTactics};
for (const s of suites) {
    if (!RUN[s]) { console.log(`unknown suite "${s}" (have: ${ALL.join(', ')})`); process.exit(1); }
    RUN[s]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
