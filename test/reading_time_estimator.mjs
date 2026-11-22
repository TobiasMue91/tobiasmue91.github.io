#!/usr/bin/env node
// Test suite for tools/reading_time_estimator.html (Reading Time Estimator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The tool promises that a word is what a
// reader reads (hyphenated words once, dashes and URLs and Markdown/HTML syntax not at all, Chinese and
// Japanese per character), that the time is words / speed with nothing hidden (238 wpm reading and 140
// wpm speaking by default, Medium's 12 s-and-down rule for images), that durations are rounded once and
// never print "1 min 60 s", and that the four readability formulas are the published ones
// (Flesch 1948, Kincaid 1975, McLaughlin 1969, Senter & Smith 1967). No browser, no server.
//
//   node test/reading_time_estimator.mjs              # everything
//   node test/reading_time_estimator.mjs words time   # named suites only
//
// Suites: words, markup, sentences, time, format, syllables, readability, speed, misc, huge.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'reading_time_estimator.html');
const ALL = ['words', 'markup', 'sentences', 'time', 'format', 'syllables', 'readability', 'speed', 'misc', 'huge'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, what, tol = 1e-6) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Intl};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const A = (t, o) => C.analyze(t, o);

if (suites.includes('words')) {
  section('words');
  const W = [
    ['', 0, 0], ['   \n\t  ', 0, 0], ['Hello', 1, 0], ['Hello, world!', 2, 0],
    ["don't stop", 2, 0], ['don’t stop', 2, 0], ['a well-known state-of-the-art tool', 4, 0],
    ['tools—like this one—work', 5, 0], ['1990–2000', 2, 0], ['wait — what', 2, 0],
    ['3.14 and 1,000', 3, 0], ['\u{1F600} \u{1F600} \u{1F600}', 0, 0], ['— & ... * #', 0, 0],
    ['Grüße aus München', 3, 0], ['Привет мир', 2, 0],
    ['مرحبا بالعالم', 2, 0],
    ['नमस्ते दुनिया', 2, 0],
    ['我爱读书。今天天气很好。', 0, 10],
    ['我爱iPhone手机', 1, 4], ['これはペンです', 0, 7],
    ['コーヒー', 0, 4], ['C3PO R2-D2', 2, 0], ['e.g. i.e. etc.', 3, 0],
    ['word\nword\r\nword', 3, 0], ['tab\tseparated nbsp', 3, 0], ['#hashtag @user', 2, 0],
  ];
  for (const [t, w, c] of W) { const r = C.count(C.toProse(t).text); eq([r.words, r.cjk], [w, c], `count ${JSON.stringify(t)}`); }
  eq(C.count('これは漢字').lang, 'ja', 'kana makes it Japanese');
  eq(C.count('汉字').lang, 'zh', 'Han alone is Chinese');
  eq(C.count('ภาษาไทยง่ายนิดเดียว').words, 5, 'Thai is segmented into words');
  eq(C.count('\u{20000}\u{20001}').cjk, 2, 'CJK extension B (astral) counts per character');
}

if (suites.includes('markup')) {
  section('markup');
  const md = '---\ntitle: "Post"\ntags: [a, b]\n---\n\n# Heading here\n\nSome **bold** and *italic* and _under_ and ~~gone~~ text.\n\n' +
    '- first item\n* second item\n1. third item\n2) fourth item\n- [x] done task\n\n> quoted line\n\n' +
    '![alt words](pic.png) and ![ref][r]\n\nA [link text](https://x.y/(paren)) and [ref link][r].\n\n[r]: https://example.com\n\n' +
    '```js\nconst a = 1;\n```\n\n| col one | col two |\n|---|:---:|\n| a | b |\n\n---\n\nVisit https://foo.bar/x?y=1 or www.baz.org now.';
  const p = C.toProse(md);
  eq(p.kind, 'markdown', 'Markdown detected');
  eq(p.images, 2, 'two images (inline and reference)');
  eq(p.code, 1, 'one code block');
  check(!/title|tags/.test(p.text), 'front matter dropped', p.text.slice(0, 60));
  check(!/[#*_~`|>\[\]]/.test(p.text), 'no Markdown syntax left', p.text);
  check(!/https?:|www\.|example\.com|pic\.png/.test(p.text), 'no URLs left', p.text);
  check(/link text/.test(p.text) && /ref link/.test(p.text), 'link text kept');
  check(!/const/.test(p.text), 'fenced code is not counted');
  eq(p.frontMatter, true, 'front matter reported');
  check(!/^\s*\d[.)]/m.test(p.text), 'list numbers dropped');
  eq(C.count(p.text).words, 39, 'word count of the Markdown sample');

  const h = C.toProse('<html><head><style>p{color:red}</style><script>var x="no words";</script></head><body><h1>Title</h1><p>Hello <b>there</b>&nbsp;friend &amp; co.</p><img src="a.png"><p>Caf&eacute; &#233; &#x2014; end</p><!-- hidden --></body></html>');
  eq(h.kind, 'html', 'HTML detected');
  eq(h.images, 1, 'one <img>');
  check(!/color|no words|hidden/.test(h.text), 'script, style and comments dropped', h.text);
  check(/Hello there friend & co\./.test(h.text), 'entities decoded, tags stripped', h.text);
  check(/é — end/.test(h.text), 'numeric entities decoded', h.text);
  eq(C.paragraphs(h.text), 3, 'block tags become paragraphs');

  eq(C.toProse('Use a < b and c > d in maths.').kind, 'plain', 'angle brackets alone are not HTML');
  eq(C.toProse('see https://example.com today').kind, 'plain', 'a bare URL is not Markdown');
  eq(A('see https://example.com today').words, 2, 'a bare URL is not counted as a word');
  eq(A('see https://example.com today').rawWords, 3, 'raw count keeps it');
  eq(C.toProse('2 * 3 * 4 = 24').text, '2 * 3 * 4 = 24', 'arithmetic asterisks are not emphasis');
  eq(C.toProse('snake_case_name and __init__').text.includes('snake_case_name'), true, 'underscores inside words survive');
  eq(C.toProse('```\nunclosed fence\nstill code').text, 'unclosed fence\nstill code', 'an unclosed fence keeps its text');
  eq(C.toProse('Intro.\n\n~~~\nx = 1\n~~~\n\nOutro.').text, 'Intro.\n\nOutro.', 'tilde fences are code too');
  eq(C.toProse('<p>Hi.</p><pre>int x;</pre><p>Bye.</p>').code, 1, '<pre> counts as a code block');
}

if (suites.includes('sentences')) {
  section('sentences');
  const S = [
    ['', 0], ['Hello', 1], ['Hello, world!', 1], ['One. Two! Three? Four… Five', 5],
    ['Dr. Smith met Mr. Jones at 5 p.m. today. They talked.', 2], ['Pi is 3.14 exactly. Yes.', 2],
    ['U.S. troops arrived. Then?', 2], ['J. K. Rowling wrote it. Fine.', 2],
    ['He said "Stop." Then he left.', 2], ['(Like this.) And this.', 2], ['Really?! Yes!!!', 2],
    ['我爱读书。今天天气很好！真的吗？', 3],
    ['Title line\nBody text here.', 2], ['First para\n\nsecond para starts lower', 2],
    ['This is a long line of hard-wrapped prose that goes on\nand continues on the next line.', 1],
    ['- one item\n- two items', 2], ['... --- ...', 0], ['Version 2.0.1 is out. Get it.', 2],
    ['See e.g. the docs. Then go.', 2], ['It ends with an abbreviation etc.', 1],
  ];
  for (const [t, n] of S) eq(A(t).sentences, n, `sentences ${JSON.stringify(t)}`);
  const P = [['', 0], ['one', 1], ['a\nb\nc', 3], ['a\nb\n\nc', 2], ['a\n\n\n\nb', 2], ['a\n\n\u{1F600}\n\nb', 2], ['  \n  ', 0]];
  for (const [t, n] of P) eq(A(t).paragraphs, n, `paragraphs ${JSON.stringify(t)}`);
}

if (suites.includes('time')) {
  section('time');
  const words = n => Array(n).fill('word').join(' ');
  near(A(words(238)).readSeconds, 60, '238 words at the default 238 wpm is one minute');
  near(A(words(140)).speakSeconds, 60, '140 words at the default 140 wpm speaking is one minute');
  near(A(words(1000), {wpm: 250}).readSeconds, 240, '1000 words at 250 wpm is 4 min');
  near(A(words(1000), {wpm: 450}).readSeconds, 1000 / 450 * 60, 'at 450 wpm');
  near(A(words(100), {speakWpm: 100}).speakSeconds, 60, 'speaking speed is its own');
  near(A('汉'.repeat(260)).readSeconds, 60, '260 Chinese characters a minute at default');
  near(A('あ'.repeat(400)).readSeconds, 60, '400 Japanese characters a minute at default');
  near(A('汉'.repeat(260), {wpm: 476}).readSeconds, 30, 'character speed scales with the chosen speed');
  near(A('汉'.repeat(220)).speakSeconds, 60, 'Chinese spoken at 220 characters a minute');
  near(A('我爱iPhone手机').readSeconds, 60 / 238 + 4 * 60 / 260, 'mixed Latin and Han add up');
  near(A('![a](1.png)').imageSeconds, 12, 'one image: 12 s');
  near(A('![a](1.png) ![b](2.png) ![c](3.png)').imageSeconds, 33, 'three images: 12 + 11 + 10');
  near(A(Array(15).fill('![x](y.png)').join('\n\n')).imageSeconds, 75 + 5 * 3, 'fifteen images: 12..3, then 3 s each');
  near(A('word ![a](1.png)').speakSeconds, 60 / 140, 'images are not spoken');
  eq(A('').readSeconds, 0, 'empty is zero');
  eq(A('\u{1F600}\u{1F600}').readSeconds, 0, 'emoji only is zero');
  eq(A(null).words, 0, 'null is empty, not "null"');
  eq(A(undefined).words, 0, 'undefined is empty');
  near(A(words(238), {wpm: 0}).readSeconds, 60, 'a zero speed falls back to the default');
  near(A(words(238), {wpm: -5}).readSeconds, 60, 'a negative speed falls back to the default');
}

if (suites.includes('format')) {
  section('format');
  const F = [[0, '0 s'], [-3, '0 s'], [NaN, '0 s'], [0.2, '1 s'], [0.5, '1 s'], [1, '1 s'], [44.6, '45 s'], [59.4, '59 s'],
    [59.5, '1 min'], [60, '1 min'], [89.6, '1 min 30 s'], [119.6, '2 min'], [222, '3 min 42 s'], [3599.4, '59 min 59 s'],
    [3599.6, '1 h'], [3600, '1 h'], [3689, '1 h 1 min'], [3690, '1 h 2 min'], [7170, '2 h'], [7500, '2 h 5 min'],
    [86400 * 2, '48 h']];
  for (const [s, want] of F) eq(C.formatDuration(s), want, `formatDuration(${s})`);
  const B = [[0, '0 min'], [1, '1 min'], [59, '1 min'], [60, '1 min'], [60.0000001, '1 min'], [60.4, '1 min'], [60.5, '2 min'], [61, '2 min'], [600, '10 min'], [3601, '61 min']];
  for (const [s, want] of B) eq(C.minutesBadge(s), want, `minutesBadge(${s})`);
  eq(C.fmtInt(0), '0', 'fmtInt 0'); eq(C.fmtInt(1234567), '1,234,567', 'fmtInt groups thousands'); eq(C.fmtInt(999), '999', 'fmtInt 999');
}

if (suites.includes('syllables')) {
  section('syllables');
  // Counts from standard dictionaries (Merriam-Webster hyphenation / CMU pronouncing dictionary).
  const W = {cat:1,table:2,little:2,wanted:2,needed:2,jumped:1,played:1,makes:1,boxes:2,houses:2,wishes:2,
    reading:2,estimate:3,estimator:4,information:4,internet:3,computer:3,beautiful:3,simple:2,readability:5,
    education:4,communication:5,international:5,university:5,technology:4,character:3,sentence:2,paragraph:3,
    minute:2,average:3,people:2,quiet:2,science:2,lion:2,poetry:3,area:3,idea:3,create:2,radio:3,period:3,
    yellow:2,happy:2,syllable:3,everything:3,library:3,generation:4,ocean:2,special:2,social:2,nation:2,
    ancient:2,musician:3,variable:4,material:4,serious:3,curious:3,piano:3,violent:3,diamond:3,trial:2,
    going:2,doing:2,seeing:2,agreed:2,freedom:2,poem:2,movie:2,stories:2,cities:2,tries:1,fire:1,hour:1,
    whole:1,smile:1,timeline:2,lovely:2,hopeful:2,careful:2,something:2,anyone:3,before:2,apple:2,bottle:2,
    circle:2,uncle:2,able:2,the:1,through:1,thought:1,straight:1,world:1,access:2,wide:1,provides:2,
    provided:3,connected:3,limited:3,alien:3,usual:3,actual:3,annual:3,situation:4,evaluate:4,graduate:3,
    individual:5,client:2,experience:4,audience:3,video:3,studio:3,million:2,billion:2,onion:2,opinion:3,
    question:2,religion:3,champion:3,radiation:4,media:3,trivia:3,criteria:4,bacteria:4,fluid:2,ruin:2,suit:1,
    fruit:1,build:1,guide:1,quite:1,liquid:2,language:2,guess:1,queen:1,eye:1,obey:2,they:1,key:1,money:2,
    journey:2,valley:2,player:2,mayor:2,layer:2,buyer:2,toy:1,enjoy:2,royal:2,loyal:2,employee:3,coin:1,
    noise:1,poet:2,water:2,mother:2,children:2,important:3,another:3,together:3,family:3,history:3,
    government:3,company:3,problem:2,system:2,number:2,however:3,possible:3,national:3,president:3,
    political:4,developed:3,remember:3,available:4,community:4,management:3,activity:4,performance:3,
    particular:4,economy:4,environment:4,relationship:4,especially:4,organization:5,responsibility:6,
    unfortunately:5,immediately:5,necessary:4,whatever:3,officer:3,decided:3,complete:2,increase:2,
    stayed:1,enjoyed:2,destroyed:2,believe:2,piece:1,field:1,friend:1,achieve:2,easier:3,happier:3,
    earlier:3,patient:2,efficient:3,quality:3,equal:2,square:1,quickly:2,value:2,continue:3,rescue:2,
    huge:1,tongue:1,league:1,unique:2,technique:2,nature:2,picture:2,future:2,culture:2,measure:2,usually:4,
    actually:4,finally:3,really:2,simply:2,gently:2,terribly:3,possibly:3,example:3,purple:2,candle:2,
    battles:2,tables:2,smiles:1,lives:1,hopes:1,changes:2,places:2,pages:2,prices:2,months:1,clothes:1};
  let ok = 0, n = 0; const bad = [];
  for (const [w, s] of Object.entries(W)) { n++; const g = C.syllables(w); if (g === s) ok++; else bad.push(`${w} ${g}/${s}`); }
  check(bad.length === 0, `syllables: ${ok}/${n} exact`, bad.join(', '));
  eq(C.syllables('Hello!'), 2, 'punctuation and case ignored');
  eq(C.syllables(''), 0, 'empty word');
  eq(C.syllables('a'), 1, 'one letter');
}

if (suites.includes('readability')) {
  section('readability');
  // "The cat sat on the mat." x5: 30 words, 5 sentences, 30 syllables, 0 polysyllables, 85 letters.
  const cat = Array(5).fill('The cat sat on the mat.').join(' ');
  const r = A(cat);
  eq([r.words, r.sentences, r.syllables, r.polysyllables], [30, 5, 30, 0], 'cat counts');
  near(r.fleschReadingEase, 206.835 - 1.015 * 6 - 84.6 * 1, 'Flesch reading ease (Flesch 1948)');
  near(r.fleschKincaidGrade, 0.39 * 6 + 11.8 * 1 - 15.59, 'Flesch-Kincaid grade (Kincaid 1975)');
  near(r.smogIndex, 3.1291, 'SMOG with no polysyllables is its constant (McLaughlin 1969)');
  near(r.automatedReadabilityIndex, 4.71 * (85 / 30) + 0.5 * 6 - 21.43, 'ARI (Senter & Smith 1967)');
  eq(r.readabilityLabel, 'Very easy', 'label');
  check(r.readabilityReliable, '30 English words are enough');
  // A dense sentence: 10 words of 4 syllables in one sentence, x3.
  const dense = Array(3).fill('Information communication generation radiation situation evaluation education organization celebration population.').join(' ');
  const d = A(dense);
  eq([d.words, d.sentences], [30, 3], 'dense counts');
  near(d.smogIndex, 1.043 * Math.sqrt(d.polysyllables * 30 / 3) + 3.1291, 'SMOG from its polysyllables');
  check(d.fleschReadingEase < 0, 'dense text scores below zero (not clamped in the core)', d.fleschReadingEase);
  eq(d.readabilityLabel, 'Very difficult', 'label for very hard text');
  eq(C.label(90), 'Very easy', 'label 90'); eq(C.label(89.99), 'Easy', 'label 89.99'); eq(C.label(60), 'Standard', 'label 60');
  eq(C.label(59.9), 'Fairly difficult', 'label 59.9'); eq(C.label(30), 'Difficult', 'label 30'); eq(C.label(29.9), 'Very difficult', 'label 29.9');
  check(/Elementary/.test(C.gradeNote(6.4)), 'grade 6.4 is elementary'); check(/Middle/.test(C.gradeNote(6.5)), 'grade 6.5 rounds to 7: middle');
  check(/Graduate/.test(C.gradeNote(16.5)), 'grade 16.5 is graduate');
  check(!A('The cat sat.').readabilityReliable, 'three words are not enough to score');
  const ru = A(Array(40).fill('Привет').join(' ') + '.');
  check(!ru.english && ru.fleschReadingEase === null, 'Cyrillic text is not scored as English');
  check(A(cat + ' 我们也翻译了。').english, 'a stray Chinese line keeps English scores on');
  eq(A(cat).notes, ['Reads well: no long sentences or heavy vocabulary.'], 'easy text gets the all-clear note');
  const long = Array(5).fill(Array(25).fill('word').join(' ') + '.').join(' ');
  check(A(long).notes.some(n => /Sentences average 25/.test(n)), 'long sentences are named with their length');
  const blob = Array(12).fill('The cat sat on the mat.').join(' ');
  check(A(blob + ' ' + blob).notes.some(n => /One block/.test(n)), 'one paragraph over 100 words gets a note');
  // keywords
  const k = A("Reading reading READING time time Brysbaert's Brysbaert the that with words.").keywords;
  eq(k.map(x => x.word + x.freq), ['reading3', 'time2', 'brysbaert2'], 'keywords: case-folded, possessive merged, stop words and one-offs out, ties first-seen');
}

if (suites.includes('speed')) {
  section('speed');
  const P = [['250', 250], [' 250 wpm ', 250], ['250 WPM', 250], ['300 words per minute', 300], ['250,4', 250], ['250.6', 251],
    ['1000', 1000], ['50', 50]];
  for (const [s, v] of P) eq(C.parseSpeed(s, 50, 1000).value, v, `parseSpeed(${JSON.stringify(s)})`);
  const E = [['', 'empty'], ['   ', 'empty'], ['abc', 'nan'], ['-5', 'nan'], ['0', 'range'], ['49', 'range'], ['1001', 'range'],
    ['1.200', 'range'], ['2 5 0', 'nan'], ['1e3', 'nan']];
  for (const [s, e] of E) eq(C.parseSpeed(s, 50, 1000).error, e, `parseSpeed(${JSON.stringify(s)}) error`);
}

if (suites.includes('misc')) {
  section('misc');
  eq(C.graphemes('\u{1F44D}\u{1F3FD}'), 1, 'emoji with skin tone is one character');
  eq(C.graphemes('é'), 1, 'e + combining accent is one character');
  eq(C.graphemes('\u{1F468}‍\u{1F469}‍\u{1F467}'), 1, 'family emoji is one character');
  eq(A('ab\r\ncd').chars, 4, 'line breaks are not characters; CRLF is one break');
  eq(A('a b\tc').chars, 5, 'spaces and tabs are characters');
  eq(A('a b\tc').charsNoSpaces, 3, 'no-space count drops them');
  const s = A('Most adults read about 238 words a minute.');
  eq([s.words, s.sentences, s.paragraphs], [8, 1, 1], 'a plain sentence');
  eq(A('word').wpm, 238, 'default reading speed 238');
  eq(A('word').speakWpm, 140, 'default speaking speed 140');
}

if (suites.includes('huge')) {
  section('huge');
  const big = 'The quick brown fox jumps over the lazy dog. '.repeat(120000); // ~5.4 MB, 1.08 M words
  const t0 = Date.now(); const r = A(big); const ms = Date.now() - t0;
  eq(r.words, 1080000, 'a million words counted exactly');
  eq(r.sentences, 120000, '120,000 sentences');
  near(r.readSeconds, 1080000 * 60 / 238, 'time for a million words', 1e-3);
  eq(C.formatDuration(r.readSeconds), '75 h 38 min', 'formatted');
  check(ms < 8000, `5 MB analysed in ${ms} ms`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
