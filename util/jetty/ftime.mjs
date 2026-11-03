// Still Water (games/contents_may_vary.html, ?world=jetty): a capture helper kept from the refinement session (November 2026).
// node util/jetty/ftime.mjs "refl=0&hide=oakF,pineF" 390 844   the time of one frame in the software renderer
// Needs a server on :8099 (npx http-server -p 8099 -s -c-1) and the pre-installed Playwright; see CONTENTS_MAY_VARY.md, box 7.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [q = '', w = 1280, h = 800] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto('http://localhost:8099/games/contents_may_vary.html?world=jetty&dpr=1&' + q, { waitUntil: 'domcontentloaded', timeout: 200000 });
let fr = null; for (let k = 0; k < 80 && !fr; k++) { fr = p.frames().find(f => f.url() === 'about:srcdoc'); if (!fr) await p.waitForTimeout(250); }
await p.waitForTimeout(3000);
for (let k = 0; k < 2; k++) console.log(await fr.evaluate(() => { const t = performance.now(); K.debug.snap(); return (performance.now() - t).toFixed(0) + ' ms'; }, null, { timeout: 300000 }));
await b.close();
