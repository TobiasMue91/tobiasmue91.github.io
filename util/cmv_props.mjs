#!/usr/bin/env node
// Close-ups of every prop of a Contents May Vary box, on one contact sheet, so that small drawing faults (a part
// floating free, a line where two shapes were joined, a glass both clear and solid, a light that stops dead) are
// seen before a player sees them. Each box lists its props in K.debug.props as [name, minutes, x, y, scale]; the
// script opens ?world=<id>&at=<minutes>, points the camera there with K.debug.look and shoots the box's canvas.
//
//   npx http-server -p 8099 -s -c-1 &
//   node util/cmv_props.mjs starter [outdir]        # writes <outdir>/props_<id>_<n>.png and an index of names
//
// Look at every tile at full size; it is the step that the play-size filmstrips cannot replace.
import { mkdirSync, writeFileSync, existsSync } from 'fs';
// Playwright from the project, or the copy preinstalled with Chromium (as test/contents_may_vary.mjs finds it)
let chromium; try { ({ chromium } = await import('playwright')); } catch (e) { for (const q of ['/opt/node22/lib/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright/index.mjs']) if (!chromium && existsSync(q)) ({ chromium } = await import(q)); }
if (!chromium) { console.log('needs Playwright'); process.exit(1); }
const [,, id = 'starter', out = 'props'] = process.argv, base = process.env.CMV_URL || 'http://localhost:8099/games/contents_may_vary.html';
mkdirSync(out, { recursive: true });
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const frame = async () => { for (let k = 0; k < 80; k++) { const f = p.frames().find(x => x.url() === 'about:srcdoc'); if (f && await f.evaluate(() => !!(window.K && K.debug && K.debug.state && K.debug.state())).catch(() => false)) return f; await p.waitForTimeout(250); } throw new Error('the box did not start'); };
let f = null, at = -1, n = 0; const index = [];
const props = await (async () => { await p.goto(base + '?world=' + id + '&seed=1'); return (await frame()).evaluate(() => K.debug.props || []); })();
if (!props.length) { console.log('K.debug.props is empty for ' + id); process.exit(1); }
for (const [name, min, x, y, s] of props.slice().sort((a, b) => a[1] - b[1])) {
  if (min !== at) { await p.goto(base + '?world=' + id + '&seed=1&at=' + min); f = await frame(); at = min; await p.waitForTimeout(1500); }
  await f.evaluate(([x, y, s]) => K.debug.look(x, y, s), [x, y, s]); await p.waitForTimeout(400);
  const file = `${out}/props_${id}_${String(++n).padStart(2, '0')}.png`;
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 900, height: 800 } });
  index.push(`${n}\t${name}\t${file}`);
}
writeFileSync(`${out}/props_${id}.txt`, index.join('\n') + '\n');
console.log(index.join('\n'));
await b.close();
