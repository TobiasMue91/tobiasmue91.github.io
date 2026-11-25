// Hunt one-frame flashes. Flies the glider for n frames and, after every frame, counts pixels the page's own
// detectors paint magenta (or green). Frames with hits are saved as out_<i>.png and listed in out.json.
// node util/lanternwind/hunt.js out/flash.json '{"tod":0.38,"pos":[-640,20,1900],"yaw":0.6,"n":200,"hw":4}'
//   hv: pre-bloom detector (1 = a lone pixel far brighter than its neighbours, or anything above the ceiling;
//       2 = test mode, marks everything brighter than 2, to prove the detector sees something)
//   hw: water detector, marks reflection values above hw (normal reflections stay below about 3; 0.6 marks
//       nearly all water, also a good self-test). Glints brighter than 4*hw show green.
//   keys: held keys, e.g. ["KeyA"] for a steady left turn.
// Hits are rare (two in 600 frames before the mirror was cleaned); to find what caused one, rerun to the same
// frame (the flight is deterministic) and hide scene.children one by one until the count drops.
const { openGame } = require('./_page');
const out = process.argv[2];
const o = Object.assign({ q: 'high', tod: 0.32, pos: [-640, 25, 1700], yaw: 0, n: 150, w: 640, h: 360, dt: 1 / 30, keys: [], hv: 1, hw: 0 }, JSON.parse(process.argv[3] || '{}'));
(async () => {
  const { browser, page } = await openGame(o);
  await page.evaluate(o => {
    window.__lwManual = true; const L = __lw; L.applyQuality(o.q); L.S.noAdapt = true;
    L.startGame(); document.querySelector('#title').classList.add('hidden');
    document.querySelectorAll('#hud,#msg,#hint').forEach(e => e.style.visibility = 'hidden');
    L.setTod(o.tod); L.teleport(o.pos[0], o.pos[1], o.pos[2], o.yaw, 0); L.U.uTime.value = 100;
    L.passes.rayPass.comp.material.uniforms.uHunt.value = o.hv;
    if (o.hw) L.ocean.mat.uniforms.uHuntW.value = o.hw;
    for (let i = 0; i < 6; i++) L.frame(o.dt);
    window._scan = () => {
      const gl = L.renderer.getContext(); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let mag = 0, grn = 0; const at = [];
      for (let i = 0; i < W * H; i++) { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        if (r > 200 && b > 200 && g < 120) { mag++; if (at.length < 3) at.push([i % W, H - 1 - ((i / W) | 0)]); }
        else if (g > 220 && r < 90 && b < 90) grn++; }
      return { mag, grn, at };
    };
  }, o);
  const log = [];
  for (let i = 0; i < o.n; i++) {
    const r = await page.evaluate(o => { const L = __lw; (o.keys || []).forEach(k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k }))); L.frame(o.dt); const s = window._scan(); s.pos = [L.P.pos.x | 0, L.P.pos.y | 0, L.P.pos.z | 0]; return s; }, o);
    if (r.mag || r.grn) { log.push({ i, ...r }); await page.screenshot({ path: out.replace(/\.json$/, `_${i}.png`) }); }
    if (i % 25 === 0) console.log(i, JSON.stringify(r));
  }
  require('fs').writeFileSync(out, JSON.stringify(log));
  console.log('hits', log.length);
  await browser.close();
})();
