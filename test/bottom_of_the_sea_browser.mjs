#!/usr/bin/env node
// Browser suite for games/bottom_of_the_sea.html: the real page, its view and its input, driven in headless Chromium.
//
// test/bottom_of_the_sea.mjs checks the rules and the pacing in Node. This one checks what only the page can get wrong:
//   beach   - first person, by real input: W walks you down the sand (and the walk is counted), a click on the water
//             scoops into the bag, a full bag says so and points the way to the machine, a click on the machine walks you up to it and sells, the receipt
//             prints the sea's remaining litres, and the machine's face shows the new price after a contract.
//   career  - the rest of a game, bought through the core but seen through the page: the beach view lifts into the view
//             over the bay at the promotion (the pipeline lying on the sand, statements coming in by the minute), a button
//             takes management back down to the water's edge and up again, a click from orbit sends the Moon spoon down, then cuts to the planet, whose glint is clicked when the plug comes clear;
//             at the bottom a click on the plug pulls it, and the end card comes up. No page or console error on the way,
//             and after a reload the game knows the sea is empty and opens at the bottom.
//   mouse    - on a desktop the first click captures the mouse, moving it turns you, a click acts at the crosshair, Shift
//              runs once you own running shoes, Tab hands the mouse back for the shop, and the view from above keeps
//              the mouse: it swings the camera, W A S D slide the view; the planet stops when turned, the plug keeps
//              the mouse, the open drain at the end leads somewhere and back. The pier can be walked on.
//   walk     - a bot walks the real beach through the page's own goals, scooping and selling and buying the cheapest
//              thing at the machine; the pipeline comes about when the core's straight-line reckoning says it would.
//   duck     - a rubber duck bobs up in front of you, a click on it where it is drawn starts the boost, and it dips away.
//   offline  - a save whose lastSeen is two hours old comes back with a toast about what the helpers sold meanwhile.
// SwiftShader draws a frame in about a second here, so the suite draws as few as it can; a few minutes in all.
// Needs Playwright's Chromium and network access to cdn.jsdelivr.net (three.js).
//   node test/bottom_of_the_sea_browser.mjs [beach] [career] [mouse] [walk] [duck] [offline]      (npm run test:sea-browser)

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
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg'};
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
const frames = (page, n, dt = 1 / 30) => page.evaluate(([n, dt]) => window.__bots.frame(dt, n, true), [n, dt]);

if (run('beach')) {
    console.log('\n=== beach ===');
    const {page, ctx, errs} = await open('', () => { try { localStorage.clear(); } catch (e) {} });
    await page.evaluate(() => { window.__bots.start(); window.__bots.goto(0.4, 6, 0, -0.1); });
    await frames(page, 2);
    // W walks you down to the water
    const z0 = await page.evaluate(() => window.__bots.V.player.z);
    await page.keyboard.down('KeyW'); await frames(page, 150); await page.keyboard.up('KeyW'); await frames(page, 10);
    const w = await page.evaluate(() => ({ z: window.__bots.V.player.z, walked: window.__bots.S.walked, can: window.__bots.canScoop() }));
    ok(w.z < z0 - 6 && w.walked > 6, 'W walks you down the sand, and the walk is counted', JSON.stringify(w));
    ok(w.can, 'down at the water you can scoop', JSON.stringify(w));
    // a click on the water scoops into the bag, until it is full
    await page.evaluate(() => { const B = window.__bots; B.goto(B.V.player.x, B.V.player.z, 0, -0.5); B.frame(1 / 30, 1); });
    for (let i = 0; i < 16; i++) { await page.mouse.click(600, 560); await frames(page, 4); }
    const s = await page.evaluate(() => ({ held: window.__bots.S.held, cap: window.__bots.SEA.capOf(window.__bots.S), scoops: window.__bots.S.scoops, removed: window.__bots.S.removed, hint: document.querySelector('#hint').textContent, carry: document.querySelector('#carry').className }));
    ok(s.scoops >= 12 && s.held === s.cap && s.removed === s.cap, 'clicks on the water scoop it into the bag until the bag is full', JSON.stringify(s));
    ok(/full/i.test(s.hint) && /full/.test(s.carry), 'a full bag says so', s.hint);
    await frames(page, 15);
    const nav = await page.evaluate(() => ({ o: +document.querySelector('#nav').style.opacity, d: document.querySelector('#navD').textContent }));
    ok(nav.o > 0.8 && /Sell it here · \d+ m/.test(nav.d), 'and a pointer shows the way to the machine', JSON.stringify(nav));
    // a click on the machine walks you up to it and sells
    await page.evaluate(() => { const B = window.__bots; B.goto(B.V.player.x, B.V.player.z, Math.PI, 0.05); B.frame(1 / 30, 1); });
    const m = await page.evaluate(() => window.__bots.machineXY());
    await page.mouse.click(m.x, m.y);
    for (let i = 0; i < 20 && await page.evaluate(() => window.__bots.S.held > 0); i++) await frames(page, 30);
    await frames(page, 2);
    const sold = await page.evaluate(() => ({ held: window.__bots.S.held, money: window.__bots.S.money, near: window.__bots.near(), receipt: document.querySelector('#receipt').textContent, on: document.querySelector('#receipt').classList.contains('on'), shop: document.querySelector('#shop').classList.contains('open') }));
    ok(sold.held === 0 && Math.abs(sold.money - s.cap * 0.05) < 1e-9 && sold.near, 'a click on the machine walks you up to it and sells the bag', JSON.stringify(sold).slice(0, 200));
    ok(sold.on && /1,334,999,999,999,999,999,99\d L/.test(sold.receipt) && /TOTAL/.test(sold.receipt), 'the receipt prints what is still in the sea', sold.receipt);
    ok(sold.shop, 'and the shop opens at the machine');
    // the machine's face follows the price
    const face = await page.evaluate(() => { const B = window.__bots; B.S.money = 10; B.SEA.act(B.S, 'buy', 'contract'); B.frame(1 / 30, 3, true); return B.scene.children.find(o => o.userData && o.userData.price).userData.price; });
    ok(face === '12.5¢', 'after a contract the machine shows the new price', face);
    ok(!errs.length, 'no page or console error on the beach', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (run('career')) {
    console.log('\n=== career ===');
    const {page, ctx, errs} = await open('', () => { try { if (!sessionStorage.getItem('fresh')) { localStorage.clear(); sessionStorage.setItem('fresh', '1'); } } catch (e) {} });
    await page.evaluate(() => window.__bots.start());
    // the beach, bought out; the water down to the promotion
    const r1 = await page.evaluate(() => {
        const B = window.__bots, S = B.S, SEA = B.SEA; S.money = 1e12;
        for (let i = 0; i < 20; i++) for (const r of ['tool', 'carry', 'move', 'contract', 'buyer']) SEA.act(S, 'buy', r);
        for (let k = 0; k < 5; k++) SEA.act(S, 'helper', k, 10);
        B.setP(0.37); B.advance(64);
        const gear = { walkers: B.scene.children.some(o => o.children && o.children.some(c => c.isInstancedMesh && c.count > 10)),
                       pipe: B.scene.children.some(o => o.children && o.children.some(c => c.isMesh && c.geometry.type === 'TubeGeometry' && c.material.color && c.material.color.getHex() === 0x2f6fb0 && c.visible)),
                       statements: S.ui.stmt | 0 };
        SEA.act(S, 'stage'); B.frame(1 / 30, 1, true);
        const flying = !!B.V.fly; B.frame(1 / 30, 130, true); B.frame(1 / 30, 1);
        return { view: B.V.view, flying, landed: !B.V.fly, camY: B.camera.position.y, gear, finds: Object.keys(S.found).length };
    });
    ok(r1.view === 'air' && r1.flying && r1.landed && r1.camY > 300, 'the promotion lifts the view off the beach to above the bay', JSON.stringify(r1));
    ok(r1.gear.walkers, 'helpers walk the beach with their buckets');
    ok(r1.gear.pipe, 'the pipeline lies on the sand from the machine to you');
    ok(r1.gear.statements >= 1, 'with the money coming in by itself the buyer posts a statement every minute', JSON.stringify(r1.gear));
    // management may still go down and look
    await page.click('#viewBtn'); await frames(page, 100);
    const down = await page.evaluate(() => { const B = window.__bots; B.frame(1 / 30, 1); return { view: B.V.view, z: B.V.player.z, edge: B.edge(B.V.player.x), camY: B.camera.position.y, eye: B.camera.position.y - B.V.wy }; });
    ok(down.view === 'beach' && Math.abs(down.z - down.edge) < 12 && down.eye < 4, 'the office button puts you back on your feet at the water\'s edge', JSON.stringify(down));
    await page.click('#viewBtn'); await frames(page, 130);
    ok(await page.evaluate(() => window.__bots.V.view === 'air' && window.__bots.camera.position.y > 300), 'and takes you back up');
    // the planet, and the plug from orbit
    const r2 = await page.evaluate(() => {
        const B = window.__bots, S = B.S, SEA = B.SEA; S.money = 1e30;
        B.setP(0.65); B.advance(5); SEA.act(S, 'stage'); B.frame(1 / 30, 60, true);
        const view = B.V.view;
        for (let i = 0; i < 14; i++) { SEA.act(S, 'buy', 'buyer'); SEA.act(S, 'buy', 'tool'); }
        B.setP(0.99); B.advance(30);
        const g = B.globe(); g.view.yaw = Math.atan2(g.plugDir.x, g.plugDir.z); g.view.pitch = Math.asin(g.plugDir.y); g.view.vyaw = 0; B.frame(1 / 30, 2);
        B.click(innerWidth * 0.3, innerHeight * 0.5); B.frame(1 / 30, 25, true);
        const spoon = { kind: g.scooperKind, r: g.sc.pos.length(), busy: !!g.sc.job };
        B.frame(1 / 30, 120, true);
        return { view, plug: !!S.exposed.plug, level: g.u.uLevel.value, xy: B.glintXY(), spoon };
    });
    ok(r2.view === 'globe' && r2.plug && r2.level < 0, 'the planet: the oceans shrink until the plug comes clear', JSON.stringify(r2));
    ok(r2.spoon.kind === 'spoon' && r2.spoon.busy && r2.spoon.r < 1.6, 'a click sends the Moon spoon down to the sea', JSON.stringify(r2.spoon));
    await page.mouse.click(r2.xy.x, r2.xy.y); await frames(page, 60);
    const r3 = await page.evaluate(() => { const B = window.__bots; B.goto(0, 30, 0, 0.25); B.frame(1 / 30, 1); return { view: B.V.view, xy: B.plugXY() }; });
    ok(r3.view === 'plug', 'a click on the glint takes you down to the plug', JSON.stringify(r3));
    await page.mouse.click(r3.xy.x, r3.xy.y); await frames(page, 30);
    await frames(page, 480, 1 / 30);
    const r4 = await page.evaluate(() => ({ done: window.__bots.S.done, mode: window.__bots.V.mode, end: !document.querySelector('#end').classList.contains('hidden'), saved: !!localStorage.getItem('bottom_of_the_sea_v2'), recs: Object.keys(window.__bots.S.rec).length }));
    ok(r4.done && r4.mode === 'end' && r4.end, 'a click on the plug pulls it, and the end card comes up', JSON.stringify(r4));
    ok(r4.saved, 'the game is saved in localStorage');
    ok(!errs.length, 'no page or console error in a whole career', errs.slice(0, 5).join(' | '));
    await page.reload();
    await page.waitForFunction(() => window.__bots && window.__bots.V.mode === 'title', null, {timeout: 240000});
    const back = await page.evaluate(() => { window.__bots.start(); window.__bots.frame(1 / 30, 3, true); return { done: window.__bots.S.done, mode: window.__bots.V.mode, view: window.__bots.V.view, play: document.querySelector('#play').textContent }; });
    ok(back.done && back.mode === 'end' && back.view === 'plug', 'after a reload the sea is still empty and you are at the bottom', JSON.stringify(back));
    await ctx.close();
}

if (run('mouse')) {
    console.log('\n=== mouse ===');
    // the desktop: a click captures the mouse, moving it turns your head, a click then acts at the crosshair, Tab frees it
    const {page, ctx, errs} = await open('', () => { try { localStorage.clear(); } catch (e) {} window.__botsLock = true; });
    await page.evaluate(() => { const B = window.__bots; B.start(); B.frame(1 / 30, 40, true); B.goto(0.4, -2.5, 0, -0.5); B.frame(1 / 30, 2); });
    await page.mouse.click(600, 560); await frames(page, 4);
    const r1 = await page.evaluate(() => ({ locked: document.pointerLockElement === document.querySelector('#gl'), scoops: window.__bots.S.scoops, yaw: window.__bots.V.player.yaw }));
    ok(r1.locked && r1.scoops === 1, 'the first click acts and captures the mouse', JSON.stringify(r1));
    // headless Chromium reports no movement under a captured mouse: the event the browser would send, sent by hand
    await page.evaluate(() => document.querySelector('#gl').dispatchEvent(new PointerEvent('pointermove', { movementX: 120, movementY: 0, bubbles: true }))); await frames(page, 2);
    const yaw = await page.evaluate(() => window.__bots.V.player.yaw);
    ok(yaw < r1.yaw - 0.1, 'moving the mouse to the right turns you right', `${r1.yaw} -> ${yaw}`);
    await page.evaluate(() => window.__bots.goto(window.__bots.V.player.x, window.__bots.V.player.z, 0, -0.5));
    await page.mouse.click(100, 100); await frames(page, 4);
    ok(await page.evaluate(() => window.__bots.S.scoops) === 2, 'a click while captured scoops where the crosshair is, wherever the pointer was');
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await frames(page, 20);
    const run0 = await page.evaluate(() => window.__bots.V.runK);
    await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft');
    ok(run0 < 0.05, 'no running in bare feet', `${run0}`);
    await page.evaluate(() => { const B = window.__bots; B.S.money = 1; B.SEA.act(B.S, 'buy', 'move'); });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await frames(page, 20);
    const run1 = await page.evaluate(() => ({ k: window.__bots.V.runK, v: Math.hypot(window.__bots.V.player.vx, window.__bots.V.player.vz) }));
    await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft');
    ok(run1.k > 0.8 && run1.v > 5, 'with running shoes Shift runs', JSON.stringify(run1));
    await page.keyboard.press('Tab'); await frames(page, 2);
    const r3 = await page.evaluate(() => ({ locked: document.pointerLockElement === document.querySelector('#gl'), shop: document.querySelector('#shop').classList.contains('open'), paused: !!window.__bots.V.paused }));
    ok(!r3.locked && r3.shop && !r3.paused, 'Tab hands the mouse back for the shop without pausing', JSON.stringify(r3));
    // up to the office: the mouse stays captured, moving it swings the camera, W A S D slide the view over the coast
    await page.keyboard.press('Tab'); await frames(page, 2);
    await page.evaluate(() => { const B = window.__bots; B.S.stage = 1; B.view('air'); B.V.fly = null; B.frame(1 / 30, 2); });
    const a0 = await page.evaluate(() => ({ locked: document.pointerLockElement === document.querySelector('#gl'), x: window.__bots.camera.position.x, z: window.__bots.camera.position.z }));
    ok(a0.locked, 'the view from above keeps the mouse captured', JSON.stringify(a0));
    await page.evaluate(() => document.querySelector('#gl').dispatchEvent(new PointerEvent('pointermove', { movementX: 200, movementY: 0, bubbles: true }))); await frames(page, 2);
    const a1 = await page.evaluate(() => ({ x: window.__bots.camera.position.x, z: window.__bots.camera.position.z }));
    ok(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 50, 'moving the mouse swings the camera round the coast', JSON.stringify([a0, a1]));
    await page.keyboard.down('KeyD'); await frames(page, 30); await page.keyboard.up('KeyD');
    const a2 = await page.evaluate(() => window.__bots.V.airPan ? window.__bots.V.airPan.length() : 0);
    ok(a2 > 100, 'D slides the view along the coast', `${a2}`);
    // from orbit the planet stays where the mouse put it, and down at the plug the mouse is still captured
    const gl = await page.evaluate(() => { const B = window.__bots; B.S.stage = 2; B.view('globe'); B.frame(1 / 30, 2); document.querySelector('#gl').dispatchEvent(new PointerEvent('pointermove', { movementX: 60, movementY: 0, bubbles: true })); B.frame(1 / 30, 30); const y0 = B.globe().view.yaw; B.frame(1 / 30, 90); return { d: Math.abs(B.globe().view.yaw - y0) }; });
    ok(gl.d < 0.01, 'the planet stops turning once you have turned it', JSON.stringify(gl));
    await page.evaluate(() => { const B = window.__bots; B.view('plug'); B.frame(1 / 30, 2); });
    const pl = await page.evaluate(() => ({ locked: document.pointerLockElement === document.querySelector('#gl'), shop: document.querySelector('#shop').classList.contains('open') }));
    ok(pl.locked && !pl.shop, 'at the plug the mouse is still captured and the shop is shut', JSON.stringify(pl));
    // after the end, into the open drain: down the pipe, out of a tap over a bath, and back up again
    const hole = await page.evaluate(() => { const B = window.__bots, V = B.V; B.S.done = true; B.S.doneT = B.S.t; B.view('plug'); B.finale().pulled = true; B.finale().t = 99; B.goto(0, 4, 0, -0.2); B.frame(1 / 30, 2); const r = { entered: V.view }; for (let i = 0; i < 170; i++) B.frame(1 / 10, 1, true); r.card = !document.querySelector('#card').classList.contains('hidden'); document.querySelector('#cardOk').click(); B.interact(); for (let i = 0; i < 30; i++) B.frame(1 / 10, 1, true); r.back = V.view; r.hud = document.querySelector('#hud').style.visibility; return r; });
    ok(hole.entered === 'hole' && hole.card && hole.back === 'plug' && hole.hud === '', 'the open drain leads somewhere, and back', JSON.stringify(hole));
    // the pier: up its steps from the dune and out along the deck, held between the railings
    const pier = await page.evaluate(() => { const B = window.__bots, V = B.V, p = V.pier; B.view('beach'); B.S.stage = 0; V.keys = {}; B.goto((p.x0 + p.x1) / 2 + 1.5, p.z0 + 3, 0.15, -0.1); V.keys.KeyW = true; for (let i = 0; i < 450; i++) B.frame(1 / 10, 1, true); V.keys = {}; return { z: V.player.z, x: V.player.x, on: !!V.player.onPier, y: B.camera.position.y, p }; });
    ok(pier.on && pier.z < pier.p.z1 + 6 && pier.y > pier.p.top + 1, 'the pier can be walked on, out to its end', JSON.stringify(pier));
    ok(pier.x > pier.p.x0 && pier.x < pier.p.x1, 'and the railings keep you on the deck', `${pier.x}`);
    ok(!errs.length, 'no error with the mouse', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (run('walk')) {
    console.log('\n=== walk ===');
    // the core times the beach as a straight walk to shoreDist() and back; this walks the real one, through the page's
    // own goals, scoops and sales, and buys the cheapest thing at the machine, until the pipeline ends the walking
    const {page, ctx, errs} = await open('', () => { try { localStorage.clear(); } catch (e) {} });
    const r = await page.evaluate(() => {
        const B = window.__bots, S = B.S, SEA = B.SEA, V = B.V; B.start();
        let acc = 0, t = 0; const dt = 0.1;
        const shop = () => { for (let g = 0; g < 20; g++) { let best = null; for (const r of ['carry', 'tool', 'move', 'contract']) { const c = SEA.railCost(S, r); if (c <= S.money && (!best || c < best.c)) best = { r, c }; } if (!best) break; SEA.act(S, 'buy', best.r); } };
        while (t < 16 * 60 && !SEA.piped(S)) {
            if (B.near()) shop();
            const full = S.held >= SEA.capOf(S) - 1e-9;
            if (!V.goal) {
                if (full) { if (B.near()) B.interact(); else V.goal = { x: 0, z: 10.5, then: 'sell', r: 0.6 }; }
                else if (B.canScoop()) { acc += 6 * dt; while (acc >= 1) { acc--; B.interact(); } }
                else V.goal = { x: V.player.x, z: B.edge(V.player.x) + 2.2, then: 'water', r: 0.8 };
            }
            B.frame(dt, 1, true); t += dt;
        }
        const sim = SEA.simulate('eager', 3600, 0.1).log.at['carry:pipe'];
        return { min: t / 60, piped: SEA.piped(S), walked: S.walked, sim: sim / 60 };
    });
    info(`the pipeline after ${r.min.toFixed(1)} min on the real beach (the core's eager bot: ${r.sim.toFixed(1)}), ${(r.walked / 1000).toFixed(1)} km walked`);
    ok(r.piped && r.min < r.sim * 1.3, 'walking the real beach takes about as long as the core reckons', JSON.stringify(r));
    ok(r.walked > 2000, 'and is kilometres of walking', `${r.walked.toFixed(0)} m`);
    ok(!errs.length, 'no error on the way', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (run('duck')) {
    console.log('\n=== duck ===');
    const {page, ctx, errs} = await open('', () => { try { localStorage.clear(); } catch (e) {} });
    const r = await page.evaluate(() => {
        const B = window.__bots, V = B.V; B.start(); B.setP(0.05); B.advance(10); B.goto(0, B.edge(0) + 2, 0, -0.15);
        V.duck.wait = 0; B.frame(1 / 10, 20, true); B.frame(1 / 30, 1);
        const up = V.duck.state, p = B.project(V.duck.g.position.x, V.duck.g.position.y + 0.4, V.duck.g.position.z);
        return { up, p };
    });
    ok(r.up === 'swim' && r.p.z < 1 && r.p.x > 0 && r.p.x < 1200, 'a duck bobs up in front of you', JSON.stringify(r));
    await page.mouse.click(r.p.x, r.p.y);
    const r2 = await page.evaluate(() => { const B = window.__bots; const boost = B.S.boostT, ducks = B.S.ducks; B.frame(1 / 10, 25, true); return { boost, ducks, state: B.V.duck.state, visible: B.V.duck.g.visible }; });
    ok(r2.boost > 25 && r2.ducks === 1, 'clicking it starts the boost', JSON.stringify(r2));
    ok(r2.state === null && !r2.visible, 'and it dips back under, gone after a moment', JSON.stringify(r2));
    ok(!errs.length, 'no error with the duck', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (run('offline')) {
    console.log('\n=== offline ===');
    const save = JSON.stringify({ v: 2, t: 600, removed: 1e9, money: 10, tool: 5, carry: 5, buyer: 2, helpers: [40, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0], found: {}, exposed: {}, scoops: 500, lastSeen: Date.now() - 2 * 3600 * 1000, rec: {} });
    const {page, ctx, errs} = await open('', new Function(`try { localStorage.setItem('bottom_of_the_sea_v2', ${JSON.stringify(save)}); } catch (e) {}`));
    const r = await page.evaluate(() => { const B = window.__bots; const before = B.S.money; B.start(); B.frame(1 / 10, 20, true); return { gained: B.S.money - before, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }; });
    ok(r.gained > 0, 'two hours away: the helpers sold water meanwhile', `+$${r.gained.toFixed(2)}`);
    ok(/away for 2 h/.test(r.toasts), 'and a toast says so', r.toasts);
    ok(!errs.length, 'no error coming back', errs.slice(0, 3).join(' | '));
    await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${n - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
