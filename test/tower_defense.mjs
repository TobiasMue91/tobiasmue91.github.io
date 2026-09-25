#!/usr/bin/env node
// Test suite for games/mini_tower_defense.html (Three Gates).
//
// The old version of this page could not be lost: two fully upgraded towers held sixty waves,
// and nothing about any wave asked for a different answer. The rework's promises are that
// the preview card tells the truth, that each wave asks for something different, and that a
// board which ignores them loses - none of which a screenshot can show. This runs the page's
// own <script id="core"> block (no DOM) in Node and has bots play whole games through the
// same commands the buttons use.
//
//   node test/tower_defense.mjs                   # maps, rules, balance
//   node test/tower_defense.mjs rules balance     # named suites only
//   node test/tower_defense.mjs planner           # the slow one (~2 min): a planner that
//                                                 # tries every purchase in a copy of the game
//   node test/tower_defense.mjs --page=path.html  # run against another copy of the page
//
// Suites: maps, rules, balance, planner.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'games', 'mini_tower_defense.html');
const DEFAULT = ['maps', 'rules', 'balance'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : DEFAULT;

let failures = 0, passes = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) {
    console.log('no <script id="core"> block in ' + PAGE);
    process.exit(1);
}
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.TD = TD;', ctx);
const TD = ctx.TD;
const {W, H, TOWERS, ENEMIES} = TD;
const key = (x, y) => y * W + x;
const median = a => a.slice().sort((x, y) => x - y)[a.length >> 1];

/* ---------------- bots ---------------- */

// How much of the enemies' way a tower at (x,y) with this range covers: road points of every
// gate open by the coming wave, plus (weighted) points along their flyers' lines.
function coverage(g, x, y, range, airW, ground, lookahead = 0) {
    let s = 0;
    const cx = x + 0.5, cy = y + 0.5, r2 = range * range;
    for (const gate of TD.openGates(g, g.current + 1 + lookahead)) {
        if (ground) for (const [px, py] of gate.ground.pts) if ((px - cx) ** 2 + (py - cy) ** 2 <= r2) s++;
        if (airW) {
            const {a, b, len} = gate.air;
            for (let d = 0; d <= len; d++) {
                const px = a[0] + (b[0] - a[0]) * d / len, py = a[1] + (b[1] - a[1]) * d / len;
                if ((px - cx) ** 2 + (py - cy) ** 2 <= r2) s += airW;
            }
        }
    }
    return s;
}
function bestCell(g, type, airW = 0) {
    let best = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!TD.cellFree(g, x, y)) continue;
        const s = coverage(g, x, y, TOWERS[type].range[0], TOWERS[type].air ? airW : 0, true);
        if (!best || s > best.s) best = {s, x, y};
    }
    return best;
}
const cheapestUpgrade = g => g.towers.filter(t => t.level < 3).map(t => ({t, c: TD.upgradeCost(t)})).sort((a, b) => a.c - b.c)[0];

// A plain player: read the card, build the tower it names for the main threat where it covers
// the most, otherwise upgrade the cheapest tower. The blind twin builds from a fixed rotation.
function reader(blind) {
    let turn = 0;
    return {act(g) {
        const next = g.wave(g.current + 1);
        const want = blind ? ['gun', 'laser', 'gun', 'cannon', 'laser', 'tesla'][turn % 6]
            : next.threats.includes('air') ? (g.towers.filter(t => t.type === 'laser').length < 4 ? 'laser' : 'tesla')
                : next.threats.includes('armour') ? 'cannon' : next.threats.includes('swarm') ? 'tesla' : 'gun';
        const cell = bestCell(g, want, !blind && next.threats.includes('air') ? 2 : 0);
        if (cell && g.gold >= TOWERS[want].cost[0] + 10) { TD.build(g, cell.x, cell.y, want); turn++; }
        else {
            const u = cheapestUpgrade(g);
            if (u && g.gold >= u.c + 40) TD.upgrade(g, u.t);
        }
        if (g.current === 0) TD.callWave(g);
    }};
}

// Tries every affordable purchase in a copy of the game, plays on to the end of the coming
// wave with no further purchases, and keeps the one that saves the most lives per coin.
function clone(g) {
    const towers = g.towers.map(t => ({...t}));
    const byId = new Map(towers.map(t => [t.id, t]));
    return {...g, towers, enemies: g.enemies.map(e => ({...e})), spawners: g.spawners.map(s => ({...s})),
        shells: g.shells.map(s => ({...s, tower: byId.get(s.tower.id) || s.tower})),
        builtThisBreak: new Set(g.builtThisBreak), stats: {...g.stats}, fx: null};
}
function rollout(g, horizon) {
    const lives0 = g.lives;
    let worst = 0;
    for (let n = 0; n < 3600 && !g.over; n++) {
        TD.step(g);
        for (const e of g.enemies) worst = Math.max(worst, e.d / e.route.len);
        if (g.current > horizon || (g.current === horizon && !g.spawners.length && !g.enemies.length)) break;
    }
    return (lives0 - g.lives) + (g.over ? 50 : 0) + 0.5 * worst;
}
// The same planner without the card: every wave it has not seen yet looks like grunts of the
// same total strength.
function blindfold(g) {
    const real = g.wave, cache = new Map();
    return w => {
        if (w <= g.current) return real(w);
        if (!cache.has(w)) {
            const hp = real(w).groups.reduce((a, gr) => a + ENEMIES[gr.type].hp * gr.n, 0);
            cache.set(w, {n: w, chars: ['grunt'], threats: ['grunt'], boss: null, groups: [{type: 'grunt', n: Math.round(hp), gap: Math.max(0.3, 10 / hp)}]});
        }
        return cache.get(w);
    };
}
function planner(blind) {
    let lastT = -1e9, lastWave = -1, lastGold = 0;
    return {act(g) {
        const breakNow = g.countdown !== null || g.current === 0;
        const fresh = breakNow && lastWave !== g.current;
        if (!fresh && (g.t - lastT < 4 || g.gold < lastGold + 40)) { if (g.current === 0) TD.callWave(g); return; }
        lastT = g.t; if (breakNow) lastWave = g.current;
        const horizon = g.current + (breakNow ? 1 : 0);
        const view = blind ? blindfold(g) : g.wave;
        for (let guard = 0; guard < 4; guard++) {
            const options = [];
            for (const t of g.towers) {
                const c = TD.upgradeCost(t);
                if (c !== null && c <= g.gold) options.push({cost: c, act: h => TD.upgrade(h, h.towers.find(o => o.id === t.id))});
            }
            for (const type of Object.keys(TOWERS)) {
                if (TOWERS[type].cost[0] > g.gold) continue;
                const R = TOWERS[type].range[0], cells = [];
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (TD.cellFree(g, x, y))
                    cells.push({x, y, s: coverage(g, x, y, R, TOWERS[type].air ? 1.01 : 0, true, 1), a: TOWERS[type].air ? coverage(g, x, y, R, 1, false, 1) : 0});
                const picks = cells.slice().sort((a, b) => b.s - a.s).slice(0, 2);
                const air = cells.slice().sort((a, b) => b.a - a.a)[0];
                if (air && air.a && !picks.includes(air)) picks.push(air);
                for (const c of picks) options.push({cost: TOWERS[type].cost[0], act: h => TD.build(h, c.x, c.y, type)});
            }
            if (!options.length) break;
            const run = act => { const h = clone(g); h.wave = view; if (act) act(h); return rollout(h, horizon); };
            const base = run(null);
            if (base < 0.35) break;
            let best = null;
            for (const o of options) {
                const v = (base - run(o.act)) / o.cost;
                if (!best || v > best.v) best = {...o, v};
            }
            if (!best || best.v <= 0) break;
            best.act(g);
        }
        lastGold = g.gold;
        if (g.current === 0) TD.callWave(g);
    }};
}

const BOTS = {
    idle: () => ({act(g) { if (g.current === 0) TD.callWave(g); }}),
    // the old page's winning build: one laser and one gun, fully upgraded, nothing else
    pair: () => ({act(g) {
        if (g.current === 0) {
            const l = bestCell(g, 'laser'); TD.build(g, l.x, l.y, 'laser');
            const c = bestCell(g, 'gun'); TD.build(g, c.x, c.y, 'gun');
            TD.callWave(g);
        }
        const u = cheapestUpgrade(g);
        if (u && g.gold >= u.c) TD.upgrade(g, u.t);
    }}),
    // the old page's dominant strategy: guns and lasers 2:1 on the best road cells
    greedy: () => ({act(g) {
        for (let n = 0; n < 5; n++) {
            const want = g.towers.filter(t => t.type === 'laser').length * 3 < g.towers.length + 1 ? 'laser' : 'gun';
            const cell = bestCell(g, want), u = cheapestUpgrade(g);
            if (cell && cell.s >= 5 && g.gold >= TOWERS[want].cost[0]) TD.build(g, cell.x, cell.y, want);
            else if (u && g.gold >= u.c) TD.upgrade(g, u.t);
            else break;
        }
        if (g.current === 0) TD.callWave(g);
    }}),
    reader: () => reader(false),
    unread: () => reader(true),
    planner: () => planner(false),
    blind: () => planner(true)
};
function play(name, seed, maxWave = 60, onStep) {
    const g = TD.create(seed), bot = BOTS[name]();
    g.fx = onStep ? [] : null;
    const every = Math.round(0.7 / TD.DT);
    for (let n = 0; !g.over && g.current <= maxWave && g.t < 7200; n++) {
        if (n % every === 0) bot.act(g);
        TD.step(g);
        if (onStep) { onStep(g); g.fx.length = 0; }
    }
    return g;
}
const SEEDS = Array.from({length: 12}, (_, i) => 'b' + i);

/* ---------------- maps ---------------- */
if (suites.includes('maps')) {
    section('maps');
    const problems = {gates: 0, spacing: 0, touching: 0, inside: 0, join: 0, space: 0, open: 0, air: 0};
    const N = 300;
    let lens = [];
    for (let s = 0; s < N; s++) {
        const m = TD.makeMap('m' + s);
        if (m.gates.length !== 3) { problems.gates++; continue; }
        if (m.gates.map(gt => gt.open).join() !== '1,7,15') problems.open++;
        lens.push(m.gates[0].ground.len);
        // routes are cell centres one cell apart, so a distance along one is also an index
        for (const gt of m.gates) {
            const p = gt.ground.pts;
            for (let i = 1; i < p.length; i++) if (Math.abs(Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) - 1) > 1e-9) { problems.spacing++; break; }
            if (p.slice(1).some(([x, y]) => x < 0 || y < 0 || x > W || y > H)) problems.inside++;
            const [cx, cy] = p[p.length - 1];
            if (cx !== m.core[0] || cy !== m.core[1]) problems.join++;
            const d = Math.hypot(gt.air.b[0] - p[0][0], gt.air.b[1] - p[0][1]);
            if (Math.abs(d - gt.air.len) > 1e-9 || gt.air.b !== m.core) problems.air++;
        }
        // no road touches another road, or itself, except a side road's last cell against
        // the main road
        const owner = new Map();
        m.main.forEach(([x, y], i) => owner.set(key(x, y), {road: 0, i}));
        const sides = m.gates.slice(1).map((gt, r) => gt.ground.pts.slice(1, gt.ground.pts.length - (m.main.length - gt.join)).map(([x, y]) => [x - 0.5, y - 0.5]));
        sides.forEach((cells, r) => cells.forEach(([x, y], i) => owner.set(key(x, y), {road: r + 1, i, last: i === cells.length - 1})));
        let bad = false;
        for (const [k, o] of owner) {
            const x = k % W, y = Math.floor(k / W);
            for (const [dx, dy] of [[1, 0], [0, 1]]) {
                const n = owner.get(key(x + dx, y + dy));
                if (!n || x + dx >= W || y + dy >= H) continue;
                if (n.road === o.road && Math.abs(n.i - o.i) === 1) continue;
                const pair = [o, n].sort((a, b) => a.road - b.road);
                if (pair[0].road === 0 && pair[1].last) continue;
                bad = true;
            }
        }
        if (bad) problems.touching++;
        const free = W * H - owner.size - 1;
        if (free < 60) problems.space++;
    }
    for (const [k, v] of Object.entries(problems)) check(v === 0, `maps: ${k} ok on ${N} seeds`, `${v} bad`);
    lens.sort((a, b) => a - b);
    console.log(`  main road ${lens[0]}-${lens[lens.length - 1]} cells over ${N} seeds`);
    check(TD.makeMap('same').gates[1].ground.pts.join() === TD.makeMap('same').gates[1].ground.pts.join(), 'the same seed makes the same map');
    check(TD.makeMap('a').main.join() !== TD.makeMap('b').main.join(), 'another seed makes another map');
}

/* ---------------- rules ---------------- */
if (suites.includes('rules')) {
    section('rules');
    check(TD.hit(45, 12) === 33 && Math.abs(TD.hit(4, 20) - 0.6) < 1e-9, 'armour comes off every hit, down to 15% of it');

    // The card tells the truth: what spawns in wave w is exactly what wave(w) listed.
    {
        const seen = {};
        const g = TD.create('truth');
        g.fx = null;
        const orig = g.enemies;
        let lastId = 0;
        TD.build(g, ...Object.values(bestCell(g, 'gun')).slice(1), 'gun');
        TD.callWave(g);
        while (g.current <= 16 && !g.over) {
            TD.step(g);
            for (const e of g.enemies) if (e.id > lastId) { lastId = Math.max(lastId, e.id); (seen[e.w] ||= {})[e.type] = ((seen[e.w] || {})[e.type] || 0) + 1; }
            g.lives = 20; // keep it alive: this is about spawns, not defence
            if (g.countdown !== null) TD.callWave(g);
        }
        let ok = true, detail = '';
        for (let w = 1; w <= 15; w++) {
            const want = {};
            g.wave(w).groups.forEach(gr => want[gr.type] = (want[gr.type] || 0) + gr.n);
            if (JSON.stringify(Object.entries(want).sort()) !== JSON.stringify(Object.entries(seen[w] || {}).sort())) { ok = false; detail = `wave ${w}: card ${JSON.stringify(want)} spawned ${JSON.stringify(seen[w])}`; }
        }
        check(ok, 'every wave spawns exactly what its card listed', detail);
    }

    // The waves do not depend on how you play, so the card can be trusted a wave ahead.
    {
        const a = play('reader', 'same', 12), b = play('greedy', 'same', 8);
        check(JSON.stringify(a.wave(12)) === JSON.stringify(b.wave(12)), 'wave 12 is the same whatever happened before it');
        const intro = [1, 2, 3, 4, 5].map(w => a.wave(w).chars.join('+')).join(' ');
        check(intro === 'grunt grunt+rush armour air swarm', 'the first five waves introduce one threat each', intro);
        let bosses = true, repeat = false;
        for (let w = 1; w <= 40; w++) {
            const s = a.wave(w);
            if ((w % 5 === 0) !== !!s.boss || (s.boss && s.boss !== ((w / 5) % 2 ? 'ogre' : 'wyrm'))) bosses = false;
            if (w > 6 && a.wave(w - 1).chars[0] === s.chars[0]) repeat = true;
        }
        check(bosses, 'a boss every fifth wave, ogre and wyrm in turn');
        check(!repeat, 'no wave leads with the same threat as the one before it');
    }

    // Ground towers cannot touch flyers; flyers keep to their straight line.
    {
        const g = TD.create('air');
        g.fx = null;
        const lane = g.map.gates[0].air;
        // the free cell nearest the middle of the flyers' line
        const mid = [(lane.a[0] + lane.b[0]) / 2, (lane.a[1] + lane.b[1]) / 2];
        const cells = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (TD.cellFree(g, x, y)) cells.push([Math.hypot(x + 0.5 - mid[0], y + 0.5 - mid[1]), x, y]);
        cells.sort((p, q) => p[0] - q[0]);
        g.gold = 1e6;
        const gun = TD.build(g, cells[0][1], cells[0][2], 'gun'), laser = TD.build(g, cells[1][1], cells[1][2], 'laser');
        g.current = 3; g.countdown = 5; // skip to the break before the first flying wave
        TD.callWave(g);
        let offLine = 0, sawFlyer = false;
        for (let n = 0; n < 3000 && !(g.countdown !== null && !g.enemies.length); n++) {
            TD.step(g);
            g.lives = 20;
            for (const e of g.enemies) if (e.air) {
                sawFlyer = true;
                const {a, b} = e.route, cross = (b[0] - a[0]) * (e.y - a[1]) - (b[1] - a[1]) * (e.x - a[0]);
                if (Math.abs(cross) / e.route.len > 1e-6) offLine++;
            }
        }
        check(sawFlyer && offLine === 0, 'flyers fly the straight line from their gate to the core', `${offLine} off the line`);
        check(gun.dealt === 0 && laser.dealt > 0, 'a gun under the flyers never hits them; a laser does', `gun ${gun.dealt} laser ${laser.dealt}`);
    }

    // Refunds, early calls, the shield and the bomb do what their buttons say.
    {
        const g = TD.create('money');
        g.fx = null;
        const c = bestCell(g, 'gun');
        const t = TD.build(g, c.x, c.y, 'gun');
        check(TD.refund(g, t) === 40, 'a tower comes back in full before the wave it was built for');
        TD.callWave(g);
        const t2 = TD.build(g, bestCell(g, 'gun').x, bestCell(g, 'gun').y, 'gun');
        check(TD.refund(g, t) === 28 && TD.refund(g, t2) === 40, 'after the wave starts: 70% for older towers, still in full for this break\'s');
        while (g.countdown === null) TD.step(g);
        for (let i = 0; i < 30; i++) TD.step(g);
        const bonus = TD.callBonus(g), gold = g.gold;
        check(bonus > 0 && TD.callWave(g) === bonus && g.gold === gold + bonus, 'calling the next wave early pays what the button says', `bonus ${bonus}`);
        check(!TD.upgrade(g, {...t, level: 3}) && TD.upgradeCost({...t, level: 3}) === null, 'a level 3 tower has no upgrade');
    }
    {
        const g = TD.create('shield');
        g.fx = null;
        TD.callWave(g);
        check(TD.shield(g) && !TD.shield(g), 'the shield goes up, then waits for its cooldown');
        while (g.shieldT > 0) TD.step(g);
        const before = g.leaked;
        check(g.lives === 20 && g.leaked === before, 'nothing got through the first seconds of a wave anyway');
        const h = TD.create('shield2');
        h.fx = null;
        TD.callWave(h);
        while (!h.enemies.length) TD.step(h);
        h.enemies.forEach(e => e.d = e.route.len - 0.01);
        TD.shield(h);
        TD.step(h);
        check(h.leaked > 0 && h.lives === 20, 'while the shield is up, whatever reaches the core costs no life');
        const k = TD.create('bomb');
        k.fx = null;
        k.current = 20; k.countdown = 5;
        TD.callWave(k);
        while (!k.enemies.some(e => e.armour > 0 || e.type === 'brute')) { TD.step(k); if (k.current > 21) break; }
        const e = k.enemies[0];
        const hp = e.hp;
        check(TD.bomb(k, e.x, e.y) && !TD.bomb(k, e.x, e.y), 'the bomb goes off, then waits for its cooldown');
        check(e.hp <= 0 || hp - e.hp >= 1.3 * TD.baseHp(21) - 1e-6, 'the bomb ignores armour');
    }

    // Deterministic: the same seed and the same play give the same game.
    {
        const a = play('reader', 'det', 30), b = play('reader', 'det', 30);
        check(a.current === b.current && a.t === b.t && a.gold === b.gold && a.kills === b.kills, 'same seed, same play, same game');
    }
}

/* ---------------- balance ---------------- */
function table(names, seeds) {
    const out = {};
    for (const name of names) {
        const waves = [], mins = [], share = {};
        for (const s of seeds) {
            const g = play(name, s);
            waves.push(g.current);
            mins.push(g.t / 60);
            for (const [k, v] of Object.entries(g.stats)) share[k] = (share[k] || 0) + v;
        }
        const total = Object.values(share).reduce((a, b) => a + b, 0) || 1;
        out[name] = {waves, med: median(waves), max: Math.max(...waves), min: Math.min(...waves), mins: mins.reduce((a, b) => a + b) / mins.length, share};
        console.log(`  ${name.padEnd(8)} median wave ${String(out[name].med).padStart(2)}  (${waves.slice().sort((a, b) => a - b).join(' ')})  ` +
            `${out[name].mins.toFixed(1)} min at 1x  damage: ${Object.entries(share).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(100 * v / total)}%`).join(', ')}`);
    }
    return out;
}
if (suites.includes('balance')) {
    section('balance');
    const r = table(['idle', 'pair', 'greedy', 'reader', 'unread'], SEEDS);
    check(r.idle.max <= 5, 'building nothing loses by wave 5', `max ${r.idle.max}`);
    // the old page's answers no longer hold forever
    check(r.pair.max <= 20 && r.pair.med <= 16, 'one laser and one gun, fully upgraded, fall by the mid-teens', `median ${r.pair.med}, max ${r.pair.max}`);
    check(r.greedy.med <= 16, 'guns and lasers on the best cells, ignoring the card, fall by the mid-teens', `median ${r.greedy.med}`);
    // reading the card is worth waves to a plain player
    check(r.reader.med >= r.unread.med + 2, 'building what the card names beats the same player building blind', `${r.reader.med} vs ${r.unread.med}`);
    check(r.reader.min >= r.unread.min + 4, 'and the card mostly saves the worst games', `worst ${r.reader.min} vs ${r.unread.min}`);
    check(r.reader.med >= r.pair.med + 4, 'reading the card beats the old fixed build', `${r.reader.med} vs ${r.pair.med}`);
    check(Object.values(r).every(x => x.max < 40), 'nothing lasts forever', Object.entries(r).map(([k, v]) => `${k} ${v.max}`).join(', '));
}

/* ---------------- planner ---------------- */
if (suites.includes('planner')) {
    section('planner');
    const seeds = SEEDS.slice(0, 4);
    const r = table(['reader', 'planner', 'blind'], seeds);
    check(r.planner.med >= r.reader.med + 5, 'a careful player gets well past a plain one', `${r.planner.med} vs ${r.reader.med}`);
    check(r.planner.max < 45 && r.blind.max < 45, 'even careful play ends', `${r.planner.max}, ${r.blind.max}`);
    const total = Object.values(r.planner.share).reduce((a, b) => a + b, 0);
    const used = Object.keys(TOWERS).filter(k => (r.planner.share[k] || 0) / total >= 0.05);
    check(used.length === 5, 'careful play uses every tower for at least 5% of its damage', used.join(', '));
    // Not asserted, reported: for a planner that can react to a wave the instant it appears,
    // the card is worth little. Its value is to people, who cannot.
    console.log(`  blind planner median ${r.blind.med} vs ${r.planner.med} with the card`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
