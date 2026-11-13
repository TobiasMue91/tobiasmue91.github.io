#!/usr/bin/env node
// Test suite for tools/javascript_obfuscator.html.
//
// An obfuscator makes one promise, exactly like a minifier: the code it hands back does what
// the code it was given did. Nothing on the page can show whether it kept that promise - a
// wall of _0x hex looks the same whether it still works or not - so this suite judges the
// page's DOM-free core (<script id="core">, run here in Node's vm) with things that do not
// come from the page:
//   - equivalence: every sample program is run before and after obfuscation, at all three
//     levels, in a fresh vm, and must produce the same return value, console output and
//     thrown errors. This is the whole point; obfuscation that changes behaviour is a bug.
//   - transforms: the output of each level must actually carry the transforms that level
//     promises (hex identifiers, a string array, rc4/base64 markers, control flow, ...).
//   - determinism: with a locked seed the same input gives byte-identical output.
//   - edges: empty, whitespace, non-ASCII, huge, syntax errors, JSON, module syntax.
//   - the opt-in behaviour toggles (remove console / anti-debug) do what they say.
//   - the pure helpers (size stats, byte counts, formatBytes, error parsing).
//
// The obfuscation engine is javascript-obfuscator (the obfuscator.io engine). It is not
// bundled; install the version the page loads and the suite picks it up, otherwise it skips
// every check that needs it and says so:
//
//   npm i --no-save javascript-obfuscator@5.9.0
//   node test/javascript_obfuscator.mjs
//   node test/javascript_obfuscator.mjs equivalence transforms   # named suites only
//
// Suites: equivalence, transforms, determinism, edges, options, helpers.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PAGE = join(ROOT, 'tools', 'javascript_obfuscator.html');
const require = createRequire(import.meta.url);

const ALL = ['equivalence', 'transforms', 'determinism', 'edges', 'options', 'helpers'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0, skips = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + String(detail).replace(/\n/g, '\n          ') : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const skip = (what, why) => { skips++; console.log(`  skip  ${what}  (${why})`); };
const section = name => console.log(`\n=== ${name} ===`);

// ---------- load the page's core ----------
function loadCore() {
  const html = readFileSync(PAGE, 'utf8');
  const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('could not find <script id="core"> in ' + PAGE);
  const ctx = { self: {}, TextEncoder, Buffer, console, module: undefined };
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx, { filename: 'core.js' });
  const core = ctx.self.ObfCore;
  if (!core || typeof core.obfuscate !== 'function') throw new Error('core did not export ObfCore');
  return core;
}

// ---------- the engine (optional dependency) ----------
function loadEngine() {
  try {
    const O = require('javascript-obfuscator');
    const v = require('javascript-obfuscator/package.json').version;
    return { O, v };
  } catch (e) { return null; }
}

// ---------- run a program in isolation, capture result + logs + error ----------
function runProgram(code) {
  const logs = [];
  const sandbox = {
    __R: undefined, __OUT: undefined,
    console: {
      log: (...a) => logs.push('L:' + a.map(String).join(' ')),
      error: (...a) => logs.push('E:' + a.map(String).join(' ')),
      warn: (...a) => logs.push('W:' + a.map(String).join(' ')),
      info: () => {}, debug: () => {}
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(code + '\n;__OUT=JSON.stringify({r:(typeof __R==="undefined"?null:__R),logs});', sandbox, { timeout: 8000 });
  } catch (e) { return { thrown: String(e && e.message || e), logs }; }
  try { return JSON.parse(sandbox.__OUT); } catch (e) { return { bad: true, logs }; }
}

// Programs whose behaviour is deterministic, covering the constructs that break obfuscators.
const PROGRAMS = {
  arithmetic:   '__R=(2**10)+Math.floor(7/2)-((5%3)*4)+(-3>>>0===4294967293?1:0);',
  strings:      'const s="Hello World".toUpperCase().split(" ").reverse().join("-");__R=s+":"+s.length;',
  closure:      'function mk(n){let c=0;return()=>++c+n;}const f=mk(10);f();f();__R=f();',
  recursion:    'const fib=n=>n<2?n:fib(n-1)+fib(n-2);__R=fib(17);',
  privateFields:'class A{#x=1;static #n=0;constructor(v){this.#x=v;A.bump();}static bump(){return ++A.#n;}get v(){return this.#x*2;}}const a=new A(21);__R=a.v+"|"+A.bump();',
  json:         '__R=JSON.stringify(JSON.parse(\'{"a":[1,2,{"b":3}],"c":"x"}\')).length;',
  regex:        '__R="a1b2c3".replace(/[a-z]/g,m=>m.toUpperCase()).match(/\\d/g).join("")+"/"+/^\\d+$/.test("42");',
  template:     'const n="X",k=3;__R=`v=${n}${k*2}\\nL2\\ttab ${[1,2,3].map(x=>x*x).join(",")}`;',
  unicode:      'const g="Grüße 🌍 Ω";console.log(g,g.length,[...g].length);__R=g.length+"/"+[...g].length;',
  trycatch:     'let r;try{null.x;}catch(e){r=e instanceof TypeError?"te":"other";}finally{r+="!";}__R=r;',
  generator:    'function*g(){yield 1;yield*[2,3];yield 4;}__R=[...g()].reduce((a,b)=>a+b,0);',
  destructure:  'const {a=1,b=2,...rest}={a:5,c:6,d:7};const[x,,z=9]=[1];__R=a+b+z+Object.keys(rest).length;',
  optional:     'const o={a:{b:null}};__R=(o?.a?.b?.c??"nil")+"|"+(o?.z?.y??"nil2")+"|"+(o.a?.["b"]??"q");',
  bigint:       '__R=String(10n**20n + 7n)+"|"+typeof 5n;',
  arrayOps:     '__R=[5,3,8,1,9,2].sort((a,b)=>a-b).filter(x=>x>2).map(x=>x*x).reduce((a,b)=>a+b,0);',
  switchCase:   'function f(n){switch(n){case 1:return"a";case 2:return"b";default:return"z";}}__R=f(1)+f(2)+f(9);',
  labeledLoop:  'let s=0;outer:for(let i=0;i<5;i++){for(let j=0;j<5;j++){if(j>i)continue outer;s+=i*j;}}__R=s;',
  getterSetter: 'const o={_v:0,get v(){return this._v;},set v(x){this._v=x*2;}};o.v=21;__R=o.v;',
  spreadCall:   'const sum=(...n)=>n.reduce((a,b)=>a+b,0);__R=sum(...[1,2,3],4,...[5,6]);',
  dateFixed:    '__R=new Date(Date.UTC(2020,0,31,12,0,0)).toISOString();',
  mapSet:       'const m=new Map([["a",1]]);m.set("b",2);const st=new Set([1,1,2,3]);__R=[...m.values()].reduce((a,b)=>a+b,0)+"|"+st.size;',
  numericEdge:  '__R=[0.1+0.2, 1/0, -1/0, 0/0===0/0, Number.MAX_SAFE_INTEGER, 2**53].map(String).join(",");'
};

function equivalence(core, O) {
  section('equivalence (input vs obfuscated, run in a vm)');
  const levels = ['light', 'medium', 'heavy'];
  for (const level of levels) {
    for (const [name, src] of Object.entries(PROGRAMS)) {
      const res = core.obfuscate(src, { level, seed: 7 }, O);
      if (!res.ok) { fail(`${level}/${name}: obfuscation errored`, JSON.stringify(res.error)); continue; }
      if (!res.parses) { fail(`${level}/${name}: output flagged as not parsing`); continue; }
      const a = runProgram(src), b = runProgram(res.code);
      const ea = JSON.stringify(a), eb = JSON.stringify(b);
      check(ea === eb, `${level}/${name}: behaviour preserved`, ea === eb ? '' : `in : ${ea}\nobf: ${eb}`);
    }
  }
}

function transforms(core, O) {
  section('transforms (each level carries what it promises)');
  const src = 'function greet(who){const msg="hello "+who;console.log(msg);return msg.length;}greet("world");';
  const light = core.obfuscate(src, { level: 'light', seed: 3 }, O);
  const medium = core.obfuscate(src, { level: 'medium', seed: 3 }, O);
  const heavy = core.obfuscate(src, { level: 'heavy', seed: 3 }, O);

  check(/_0x[0-9a-f]+/.test(medium.code), 'medium: hexadecimal identifiers present');
  check(medium.transforms.strings === true, 'medium: string array on');
  check(medium.transforms.encoding === 'base64', 'medium: base64 string encoding', medium.transforms.encoding);
  check(medium.transforms.controlFlow === true, 'medium: control-flow flattening on');
  check(medium.transforms.deadCode === true, 'medium: dead-code injection on');
  check(light.transforms.controlFlow === false, 'light: control-flow flattening off');
  check(light.transforms.deadCode === false, 'light: dead-code injection off');
  check(heavy.transforms.encoding === 'rc4', 'heavy: rc4 string encoding', heavy.transforms.encoding);
  check(heavy.transforms.selfDefending === true, 'heavy: self-defending on');
  // behaviour-preserving by default: no level silently removes console or adds debug traps
  for (const r of [light, medium, heavy]) {
    check(r.transforms.disableConsole === false, 'no level removes console by default');
    check(r.transforms.debugProtection === false, 'no level enables debug protection by default');
  }
  // heavier levels should generally be larger (more transforms) on the same input
  check(heavy.stats.outBytes >= medium.stats.outBytes, 'heavy output >= medium output',
    `heavy ${heavy.stats.outBytes} vs medium ${medium.stats.outBytes}`);
}

function determinism(core, O) {
  section('determinism');
  const src = PROGRAMS.privateFields;
  const a = core.obfuscate(src, { level: 'heavy', seed: 42 }, O).code;
  const b = core.obfuscate(src, { level: 'heavy', seed: 42 }, O).code;
  check(a === b && a.length > 0, 'locked seed → byte-identical output');
  const c = core.obfuscate(src, { level: 'heavy', seed: 43 }, O).code;
  check(a !== c, 'different seed → different output');
}

function edges(core, O) {
  section('edges');
  // empty / whitespace
  for (const [label, input] of [['empty', ''], ['whitespace', '   \n\t  \n']]) {
    const r = core.obfuscate(input, { level: 'medium' }, O);
    check(r.ok && r.empty && r.code === '', `${label} input → ok, empty output`, JSON.stringify(r).slice(0, 120));
  }
  // comments only — valid program, nothing to run
  const comm = core.obfuscate('// just a comment\n/* block */', { level: 'medium', seed: 1 }, O);
  check(comm.ok, 'comments-only input → ok');
  // syntax error
  const se = core.obfuscate('function broken( {\n return 1;\n}', { level: 'medium' }, O);
  check(!se.ok && se.error && se.error.line > 0, 'syntax error → not ok, with a line number', JSON.stringify(se.error));
  check(!!se.error && !/^ERROR at line/.test(se.error.message) && !/\n>/.test(se.error.message),
    'syntax error message is cleaned (no "ERROR at line", no "> ..." echo)', se.error && se.error.message);
  // bare JSON object is parsed as a block → error (documented behaviour)
  const js = core.obfuscate('{"a":1,"b":2}', { level: 'medium' }, O);
  check(!js.ok, 'bare JSON object → error (it is not a JS program)');
  // non-ASCII survives and round-trips
  const na = core.obfuscate('const g="Grüße 🌍";globalThis.__R=g;console.log(g)', { level: 'heavy', seed: 2 }, O);
  check(na.ok && na.parses, 'non-ASCII heavy → ok and parses');
  // module syntax accepted and flagged valid (can't new Function it, trust the engine)
  const mod = core.obfuscate('import x from "y";export const z=x+1;', { level: 'medium', seed: 1 }, O);
  check(mod.ok && mod.parses, 'module syntax (import/export) → ok and treated as valid');
  check(/import|export/.test(mod.code), 'module output keeps import/export');
  // huge input still completes and preserves behaviour
  let big = 'globalThis.__ACC=0;\n';
  for (let i = 0; i < 400; i++) big += `function fn${i}(a,b){return (a*${i}+b)%97;}globalThis.__ACC+=fn${i}(${i},${i + 1});\n`;
  big += 'globalThis.__R=globalThis.__ACC;';
  const t0 = Date.now();
  const hr = core.obfuscate(big, { level: 'medium', seed: 1 }, O);
  const dt = Date.now() - t0;
  check(hr.ok && hr.parses, `huge input (~${Math.round(core.utf8Bytes(big) / 1024)} KB) → ok in ${dt} ms`);
  if (hr.ok) {
    const a = runProgram(big), b = runProgram(hr.code);
    check(JSON.stringify(a) === JSON.stringify(b), 'huge input → behaviour preserved');
  }
}

function options(core, O) {
  section('options (advanced overrides + opt-in behaviour toggles)');
  const withConsole = 'console.log("a");console.log("b",2);globalThis.__R="done";';
  // remove console output: the opt-in toggle should silence console in the result
  const dc = core.obfuscate(withConsole, { level: 'light', disableConsoleOutput: true, seed: 1 }, O);
  check(dc.ok && dc.transforms.disableConsole === true, 'disableConsoleOutput reported in transforms');
  const ran = runProgram(dc.code);
  const loggedPlainly = (ran.logs || []).some(l => l === 'L:a' || l === 'L:b 2');
  check(!loggedPlainly, 'disableConsoleOutput: console.log output is suppressed in the result',
    JSON.stringify(ran.logs));
  // overriding an advanced option off actually changes the config
  const noCff = core.obfuscate('function f(x){if(x>0){return x*2;}else{return -x;}}globalThis.__R=f(-5);',
    { level: 'medium', controlFlowFlattening: false, seed: 1 }, O);
  check(noCff.ok && noCff.transforms.controlFlow === false, 'controlFlowFlattening:false override applies');
  // mangled identifier names instead of hexadecimal
  const mang = core.obfuscate('function hello(name){return "hi "+name;}globalThis.__R=hello("x");',
    { level: 'light', identifierNamesGenerator: 'mangled', stringArray: false, seed: 1 }, O);
  check(mang.ok && !/_0x[0-9a-f]{4,}/.test(mang.code), 'mangled identifiers → no _0x hex names');
  // renameGlobals is off by default so an exposed global keeps its name
  const keepGlobal = core.obfuscate('function publicApi(){return 42;}', { level: 'medium', seed: 1 }, O);
  check(/publicApi/.test(keepGlobal.code), 'renameGlobals off by default → exposed global name kept');
  const renameGlobal = core.obfuscate('function publicApi(){return 42;}', { level: 'medium', renameGlobals: true, seed: 1 }, O);
  check(!/publicApi/.test(renameGlobal.code), 'renameGlobals:true → global name renamed');
}

function helpers(core) {
  section('helpers (pure functions, no engine needed)');
  // formatBytes
  const fb = [[0, '0 B'], [1, '1 B'], [1023, '1023 B'], [1024, '1.0 KB'], [1536, '1.5 KB'],
    [1048576, '1.0 MB'], [1073741824, '1.0 GB']];
  for (const [n, want] of fb) check(core.formatBytes(n) === want, `formatBytes(${n}) = ${want}`, core.formatBytes(n));
  // utf8Bytes counts bytes, not code units
  check(core.utf8Bytes('abc') === 3, 'utf8Bytes ascii');
  check(core.utf8Bytes('Grüße') === 7, 'utf8Bytes "Grüße" = 7 bytes', core.utf8Bytes('Grüße'));
  check(core.utf8Bytes('🌍') === 4, 'utf8Bytes "🌍" = 4 bytes', core.utf8Bytes('🌍'));
  // sizeStats
  const st = core.sizeStats('aaaa', 'aaaaaaaa');
  check(st.origBytes === 4 && st.outBytes === 8 && Math.abs(st.ratio - 2) < 1e-9 && Math.abs(st.pct - 100) < 1e-9,
    'sizeStats 4→8 bytes = ×2, +100%', JSON.stringify(st));
  const st0 = core.sizeStats('', 'x');
  check(st0.origBytes === 0 && st0.ratio === 0, 'sizeStats handles empty original without dividing by zero');
  // parseError extracts line:col and cleans the message
  const pe = core.parseError("ERROR at line 3: Unexpected token (3:14)\n> ...some code...");
  check(pe.line === 3 && pe.col === 14, 'parseError pulls line 3, col 14', JSON.stringify(pe));
  check(!/ERROR at line/.test(pe.message) && !/\n>/.test(pe.message) && !/\(\d+:\d+\)/.test(pe.message),
    'parseError strips prefix, echo and trailing (l:c)', pe.message);
  const pe2 = core.parseError('Something went wrong');
  check(pe2.line === null && pe2.message === 'Something went wrong', 'parseError with no location is passed through');
  // buildConfig forces privacy/safety invariants
  const cfg = core.buildConfig('heavy', {});
  check(cfg.sourceMap === false && cfg.log === false && cfg.renameGlobals === false && cfg.target === 'browser',
    'buildConfig forces safe/base invariants', JSON.stringify({ sourceMap: cfg.sourceMap, log: cfg.log, renameGlobals: cfg.renameGlobals, target: cfg.target }));
  check(cfg.debugProtection === false && cfg.disableConsoleOutput === false,
    'heavy preset keeps behaviour-changing options off by default');
}

// ---------- run ----------
let core;
try { core = loadCore(); }
catch (e) { console.log('FATAL: ' + e.message); process.exit(1); }

const engine = loadEngine();
if (engine) console.log(`engine: javascript-obfuscator ${engine.v}`);
const O = engine ? engine.O : null;

for (const s of suites) {
  if (!ALL.includes(s)) { console.log(`\n(unknown suite "${s}", skipping)`); continue; }
  if (s === 'helpers') { helpers(core); continue; }
  if (!O) { skip(s, 'javascript-obfuscator not installed — run: npm i --no-save javascript-obfuscator@5.9.0'); continue; }
  if (s === 'equivalence') equivalence(core, O);
  else if (s === 'transforms') transforms(core, O);
  else if (s === 'determinism') determinism(core, O);
  else if (s === 'edges') edges(core, O);
  else if (s === 'options') options(core, O);
}

console.log(`\n${passes} passed, ${failures} failed, ${skips} skipped`);
process.exit(failures ? 1 : 0);
