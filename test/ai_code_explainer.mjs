#!/usr/bin/env node
// Test suite for tools/ai_code_explainer.html (AI Code Explainer).
//
// Runs the page's DOM-free <script id="core"> block in Node. The explanation itself comes from a
// language model and is not tested; what is tested is everything around it that the page promises:
// the code reaches the model with the line numbers the answer will refer to, whatever the model
// sends back (clean JSON, fenced JSON, JSON with braces inside strings, trailing commas, prose, junk)
// turns into a result with line ranges that exist in the code, input limits say what would be
// accepted, and saved history from the old page (same "savedExplanations" shape) still loads,
// imports and searches without crashing. No browser, no server, no network.
//
//   node test/ai_code_explainer.mjs              # everything
//   node test/ai_code_explainer.mjs parse        # named suites only
//
// Suites: detect, input, prompt, parse, text, history.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'ai_code_explainer.html');
const ALL = ['detect', 'input', 'prompt', 'parse', 'text', 'history'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const plain = v => JSON.parse(JSON.stringify(v));

if (suites.includes('detect')) {
  section('detect');
  const cases = [
    ['print("hi")', 'python'],
    ['def f(x):\n    return x * 2', 'python'],
    ['#include <stdio.h>\nint main(void) { printf("x"); }', 'cpp'],   // old page said python
    ['const a = [1, 2].map(x => x * 2);', 'javascript'],
    ['function add(a: number, b: number): number { return a + b; }', 'typescript'],
    ['public class Main { public static void main(String[] a) { System.out.println(1); } }', 'java'],
    ['package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("x") }', 'go'],
    ['<?php echo "hi"; ?>', 'php'],
    ['SELECT name FROM users WHERE id = 1;', 'sql'],
    ['<div class="a">x</div>', 'html'],
    ['body { color: red; }', 'css'],
    ['#!/bin/bash\nfor f in *.log; do echo "$f"; done', 'bash'],
    ['using System;\nConsole.WriteLine("x");', 'csharp'],
    ['{"a":1}', 'auto'],                                               // JSON is not CSS
    ['', 'auto'], ['   \n\t', 'auto'], ['hello world', 'auto'],
  ];
  for (const [code, want] of cases) eq(C.detectLanguage(code), want, `detect ${JSON.stringify(code.slice(0, 30))}`);
}

if (suites.includes('input')) {
  section('input');
  eq(C.checkInput('').ok, false, 'empty rejected');
  eq(C.checkInput('  \n\t ').ok, false, 'whitespace rejected');
  eq(C.checkInput(null).ok, false, 'null rejected');
  check(/Paste or type/.test(C.checkInput('').error), 'empty error says what to do');
  eq(C.checkInput('x').ok, true, 'one char accepted');
  eq(C.checkInput('x'.repeat(C.LONG_CHARS)).warning, undefined, 'at long limit no warning');
  check(C.checkInput('x'.repeat(C.LONG_CHARS + 1)).warning, 'over long limit warns');
  eq(C.checkInput('x'.repeat(C.MAX_CHARS)).ok, true, 'exactly max accepted');
  const big = C.checkInput('x'.repeat(C.MAX_CHARS * 1000));
  eq(big.ok, false, '1000x max rejected');
  check(/30,000/.test(big.error), 'too-long error names the limit', big.error);
}

if (suites.includes('prompt')) {
  section('prompt');
  const m = C.buildMessages({code: 'a = 1\nprint(a)\n\n\n', language: 'auto', level: 1, focus: ['security', 'nonsense', 'algorithm']});
  eq(m.map(x => x.role), ['system', 'user'], 'system then user (old page sent the instructions as "assistant")');
  check(m[1].content.endsWith('1| a = 1\n2| print(a)'), 'numbered lines, trailing blank lines dropped', m[1].content);
  check(/Python code \(2 lines\)/.test(m[1].content), 'detected language and line count named', m[1].content);
  check(/beginner level/.test(m[0].content), 'level in system prompt');
  check(/attention to: algorithm, security\./.test(m[0].content), 'focus kept in canonical order, unknown dropped', m[0].content);
  const m2 = C.buildMessages({code: 'x', language: 'go', level: 4, focus: []});
  check(/Explain this Go code \(1 line\)/.test(m2[1].content), 'explicit language, singular line');
  check(!/attention to/.test(m2[0].content), 'no focus line without focus');
  check(/expert level/.test(m2[0].content), 'expert level');
  const m3 = C.buildMessages({code: 'x', language: 'auto', level: 9});
  check(/intermediate level/.test(m3[0].content), 'out-of-range level falls back to intermediate');
  const fence = C.buildMessages({code: '```\nnot a fence\n```', language: 'auto', level: 2});
  check(fence[1].content.includes('1| ```'), 'backticks in code cannot break the prompt (no fence used)');
  const uni = C.buildMessages({code: 'const 名前 = "héllo 😀";', language: 'auto', level: 2});
  check(uni[1].content.includes('名前 = "héllo 😀"'), 'non-ASCII passes through untouched');
  const r = C.buildRequest({code: 'x', level: 2});
  eq([r.model, r.messages.length], ['gpt-4o-mini', 2], 'request shape');
  const long = C.buildMessages({code: Array(80).fill('x();').join('\n'), level: 2});
  check(/at most 12/.test(long[0].content), 'long code asks for grouped steps');
}

if (suites.includes('parse')) {
  section('parse');
  const code = 'a\nb\nc\nd\ne';
  const good = '{"language":"Python","summary":"Does X.","steps":[{"lines":[1,2],"text":"Sets up `a`."},{"lines":[3,3],"text":"Calls c."}],"notes":[{"kind":"bug","lines":[5,5],"text":"e fails"}]}';
  const r = plain(C.normalizeResult(good, code));
  eq(r.summary, 'Does X.', 'clean JSON summary');
  eq(r.steps.map(s => s.lines), [[1, 2], [3, 3]], 'clean JSON ranges');
  eq(r.notes, [{kind: 'bug', lines: [5, 5], text: 'e fails'}], 'notes');
  eq(r.partial, false, 'not partial');
  eq(plain(C.normalizeResult('```json\n' + good + '\n```', code)).summary, 'Does X.', 'fenced JSON');
  eq(plain(C.normalizeResult('Sure! Here it is:\n' + good + '\nHope that helps {', code)).steps.length, 2, 'prose around JSON, stray brace after');
  const braces = '{"summary":"uses { and } in text","steps":[{"lines":[1,1],"text":"if (x) { y }"}],"notes":[]}';
  eq(plain(C.normalizeResult(braces, code)).steps[0].text, 'if (x) { y }', 'braces inside strings (old greedy regex broke here)');
  const esc = '{"summary":"quote \\" and brace \\"}","steps":[],"explanation":"plain"}';
  eq(plain(C.normalizeResult(esc, code)).summary, 'quote " and brace "}', 'escaped quotes');
  eq(plain(C.normalizeResult(esc, code)).steps, [{lines: null, text: 'plain'}], 'old-style "explanation" field used when no steps');
  eq(plain(C.normalizeResult('{"summary":"s","steps":[{"lines":[1,1],"text":"t"},],}', code)).steps.length, 1, 'trailing commas');
  const prose = plain(C.normalizeResult('This code prints a.', code, 'python'));
  eq([prose.summary, prose.steps, prose.partial, prose.language], ['', [{lines: null, text: 'This code prints a.'}], true, 'python'], 'plain prose kept as text');
  eq(plain(C.normalizeResult('', code)).steps, [], 'empty reply → no steps');
  eq(plain(C.normalizeResult('{}', code)).partial, true, 'empty object → partial');
  eq(plain(C.normalizeResult('{"a":', code)).steps, [{lines: null, text: '{"a":'}], 'truncated JSON kept as text');
  eq(plain(C.normalizeResult('{"language":"detected","steps":["a"]}', code, 'php')).language, 'php', 'unknown model language → our detection');
  eq(plain(C.normalizeResult('{"language":"C++","steps":["a"]}', code, 'auto')).language, 'cpp', 'C++ mapped');
  eq(plain(C.normalizeResult('{"language":"Kotlin","steps":["a"]}', code, 'auto')).language, 'Kotlin', 'unlisted language kept when we detected nothing');
  eq(plain(C.normalizeResult('{"steps":[{"lines":[1,3],"text":"x"}]}', 'a\n\n', 'auto')).steps[0].lines, [1, 1], 'range pulled off trailing blank lines');
  eq(plain(C.normalizeResult('{"steps":[{"lines":[2,3],"text":"x"}]}', 'a\n\n\nb', 'auto')).steps[0].lines, null, 'all-blank range dropped');
  const cov = 'import a\nx = 1\n\nfor i in x:\n    print(i)\n}';
  eq(plain(C.uncovered({steps: [{lines: [1, 1]}, {lines: [5, 5]}]}, cov)), [2, 4], 'uncovered non-blank lines, closers ignored');
  eq(plain(C.uncovered({steps: [{lines: null}]}, cov)), [], 'no coverage claim for prose answers');
  eq(C.listLines([2, 3, 4, 8, 10, 11]), 'L2–4, L8, L10–11', 'line list');
  // line ranges: clamp, swap, strings, nonsense
  const ranges = [[[2, 4], [2, 4]], [[4, 2], [2, 4]], [[3], [3, 3]], [3, [3, 3]], ['2-4', [2, 4]], ['L2–L4', [2, 4]], ['lines 2 to 4', [2, 4]],
    [[0, 2], [1, 2]], [[4, 99], [4, 5]], [[6, 9], null], [[-3, -1], null], ['abc', null], [null, null], [[1.6, 2.4], [2, 2]]];
  for (const [inp, want] of ranges) eq(plain(C.toRange(inp, 5)), want, `range ${JSON.stringify(inp)}`);
  const mixed = plain(C.normalizeResult({steps: ['loose string', {line: 2, explanation: 'alt keys'}, {lines: [1, 1], text: '  '}], notes: ['plain note', {kind: 'SECURITY', text: 'x'}, {kind: 'weird', text: 'y'}]}, code));
  eq(mixed.steps, [{lines: null, text: 'loose string'}, {lines: [2, 2], text: 'alt keys'}], 'string steps, alt keys, blank dropped');
  eq(mixed.notes.map(n => n.kind), ['style', 'security', 'style'], 'note kinds normalised');
  eq(plain(C.normalizeResult({summary: 's', steps: 'nope', notes: {}}, code)).steps, [], 'wrong types ignored');
}

if (suites.includes('text')) {
  section('text');
  const res = {summary: 'S.', steps: [{lines: [1, 1], text: 'one'}, {lines: [2, 4], text: 'two'}, {lines: null, text: 'three'}], notes: [{kind: 'bug', lines: [2, 2], text: 'n'}]};
  eq(C.toPlainText(res), 'S.\n\n- L1: one\n- L2–4: two\n- three\n\nNotes:\n- [bug] L2 n', 'plain text');
  eq(C.toPlainText({summary: 'S.', steps: [], notes: []}, 'a()'), '```\na()\n```\n\nS.', 'copy carries the code as a block');
  eq(C.toPlainText({summary: '', steps: [], notes: []}, 'x ``` y').split('\n')[1].includes('```'), false, 'fences inside code cannot close the block');
  eq(C.toPlainText({summary: '', steps: [{lines: null, text: 'only'}], notes: []}), '- only', 'no summary');
  eq(plain(C.segments('use `map()` then `x`')), [{code: false, text: 'use '}, {code: true, text: 'map()'}, {code: false, text: ' then '}, {code: true, text: 'x'}], 'inline code');
  eq(plain(C.segments('a ` lone')), [{code: false, text: 'a ` lone'}], 'lone backtick stays text');
  eq(plain(C.segments('<img onerror=x>')), [{code: false, text: '<img onerror=x>'}], 'HTML is text (rendered with textContent)');
  eq(C.formatJson('{"a":1}'), '{\n  "a": 1\n}', 'format JSON');
  eq(C.formatJson('[1,2]'), '[\n  1,\n  2\n]', 'format JSON array');
  eq(C.formatJson('42'), null, 'scalar is not formatted');
  eq(C.formatJson('const a = 1'), null, 'non-JSON not formatted');
  eq(C.numberLines('a\n\nb'), '1| a\n2| \n3| b', 'number lines');
  const pasted = "1.  $id = $_GET['id'];\n2.  $r = q($id);\n3.     while($x) {\n4.  \techo 1;\n5.  }";
  eq(C.stripLineNumbers(pasted), "$id = $_GET['id'];\n$r = q($id);\n   while($x) {\n\techo 1;\n}", 'strip "1." numbers, then the common indent');
  eq(C.stripLineNumbers('1 | a\n\n2 | b'), 'a\n\nb', 'spaced pipe numbers, blank line kept');
  eq(C.stripLineNumbers('1| a\n2| b'), 'a\nb', 'pipe numbers');
  eq(C.stripLineNumbers('1: a\n3: b'), null, 'gap in numbering is not line numbers');
  eq(C.stripLineNumbers('10 PRINT "HI"\n20 GOTO 10'), null, 'BASIC line labels are code');
  eq(C.stripLineNumbers('1. only'), null, 'one line is not enough');
  eq(C.stripLineNumbers('x = 1\ny = 2'), null, 'plain code untouched');
  eq(C.stripLineNumbers(''), null, 'empty');
}

if (suites.includes('history')) {
  section('history');
  const old = [{code: 'x', language: 'javascript', explanation: 'E', summary: 'Sum', level: 'Advanced', focusAreas: ['security'], timestamp: '2025-04-01T10:00:00.000Z'},
    {code: 'y', language: 'python', explanation: 'F', level: 'Beginner', focusAreas: [], timestamp: '2025-05-01T10:00:00.000Z'},   // no summary: old page crashed on search
    {code: '', language: 'x', explanation: 'G', timestamp: 't'}, null, 'junk'];
  const clean = plain(C.parseStored(JSON.stringify(old)));
  eq(clean.length, 2, 'invalid entries dropped');
  eq(clean[1].summary, 'Code explanation', 'missing summary filled');
  eq(C.parseStored('{corrupt').length, 0, 'corrupt storage → empty, no throw');
  eq(C.parseStored(null).length, 0, 'missing storage');
  eq(C.parseStored('{"a":1}').length, 0, 'object instead of array');
  eq(plain(C.searchEntries(clean, '')).map(e => e.code), ['y', 'x'], 'newest first');
  eq(plain(C.searchEntries(clean, 'SECUR')).map(e => e.code), ['x'], 'search focus, case-insensitive');
  eq(plain(C.searchEntries(clean, 'F')).map(e => e.code), ['y'], 'search explanation text');
  eq(plain(C.searchEntries(clean, ' PYTH ')).map(e => e.code), ['y'], 'search language, trimmed');
  eq(C.searchEntries(clean, 'zzz').length, 0, 'no match');
  const before = clean.map(e => e.timestamp).join();
  C.searchEntries(clean, ''); eq(clean.map(e => e.timestamp).join(), before, 'search does not reorder storage');
  const imp = C.mergeImport(clean, JSON.stringify([old[0], {code: 'z', language: 'go', explanation: 'H', timestamp: '2026-01-01T00:00:00Z'}, {code: 'z', language: 'go', explanation: 'H', timestamp: '2026-01-01T00:00:00Z'}]));
  eq(imp.added, 1, 'import skips existing and duplicate timestamps');
  eq(imp.items.length, 3, 'import appends');
  check(C.mergeImport(clean, 'nope').error, 'import non-JSON errors');
  check(C.mergeImport(clean, '{"a":1}').error, 'import object errors');
  check(C.mergeImport(clean, '[{"code":"x"}]').error, 'import no valid entries errors');
  eq(C.mergeImport(clean, JSON.stringify(old.slice(0, 1))).added, 0, 'import nothing new');
  const res = C.normalizeResult('{"language":"Go","summary":"S","steps":[{"lines":[1,1],"text":"t"}],"notes":[]}', 'x', 'go');
  const entry = plain(C.makeEntry('x', 'auto', res, 3, ['performance'], '2026-10-17T00:00:00Z'));
  eq(Object.keys(entry).slice(0, 7), ['code', 'language', 'explanation', 'summary', 'level', 'focusAreas', 'timestamp'], 'saved entry keeps the old shape');
  eq([entry.language, entry.level, entry.explanation], ['go', 'Advanced', 'S\n\n- L1: t'], 'saved entry values');
  eq(plain(C.entryToResult(C.cleanEntries([entry])[0])).steps, [{lines: [1, 1], text: 't'}], 'new entry reopens with its steps');
  eq(plain(C.entryToResult(clean[0])).steps, [{lines: null, text: 'E'}], 'old entry reopens as one block');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
