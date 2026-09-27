#!/usr/bin/env node
// Test suite for tools/family_tree_builder.html.
//
// The page draws a family as rows of generations: partners side by side, children under the
// middle of their parents. Whether that holds for a real family - in-laws with their own
// parents, second partners, half-siblings, a tree started from yourself and built upwards -
// cannot be seen from the sample, so this runs the page's own core script (the
// <script id="core"> block, which has no DOM and no Cytoscape) in Node and checks the layout
// against families generated the way people enter them. No browser, no server.
//
//   node test/family_tree.mjs                 # everything
//   node test/family_tree.mjs layout messy    # named suites only
//   node test/family_tree.mjs --page=path.html
//
// Suites: layout, messy, links, rows.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pageArg = args.find(a => a.startsWith('--page='));
const PAGE = pageArg ? pageArg.slice(7) : join(HERE, '..', 'tools', 'family_tree_builder.html');
const ALL = ['layout', 'messy', 'links', 'rows'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

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
vm.runInContext(core[1] + '\nthis.FT = FT;', ctx);
const FT = ctx.FT;
const STEP = FT.CARD + FT.PARTNER_GAP;

function mulberry(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// --- families, generated the way people enter them ----------------------------------------
// A family is {people: [id], birth: {id}, parents: {child: [p, q]}, couples: [[a, b]]}.
function builder() {
    const f = {people: [], birth: {}, parents: {}, couples: []};
    f.add = year => {
        const id = 'p' + f.people.length;
        f.people.push(id);
        f.birth[id] = `${year}-06-01`;
        f.parents[id] = [];
        return id;
    };
    return f;
}
// Descendants of one couple over four generations: most children marry, some twice, and with
// probability `inlaws` a married-in partner brings their own parents and a sibling.
function descendants(seed, inlaws) {
    const rnd = mulberry(seed), f = builder();
    const kids = (a, b, gen, year) => {
        const n = gen >= 4 ? 0 : [0, 1, 2, 2, 3, 3, 4][Math.floor(rnd() * 7)];
        for (let i = 0; i < n; i++) {
            const c = f.add(year + 25 + i * 2);
            f.parents[c] = b ? [a, b] : [a];
            if (gen >= 4 || rnd() > 0.8) continue;
            const s = f.add(year + 24 + i * 2);
            f.couples.push([c, s]);
            if (rnd() < inlaws) {
                const pa = f.add(year - 2), pb = f.add(year);
                f.couples.push([pa, pb]);
                f.parents[s] = [pa, pb];
                if (rnd() < 0.5) f.parents[f.add(year + 27)] = [pa, pb];
            }
            kids(c, s, gen + 1, year + 25 + i * 2);
            if (rnd() < 0.12) {
                const s2 = f.add(year + 28 + i * 2);
                f.couples.push([c, s2]);
                kids(c, s2, gen + 1, year + 33 + i * 2);
            }
        }
    };
    const a = f.add(1930), b = f.add(1932);
    f.couples.push([a, b]);
    kids(a, b, 1, 1930);
    return f;
}
// A tree started from yourself: both sides of your ancestry for three generations (some lines
// unknown), aunts, uncles and cousins, your partner and their parents, your children.
function ownTree(seed) {
    const rnd = mulberry(seed), f = builder();
    const me = f.add(1990);
    let frontier = [me];
    for (let d = 0; d < 3; d++) {
        const next = [];
        for (const c of frontier) {
            if (d > 0 && rnd() < 0.25) continue;
            const y = +f.birth[c].slice(0, 4) - 28, a = f.add(y), b = f.add(y + 2);
            f.parents[c] = [a, b];
            f.couples.push([a, b]);
            next.push(a, b);
            for (let i = [0, 1, 1, 2, 3][Math.floor(rnd() * 5)]; i > 0; i--) {
                const s = f.add(y + 26 + i * 2);
                f.parents[s] = [a, b];
                if (rnd() > 0.6) continue;
                const sp = f.add(y + 27);
                f.couples.push([s, sp]);
                for (let k = Math.floor(rnd() * 3); k > 0; k--) f.parents[f.add(y + 55 + k)] = [s, sp];
            }
        }
        frontier = next;
    }
    const partner = f.add(1991);
    f.couples.push([me, partner]);
    if (rnd() < 0.7) {
        const a = f.add(1962), b = f.add(1964);
        f.couples.push([a, b]);
        f.parents[partner] = [a, b];
        if (rnd() < 0.6) f.parents[f.add(1994)] = [a, b];
    }
    for (let k = 1 + Math.floor(rnd() * 3); k > 0; k--) f.parents[f.add(2016 + k * 2)] = [me, partner];
    return f;
}
const modelOf = f => FT.model(f.people.map(id => ({id, birth: f.birth[id]})), [
    ...f.people.flatMap(c => f.parents[c].map(p => ({kind: 'parent', source: p, target: c}))),
    ...f.couples.map(([a, b]) => ({kind: 'partner', source: a, target: b}))
]);

// Everything that must hold for a laid-out family, returned as a list of problems.
function problems(f, L, {exactRows = true} = {}) {
    const P = L.pos, out = [];
    for (const id of f.people) {
        if (!P[id] || !Number.isFinite(P[id].x) || !Number.isFinite(P[id].y)) out.push(`${id} has no position`);
    }
    if (out.length) return out;
    for (const c of f.people) for (const p of f.parents[c]) {
        if (exactRows && P[c].y - P[p].y !== FT.ROW) out.push(`${p} is ${(P[c].y - P[p].y) / FT.ROW} rows above their child ${c}`);
        if (!exactRows && P[c].y <= P[p].y) out.push(`${p} is not above their child ${c}`);
    }
    const byRow = {};
    for (const id of f.people) (byRow[P[id].y] ||= []).push(id);
    for (const row of Object.values(byRow)) {
        row.sort((a, b) => P[a].x - P[b].x);
        for (let i = 1; i < row.length; i++) {
            const gap = P[row[i]].x - P[row[i - 1]].x;
            if (gap < STEP - 0.5) out.push(`${row[i - 1]} and ${row[i]} are ${gap.toFixed(1)}px apart`);
        }
    }
    const partnersOf = {};
    for (const [a, b] of f.couples) {
        (partnersOf[a] ||= []).push(b);
        (partnersOf[b] ||= []).push(a);
    }
    for (const [a, b] of f.couples) {
        // with two partners at most, each partner can stand right beside the person
        if ((partnersOf[a].length > 2 || partnersOf[b].length > 2)) continue;
        if (P[a].y !== P[b].y) out.push(`partners ${a} and ${b} are on different rows`);
        else if (Math.abs(Math.abs(P[a].x - P[b].x) - STEP) > 0.5) out.push(`partners ${a} and ${b} are not side by side`);
    }
    return out;
}
// How far each family's children sit from under the middle of their parents, as the mean
// distance of the children's centre from that point, in card widths.
function offCentre(f, L) {
    const P = L.pos, fam = new Map();
    for (const c of f.people) if (f.parents[c].length) {
        const k = [...f.parents[c]].sort().join('|');
        if (!fam.has(k)) fam.set(k, {ps: f.parents[c], cs: []});
        fam.get(k).cs.push(c);
    }
    let t = 0;
    for (const {ps, cs} of fam.values()) {
        const top = ps.reduce((s, p) => s + P[p].x, 0) / ps.length;
        t += Math.abs(cs.reduce((s, c) => s + P[c].x, 0) / cs.length - top);
    }
    return fam.size ? t / fam.size / FT.CARD : 0;
}

function layoutSuite() {
    section('layout');
    const kinds = [
        ['descendants', s => descendants(s, 0)],
        ['with in-laws', s => descendants(s, 0.6)],
        ['own tree', s => ownTree(s)]
    ];
    for (const [name, make] of kinds) {
        let people = 0, trees = 0, bad = 0, crossings = 0, centre = 0, slowest = 0, first = '';
        for (let seed = 1; seed <= 60; seed++) {
            const f = make(seed);
            if (f.people.length < 8) continue;
            const t = performance.now();
            const L = FT.layout(modelOf(f));
            slowest = Math.max(slowest, performance.now() - t);
            const p = problems(f, L);
            if (p.length) { bad++; first ||= `seed ${seed}: ${p[0]}`; }
            trees++;
            people += f.people.length;
            crossings += L.crossings;
            centre += offCentre(f, L);
            check(L.rows === Math.max(...f.people.map(id => L.pos[id].y)) / FT.ROW + 1, `${name} ${seed}: rows counts the rows drawn`);
        }
        check(!bad, `${name}: parents one row above, partners side by side, no cards overlapping`, `${bad} of ${trees} trees wrong, first: ${first}`);
        // A family with no in-laws' parents in it is a plain tree and can always be drawn without
        // a crossing; children should sit under their parents rather than off to one side.
        if (name === 'descendants') check(!crossings, 'descendants: no lines cross', `${crossings} crossings`);
        if (name !== 'with in-laws') check(centre / trees < 0.75, `${name}: children within three quarters of a card of centre`, (centre / trees).toFixed(2));
        check(slowest < 1500, `${name}: slowest layout under 1.5 s`, `${slowest.toFixed(0)} ms`);
        console.log(`  ${name}: ${trees} trees, ${people} people, ${(crossings / trees).toFixed(1)} crossings per tree, ` +
            `children ${(centre / trees).toFixed(2)} cards off centre on average, slowest ${slowest.toFixed(0)} ms`);
    }
    // The same family entered in a different order must still come out right.
    let reordered = 0;
    for (let seed = 1; seed <= 20; seed++) {
        const f = ownTree(seed), rnd = mulberry(seed * 7);
        f.people.sort(() => rnd() - 0.5);
        if (problems(f, FT.layout(modelOf(f))).length) reordered++;
    }
    check(!reordered, 'own trees entered in shuffled order', `${reordered} of 20 wrong`);
    // Small families that can be drawn with no line crossing, and must be.
    const par = (p, c) => ({kind: 'parent', source: p, target: c}), prt = (a, b) => ({kind: 'partner', source: a, target: b});
    const planar = [
        // A father's second partner and their son, a daughter-in-law whose mother is in the
        // tree, a daughter with a partner and a child. Entered in the order a person did it.
        ['a half-brother', ['alex', 'mia', 'sam', 'leo', 'thomas', 'anna', 'lena', 'ada', 'rosa', 'jonas', 'ida', 'omar'],
            [par('alex', 'mia'), prt('alex', 'sam'), par('sam', 'mia'), par('alex', 'leo'), par('sam', 'leo'), par('thomas', 'alex'),
                par('anna', 'alex'), prt('thomas', 'anna'), par('thomas', 'lena'), par('anna', 'lena'), par('ada', 'sam'),
                prt('thomas', 'rosa'), par('thomas', 'jonas'), par('rosa', 'jonas'), par('lena', 'ida'), prt('lena', 'omar'), par('omar', 'ida')]],
        // You and your partner, and all four generations of ancestors on both sides.
        ['two full ancestries', (() => { const ids = ['me', 'you']; for (let i = 0; i < 28; i++) ids.push('a' + i); return ids; })(),
            (() => {
                const l = [prt('me', 'you')], q = ['me', 'you'];
                for (let i = 0; q.length && i < 28; i += 2) {
                    const c = q.shift(), a = 'a' + i, b = 'a' + (i + 1);
                    l.push(par(a, c), par(b, c), prt(a, b));
                    q.push(a, b);
                }
                return l;
            })()]
    ];
    for (const [what, ids, links] of planar) {
        const L = FT.layout(FT.model(ids.map(id => ({id})), links));
        check(L.crossings === 0, `${what}: no lines cross`, `${L.crossings} crossings`);
    }
    // A big tree stays quick enough to re-lay out after every person added.
    const big = descendants(4, 0.5);
    while (big.people.length < 400) {
        const extra = descendants(big.people.length, 0.5), base = big.people.length, map = id => 'p' + (base + +id.slice(1));
        extra.people.forEach(id => big.add(+extra.birth[id].slice(0, 4)));
        for (const c of extra.people) big.parents[map(c)] = extra.parents[c].map(map);
        big.couples.push(...extra.couples.map(([a, b]) => [map(a), map(b)]), [big.people[0], map(extra.people[0])]);
    }
    const t = performance.now(), L = FT.layout(modelOf(big)), ms = performance.now() - t;
    check(ms < 5000, `${big.people.length} people laid out in under 5 s`, `${ms.toFixed(0)} ms`);
    check(!problems(big, L, {exactRows: false}).filter(p => !/rows above/.test(p)).length, `${big.people.length} people: no overlaps, partners together`);
    console.log(`  ${big.people.length} people in ${ms.toFixed(0)} ms`);
}

function messySuite() {
    section('messy');
    // Data the page can hold even if it should not: old saves, imported JSON, mistakes.
    const nodes = ids => ids.map(id => ({id, birth: ''}));
    const par = (p, c) => ({kind: 'parent', source: p, target: c}), prt = (a, b) => ({kind: 'partner', source: a, target: b});
    const cases = [
        ['empty tree', [], []],
        ['one person', ['a'], []],
        ['strangers', ['a', 'b', 'c'], []],
        ['parent of each other', ['a', 'b'], [par('a', 'b'), par('b', 'a')]],
        ['a three-cycle', ['a', 'b', 'c'], [par('a', 'b'), par('b', 'c'), par('c', 'a')]],
        ['partnered with a grandparent', ['a', 'b', 'c'], [par('a', 'b'), par('b', 'c'), prt('a', 'c')]],
        ['partnered with their own child', ['a', 'b'], [par('a', 'b'), prt('a', 'b')]],
        ['three parents (old saves allowed it)', ['a', 'b', 'c', 'd'], [par('a', 'd'), par('b', 'd'), par('c', 'd')]],
        ['self links and links to nobody', ['a', 'b'], [par('a', 'a'), prt('b', 'b'), par('a', 'zz'), prt('zz', 'b')]],
        ['a chain of four partners', ['a', 'b', 'c', 'd', 'k1', 'k2', 'k3'], [prt('a', 'b'), prt('b', 'c'), prt('c', 'd'), par('a', 'k1'), par('b', 'k1'), par('b', 'k2'), par('c', 'k2'), par('d', 'k3'), par('c', 'k3')]],
        ['five partners', ['a', 'b', 'c', 'd', 'e', 'f'], ['b', 'c', 'd', 'e', 'f'].map(x => prt('a', x))],
        ['duplicate links', ['a', 'b', 'c'], [par('a', 'c'), par('a', 'c'), prt('a', 'b'), prt('b', 'a'), par('b', 'c')]],
        ['cousins who marry', ['g1', 'g2', 'a', 'b', 'as', 'bs', 'x', 'y', 'k'], [prt('g1', 'g2'), par('g1', 'a'), par('g2', 'a'), par('g1', 'b'), par('g2', 'b'), prt('a', 'as'), prt('b', 'bs'), par('a', 'x'), par('as', 'x'), par('b', 'y'), par('bs', 'y'), prt('x', 'y'), par('x', 'k'), par('y', 'k')]]
    ];
    for (const [name, ids, links] of cases) {
        let L, err = null;
        try { L = FT.layout(FT.model(nodes(ids), links)); } catch (e) { err = e; }
        if (err) { fail(name, 'threw ' + err.message); continue; }
        const P = L.pos;
        const placed = ids.every(id => P[id] && Number.isFinite(P[id].x) && Number.isFinite(P[id].y));
        const clash = ids.some((a, i) => ids.slice(i + 1).some(b => P[a].y === P[b].y && Math.abs(P[a].x - P[b].x) < STEP - 0.5));
        check(placed && !clash && Object.keys(P).length === ids.length, `${name}: everyone placed once, no overlaps`,
            JSON.stringify(P));
    }
    // Where the data is consistent, contradictions elsewhere do not spoil it.
    const m = FT.model(nodes(['g1', 'g2', 'a', 'b', 'as', 'bs', 'x', 'y', 'k']), cases[12][2]);
    const P = FT.layout(m).pos;
    check(P.g1.y === 0 && P.a.y === FT.ROW && P.x.y === 2 * FT.ROW && P.k.y === 3 * FT.ROW, 'cousins who marry: four clean generations');
    check(Math.abs(Math.abs(P.x.x - P.y.x) - STEP) < 0.5, 'cousins who marry stand together');
    // Someone whose two partners are a generation apart (a first wife, then her niece) has to
    // stand on the lower row; their own parents must come down with them, not stay put.
    const q = FT.layout(FT.model(nodes(['g', 's', 'n', 'm', 'q', 'a']), [par('g', 's'), par('s', 'n'), par('g', 'm'), par('q', 'a'), prt('a', 'm'), prt('a', 'n')])).pos;
    check(q.a.y - q.q.y === FT.ROW, "partners a generation apart: the person's parents stay one row above them", JSON.stringify(q));
}

function linksSuite() {
    section('links');
    // The Link button asks the core whether a link makes sense before making it.
    const m = FT.model(['gp', 'p', 'q', 'c', 'd', 'x'].map(id => ({id})), [
        {kind: 'parent', source: 'gp', target: 'p'},
        {kind: 'parent', source: 'p', target: 'c'}, {kind: 'parent', source: 'q', target: 'c'},
        {kind: 'partner', source: 'p', target: 'q'},
        {kind: 'parent', source: 'p', target: 'd'}
    ]);
    const cases = [
        ['partner', 'x', 'x', 'self', 'nobody is linked to themselves'],
        ['partner', 'p', 'q', 'already', 'partners twice'],
        ['partner', 'gp', 'c', 'ancestor', 'a grandparent as partner'],
        ['parent', 'x', 'c', 'two-parents', 'a third parent'],
        ['child', 'c', 'x', 'two-parents', 'a third parent, asked the other way round'],
        ['parent', 'p', 'd', 'already', 'a parent twice'],
        ['parent', 'q', 'p', 'partners', "a partner as the other's parent"],
        ['parent', 'c', 'gp', 'cycle', 'a grandchild as a parent'],
        ['child', 'gp', 'd', 'cycle', 'a grandparent as a child'],
        ['parent', 'q', 'd', null, "the other parent of a half-sibling's line"],
        ['partner', 'x', 'd', null, 'a stranger as partner'],
        ['child', 'x', 'q', null, 'a stranger as child']
    ];
    for (const [kind, a, b, want, what] of cases) {
        const got = FT.linkProblem(m, kind, a, b);
        check(got === want, `${what}: ${want || 'allowed'}`, `got ${got}`);
    }
}

function rowsSuite() {
    section('rows');
    // The stats panel shows FT.rows as "Generations".
    const at = (ids, links) => FT.rows(FT.model(ids.map(id => ({id})), links));
    const par = (p, c) => ({kind: 'parent', source: p, target: c}), prt = (a, b) => ({kind: 'partner', source: a, target: b});
    check(at([], []) === 0, 'an empty tree has no generations');
    check(at(['a'], []) === 1, 'one person is one generation');
    check(at(['a', 'b', 'c', 'd'], [par('a', 'b'), par('b', 'c'), par('c', 'd')]) === 4, 'four in a line are four generations');
    check(at(['a', 'b', 'c', 'd', 'e'], [prt('a', 'b'), par('a', 'c'), par('b', 'c'), par('d', 'e')]) === 2, 'two separate families count the taller');
    check(at(['me', 'mp', 'mpp', 'sp', 'spp', 'sppp'], [par('mp', 'me'), par('mpp', 'mp'), prt('me', 'sp'), par('spp', 'sp'), par('sppp', 'spp')]) === 3,
        'partners with equally long ancestries are three generations, not six');
    check(at(['me', 'mp', 'sp', 'spp', 'sppp'], [par('mp', 'me'), prt('me', 'sp'), par('spp', 'sp'), par('sppp', 'spp')]) === 3,
        "a longer ancestry on the partner's side sets the height");
    const f = descendants(1, 0.6);
    check(FT.rows(modelOf(f)) === FT.layout(modelOf(f)).rows, 'rows agrees with the layout');
}

const run = {layout: layoutSuite, messy: messySuite, links: linksSuite, rows: rowsSuite};
for (const s of suites) {
    if (!run[s]) { console.log(`unknown suite ${s}; suites: ${ALL.join(', ')}`); process.exit(1); }
    run[s]();
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
