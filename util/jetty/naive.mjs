// Still Water (games/contents_may_vary.html, ?world=jetty): is the fight still a fight? Every kind of fish is played with
// the tackle one meets it with (the eager bot's game, seed 1, at the moment it first hooks that kind) and with that tackle
// plus the next three purchases, by people in the rules: one who always holds and never leans or lets go for a jump, one
// who reacts late (0.6 s) and never leans the rod, the same who leans it against a run, one who is quick (0.3 s) and leans. Prints, for each, the share landed, the mean fight and how much of
// it the line spent above 85 %, and what the lost ones were lost to.
//   node util/jetty/naive.mjs [--n=150] [--page=games/contents_may_vary.html]
import fs from 'fs'; import vm from 'vm';
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const HTML = fs.readFileSync(opt('page', 'games/contents_may_vary.html'), 'utf8'), N = +opt('n', 150);
const kit = HTML.match(/<script id="core-kit">([\s\S]*?)<\/script>/)[1];
const core = HTML.match(/<script type="text\/x-core" data-world="jetty">([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({}); vm.runInContext(kit + '\n' + core + '\nthis.CORE = CORE;', ctx);
const { CORE } = ctx;
// the tackle at each first meeting, and three purchases later
const meet = {};
{ const S = CORE.init(1), m = { seed: 7 }; let t = 0, buys = [];
  while (!CORE.done(S) && t < 3 * 3600) {
    CORE.bots.eager(S, m, .1); CORE.step(S, .1); t += .1;
    for (const e of S.ev) { if (e.k === 'hooked' && !meet[e.f]) meet[e.f] = { lv: { ...S.lv }, at: t / 60, buys: buys.length }; if (e.k === 'buy') buys.push({ ...S.lv }); }
    S.ev.length = 0;
  }
  for (const k in meet) meet[k].later = buys[Math.min(buys.length - 1, meet[k].buys + 2)] || meet[k].lv;
}
const P = [
  ['holds', { react: 0, off: 9, on: 9, bow: 0, steer: 0 }],
  ['late 0.6 s', { react: .6, off: .95, on: .6, bow: 1, steer: 0 }],
  ['late, leans', { react: .6, off: .95, on: .6, bow: 1, steer: 1 }],
  ['quick 0.3 s', { react: .3, off: .92, on: .7, bow: 1, steer: 1 }]
];
const row = (k, lv) => {
  let out = '';
  for (const [, o] of P) {
    const hand = CORE.hand(o); let ok = 0, secs = 0, hot = 0, tt = 0; const why = {};
    for (let seed = 1; seed <= N; seed++) {
      const S = CORE.init(seed); S.caught = 20; Object.assign(S.lv, lv); S.t = CORE.DAY * (k === 'eel' || k === 'catfish' ? .75 : .3);
      CORE.fightWith(S, k, null, Math.min(CORE.castMax(S) + CORE.reach(S), 8 + CORE.kind(k)[2])); const m = {}; let ft = 0;
      while (S.phase === 'fight' && ft < 400) { hand(S, m, .05); CORE.step(S, .05); ft += .05; if (S.fish) { tt += .05; if (S.fish.tens > .85) hot += .05; } }
      for (const e of S.ev) if (e.k === 'lost') why[e.why] = (why[e.why] || 0) + 1; S.ev.length = 0;
      if (S.phase === 'land') { ok++; secs += ft; }
    }
    out += `${(100 * ok / N).toFixed(0).padStart(4)}% ${(secs / ok || 0).toFixed(0).padStart(3)}s ${(100 * hot / tt).toFixed(0).padStart(2)}% ${Object.entries(why).map(([a, b]) => a + b).join(' ').padEnd(12)}`;
  }
  return out;
};
console.log('kind      met at   ' + P.map(p => p[0].padEnd(29)).join(''));
for (const k of [...CORE.FISH.map(f => f[0]), 'old']) {
  if (!meet[k]) continue;
  console.log(k.padEnd(9), (meet[k].at.toFixed(1) + ' min').padStart(8), row(k, meet[k].lv));
  console.log('  +3 buys         ', row(k, meet[k].later));
}
