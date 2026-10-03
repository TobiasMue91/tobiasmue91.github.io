#!/usr/bin/env node
// Test suite for games/crazy_eights.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the deal, the rules, the score and the computer players.
// The page promises two things nobody can check from the page: that every card it lets you play is legal and every
// one it refuses is not, and that a crossed-out suit on an opponent's portrait is true - they really hold none of it.
// A rule that is slightly wrong (an eight that may not be played, a drawn card kept back, a reshuffle that loses a
// card, a void that outlives the card that broke it) looks exactly like a right one on the page.
//
//   node test/crazy_eights.mjs                  # everything
//   node test/crazy_eights.mjs rules voids      # named suites only
//   node test/crazy_eights.mjs --page=path.html # run against another copy of the page
//   node test/crazy_eights.mjs --matches=4000   # more simulated matches (default 1500)
//
// Suites:
//   deal   - five each from the dealer's left, 52 cards accounted for, an eight is never the starter, same seed same deal
//   rules  - stacked hands: suit, rank and eights; draw only when stuck; a drawn card that fits must be played; reshuffle
//   score  - eights 50, courts 10, aces 1; the hand that went out pays nothing; the match ends at 100, lowest wins
//   play   - whole matches by the computer players: every move legal, every card always somewhere, hands always end
//   voids  - every crossed-out suit on every seat at every moment is true of that seat's hand
//   save   - a match saved at any moment and loaded again carries on exactly as the one that was not
//   skill  - the computer players beat a player who plays any legal card at random

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'crazy_eights.html'));
const MATCHES = Math.round(+opt('matches', 1500));
const ALL = ['deal', 'rules', 'score', 'play', 'voids', 'save', 'skill'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const section = n => console.log(`\n=== ${n} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.CE = CE;', ctx);
const CE = ctx.CE;
const J = x => JSON.parse(JSON.stringify(x));

// Cards by name: 'As', 'Td', '8h'. Rank first, suit second.
const R = 'A23456789TJQK';
const card = n => R.indexOf(n[0]) + 13 * 'shdc'.indexOf(n[1]);
const cards = s => s ? s.split(' ').map(card) : [];
const nm = c => R[c % 13] + 'shdc'[c / 13 | 0];

// A hand in progress, built by hand: hands for seats 0..3, the pile (top last), the stock (next card last).
function table({hands, pile, stock = '', suit, turn = 0}) {
  const m = CE.newMatch(1);
  const hs = hands.map(cards), dis = cards(pile), st = cards(stock);
  const used = new Set([...hs.flat(), ...dis, ...st]);
  const rest = Array.from({length: 52}, (_, i) => i).filter(c => !used.has(c));
  // whatever is left goes under the named stock, so all 52 stay in play
  m.h = {hands: hs, stock: stock === null ? [] : [...rest, ...st], discard: dis, suit: suit || CE.suit(dis[dis.length - 1]),
    turn, drawn: null, passes: 0, voids: [[], [], [], []], over: false, out: -1, penalties: null, order: [], buried: 0};
  return m;
}
const acts = (m, p = m.h.turn) => J(CE.actions(m, p)).map(a => a.type === 'play' ? nm(a.card) : a.type).sort();
const accounted = m => {
  const all = [...m.h.stock, ...m.h.discard, ...m.h.hands.flat()].sort((a, b) => a - b);
  return all.length === 52 && all.every((c, i) => c === i);
};

// A whole match, every seat choosing with `pick` (defaults to the page's own players). `each` sees every step.
function playMatch(seed, pick = (m, p) => CE.choose(m, p), each = null, maxHands = 60) {
  const m = CE.newMatch(seed);
  let steps = 0;
  for (let hands = 0; hands < maxHands && !m.over; hands++) {
    while (!m.h.over) {
      const p = m.h.turn, a = pick(m, p);
      const ev = CE.apply(m, a);
      if (each) each(m, ev, a);
      if (++steps > 100000) throw new Error('match never ends');
    }
    if (!m.over) CE.nextHand(m);
  }
  return m;
}
const randomPick = (m, p) => {
  const as = CE.actions(m, p), a = J(as[Math.floor(CE.rnd(m) * as.length)]);
  if (a.type === 'play' && CE.rank(a.card) === CE.EIGHT) a.suit = CE.SUITS[Math.floor(CE.rnd(m) * 4)];
  return a;
};

if (suites.includes('deal')) {
  section('deal');
  for (let seed = 1; seed <= 400; seed++) {
    const m = CE.newMatch(seed), h = m.h;
    if (!accounted(m)) { fail(`seed ${seed}: 52 cards after the deal`); break; }
    if (h.hands.some(x => x.length !== 5)) { fail(`seed ${seed}: five cards each`); break; }
    if (CE.rank(CE.top(h)) === CE.EIGHT) { fail(`seed ${seed}: an eight was turned as the starter`); break; }
    if (h.suit !== CE.suit(CE.top(h))) { fail(`seed ${seed}: the suit in play is the starter's`); break; }
    if (h.discard.length !== 1 || h.stock.length !== 31) { fail(`seed ${seed}: 1 on the pile, 31 in the stock`); break; }
    const seats = h.order.map(o => o[0]);
    if (JSON.stringify(seats.slice(0, 4)) !== JSON.stringify([0, 1, 2, 3])) { fail(`seed ${seed}: the first match deals from June, so you get the first card`, seats.slice(0, 4).join()); break; }
  }
  pass('400 deals');
  check(CE.newMatch(77).h.turn === 0, 'you play first in a new match');
  eq(CE.newMatch(5).h.hands, CE.newMatch(5).h.hands, 'the same seed deals the same hands');
  check(JSON.stringify(CE.newMatch(5).h.hands) !== JSON.stringify(CE.newMatch(6).h.hands), 'another seed deals other hands');
  let buried = 0;
  for (let seed = 1; seed <= 3000; seed++) buried += CE.newMatch(seed).h.buried > 0;
  check(buried > 100, 'an eight turned up as the starter goes back into the stock', `${buried} buried in 3000 deals`);
  const m = CE.newMatch(9);
  m.h.over = true; CE.nextHand(m);
  check(m.dealer === 0 && m.h.turn === 1 && m.round === 2, 'the deal moves round: you deal the second hand and Mae plays first');
}

if (suites.includes('rules')) {
  section('rules');
  let m = table({hands: ['7h Kh 3s 9c 8d', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '2s 4s 5s 6s 7s'], pile: '9h'});
  eq(acts(m), ['7h', '8d', '9c', 'Kh'], 'suit, rank and eights may be played; nothing else');
  m = table({hands: ['7h Kh 3s 9c 8d', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '2s 4s 5s 6s 7s'], pile: '9h 8c', suit: 's'});
  eq(acts(m), ['3s', '8d'], 'after an eight the named suit counts, not the eight\'s own');
  check(!CE.legal(m, 0, {type: 'draw'}), 'no drawing while a card fits');
  check(!CE.legal(m, 0, {type: 'play', card: card('8d')}), 'an eight needs a suit named');
  check(!CE.legal(m, 0, {type: 'play', card: card('8d'), suit: 'x'}), 'only a real suit can be named');
  check(!CE.legal(m, 1, {type: 'play', card: card('2c')}), 'nobody plays out of turn');
  CE.apply(m, {type: 'play', card: card('8d'), suit: 'c'});
  check(m.h.suit === 'c' && m.h.turn === 1, 'an eight names the suit and passes the turn on');
  eq(acts(m), ['2c', '3c', '4c', '5c', '6c'], 'Mae follows the named clubs');

  m = table({hands: ['2s 3s 4s 5s 6s', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '7s 9s Ts Js Qs'], pile: '9h', stock: 'Kh'});
  eq(acts(m), ['draw'], 'stuck: the only move is to draw');
  let ev = CE.apply(m, {type: 'draw'});
  check(ev.fits && m.h.turn === 0, 'the drawn K♥ fits and the turn is still yours');
  eq(acts(m), ['Kh'], 'a drawn card that fits must be played, and nothing else may be');
  CE.apply(m, {type: 'play', card: card('Kh')});
  check(m.h.turn === 1 && m.h.drawn === null, 'then the turn moves on');

  m = table({hands: ['2s 3s 4s 5s 6s', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '7s 9s Ts Js Qs'], pile: '9h', stock: 'Kc'});
  CE.apply(m, {type: 'draw'});
  eq(acts(m), ['pass'], 'a drawn card that does not fit ends the turn');
  CE.apply(m, {type: 'pass'});
  check(m.h.turn === 1 && m.h.hands[0].length === 6, 'you keep it and Mae plays');

  m = table({hands: ['2s 3s 4s 5s 6s', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '7s 9s Ts Js Qs'], pile: '9h', stock: '8c'});
  CE.apply(m, {type: 'draw'});
  check(CE.legal(m, 0, {type: 'play', card: card('8c'), suit: 's'}), 'a drawn eight is played too, naming a suit');

  // the stock runs out: the pile under the top card is shuffled back
  m = table({hands: ['2s 3s 4s 5s 6s', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '7s 9s Ts Js Qs'], pile: 'Ah Kd Qd Jh 9h', stock: null});
  const rest = Array.from({length: 52}, (_, i) => i).filter(c => !m.h.hands.flat().includes(c) && !m.h.discard.includes(c));
  m.h.discard = [...rest, ...m.h.discard];
  ev = CE.apply(m, {type: 'draw'});
  check(ev.reshuffled && m.h.discard.length === 1 && CE.top(m.h) === card('9h') && accounted(m), 'an empty stock is refilled from the pile; the top card stays');
  // nothing left to draw at all
  m = table({hands: ['2s 3s 4s 5s 6s', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '7s 9s Ts Js Qs'], pile: '9h', stock: null});
  m.h.hands[3].push(...Array.from({length: 52}, (_, i) => i).filter(c => !m.h.hands.flat().includes(c) && c !== card('9h')));
  eq(acts(m), ['pass'], 'nothing to draw: a stuck player passes');
  for (let i = 0; i < 3; i++) CE.apply(m, CE.actions(m, m.h.turn)[0]);
  check(!m.h.over, 'three passes do not end the hand');
}

if (suites.includes('score')) {
  section('score');
  eq(cards('8s Kh Qd Jc Ts 9h As 2c').map(CE.points), [50, 10, 10, 10, 10, 9, 1, 2], 'card values');
  const m = table({hands: ['Kh', '8c Ac', 'Qd 3d', '2s'], pile: '9h'});
  const ev = CE.apply(m, {type: 'play', card: card('Kh')});
  check(ev.out && m.h.over, 'emptying your hand ends it');
  eq(m.h.penalties, [0, 51, 13, 2], 'everyone else pays what they hold');
  eq(m.scores, [0, 51, 13, 2], 'and it goes on their score');
  check(!m.over, 'nobody at 100 yet: the match goes on');
  m.scores = [20, 99, 30, 60]; m.h.over = false; m.h.hands = [[card('Ks')], [card('2h')], [card('3h')], [card('4d')]]; m.h.discard = [card('9s')]; m.h.suit = 's'; m.h.turn = 0;
  CE.apply(m, {type: 'play', card: card('Ks')});
  check(m.over, 'a score of 100 or more ends the match');
  eq(J(m.winners), [0], 'lowest total wins');
  const t = table({hands: ['Kh', '8c', 'Qd', '2s'], pile: '9h'});
  t.scores = [95, 50, 95, 10]; t.h.hands = [[card('Kh')], [card('8c')], [card('Qd')], [card('2s')]];
  CE.apply(t, {type: 'play', card: card('Kh')});
  check(t.over && J(t.winners).join() === '3', 'Mae passes 100: June, on 12, wins', J(t.winners).join());
  const tie = table({hands: ['Kh', '8c 8d', '2d', '2s'], pile: '9h'});
  tie.scores = [20, 10, 18, 20];
  CE.apply(tie, {type: 'play', card: card('Kh')});
  eq(J(tie.winners), [0, 2], 'a tie for lowest is shared');
}

if (suites.includes('play') || suites.includes('voids') || suites.includes('save')) {
  let illegal = 0, lost = 0, endless = 0, total = 0, voidLies = 0, voidChecks = 0, hands = 0, blocked = 0;
  const firstLie = [];
  for (let seed = 1; seed <= MATCHES; seed++) {
    try {
      const m = playMatch(seed * 7919, (m, p) => {
        const a = seed % 3 === 0 && p === 0 ? randomPick(m, p) : CE.choose(m, p);
        if (!CE.legal(m, p, a)) illegal++;
        return a;
      }, (m, ev) => {
        total++;
        if (!accounted(m)) lost++;
        if (ev.blocked) blocked++;
        if (ev.out || ev.blocked) hands++;
        for (let p = 0; p < 4; p++) for (const s of m.h.voids[p]) {
          voidChecks++;
          if (m.h.hands[p].some(c => CE.suit(c) === s)) { voidLies++; if (firstLie.length < 1) firstLie.push(`seed ${seed * 7919} seat ${p} void ${s}`); }
        }
      });
      if (!m.over) endless++;
    } catch (e) { endless++; if (endless < 3) console.log('  ', e.message); }
  }
  if (suites.includes('play')) {
    section('play');
    check(illegal === 0, `every move the computer players make is legal (${total} moves, ${MATCHES} matches)`, `${illegal} illegal`);
    check(lost === 0, 'all 52 cards are somewhere after every move', `${lost} moves lost a card`);
    check(endless === 0, 'every match ends', `${endless} did not`);
    check(hands / MATCHES > 2 && hands / MATCHES < 12, `a match runs a handful of hands (${(hands / MATCHES).toFixed(1)} on average)`);
    check(blocked / hands < 0.005, `blocked hands are rare (${blocked} of ${hands})`);
  }
  if (suites.includes('voids')) {
    section('voids');
    check(voidChecks > 1000, `voids are shown (${voidChecks} seat-moments with one)`);
    check(voidLies === 0, 'every crossed-out suit is true: that seat holds none of it', firstLie[0]);
  }
}

if (suites.includes('voids')) {
  const m = table({hands: ['2s 3s 4s 5s 6s', '2c 3c 4c 5c 6c', '2d 3d 4d 5d 6d', '7s 9s Ts Js Qs'], pile: '9h', stock: 'Kh Kc'});
  CE.apply(m, {type: 'draw'}); CE.apply(m, {type: 'pass'});
  eq(J(m.h.voids[0]), ['h'], 'drawing and passing on hearts marks you out of hearts');
  m.h.turn = 0; m.h.suit = 's'; m.h.discard.push(card('9d')); m.h.suit = 'd';
  m.h.hands[0] = m.h.hands[0].filter(c => CE.suit(c) !== 'd');
  CE.apply(m, {type: 'draw'});
  eq(J(m.h.voids[0]), [], 'the next card drawn wipes it: it might be a heart');
}

if (suites.includes('save')) {
  section('save');
  let diverged = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const at = 5 + (seed * 13) % 60;
    const trace = [];
    playMatch(seed, undefined, (m, ev) => trace.push(JSON.stringify(ev)));
    // play again, but at step `at` save, load and carry on with the copy
    const m = CE.newMatch(seed);
    let k = 0, cur = m, t2 = [];
    for (let guard = 0; guard < 100000 && !cur.over; guard++) {
      if (cur.h.over) { CE.nextHand(cur); continue; }
      if (k === at) { const saved = JSON.stringify(cur); cur = JSON.parse(saved); if (!CE.valid(cur)) { diverged++; break; } }
      t2.push(JSON.stringify(CE.apply(cur, CE.choose(cur, cur.h.turn)))); k++;
    }
    if (t2.join() !== trace.join()) diverged++;
  }
  check(diverged === 0, 'a match saved and loaded mid-hand carries on move for move (200 matches)', `${diverged} diverged`);
  check(!CE.valid({v: 2, h: {stock: [], discard: [], hands: [[], [], [], []]}, scores: []}), 'a save with cards missing is refused');
  check(!CE.valid(null) && !CE.valid({v: 1}), 'a save from another version is refused');
}

if (suites.includes('skill')) {
  section('skill');
  // seat 0 plays at random, the others with the page's players; then the other way round
  let randPen = 0, aiPen = 0, rh = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const m = playMatch(seed * 31, (m, p) => p === 0 ? randomPick(m, p) : CE.choose(m, p));
    m.rounds.forEach(r => { randPen += r[0]; aiPen += (r[1] + r[2] + r[3]) / 3; rh++; });
  }
  randPen /= rh; aiPen /= rh;
  check(aiPen < randPen * 0.8, `the computer players pay less per hand than a random player (${aiPen.toFixed(1)} vs ${randPen.toFixed(1)})`);
  let wins = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const m = playMatch(seed * 37, (m, p) => p === 0 ? randomPick(m, p) : CE.choose(m, p));
    if (m.winners.includes(0)) wins++;
  }
  check(wins / 400 < 0.2, `a random player wins few matches against them (${wins} of 400, a fair share would be 100)`);
}

console.log(`\n${failures ? failures + ' failed, ' : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
