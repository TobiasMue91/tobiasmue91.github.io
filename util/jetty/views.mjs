// Still Water (games/contents_may_vary.html, ?world=jetty): a capture helper kept from the refinement session (November 2026).
// node util/jetty/views.mjs out/v_ "tod=0.3" 800 600 name:x,z,yaw,pitch ...   the canvas alone from any place (z as e+1.2: from the jetty's end)
// Needs a server on :8099 (npx http-server -p 8099 -s -c-1) and the pre-installed Playwright; see CONTENTS_MAY_VARY.md, box 7.
// several canvas views in one browser: node .work/views.mjs prefix "query" w h  name:x,z,yaw,pitch ...
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [pre, q, w, h, ...views] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8099/games/contents_may_vary.html?world=jetty&dpr=1&' + q, { waitUntil: 'domcontentloaded', timeout: 90000 });
let fr = null; for (let k = 0; k < 80 && !fr; k++) { fr = p.frames().find(f => f.url() === 'about:srcdoc'); if (!fr) await p.waitForTimeout(250); }
await p.waitForTimeout(8000);
for (const v of views) { const [name, a] = v.split(':'); const [x, z, yaw, pitch] = a.split(",").map(v => v[0] === "e" ? v : Number(v));
  const d = await fr.evaluate(([x, z, yaw, pitch]) => { K.debug.look(x, z, yaw, pitch); return K.debug.snap(); }, [x, z, yaw, pitch], { timeout: 120000 });
  fs.writeFileSync(pre + name + '.png', Buffer.from(d.split(',')[1], 'base64')); }
console.log(errs.join('\n') || 'no errors'); await b.close();
