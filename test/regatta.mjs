// Regatta suite. Runs the DOM-free <script id="core"> block of games/typing_game.html in Node.
// The page's promises: the numbers are true (wpm, accuracy and place follow from the keys and the clock), a typo never
// moves the boat, the rivals are where their pace says and finish when the result says, every passage can be typed
// on any keyboard, and saves trust nothing. Suites: text, race, rivals, ladder, save. `node test/regatta.mjs [suite...]`
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, '..', 'games', 'typing_game.html'), 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block'); process.exit(1); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(core[1] + '\nthis.R = REGATTA;', ctx); const R = ctx.R;

let fails = 0, passes = 0;
const check = (ok, msg) => { if (ok) passes++; else { fails++; console.log('  FAIL ' + msg); } };
const near = (a, b, eps) => Math.abs(a - b) <= eps;
// a typist at `wpm` who hits a wrong key with probability `slip` and then the right one
function typeRace(race, wpm, slip, rnd) {
  const gap = 60000 / (wpm * 5); let t = 1000;
  while (race.finish === null) {
    if (rnd() < slip) R.key(race, '#', t);
    R.key(race, race.text[race.typed], t); t += gap;
  }
  return R.result(race);
}

const suites = {
  text() {
    R.PASSAGES.forEach((p, i) => {
      check(/^[A-Za-z0-9 .,;:'"!?-]+$/.test(p), `passage ${i} uses only keys every keyboard has`);
      check(!/  |^ | $/.test(p), `passage ${i} has no double or edge spaces`);
      check(p.length >= 110 && p.length <= 170, `passage ${i} is a sensible length (${p.length})`);
    });
    check(new Set(R.PASSAGES).size === R.PASSAGES.length, 'no passage twice');
    check(R.norm('’') === "'" && R.norm('“') === '"' && R.norm(' ') === ' ', 'phone punctuation is read as typed');
    // passage order: unseen first, the whole bank before a repeat, never the same one twice running
    let seen = [], last = -1;
    for (let k = 0; k < R.PASSAGES.length * 3; k++) {
      const id = R.pickPassage(1000 + k, seen);
      if (k < R.PASSAGES.length) check(!seen.includes(id), 'a passage is not repeated before the bank is through');
      check(id !== last, 'never the same passage twice running');
      seen = [...seen.filter(x => x !== id), id].slice(-R.PASSAGES.length + 1); last = id;
    }
  },
  race() {
    const race = R.newRace(5, 40);
    const first = race.text[0];
    check(R.key(race, '#', 100).started && race.typed === 0 && race.errors === 1, 'a wrong key starts the clock but never moves the boat');
    check(R.key(race, first, 200).ok && race.typed === 1, 'the right key moves one stroke');
    let rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(9);
    for (const [wpm, slip] of [[20, 0], [40, 0.05], [75, 0.02], [120, 0.1]]) {
      const r = R.newRace(wpm, 40), res = typeRace(r, wpm, slip, rnd);
      // the typist hits each key `gap` apart from t=1000; the last key lands at (len-1) gaps
      const len = r.text.length, ms = (len - 1) * 60000 / (wpm * 5);
      check(near(res.ms, ms, 1e-6), `finish time is the clock's (${wpm} wpm)`);
      check(near(res.wpm, len / 5 / (ms / 60000), 1e-9), 'wpm is characters/5 per minute');
      check(near(res.acc, len / (len + r.errors), 1e-12), 'accuracy counts every wrong key');
      check(R.key(r, 'x', 1e9).ignored && r.typed === len, 'nothing is typed after the line');
    }
  },
  rivals() {
    for (let seed = 1; seed < 60; seed++) {
      const race = R.newRace(seed, 20 + seed);
      for (const rv of race.rivals) {
        let prev = -1, ok = true;
        for (let t = 0; t < 120000; t += 37) { const c = R.rivalChars(rv, t); if (c < prev - 1e-9) ok = false; prev = c; }
        check(ok, 'a rival never rows backwards');
        const len = race.text.length, f = R.rivalFinish(rv, len);
        check(near(R.rivalChars(rv, f), len, 0.01), 'a rival finishes when the result says');
        check(near(len / 5 / (f / 60000), rv.wpm, rv.wpm * 0.03), 'a rival rows at its stated pace');
      }
      const w = race.rivals.map(r => r.wpm), rt = 20 + seed;
      check(w[0] < rt && w[2] > rt, 'one crew to beat, one to chase');
      // the place agrees with who crossed first
      const r2 = R.newRace(seed, rt), res = typeRace(r2, rt, 0, Math.random);
      check(res.place === 1 + res.times.filter(x => x.ms < res.ms).length, 'the place is the order of crossing');
    }
    // a typist at their rating should not run away with it: their average race is close
    let p = 0, n = 0, margin = 0;
    for (let seed = 1; seed < 200; seed++) { const r = R.newRace(seed, 50), res = typeRace(r, 50, 0, Math.random); p += res.place; n++; margin += res.margin.s; }
    check(p / n > 1.7 && p / n < 3.3, `a typist at their rating places mid-pack on average (${(p / n).toFixed(2)})`);
    check(margin / n < 6, `margins are a race, not a procession (${(margin / n).toFixed(1)} s)`);
  },
  ladder() {
    let save = R.clean(null), rnd = Math.random;
    check(save.rating === R.START_RATING, 'a new rower starts at the average typist');
    for (let k = 0; k < 15; k++) { const race = R.newRace(k, save.rating, save.seen), res = typeRace(race, 70, 0, rnd); save = R.record(save, race, res).save; }
    check(near(save.rating, 70, 3), `the crews follow a rower up (${save.rating.toFixed(1)})`);
    check(R.division(save.rating) === 'Elite', 'a 70 wpm rower is Elite');
    for (let k = 0; k < 15; k++) { const race = R.newRace(k, save.rating, save.seen), res = typeRace(race, 30, 0, rnd); save = R.record(save, race, res).save; }
    check(R.division(save.rating) === 'Club', 'and back down');
    check(save.best > 69 && save.races === 30 && save.history.length === 30, 'best, count and history are kept');
  },
  save() {
    for (const bad of [null, 5, 'x', [], {rating: 'NaN'}, {rating: 1e9, best: -4, races: -1, wins: 1e9, seen: [999, -1, 2.5, 'a', 3, 3], history: [null, {wpm: 1e9, acc: 7, place: 0}]}]) {
      const s = R.clean(bad);
      check(s.rating >= 8 && s.rating <= 220 && s.best >= 0 && s.best <= 250 && s.races >= 0 && s.wins <= s.races, 'a lying save is clamped: ' + JSON.stringify(bad));
      check(s.seen.every(i => Number.isInteger(i) && i >= 0 && i < R.PASSAGES.length) && new Set(s.seen).size === s.seen.length, 'seen passages are real');
      check(s.history.every(h => h.acc <= 1 && h.place >= 1 && h.place <= 4), 'history is sane');
    }
    const s = R.clean({rating: 55, best: 61, races: 4, wins: 2, seen: [1, 2], history: [{wpm: 50, acc: 0.97, place: 2}], mute: true});
    check(JSON.stringify(R.clean(JSON.parse(JSON.stringify(s)))) === JSON.stringify(s), 'a save round-trips');
  },
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(suites);
for (const n of want) { if (!suites[n]) { console.log('no suite ' + n); process.exit(1); } const f = fails; suites[n](); console.log(`${fails === f ? 'ok  ' : 'FAIL'} ${n}`); }
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
