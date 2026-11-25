// Shared by film.js and hunt.js: open Lanternwind in headless Chromium (SwiftShader), serve the repo from disk.
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
async function openGame(o) {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.mobile, isMobile: !!o.mobile });
  p.on('pageerror', e => console.log('pageerror', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 400)); });
  await p.route('http://localhost:8099/**', async route => {
    const fp = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
    try { await route.fulfill({ body: fs.readFileSync(fp), contentType: fp.endsWith('.html') ? 'text/html' : undefined }); } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await p.goto('http://localhost:8099/games/lanternwind.html' + (o.query || ''));
  await p.waitForFunction(() => window.__lw && window.__lw.S.mode === 'title', null, { timeout: 240000 });
  return { browser: b, page: p };
}
module.exports = { openGame };
