#!/usr/bin/env node
// Test suite for tools/online_qr_code_reader.html (QR Code Reader).
//
// Runs the page's DOM-free <script id="core"> block in Node. A QR reader promises two things: that it
// reports exactly what the code holds, and that its reading of that text (a link and where it really
// goes, a Wi-Fi password, a contact, a bank transfer) is right. The core is checked against the
// published definitions of each payload format, with their own examples where the spec has them
// (RFC 3492 Punycode samples, RFC 6068 mailto, RFC 5870 geo, the Google Authenticator key URI, ECBS
// IBAN examples, EPC069-12), and against independent implementations (Node's url.domainToUnicode,
// BigInt MOD 97). The `decode` suite then runs codes made by an independent encoder (the `qrcode`
// package) through the same zxing-wasm build the page loads, so the whole path from pixels to the
// parsed result is covered. It is skipped, not passed, unless the two packages are installed:
//
//   npm i --no-save zxing-wasm@3.1.6 qrcode@1.5.4
//
//   node test/online_qr_code_reader.mjs               # everything
//   node test/online_qr_code_reader.mjs url wifi      # named suites only
//
// Suites: url, puny, wifi, contact, mail, phone, geo, event, otp, pay, text, history, summary, util, decode.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {domainToASCII, domainToUnicode} from 'url';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PAGE = join(ROOT, 'tools', 'online_qr_code_reader.html');
const ALL = ['url', 'puny', 'wifi', 'contact', 'mail', 'phone', 'geo', 'event', 'otp', 'pay', 'text', 'history', 'summary', 'util', 'decode'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0, skipped = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URL, TextEncoder, TextDecoder, Uint8Array, console};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;
const P = (t, o) => JSON.parse(JSON.stringify(C.parse(t, o)));
const field = (r, label) => (r.fields.find(f => f.label === label) || {}).value;
const levels = r => r.warnings.map(w => w.level);
const primary = r => r.actions.find(a => a.primary);

const T = {
  url() {
    let r = P('https://example.com/a?b=1');
    eq([r.kind, r.url.registrable, r.url.sub, r.url.path, r.warnings.length], ['url', 'example.com', '', '/a?b=1', 0], 'plain https link');
    eq(primary(r).href, 'https://example.com/a?b=1', 'open goes to the exact link');
    r = P('  https://www.example.com/  \n');
    eq([r.kind, r.url.sub, r.url.registrable, r.url.path], ['url', 'www.', 'example.com', ''], 'surrounding whitespace, subdomain split off');
    r = P('HTTPS://Login.Example.CO.UK/x');
    eq([r.url.sub, r.url.registrable], ['login.', 'example.co.uk'], 'two-level public suffix keeps three labels, host lower-cased');
    r = P('https://someone.github.io/page');
    eq(r.url.registrable, 'someone.github.io', 'github.io sites are their own owner');
    r = P('http://example.com');
    eq(levels(r), ['caution'], 'http is a caution');
    r = P('http://192.168.0.1:8080/admin');
    eq([r.url.registrable, levels(r)], ['192.168.0.1', ['caution', 'caution', 'info']], 'IP + http + port');
    r = P('https://paypal.com@evil.example/x');
    eq([r.kind, r.url.registrable, levels(r)[0]], ['url', 'evil.example', 'danger'], 'userinfo decoy is danger and the real host is shown');
    eq([r.url.pretends, r.url.hostUnicode], ['paypal.com', 'evil.example'], 'userinfo decoy is what the link pretends to be');
    check(/paypal\.com/.test(r.warnings[0].text), 'userinfo warning quotes the decoy');
    r = P('https://аpple.com/'); // Cyrillic а
    eq([r.url.registrable, r.url.deceptive, levels(r)], ['xn--pple-43d.com', true, ['danger']], 'Cyrillic look-alike shown in encoded form, danger');
    r = P('https://xn--80ak6aa92e.com');
    eq([r.url.registrable, levels(r)], ['xn--80ak6aa92e.com', ['danger']], 'all-Cyrillic Latin-looking domain (apple) is danger');
    r = P('https://münchen.de/');
    eq([r.url.registrable, levels(r)], ['münchen.de', ['info']], 'German umlaut domain is shown in Unicode, info only');
    r = P('https://例え.jp/');
    eq([r.url.registrable, levels(r)], ['例え.jp', ['info']], 'Japanese domain shown in Unicode, info only');
    r = P('bit.ly/3abc');
    eq([r.url.href, levels(r)], ['https://bit.ly/3abc', ['info', 'info']], 'bare short link gets https and a short-link note');
    r = P('www.gptgames.dev');
    eq([r.kind, r.url.href, r.url.assumedScheme], ['url', 'https://www.gptgames.dev/', true], 'bare www host');
    r = P('javascript:alert(1)');
    eq([r.kind, r.url.openable, levels(r), r.actions.some(a => a.kind === 'open')], ['url', false, ['danger'], false], 'javascript: is never openable');
    r = P('data:text/html,<script>alert(1)</script>');
    eq([r.url.openable, r.actions.some(a => a.kind === 'open')], [false, false], 'data: is never openable');
    r = P('https://example.com/caf%C3%A9?q=%E2%9C%93');
    eq(r.url.path, '/café?q=✓', 'percent-encoded path shown decoded');
    r = P('https://example.com/%E0%A4%A');
    eq(r.url.path, '/%E0%A4%A', 'malformed percent-escape shown as is');
    r = P('https://example.com/a b');
    eq(r.kind, 'text', 'a space makes it text, not a link');
    r = P('example');
    eq(r.kind, 'text', 'a single word is text');
    r = P('3.14');
    eq(r.kind, 'text', 'a decimal number is not a host');
    r = P('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
    eq([r.kind, primary(r).kind], ['uri', 'copy'], 'app link: copy is primary, opening is offered second');
    r = P('https://');
    eq(r.kind, 'text', 'scheme with nothing after is not a link');
  },

  puny() {
    // RFC 3492 section 7.1 sample strings
    const V = [
      ['ihqwcrb4cv8a8dqg056pqjye', '他们为什么不说中文'],
      ['ihqwctvzc91f659drss3x8bo0yb', '他們爲什麽不說中文'],
      ['3B-ww4c5e180e575a65lsy2b', '3年B組金八先生'],
      ['-with-SUPER-MONKEYS-pc58ag80a8qai00g7n9n', '安室奈美恵-with-SUPER-MONKEYS'],
      ['Hello-Another-Way--fc4qua05auwb3674vfr0b', 'Hello-Another-Way-それぞれの場所'],
      ['2-u9tlzr9756bt3uc0v', 'ひとつ屋根の下2'],
      ['MajiKoi5-783gue6qz075azm5e', 'MajiでKoiする5秒前'],
      ['de-jg4avhby1noc0d', 'パフィーdeルンバ'],
      ['d9juau41awczczp', 'そのスピードで'],
    ];
    for (const [a, u] of V) eq(C.punyDecode(a), u, `RFC 3492: ${u}`);
    // Against Node's own IDNA implementation
    const words = ['bücher', 'faß', 'ελληνικά', 'россия', 'مثال', 'δοκιμή', 'café-crème', '日本語', '한국어', 'ñandú', 'smörgåsbord', 'ありがとう'];
    for (const w of words) {
      const ascii = domainToASCII(w + '.example');
      eq(C.hostToUnicode(ascii), domainToUnicode(ascii), `hostToUnicode = node for ${w}`);
    }
    eq(C.hostToUnicode('xn--zz.example'), 'xn--zz.example', 'invalid punycode label left alone');
  },

  wifi() {
    let w = C.parseWifi('WIFI:T:WPA;S:mynetwork;P:mypass;;');
    eq([w.ssid, w.password, w.security, w.hidden], ['mynetwork', 'mypass', 'WPA/WPA2/WPA3', false], 'ZXing example');
    w = C.parseWifi('WIFI:S:My Net;T:WPA;P:pa\\;ss\\:w\\,o\\\\rd\\";H:true;;');
    eq([w.ssid, w.password, w.hidden], ['My Net', 'pa;ss:w,o\\rd"', true], 'escapes for ; : , \\ " and any field order');
    w = C.parseWifi('wifi:T:nopass;S:Guest;;');
    eq([w.ssid, w.password, w.security], ['Guest', '', 'None (open network)'], 'lower-case prefix, open network');
    w = C.parseWifi('WIFI:T:SAE;S:Home;P:x;R:1;;');
    eq([w.security, w.transitionDisable], ['WPA3', '1'], 'WPA3 SAE with transition-disable');
    w = C.parseWifi('WIFI:T:WPA2-EAP;S:corp;E:PEAP;PH2:MSCHAPV2;I:alice;A:anon;P:pw;;');
    eq([w.security, w.eap, w.phase2, w.identity, w.anonymous], ['WPA2-Enterprise', 'PEAP', 'MSCHAPV2', 'alice', 'anon'], 'enterprise fields');
    w = C.parseWifi('WIFI:S:"0123456789";T:WPA;P:"abc";;');
    eq([w.ssid, w.password], ['0123456789', 'abc'], 'quoted values unquoted');
    w = C.parseWifi('WIFI:S:Café Grün 5G;T:WEP;P:k3y;;');
    eq([w.ssid, w.security], ['Café Grün 5G', 'WEP'], 'non-ASCII SSID, WEP');
    w = C.parseWifi('WIFI:S:NoTerminator;P:last');
    eq([w.ssid, w.password], ['NoTerminator', 'last'], 'missing final ;; still reads');
    eq(C.parseWifi('WIFI:T:WPA;P:x;;'), null, 'no SSID is not a Wi-Fi code');
    let r = P('WIFI:T:WPA;S:Home;P:hunter2;;');
    eq([r.kind, r.title, primary(r).value, field(r, 'Password')], ['wifi', 'Home', 'hunter2', 'hunter2'], 'Wi-Fi result copies the password first');
    r = P('WIFI:T:WEP;S:Old;P:12345;;');
    eq(levels(r), ['caution'], 'WEP is a caution');
    r = P('WIFI:T:nopass;S:Free;;');
    eq([primary(r).value, levels(r)], ['Free', ['info']], 'open network copies the name');
  },

  contact() {
    const v3 = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Gump;Forrest;;Mr.;\r\nFN:Forrest Gump\r\nORG:Bubba Gump Shrimp Co.\r\nTITLE:Shrimp Man\r\n' +
      'TEL;TYPE=WORK,VOICE:(111) 555-1212\r\nTEL;TYPE=HOME,VOICE:(404) 555-1212\r\nADR;TYPE=WORK:;;100 Waters Edge;Baytown;LA;30314;United States of America\r\n' +
      'EMAIL;TYPE=PREF,INTERNET:forrestgump@example.com\r\nNOTE:Line one\\nLine two\\, with comma\r\nEND:VCARD';
    let c = C.parseVcard(v3);
    eq([c.name, c.org, c.title, c.phones.length, c.phones[0].label, c.emails[0].value], ['Forrest Gump', 'Bubba Gump Shrimp Co.', 'Shrimp Man', 2, 'work', 'forrestgump@example.com'], 'vCard 3.0 (Wikipedia example)');
    eq(c.addresses[0].value, '100 Waters Edge\n30314 Baytown, LA\nUnited States of America', 'ADR components');
    eq(c.note, 'Line one\nLine two, with comma', 'escaped newline and comma');
    c = C.parseVcard('BEGIN:VCARD\nVERSION:4.0\nFN:Jane\n  Doe\nTEL;VALUE=uri;TYPE="voice,cell":tel:+1-555-555-5555\nEMAIL:jane@example.com\nEND:VCARD');
    eq([c.name, c.phones[0].value, c.phones[0].label], ['Jane Doe', '+1-555-555-5555', 'cell'], 'vCard 4.0: folding, tel: URI, quoted TYPE list');
    c = C.parseVcard('BEGIN:VCARD\nVERSION:2.1\nN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;J=C3=BCrgen\nTEL;CELL:+49 170 1234567\nEND:VCARD');
    eq([c.name, c.phones[0].label], ['Jürgen Müller', 'cell'], 'vCard 2.1 quoted-printable UTF-8, name built from N');
    c = C.parseVcard('BEGIN:VCARD\nVERSION:2.1\nNOTE;ENCODING=QUOTED-PRINTABLE:first line=0D=0A=\nsecond\nEND:VCARD');
    eq(c.note, 'first line\r\nsecond', 'QP soft line break joins lines');
    c = C.parseMecard('MECARD:N:Doe,John;TEL:13035551212;EMAIL:john.doe@example.com;ADR:76 9th Ave\\, 4th Floor\\, New York;;');
    eq([c.name, c.phones[0].value, c.emails[0].value, c.addresses[0].value], ['John Doe', '13035551212', 'john.doe@example.com', '76 9th Ave, 4th Floor, New York'], 'MECARD (docomo example) with escaped commas');
    let r = P(v3);
    eq([r.kind, r.title, primary(r).kind, primary(r).file.name, primary(r).file.mime], ['contact', 'Forrest Gump', 'download', 'Forrest_Gump.vcf', 'text/vcard'], 'contact result saves a .vcf');
    check(primary(r).file.data.startsWith('BEGIN:VCARD\r\n') && primary(r).file.data.endsWith('END:VCARD\r\n'), 'vCard saved byte-for-byte with CRLF');
    r = P('MECARD:N:Doe,John;TEL:123;NOTE:a\\;b;;');
    const vcf = primary(r).file.data;
    check(/^BEGIN:VCARD\r\nVERSION:3.0\r\nFN:John Doe\r\nN:Doe;John;;;\r\n/.test(vcf) && /NOTE:a\\;b\r\n/.test(vcf), 'MECARD converted to a valid vCard 3.0', vcf);
    eq(C.parseVcard(C.contactToVcf(C.parseMecard('MECARD:N:Smith,Ann;EMAIL:a@b.co;URL:https://x.y;BDAY:19800101;;'))).emails[0].value, 'a@b.co', 'converted vCard reads back');
    r = P('MECARD:N:Smith,Ann;BDAY:19800101;;');
    eq(field(r, 'Birthday'), '1980-01-01', 'birthday formatted');
    r = P('BEGIN:VCARD\nVERSION:3.0\nFN:../../etc/passwd\nEND:VCARD');
    eq(primary(r).file.name, 'etcpasswd.vcf', 'file name stripped of path characters');
  },

  mail() {
    const m = s => JSON.parse(JSON.stringify(C.parseMailto(s)));
    eq(m('mailto:chris@example.com').to, ['chris@example.com'], 'RFC 6068 simple');
    eq(m('mailto:infobot@example.com?subject=current-issue').subject, 'current-issue', 'RFC 6068 subject');
    eq(m('mailto:joe@example.com?cc=bob@example.com&body=hello').cc, ['bob@example.com'], 'RFC 6068 cc');
    eq(m('mailto:%22not%40me%22@example.org').to, ['"not@me"@example.org'], 'RFC 6068 percent-encoded local part');
    eq(m('mailto:?to=addr1@an.example,addr2@an.example').to, ['addr1@an.example', 'addr2@an.example'], 'RFC 6068 to= header');
    eq(m('mailto:user@example.org?subject=caf%C3%A9').subject, 'café', 'RFC 6068 UTF-8 subject');
    eq(m('mailto:a@b.c?body=1+1%3D2').body, '1+1=2', '"+" is literal in mailto');
    eq(m('mailto:a@b.c?SUBJECT=Hi').subject, 'Hi', 'header names are case-insensitive');
    eq(m('MATMSG:TO:x@y.com;SUB:Hello;BODY:Line\\; two;;'), {to: ['x@y.com'], cc: [], bcc: [], subject: 'Hello', body: 'Line; two'}, 'MATMSG');
    eq(m('SMTP:x@y.com:Subj:Body: with colon').body, 'Body: with colon', 'SMTP: form');
    eq(m('jo.smith+qr@example.co.uk').to, ['jo.smith+qr@example.co.uk'], 'bare address');
    eq(C.parseMailto('not an @ address'), null, 'text with @ is not an address');
    let r = P('mailto:a@b.c?subject=Hi there&body=x y');
    eq([r.kind, primary(r).href], ['email', 'mailto:a@b.c?subject=Hi%20there&body=x%20y'], 'compose link is re-encoded');
    r = P('mailto:');
    check(r.kind !== 'email', 'empty mailto is not an email');
  },

  phone() {
    let r = P('tel:+1-201-555-0123');
    eq([r.kind, r.title, primary(r).href], ['phone', '+1-201-555-0123', 'tel:+12015550123'], 'RFC 3966 global number');
    r = P('TEL:+49 (30) 1234-567;ext=89');
    eq([r.title, primary(r).href], ['+49 (30) 1234-567', 'tel:+49301234567'], 'parameters dropped, punctuation removed for dialing');
    r = P('tel:0900123456');
    eq(levels(r), ['caution'], 'premium-rate prefix flagged');
    r = P('tel:abc');
    check(r.kind !== 'phone', 'tel: with no digits is not a phone number');
    r = P('SMSTO:+15551234:Hello: world');
    eq([r.kind, field(r, 'To'), field(r, 'Message')], ['sms', '+15551234', 'Hello: world'], 'SMSTO keeps colons in the message');
    r = P('sms:+15551234?body=Hi%20there');
    eq([r.kind, field(r, 'Message'), primary(r).href], ['sms', 'Hi there', 'sms:+15551234?body=Hi%20there'], 'RFC 5724 sms URI');
    r = P('smsto:5551234');
    eq([r.kind, field(r, 'Message')], ['sms', undefined], 'sms without body');
  },

  geo() {
    const g = s => JSON.parse(JSON.stringify(C.parseGeo(s)));
    eq(g('geo:13.4125,103.8667'), {lat: 13.4125, lon: 103.8667, alt: null, query: ''}, 'RFC 5870 example 1');
    eq(g('geo:48.2010,16.3695,183'), {lat: 48.201, lon: 16.3695, alt: 183, query: ''}, 'RFC 5870 with altitude');
    eq(g('geo:48.198634,16.371648;crs=wgs84;u=40').lat, 48.198634, 'RFC 5870 with parameters');
    eq(g('geo:0,0?q=Null+Island').query, 'Null Island', 'Android q= label');
    eq(g('geo:90.1,0').invalid, true, 'latitude out of range');
    eq(g('geo:0,-180.5').invalid, true, 'longitude out of range');
    eq(g('geo:-90,180').lat, -90, 'boundaries are valid');
    eq(g('geo:abc').invalid, true, 'not numbers');
    let r = P('geo:-33.8568,151.2153');
    eq([r.kind, field(r, 'In words'), primary(r).href], ['geo', '33.8568° S, 151.2153° E', 'https://www.openstreetmap.org/?mlat=-33.8568&mlon=151.2153#map=16/-33.8568/151.2153'], 'southern hemisphere, map link');
    r = P('geo:91,0');
    eq(levels(r), ['caution'], 'invalid geo explained');
  },

  event() {
    const ev = 'BEGIN:VEVENT\nSUMMARY:Team sync\\, weekly\nDTSTART:20261128T150000Z\nDTEND:20261128T160000Z\nLOCATION:Room 4\nEND:VEVENT';
    let e = C.parseEvent(ev);
    eq([e.summary, e.start, e.end, e.location], ['Team sync, weekly', '2026-11-28 15:00 UTC', '2026-11-28 16:00 UTC', 'Room 4'], 'UTC event');
    e = C.parseEvent('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=Europe/Berlin:20260329T020000\nDTEND;VALUE=DATE:20260330\nSUMMARY:DST night\nEND:VEVENT\nEND:VCALENDAR');
    eq([e.start, e.end], ['2026-03-29 02:00 Europe/Berlin', '2026-03-30 (all day)'], 'TZID kept as written, all-day date');
    e = C.parseEvent('BEGIN:VEVENT\nDTSTART:20240229T093000\nEND:VEVENT');
    eq(e.start, '2024-02-29 09:30 local time', 'floating time on a leap day');
    let r = P(ev);
    eq([r.kind, r.title, primary(r).file.name], ['event', 'Team sync, weekly', 'event.ics'], 'event result');
    const ics = primary(r).file.data;
    check(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:') && ics.includes('BEGIN:VEVENT\r\n') && ics.endsWith('END:VCALENDAR\r\n'), 'bare VEVENT wrapped in a VCALENDAR with CRLF', ics);
  },

  otp() {
    let o = C.parseOtp('otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example');
    eq([o.type, o.issuer, o.account, o.secret, o.digits, o.period, o.algorithm, o.secretValid], ['TOTP', 'Example', 'alice@google.com', 'JBSWY3DPEHPK3PXP', '6', '30', 'SHA1', true], 'Google key URI example');
    o = C.parseOtp('otpauth://hotp/ACME%20Co:john.doe%40email.com?secret=jbsw y3dp&counter=7&digits=8&algorithm=sha256');
    eq([o.type, o.issuer, o.account, o.secret, o.counter, o.digits, o.algorithm], ['HOTP', 'ACME Co', 'john.doe@email.com', 'JBSWY3DP', '7', '8', 'SHA256'], 'HOTP, encoded label, lower-case secret with space');
    o = C.parseOtp('otpauth://totp/x?secret=0189');
    eq(o.secretValid, false, '0, 1, 8, 9 are not Base32');
    let r = P('otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example');
    eq([r.kind, r.title, levels(r)], ['otp', 'Example', ['caution']], 'OTP result warns');
    check(r.fields.find(f => f.label === 'Secret key').secret === true, 'secret field marked secret');
  },

  pay() {
    // ECBS / national examples (valid) and corruptions (invalid); cross-checked with BigInt MOD 97
    const ok = ['GB82 WEST 1234 5698 7654 32', 'DE89 3704 0044 0532 0130 00', 'CH93 0076 2011 6238 5295 7', 'NL91ABNA0417164300',
      'FR1420041010050500013M02606', 'BE68539007547034', 'AT611904300234573201', 'NO9386011117947', 'MT84MALT011000012345MTLCAST001S'];
    const big = s => { s = s.replace(/\s/g, ''); const m = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55); return BigInt(m) % 97n === 1n; };
    for (const i of ok) { eq(C.ibanCheck(i).valid, true, `valid IBAN ${i}`); check(big(i), `BigInt agrees on ${i}`); }
    eq(C.ibanCheck('DE89370400440532013001').valid, false, 'one digit changed');
    eq(C.ibanCheck('DE98370400440532013000').valid, false, 'check digits swapped');
    check(/22 characters/.test(C.ibanCheck('DE8937040044053201300').reason), 'wrong length names the expected length');
    eq(C.ibanCheck('hello').valid, false, 'not an IBAN');
    eq(C.ibanCheck('de89 3704 0044 0532 0130 00').valid, true, 'lower case accepted');
    for (let n = 0; n < 200; n++) { // random strings: the core and BigInt agree
      const body = Array.from({length: 18}, () => Math.floor(Math.random() * 10)).join('');
      const s = 'DE' + String(Math.floor(Math.random() * 100)).padStart(2, '0') + body;
      if (C.ibanCheck(s).valid !== big(s)) { check(false, `random IBAN ${s}`); break; }
    }
    passes++;

    const epc = 'BCD\n002\n1\nSCT\nBHBLDEHHXXX\nFranz Mustermänn\nDE71110220330123456789\nEUR12.3\nGDDS\nRF18539007547034\n\n';
    let e = C.parseEpc(epc);
    eq([e.name, e.bic, e.amount, e.currency, e.purpose, e.reference, e.problems], ['Franz Mustermänn', 'BHBLDEHHXXX', '12.3', 'EUR', 'GDDS', 'RF18539007547034', []], 'EPC069-12 example');
    eq(e.iban.valid, big('DE71110220330123456789'), 'EPC IBAN verdict matches BigInt');
    let r = P(epc);
    eq([r.kind, r.title, field(r, 'Amount'), field(r, 'IBAN')], ['payment', 'EUR 12.30', 'EUR 12.30', 'DE71 1102 2033 0123 4567 89'], 'EPC result: amount with two decimals, IBAN grouped');
    r = P('BCD\r\n001\r\n1\r\nSCT\r\n\r\nRed Cross\r\nDE89370400440532013000\r\nEUR1234567.5\r\n');
    eq([r.title, levels(r)], ['EUR 1,234,567.50', ['ok', 'caution']], 'CRLF, thousands separators, v001 without BIC is a caution');
    r = P('BCD\n002\n1\nSCT\n\nX\nDE89370400440532013001\nEUR12,50\n');
    eq(levels(r), ['danger', 'caution'], 'bad IBAN is danger; decimal comma is not EPC format');
    r = P('BCD\n002\n1\nSCT\n\nOpen amount\nDE89370400440532013000\n\n');
    eq([r.title, field(r, 'Amount')], ['Amount not set', 'Not set (you choose)'], 'no amount');
    eq(C.parseEpc('BCD\n003\n1\nSCT'), null, 'unknown EPC version is text');
    const spc = ['SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Robert Schneider AG', 'Rue du Lac', '1268', '2501', 'Biel', 'CH',
      '', '', '', '', '', '', '', '1949.75', 'CHF', 'S', 'Pia-Maria Rutschmann-Schnyder', 'Grosse Marktgasse', '28', '9400', 'Rorschach', 'CH',
      'QRR', '210000000003139471430009017', 'Order of 15 June 2020', 'EPD'].join('\n');
    r = P(spc);
    eq([r.label, r.title, field(r, 'Pay to'), field(r, 'Reference'), levels(r)], ['Swiss QR-bill', 'CHF 1,949.75', 'Robert Schneider AG', '210000000003139471430009017', ['ok']], 'Swiss QR-bill (SIX example)');
    r = P('bitcoin:175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W?amount=50&label=Luke-Jr');
    eq([r.kind, r.title, field(r, 'Label')], ['payment', '50 BTC', 'Luke-Jr'], 'BIP 21 example');
  },

  text() {
    let r = P('');
    eq([r.kind, r.label], ['empty', 'Empty'], 'empty');
    r = P('   \n\t');
    eq([r.kind, r.label], ['empty', 'Blank'], 'only whitespace');
    check(/5 blank characters/.test(r.warnings[0].text), 'blank count stated');
    r = P('Grüße 👋 日本');
    eq([r.kind, r.title, primary(r).value], ['text', 'Grüße 👋 日本', 'Grüße 👋 日本'], 'non-ASCII text kept exactly');
    r = P('  indented\nlines  ');
    eq(primary(r).value, '  indented\nlines  ', 'copy keeps the exact text, whitespace included');
    const huge = 'x'.repeat(200000) + ' https://a.b';
    const t0 = Date.now(); r = P(huge);
    check(r.kind === 'text' && Date.now() - t0 < 500, 'a 200 000 character payload parses fast as text');
    r = P('4006381333931', {format: 'EAN13'});
    eq([r.kind, r.label, r.fields[0].label], ['product', 'Product number', 'EAN-13'], 'EAN-13 product number');
    r = P('9780306406157', {format: 'EAN13'});
    eq(r.label, 'Book (ISBN)', '978 prefix is a book');
    r = P('4006381333931');
    eq(r.kind, 'text', 'digits from a QR code are just text');
    r = P('MEBKM:TITLE:My site;URL:https\\://example.com/p;;');
    eq([r.kind, r.label, field(r, 'Title'), primary(r).href], ['url', 'Bookmark', 'My site', 'https://example.com/p'], 'docomo bookmark is a link');
    r = P('MEBKM:TITLE:nothing;;');
    eq(r.kind, 'uri', 'bookmark without URL is not a link');
  },

  history() {
    let h = [];
    h = C.historyAdd(h, {text: 'a', format: 'QRCode', timestamp: '2026-01-01T00:00:00.000Z', source: 'camera'});
    h = C.historyAdd(h, {text: 'b', timestamp: '2026-01-02T00:00:00.000Z'});
    h = C.historyAdd(h, {text: 'a', timestamp: '2026-01-03T00:00:00.000Z', source: 'paste'});
    eq(h.map(e => e.text + ':' + e.source), ['a:paste', 'b:image'], 'newest first, a repeat moves to the top');
    h = C.historyAdd(h, {text: 'otpauth://totp/x?secret=ABC', timestamp: 'x'});
    eq(h.length, 2, '2FA secrets are never stored');
    for (let i = 0; i < 80; i++) h = C.historyAdd(h, {text: 'n' + i});
    eq([h.length, h[0].text], [C.HISTORY_MAX, 'n79'], 'history is capped at 50, like the old page');
    // The old page's exact shape under the same key
    const old = JSON.stringify([{text: 'https://example.com/a?b=1', timestamp: '2026-11-28T13:07:27.821Z'}, {text: ' '}]);
    eq(JSON.parse(JSON.stringify(C.historyLoad(old))), [
      {text: 'https://example.com/a?b=1', timestamp: '2026-11-28T13:07:27.821Z', format: 'QRCode', source: 'image'},
      {text: ' ', timestamp: null, format: 'QRCode', source: 'image'}], 'old {text, timestamp} entries load unchanged');
    eq(JSON.parse(JSON.stringify(C.historyLoad('{bad'))), [], 'corrupt JSON loads as empty instead of breaking the page');
    eq(JSON.parse(JSON.stringify(C.historyLoad('[{"text":5},null,"plain",{"text":"ok","timestamp":1700000000000,"source":"evil"}]'))), [
      {text: 'plain', timestamp: null, format: 'QRCode', source: 'image'},
      {text: 'ok', timestamp: '2023-11-14T22:13:20.000Z', format: 'QRCode', source: 'image'}], 'wrong types dropped or normalised');
    eq(JSON.parse(JSON.stringify(C.historyLoad(null))), [], 'missing key');
  },

  summary() {
    const sm = (t, f) => JSON.parse(JSON.stringify(C.summary(t, f)));
    eq(sm('WIFI:T:WPA;S:Home;P:hunter2;;'), {label: 'Wi-Fi network', line: 'Home', danger: false}, 'Wi-Fi: name only, never the password');
    check(!JSON.stringify(sm('BCD\n002\n1\nSCT\n\nBistro\nDE89370400440532013000\nEUR23.8\n')).includes('DE89'), 'payment: no account number');
    eq(sm('BCD\n002\n1\nSCT\n\nBistro\nDE89370400440532013000\nEUR23.8\n').line, 'Bistro · EUR 23.80', 'payment: payee and amount');
    eq(sm('https://paypal.com@evil.example/x'), {label: 'Likely fake link', line: 'evil.example/x', danger: true}, 'fake link keeps its verdict in history');
    eq(sm('BEGIN:VCARD\nFN:Ann Lee\nTEL:123\nEND:VCARD').line, 'Ann Lee', 'contact: name');
    eq(sm('a\n\n  b').line, 'a b', 'text collapsed to one line');
    eq([...sm('y'.repeat(500)).line].length, 120, 'long text cut to 120 characters');
    eq(sm('   ').line, '(blank)', 'blank');
  },

  util() {
    eq(C.hexDump(new Uint8Array([0x48, 0x69, 0x00, 0xff])), '0000  ' + '48 69 00 ff'.padEnd(47) + '  Hi..', 'hex dump row');
    eq(C.hexDump(new Uint8Array(40), 16).split('\n').pop(), '… 24 more bytes', 'hex dump truncates');
    eq(C.revealInvisible('pay​pal'), 'pay⟨U+200B⟩pal', 'zero-width space revealed');
    eq(C.hasInvisible('a‮b'), true, 'RTL override detected');
    eq(C.describeSymbol({format: 'QRCode', version: '3', ecLevel: 'M', isInverted: true, sequenceSize: -1}), 'QR code · version 3 · error correction M · inverted colours', 'symbol description');
    eq(C.describeSymbol({format: 'EAN13', version: '', ecLevel: ''}), 'EAN13', 'barcode description');
    eq(C.describeSymbol({format: 'QRCode', sequenceSize: 3, sequenceIndex: 0}), 'QR code · part 1 of 3', 'structured append');
    const flagged = t => C.spellOut(t).filter(c => c.name).map(c => c.ch).join('');
    eq(flagged('Tr0ut;lIl1nes0O'), '0lIl10O', 'zero, O, one, small L, capital i flagged');
    eq(flagged('espresso2go'), '', 'o and 2 alone are not confusable');
    eq(flagged('So5'), 'S5', 'S and 5 together are');
    eq(flagged('a b'), ' ', 'spaces are always pointed out');
    eq(C.fmtMoney('5', 'EUR'), 'EUR 5.00', 'whole amount');
    eq(C.fmtCoord(0, 0), '0° N, 0° E', 'zero coordinates');
  },

  async decode() {
    const req = createRequire(join(ROOT, 'package.json'));
    let ZX, QR;
    try { ZX = await import(req.resolve('zxing-wasm/reader')); QR = req('qrcode'); }
    catch (e) { skipped++; console.log('  SKIP  decode: npm i --no-save zxing-wasm@3.1.6 qrcode@1.5.4'); return; }
    const zdir = join(ROOT, 'node_modules', 'zxing-wasm');
    const ver = JSON.parse(readFileSync(join(zdir, 'package.json'), 'utf8')).version;
    const pageVer = (html.match(/zxing-wasm@([\d.]+)/) || [])[1];
    eq(ver, pageVer, 'installed zxing-wasm is the version the page loads');
    ZX.prepareZXingModule({overrides: {wasmBinary: readFileSync(join(zdir, 'dist/reader/zxing_reader.wasm'))}});
    const OPTS = JSON.parse(html.match(/const READER_OPTIONS = (\{[^;]*\});/)[1]);
    // Draw codes onto an RGBA canvas: list of {text, x, y, scale, invert}
    function image(W, H, codes, bg = 255) {
      const data = new Uint8ClampedArray(W * H * 4).fill(bg);
      for (let i = 3; i < data.length; i += 4) data[i] = 255;
      for (const c of codes) {
        const m = QR.create(c.text, {errorCorrectionLevel: c.ec || 'M'}).modules, n = m.size, q = 4;
        for (let y = -q; y < n + q; y++) for (let x = -q; x < n + q; x++) {
          const dark = x >= 0 && y >= 0 && x < n && y < n && m.get(y, x);
          const v = (dark ? 0 : 255) ^ (c.invert ? 255 : 0);
          for (let dy = 0; dy < c.scale; dy++) for (let dx = 0; dx < c.scale; dx++) {
            const px = c.x + (x + q) * c.scale + dx, py = c.y + (y + q) * c.scale + dy;
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const i = (py * W + px) * 4; data[i] = data[i + 1] = data[i + 2] = v;
          }
        }
      }
      return {data, width: W, height: H, colorSpace: 'srgb'};
    }
    const read = img => ZX.readBarcodes(img, OPTS);
    const cases = ['https://example.com/a?b=1', 'Grüße 👋 日本', 'WIFI:T:WPA;S:My Net;P:pa\\;ss;;', ' ', 'x'.repeat(1500),
      'BCD\n002\n1\nSCT\n\nRed Cross\nDE89370400440532013000\nEUR12.5\n'];
    for (const t of cases) {
      const r = await read(image(640, 640, [{text: t, x: 10, y: 10, scale: t.length > 500 ? 4 : 5}]));
      eq(r.length && r[0].text, t, `round trip ${JSON.stringify(t).slice(0, 40)}`);
    }
    let r = await read(image(300, 300, [{text: 'inverted', x: 20, y: 20, scale: 6, invert: true}], 0));
    eq([r[0] && r[0].text, r[0] && r[0].isInverted], ['inverted', true], 'white-on-black code read and reported inverted');
    r = await read(image(700, 300, [{text: 'left', x: 10, y: 10, scale: 6}, {text: 'right', x: 380, y: 10, scale: 6}]));
    eq(r.map(x => x.text).sort(), ['left', 'right'], 'two codes in one image');
    r = await read(image(300, 300, []));
    eq(r.length, 0, 'blank image finds nothing');
    r = await read(image(400, 400, [{text: 'https://example.com/', x: 10, y: 10, scale: 6}]));
    const p = P(r[0].text, {format: r[0].format});
    eq([p.kind, C.describeSymbol(r[0])], ['url', 'QR code · version 2 · error correction M'], 'decoded symbol described');
  },
};

for (const s of suites) {
  if (!T[s]) { console.log(`unknown suite ${s}`); failures++; continue; }
  section(s);
  try { await T[s](); } catch (e) { failures++; console.log(`  FAIL  ${s} threw: ${e.stack}`); }
}
console.log(`\n${passes} passed, ${failures} failed${skipped ? `, ${skipped} skipped` : ''}`);
process.exit(failures ? 1 : 0);
