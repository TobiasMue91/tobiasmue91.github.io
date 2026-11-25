// Render a filmstrip of Lanternwind frames, driven frame by frame through window.__lw (no wall clock involved).
// node util/lanternwind/film.js out/prefix '{"pos":[x,y,z],"yaw":0,"pitch":0,"tod":0.38,"n":8,"every":4,"warm":30}'
// Options: q (low|medium|high), pos/yaw/pitch (glider start), tod (0.38 = flight start, 1 = night), n frames,
// every (sim frames between shots), warm (sim frames before the first shot), dt, freeze (stop time), hud,
// mode ('play' | 'title'), mobile/w/h/dpr (phone: {"mobile":true,"w":390,"h":844,"dpr":1.5,"q":"medium"}),
// setup (JS run once, `L` is window.__lw), eval (JS run before every sim frame).
// Writes out/prefix_00.png, _01.png ... SwiftShader is slow: a 960x540 frame takes seconds.
const { openGame } = require('./_page');
const out = process.argv[2];
const o = Object.assign({ q: 'high', pos: [-640, 25, 1700], yaw: 0, pitch: 0, n: 10, dt: 1 / 30, w: 960, h: 540, freeze: false, warm: 6, hud: false, mode: 'play' }, JSON.parse(process.argv[3] || '{}'));
(async () => {
  const { browser, page } = await openGame(o);
  await page.evaluate(o => {
    window.__lwManual = true;
    const L = __lw; L.applyQuality(o.q); L.S.noAdapt = true;
    if (o.mode === 'play') { L.startGame(); document.querySelector('#title').classList.add('hidden'); }
    if (!o.hud) document.querySelectorAll('#hud,#msg,#hint').forEach(e => e.style.visibility = 'hidden');
    if (o.tod != null) L.setTod(o.tod);
    if (o.mode === 'play') L.teleport(o.pos[0], o.pos[1], o.pos[2], o.yaw, o.pitch);
    L.U.uTime.value = 100;
    if (o.setup) eval(o.setup);
    for (let i = 0; i < o.warm; i++) { if (o.eval) eval(o.eval); L.frame(o.dt, false, i < o.warm - 3); }
  }, o);
  for (let i = 0; i < o.n; i++) {
    await page.evaluate(o => { const L = __lw; for (let k = 0; k < (o.every || 1); k++) { if (o.eval) eval(o.eval); L.frame(o.dt, o.freeze, k < (o.every || 1) - 1); } }, o);
    await page.screenshot({ path: `${out}_${String(i).padStart(2, '0')}.png`, timeout: 300000 });
  }
  await browser.close();
})();
