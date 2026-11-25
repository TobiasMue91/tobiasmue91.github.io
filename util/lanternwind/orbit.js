// Close-ups of any point with the photo-orbit camera (the glider is shrunk away and its lantern light switched off).
// node util/lanternwind/orbit.js out/wall '{"at":[x,y,z],"shots":[[dist,yaw,pitch],...],"tod":0.38,"setup":"JS; L is __lw, o the options (may set o.at)"}'
// e.g. the terrace wall: '{"setup":"const c=L.beacons.find(b=>b.central).pos;o.at=[c.x+20,c.y+3.5,c.z+6];","at":[0,0,0],"shots":[[6,0.6,0.15],[3,1.2,0.05]]}'
const { openGame } = require('./_page');
const out = process.argv[2];
const o = Object.assign({ tod: 0.38, t: 100, w: 960, h: 540, q: 'high', setup: '' }, JSON.parse(process.argv[3] || '{}'));
(async () => {
  const { browser, page } = await openGame(o);
  await page.evaluate(o => {
    window.__lwManual = true; const L = __lw; L.applyQuality(o.q); L.S.noAdapt = true;
    L.startGame(); document.querySelector('#title').classList.add('hidden');
    document.querySelectorAll('#hud,#msg,#hint,#photo').forEach(e => e.style.visibility = 'hidden');
    L.setTod(o.tod); L.U.uTime.value = o.t; if (o.setup) eval(o.setup);
    L.teleport(o.at[0], o.at[1], o.at[2], 0, 0); L.setMode('photo');
    for (let k = 0; k < 20; k++) L.frame(1/30, false, true);
  }, o);
  let n = 0;
  for (const [d, y, p] of o.shots) {
    await page.evaluate(([d, y, p]) => { const L = __lw; const orb = L.camState.orbit; orb.yaw = y; orb.pitch = p; orb.dist = d;
      for (let k = 0; k < 6; k++) { L.glider.scale.setScalar(1e-4); L.glider.traverse(q => { if (q.isLight) q.visible = false; }); L.frame(1/30, false, k < 5); } }, [d, y, p]);
    await page.screenshot({ path: `${out}_${String(n++).padStart(2, '0')}.png`, timeout: 300000 });
  }
  await browser.close();
})();
