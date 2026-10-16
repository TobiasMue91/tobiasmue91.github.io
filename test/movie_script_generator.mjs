#!/usr/bin/env node
// Test suite for tools/movie_script_generator.html (Movie Script Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises a script that reads
// and exports like a real screenplay, so the parser is checked against the Fountain syntax reference
// (https://fountain.io/syntax) and the layout against standard screenplay indents (12-pt Courier,
// 10 characters per inch: dialogue 1" in and 3.5" wide, cue 2.2" in, parenthetical 1.6" in). Then
// what models actually send back (blank lines inside dialogue, code fences, markdown bold, a chatty
// lead-in), the request the page builds from the form, the plain-words errors, and the old page's
// saved settings and history (localStorage 'saved_settings', 'scriptHistory').
// No network: the model is never called.
//
//   node test/movie_script_generator.mjs                 # everything
//   node test/movie_script_generator.mjs fountain model  # named suites only
//
// Suites: fountain, model, export, request, errors, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'movie_script_generator.html');
const ALL = ['fountain', 'model', 'export', 'request', 'errors', 'saves'];
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
const types = text => C.parse(text).map(e => e.type);
const pairs = text => C.parse(text).map(e => [e.type, e.text]);
const plain = x => JSON.parse(JSON.stringify(x));

if (suites.includes('fountain')) {
  section('fountain');
  eq(pairs('Title: BRICK & STEEL\nCredit: Written by\nAuthor: Stu Maschwitz\n\nEXT. BRICK\'S PATIO - DAY\n\nA gorgeous day.'),
    [['title', 'BRICK & STEEL'], ['title', 'Written by'], ['title', 'Stu Maschwitz'], ['scene', "EXT. BRICK'S PATIO - DAY"], ['action', 'A gorgeous day.']], 'title page then scene');
  eq(plain(C.parse('Title:\n    _**BRICK & STEEL**_\n    _**FULL RETIRED**_\nAuthor: Stu\n\nAction.')[0]), {type: 'title', key: 'title', text: '_**BRICK & STEEL**_\n_**FULL RETIRED**_'}, 'multi-line title value');
  for (const h of ['INT. HOUSE - DAY', 'EXT. HOUSE - NIGHT', 'EST. CITY', 'INT./EXT. CAR - MOVING', 'INT/EXT CAR', 'I/E CAR', 'int. kitchen - day'])
    eq(types('\n' + h + '\n\nShe waits.'), ['scene', 'action'], `scene heading "${h}"`);
  eq(pairs('.SNIPER SCOPE POV\n\nCrosshairs.')[0], ['scene', 'SNIPER SCOPE POV'], 'forced scene heading with "."');
  eq(types('...and then\n\nmore'), ['action', 'action'], '"..." is not a forced heading');
  eq(plain(C.parse('INT. HOUSE - DAY #1A#\n\nx')[0]), {type: 'scene', text: 'INT. HOUSE - DAY', number: '1A'}, 'scene number');
  eq(types('INTERIOR DESIGN is her passion.'), ['action'], '"INTERIOR" is not "INT."');
  eq(pairs('STEEL\nThe man\'s a myth!'), [['character', 'STEEL'], ['dialogue', "The man's a myth!"]], 'cue and dialogue');
  eq(pairs('MOM (O. S.)\nLuke! Come down for supper!'), [['character', 'MOM (O. S.)'], ['dialogue', 'Luke! Come down for supper!']], 'cue with extension');
  eq(pairs('HANS (on the radio)\nWhat was it you said?'), [['character', 'HANS (on the radio)'], ['dialogue', 'What was it you said?']], 'lower-case extension');
  eq(pairs('@McCLANE\nYippie ki-yay!'), [['character', 'McCLANE'], ['dialogue', 'Yippie ki-yay!']], 'forced cue with @');
  eq(pairs('STEEL\n(starting the engine)\nSo much for retirement!'), [['character', 'STEEL'], ['parenthetical', '(starting the engine)'], ['dialogue', 'So much for retirement!']], 'parenthetical');
  eq(pairs('DAN\nThen let\'s retire them.\n_Permanently_.'), [['character', 'DAN'], ['dialogue', "Then let's retire them.\n_Permanently_."]], 'multi-line dialogue');
  eq(plain(C.parse('BRICK ^\nScrew retirement.')[0]), {type: 'character', text: 'BRICK', dual: true}, 'dual dialogue caret');
  eq(pairs('Jack runs.\n\nCUT TO:\n\nEXT. ROOF - DAY'), [['action', 'Jack runs.'], ['transition', 'CUT TO:'], ['scene', 'EXT. ROOF - DAY']], 'transition ending TO:');
  eq(pairs('x\n\n> Burn to White.\n\ny')[1], ['transition', 'BURN TO WHITE.'], 'forced transition >');
  eq(pairs('> THE END <')[0], ['centered', 'THE END'], 'centered text');
  eq(plain(C.parse('# ACT I\n\n= Set up the characters.\n\nINT. A - DAY')), [{type: 'section', depth: 1, text: 'ACT I'}, {type: 'synopsis', text: 'Set up the characters.'}, {type: 'scene', text: 'INT. A - DAY'}], 'section and synopsis');
  eq(pairs('He sits. [[a note]]\n\n/* cut this\n\nSTEEL\nNo. */\n\nThe end.'), [['action', 'He sits.'], ['action', 'The end.']], 'notes and boneyard removed');
  eq(types('a\n\n===\n\nb'), ['action', 'pagebreak', 'action'], 'page break');
  eq(types('~Willy Wonka! Willy Wonka!'), ['lyric'], 'lyric');
  eq(pairs('!SCANNING THE AISLES...\nWhere is that pit boss?'), [['action', 'SCANNING THE AISLES...\nWhere is that pit boss?']], 'forced action with !');
  eq(pairs('She looks up.\nThen down.'), [['action', 'She looks up.\nThen down.']], 'action paragraph keeps line breaks');
  eq(plain(C.runs('a *b* **c** ***d*** _e_ \\*f\\*')), [{text: 'a '}, {text: 'b', i: true}, {text: ' '}, {text: 'c', b: true}, {text: ' '}, {text: 'd', b: true, i: true}, {text: ' '}, {text: 'e', u: true}, {text: ' '}, {text: '*'}, {text: 'f'}, {text: '*'}], 'emphasis runs and escapes');
  eq(plain(C.runs('5 * 3 * 2')), [{text: '5 * 3 * 2'}], 'a lone asterisk with spaces is not emphasis');
  eq(pairs('ÉLODIE\nÇa va ?'), [['character', 'ÉLODIE'], ['dialogue', 'Ça va ?']], 'accented cue');
  eq(types('東京\nこんにちは'), ['action'], 'caseless script stays action');
  eq(C.parse(''), [], 'empty');
  eq(C.parse('   \n\n\t'), [], 'whitespace');
  eq(C.parse(null), [], 'null');
}

if (suites.includes('model')) {
  section('model');
  const spaced = 'Title: Heist\n\nCredit: Written by\n\nAuthor: gptgames.dev\n\n\nINT. VAULT - NIGHT\n\nMARA works the dial.\n\nMARA\n\n(whispering)\n\nAlmost there.\n\nRYAN (V.O.)\n\nYou always say that.\n\nThe lock CLICKS.';
  eq(pairs(spaced), [['title', 'Heist'], ['title', 'Written by'], ['title', 'gptgames.dev'], ['scene', 'INT. VAULT - NIGHT'], ['action', 'MARA works the dial.'],
    ['character', 'MARA'], ['parenthetical', '(whispering)'], ['dialogue', 'Almost there.'], ['character', 'RYAN (V.O.)'], ['dialogue', 'You always say that.'], ['action', 'The lock CLICKS.']],
    'blank lines between title keys and inside dialogue are repaired');
  eq(types('\nBANG!\n\nThe door flies open.'), ['action', 'action'], 'a capitalised sound effect is not a cue');
  eq(types('\nCLOSE ON\n\nher eyes.'), ['action', 'action'], 'camera direction is not a cue');
  eq(pairs('CLOSE ON: MARA’S EYES, focused.'), [['action', 'CLOSE ON: MARA’S EYES, focused.']], 'CLOSE ON: line stays action');
  eq(pairs('JOHN: Where were you?\n\nMARY: Out.'), [['character', 'JOHN'], ['dialogue', 'Where were you?'], ['character', 'MARY'], ['dialogue', 'Out.']], 'NAME: line dialogue');
  eq(pairs('**INT. KITCHEN - DAY**\n\n**JOHN**\nHi.'), [['scene', 'INT. KITCHEN - DAY'], ['character', 'JOHN'], ['dialogue', 'Hi.']], 'markdown bold on heading and cue (old history items)');
  eq(pairs('### INT. KITCHEN - DAY\n\nSteam.'), [['scene', 'INT. KITCHEN - DAY'], ['action', 'Steam.']], 'markdown heading before a scene heading');
  eq(pairs('JOHN\n*(quietly)*\nHi.'), [['character', 'JOHN'], ['parenthetical', '(quietly)'], ['dialogue', 'Hi.']], 'markdown-italic parenthetical');
  eq(C.tidy('Sure! Here is your script:\n\n```fountain\nINT. A - DAY\n\nHello.\n```\nEnjoy!'), 'INT. A - DAY\n\nHello.\n', 'tidy strips fences and chatter');
  eq(C.tidy('Hello.\n\nEND SCENE.\n\nFADE OUT.\n\nTO: BLACK.\n\nTHE END'), 'Hello.\n\nFADE TO BLACK.\n\nTHE END\n', 'tidy drops END SCENE and mends a split FADE TO BLACK');
  eq(C.tidy('INT. A - DAY\r\n\r\nHello.  \n\n'), 'INT. A - DAY\n\nHello.\n', 'tidy normalises line ends');
  eq(C.appendContinuation('INT. A - DAY\n\nShe opens the', 'door and walks out.'), 'INT. A - DAY\n\nShe opens the door and walks out.', 'continuation joins a cut sentence');
  eq(C.appendContinuation('INT. A - DAY\n\nShe leaves.', 'EXT. B - DAY\n\nRain.'), 'INT. A - DAY\n\nShe leaves.\n\nEXT. B - DAY\n\nRain.', 'continuation starts a new element');
  eq(C.appendContinuation('A.\n\nShe leaves.', 'She leaves.\n\nRain.'), 'A.\n\nShe leaves.\n\nRain.', 'continuation drops a repeated last line');
  eq(C.appendContinuation('A.', 'Title: X\nAuthor: Y\n\nB.'), 'A.\n\nB.', 'continuation drops a repeated title page');
}

if (suites.includes('export')) {
  section('export');
  const s = 'Title: The Test\n\nINT. ROOM - DAY\n\nShe waits for a long, long time while the clock on the wall keeps ticking without mercy.\n\nANNA\n(quietly)\nIf he comes back tonight I will not open the door for him, whatever he says.\n\nCUT TO:';
  const lines = C.toPlain(C.parse(s)).split('\n');
  eq(lines[0], ' '.repeat(26) + 'THE TEST', 'title centred and capitalised');
  check(lines.includes('INT. ROOM - DAY'), 'scene at margin');
  check(lines.every(l => l.length <= 60), 'no line wider than 60 columns (6 inches)', lines.find(l => l.length > 60));
  eq(lines.find(l => l.trim() === 'ANNA'), ' '.repeat(22) + 'ANNA', 'cue at 2.2 inches');
  eq(lines.find(l => l.includes('(quietly)')), ' '.repeat(16) + '(quietly)', 'parenthetical at 1.6 inches');
  const dlg = lines.filter(l => /^ {10}\S/.test(l));
  check(dlg.length >= 2 && dlg.every(l => l.length - 10 <= 35), 'dialogue at 1 inch, 35 columns wide', JSON.stringify(dlg));
  eq(lines[lines.length - 2], ' '.repeat(53) + 'CUT TO:', 'transition flush right');
  eq(C.wrap('abcdefghij', 4), ['abcd', 'efgh', 'ij'], 'an unbreakable word is split, not overflowed');
  // Fountain export must read back as the same script.
  const samples = [s, 'Title: X\nAuthor: Y\n\n.SNIPER POV\n\nHello.\n\nBRICK ^\nNo.\n\n@McCLANE\nYes.\n\n> THE END <\n\n# ACT II\n\n= beat\n\n~la la\n\n===\n\nFADE OUT.',
    'INT. A - DAY\n\nTHE DOOR\nopens slowly.\n\nShe screams.\n\nTHAT IS ALL.\n\nGO TO:', 'Title: Heist\n\nCredit: Written by\n\nMARA\n\n(whispering)\n\nAlmost there.'];
  for (const [n, x] of samples.entries()) {
    const els = plain(C.parse(x));
    eq(plain(C.parse(C.toFountain(els))), els, `Fountain round trip ${n + 1}`);
  }
  const md = C.toMarkdown(C.parse(s));
  check(md.startsWith('# The Test\n\n### INT. ROOM - DAY\n\n'), 'markdown headings', md.slice(0, 60));
  check(md.includes('**ANNA**\n*(quietly)*\n> If he'), 'markdown keeps cue, parenthetical and line together', md);
  check(!C.toMarkdown(C.parse('A <b>tag</b> # and [link]')).includes('<b>'), 'markdown escapes HTML');
  eq(C.pageCount([]), 0, 'no pages for nothing');
  eq(C.pageCount(C.parse('INT. A - DAY\n\nHi.')), 1, 'a scrap counts as one page');
  const long = Array.from({length: 110}, (_, i) => `INT. ROOM ${i} - DAY`).join('\n\n');
  eq(C.pageCount(C.parse(long)), 4, '110 headings and blanks = 219 lines = 4 pages at 55');
  eq(C.fileName('The Last Lighthouse', 'fountain'), 'The_Last_Lighthouse.fountain', 'file name');
  eq(C.fileName('Amélie: "Paris" / 東京 🎬', 'pdf'), 'Amelie_Paris.pdf', 'file name strips what file systems refuse');
  eq(C.fileName('   ', 'fountain'), 'screenplay.fountain', 'empty title file name');
}

if (suites.includes('request')) {
  section('request');
  const req = f => C.buildRequest(Object.assign(C.defaults(), f));
  const user = f => req(f).messages[1].content;
  const r = req({movieTitle: 'Heist'});
  eq([r.model, r.temperature, r.max_tokens, r.messages.map(m => m.role)], ['gpt-4o-mini', 0.6, 8000, ['system', 'user']], 'defaults: model, temperature 0.6 from creativity 30, roles');
  check(/Fountain/.test(r.messages[0].content) && /no markdown/.test(r.messages[0].content), 'system message asks for Fountain, no markdown');
  eq(user({movieTitle: '  Heist  '}), 'Title: Heist\nStructure: follow a three-act structure.\n\n' + C.LENGTHS.medium.ask + ' End with a transition such as FADE OUT.', 'title only');
  eq(user({movieTitle: 'X', genre: 'Science Fiction', tagline: 'Steal time', setting: 'Paris', timePeriod: '1920s', structure: 'save-the-cat', length: 'short'}),
    'Title: X\nGenre: Science Fiction\nTagline: Steal time\nSetting: Paris\nTime period: 1920s\nStructure: follow a Save the Cat beat sheet.\n\n' + C.LENGTHS.short.ask + ' End with a transition such as FADE OUT.', 'all basic fields');
  check(user({movieTitle: 'X', additionalCriteria: 'Ryan returns'}).includes('keep every name, character and event it mentions):\nRyan returns'), 'notes are sent as the premise to follow');
  check(user({movieTitle: 'X', genre: 'Other', customGenre: '  Noir  '}).includes('Genre: Noir\n'), 'custom genre, trimmed');
  check(!user({movieTitle: 'X', structure: 'none'}).includes('Structure'), 'no structure');
  check(!/Tone|Pacing/.test(user({movieTitle: 'X'})), 'neutral tone and balanced pacing are not sent');
  check(user({movieTitle: 'X', tone: 'dark', pacing: 'fast'}).includes('Tone: dark\nPacing: fast'), 'tone and pacing');
  eq(user({movieTitle: 'X', characters: [{name: 'Ann', role: 'protagonist', description: 'a thief'}, {name: '', role: 'supporting', description: 'ignored'}, {name: 'Bob', role: 'antagonist', description: ''}]}).split('\n')[2],
    'Characters: Ann (protagonist, a thief); and Bob (antagonist)', 'characters: unnamed cards are skipped, no stray commas');
  check(!user({movieTitle: 'X', characters: [{name: ' ', role: 'protagonist', description: ''}]}).includes('Characters'), 'only unnamed cards: no characters line');
  check(user({movieTitle: 'X', plotSummary: 'Act one.\r\n\r\n\r\nAct two.'}).includes('Plot outline:\nAct one.\n\nAct two.'), 'plot outline keeps paragraphs');
  check(user({movieTitle: '"Amélie 東京" 🎬'}).startsWith('Title: "Amélie 東京" 🎬\n'), 'non-ASCII and quotes untouched');
  eq([0, 30, 50, 100, 150, -5, 'abc'].map(c => C.temperature(c)), [0, 0.6, 1, 2, 2, 0, 0.6], 'creativity -> temperature');
  eq(['short', 'medium', 'long'].map(l => req({movieTitle: 'X', length: l}).max_tokens), [3000, 8000, 15800], 'length -> token budget');
  const c = C.buildRequest(Object.assign(C.defaults(), {movieTitle: 'X'}), {continueFrom: 'INT. A - DAY'});
  eq(c.messages.map(m => m.role), ['system', 'user', 'assistant', 'user'], 'keep writing sends the script so far');
}

if (suites.includes('errors')) {
  section('errors');
  eq(C.titleFromNotes('   working title:  NIGHT SHIFT @ St. Agnes  ...  hospital, 3am'), 'NIGHT SHIFT @ St. Agnes', 'title picked out of a pasted note');
  eq(C.titleFromNotes('Title: "Cold Orbit"\nTwo astronauts'), 'Cold Orbit', 'quoted title line');
  eq(C.titleFromNotes('A nurse and an intern. Title: later'), '', 'only a leading title line counts');
  const v = f => plain(C.validate(Object.assign(C.defaults(), f)));
  eq(Object.keys(v({movieTitle: ''})), ['movieTitle'], 'empty title');
  eq(Object.keys(v({movieTitle: ' \t\n '})), ['movieTitle'], 'whitespace title');
  eq(v({movieTitle: 'Heist'}), {}, 'valid');
  eq(Object.keys(v({movieTitle: 'x'.repeat(201)})), ['movieTitle'], 'title too long');
  eq(v({movieTitle: 'x'.repeat(200)}), {}, '200 characters is fine');
  eq(Object.keys(v({movieTitle: 'X', genre: 'Other', customGenre: '  '})), ['customGenre'], 'Other genre needs a name');
  eq(Object.keys(v({movieTitle: 'X', additionalCriteria: 'y'.repeat(4001)})), ['additionalCriteria'], 'notes too long');
  check(/4,001/.test(v({movieTitle: 'X', plotSummary: 'y'.repeat(4001)}).plotSummary), 'the message says how long it is');
  const throws = (fn, re, what) => { try { fn(); check(false, what, 'did not throw'); } catch (e) { check(re.test(e.message), what, e.message); } };
  const ok = {choices: [{message: {content: '```\nINT. A - DAY\n\nHi.\n```'}, finish_reason: 'stop'}]};
  eq(plain(C.readResponse(200, ok)), {text: 'INT. A - DAY\n\nHi.\n', truncated: false}, 'a good answer');
  eq(C.readResponse(200, {choices: [{message: {content: 'INT. A'}, finish_reason: 'length'}]}).truncated, true, 'length limit is reported');
  throws(() => C.readResponse(500, null), /problem \(error 500\)/, 'server error');
  throws(() => C.readResponse(429, {}), /busy/, 'rate limit');
  throws(() => C.readResponse(400, {}), /refused/, 'bad request');
  throws(() => C.readResponse(200, {}), /empty page/, 'no choices');
  throws(() => C.readResponse(200, {choices: [{message: {content: '  \n '}}]}), /empty page/, 'blank content');
  throws(() => C.readResponse(200, {error: 'Unexpected token'}), /answered with an error: Unexpected token/, 'proxy error body');
  throws(() => C.readResponse(200, null), /empty page/, 'unparseable body');
}

if (suites.includes('saves')) {
  section('saves');
  const old = {movieTitle: 'Heist', genre: 'Noir', customGenre: '', additionalCriteria: 'x', tagline: 't', creativity: '0', tone: 'dark', pacing: 'slow',
    length: 'long', structure: 'hero-journey', setting: 's', timePeriod: 'p', plotSummary: 'q', characters: [{name: 'Ann', role: 'protagonist', description: 'd'}]};
  const n = plain(C.normaliseSettings(old));
  eq([n.genre, n.customGenre], ['Other', 'Noir'], 'an unknown saved genre becomes Other + its name');
  eq(n.creativity, '0', 'a saved creativity of 0 stays 0 (the old page reset it to 30)');
  eq([n.tone, n.pacing, n.length, n.structure, n.characters], ['dark', 'slow', 'long', 'hero-journey', [{name: 'Ann', role: 'protagonist', description: 'd'}]], 'old settings kept');
  eq(plain(C.normaliseSettings({movieTitle: 7, tone: 'weird', length: 'epic', creativity: '33', characters: [null, {name: 'B', role: 'villain'}]})),
    Object.assign(C.defaults(), {movieTitle: '7', creativity: '35', characters: [{name: 'B', role: 'supporting', description: ''}]}), 'bad values fall back to defaults');
  eq(plain(C.normaliseSettings('garbage')), plain(C.defaults()), 'non-object');
  eq(plain(C.normaliseSettings(null)), plain(C.defaults()), 'null');
  eq(plain(C.normaliseSettings({creativity: ''})).creativity, '30', 'empty creativity');
  eq(plain(C.readHistory('{not json')), [], 'corrupt history does not break the page');
  eq(plain(C.readHistory('{"a":1}')), [], 'history that is not a list');
  eq(plain(C.readHistory(null)), [], 'no history');
  const h = plain(C.readHistory(JSON.stringify([{id: 1, title: '<b>x</b>', genre: 'Drama', date: '2025-01-01T00:00:00.000Z', markdown: '# X\n\n**INT. A**'}, {id: 2, markdown: ''}, 5, {id: 3, title: '', markdown: 'y'}])));
  eq(h.map(x => [x.id, x.title, x.genre]), [[1, '<b>x</b>', 'Drama'], [3, 'Untitled', 'None']], 'old history items read, empty ones dropped');
  const many = Array.from({length: 12}, (_, i) => ({id: i, title: 't' + i, genre: 'None', date: '', markdown: 'm'}));
  eq(C.readHistory(JSON.stringify(many)).length, 10, 'history capped at 10');
  eq(plain(C.addToHistory(many.slice(0, 10), {id: 99, markdown: 'n'})).map(x => x.id), [99, 0, 1, 2, 3, 4, 5, 6, 7, 8], 'newest first, oldest dropped');
  eq(plain(C.addToHistory(many.slice(0, 3), {id: 1, markdown: 'longer'})).map(x => x.id), [1, 0, 2], 'keep writing replaces its own entry');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
