#!/usr/bin/env node
// Test suite for games/family_feud.html (We Asked 100).
//
// Runs the page's DOM-free <script id="core"> block in Node. The game's promises: a typed answer is read the
// way a person means it (and never as an answer it does not mean), every survey on the board is fair, the
// rules of the face-off, the strikes and the steal are the show's, every point is accounted for, and the
// Hendersons play like a family - better when they know more, and beatable. No browser, no server.
//
//   node test/family_feud.mjs                 # everything
//   node test/family_feud.mjs match rules     # named suites only
//   node test/family_feud.mjs --page=path.html
//
// Suites: match, bank, rules, games, bots, daily.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'family_feud.html'));
const ALL = ['match', 'bank', 'rules', 'games', 'bots', 'daily'];
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
vm.runInContext(core[1] + '\nthis.F = FEUD;', ctx);
const F = ctx.F;
const rng = F.mulberry(20261006);
const pick = a => a[Math.floor(rng() * a.length)];

// a stacked survey: six answers, 40 down to 5
const mk = (q, list) => ({q, a: list.map(([name, pct, also]) => ({name, pct, also: also || []}))});
const STACK = mk('Name something you find in a kitchen drawer', [['Spoons', 40, ['spoon']], ['Forks', 22], ['Knives', 15, ['knife']], ['Hot dog', 9, ['hotdog']], ['Ice cream', 8, ['icecream']], ['Batteries', 5, ['battery']]]);
const surveys = n => Array.from({length: n}, (_, i) => ({...STACK, q: STACK.q + ' ' + i}));
const fresh = (mode = 'duo', seed = 's') => F.begin({mode, surveys: surveys(4), seed});
const say = (s, team, text) => F.act(s, team, {text});
const total = s => s.rev.reduce((t, i) => t + F.board(s)[i].pct * F.mult(s.r), 0);

if (suites.includes('match')) {
    section('match: a typed answer is read the way it is meant');
    const M = g => { const m = F.match(g, STACK.a); return m ? m.idx : -1; };
    for (const [g, want] of [['spoons', 0], ['Spoon', 0], ['  SPOONS!  ', 0], ['a spoon', 0], ['the spoons', 0], ['forks', 1], ['fork', 1], ['knife', 2], ['knives', 2],
        ['I would say forks', 1], ['hotdog', 3], ['hot dog', 3], ['hot-dogs', 3], ['icecream', 4], ['ice cream', 4], ['ice-cream', 4], ['batteries', 5], ['battery', 5],
        ['sppons', 0], ['spons', 0], ['kinves', 2], ['battrey', 5], ['bateries', 5], ['SPOONS', 0], ['Spoons & forks', 0]])
        check(M(g) === want, `"${g}" means answer ${want}`, `got ${M(g)}`);
    for (const g of ['dog', 'cream', 'ice', 'hot', 'banana', 'a', '', '  ', '?!', 'forest', 'spooky', 'bat', 'kn', 'cat', 'hammer', 'sponge'])
        check(M(g) === -1, `"${g}" means nothing on this board`, `got ${M(g)}`);
    // "dog" is not "hot dog" unless the survey says so
    check(F.match('dog', mk('Q', [['Hot dog', 30], ['Pizza', 20], ['Tacos', 10], ['Sushi', 5]]).a) == null, 'one word of a two-word answer is not the answer');
    check(F.match('hot', mk('Q', [['Hot dog', 30], ['Pizza', 20], ['Tacos', 10], ['Sushi', 5]]).a) == null, 'the other word is not either');
    // ties go to the higher answer
    const tie = F.match('cat', mk('Q', [['Cat', 30], ['Cats', 20, ['cat']], ['Bat', 10], ['Rat', 5]]).a);
    check(tie && tie.idx === 0, 'an exact match on two answers goes to the higher one');
    // an exact word beats a typo of another
    const ex = F.match('forks', mk('Q', [['Forts', 30], ['Forks', 20], ['Bark', 10], ['Rock', 5]]).a);
    check(ex && ex.idx === 1, 'an exact answer beats a near miss');
    check(F.match('café', mk('Q', [['Cafe', 30], ['Bar', 20], ['Tea', 10], ['Pub', 5]]).a)?.idx === 0, 'accents do not matter');
    check(F.match('don\'t know', mk('Q', [['Dont know', 30], ['Bar', 20], ['Tea', 10], ['Pub', 5]]).a)?.idx === 0, 'apostrophes do not matter');
    check(F.match('😀😀', STACK.a) == null, 'emoji mean nothing');
    check(F.match('x'.repeat(5000), STACK.a) == null, 'a very long guess is not an answer and does not hang');
}

if (suites.includes('bank')) {
    section('bank: every survey is fair');
    const bank = F.bank;
    check(bank.length >= 50, `at least 50 surveys (${bank.length})`);
    const qs = new Set();
    bank.forEach((s, bi) => {
        const tag = `[${bi}] ${s.q}`;
        check(!qs.has(s.q), `${tag}: question is new`); qs.add(s.q);
        check(/^Name /.test(s.q), `${tag}: starts with "Name"`);
        const sum = s.a.reduce((t, a) => t + a.pct, 0);
        check(s.a.length >= 4 && s.a.length <= 8, `${tag}: 4 to 8 answers`, String(s.a.length));
        check(sum <= 100 && sum >= 80, `${tag}: counts add up to 80-100`, String(sum));
        check(s.a.every((a, i) => !i || s.a[i - 1].pct >= a.pct), `${tag}: high to low`);
        check(s.a[0].pct >= 15, `${tag}: a top answer worth finding`);
        check(s.a.every(a => a.pct >= 1 && a.name.length <= 28), `${tag}: sane answers`);
        s.a.forEach((a, i) => {
            for (const n of [a.name, ...a.also]) {
                const m = F.match(n, s.a);
                check(m && m.idx === i, `${tag}: "${n}" means "${a.name}"`, `got ${m ? s.a[m.idx].name : 'nothing'}`);
            }
        });
        const cleaned = F.clean(s);
        check(cleaned && cleaned.a.length === s.a.length, `${tag}: passes the same check the AI's surveys do`);
    });
}

if (suites.includes('rules')) {
    section('rules: face-off');
    let s = fresh();
    check(s.phase === 'faceoff' && s.first === 0 && s.turn === 0, 'round one opens on a face-off, team 0 first');
    let r = say(s, 1, 'spoons'); check(r.ev[0].t === 'refused' && r.s === s, 'the wrong team cannot say anything');
    r = say(s, 0, '   '); check(r.ev[0].t === 'refused', 'nothing typed is not a guess');
    r = say(s, 0, 'forks'); s = r.s;
    check(r.ev.some(e => e.t === 'reveal' && e.idx === 1) && s.bank === 22 && s.turn === 1, 'a hit is revealed, banked, and the other team is up');
    r = say(s, 1, 'forks'); check(r.ev[0].t === 'repeat' && r.s === s, 'the second team cannot repeat the first team\'s answer');
    r = say(s, 1, 'spoon'); s = r.s;
    check(s.phase === 'play' && s.control === 1 && s.turn === 1, 'the higher answer wins control');
    check(s.bank === 62 && s.rev.length === 2, 'both face-off answers are in the bank', JSON.stringify([s.bank, s.rev]));
    check(r.ev.some(e => e.t === 'control' && e.team === 1), 'control is announced');

    let top = say(fresh(), 0, 'spoons');
    check(top.s.phase === 'play' && top.s.control === 0 && top.s.turn === 0 && top.s.bank === 40 && top.ev.some(e => e.t === 'control' && e.top), 'the top answer wins the face-off at once, the other team never answers');
    top = say(say(fresh(), 0, 'forks').s, 1, 'spoons');
    check(top.s.control === 1, 'the second team can still win it with the top answer');
    s = fresh(); s = say(s, 0, 'pizza').s; check(s.phase === 'faceoff' && s.turn === 1 && s.strikes === 0, 'a face-off miss costs no strike');
    r = say(s, 1, 'knife'); s = r.s; check(s.control === 1 && s.bank === 15, 'one hit wins control');
    s = fresh(); s = say(s, 0, 'zzz').s; s = say(s, 1, 'qqq').s;
    check(s.phase === 'faceoff' && s.turn === 0 && s.fo.tries === 1, 'both miss: they go again');
    s = say(s, 0, 'zzz').s; r = say(s, 1, 'qqq'); s = r.s;
    check(s.phase === 'play' && s.control === 1 && s.bank === 0, 'both miss twice: control goes to the team that did not start');

    section('rules: strikes, steal, clearing the board');
    s = fresh(); s = say(s, 0, 'spoons').s; s = say(s, 0, 'forks').s;
    check(s.control === 0 && s.turn === 0, 'team 0 has control');
    r = say(s, 0, 'banana'); s = r.s; check(s.strikes === 1 && r.ev.some(e => e.t === 'strike' && e.n === 1) && s.phase === 'play', 'a miss is a strike');
    r = say(s, 0, 'spoons'); check(r.ev[0].t === 'repeat' && r.s.strikes === 1, 'an answer already up is not a strike');
    s = say(s, 0, 'knife').s; check(s.bank === 77 && s.strikes === 1, 'a hit after a strike still banks');
    s = say(s, 0, 'banana').s; r = say(s, 0, 'apple'); s = r.s;
    check(s.phase === 'steal' && s.turn === 1 && s.strikes === 3, 'three strikes hand over a steal', JSON.stringify([s.phase, s.turn, s.strikes]));
    check(r.ev.some(e => e.t === 'steal' && e.team === 1), 'the steal is announced');
    const before = s;
    r = say(s, 1, 'spoons'); check(r.ev[0].t === 'repeat' && r.s === before, 'a steal cannot repeat an answer already up');
    r = say(s, 0, 'hot dog'); check(r.ev[0].t === 'refused', 'the family that struck out cannot answer the steal');
    let st = say(s, 1, 'hotdog'); let e = st.s;
    check(e.phase === 'roundEnd' && e.winner === 1 && e.scores[1] === 77 + 9 && e.scores[0] === 0, 'a good steal takes the whole bank plus the stolen answer', JSON.stringify(e.scores));
    check(st.ev.some(x => x.t === 'sweep' && x.idxs.join() === '4,5') && st.ev.some(x => x.t === 'award' && x.team === 1 && x.pts === 86), 'the rest of the board is swept up and the points awarded');
    st = say(s, 1, 'banana'); e = st.s;
    check(e.phase === 'roundEnd' && e.winner === 0 && e.scores[0] === 77 && e.scores[1] === 0, 'a failed steal leaves the bank with the family in control');
    // clearing the board
    s = fresh(); s = say(s, 0, 'spoons').s; s = say(s, 0, 'forks').s;
    for (const g of ['knife', 'hotdog', 'icecream']) s = say(s, 0, g).s;
    check(s.phase === 'play', 'one answer left: still playing');
    r = say(s, 0, 'batteries'); s = r.s;
    check(s.phase === 'roundEnd' && s.winner === 0 && s.scores[0] === 99 && r.ev.some(x => x.t === 'clear'), 'finding the last answer clears the board and wins it', JSON.stringify(s.scores));
    check(F.act(s, 0, {text: 'spoons'}).ev[0].t === 'refused', 'nobody can answer once the round is over');

    section('rules: rounds, multipliers, the end');
    s = fresh(); s = say(s, 0, 'spoons').s; s = say(s, 0, 'forks').s;
    for (const g of ['knife', 'hotdog', 'icecream', 'batteries']) s = say(s, 0, g).s;
    s = F.next(s);
    check(s.r === 1 && s.phase === 'faceoff' && s.first === 1 && s.turn === 1 && s.bank === 0 && s.rev.length === 0 && s.strikes === 0, 'next round: new face-off, the other team starts, nothing carried');
    check(s.scores[0] === 99, 'scores carry over');
    const play = (s, a, b) => { s = say(s, s.first, a).s; s = say(s, s.first, b).s; return s; };
    // round 3 is double
    let t = fresh();
    for (let k = 0; k < 2; k++) { t = play(t, 'spoons', 'forks'); for (const g of ['knife', 'hotdog', 'icecream', 'batteries']) t = say(t, t.control, g).s; t = F.next(t); }
    check(t.r === 2 && F.mult(2) === 2, 'round three is double');
    t = say(t, t.first, 'spoons').s;
    check(t.bank === 80, 'a double round banks double', String(t.bank));
    t = say(t, t.first, 'forks').s;
    for (const g of ['knife', 'hotdog', 'icecream', 'batteries']) t = say(t, t.control, g).s;
    check(t.scores[t.control] - 0 >= 198, 'and awards double');
    t = F.next(t); check(t.r === 3 && F.mult(3) === 3, 'round four is triple');
    t = play(t, 'spoons', 'forks'); for (const g of ['knife', 'hotdog', 'icecream', 'batteries']) t = say(t, t.control, g).s;
    check(t.phase === 'roundEnd', 'the last round ends like the others');
    const done = F.next(t); check(done.phase === 'final', 'after round four comes the result');
    check(F.next(done).phase === 'final', 'and nothing comes after that');
    check(F.result({scores: [5, 5]}) === 'tie' && F.result({scores: [6, 5]}) === 0 && F.result({scores: [5, 6]}) === 1, 'the result names the winner or a tie');
}

function randomGame(seed, mode, bank, skillOf, chooser) {
    let s = F.begin({mode, surveys: F.ordinary(bank, seed, 4), seed}), steps = 0;
    const log = [];
    while (s.phase !== 'final') {
        if (++steps > 400) return {bad: 'did not finish', s};
        if (s.phase === 'roundEnd') { log.push(s); s = F.next(s); continue; }
        const team = s.turn, board = F.board(s);
        const g = chooser(s, team);
        const r = F.act(s, team, g, skillOf ? skillOf(team) : undefined);
        const before = s;
        if (r.ev.length === 1 && ['repeat', 'refused'].includes(r.ev[0].t)) { if (r.s !== before) return {bad: 'a refused guess changed the state', s}; continue; }
        s = r.s;
        // invariants after every guess
        if (new Set(s.rev).size !== s.rev.length) return {bad: 'an answer was revealed twice', s};
        if (s.bank !== total(s)) return {bad: `bank ${s.bank} != revealed ${total(s)}`, s};
        if (s.strikes > F.STRIKES) return {bad: 'too many strikes', s};
    }
    return {s, rounds: log};
}
const names = s => F.board(s).map(a => a.name);
const mixed = (s, team) => {
    const b = F.board(s), open = b.map((a, i) => i).filter(i => !s.rev.includes(i)), x = rng();
    if (x < .55 && open.length) return {text: pick([b[pick(open)].name, ...b[pick(open)].also]) };
    if (x < .65 && s.rev.length) return {text: b[pick(s.rev)].name};
    if (x < .75) return {text: ''};
    if (x < .85) return {bot: true};
    return {text: pick(['banana', 'xyzzy', 'my aunt', 'zebra', 'cheese'])};
};

if (suites.includes('games')) {
    section('games: thousands of whole matches add up');
    let bad = 0, n = 0;
    for (let i = 0; i < 250; i++) {
        const g = randomGame('g' + i, i % 2 ? 'solo' : 'duo', F.bank, null, mixed); n++;
        if (g.bad) { bad++; if (bad < 4) fail('random match ' + i, g.bad); continue; }
        // every point went to someone: the scores are the banks of the rounds, summed
        const banks = g.rounds.map(r => r.bank);
        const sum = banks.reduce((a, b) => a + b, 0);
        if (g.s.scores[0] + g.s.scores[1] !== sum) { bad++; if (bad < 4) fail('random match ' + i, `scores ${g.s.scores} vs banks ${banks}`); }
        if (g.rounds.length !== 4 || g.rounds.some(r => r.winner == null)) { bad++; if (bad < 4) fail('random match ' + i, 'a round has no winner'); }
    }
    check(bad === 0, `${n} matches: every guess consistent, every bank and score accounted for`);

    // a saved match, loaded at any moment, carries on exactly
    let diff = 0;
    for (let i = 0; i < 60; i++) {
        const surv = F.ordinary(F.bank, 'save' + i, 4);
        let a = F.begin({mode: 'solo', surveys: surv, seed: 's' + i}), b = JSON.parse(JSON.stringify(a)), k = 0;
        const rnd2 = F.mulberry(i + 1);
        while (a.phase !== 'final' && k++ < 300) {
            if (a.phase === 'roundEnd') { a = F.next(a); b = F.next(b); b = JSON.parse(JSON.stringify(b)); continue; }
            const bd = F.board(a), open = bd.map((x, j) => j).filter(j => !a.rev.includes(j));
            const g = a.turn === 1 || rnd2() < .3 ? {bot: true} : {text: open.length && rnd2() < .7 ? bd[open[Math.floor(rnd2() * open.length)]].name : 'banana'};
            const ra = F.act(a, a.turn, g), rb = F.act(b, b.turn, g);
            if (JSON.stringify(ra.s) !== JSON.stringify(rb.s) || ra.said !== rb.said) { diff++; break; }
            a = ra.s; b = JSON.parse(JSON.stringify(rb.s));
        }
    }
    check(diff === 0, 'a match saved and reloaded after every move carries on move for move');
    // a match is the same every time from the same seed
    const x = randomGame('same', 'solo', F.bank, null, (s, t) => t === 1 ? {bot: true} : {text: F.board(s)[0].name}), y = randomGame('same', 'solo', F.bank, null, (s, t) => t === 1 ? {bot: true} : {text: F.board(s)[0].name});
    check(JSON.stringify(x.s) === JSON.stringify(y.s), 'a seed deals one match, whoever plays it');
}

function match(skills, seed, you) {
    const g = randomGame(seed, 'duo', F.bank, t => skills[t], (s, t) => {
        if (t === 0 && you) return you(s);
        return {bot: true};
    });
    return g.s;
}
if (suites.includes('bots')) {
    section('bots: the Hendersons play like a family');
    const N = 100;
    const rate = (skA, skB, you) => { let w = 0, l = 0; for (let i = 0; i < N; i++) { const s = match([skA, skB], 'b' + i + skA + skB, you), r = F.result(s); if (r === 0) w++; else if (r === 1) l++; } return [w / N, l / N]; };
    let [w, l] = rate(.9, .5); check(w > l + .15, `skill .9 beats skill .5 (${w.toFixed(2)} to ${l.toFixed(2)})`);
    [w, l] = rate(.5, .2); check(w > l + .15, `skill .5 beats skill .2 (${w.toFixed(2)} to ${l.toFixed(2)})`);
    [w, l] = rate(.2, 0); check(w >= l, `skill .2 does not lose to skill 0 (${w.toFixed(2)} to ${l.toFixed(2)})`);
    // a player who never answers anything on the board loses to the Hendersons
    [w, l] = rate(0, F.SKILL, s => ({text: 'zzz nothing'})); check(l > .95, `a player who always misses loses to the Hendersons (${l.toFixed(2)})`);
    // a player who always gives the top open answer beats them nearly every time; a decent player wins most
    const top = s => { const b = F.board(s); const i = b.findIndex((a, j) => !s.rev.includes(j)); return {text: i < 0 ? 'x' : b[i].name}; };
    [w, l] = rate(1, F.SKILL, top); check(w > .9, `a player who knows the board beats the Hendersons (${w.toFixed(2)})`);
    const decent = s => rng() < .62 ? top(s) : {text: 'zzz'};
    [w, l] = rate(1, F.SKILL, decent); check(w > .4 && w < .8, `a player who knows 6 in 10 wins about half the time (${w.toFixed(2)}, they win ${l.toFixed(2)})`);
    // the Hendersons never say something already up, and their misses are never an answer
    let said = 0, wrong = 0;
    for (let i = 0; i < 120; i++) {
        let s = F.begin({mode: 'solo', surveys: F.ordinary(F.bank, 'm' + i, 4), seed: 'm' + i});
        for (let k = 0; k < 30 && s.phase !== 'final'; k++) {
            if (s.phase === 'roundEnd') { s = F.next(s); continue; }
            const r = F.act(s, s.turn, {bot: true}); if (r.ev[0].t === 'repeat') continue;
            const m = F.match(r.said, F.board(s));
            const hit = r.ev.some(e => e.t === 'reveal'); said++;
            if (!hit && m) wrong++;
            s = r.s;
        }
    }
    check(said > 300 && wrong === 0, `${said} things said by the Hendersons: a miss is never secretly an answer`, `${wrong} misses were answers`);
}

if (suites.includes('daily')) {
    section('daily: one board for everyone');
    const a = F.dailyBoard(F.bank, '2026-10-06'), b = F.dailyBoard(F.bank, '2026-10-06'), c = F.dailyBoard(F.bank, '2026-10-07');
    check(JSON.stringify(a) === JSON.stringify(b), 'a day has one board');
    check(JSON.stringify(a) !== JSON.stringify(c), 'the next day has another');
    check(a.length === 4 && new Set(a.map(s => s.q)).size === 4, 'four different questions');
    const seen = new Set(); for (let d = 1; d <= 120; d++) F.dailyBoard(F.bank, '2027-01-' + d).forEach(s => seen.add(s.q));
    check(seen.size > F.bank.length * .8, `a few months of days cover most of the bank (${seen.size} of ${F.bank.length})`);
    // the Hendersons play the same match against the same moves
    const run = () => randomGame('day', 'solo', F.dailyBoard(F.bank, '2026-10-06'), null, (s, t) => t === 1 ? {bot: true} : {text: F.board(s)[0].name}).s.scores.join();
    check(run() === run(), 'the daily opponent plays the same game for everyone');
    section('daily: surveys from the language model are checked');
    const good = {q: 'Name something you take on holiday', a: [{name: 'Suitcase', pct: 30}, {name: 'Sunscreen', pct: 22}, {name: 'Camera', pct: 14}, {name: 'Passport', pct: 10}, {name: 'Book', pct: 6}]};
    check(F.clean(good)?.a.length === 5, 'a good survey passes');
    check(F.clean({...good, a: good.a.slice(0, 3)}) == null, 'three answers is too few');
    check(F.clean({...good, q: 'Hi'}) == null, 'no question, no survey');
    check(F.clean({q: good.q, a: [{name: 'A', pct: 30}, ...good.a.slice(1)]}) == null || F.clean({q: good.q, a: [{name: 'A', pct: 30}, ...good.a.slice(1)]}).a.length === 4, 'a one-letter answer is dropped');
    const dup = F.clean({...good, a: [...good.a, {name: 'suitcases', pct: 5}]});
    check(dup && dup.a.length === 5, 'the same answer twice is kept once');
    const over = F.clean({q: good.q, a: good.a.map(x => ({...x, pct: x.pct * 3}))});
    check(over && over.a.reduce((t, x) => t + x.pct, 0) <= 100, 'counts over a hundred are scaled back');
    const unsorted = F.clean({q: good.q, a: [...good.a].reverse()});
    check(unsorted && unsorted.a[0].name === 'Suitcase', 'answers come out high to low');
    check(F.clean(null) == null && F.clean({}) == null && F.clean({q: 5, a: 'x'}) == null && F.clean({q: good.q, a: [null, 3, {}]}) == null, 'rubbish is refused');
    check(F.clean({q: good.q, a: good.a.map(x => ({...x, pct: 5}))}) == null, 'a board with nothing worth finding is refused');
    check(F.clean({q: good.q, a: good.a.map((x, i) => ({...x, also: i ? [] : 'nope'}))})?.a[0].also.length === 0, 'a bad "also" list is ignored');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
