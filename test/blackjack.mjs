#!/usr/bin/env node
// Test suite for games/blackjack.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the shoe, hand values, the round as
// a state machine, settlement and the book (basic strategy). A table that pays 3:2 on a split
// ace, lets the dealer hit a soft 17, offers a surrender after a hit, or loses half a dollar on an
// insured blackjack looks exactly like a correct one on the page - so the rules are checked hand
// by hand against stacked shoes, the money is checked over hundreds of thousands of random
// rounds, and bots play millions of hands, where a rule that is slightly wrong shows up as a
// house edge that is wrong. No browser, no server.
//
//   node test/blackjack.mjs                   # everything
//   node test/blackjack.mjs rules money       # named suites only
//   node test/blackjack.mjs --page=path.html  # run against another copy of the page
//   node test/blackjack.mjs bots --rounds=4e6 # more rounds per bot (default 8e5)
//
// Suites:
//   values - totals, soft totals, naturals
//   shoe   - six full decks, the cut card, the same seed giving the same shoe, the reshuffle
//   rules  - stacked shoes: peeks, insurance and even money, splits and resplits, split aces,
//            doubles, surrender, the dealer standing on every 17
//   money  - random play: every dollar staked is either paid back or kept, every result matches
//            a settlement worked out independently from the final cards
//   book   - the strategy chart, cell by cell, against the published table for these rules
//   bots   - the book's house edge lands where these rules put it; worse play does worse

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'blackjack.html'));
const ROUNDS = Math.round(+opt('rounds', 8e5));
const ALL = ['values', 'shoe', 'rules', 'money', 'book', 'bots'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.BJ = BJ;', ctx);
const BJ = ctx.BJ;
const arr = x => Array.from(x);

// Cards by name: 'As', 'Td', '7h'. Rank first, suit second.
const RANKS = 'A23456789TJQK';
const card = n => RANKS.indexOf(n[0]) + 13 * 'shdc'.indexOf(n[1]);
const cards = s => s.split(' ').map(card);
// A table whose shoe deals these cards in this order (player, dealer up, player, hole, then draws).
function stacked(order, bank = 1000) {
    const t = BJ.table({seed: 1, bank});
    t.shoe = {cards: cards(order).concat(Array(400).fill(card('2s'))), next: 0, cut: 999};
    return t;
}
const types = evs => arr(evs).map(e => e.type);
const settleOf = evs => arr(evs).find(e => e.type === 'settle');

// ---------------------------------------------------------------------------------------------
if (suites.includes('values')) {
    section('values');
    const v = s => { const r = BJ.value(cards(s)); return [r.total, r.soft]; };
    eq(v('As 6d'), [17, true], 'A6 is soft 17');
    eq(v('As 6d Td'), [17, false], 'A6T is hard 17');
    eq(v('As Ad'), [12, true], 'AA is soft 12');
    eq(v('As Ad 9c'), [21, true], 'AA9 is soft 21');
    eq(v('As Ad 9c Kh'), [21, false], 'AA9K is hard 21');
    eq(v('Kd Qh 2c'), [22, false], 'KQ2 busts at 22');
    eq(v('As Ac Ad Ah'), [14, true], 'four aces are soft 14');
    eq(v('5s 5d As'), [21, true], '55A is soft 21');
    check(BJ.isBlackjack(cards('As Kd')), 'AK is a natural');
    check(!BJ.isBlackjack(cards('As 5d 5c')), 'a three-card 21 is not a natural');
    // every two-card total against a count written out by hand
    for (let a = 0; a < 13; a++) for (let b = 0; b < 13; b++) {
        const pa = Math.min(10, a + 1), pb = Math.min(10, b + 1);
        let want = pa + pb, soft = false;
        if ((pa === 1 || pb === 1) && want + 10 <= 21) { want += 10; soft = true; }
        const r = BJ.value([a, b + 13]);
        if (r.total !== want || r.soft !== soft) fail(`two-card value ${RANKS[a]}${RANKS[b]}`, `got ${r.total}/${r.soft}`);
        else pass('two-card values');
    }
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('shoe')) {
    section('shoe');
    const s = BJ.newShoe(BJ.rng(7));
    check(s.cards.length === 312, 'six decks make 312 cards', s.cards.length);
    const counts = Array(52).fill(0); s.cards.forEach(c => counts[c]++);
    check(counts.every(n => n === 6), 'every card six times');
    check(s.cut >= 312 * .72 && s.cut <= 312 * .8, 'cut card between 72% and 80%', s.cut);
    eq(arr(BJ.newShoe(BJ.rng(42)).cards), arr(BJ.newShoe(BJ.rng(42)).cards), 'the same seed makes the same shoe');
    check(JSON.stringify(arr(BJ.newShoe(BJ.rng(42)).cards)) !== JSON.stringify(arr(BJ.newShoe(BJ.rng(43)).cards)), 'another seed makes another shoe');
    // a shuffle is announced at the first deal after the cut card came out, never mid-round
    const t = BJ.table({seed: 9, bank: 1e9});
    let rounds = 0, shuffles = 0, midRound = false, sinceCut = 0;
    while (rounds < 2000) {
        const evs = arr(t.deal(10)); rounds++;
        if (evs.some(e => e.type === 'shuffle')) { shuffles++; if (!sinceCut) midRound = true; sinceCut = 0; }
        let guard = 0;
        while (t.phase !== 'bet' && guard++ < 50) {
            const l = arr(t.legal());
            evs.push(...arr(t.act(l.includes('stand') ? 'stand' : l.includes('decline') ? 'decline' : l[0])));
        }
        if (t.needShuffle) sinceCut++;
        if (evs.filter(e => e.type === 'shuffle').length > 1) midRound = true;
    }
    // about 240 cards a shoe at about 5.4 cards a round: a new shoe every 40-50 rounds
    check(shuffles > 30 && shuffles < 70, 'a new shoe comes every 40 or so rounds', shuffles);
    check(!midRound, 'a shuffle only ever comes at a deal after the cut card');
}

// ---------------------------------------------------------------------------------------------
if (suites.includes('rules')) {
    section('rules');
    {   // player natural against a 9: paid 3:2 at once, no decisions
        const t = stacked('As 9d Kh 7c');
        const evs = t.deal(10), st = settleOf(evs);
        check(st && st.results[0].outcome === 'blackjack' && st.results[0].payout === 25, 'a natural pays 3:2 straight away', JSON.stringify(st && st.results));
        check(!types(evs).includes('turn'), 'no decisions after a natural');
        check(t.bank === 1015, 'bank after a natural', t.bank);
    }
    {   // ten up, dealer natural: peek ends the round, only the original bet is lost
        const t = stacked('9s Td 8h Ac');
        const evs = t.deal(20), st = settleOf(evs);
        check(types(evs).includes('peek') && st && st.results[0].outcome === 'lose', 'the dealer peeks under a ten and takes the bet');
        check(t.bank === 980, 'only the original bet goes on a dealer natural', t.bank);
    }
    {   // ten up, no natural: play goes on
        const t = stacked('9s Td 8h 7c');
        const evs = t.deal(20);
        check(types(evs).includes('peek') && t.phase === 'play', 'a peek without a natural lets play go on');
    }
    {   // ace up: insurance first, then the peek
        const t = stacked('9s Ad 8h Kc');
        const evs = t.deal(20);
        check(t.phase === 'insurance' && !types(evs).includes('peek'), 'an ace up asks for insurance before peeking');
        eq(arr(t.legal()), ['insure', 'decline'], 'insurance is the only question');
        const e2 = t.act('insure'), st = settleOf(e2);
        check(st && st.insurancePayout === 30 && st.results[0].outcome === 'lose', 'insurance pays 2:1 on a dealer natural', JSON.stringify(st));
        check(t.bank === 1000, 'insured against a natural: the bet and the insurance cancel', t.bank);
    }
    {   // insured, no dealer natural: insurance lost, play on
        const t = stacked('9s Ad 8h 6c 2h');
        t.deal(20); t.act('insure');
        check(t.phase === 'play' && t.bank === 970, 'lost insurance stays lost and play goes on', t.bank);
    }
    {   // even money: a natural against an ace, insured, wins exactly one bet either way
        for (const hole of ['Kc', '6c']) {
            const t = stacked(`As Ad Kh ${hole}`);
            const e = t.deal(20);
            check(arr(e).find(x => x.type === 'insurance').evenMoney, 'a natural against an ace is offered even money');
            t.act('insure');
            check(t.bank === 1020, `even money pays one bet when the hole card is ${hole}`, t.bank);
        }
    }
    {   // insurance cannot be bought with money the player does not have
        const t = stacked('9s Ad 8h 6c', 25);
        t.deal(20);
        eq(arr(t.legal()), ['decline'], 'no insurance without the money for it');
    }
    {   // dealer stands on soft 17
        const t = stacked('Ts As 8h 6c');
        t.deal(10); t.act('decline');
        const evs = t.act('stand'), st = settleOf(evs);
        check(st.dealer === 17 && arr(t.dealer).length === 2 && st.results[0].outcome === 'win', 'the dealer stands on soft 17');
    }
    {   // dealer draws to hard and soft 16
        const t = stacked('Ts 9s 8h 7c 5d');
        t.deal(10); t.act('stand');
        check(arr(t.dealer).length === 3 && BJ.value(t.dealer).total === 21, 'the dealer draws on 16');
        const u = stacked('Ts 5s 8h Ac Td 3d');
        u.deal(10); u.act('stand');
        check(arr(u.dealer).length === 4 && BJ.value(u.dealer).total === 19, 'the dealer draws on soft 16 and again on the hard 16 it becomes', JSON.stringify(arr(u.dealer)));
    }
    {   // all hands bust: the dealer turns the hole card and draws nothing
        const t = stacked('Ts 6s 6h 9c Kd 5d');
        t.deal(10);
        const evs = t.act('hit'), st = settleOf(evs);
        check(st && st.results[0].outcome === 'bust' && arr(t.dealer).length === 2, 'no dealer draw when every hand is bust');
        check(types(evs).includes('reveal'), 'the hole card is still shown');
    }
    {   // hitting to 21 stands by itself
        const t = stacked('5s 9s 6h 7c Td 2d');
        t.deal(10);
        const evs = t.act('hit');
        check(t.phase === 'bet' && settleOf(evs), 'reaching 21 ends the hand');
    }
    {   // double: one card, double stake, sideways
        const t = stacked('6s 6d 5h 9c Td 5c');
        t.deal(10);
        check(arr(t.legal()).includes('double'), 'double is offered on two cards');
        const evs = t.act('double'), st = settleOf(evs);
        check(arr(evs).some(e => e.type === 'card' && e.sideways), 'the doubled card goes on sideways');
        check(st.results[0].bet === 20 && st.results[0].outcome === 'win' && t.bank === 1020, 'a doubled win pays on the doubled stake', t.bank);
        const u = stacked('2s 6d 3h 9c 2d');
        u.deal(10); u.act('hit');
        check(!arr(u.legal()).includes('double'), 'no double on three cards');
    }
    {   // surrender: only as the first decision, half back
        const t = stacked('Ts Td 6h 9c');
        t.deal(10);
        check(arr(t.legal()).includes('surrender'), 'surrender is offered first');
        const st = settleOf(t.act('surrender'));
        check(st.results[0].outcome === 'surrender' && t.bank === 995, 'surrender gives half back', t.bank);
        const u = stacked('2s 9d 3h 9c 2d');
        u.deal(10); u.act('hit');
        check(!arr(u.legal()).includes('surrender'), 'no surrender after a hit');
    }
    {   // split eights, double after split, each hand settled alone
        const t = stacked('8s 6d 8h Tc 3d 2c 9h Kd');
        t.deal(10);
        check(arr(t.legal()).includes('split'), 'a pair can be split');
        t.act('split');
        check(t.hands.length === 2 && t.bank === 980, 'split puts out a second bet', t.bank);
        check(arr(t.legal()).includes('double') && !arr(t.legal()).includes('surrender'), 'double after split, no surrender after split');
        t.act('double');    // 8+3 doubled, draws 9 -> 20
        const st = settleOf(t.act('stand'));   // 8+2 stands at 10; dealer 6T draws K -> bust
        eq(arr(st.results).map(r => [r.outcome, r.bet]), [['win', 20], ['win', 10]], 'both split hands are paid');
        check(t.bank === 1030, 'bank after a won split with a double: $30 staked, $60 back', t.bank);
    }
    {   // split aces: one card each, and A+T is 21, not a natural
        const t = stacked('As 6d Ah 9c Kd Qc Td');
        t.deal(10);
        const st = settleOf(t.act('split'));
        check(st && st.results.every(r => r.outcome === 'win' && r.payout === 20), 'split aces take one card each and a ten pays 1:1', JSON.stringify(st && st.results));
    }
    {   // resplit up to four hands, never a fifth; aces are not resplit
        const t = stacked('8s 6d 8h Tc 8d 8c 8h 2s 2d 2c 2h', 10000);
        t.deal(10);
        t.act('split'); t.act('split'); t.act('split');
        check(t.hands.length === 4 && !arr(t.legal()).includes('split'), 'no more than four hands');
        const u = stacked('As 6d Ah Tc Ad 5c', 10000);
        u.deal(10); u.act('split');
        check(u.phase === 'bet', 'split aces are not resplit and end the turn');
    }
    {   // a split or double needs the money for it
        const t = stacked('8s 6d 8h Tc', 15);
        t.deal(10);
        check(!arr(t.legal()).includes('split') && !arr(t.legal()).includes('double'), 'no split or double without the money');
    }
    {   // illegal moves are refused, not quietly done
        const t = stacked('Ts 6d 9h Tc 5d');
        t.deal(10);
        let threw = false; try { t.act('split'); } catch (e) { threw = true; }
        check(threw, 'an illegal move throws');
        threw = false; try { t.deal(10); } catch (e) { threw = true; }
        check(threw, 'no second deal mid-round');
    }
    {   // bets outside the table limits are refused
        for (const bet of [0, 4, 1001, 2000]) {
            let threw = false; try { BJ.table({seed: 1, bank: 5000}).deal(bet); } catch (e) { threw = true; }
            check(threw, `a $${bet} bet is refused`);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The settlement worked out again from the final cards, without the table's code.
function reference(t, st) {
    const tot = cs => { let s = 0, a = 0; for (const c of cs) { const p = Math.min(10, c % 13 + 1); s += p; if (p === 1) a++; } return a && s + 10 <= 21 ? s + 10 : s; };
    const nat = cs => cs.length === 2 && tot(cs) === 21;
    const d = arr(t.dealer), dt = tot(d), dn = nat(d);
    return arr(t.hands).map(h => {
        const c = arr(h.cards), v = tot(c), n = !h.split && nat(c);
        if (h.surrendered) return h.bet / 2;
        if (v > 21) return 0;
        if (n && !dn) return h.bet * 2.5;
        if (dn) return n ? h.bet : 0;
        if (dt > 21 || v > dt) return h.bet * 2;
        if (v === dt) return h.bet;
        return 0;
    });
}

if (suites.includes('money')) {
    section('money');
    const r = BJ.rng(2024);
    const t = BJ.table({seed: 77, bank: 1e7});
    let bad = 0, badRef = 0, negative = 0, rounds = 0, dealerDrewWrong = 0;
    for (; rounds < 200000; rounds++) {
        const before = t.bank, bet = 5 * (1 + Math.floor(r() * 40));
        const evs = arr(t.deal(bet));
        let guard = 0;
        while (t.phase !== 'bet' && guard++ < 60) {
            const l = arr(t.legal());
            evs.push(...arr(t.act(l[Math.floor(r() * l.length)])));
            if (t.bank < 0) negative++;
        }
        const st = evs.find(e => e.type === 'settle');
        const staked = arr(t.hands).reduce((s, h) => s + h.bet, 0) + t.insurance;
        const paid = arr(st.results).reduce((s, x) => s + x.payout, 0) + st.insurancePayout;
        if (Math.abs(t.bank - (before - staked + paid)) > 1e-9 || Math.abs(st.net - (paid - staked)) > 1e-9) bad++;
        const ref = reference(t, st);
        if (ref.some((p, i) => p !== st.results[i].payout)) badRef++;
        const dv = BJ.value(t.dealer);
        const anyLive = arr(t.hands).some(h => !h.surrendered && BJ.value(h.cards).total <= 21);
        if (anyLive && !BJ.isBlackjack(t.dealer) && !(t.hands.length === 1 && BJ.isBlackjack(t.hands[0].cards)) && dv.total < 17) dealerDrewWrong++;
        if (dv.total >= 17 && t.dealer.length > 2 && BJ.value(arr(t.dealer).slice(0, -1)).total >= 17) dealerDrewWrong++;
    }
    check(bad === 0, `every dollar is accounted for over ${rounds} random rounds`, `${bad} rounds off`);
    check(badRef === 0, 'every payout matches a settlement worked out from the cards', `${badRef} rounds differ`);
    check(negative === 0, 'the bank never goes below zero', negative);
    check(dealerDrewWrong === 0, 'the dealer always stops at 17 and never before', dealerDrewWrong);
}

// ---------------------------------------------------------------------------------------------
// Basic strategy for 4-8 decks, dealer stands on soft 17, double after split, late surrender,
// as published (Wizard of Odds). Columns are the dealer's upcard 2..9, T, A.
const HARD = {
    8: 'HHHHHHHHHH', 9: 'HDDDDHHHHH', 10: 'DDDDDDDDHH', 11: 'DDDDDDDDDH', 12: 'HHSSSHHHHH',
    13: 'SSSSSHHHHH', 14: 'SSSSSHHHHH', 15: 'SSSSSHHHRH', 16: 'SSSSSHHRRR', 17: 'SSSSSSSSSS'
};
const SOFT = {13: 'HHHDDHHHHH', 14: 'HHHDDHHHHH', 15: 'HHDDDHHHHH', 16: 'HHDDDHHHHH', 17: 'HDDDDHHHHH', 18: 'SDDDDSSHHH', 19: 'SSSSSSSSSS', 20: 'SSSSSSSSSS'};
const PAIRS = {2: 'PPPPPPHHHH', 3: 'PPPPPPHHHH', 4: 'HHHPPHHHHH', 6: 'PPPPPHHHHH', 7: 'PPPPPPHHHH', 8: 'PPPPPPPPPP', 9: 'PPPPPSPPSS', 10: 'SSSSSSSSSS', 11: 'PPPPPPPPPP'};
const UPS = ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', 'Ts', 'As'];
const ALL_LEGAL = ['hit', 'stand', 'double', 'split', 'surrender'];

if (suites.includes('book')) {
    section('book');
    const hardHands = {8: '5d 3h', 9: '6d 3h', 10: '6d 4h', 11: '7d 4h', 12: 'Td 2h', 13: 'Td 3h', 14: 'Td 4h', 15: 'Td 5h', 16: 'Td 6h', 17: 'Td 7h'};
    for (const [tot, row] of Object.entries(HARD)) UPS.forEach((u, i) => {
        const got = BJ.book(cards(hardHands[tot]), card(u), ALL_LEGAL);
        if (got !== row[i]) fail(`hard ${tot} vs ${u[0]}`, `book says ${got}, the chart says ${row[i]}`); else pass('hard');
    });
    for (const [tot, row] of Object.entries(SOFT)) UPS.forEach((u, i) => {
        const got = BJ.book(cards(`Ad ${RANKS[tot - 12]}h`), card(u), ALL_LEGAL);
        if (got !== row[i]) fail(`soft ${tot} vs ${u[0]}`, `book says ${got}, the chart says ${row[i]}`); else pass('soft');
    });
    for (const [p, row] of Object.entries(PAIRS)) UPS.forEach((u, i) => {
        const r = p === '11' ? 'A' : p === '10' ? 'T' : p;
        const got = BJ.book(cards(`${r}d ${r}h`), card(u), ALL_LEGAL);
        if (got !== row[i]) fail(`pair ${r}${r} vs ${u[0]}`, `book says ${got}, the chart says ${row[i]}`); else pass('pairs');
    });
    // when the chart's move is not legal it falls back the way the chart says
    check(BJ.book(cards('7d 4h'), card('6s'), ['hit', 'stand']) === 'H', '11 without a double is a hit');
    check(BJ.book(cards('Ad 7h'), card('4s'), ['hit', 'stand']) === 'S', 'soft 18 without a double stands');
    check(BJ.book(cards('Td 6h'), card('Ts'), ['hit', 'stand']) === 'H', '16 v T without surrender is a hit');
    check(BJ.book(cards('8d 8h'), card('Ts'), ALL_LEGAL) === 'P', '8-8 v T is split, not surrendered');
    check(BJ.book(cards('5d 4h 2c'), card('6s'), ['hit', 'stand']) === 'H', 'three-card 11 hits');
}

// ---------------------------------------------------------------------------------------------
// Each bot plays whole shoes with a flat $10 bet; the edge is what it loses per dollar first bet.
function play(policy, rounds, seed) {
    const t = BJ.table({seed, bank: 1e12});
    let net = 0, sq = 0;
    for (let i = 0; i < rounds; i++) {
        const evs = arr(t.deal(10));
        let st = evs.find(e => e.type === 'settle');
        while (!st) {
            const l = arr(t.legal());
            const e = arr(t.act(policy(t, l)));
            st = e.find(x => x.type === 'settle');
        }
        const n = st.net / 10; net += n; sq += n * n;
    }
    const mean = net / rounds, sd = Math.sqrt(sq / rounds - mean * mean);
    return {edge: mean * 100, se: sd / Math.sqrt(rounds) * 100};
}
const byBook = (t, l) => l.includes('decline') ? 'decline' : BJ.BOOK_ACTION[BJ.book(t.hands[t.active].cards, t.dealer[0], l)];
const mimic = (t, l) => l.includes('decline') ? 'decline' : BJ.value(t.hands[t.active].cards).total < 17 ? 'hit' : 'stand';
const standOn12 = (t, l) => l.includes('decline') ? 'decline' : BJ.value(t.hands[t.active].cards).total < 12 ? 'hit' : 'stand';

if (suites.includes('bots')) {
    section('bots');
    const b = play(byBook, ROUNDS, 31337);
    console.log(`  book        ${b.edge.toFixed(3)}% per hand  (±${b.se.toFixed(3)})`);
    // six decks, S17, DAS, late surrender, resplit to four, no resplit of aces: about -0.36%
    check(b.edge > -0.36 - 3.5 * b.se - 0.08 && b.edge < -0.36 + 3.5 * b.se + 0.08, 'the book loses what these rules say it should (about 0.36%)', b.edge.toFixed(3));
    const m = play(mimic, ROUNDS / 3 | 0, 4242);
    console.log(`  mimic       ${m.edge.toFixed(3)}%  (±${m.se.toFixed(3)})`);
    check(m.edge > -6.6 && m.edge < -4.4, 'mimicking the dealer loses about 5.5% (the bust you take first)', m.edge.toFixed(2));
    const n = play(standOn12, ROUNDS / 3 | 0, 777);
    console.log(`  stand on 12 ${n.edge.toFixed(3)}%  (±${n.se.toFixed(3)})`);
    check(n.edge < b.edge - 2, 'standing on every 12, soft or hard, is clearly worse than the book', n.edge.toFixed(2));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
