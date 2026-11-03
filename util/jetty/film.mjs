// Still Water (games/contents_may_vary.html, ?world=jetty): a capture helper kept from the refinement session (November 2026).
// node util/jetty/film.mjs 390 844 out/p_ [first]   fifteen key moments (start, cast, tench in the lilies, pike, wels, landing, dusk, night, dark, bell,
// logbook, the Old One, the rods on rests, a shower, a fight off a rest) with the HUD; [first] skips to the scene whose name starts so
// Needs a server on :8099 (npx http-server -p 8099 -s -c-1) and the pre-installed Playwright; see CONTENTS_MAY_VARY.md, box 7.
// phone frames of the key moments, HUD included: node .work/film.mjs w h prefix
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [w, h, pre, from] = process.argv.slice(2);
const SC = [['01_start', 'tod=0.22', null], ['02_wait', 'scene=min3&tod=0.3', "(() => { const S = K.debug.state(); CORE.act(S, 'cast', .8, 0); })()"],
  ['03_tench', 'scene=fight:tench', "(() => { const F = K.debug.state().fish; F.mode = 'run'; F.mt = 4; F.dir = 1; F.lat = 3.5; })()"],
  ['04_pike_rise', 'scene=jump:pike', null], ['05_wels_sulk', 'scene=fight:catfish', "(() => { const F = K.debug.state().fish; F.mode = 'sulk'; F.mt = 99; F.need = 4; F.pump = 1; })()"],
  ['06_land_carp', 'scene=land:carp', null], ['07_dusk', 'scene=min14&tod=0.58', null], ['08_night', 'scene=night', null], ['09_dark', 'scene=dark', null],
  ['10_bell', 'scene=bell', null], ['11_book', 'scene=min30&tod=0.3', "document.getElementById('bookBtn').click()"], ['12_old', 'scene=land:old', null],
  ['13_pods', 'scene=pods&tod=0.3', "K.debug.look(0, 'e+1.2', .5, -.3)"], ['14_rain', 'scene=min14&tod=0.3&rain=1', "(() => { const S = K.debug.state(); CORE.act(S, 'cast', .8, 0); })()"],
  ['15_pod_fight', 'scene=pods&tod=0.3', "K.debug.takePod(2)"]];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, q, js] of SC.filter((c, i, a) => !from || i >= a.findIndex(x => x[0].startsWith(from)))) {
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8099/games/contents_may_vary.html?world=jetty&dpr=1&' + q, { waitUntil: 'domcontentloaded', timeout: 90000 });
  let fr = null; for (let k = 0; k < 80 && !fr; k++) { fr = p.frames().find(f => f.url() === 'about:srcdoc'); if (!fr) await p.waitForTimeout(250); }
  await p.waitForTimeout(7000); if (js) { await fr.evaluate(js); await p.waitForTimeout(3500); }
  await p.screenshot({ path: pre + name + '.png', timeout: 180000 }); console.log(name, errs.join(' | ') || 'ok'); await p.close();
}
await b.close();
