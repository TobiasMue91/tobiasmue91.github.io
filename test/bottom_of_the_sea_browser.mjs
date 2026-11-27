#!/usr/bin/env node
// Browser suite for games/bottom_of_the_sea.html: the real page, its view and its UI, driven in headless Chromium.
//
// test/bottom_of_the_sea.mjs checks the rules and the pacing in Node. This one checks what only the page can get wrong:
//   play     - the eager bot plays a whole sea through the page itself (shop, HUD, events, gear, fish, finale) with frames
//              stepped by hand through window.__bots, drawing one now and then. It promises no page error and no console
//              error on the way, the plug pulled and the end card shown, every find picked up, the hotel sign at its last
//              name, a save in localStorage that brings the empty sea back after a reload, and water drops in the air
//              while helpers work.
//   german   - with ?lang=de the menu, the shop and the HUD speak German, and none of a list of English phrases is left.
//   duck     - a rubber duck bobs up in view, a click on it where it is drawn starts the boost, and it dips away again.
//   offline  - a save whose lastSeen is two hours old comes back with a toast about what the helpers did meanwhile.
// SwiftShader draws a frame in about a second here, so the suite draws as few as it can; about five minutes in all.
// Needs Playwright's Chromium and network access to cdn.jsdelivr.net (three.js).
//   node test/bottom_of_the_sea_browser.mjs [play] [german] [duck] [offline]      (npm run test:sea-browser)

import {createServer} from 'http';
import {readFileSync, existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join, extname} from 'path';
import {createRequire} from 'module';
import {execSync} from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const want = process.argv.slice(2), run = s => !want.length || want.includes(s);
let fails = 0, n = 0;
const ok = (c, m, d) => { n++; console.log((c ? 'ok    ' : 'FAIL  ') + m + (!c && d ? '\n        ' + d : '')); if (!c) fails++; };
const info = m => console.log('      ' + m);

let chromium;
try { ({chromium} = await import('playwright')); } catch (e) {
    try { ({chromium} = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright')); } catch (e2) { console.log('skip  (no Playwright)'); process.exit(0); }
}
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp'};
const server = createServer((req, res) => {
    const f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream'}); res.end(readFileSync(f));
}).listen(0);
const URL_ = q => `http://localhost:${server.address().port}/games/bottom_of_the_sea.html?noadapt&q=low${q || ''}`;
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let browser;
try { browser = await chromium.launch({args}); } catch (e) { browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args}); }

// a page whose own loop is off: the suite steps the frames
async function open(q, init) {
    const ctx = await browser.newContext({viewport: {width: 1200, height: 800}});
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/GPU stall|Mismatch|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
    await page.addInitScript(init || (() => {}));
    await page.addInitScript(() => { window.__botsManual = true; });
    await page.goto(URL_(q));
    await page.waitForFunction(() => (window.__bots && window.__bots.V.mode === 'title') || /Could not/.test(document.querySelector('#loadmsg').textContent), null, {timeout: 240000});
    return {page, ctx, errs};
}

if (run('play')) {
    console.log('\n=== play ===');
    // a clean slate on the first load only: the reload at the end must find the save
    const {page, ctx, errs} = await open('', () => { try { if (!sessionStorage.getItem('fresh')) { localStorage.clear(); sessionStorage.setItem('fresh', '1'); } } catch (e) {} });
    await page.evaluate(() => window.__bots.start());
    const r = await page.evaluate(() => {
        const B = window.__bots, S = B.S, SEA = B.SEA, mem = {cps: 6, notice: 2, seen: {}, thinkT: 0};
        let acc = 0, think = 0, t = 0, maxDrops = 0;
        const dt = 1 / 10;
        while (t < 40 * 60 && !S.done) {
            acc += 6 * dt; while (acc >= 1) { acc--; SEA.act(S, 'scoop'); }
            think -= dt; if (think <= 0) { think = 1; SEA.botTurn(S, mem, 'eager'); }
            const draw = Math.round(t * 10) % 1200 === 600;   // a frame drawn every two minutes
            B.frame(dt, 1, !draw); t += dt;
            if (draw) { const d = B.drops(), now = B.U.uTime.value; let k = 0; for (let i = 0; i < d.cap; i++) { const a = now - d.tt[i * 2]; if (a >= 0 && a <= d.tt[i * 2 + 1]) k++; } maxDrops = Math.max(maxDrops, k); }
        }
        for (let i = 0; i < 160; i++) B.frame(1 / 10, 1, i % 40 !== 39);
        return { t, done: S.done, mode: B.V.mode, endShown: !document.querySelector('#end').classList.contains('hidden'),
                 found: Object.keys(S.found).length, recs: Object.keys(S.rec).length, sign: B.V.village.userData.sign.userData.name,
                 saved: !!localStorage.getItem('bottom_of_the_sea_v1'), maxDrops, gear: B.V.sponge !== undefined };
    });
    info(`plug pulled at ${(r.t / 60).toFixed(1)} min of play, ${r.recs} records, up to ${r.maxDrops} drops in the air`);
    ok(r.done && r.mode === 'end' && r.endShown, 'the bot reaches the plug and the end card is shown');
    ok(r.found === 7, 'every find is picked up on the way', `${r.found} of 7`);
    ok(r.sign === 'HOTEL', 'the hotel sign has lost its view by the end', r.sign);
    ok(r.maxDrops > 200, 'helpers throw water you can see', `${r.maxDrops} drops`);
    ok(r.saved, 'the game is saved in localStorage');
    ok(!errs.length, 'no page or console error in a whole game', errs.slice(0, 5).join(' | '));
    // and back: the empty sea is still empty after a reload
    await page.reload();
    await page.waitForFunction(() => window.__bots && window.__bots.V.mode === 'title', null, {timeout: 240000});
    const back = await page.evaluate(() => { window.__bots.start(); window.__bots.frame(1 / 30, 3, true); return { done: window.__bots.S.done, mode: window.__bots.V.mode, play: document.querySelector('#play').textContent }; });
    ok(back.done && back.mode === 'end', 'after a reload the sea is still empty and the game knows it is over', JSON.stringify(back));
    await ctx.close();
}

if (run('german')) {
    console.log('\n=== german ===');
    const {page, ctx, errs} = await open('&lang=de', () => { try { localStorage.clear(); } catch (e) {} });
    const r = await page.evaluate(() => {
        const B = window.__bots, S = B.S; B.start(); S.tool = 7; S.helpers = [40, 30, 22, 8, 0, 0, 0]; S.storage = 8; S.water = 1e11; S.found.flipflop = true;
        B.setP(0.45); B.frame(1 / 10, 30, true);
        document.querySelector('#menuBtn').click(); B.frame(1 / 10, 3, true);
        const text = document.body.innerText;
        return { h2: document.querySelector('#pause h2').textContent, shop: document.querySelector('#shop h2').textContent, level: document.querySelector('#level').textContent, text };
    });
    ok(r.h2 === 'Einstellungen' && r.shop === 'Ausrüstung', 'menu and shop are German', `${r.h2} / ${r.shop}`);
    ok(/unter dem Meeresspiegel/.test(r.level) && /\d\.\d{3}/.test(r.level), 'the depth reads in German with German digit grouping', r.level);
    const english = [' per scoop', 'needs bigger storage', 'in all ·', 'the next adds', 'Helpers turn up', 'Your scoop', 'below sea level', 'Back to scooping', 'Scoops by hand', 'Supplies', 'Coastal authorities', 'A crab has noticed'];
    const left = english.filter(w => r.text.includes(w));
    ok(!left.length, 'no English phrase is left on the screen', left.join(', '));
    ok(!errs.length, 'no error in German', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (run('duck')) {
    console.log('\n=== duck ===');
    const {page, ctx, errs} = await open('', () => { try { localStorage.clear(); } catch (e) {} });
    const r = await page.evaluate(() => {
        const B = window.__bots, V = B.V; B.start(); B.setP(0.3); B.frame(1 / 10, 40, true);
        V.duck.wait = 0; B.frame(1 / 10, 20, true); B.frame(1 / 30, 1);   // one drawn frame: world matrices are brought up to date when drawing
        const up = V.duck.state, p = V.duck.g.position.clone().project(B.camera);
        const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight, c = document.querySelector('#gl');
        c.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
        const boost = B.S.boostT, rate = document.querySelector('#rRate').textContent;
        B.frame(1 / 10, 25, true);
        return { up, boost, state: V.duck.state, visible: V.duck.g.visible, ducks: B.S.ducks, rate };
    });
    ok(r.up === 'swim', 'a duck bobs up and swims', r.up);
    ok(r.boost > 25 && r.ducks === 1, 'clicking it starts the boost', JSON.stringify(r));
    ok(r.state === null && !r.visible, 'and it dips back under, gone after a moment', `${r.state} ${r.visible}`);
    ok(!errs.length, 'no error with the duck', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (run('offline')) {
    console.log('\n=== offline ===');
    const save = JSON.stringify({ v: 1, t: 600, water: 0, removed: 1e9, tool: 5, storage: 6, helpers: [40, 20, 0, 0, 0, 0, 0], found: {}, exposed: {}, scoops: 500, lastSeen: Date.now() - 2 * 3600 * 1000, rec: {} });
    const {page, ctx, errs} = await open('', new Function(`try { localStorage.setItem('bottom_of_the_sea_v1', ${JSON.stringify(save)}); } catch (e) {}`));
    const r = await page.evaluate(() => { const B = window.__bots; const before = B.S.removed; B.start(); B.frame(1 / 10, 20, true); return { gained: B.S.removed - before, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '), play: document.querySelector('#play').textContent }; });
    ok(r.gained > 0, 'two hours away: the helpers took water out meanwhile', `+${r.gained.toExponential(2)} L`);
    ok(/away for 2 h/.test(r.toasts), 'and a toast says so', r.toasts);
    ok(!errs.length, 'no error coming back', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${n - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
