#!/usr/bin/env node
// Close-ups of every prop of a Contents May Vary box, on one contact sheet, so that small drawing faults (a part
// floating free, a line where two shapes were joined, a glass both clear and solid, a light that stops dead) are
// seen before a player sees them. Each box lists its props in K.debug.props as [name, minutes, x, y, scale, options]
// (options optional, handed to look as they are; options.scene opens ?scene=<name> instead of ?at=<minutes>, for a box
// that can reach its own moments); the script opens ?world=<id>&at=<minutes>, points the camera there
// with K.debug.look and shoots the box. A box that draws in WebGL also has K.debug.snap(), which renders a frame and
// returns the canvas itself as a data URL: that is what is saved then, because a page screenshot of a WebGL canvas
// can lie (headless Chromium drops what lies under a backdrop-filter) and would show the interface over the prop.
//
//   npx http-server -p 8099 -s -c-1 &
//   node util/cmv_props.mjs starter [outdir]        # writes <outdir>/props_<id>_<n>.png and an index of names
//   node util/cmv_props.mjs lawn props 'tree'       # only the props whose name contains 'tree'
//
// Look at every tile at full size; it is the step that the play-size filmstrips cannot replace.
import { mkdirSync, writeFileSync, existsSync } from 'fs';
// Playwright from the project, or the copy preinstalled with Chromium (as test/contents_may_vary.mjs finds it)
let chromium; try { ({ chromium } = await import('playwright')); } catch (e) { for (const q of ['/opt/node22/lib/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright/index.mjs']) if (!chromium && existsSync(q)) ({ chromium } = await import(q)); }
if (!chromium) { console.log('needs Playwright'); process.exit(1); }
const [,, id = 'starter', out = 'props', only = ''] = process.argv, base = process.env.CMV_URL || 'http://localhost:8099/games/contents_may_vary.html';
mkdirSync(out, { recursive: true });
// WebGL in software, as the test suite does: headless Chromium has no GPU
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const frame = async () => { for (let k = 0; k < 480; k++) { const f = p.frames().find(x => x.url() === 'about:srcdoc'); if (f && await f.evaluate(() => !!(window.K && K.debug && K.debug.state && K.debug.state())).catch(() => false)) return f; await p.waitForTimeout(250); } throw new Error('the box did not start'); };
let f = null, at = '', n = 0; const index = [];
const props = await (async () => { await p.goto(base + '?world=' + id + '&seed=1'); return (await frame()).evaluate(() => K.debug.props || []); })();
if (!props.length) { console.log('K.debug.props is empty for ' + id); process.exit(1); }
for (const [name, min, x, y, s, o] of props.slice().sort((a, b) => a[1] - b[1])) {
  if (only && !name.includes(only)) continue;
  const where = o && o.scene ? '&scene=' + o.scene : '&at=' + min;   // a box may name a scene it can reach by itself
  if (where !== at) { await p.goto(base + '?world=' + id + '&seed=1' + where); f = await frame(); at = where; await p.waitForTimeout(1500); }
  await f.evaluate(([x, y, s, o]) => K.debug.look(x, y, s, o), [x, y, s, o || {}]);
  // wait in the box's own time where it keeps one (a software renderer may draw one frame in two seconds), else by the clock
  const t0 = await f.evaluate(() => { const S = K.debug.state(); return S && typeof S.t === 'number' ? S.t : null; });
  if (t0 == null) await p.waitForTimeout(o && o.setup ? 2500 : 400);
  else for (let k = 0; k < 600 && (await f.evaluate(() => K.debug.state().t)) - t0 < (o && o.setup ? 3 : .3); k++) await p.waitForTimeout(100);
  const file = `${out}/props_${id}_${String(++n).padStart(2, '0')}.png`;
  const url = await f.evaluate(() => K.debug.snap ? K.debug.snap() : null);
  if (url) writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  else await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 900, height: 800 } });
  index.push(`${n}\t${name}\t${file}`);
}
writeFileSync(`${out}/props_${id}.txt`, index.join('\n') + '\n');
console.log(index.join('\n'));
await b.close();
