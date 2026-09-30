#!/usr/bin/env node
// Test suite for games/rock_paper_scissors_mp.html (Hands Up).
//
// Runs the page's DOM-free <script id="core"> block in Node. Two phones write to one shared
// match, in whatever order the network delivers, and each works out who won from what it has
// seen. The promises nobody can check from the page: that a throw cannot be read before the other
// player has thrown, that a player cannot change their throw once they have seen the other one,
// and that both phones always agree on the score.
//
//   node test/rock_paper_scissors_mp.mjs                  # everything
//   node test/rock_paper_scissors_mp.mjs protocol cheats  # named suites only
//   node test/rock_paper_scissors_mp.mjs protocol --runs=400
//   node test/rock_paper_scissors_mp.mjs --page=path.html # run against another copy of the page
//
// Suites: core, protocol, cheats, page (page needs Playwright; skipped without it).

import {readFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import {createHash} from 'crypto';
import {createRequire} from 'module';
import {execSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(ROOT, 'games', 'rock_paper_scissors_mp.html'));
const RUNS = +opt('runs', 150);
const ALL = ['core', 'protocol', 'cheats', 'page'];
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
const ctx = vm.createContext({TextEncoder});
vm.runInContext(core[1] + '\nthis.C = HandsCore;', ctx);
const C = ctx.C;
const plain = x => JSON.parse(JSON.stringify(x));
const getPath = (o, key) => key.split('.').reduce((x, k) => x && typeof x === 'object' ? x[k] : undefined, o);
// a throw is sealed with set-if-absent, the way the page writes it
const apply = (doc, w) => w.seal ? (getPath(doc, w.seal[0]) == null ? C.applyUpdate(doc, {[w.seal[0]]: w.seal[1]}) : doc) : C.applyUpdate(doc, w);
const keep = (secrets, u) => { secrets[u.ctx] = [].concat(secrets[u.ctx] || [], u.secret); };

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const T = C.THROWS;

// ---------------------------------------------------------------- core
if (suites.includes('core')) {
    section('core');
    const rnd = mulberry(7);
    let bad = 0, firstBad = '';
    for (let i = 0; i < 3000; i++) {
        let s = '';
        const len = Math.floor(rnd() * 300);
        for (let j = 0; j < len; j++) s += String.fromCodePoint(rnd() < .9 ? 32 + Math.floor(rnd() * 95) : 0x80 + Math.floor(rnd() * 0x1ff00));
        if (C.sha256(s) !== createHash('sha256').update(s, 'utf8').digest('hex')) { bad++; firstBad ||= JSON.stringify(s).slice(0, 80); }
    }
    for (const n of [0, 55, 56, 63, 64, 65, 119, 120, 1000]) {
        const s = 'x'.repeat(n);
        if (C.sha256(s) !== createHash('sha256').update(s).digest('hex')) { bad++; firstBad ||= `length ${n}`; }
    }
    check(bad === 0, 'sha256 equals node:crypto on 3009 strings, block edges and astral characters included', firstBad);
    const table = {rock: {rock: 'tie', paper: 'b', scissors: 'a'}, paper: {rock: 'a', paper: 'tie', scissors: 'b'}, scissors: {rock: 'b', paper: 'a', scissors: 'tie'}};
    check(T.every(a => T.every(b => C.outcome(a, b) === table[a][b])), 'every pairing wins, loses and ties as the rules say');
    check(C.rule('paper', 'rock') === 'Paper wraps rock' && C.rule('rock', 'scissors') === 'Rock blunts scissors' && C.rule('scissors', 'paper') === 'Scissors cut paper',
        'the caption names the winning throw first');
    const c1 = C.commitOf(C.ctxOf('m', 1, 1, 'a'), 'rock', 'n'), c2 = C.commitOf(C.ctxOf('m', 1, 1, 'b'), 'rock', 'n'), c3 = C.commitOf(C.ctxOf('m', 1, 2, 'a'), 'rock', 'n');
    check(c1 !== c2 && c1 !== c3, 'a commitment is bound to its seat and round');
}

// ---------------------------------------------------------------- protocol
// A stand-in server and two phones. Each phone does what the page does: throw into the open round,
// run plan() on every snapshot it sees, ask for a rematch at the end. The network delivers writes
// in per-phone order but interleaves the phones freely, snapshots arrive late, a reload drops
// in-flight writes some of the time, and a careless phone sometimes loses its saved secrets.
function simulate(seed, {target, matches, lossy}) {
    const rnd = mulberry(seed);
    const id = 'sim' + seed;
    let doc = C.newMatch({id: 'pa', name: 'A'}, target, 0);
    doc = C.applyUpdate(doc, {'p.b': {id: 'pb', name: 'B'}});
    const errors = [];
    const sent = {};            // commit hash -> throw, for the reference
    const lost = new Set();     // ctx whose secret was forgotten before its reveal went out
    const phone = seat => ({seat, secrets: {}, view: null, seen: null, out: [], lastPlan: '', pendingKey: null});
    const P = {a: phone('a'), b: phone('b')};
    const invariant = () => {
        // until both commitments are in, a round holds nothing else: no reveal, no forfeit
        for (const [gk, G] of Object.entries(doc.g || {})) for (const [rk, R] of Object.entries((G && G.r) || {})) {
            const both = R && R.a && R.a.c && R.b && R.b.c;
            for (const s of ['a', 'b']) if (!both && R && R[s] && Object.keys(R[s]).some(k => k !== 'c'))
                errors.push(`${gk}/${rk}: seat ${s} wrote ${Object.keys(R[s]).join('+')} before both had thrown`);
        }
    };
    const see = p => { p.seen = plain(doc); p.view = C.derive(p.seen, id); };
    const step = () => {
        const r = rnd();
        const p = P[rnd() < .5 ? 'a' : 'b'];
        if (r < .35 && p.out.length) {                      // a write reaches the server
            doc = apply(doc, p.out.shift()); invariant();
        } else if (r < .6) {                                // a snapshot reaches the phone
            see(p);
            const up = C.plan(p.seen, id, p.seat, p.secrets);
            const k = JSON.stringify(up);
            if (up && k !== p.lastPlan) { p.lastPlan = k; p.out.push(up); }
        } else if (r < .85 && p.view) {                     // the player acts on what they see
            const v = p.view;
            if (v.over) { const up = C.rematchUpdate(v, p.seat); if (up && !p.out.some(o => JSON.stringify(o) === JSON.stringify(up))) p.out.push(up); }
            else if (v.round && v.round.state === 'open' && !v.round.committed[p.seat] && p.pendingKey !== `${v.round.g}/${v.round.r}`) {
                const t = T[Math.floor(rnd() * 3)], nonce = Math.floor(rnd() * 1e12).toString(16);
                const u = C.throwUpdate(v, p.seat, t, nonce);
                if (!u) errors.push('throwUpdate refused an open round');
                else { keep(p.secrets, u); sent[u.seal[1]] = t; p.out.push({seal: u.seal}); p.pendingKey = `${v.round.g}/${v.round.r}`; }
            }
        } else if (r >= .97) {                              // a reload
            if (rnd() < .5) p.out = [];                     // writes still in flight are lost
            if (lossy && rnd() < .3) {
                for (const k of Object.keys(p.secrets)) {
                    const [, g, rr, s] = k.split('/');
                    const R = doc.g && doc.g['g' + g] && doc.g['g' + g].r && doc.g['g' + g].r['r' + rr];
                    if (!(R && R[s] && (R[s].t !== undefined || R[s].x))) lost.add(k);
                }
                p.secrets = {};
            }
            p.view = null; p.seen = null; p.lastPlan = ''; p.pendingKey = null;
        }
    };
    let steps = 0;
    const finished = () => { const v = C.derive(doc, id); return v.over && v.games.length >= matches; };
    while (!finished() && steps < 200000 && !errors.length) { step(); steps++; }
    // let everything settle
    for (let i = 0; i < 50; i++) for (const s of ['a', 'b']) {
        const p = P[s];
        while (p.out.length) { doc = apply(doc, p.out.shift()); invariant(); }
        see(p);
        const up = C.plan(p.seen, id, s, p.secrets);
        if (up && JSON.stringify(up) !== p.lastPlan) { p.lastPlan = JSON.stringify(up); p.out.push(up); }
    }
    const final = C.derive(doc, id);
    // an independent reference: the throws each player made, as the server kept them
    for (const game of final.games) {
        const score = {a: 0, b: 0};
        let winner = null;
        for (const R of game.rounds) {
            if (R.state !== 'done') { if (game.winner) errors.push(`g${game.g}: an unfinished round in a finished match`); break; }
            const raw = doc.g['g' + game.g].r['r' + R.r];
            const t = {a: sent[raw.a.c], b: sent[raw.b.c]};
            const gone = {a: lost.has(C.ctxOf(id, game.g, R.r, 'a')) && raw.a.x === true, b: lost.has(C.ctxOf(id, game.g, R.r, 'b')) && raw.b.x === true};
            const expect = gone.a && gone.b ? 'tie' : gone.a ? 'b' : gone.b ? 'a' : C.outcome(t.a, t.b);
            if (R.winner !== expect) errors.push(`g${game.g} r${R.r}: derived ${R.winner}, expected ${expect} (${t.a} v ${t.b}, lost ${gone.a}/${gone.b})`);
            if (!gone.a && !gone.b && (R.t.a !== t.a || R.t.b !== t.b)) errors.push(`g${game.g} r${R.r}: shows ${R.t.a}/${R.t.b}, thrown ${t.a}/${t.b}`);
            if (R.foul.a && !gone.a || R.foul.b && !gone.b) errors.push(`g${game.g} r${R.r}: an honest phone was called a foul`);
            if (expect !== 'tie') score[expect]++;
            if (score.a >= target || score.b >= target) { winner = score.a >= target ? 'a' : 'b'; break; }
        }
        if (game.winner !== winner && !(game === final.game && !game.winner)) errors.push(`g${game.g}: winner ${game.winner}, expected ${winner}`);
        if (game.winner && Math.max(game.score.a, game.score.b) !== target) errors.push(`g${game.g}: ended at ${game.score.a}-${game.score.b}, target ${target}`);
    }
    for (const s of ['a', 'b']) if (JSON.stringify(P[s].view) !== JSON.stringify(final)) errors.push(`phone ${s} disagrees with the server after settling`);
    const rec = {a: 0, b: 0};
    for (const g of final.games) if (g.winner) rec[g.winner]++;
    if (rec.a !== final.record.a || rec.b !== final.record.b) errors.push('head-to-head record does not count the finished matches');
    return {errors, steps, final, rounds: final.games.reduce((n, g) => n + g.rounds.length, 0), forfeits: lost.size};
}

if (suites.includes('protocol')) {
    section('protocol');
    let bad = 0, first = '', rounds = 0, matches = 0, forfeits = 0, stuck = 0;
    for (let i = 0; i < RUNS; i++) {
        const target = C.TARGETS[i % 3], lossy = i % 4 === 3;
        const r = simulate(1000 + i, {target, matches: 3, lossy});
        rounds += r.rounds; matches += r.final.games.filter(g => g.winner).length; forfeits += r.forfeits;
        if (!r.final.over || r.final.games.length < 3) stuck++;
        if (r.errors.length) { bad++; first ||= `seed ${1000 + i} (first to ${target}${lossy ? ', lossy' : ''}): ${r.errors[0]}`; }
    }
    check(bad === 0, `${RUNS} sessions of three matches under reordering and reloads: no early reveal, both phones agree, every round and match as the reference says`, first);
    check(stuck === 0, 'every session reaches the end of its third match', `${stuck} got stuck`);
    check(forfeits > 0, 'lost secrets were exercised', `${forfeits} forfeits`);
    console.log(`  ${RUNS} sessions, ${matches} matches, ${rounds} rounds, ${forfeits} lost secrets`);
}

// ---------------------------------------------------------------- cheats
if (suites.includes('cheats')) {
    section('cheats');
    const id = 'cheat';
    const base = () => C.applyUpdate(C.newMatch({id: 'pa', name: 'A'}, 3, 0), {'p.b': {id: 'pb', name: 'B'}});
    const commit = (doc, seat, t, n = 'n' + seat) => C.applyUpdate(doc, C.throwUpdate(C.derive(doc, id), seat, t, n).update);
    const sec = (seat, t, n = 'n' + seat) => ({[C.ctxOf(id, 1, 1, seat)]: [{t, n}]});
    const reveal = (doc, seat, secrets) => C.applyUpdate(doc, C.plan(doc, id, seat, secrets));
    const R1 = doc => C.derive(doc, id).games[0].rounds[0];

    let d = commit(base(), 'a', 'paper');
    check(C.plan(d, id, 'a', sec('a', 'paper')) === null, 'an honest phone does not reveal while the other has not thrown');
    const peek = JSON.stringify(d);
    check(!peek.includes('paper') && !peek.includes('"na"'), 'the document holds neither the throw nor the nonce until both have thrown');
    check(C.throwUpdate(C.derive(d, id), 'a', 'rock', 'x') === null, 'a seat cannot throw twice into one round');
    check(C.throwUpdate(C.derive(d, id), 'b', 'lizard', 'x') === null, 'only rock, paper or scissors can be thrown');

    // B copies A's commitment and, once A reveals, A's throw and nonce
    d = commit(base(), 'a', 'paper');
    d = C.applyUpdate(d, {'g.g1.r.r1.b.c': d.g.g1.r.r1.a.c});
    d = reveal(d, 'a', sec('a', 'paper'));
    d = C.applyUpdate(d, {'g.g1.r.r1.b.t': 'paper', 'g.g1.r.r1.b.n': 'na'});
    check(R1(d).winner === 'a' && R1(d).foul.b === 'mismatch', "copying the other seat's sealed throw loses the round");

    // B throws rock, sees A's paper, re-seals scissors and reveals it
    d = commit(commit(base(), 'b', 'rock'), 'a', 'paper');
    d = reveal(d, 'a', sec('a', 'paper'));
    d = C.applyUpdate(d, {'g.g1.r.r1.b.c': C.commitOf(C.ctxOf(id, 1, 1, 'b'), 'scissors', 'z')});
    d = C.applyUpdate(d, {'g.g1.r.r1.b.t': 'scissors', 'g.g1.r.r1.b.n': 'z'});
    check(R1(d).winner === 'a' && R1(d).foul.b === 'swapped', 'changing a sealed throw after the other hand is shown loses the round');

    // B reveals something other than what it sealed
    d = commit(commit(base(), 'a', 'paper'), 'b', 'rock');
    d = reveal(d, 'a', sec('a', 'paper'));
    d = C.applyUpdate(d, {'g.g1.r.r1.b.t': 'scissors', 'g.g1.r.r1.b.n': 'nb'});
    check(R1(d).winner === 'a' && R1(d).foul.b === 'mismatch', 'a reveal that does not match its seal loses the round');

    // a second throw into the same round, from a phone that reloaded before its first arrived
    d = base();
    const u1 = C.throwUpdate(C.derive(d, id), 'b', 'rock', 'n1'), u2 = C.throwUpdate(C.derive(d, id), 'b', 'scissors', 'n2');
    const both = {}; keep(both, u1); keep(both, u2);
    d = apply(apply(d, {seal: u1.seal}), {seal: u2.seal});
    d = commit(d, 'a', 'paper');
    d = reveal(reveal(d, 'a', sec('a', 'paper')), 'b', both);
    check(R1(d).t.b === 'rock' && R1(d).winner === 'a' && !R1(d).foul.b, 'when a phone throws twice, the first sealed throw stands and is opened honestly');

    // one seat lost its secret, then both
    d = commit(commit(base(), 'a', 'paper'), 'b', 'rock');
    const f = C.plan(d, id, 'b', {});
    check(f && f['g.g1.r.r1.b.x'] === true, 'a phone without its secret forfeits instead of guessing');
    d = reveal(C.applyUpdate(d, f), 'a', sec('a', 'paper'));
    check(R1(d).winner === 'a', 'a forfeit gives the round to the other seat, whatever was thrown');
    d = commit(commit(base(), 'a', 'paper'), 'b', 'rock');
    d = C.applyUpdate(C.applyUpdate(d, C.plan(d, id, 'a', {})), C.plan(d, id, 'b', {}));
    check(R1(d).winner === 'tie' && C.derive(d, id).round.r === 2, 'two forfeits replay the round');

    // a half-revealed round shows nothing yet
    d = reveal(commit(commit(base(), 'a', 'paper'), 'b', 'rock'), 'a', sec('a', 'paper'));
    check(R1(d).state === 'reveal' && R1(d).t.a === null, 'one reveal alone does not show that hand');

    // rematches
    d = base();
    for (let r = 1; r <= 3; r++) {
        const v = C.derive(d, id), ctxA = C.ctxOf(id, 1, r, 'a'), ctxB = C.ctxOf(id, 1, r, 'b');
        d = C.applyUpdate(d, C.throwUpdate(v, 'a', 'rock', 'x').update);
        d = C.applyUpdate(d, C.throwUpdate(C.derive(d, id), 'b', 'scissors', 'y').update);
        d = C.applyUpdate(d, C.plan(d, id, 'a', {[ctxA]: [{t: 'rock', n: 'x'}]}));
        d = C.applyUpdate(d, C.plan(d, id, 'b', {[ctxB]: [{t: 'scissors', n: 'y'}]}));
    }
    let v = C.derive(d, id);
    check(v.over && v.game.winner === 'a' && v.game.score.a === 3 && v.record.a === 1, 'a match ends the moment a seat reaches its target');
    check(C.throwUpdate(v, 'b', 'rock', 'q') === null, 'no throw is taken after the match is over');
    d = C.applyUpdate(d, C.rematchUpdate(v, 'b'));
    v = C.derive(d, id);
    check(v.over && v.games.length === 1 && C.rematchUpdate(v, 'b') === null, 'one rematch request alone starts nothing, and is only asked once');
    d = C.applyUpdate(d, C.rematchUpdate(v, 'a'));
    v = C.derive(d, id);
    check(!v.over && v.games.length === 2 && v.round.r === 1 && v.record.a === 1, 'both asking starts match two and keeps the head-to-head');

    // garbage the shared document could hold
    const rnd = mulberry(99);
    const junk = depth => {
        const r = rnd();
        if (depth > 4 || r < .3) return [null, 1, -3, 'x', true, '', 'rock', '0'.repeat(64), [], {}][Math.floor(rnd() * 10)];
        const o = {};
        for (const k of ['v', 't', 'p', 'a', 'b', 'g', 'g1', 'g2', 'r', 'r1', 'r2', 'c', 'n', 'x', 'saw', 'again', 'hb', '__proto__', 'constructor'].filter(() => rnd() < .35)) o[k] = junk(depth + 1);
        return o;
    };
    let threw = 0, firstErr = '';
    for (let i = 0; i < 3000; i++) {
        try {
            const v = C.derive(junk(0), 'j');
            if (v.game.score.a > v.target || v.game.score.b > v.target) throw new Error('score past the target');
            C.plan(junk(0), 'j', 'a', {}); C.seatOf(v, 'pa');
        } catch (e) { threw++; firstErr ||= e.message; }
    }
    check(threw === 0, '3000 malformed documents derive without throwing', firstErr);
}

// ---------------------------------------------------------------- page
if (suites.includes('page')) {
    section('page');
    let chromium = null;
    try { ({chromium} = await import('playwright')); } catch (e) {
        try { chromium = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright').chromium; } catch (e2) { }
    }
    if (!chromium) console.log('  skipped: Playwright is not installed');
    else await pageSuite(chromium);
}

async function pageSuite(chromium) {
    const ORIGIN = 'http://hands.test';
    const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml'};
    const docs = new Map(), pages = new Set(), errors = [];
    const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const push = id => { for (const p of pages) if (p.__watch.has(id)) p.evaluate(([i, d]) => window.__netPush(i, d), [id, docs.get(id)]).catch(() => {}); };
    // the page's five network calls, answered from memory in Node
    const INIT = `window.HANDS_NET = (() => { const subs = {};
        window.__netPush = (id, doc) => (subs[id] || []).slice().forEach(f => f(doc));
        return { create: (id, d) => window.__net('create', id, d), get: id => window.__net('get', id),
            watch: (id, cb) => { (subs[id] ||= []).push(cb); window.__net('watch', id).then(d => cb(d)); return () => { subs[id] = subs[id].filter(f => f !== cb); }; },
            update: (id, f) => window.__net('update', id, f), seal: (id, k, v) => window.__net('seal', id, k, v),
            claim: (id, seat, p) => window.__net('claim', id, seat, p) }; })();`;
    async function player(name, phone = true) {
        const context = await browser.newContext(phone ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true} : {viewport: {width: 1280, height: 800}});
        await context.route('**/*', route => {
            const u = new URL(route.request().url());
            if (u.origin !== ORIGIN) return route.abort();
            const f = join(ROOT, decodeURIComponent(u.pathname));
            if (u.pathname === '/games/rock_paper_scissors_mp.html') return route.fulfill({body: readFileSync(PAGE), contentType: 'text/html'});
            return existsSync(f) ? route.fulfill({body: readFileSync(f), contentType: MIME[extname(f)] || 'application/octet-stream'}) : route.fulfill({status: 404});
        });
        await context.addInitScript(INIT);
        const page = await context.newPage();
        page.__watch = new Set();
        page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
        await page.exposeBinding('__net', async (_s, op, id, a, b) => {
            await sleep(15);
            if (op === 'create') { docs.set(id, plain(a)); push(id); return null; }
            if (op === 'get') return docs.get(id) ?? null;
            if (op === 'watch') { page.__watch.add(id); return docs.get(id) ?? null; }
            if (op === 'update') { docs.set(id, C.applyUpdate(docs.get(id), a)); push(id); return null; }
            if (op === 'seal') { docs.set(id, apply(docs.get(id), {seal: [a, b]})); push(id); return null; }
            if (op === 'claim') { const d = docs.get(id); if (!d) return null; if (!d.p[a]) { docs.set(id, C.applyUpdate(d, {['p.' + a]: b})); push(id); } return docs.get(id); }
        });
        pages.add(page);
        return page;
    }
    const url = ORIGIN + '/games/rock_paper_scissors_mp.html';
    const screen = p => p.evaluate(() => document.querySelector('.screen.on')?.id);
    const idle = p => p.waitForFunction(() => !document.querySelector('.pick:disabled') || document.getElementById('game').classList.contains('over'), null, {timeout: 15000});
    try {
        const A = await player('A'), B = await player('B', false);
        await A.goto(url);
        check(await screen(A) === 'home', 'a first visit lands on the start screen');
        await A.click('#newGo');
        check(await A.evaluate(() => document.activeElement.id) === 'newName', 'starting without a name asks for one instead');
        await A.fill('#newName', 'Mara'); await A.click('#newGo');
        await A.waitForFunction(() => location.search.startsWith('?m='));
        await sleep(300);
        check(await screen(A) === 'game', 'Start opens the match with its own link');
        const link = A.url(), id = new URL(link).searchParams.get('m');
        await A.click('.pick[data-t="paper"]');
        await sleep(200);
        check(await A.evaluate(() => document.getElementById('invite').classList.contains('on')), 'after the first throw the invite takes the tray');
        check(!JSON.stringify(docs.get(id)).includes('paper'), 'the shared match does not hold the throw');

        await B.goto(link);
        await sleep(300);
        check(await screen(B) === 'join', 'the link offers the friend a seat');
        check(await B.evaluate(() => !document.querySelector('#fOp .hand, #fMe .hand:not(.ghost)')), "the friend's page shows no hand of Mara's before throwing");
        await B.fill('#joinName', 'Sam'); await B.click('#joinGo');
        await B.waitForFunction(() => document.querySelector('.screen.on')?.id === 'game');
        await B.click('.pick[data-t="rock"]');
        await idle(A); await idle(B);
        check(await A.textContent('#sMe') === '1' && await B.textContent('#sOp') === '1', 'paper beats rock on both screens');

        // Sam throws, then reloads before Mara has thrown: the sealed throw must survive
        await B.click('.pick[data-t="scissors"]');
        await sleep(150);
        await B.reload(); await sleep(400);
        check(await screen(B) === 'game' && await B.evaluate(() => document.querySelector('.pick.chosen')?.dataset.t) === 'scissors', 'a reload keeps a sealed throw and shows it');
        await A.click('.pick[data-t="paper"]');
        await idle(A); await idle(B);
        check(await A.textContent('#sOp') === '1' && await B.textContent('#sMe') === '1', 'the throw made before the reload is revealed after it');

        for (let k = 0; k < 2; k++) {
            await A.click('.pick[data-t="scissors"]'); await B.click('.pick[data-t="paper"]');
            await idle(A); await idle(B);
        }
        await A.waitForFunction(() => document.getElementById('sheet').classList.contains('on'), null, {timeout: 8000});
        check(await A.textContent('#rTitle') === 'You win!' && await B.textContent('#rTitle') === 'Mara wins', 'the match ends at 3 with a result on both sides');
        await B.click('#again'); await sleep(250);
        check((await A.textContent('#again')).includes('Sam wants a rematch'), 'a rematch request shows on the other phone');
        await A.click('#again');
        await A.waitForFunction(() => !document.getElementById('sheet').classList.contains('on'), null, {timeout: 8000});
        check(await A.textContent('#sMe') === '0' && (await A.textContent('#gRound')).includes('Match 2'), 'both asking starts match two at 0-0');

        const Z = await player('Z');
        await Z.goto(link); await sleep(400);
        check(await screen(Z) === 'note' && (await Z.textContent('#nTitle')).includes('taken'), 'a third visitor is told the match is taken');
        await Z.goto(url + '#abc123xyz'); await sleep(900);
        check(await screen(Z) === 'home' && (await Z.textContent('#toast')).includes('old version'), 'a link from the old page lands on the start screen with a note');
        await A.click('#gHome'); await sleep(600);
        check(await A.evaluate(() => document.getElementById('recentList').textContent.includes('vs Sam')), 'the start screen lists the match to come back to');
    } catch (e) { fail('page flow', e.message.split('\n')[0]); }
    check(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));
    await browser.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
