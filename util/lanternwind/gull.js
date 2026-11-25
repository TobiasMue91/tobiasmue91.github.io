// Follow one gull close up with the photo-orbit camera, time running (the glider is shrunk away and its lantern light
// switched off, or it would light the bird from inside). Writes out_00.png ...
// node util/lanternwind/gull.js out/gull '{"i":3,"n":9,"every":2,"dist":3.2,"yaw":1.6,"pitch":0.25,"follow":true,"t":95,"tod":0.38}'
// i: which gull; dist/yaw/pitch: orbit (yaw relative to the gull's heading with follow); every: sim frames per shot.
const { openGame } = require('./_page');
const out = process.argv[2];
const o = Object.assign({ i: 3, n: 12, every: 1, dist: 3, yaw: 1.2, pitch: 0.2, tod: 0.38, t: 100, w: 960, h: 540, q: 'high', dt: 1 / 30 }, JSON.parse(process.argv[3] || '{}'));
(async () => {
  const { browser, page } = await openGame(o);
  await page.evaluate(o => {
    window.__lwManual = true; const L = __lw; L.applyQuality(o.q); L.S.noAdapt = true;
    L.startGame(); document.querySelector('#title').classList.add('hidden');
    document.querySelectorAll('#hud,#msg,#hint,#photo').forEach(e => e.style.visibility = 'hidden');
    L.setTod(o.tod); L.U.uTime.value = o.t;
    const g = L.scene.children.find(c => c.geometry && c.geometry.attributes && c.geometry.attributes.aPart).geometry;
    const a = g.attributes.aA.array, b = g.attributes.aB.array;
    window.birdPos = (i, t) => { const ang = b[i*4+1] + t * b[i*4] / a[i*4+2]; return [a[i*4] + Math.cos(ang) * a[i*4+2], a[i*4+3] + Math.sin(t*0.3 + b[i*4+1]) * 7, a[i*4+1] + Math.sin(ang) * a[i*4+2], ang, Math.sign(b[i*4])]; };
    window.place = () => { const p = birdPos(o.i, L.U.uTime.value); L.teleport(p[0], p[1], p[2], 0, 0); L.setMode('photo');
      const orb = L.camState.orbit; orb.yaw = o.yaw + (o.follow ? Math.atan2(-Math.sin(p[3]) * p[4], Math.cos(p[3]) * p[4]) : 0); orb.pitch = o.pitch; orb.dist = o.dist;
      L.glider.scale.setScalar(1e-4); L.glider.traverse(q => { if (q.isLight) q.visible = false; }); };
    for (let k = 0; k < 20; k++) { L.U.uTime.value -= o.dt; place(); L.frame(o.dt, false, true); }
  }, o);
  for (let n = 0; n < o.n; n++) {
    await page.evaluate(o => { const L = __lw; for (let k = 0; k < o.every; k++) { place(); L.frame(o.dt, false, k < o.every - 1); } }, o);
    await page.screenshot({ path: `${out}_${String(n).padStart(2, '0')}.png`, timeout: 300000 });
  }
  await browser.close();
})();
