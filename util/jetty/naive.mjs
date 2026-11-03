// Still Water (games/contents_may_vary.html, ?world=jetty): two people play 200 fights with the first tackle, one who
// always holds the reel and one who lets go half a second after the line passes 90 %. node util/jetty/naive.mjs [fish caught so far]
import fs from 'fs'; import vm from 'vm';
const HTML = fs.readFileSync('games/contents_may_vary.html', 'utf8');
const kit = HTML.match(/<script id="core-kit">([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({}); const core = HTML.match(/<script type="text\/x-core" data-world="jetty">([\s\S]*?)<\/script>/)[1]; vm.runInContext(kit + '\n' + core + '\nthis.CORE = CORE;', ctx);
const { CORE } = ctx;
// people at the start, no tackle: one who holds all the time, one who lets go late (0.5 s after the line goes past 90 %)
for (const [name, ctl] of [['always holds', (S, m) => 1], ['lets go late', (S, m, dt) => { const t = S.fish.tens; m.late = t > .9 ? (m.late || 0) + dt : 0; return m.late > .5 ? 0 : t < .6 ? 1 : S.hold; }]]) {
  let ok = 0, snap = 0, secs = 0; const kinds = {};
  for (let seed = 1; seed <= 200; seed++) {
    const S = CORE.init(seed); S.t = 100; S.caught = +(process.argv[2] || 0); CORE.act(S, 'cast', .5, 0); let t = 0; const m = {};
    while (S.phase !== 'bite' && t < 60) { CORE.step(S, .05); t += .05; }
    CORE.act(S, 'strike'); const k = S.fish.k; let ft = 0;
    while (S.phase === 'fight' && ft < 120) { CORE.act(S, 'reel', ctl(S, m, .05)); CORE.step(S, .05); ft += .05; }
    if (S.phase === 'land') { ok++; secs += ft; } else snap++;
    kinds[k] = kinds[k] || [0, 0]; kinds[k][S.phase === 'land' ? 0 : 1]++;
  }
  console.log(name, 'landed', ok, 'lost', snap, 'mean fight', (secs / ok || 0).toFixed(1) + ' s', JSON.stringify(kinds));
}
