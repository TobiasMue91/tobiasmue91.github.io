#!/usr/bin/env node
// Test suite for tools/csv_json_converter.html (CSV ⇄ JSON Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises a conversion a stranger can paste
// into code or a spreadsheet without checking it elsewhere, so the expected values come from RFC 4180 and RFC 8259,
// not from the page, and the CSV reader and writer are cross-checked against Python's csv module on random grids
// full of delimiters, quotes, line breaks and non-ASCII. It also pins the typing rule (a cell becomes a JSON number
// column only if every value in it is a plain number with no leading zero and at most 15 digits, so zips, IDs
// and 007 stay text and a price column never mixes 5 with "19.90"; decimal commas with semicolon data), JSON numbers kept exactly as
// written on the way to CSV, readable JSON errors with line and column, delimiter detection, and the old page's
// sample outputs, which define the contract.
//
//   node test/csv_json_converter.mjs              # everything (python3 needed for the 'oracle' suite)
//   node test/csv_json_converter.mjs rfc json     # named suites only
//
// Suites: rfc, types, detect, json, tocsv, edge, oracle, contract.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {spawnSync} from 'child_process';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'tools', 'csv_json_converter.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

const ALL = ['rfc', 'types', 'detect', 'json', 'tocsv', 'edge', 'oracle', 'contract'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => { got = got === undefined ? got : JSON.parse(JSON.stringify(got)); check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
const section = name => console.log(`\n=== ${name} ===`);
const rows = (t, o) => C.parseCSV(t, o).rows;
const toJ = (t, o) => JSON.parse(C.csvToJson(t, Object.assign({format: 'minify'}, o)).text);
const toC = (t, o) => C.jsonToCsv(t, o).text;
const conv = (t, dir, o) => C.convert(t, dir, Object.assign({format: 'minify'}, o));

if (suites.includes('rfc')) {
  section('rfc - RFC 4180 section 2');
  eq(rows('aaa,bbb,ccc\r\nzzz,yyy,xxx\r\n'), [['aaa', 'bbb', 'ccc'], ['zzz', 'yyy', 'xxx']], '2.1/2.2 CRLF records, final CRLF optional');
  eq(rows('aaa,bbb,ccc\r\nzzz,yyy,xxx'), [['aaa', 'bbb', 'ccc'], ['zzz', 'yyy', 'xxx']], '2.2 no final CRLF');
  eq(rows('"aaa","bbb","ccc"\r\nzzz,yyy,xxx'), [['aaa', 'bbb', 'ccc'], ['zzz', 'yyy', 'xxx']], '2.5 quoted fields');
  eq(rows('"aaa","b\r\nbb","ccc"\r\nzzz,yyy,xxx'), [['aaa', 'b\r\nbb', 'ccc'], ['zzz', 'yyy', 'xxx']], '2.6 CRLF inside quotes kept');
  eq(rows('"aaa","b""bb","ccc"'), [['aaa', 'b"bb', 'ccc']], '2.7 doubled quote');
  eq(rows('a,b\n1,2\n'), [['a', 'b'], ['1', '2']], 'bare LF');
  eq(rows('a,b\r1,2'), [['a', 'b'], ['1', '2']], 'bare CR (old Mac)');
  eq(rows('a,,c\n,,'), [['a', '', 'c'], ['', '', '']], 'empty fields kept');
  eq(rows('a\n\n\nb\n'), [['a'], ['b']], 'blank lines skipped');
  eq(rows('a,"x"y,c').length, 1, 'stray text after closing quote does not split the row');
  eq(rows('a,"x"y,c')[0], ['a', 'xy', 'c'], 'stray text after closing quote is kept');
  eq(rows('a,b"c,d'), [['a', 'b"c', 'd']], 'quote in the middle of an unquoted field is literal');
  const unclosed = C.parseCSV('a,b\n"open,1\n2,3');
  check(unclosed.errors.length === 1 && unclosed.errors[0].line === 2, 'unclosed quote reported on its line', JSON.stringify(unclosed.errors));
  eq(rows("a;'x;y'", {delimiter: ';', quote: "'"}), [['a', 'x;y']], 'single-quote quoting');
  eq(rows('a,"b"', {quote: ''}), [['a', '"b"']], 'no quote character: quotes are data');
  eq(rows('﻿id,name\n1,x')[0], ['id', 'name'], 'UTF-8 BOM stripped from the first header');
  eq(rows('a||b', {delimiter: '||'}), [['a', 'b']], 'multi-char delimiter');
}

if (suites.includes('types')) {
  section('types - numbers that survive, decided per column');
  const N = (t, d) => C.numberOf(t, d || '.');
  const cases = [['1', 1], ['-3', -3], ['0', 0], ['3.14', 3.14], ['19.90', 19.9], ['1.0', 1], ['0.5', 0.5], ['-0.25', -0.25],
    ['007', undefined], ['01067', undefined], ['-0', undefined], ['-0.0', undefined], ['1e5', undefined], ['+1', undefined], ['.5', undefined], ['5.', undefined],
    ['1,5', undefined], ['1 000', undefined], ['0x1F', undefined], ['NaN', undefined], ['Infinity', undefined], ['１２', undefined], ['€5', undefined], ['5%', undefined],
    ['123456789012345', 123456789012345], ['1234567890123456', undefined], ['12345678901234567890', undefined], ['9007199254740993', undefined],
    ['0.000000000000001', 1e-15], ['1.2345678901234567', undefined], ['2024-02-29', undefined]];
  for (const [i, o] of cases) eq(N(i), o, `numberOf(${JSON.stringify(i)})`);
  const dc = [['1,5', 1.5], ['12,50', 12.5], ['-0,99', -0.99], ['1.234,56', 1234.56], ['1.234.567,8', 1234567.8], ['1234', 1234],
    ['1.5', undefined], ['1.234', undefined], ['12.34,5', undefined], [',5', undefined], ['01,5', undefined]];
  for (const [i, o] of dc) eq(N(i, ','), o, `numberOf(${JSON.stringify(i)}, decimal comma)`);
  eq(C.cellKind('TRUE', '.').k, 'text', 'TRUE is text (JSON literals are lowercase)');
  eq(C.cellKind(' 3 ', '.').v, 3, 'surrounding spaces ignored for the type');
  eq(C.columnKind(['1', '2', ''], '.'), 'num', 'numbers with a gap');
  eq(C.columnKind(['8001', '01067'], '.'), 'text', 'one zip with a leading zero keeps the column text');
  eq(C.columnKind(['5', '19.90'], '.'), 'num', 'prices');
  eq(C.columnKind(['true', 'false', 'null'], '.'), 'bool', 'booleans with null');
  eq(C.columnKind(['1', 'true'], '.'), 'text', 'mixed numbers and booleans are text');
  eq(C.columnKind(['', ''], '.'), 'text', 'all empty is text');
  eq(toJ('zip,price,ok\n8001,5,true\n01067,19.90,\n,,false'), [{zip: '8001', price: 5, ok: true}, {zip: '01067', price: 19.9, ok: null}, {zip: '', price: null, ok: false}], 'columns typed as a whole');
  eq(toJ('a\n12', {types: false}), [{a: '12'}], 'types off keeps everything text');
  eq(toJ('a\nNaN\nInfinity'), [{a: 'NaN'}, {a: 'Infinity'}], 'NaN/Infinity stay text instead of becoming null');
  eq(toJ('a,b\nnull,x\nnull,y'), [{a: null, b: 'x'}, {a: null, b: 'y'}], 'null literal');
  eq(toJ('Artikel;Preis;Menge\n Tisch ; 12,50 ;3\nStuhl;4,99;10\nLampe;;1'), [{Artikel: 'Tisch', Preis: 12.5, Menge: 3}, {Artikel: 'Stuhl', Preis: 4.99, Menge: 10}, {Artikel: 'Lampe', Preis: null, Menge: 1}], 'German Excel export');
  eq(C.csvToJson('a;b\n1,5;2').notes, ['Decimal commas read as numbers: 1,5 → 1.5. Change it under Options › Decimal separator.'], 'decimal comma is said once, with an example');
  eq(toJ('a;b\n1,5;2', {decimal: '.'}), [{a: '1,5', b: 2}], 'decimal point forced on semicolon data');
  eq(toJ('a,b\n"1,5",2', {decimal: ','}), [{a: 1.5, b: 2}], 'decimal comma forced on comma data');
  eq(toJ('a,b\n" x ", y '), [{a: ' x ', b: 'y'}], 'unquoted values are trimmed, quoted ones are not');
  eq(toJ('a,b\n x , y ', {trim: false}), [{a: ' x ', b: ' y '}], 'trim off keeps spaces');
  eq(toJ('a\tb\n1\t2'), [{a: 1, b: 2}], 'tab delimiter is not eaten by trimming');
  eq(toJ('n,v\nx,1\ny,2', {header: false}), [['n', 'v'], ['x', 1], ['y', 2]], 'without a header the first line is typed alone');
}

if (suites.includes('detect')) {
  section('detect - delimiter and direction');
  const D = t => C.detectDelimiter(t, '"');
  eq(D('a,b,c\n1,2,3'), ',', 'comma');
  eq(D('a;b;c\n1;2,5;3'), ';', 'semicolon with decimal commas (European Excel)');
  eq(D('a\tb\n1\t2'), '\t', 'tab');
  eq(D('a|b\n1|2'), '|', 'pipe');
  eq(D('"x,y";b\n"1,2";3'), ';', 'commas only inside quotes do not count');
  eq(D('single\ncolumn'), ',', 'one column falls back to comma');
  eq(D('name,note\nAnn,"a;b;c;d;e"\nBo,x'), ',', 'semicolons inside a quoted note');
  eq(D(''), ',', 'empty');
  eq(D('sku;price;qty\nA-01;1,99;3\nB-07;12,50\nC-11;0,5;1;extra'), ';', 'semicolon, decimal commas and ragged rows');
  eq(D('a,b\n1;2;3;4\n5;6;7;8\n9;1;2;3'), ',', 'the header line decides');
  eq(C.detectKind('  [1]'), 'json', 'array is JSON');
  eq(C.detectKind('\n{"a":1}'), 'json', 'object is JSON');
  eq(C.detectKind('a,b'), 'csv', 'otherwise CSV');
  eq(C.detectKind('  \n '), null, 'blank is nothing');
  eq(C.csvToJson('a;b\n1;2,5').delimiter, ';', 'auto is the default in csvToJson');
}

if (suites.includes('json')) {
  section('json - RFC 8259 reader with exact numbers and readable errors');
  const P = t => C.parseJSON(t);
  const raw = v => JSON.parse(JSON.stringify(v, (k, x) => x instanceof C.Num ? '#' + x.raw : x));
  eq(raw(P('{"a":12345678901234567890,"b":1.50,"c":-0,"d":1E5}')), {a: '#12345678901234567890', b: '#1.50', c: '#-0', d: '#1E5'}, 'numbers kept as written');
  eq(raw(P('["\\u00fc\\n\\"\\\\\\/", "😀"]')), ['ü\n"\\/', '😀'], 'escapes and astral characters');
  check(Object.keys(P('{"__proto__":1}')).join() === '__proto__', '__proto__ is an ordinary key');
  const err = (t, line, col, re) => {
    const r = C.convert(t, 'csv');
    check(!r.ok && r.line === line && r.column === col && re.test(r.error), `error for ${JSON.stringify(t)}`, JSON.stringify(r));
  };
  err('{bad', 1, 2, /property name in double quotes/);
  err('[1,2,]', 1, 5, /Trailing comma/);
  err('{"a":1,}', 1, 7, /Trailing comma/);
  err("{'a':1}", 1, 2, /double quotes/);
  err('[{"a":1}\n {"a":2}]', 2, 2, /Expected , or \]/);
  err('{"a": "x}', 1, 7, /never closes/);
  err('[1,2', 1, 5, /\] is missing/);
  err('{"a":True}', 1, 6, /double quotes/);
  err('[1] x', 1, 5, /after the end/);
  err('[01]', 1, 3, /Expected , or \]/);
  err('["a\nb"]', 1, 4, /line break/);
  eq(C.convert('[1,2,]', 'csv').removeAt, 4, 'a trailing comma comes with the position to remove');
  eq(C.convert('{"a":1 ,\n}', 'csv').removeAt, 7, 'trailing comma before a line break');
  eq(C.convert('[1,2', 'csv').removeAt, undefined, 'other errors offer no fix');
  eq(C.convert('[]', 'csv').ok, false, '[] is not converted');
  check(/no rows/.test(C.convert('[]', 'csv').error), '[] says there are no rows');
}

if (suites.includes('tocsv')) {
  section('tocsv - JSON to CSV');
  eq(toC('[{"a":1,"b":"x"},{"b":2,"c":true}]'), 'a,b,c\r\n1,x,\r\n,2,true', 'union of keys in first-seen order');
  eq(toC('{"user":{"name":"A","tags":["p","q"]},"e":{},"n":null}'), 'user.name,user.tags.0,user.tags.1,e,n\r\nA,p,q,,', 'nested objects flatten with dots');
  eq(toC('{"data":[{"a":1}],"meta":{}}'), 'a\r\n1', 'single array under a wrapper object');
  eq(toC('{"a":[1],"b":[2]}'), 'a.0,b.0\r\n1,2', 'two arrays: the object is one row');
  eq(toC('{"a":1}\n{"a":2},'), 'a\r\n1\r\n2', 'NDJSON with a trailing comma');
  eq(toC('{"a":1}\r\n\r\n{"a":2}'), 'a\r\n1\r\n2', 'NDJSON with CRLF and a blank line');
  eq(toC('[1,"x"]'), 'value\r\n1\r\nx', 'scalars go under value');
  eq(toC('"he said \\"hi\\", ok\\nnext"'), 'value\r\n"he said ""hi"", ok\nnext"', 'quotes, comma and newline are quoted');
  eq(toC('[{"a":12345678901234567890,"b":1.50}]'), 'a,b\r\n12345678901234567890,1.50', 'numbers exactly as written');
  eq(toC('[{"a":" pad "}]'), 'a\r\n" pad "', 'leading/trailing spaces are quoted');
  eq(toC('[{"a":"x;y","b":"p,q"}]', {delimiter: ';'}), 'a;b\r\n"x;y";p,q', 'semicolon output quotes only semicolons');
  eq(toC('[{"a":"it\'s"}]', {quote: "'"}), "a\r\n'it''s'", 'single-quote quoting doubles the quote');
  eq(toC('[{"a":"x,y"}]', {quote: ''}), 'a\r\nx,y', 'no quoting writes raw');
  eq(toC('[{"a":1}]', {header: false}), '1', 'header off');
  eq(toC('[["a","b"],[1,2,3]]'), 'a,b,\r\n1,2,3', 'list of lists is written as rows, padded');
  eq(toC('[[{"x":1}]]'), '"{""x"":1}"', 'objects inside list rows become JSON text');
  eq(toC('[{"a":{"b":{"c":{"d":1}}}}]'), 'a.b.c.d\r\n1', 'deep nesting');
  eq(toC('[{"a.b":1,"a":{"b":2}}]'), 'a.b\r\n2', 'a dotted key and a nested key collide: the later wins');
  eq(toC('[{"ü":"😀"}]'), 'ü\r\n😀', 'non-ASCII');
  eq(toC('[{"a":"=1+1"}]'), 'a\r\n=1+1', 'formula-looking text is not altered');
  eq(toC('[{"a":"x"}]', {eol: '\n'}), 'a\nx', 'LF line endings on request');
  // round trip
  const csv = 'id,name,zip,note\r\n1,"Doe, Jane",01067,"line1\nline2"\r\n2,"O""Brien",8001,';
  const j = C.csvToJson(csv, {format: 'minify'}).text;
  eq(toC(j), csv, 'CSV -> JSON -> CSV round trip is exact');
}

if (suites.includes('edge')) {
  section('edge - what people paste');
  eq(conv('', 'json'), {ok: false, empty: true}, 'empty');
  eq(conv('  \n\t ', 'json'), {ok: false, empty: true}, 'whitespace only');
  eq(conv('  \n ', 'csv'), {ok: false, empty: true}, 'whitespace only JSON');
  eq(toJ('a,b'), [], 'header only: no rows');
  eq(C.csvToJson('a,b').rows, 0, 'header only: 0 rows');
  eq(toJ('a,a,,b\n1,2,3,4'), [{a: 1, a_2: 2, column_3: 3, b: 4}], 'duplicate and empty header names keep every value');
  check(C.csvToJson('a,a\n1,2').notes.length === 1, 'duplicate header is explained');
  eq(toJ('name\n"multi\nline"'), [{name: 'multi\nline'}], 'quoted newline');
  eq(toJ('a,b\n1,2', {header: false}), [['a', 'b'], [1, 2]], 'header off gives arrays');
  const jl = C.csvToJson('a\n1\n2', {format: 'jsonl'}).text;
  eq(jl, '{"a":1}\n{"a":2}', 'JSON Lines');
  eq(C.csvToJson('a\n1', {format: 'pretty'}).text, '[\n  {\n    "a": 1\n  }\n]', 'pretty uses 2 spaces');
  const big = 'id,name,score\n' + Array.from({length: 200000}, (_, i) => `${i},"Name ${i}, Jr.",${i % 100}.5`).join('\n');
  const t0 = Date.now(), r = C.csvToJson(big, {format: 'minify'});
  check(r.rows === 200000 && Date.now() - t0 < 4000, `200k rows (${(big.length / 1e6).toFixed(1)} MB) in ${Date.now() - t0} ms`);
  const t1 = Date.now(), back = C.jsonToCsv(r.text);
  check(back.rows === 200000 && Date.now() - t1 < 4000, `and back in ${Date.now() - t1} ms`);
  eq(toJ('a,b\n"x"  ,y', {trim: false}), [{a: 'x  ', b: 'y'}], 'spaces after a closing quote are kept without trim');
  eq(toJ('a,b\n "x"  ,y'), [{a: 'x', b: 'y'}], 'spaces around a quoted value are dropped with trim');
  eq(toJ('city;temp\nKöln;1,5\nZürich;-3', {delimiter: 'auto'}), [{city: 'Köln', temp: 1.5}, {city: 'Zürich', temp: -3}], 'semicolon detected, decimal comma read');
  eq(toJ('city,temp\nKöln,"1,5"\nZürich,-3'), [{city: 'Köln', temp: '1,5'}, {city: 'Zürich', temp: '-3'}], 'comma data: "1,5" is text, so the column is text');
  eq(conv('a,b\n1,2', 'csv').ok, false, 'CSV in the JSON→CSV direction is an error, not garbage');
}

if (suites.includes('oracle')) {
  section('oracle - Python csv module on random grids');
  const py = spawnSync('python3', ['-c', 'print(1)']);
  if (py.status !== 0) console.log('  skip  python3 not available');
  else {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const alphabet = ['a', 'b', ' ', ',', ';', '"', "'", '\n', '\r\n', 'ü', '😀', '1', '0', '.', '\t', '|', 'x'];
    const grids = [];
    for (let g = 0; g < 300; g++) {
      const w = 1 + Math.floor(rnd() * 4), h = 1 + Math.floor(rnd() * 4), grid = [];
      for (let r = 0; r < h; r++) {
        const row = [];
        for (let c = 0; c < w; c++) { let s = ''; const L = Math.floor(rnd() * 6); for (let k = 0; k < L; k++) s += alphabet[Math.floor(rnd() * alphabet.length)]; row.push(s); }
        if (row.length === 1 && row[0].trim() === '') row[0] = 'z';
        grid.push(row);
      }
      grids.push(grid);
    }
    for (const d of [',', ';', '\t', '|']) {
      const texts = grids.map(g => g.map(r => r.map(s => C.csvField(s, d, '"')).join(d)).join('\r\n'));
      // ours parses our own writing back exactly
      let ok = 0; texts.forEach((t, i) => { if (JSON.stringify(rows(t, {delimiter: d})) === JSON.stringify(grids[i])) ok++; });
      check(ok === grids.length, `delimiter ${JSON.stringify(d)}: write+read round trip ${ok}/${grids.length}`);
      // python reads our writing the same way, and we read python's writing the same way
      const pyCode = `
import csv, io, json, sys
data = json.load(sys.stdin)
out = {"read": [], "written": []}
for t in data["texts"]:
    out["read"].append(list(csv.reader(io.StringIO(t, newline=""), delimiter=data["d"])))
for g in data["grids"]:
    s = io.StringIO(newline="")
    csv.writer(s, delimiter=data["d"], lineterminator="\\r\\n").writerows(g)
    out["written"].append(s.getvalue())
print(json.dumps(out))`;
      const res = spawnSync('python3', ['-c', pyCode], {input: JSON.stringify({texts, grids, d}), maxBuffer: 1 << 26});
      const o = JSON.parse(res.stdout.toString());
      let agree = 0, agree2 = 0;
      o.read.forEach((pr, i) => { if (JSON.stringify(pr) === JSON.stringify(grids[i])) agree++; });
      o.written.forEach((t, i) => { if (JSON.stringify(rows(t, {delimiter: d})) === JSON.stringify(grids[i])) agree2++; });
      check(agree === grids.length, `delimiter ${JSON.stringify(d)}: Python reads our CSV identically ${agree}/${grids.length}`);
      check(agree2 === grids.length, `delimiter ${JSON.stringify(d)}: we read Python's CSV identically ${agree2}/${grids.length}`);
    }
  }
}

if (suites.includes('contract')) {
  section("contract - the old page's outputs (differences are listed in the PR)");
  eq(toJ('a,b\n"x, y","he said ""hi"""'), [{a: 'x, y', b: 'he said "hi"'}], '1 quoted comma and quotes');
  eq(toJ('a,b\n"line1\nline2",2'), [{a: 'line1\nline2', b: 2}], '2 newline in field');
  const rag = C.csvToJson('a,b,c\n1,2\n3,4,5,6', {format: 'minify'});
  eq(JSON.parse(rag.text), [{a: 1, b: 2}, {a: 3, b: 4, c: 5, extra_1: 6}], '3 ragged rows');
  check(rag.warnings.length === 1 && /^Line 2 has 2 and line 3 has 4 values, but the header has 3\./.test(rag.warnings[0]), '3 ragged rows are warned with line numbers', rag.warnings[0]);
  eq(toJ('a;b\n1;2,5', {delimiter: ';', decimal: '.'}), [{a: 1, b: '2,5'}], '4 semicolon chosen, decimal point');
  eq(toJ('a;b\n1;2,5'), [{a: 1, b: 2.5}], '4 semicolon detected, 2,5 read as a decimal comma (old: comma split the row)');
  eq(toJ('n,u\n007,ü€😀\n1e5,x\n12345678901234567890,0\ntrue,null\n-0, 3 '),
    [{n: '007', u: 'ü€😀'}, {n: '1e5', u: 'x'}, {n: '12345678901234567890', u: '0'}, {n: 'true', u: null}, {n: '-0', u: '3'}], '5 types: mixed columns stay text (old typed cell by cell)');
  eq(toJ('a,b\n1,2', {header: false}), [['a', 'b'], [1, 2]], '6 header off');
  eq(conv('', 'json').empty, true, '7 empty');
  eq(toC('[{"a":1,"b":"x"},{"b":2,"c":true}]'), 'a,b,c\r\n1,x,\r\n,2,true', '8 differing keys');
  eq(toC('{"user":{"name":"A","tags":["p","q"]},"e":{},"n":null}'), 'user.name,user.tags.0,user.tags.1,e,n\r\nA,p,q,,', '9 nested');
  eq(toC('{"data":[{"a":1}],"meta":{}}'), 'a\r\n1', '10 wrapper');
  eq(toC('{"a":1}\n{"a":2},'), 'a\r\n1\r\n2', '11 NDJSON');
  eq(toC('[1,"x"]'), 'value\r\n1\r\nx', '12 scalars');
  eq(conv('[]', 'csv').ok, false, '14 empty array');
  eq(conv('{bad', 'csv').ok, false, '15 invalid JSON');
  const sample = 'id,name,email,country\n1,John Doe,john@example.com,USA\n2,Jane Smith,jane@example.com,Canada\n3,Robert Johnson,robert@example.com,UK';
  eq(toJ(sample)[0], {id: 1, name: 'John Doe', email: 'john@example.com', country: 'USA'}, 'old CSV sample');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
