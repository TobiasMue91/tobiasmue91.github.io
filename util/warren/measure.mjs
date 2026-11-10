// Here Be Rabbits, measured by folio: each bot over the whole game, how long each folio took, runs and losses, kills by
// cause, knights unhorsed by cause, knights that reached the wall, and molehills.
//   node util/warren/measure.mjs games/contents_may_vary.html eager,casual,impatient,stubborn 1
import { readFileSync } from 'fs'; import vm from 'vm';
const HTML = readFileSync(process.argv[2] || 'games/contents_may_vary.html', 'utf8');
const kit = HTML.match(/<script id="core-kit">([\s\S]*?)<\/script>/)[1];
const core = HTML.match(/<script type="text\/x-core" data-world="warren">([\s\S]*?)<\/script>/)[1];
export function load() { const ctx = vm.createContext({}); vm.runInContext(kit + '\n' + core + '\nthis.CORE=CORE;this.KIT=KIT;', ctx); return ctx; }
export function run(botName, seed = 1, opt = {}) {
  const { CORE } = load(); const S = CORE.init(seed); const bot = opt.bot || CORE.bots[botName]; const mem = { seed: (seed * 7919 + 17) >>> 0 };
  const dt = .1; let t = 0; const fol = []; let cur = null, lastBuy = 0, maxNoBuy = 0, by = {}, uses = {};
  const startF = f => { cur = { f, t0: t, runs: 0, lost: 0, noBuy: 0, kills0: 0, prog60: null, kills: {}, wallEnd: [] }; fol.push(cur); };
  startF(0);
  while (t < 200 * 60 && !CORE.done(S)) {
    S.ev.length = 0; bot(S, mem, dt); CORE.step(S, dt); t += dt;
    const any = CORE.UP.some(u => CORE.can(S, u)); if (any) lastBuy = t; 
    for (const e of S.ev) {
      if (e.k === 'knDown') { const c = typeof e.by === 'number' ? (S.tw.find(q => q.id === e.by) || {}).t : e.by; cur.kd = cur.kd || {}; cur.kd[c] = (cur.kd[c] || 0) + 1; }
      if (e.k === 'knBite') cur.kb = (cur.kb || 0) + 1; if (e.k === 'sap') cur.sap = (cur.sap || 0) + 1;
      if (e.k === 'kill') { const c = typeof e.by === 'number' ? (S.tw.find(q => q.id === e.by) || {}).t : e.by; by[c] = (by[c] || 0) + e.n; cur.kills[c] = (cur.kills[c] || 0) + e.n; }
      if (['dragon', 'ink', 'bell', 'flood', 'hare', 'go'].includes(e.k)) uses[e.k + (e.auto ? 'A' : '')] = (uses[e.k] || 0) + 1;
      if (e.k === 'end') { cur.runs++; if (e.why !== 'won') cur.lost++; cur.wallEnd.push(e.why === 'won' ? +(S.wall / S.wallMax).toFixed(2) : 0); }
      if (e.k === 'folio' || e.k === 'king') { cur.t1 = t; if (e.k === 'folio') startF(S.folio); }
    }
    if (cur && cur.prog60 == null && t - cur.t0 >= 60) cur.prog60 = { kills: Object.values(cur.kills).reduce((a, b) => a + b, 0) };
  }
  if (!cur.t1) cur.t1 = t;
  return { t, fol, by, uses, S };
}
if (process.argv[1].endsWith('measure.mjs')) {
  for (const b of (process.argv[3] || 'eager,casual').split(',')) {
    const r = run(b, +(process.argv[4] || 1));
    console.log(`\n${b}: ${(r.t / 60).toFixed(1)} min, done=${!!r.S.fin}`);
    const tot = Object.values(r.by).reduce((a, b) => a + b, 0);
    console.log(' kills by cause', Object.entries(r.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%').join(', '));
    console.log(' uses', JSON.stringify(r.uses));
    for (const f of r.fol) { const tk = Object.values(f.kills).reduce((a, b) => a + b, 0); console.log(` f${f.f} ${((f.t1 - f.t0) / 60).toFixed(1)}min runs ${f.runs} lost ${f.lost} wall ${f.wallEnd.join('/')} knights ${JSON.stringify(f.kd || {})} bit ${f.kb || 0} saps ${f.sap || 0} top: ${Object.entries(f.kills).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + (100 * v / tk | 0) + '%').join(' ')}`); }
  }
}
