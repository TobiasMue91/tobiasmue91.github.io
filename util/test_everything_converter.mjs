#!/usr/bin/env node
// Test suite for tools/everything_converter.html.
//
// The converter is a ~10k-line graph of ~120 converters over ~90 formats, and the failures
// that matter are the quiet ones: a conversion that returns a file of the wrong type, a
// parser that drops half its input, a route through five steps that could never work. So
// this drives the REAL page in a real browser and checks the graph and every declared edge
// rather than unit-testing extracted copies of the code.
//
//   node util/test_everything_converter.mjs                 # everything
//   node util/test_everything_converter.mjs graph edges     # named suites only
//   node util/test_everything_converter.mjs --url=http://localhost:8099/tools/everything_converter.html
//
// Suites: graph, edges, roundtrip, adversarial, codecs.
//
// Needs `npm i -D playwright` and a server on the page's URL (npx http-server -p 8099).
// Converters that pull a library from a CDN are reported as SKIP when the CDN is
// unreachable, so the suite is still useful offline. Three optional reference libraries
// (qrcode, jsqr, utif) turn on cross-checks in the codecs suite if they are installed.

import {chromium} from 'playwright';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {buildTiff} from './tiff_fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const urlArg = args.find(a => a.startsWith('--url='));
const URL_ = urlArg ? urlArg.slice(6) : 'http://127.0.0.1:8099/tools/everything_converter.html';
const EXE = process.env.CHROMIUM_PATH || undefined;
const ALL = ['graph', 'edges', 'roundtrip', 'adversarial', 'codecs'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0, skips = 0;
const fail = (what, detail) => {
    failures++;
    console.log(`  FAIL  ${what}${detail ? '\n          ' + String(detail).replace(/\n/g, '\n          ') : ''}`);
};
const pass = what => {
    passes++;
    if (process.env.VERBOSE) console.log(`  ok    ${what}`);
};
const skip = (what, why) => {
    skips++;
    console.log(`  skip  ${what}  (${why})`);
};
const section = name => console.log(`\n=== ${name} ===`);
const isNetworkError = msg => /cdn\.|unpkg\.|cdnjs|jsdelivr|Failed to load|Failed to fetch|NetworkError|download the FFmpeg/i.test(msg || '');

const optional = async name => {
    try {
        return await import(name);
    } catch {
        return null;
    }
};

const browser = await chromium.launch(EXE ? {executablePath: EXE} : {});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message)));
try {
    await page.goto(URL_, {waitUntil: 'load', timeout: 30000});
} catch (e) {
    console.error(`Could not load ${URL_}\n  ${e.message}\n  Start a server first: npx http-server -p 8099`);
    await browser.close();
    process.exit(2);
}
await page.waitForTimeout(800);

// ===== graph: the shape of the converter registry, no conversions run =================
if (suites.includes('graph')) {
    section('graph');

    // A second `function foo` in the same script silently wins - that is how every QR
    // conversion broke once, and nothing in the page would have reported it.
    const src = readFileSync(join(HERE, '..', 'tools', 'everything_converter.html'), 'utf8');
    const decls = {};
    for (const m of src.matchAll(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
        const line = src.slice(0, m.index).split('\n').length;
        (decls[m[1]] = decls[m[1]] || []).push(line);
    }
    const dupes = Object.entries(decls).filter(([, lines]) => lines.length > 1);
    if (dupes.length) fail('duplicate top-level function declarations',
        dupes.map(([n, l]) => `${n} at lines ${l.join(', ')}`).join('\n'));
    else pass('no duplicate top-level function declarations');

    const g = await page.evaluate(() => {
        const reg = Object.keys(FORMAT_REGISTRY);
        const unknown = [], noProducer = [], noConsumer = [];
        const producedBy = new Set(), consumedBy = new Set();
        for (const c of converters) {
            for (const m of c.inputs) {
                consumedBy.add(m);
                if (!FORMAT_REGISTRY[m]) unknown.push(`${c.id} takes unregistered input ${m}`);
            }
            for (const m of c.outputs) {
                producedBy.add(m);
                if (!FORMAT_REGISTRY[m]) unknown.push(`${c.id} emits unregistered output ${m}`);
            }
        }
        for (const m of reg) {
            if (!producedBy.has(m)) noProducer.push(m);
            if (!consumedBy.has(m)) noConsumer.push(m);
        }
        const lengths = {}, overCap = [], overLossy = [];
        let pairs = 0;
        for (const s of reg) {
            for (const [d, path] of findReachableTargets(s)) {
                pairs++;
                lengths[path.length] = (lengths[path.length] || 0) + 1;
                if (path.length > MAX_PATH_HOPS) overCap.push(`${s} -> ${d}: ${path.map(x => x.converter.id).join('>')}`);
                const lossy = path.filter(x => x.converter.lossy === true).length;
                if (lossy > MAX_LOSSY_HOPS) overLossy.push(`${s} -> ${d}: ${path.map(x => x.converter.id).join('>')}`);
                // A terminal edge may only be the last hop.
                for (let i = 0; i < path.length - 1; i++) {
                    if (path[i].converter.terminal === true) {
                        overCap.push(`${s} -> ${d}: terminal ${path[i].converter.id} used mid-chain`);
                    }
                }
            }
        }
        const ids = converters.map(c => c.id);
        const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
        const noWeight = converters.filter(c => typeof c.weight !== 'number').map(c => c.id);
        return {
            formats: reg.length, converterCount: converters.length, pairs, lengths,
            unknown, noProducer, noConsumer, overCap, overLossy, dupIds, noWeight,
            maxHops: MAX_PATH_HOPS, maxLossy: MAX_LOSSY_HOPS
        };
    });

    console.log(`  ${g.formats} formats, ${g.converterCount} converters, ${g.pairs} reachable pairs`);
    console.log(`  path lengths: ${Object.entries(g.lengths).map(([k, v]) => `${k} hop: ${v}`).join(',  ')}`);

    g.unknown.length ? fail('converter mimes missing from FORMAT_REGISTRY', g.unknown.join('\n'))
        : pass('every converter mime is registered');
    g.dupIds.length ? fail('duplicate converter ids', g.dupIds.join(', ')) : pass('converter ids unique');
    g.noWeight.length ? fail('converters without a numeric weight', g.noWeight.join(', ')) : pass('all converters weighted');
    g.overCap.length ? fail(`paths longer than MAX_PATH_HOPS (${g.maxHops}) or with a terminal edge mid-chain`,
        g.overCap.slice(0, 10).join('\n')) : pass(`no path exceeds ${g.maxHops} hops`);
    g.overLossy.length ? fail(`paths with more than MAX_LOSSY_HOPS (${g.maxLossy}) reinterpretation hops`,
        g.overLossy.slice(0, 10).join('\n')) : pass(`no path chains more than ${g.maxLossy} reinterpretation hop`);

    // Input-only and output-only formats are allowed, but they should be deliberate, so
    // they are printed rather than failed.
    if (g.noProducer.length) console.log(`  note: no converter produces: ${g.noProducer.join(', ')}`);
    if (g.noConsumer.length) console.log(`  note: no converter consumes: ${g.noConsumer.join(', ')}`);

    // The everyday conversions people actually come for must stay short.
    const everyday = [
        ['image/png', 'image/jpeg', 1], ['image/png', 'image/webp', 1], ['image/png', 'image/bmp', 1],
        ['image/png', 'image/tiff', 1], ['image/tiff', 'image/png', 1], ['image/avif', 'image/jpeg', 1],
        ['image/heic', 'image/jpeg', 2], ['text/csv', 'application/json', 1],
        ['application/json', 'text/csv', 1], ['text/csv', 'application/xml', 2],
        ['text/markdown', 'text/html', 1], ['text/html', 'text/markdown', 1],
        ['application/x-subrip', 'text/vtt', 1], ['application/pdf', 'text/plain', 1],
        ['audio/wav', 'audio/mpeg', 1], ['video/mp4', 'audio/mpeg', 1],
        ['text/plain', 'image/png+qr', 1], ['text/plain', 'application/pdf', 1]
    ];
    const got = await page.evaluate(list => list.map(([s, d]) => {
        const t = findReachableTargets(s).get(d);
        return t ? t.length : null;
    }), everyday);
    everyday.forEach(([s, d, want], i) => {
        if (got[i] === null) fail(`${s} -> ${d} is unreachable`);
        else if (got[i] > want) fail(`${s} -> ${d} takes ${got[i]} hops, expected at most ${want}`);
        else pass(`${s} -> ${d} in ${got[i]} hop(s)`);
    });
}

// ===== fixtures (needed by every suite below) =========================================
let fixtureMimes = [];
if (suites.some(s => ['edges', 'roundtrip', 'adversarial', 'codecs'].includes(s))) {
    await page.addScriptTag({content: readFileSync(join(HERE, 'converter_fixtures.js'), 'utf8')});
    const built = await page.evaluate(() => window.__buildFixtures());
    fixtureMimes = await page.evaluate(() => Object.keys(window.__F));
    if (built.missing.length) {
        console.log(`\n  note: ${built.missing.length} fixture(s) could not be derived:`);
        for (const m of built.missing) console.log(`        ${m.fixture} via ${m.via}: ${m.error}`);
    }
}

// Converters that declare a `lib` expect the pipeline to have loaded it first; calling
// convert() directly would otherwise fail with "jsyaml is not defined" rather than a
// recognisable network error. This loads on demand and remembers what failed.
const installLibLoader = () => page.evaluate(() => {
    window.__libState = window.__libState || {};
    window.__ensureLib = async (c) => {
        if (!c.lib) return {ok: true};
        if (window.__libState[c.lib]) return window.__libState[c.lib];
        try {
            await loadLibrary(c.lib, c.name);
            return (window.__libState[c.lib] = {ok: true});
        } catch (e) {
            return (window.__libState[c.lib] = {ok: false, err: String((e && e.message) || e)});
        }
    };
});

// ===== edges: run every declared (converter, input, output) triple =====================
if (suites.includes('edges')) {
    section('edges');
    await installLibLoader();
    const results = await page.evaluate(async () => {
        const F = window.__F, out = [];
        const textish = m => /^text\//.test(m)
            || /json|xml|yaml|toml|ini|properties|env|sexp|sql|fasta|csv|morse|subrip|vtt|lrc|base64|hexdump/.test(m);
        for (const c of converters) {
            for (const from of c.inputs) {
                const fixture = F[from] || (from === 'image/jpeg' ? F['image/jpeg+exif'] : null);
                if (!fixture) continue;
                for (const to of c.outputs) {
                    if (to === from) continue;
                    // EXIF only exists in the fixture that carries an APP1 block.
                    const input = (c.id === 'jpeg-exif-to-json' && F['image/jpeg+exif']) ? F['image/jpeg+exif'] : fixture;
                    const rec = {id: c.id, from, to, usesLib: !!c.lib};
                    const lib = await window.__ensureLib(c);
                    if (!lib.ok) {
                        rec.err = lib.err;
                        rec.libFailed = true;
                        out.push(rec);
                        continue;
                    }
                    try {
                        const blob = await Promise.race([
                            c.convert(input, from, to, {...DEFAULT_OPTIONS},
                                {file: new File([input], 'fixture.' + ((FORMAT_REGISTRY[from] || {}).ext || 'bin')), name: 'fixture'}),
                            new Promise((_, rj) => setTimeout(() => rj(new Error('timed out after 30s')), 30000))
                        ]);
                        if (!blob) rec.err = 'returned nothing';
                        else {
                            rec.size = blob.size;
                            if (!blob.size) rec.err = 'produced an empty file';
                            else if (textish(to) && !(await blob.text()).trim()) rec.err = 'produced blank text';
                        }
                    } catch (e) {
                        rec.err = String((e && e.message) || e).slice(0, 300);
                    }
                    out.push(rec);
                }
            }
        }
        return out;
    });
    const untested = await page.evaluate(() => {
        const F = window.__F, miss = new Set();
        for (const c of converters) for (const m of c.inputs) if (!F[m]) miss.add(m);
        return [...miss];
    });
    for (const r of results) {
        const label = `${r.id}: ${r.from} -> ${r.to}`;
        if (!r.err) pass(label);
        // Some converters declare `lib`; ffmpeg, JSZip, pdf.js and tesseract fetch theirs
        // from inside convert(). Either way an unreachable CDN is the environment's
        // problem, not the converter's.
        else if (r.libFailed || isNetworkError(r.err)) skip(label, 'library could not be fetched');
        else fail(label, r.err);
    }
    console.log(`  ${results.length} declared edges exercised`);
    if (untested.length) console.log(`  note: no fixture for ${untested.join(', ')} - those inputs were not exercised`);
}

// ===== roundtrip: convert out and back, and insist the data survives ==================
if (suites.includes('roundtrip')) {
    section('roundtrip');
    const chains = [
        ['csv -> json -> csv', 'text/csv', [['csv-to-json', 'application/json'], ['json-to-csv', 'text/csv']], 'exact'],
        ['tsv -> json -> tsv', 'text/tab-separated-values', [['tsv-to-json', 'application/json'], ['json-to-tsv', 'text/tab-separated-values']], 'exact'],
        ['json -> xml -> json', 'application/json', [['json-to-xml', 'application/xml'], ['xml-to-json', 'application/json']], 'json'],
        ['json -> toml -> json', 'application/json', [['json-to-toml', 'application/toml'], ['toml-to-json', 'application/json']], 'json'],
        ['json -> jsonl -> json', 'application/json', [['json-to-jsonl', 'application/jsonl'], ['jsonl-to-json', 'application/json']], 'json'],
        ['json -> sexp -> json', 'application/json', [['json-to-sexp', 'application/x-sexp'], ['sexp-to-json', 'application/json']], 'json'],
        ['json -> cbor -> json', 'application/json', [['json-to-cbor', 'application/cbor'], ['cbor-to-json', 'application/json']], 'json'],
        ['json -> yaml -> json', 'application/json', [['json-to-yaml', 'text/yaml'], ['yaml-to-json', 'application/json']], 'json'],
        ['srt -> vtt -> srt', 'application/x-subrip', [['subtitle-convert', 'text/vtt'], ['subtitle-convert', 'application/x-subrip']], 'exact'],
        ['srt -> json -> srt', 'application/x-subrip', [['subtitle-to-json', 'application/json'], ['json-to-subtitle', 'application/x-subrip']], 'exact'],
        ['text -> morse -> text', 'text/plain', [['text-to-morse', 'application/x-morse'], ['morse-to-text', 'text/plain']], 'lowercase'],
        ['text -> braille -> text', 'text/plain', [['text-to-braille', 'text/x-braille'], ['braille-to-text', 'text/plain']], 'exact'],
        ['text -> dna -> bytes', 'text/plain', [['any-to-dna', 'application/x-fasta'], ['dna-to-file', 'application/octet-stream']], 'exact'],
        ['ics -> json -> ics', 'text/calendar', [['ics-to-json', 'application/json'], ['json-to-ics', 'text/calendar']], 'contains:SUMMARY:Meeting'],
        ['vcf -> json -> vcf', 'text/vcard', [['vcard-to-json', 'application/json'], ['json-to-vcard', 'text/vcard']], 'contains:FN:Ada Lovelace'],
        ['csv -> mdtable -> csv', 'text/csv', [['csv-to-mdtable', 'text/markdown'], ['mdtable-to-csv', 'text/csv']], 'exact'],
        ['png -> qoi -> png', 'image/png', [['image-to-qoi', 'image/qoi'], ['qoi-to-png', 'image/png']], 'pixels'],
        ['png -> ppm -> png', 'image/png', [['image-to-ppm', 'image/x-portable-pixmap'], ['netpbm-to-png', 'image/png']], 'pixels'],
        ['png -> bmp -> png', 'image/png', [['canvas-image', 'image/bmp'], ['canvas-image', 'image/png']], 'pixels'],
        ['png -> tiff -> png', 'image/png', [['canvas-image', 'image/tiff'], ['canvas-image', 'image/png']], 'pixels']
    ];
    await installLibLoader();
    const results = await page.evaluate(async chains => {
        const F = window.__F, out = [];
        const pixelsOf = async blob => {
            const bmp = await createImageBitmap(blob);
            const c = document.createElement('canvas');
            c.width = bmp.width;
            c.height = bmp.height;
            c.getContext('2d').drawImage(bmp, 0, 0);
            return {data: [...c.getContext('2d').getImageData(0, 0, bmp.width, bmp.height).data], w: bmp.width, h: bmp.height};
        };
        for (const [label, startMime, steps, mode] of chains) {
            const rec = {label, mode};
            try {
                let blob = F[startMime], cur = startMime;
                for (const [id, to] of steps) {
                    const c = converters.find(x => x.id === id);
                    if (!c) throw new Error('no converter ' + id);
                    const lib = await window.__ensureLib(c);
                    if (!lib.ok) {
                        rec.libFailed = true;
                        throw new Error(lib.err);
                    }
                    blob = await c.convert(blob, cur, to, {...DEFAULT_OPTIONS},
                        {file: new File([blob], 'fixture'), name: 'fixture'});
                    cur = to;
                }
                if (mode === 'pixels') {
                    const a = await pixelsOf(F[startMime]), b = await pixelsOf(blob);
                    if (a.w !== b.w || a.h !== b.h) rec.err = `size changed: ${a.w}x${a.h} -> ${b.w}x${b.h}`;
                    else {
                        let worst = 0;
                        for (let i = 0; i < a.data.length; i++) if (i % 4 !== 3) worst = Math.max(worst, Math.abs(a.data[i] - b.data[i]));
                        rec.detail = `max channel difference ${worst}`;
                        // BMP/TIFF/PPM drop alpha, so only the colour channels are compared.
                        if (worst > 2) rec.err = `pixels changed (max channel difference ${worst})`;
                    }
                } else {
                    const original = await F[startMime].text(), got = await blob.text();
                    if (mode === 'exact') {
                        if (got.trim() !== original.trim()) rec.err = `text changed\n  was: ${JSON.stringify(original.slice(0, 160))}\n  now: ${JSON.stringify(got.slice(0, 160))}`;
                    } else if (mode === 'lowercase') {
                        if (got.trim() !== original.trim().toLowerCase()) rec.err = `text changed\n  was: ${JSON.stringify(original.toLowerCase().slice(0, 160))}\n  now: ${JSON.stringify(got.slice(0, 160))}`;
                    } else if (mode === 'json') {
                        const a = JSON.stringify(JSON.parse(original)), b = JSON.stringify(JSON.parse(got));
                        if (a !== b) rec.err = `data changed\n  was: ${a.slice(0, 200)}\n  now: ${b.slice(0, 200)}`;
                    } else if (mode.startsWith('contains:')) {
                        const needle = mode.slice(9);
                        if (!got.includes(needle)) rec.err = `output does not contain ${JSON.stringify(needle)}`;
                    }
                }
            } catch (e) {
                rec.err = String((e && e.message) || e).slice(0, 300);
                rec.threw = true;
            }
            out.push(rec);
        }
        return out;
    }, chains);
    for (const r of results) {
        if (!r.err) pass(`${r.label}${r.detail ? ' (' + r.detail + ')' : ''}`);
        else if (r.libFailed || (r.threw && isNetworkError(r.err))) skip(r.label, 'library could not be fetched');
        else fail(r.label, r.err);
    }
}

// ===== adversarial: malformed, empty, unicode and otherwise unkind input ==============
if (suites.includes('adversarial')) {
    section('adversarial');
    // [label, converter, input text, from, to, expectation]
    //   want:<substring>   output must contain it
    //   avoid:<substring>  output must NOT contain it
    //   throws             a clear error is the correct answer
    const cases = [
        ['csv keeps quoted commas', 'csv-to-json', 'name,note\r\n"Ada","hello, world"\r\n', 'text/csv', 'application/json', 'want:hello, world'],
        ['csv survives ragged rows', 'csv-to-json', 'a,b,c\n1,2\n1,2,3,4\n', 'text/csv', 'application/json', 'want:"a"'],
        ['empty csv is an empty list', 'csv-to-json', '', 'text/csv', 'application/json', 'want:[]'],
        ['csv keeps leading-zero ids', 'csv-to-json', 'zip\n007\n', 'text/csv', 'application/json', 'want:"007"'],
        ['nested values survive json -> csv', 'json-to-csv', '[{"a":{"x":1},"b":[1,2]}]', 'application/json', 'text/csv', 'avoid:[object Object]'],
        ['scalar rows get a column', 'json-to-csv', '[1,2,3]', 'application/json', 'text/csv', 'want:value'],
        ['csv quoting is escaped', 'json-to-csv', '[{"a":"x,y","b":"q\\"z"}]', 'application/json', 'text/csv', 'want:"x,y"'],
        ['toml reads inline arrays', 'toml-to-json', 'a = [1, 2, 3]\n', 'application/toml', 'application/json', 'want:[\n    1,'],
        ['toml reads arrays of tables', 'toml-to-json', '[[items]]\nn = 1\n[[items]]\nn = 2\n', 'application/toml', 'application/json', 'want:"n": 2'],
        ['toml reads multiline arrays', 'toml-to-json', 'a = [\n 1,\n 2,\n]\n', 'application/toml', 'application/json', 'want:2'],
        ['xml keeps attributes', 'xml-to-json', '<r><i id="1">text</i></r>', 'application/xml', 'application/json', 'want:@id'],
        ['xml reads CDATA', 'xml-to-json', '<r><i><![CDATA[a<b]]></i></r>', 'application/xml', 'application/json', 'want:a<b'],
        ['json -> xml is valid for arrays', 'json-to-xml', '[{"a":1},{"a":2}]', 'application/json', 'application/xml', 'valid-xml'],
        ['properties handles escaped separators', 'properties-to-json', 'a\\:b = 1\n', 'application/x-properties', 'application/json', 'want:"a:b"'],
        ['properties handles continuations', 'properties-to-json', 'a = one \\\n  two\n', 'application/x-properties', 'application/json', 'want:one two'],
        ['env strips quotes and comments', 'env-to-json', '# c\nA="x y"\nB=\'z\'\n', 'application/x-env', 'application/json', 'want:"x y"'],
        ['sexp reads scheme booleans', 'sexp-to-json', '(a (d #t))', 'application/x-sexp', 'application/json', 'want:true'],
        ['morse drops unknown symbols', 'morse-to-text', '.... xyzzy', 'application/x-morse', 'text/plain', 'avoid:�'],
        ['unicode survives morse', 'text-to-morse', 'Grüße 123', 'text/plain', 'application/x-morse', 'want:-'],
        ['markdown table separator is not a row', 'mdtable-to-csv', '| a | b |\n|:--|--:|\n| 1 | 2 |\n', 'text/markdown', 'text/csv', 'avoid::--'],
        ['escaped pipes survive md tables', 'mdtable-to-csv', '| a |\n|---|\n| x \\| y |\n', 'text/markdown', 'text/csv', 'want:x | y'],
        ['script and style stay out of text', 'html-to-text', '<body><script>var x=1</script><style>p{}</style><p>Keep</p></body>', 'text/html', 'text/plain', 'avoid:var x'],
        ['sql quotes are doubled', 'json-to-sql', '[{"a":"O\'Brien"}]', 'application/json', 'application/sql', "want:'O''Brien'"],
        ['sql has no stray indentation', 'json-to-sql', '[{"a":1}]', 'application/json', 'application/sql', 'avoid:    VALUES'],
        ['folded ics lines are rejoined', 'ics-to-json', 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nSUMMARY:a very long li\n ne\nDTSTART:20260101T100000Z\nEND:VEVENT\nEND:VCALENDAR', 'text/calendar', 'application/json', 'want:a very long line'],
        ['vcard 4.0 parses', 'vcard-to-json', 'BEGIN:VCARD\nVERSION:4.0\nFN:X Y\nEMAIL;TYPE=work:a@b.c\nEND:VCARD', 'text/vcard', 'application/json', 'want:a@b.c'],
        ['srt tolerates BOM and CRLF', 'subtitle-to-json', '﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n', 'application/x-subrip', 'application/json', 'want:"Hi"'],
        ['vtt cue settings are dropped', 'subtitle-convert', 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000 line:90%\nHi\n', 'text/vtt', 'application/x-subrip', 'avoid:line:90%'],
        ['enhanced lrc word timings are stripped', 'lrc-to-subtitle', '[00:01.00]<00:01.00>Hi <00:02.00>there\n', 'application/x-lrc', 'application/x-subrip', 'avoid:<00:'],
        ['empty input is refused clearly', 'ics-to-json', 'BEGIN:VCALENDAR\nEND:VCALENDAR\n', 'text/calendar', 'application/json', 'throws'],
        ['missing table is refused clearly', 'htmltable-to-csv', '<p>no table</p>', 'text/html', 'text/csv', 'throws']
    ];
    const results = await page.evaluate(async cases => {
        const out = [];
        for (const [label, id, text, from, to, expect] of cases) {
            const rec = {label, expect};
            const c = converters.find(x => x.id === id);
            if (!c) {
                rec.err = 'no converter ' + id;
                out.push(rec);
                continue;
            }
            try {
                const blob = await c.convert(new Blob([text]), from, to, {...DEFAULT_OPTIONS},
                    {file: new File([text], 'fixture'), name: 'fixture'});
                const got = await blob.text();
                rec.got = got.slice(0, 200);
                if (expect === 'throws') rec.err = 'expected a clear error, got output';
                else if (expect === 'valid-xml') {
                    const bad = new DOMParser().parseFromString(got, 'application/xml').querySelector('parsererror');
                    if (bad) rec.err = 'output is not well-formed XML: ' + (bad.textContent || '').slice(0, 120);
                } else if (expect.startsWith('want:') && !got.includes(expect.slice(5))) {
                    rec.err = `expected to find ${JSON.stringify(expect.slice(5))}`;
                } else if (expect.startsWith('avoid:') && got.includes(expect.slice(6))) {
                    rec.err = `expected NOT to find ${JSON.stringify(expect.slice(6))}`;
                }
            } catch (e) {
                const msg = String((e && e.message) || e);
                if (expect === 'throws') {
                    // A useful error names the format or what was missing, and is not a crash.
                    if (/undefined|null|not a function|Cannot read/i.test(msg)) rec.err = 'crashed instead of explaining: ' + msg;
                } else rec.err = 'threw: ' + msg.slice(0, 200);
            }
            out.push(rec);
        }
        return out;
    }, cases);
    for (const r of results) {
        if (!r.err) pass(r.label);
        else if (isNetworkError(r.err)) skip(r.label, 'CDN unreachable');
        else fail(r.label, `${r.err}${r.got !== undefined ? `\n  output: ${JSON.stringify(r.got)}` : ''}`);
    }
}

// ===== codecs: the hand-written binary formats, against independent implementations ===
if (suites.includes('codecs')) {
    section('codecs');

    // --- TIFF decoder across the flavours real files use --------------------------
    const W = 19, H = 11;
    const rgb = [], gray = [], bilevel = [], palIdx = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            rgb.push((x * 13) % 256, (y * 23) % 256, ((x + y) * 7) % 256);
            gray.push((x * 11 + y * 5) % 256);
            palIdx.push((x * 3 + y) % 16);
        }
    }
    for (let y = 0; y < H; y++) {
        for (let i = 0; i < Math.ceil(W / 8); i++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = i * 8 + bit;
                if (x < W && (x + y) % 3 === 0) byte |= 1 << (7 - bit);
            }
            bilevel.push(byte);
        }
    }
    const palette = [];
    for (let i = 0; i < 16; i++) palette.push(i * 4369);
    for (let i = 0; i < 16; i++) palette.push((15 - i) * 4369);
    for (let i = 0; i < 16; i++) palette.push(((i * 7) % 16) * 4369);

    const expectRGB = (x, y) => [(x * 13) % 256, (y * 23) % 256, ((x + y) * 7) % 256];
    const expectGray = (x, y) => {
        const v = (x * 11 + y * 5) % 256;
        return [v, v, v];
    };
    const expectGrayInv = (x, y) => {
        const v = 255 - ((x * 11 + y * 5) % 256);
        return [v, v, v];
    };
    const expectBi = white0 => (x, y) => {
        const on = (x + y) % 3 === 0;
        const v = white0 ? (on ? 0 : 255) : (on ? 255 : 0);
        return [v, v, v];
    };
    const expectPal = (x, y) => {
        const i = (x * 3 + y) % 16;
        return [palette[i] >> 8, palette[16 + i] >> 8, palette[32 + i] >> 8];
    };

    const tiffCases = [
        ['TIFF little-endian RGB', {w: W, h: H, samples: rgb, spp: 3, photometric: 2}, expectRGB],
        ['TIFF big-endian RGB', {w: W, h: H, samples: rgb, spp: 3, photometric: 2, le: false}, expectRGB],
        ['TIFF multiple strips', {w: W, h: H, samples: rgb, spp: 3, photometric: 2, rowsPerStrip: 3}, expectRGB],
        ['TIFF PackBits', {w: W, h: H, samples: rgb, spp: 3, photometric: 2, compression: 32773}, expectRGB],
        ['TIFF LZW', {w: W, h: H, samples: rgb, spp: 3, photometric: 2, compression: 5}, expectRGB],
        ['TIFF LZW, many strips', {w: W, h: H, samples: rgb, spp: 3, photometric: 2, compression: 5, rowsPerStrip: 2}, expectRGB],
        ['TIFF LZW with predictor', {w: W, h: H, samples: rgb, spp: 3, photometric: 2, compression: 5, predictor: 2}, expectRGB],
        ['TIFF 8-bit grey', {w: W, h: H, samples: gray, spp: 1, photometric: 1}, expectGray],
        ['TIFF 8-bit grey inverted', {w: W, h: H, samples: gray, spp: 1, photometric: 0}, expectGrayInv],
        ['TIFF 1-bit bilevel', {w: W, h: H, samples: bilevel, spp: 1, bps: 1, photometric: 1}, expectBi(false)],
        ['TIFF 1-bit bilevel inverted', {w: W, h: H, samples: bilevel, spp: 1, bps: 1, photometric: 0}, expectBi(true)],
        ['TIFF palette', {w: W, h: H, samples: palIdx, spp: 1, photometric: 3, palette}, expectPal]
    ];
    // A large LZW image crosses the 511/1023 code-width boundaries, where the early-change
    // rule bites; the small cases above never get there.
    const bigW = 97, bigH = 61, bigRgb = [];
    for (let y = 0; y < bigH; y++) {
        for (let x = 0; x < bigW; x++) bigRgb.push((x * 13 + y) % 256, (y * 23 + x * 3) % 256, ((x * x + y * y) * 7) % 256);
    }
    tiffCases.push(['TIFF LZW across code-width boundaries',
        {w: bigW, h: bigH, samples: bigRgb, spp: 3, photometric: 2, compression: 5},
        (x, y) => [(x * 13 + y) % 256, (y * 23 + x * 3) % 256, ((x * x + y * y) * 7) % 256]]);

    for (const [label, spec, expect] of tiffCases) {
        let buf;
        try {
            buf = buildTiff(spec);
        } catch (e) {
            fail(label, 'could not build the fixture: ' + e.message);
            continue;
        }
        const r = await page.evaluate(bytes => {
            try {
                const o = decodeTIFF(new Uint8Array(bytes).buffer);
                return {w: o.w, h: o.h, px: [...o.rgba]};
            } catch (e) {
                return {err: String(e.message || e)};
            }
        }, [...buf]);
        if (r.err) {
            fail(label, r.err);
            continue;
        }
        const w = spec.w, h = spec.h;
        let bad = 0, first = null;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const o = (y * w + x) * 4, e = expect(x, y);
                if (Math.abs(r.px[o] - e[0]) > 1 || Math.abs(r.px[o + 1] - e[1]) > 1 || Math.abs(r.px[o + 2] - e[2]) > 1) {
                    bad++;
                    if (!first) first = `at (${x},${y}) got ${r.px.slice(o, o + 3)}, expected ${e}`;
                }
            }
        }
        bad ? fail(label, `${bad} of ${w * h} pixels wrong, ${first}`) : pass(label);
    }

    // --- our encoders, read back by libraries that are not ours -----------------------
    const enc = await page.evaluate(async () => {
        const w = 17, h = 9;   // odd width exercises BMP's 4-byte row padding
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                rgba[i] = (x * 15) % 256;
                rgba[i + 1] = (y * 28) % 256;
                rgba[i + 2] = (x * y) % 256;
                rgba[i + 3] = 255;
            }
        }
        const bytes = async blob => [...new Uint8Array(await blob.arrayBuffer())];
        return {w, h, px: [...rgba], bmp: await bytes(rgbaToBMP(rgba, w, h)), tiff: await bytes(rgbaToTIFF(rgba, w, h))};
    });
    // The BMP we write must not be a PNG in disguise - that was the original bug.
    (enc.bmp[0] === 0x42 && enc.bmp[1] === 0x4D)
        ? pass('BMP encoder writes a real BMP header') : fail('BMP encoder writes a real BMP header',
            'magic bytes are ' + enc.bmp.slice(0, 4).map(b => b.toString(16)).join(' '));
    (enc.tiff[0] === 0x49 && enc.tiff[1] === 0x49 && enc.tiff[2] === 42)
        ? pass('TIFF encoder writes a real TIFF header') : fail('TIFF encoder writes a real TIFF header',
            'magic bytes are ' + enc.tiff.slice(0, 4).map(b => b.toString(16)).join(' '));
    // Our own decoder must read our own writer.
    const selfTiff = await page.evaluate(bytes => {
        try {
            const o = decodeTIFF(new Uint8Array(bytes).buffer);
            return {w: o.w, h: o.h, px: [...o.rgba]};
        } catch (e) {
            return {err: String(e.message || e)};
        }
    }, enc.tiff);
    if (selfTiff.err) fail('TIFF encoder output is readable by the TIFF decoder', selfTiff.err);
    else {
        let worst = 0;
        for (let i = 0; i < enc.w * enc.h * 4; i++) if (i % 4 !== 3) worst = Math.max(worst, Math.abs(selfTiff.px[i] - enc.px[i]));
        worst > 1 ? fail('TIFF encoder output is readable by the TIFF decoder', `max channel difference ${worst}`)
            : pass('TIFF encoder output is readable by the TIFF decoder');
    }

    const bmpjs = await optional('bmp-js');
    if (!bmpjs) skip('BMP encoder vs bmp-js', 'npm i -D bmp-js to enable');
    else {
        const d = bmpjs.default.decode(Buffer.from(enc.bmp));
        let worst = 0;
        for (let i = 0; i < enc.w * enc.h; i++) {   // bmp-js hands back ABGR
            const o = i * 4;
            worst = Math.max(worst, Math.abs(d.data[o + 3] - enc.px[o]),
                Math.abs(d.data[o + 2] - enc.px[o + 1]), Math.abs(d.data[o + 1] - enc.px[o + 2]));
        }
        (d.width === enc.w && d.height === enc.h && worst === 0)
            ? pass('BMP encoder vs bmp-js (pixel exact)')
            : fail('BMP encoder vs bmp-js', `${d.width}x${d.height}, max channel difference ${worst}`);
    }

    const utif = await optional('utif');
    if (!utif) skip('TIFF encoder vs utif', 'npm i -D utif to enable');
    else {
        const U = utif.default || utif, buf = Buffer.from(enc.tiff);
        const ifds = U.decode(buf);
        U.decodeImage(buf, ifds[0]);
        const ref = U.toRGBA8(ifds[0]);
        let worst = 0;
        for (let i = 0; i < enc.w * enc.h * 4; i++) if (i % 4 !== 3) worst = Math.max(worst, Math.abs(ref[i] - enc.px[i]));
        (ifds[0].width === enc.w && worst === 0) ? pass('TIFF encoder vs utif (pixel exact)')
            : fail('TIFF encoder vs utif', `${ifds[0].width}x${ifds[0].height}, max channel difference ${worst}`);
    }

    // --- QR: structure against a reference encoder, and does it actually scan? --------
    const qrcode = await optional('qrcode');
    const jsqr = await optional('jsqr');
    const qrCases = [
        ['short', 'Hi'], ['url', 'https://gptgames.dev/tools/everything_converter.html'],
        ['unicode', 'Grüße — 日本語'],
        ['vcard', 'BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\nEMAIL:ada@example.com\nEND:VCARD']
    ];
    for (const [name, text] of qrCases) {
        for (const level of ['L', 'M', 'Q', 'H']) {
            const mine = await page.evaluate(({text, level}) => {
                try {
                    const r = qrEncode(new TextEncoder().encode(text), ['L', 'M', 'Q', 'H'].indexOf(level));
                    return {v: r.version, size: r.size, m: r.matrix.map(row => row.join('')).join('\n')};
                } catch (e) {
                    return {err: String(e.message || e)};
                }
            }, {text, level});
            const label = `QR ${name}/${level}`;
            if (mine.err) {
                fail(label, mine.err);
                continue;
            }
            if (!jsqr) {
                skip(label + ' scans', 'npm i -D jsqr to enable');
                continue;
            }
            // Render the matrix with the quiet zone the spec requires and read it back.
            const rows = mine.m.split('\n'), size = mine.size, Q = 4, sc = 3, dim = (size + Q * 2) * sc;
            const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
            for (let y = 0; y < dim; y++) {
                for (let x = 0; x < dim; x++) {
                    const mr = Math.floor(y / sc) - Q, mc = Math.floor(x / sc) - Q;
                    const dark = mr >= 0 && mc >= 0 && mr < size && mc < size && rows[mr][mc] === '1';
                    const o = (y * dim + x) * 4;
                    if (dark) data[o] = data[o + 1] = data[o + 2] = 0;
                }
            }
            const decoded = (jsqr.default || jsqr)(data, dim, dim);
            if (!decoded) fail(label + ' scans', 'jsqr could not find a QR code in the rendered symbol');
            else if (decoded.data !== text) fail(label + ' scans', `decoded to ${JSON.stringify(decoded.data.slice(0, 80))}`);
            else pass(`${label} scans (version ${mine.v})`);

            // Byte mode is all this encoder implements. The reference splits a payload into
            // numeric/alphanumeric/byte segments when that is smaller, so it legitimately
            // produces a different - not a wrong - symbol for mixed text. Where both choose
            // plain byte mode the two must agree bit for bit.
            if (qrcode) {
                try {
                    const ref = (qrcode.default || qrcode).create(text, {errorCorrectionLevel: level});
                    const rs = ref.modules.size;
                    const refStr = Array.from({length: rs}, (_, r) =>
                        Array.from({length: rs}, (_, c) => ref.modules.get(r, c) ? '1' : '0').join('')).join('\n');
                    const byteOnly = ref.segments && ref.segments.length === 1 && ref.segments[0].mode
                        && /byte/i.test(ref.segments[0].mode.id || '');
                    if (refStr === mine.m) pass(`${label} matches the reference encoder bit for bit`);
                    else if (byteOnly && rs === mine.size) {
                        fail(`${label} vs reference`, 'both chose byte mode at the same version, but the symbols differ');
                    } else skip(`${label} vs reference`,
                        'reference used mixed-mode segmentation, which this encoder does not implement');
                } catch {
                    skip(`${label} vs reference`, 'reference encoder refused the input');
                }
            }
        }
    }
    if (!qrcode) skip('QR vs reference encoder', 'npm i -D qrcode to enable');
}

// ===== uncaught page errors are always a failure ======================================
if (pageErrors.length) fail('uncaught errors on the page', pageErrors.join('\n'));
else pass('no uncaught page errors');

await browser.close();
console.log(`\n${passes} passed, ${failures} failed, ${skips} skipped`);
process.exit(failures ? 1 : 0);
