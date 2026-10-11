#!/usr/bin/env node
// Step 3 of the Describing Words data: after build.py, refresh what tools/descriptocraft.html carries
// inline - the "forest" and "happy" lists it shows before the word list has arrived, and the file's
// size, which the loading bar measures against.
//
//   node util/describing_words/inline.mjs
import {readFileSync, writeFileSync, statSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = join(ROOT, 'tools', 'descriptocraft.html');
const DATA = join(ROOT, 'data', 'describing_words.txt');
let html = readFileSync(PAGE, 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + '\nthis.DW = DW;', ctx);
const db = ctx.DW.parse(readFileSync(DATA, 'utf8'));
const example = ctx.DW.subset(db, ['forest'], ['happy']);
html = html.replace(/\/\*EXAMPLE\*\/[\s\S]*?\/\*\/EXAMPLE\*\//, () => '/*EXAMPLE*/\n' + example + '/*/EXAMPLE*/');
html = html.replace(/const DATA_BYTES = \d+; \/\*DATA_BYTES\*\//, `const DATA_BYTES = ${statSync(DATA).size}; /*DATA_BYTES*/`);
writeFileSync(PAGE, html);
console.log(`example: ${example.length} bytes; data: ${statSync(DATA).size} bytes`);
