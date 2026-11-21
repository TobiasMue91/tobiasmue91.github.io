#!/usr/bin/env node
// Test suite for tools/invoice_generator.html (Invoice Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises a total a person can send to a
// client without checking it on a calculator, so the expected figures here are worked out by hand from the rules
// the page states next to its result: amounts in exact decimal (BigInt minor units, never floats), each line
// rounded to the currency's minor unit, a discount taken before tax and shared over the tax rates so the parts add
// up, tax rounded once per rate, halves away from zero (commercial rounding), and tax-inclusive prices split as
// gross x r / (100 + r). Currency decimals come from ISO 4217 (JPY 0, KWD 3). IBANs are checked against ISO 13616
// mod-97 with the published examples, and the payment QR text against EPC069-12 v2. Also: what people type
// (decimal commas, symbols, codes, units, brackets), the inputs that break tools, the page layout (pagination,
// wrapping, nothing off the paper, no total while a field is wrong), and the old page's localStorage read back.
//
//   node test/invoice_generator.mjs                # everything
//   node test/invoice_generator.mjs parse money    # named suites only
//
// Suites: parse, money, tax, old, dates, numbers, iban, saves, layout.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'invoice_generator.html');
const ALL = ['parse', 'money', 'tax', 'old', 'dates', 'numbers', 'iban', 'saves', 'layout'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const js = v => JSON.stringify(v, (k, x) => typeof x === 'bigint' ? x.toString() + 'n' : x);
const eq = (got, want, what) => check(js(got) === js(want), what, `got ${js(got)}, want ${js(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Intl, Date, JSON, BigInt, Math, String, Number, Object, Array, RegExp, Error};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

// a number as typed -> its value as a plain decimal string, or 'error' / 'empty'
const P = (s, dec = '.') => { const r = C.parseNumber(s, dec); if (r.empty) return 'empty'; if (r.error) return 'error'; const v = r.value, neg = v < 0n, a = (neg ? -v : v).toString().padStart(7, '0'); const ip = a.slice(0, -6), fp = a.slice(-6).replace(/0+$/, ''); return (neg ? '-' : '') + ip + (fp ? '.' + fp : ''); };
const inv = (o) => Object.assign(C.blank('2026-11-21'), o);
const item = (qty, price, tax = '', desc = 'x') => ({desc, qty: String(qty), price: String(price), tax});
const run = o => C.compute(inv(o));
const usd = v => C.formatMoney(v, 'USD', 'en-US');

if (suites.includes('parse')) {
  section('parse');
  const cases = [
    ['12.50', '12.5'], ['12,50', '12.5'], ['  12.50  ', '12.5'], ['1,234.50', '1234.5'], ['1.234,50', '1234.5'],
    ['1,234', '1234'], ['1 234,50', '1234.5'], ['1 234,50', '1234.5'], ['1 234,50', '1234.5'], ["1'234.50", '1234.5'], ['CHF 1’234.50', '1234.5'],
    ['1,234,567.89', '1234567.89'], ['1.234.567,89', '1234567.89'], ['1.234.567', '1234567'],
    ['$12.50', '12.5'], ['€ 12,50', '12.5'], ['12,50 €', '12.5'], ['12.50 EUR', '12.5'], ['12.50eur', '12.5'], ['US$ 5', '5'], ['R$ 1.234,56', '1234.56'],
    ['1 234,50 zł', '1234.5'], ['1.234,56 kr', '1234.56'], ['19%', '19'], ['19 %', '19'], ['7,7', '7.7'], ['3 h', '3'], ['3hrs', '3'], ['2 pcs', '2'],
    ['-3', '-3'], ['−3', '-3'], ['(5)', '-5'], ['5-', '-5'], ['-$5', '-5'], ['$-5', '-5'], ['+5', '5'],
    ['.5', '0.5'], ['5.', '5'], ['0,5', '0.5'], ['0', '0'], ['-0', '0'], ['0.000001', '0.000001'], ['１２３', '123'],
    ['1e3', '1000'], ['2.5E2', '250'], ['9999999999999', '9999999999999'], ['12345678901.23', '12345678901.23'],
    ['', 'empty'], ['   ', 'empty'], ['abc', 'error'], ['45o', 'error'], ['12 apples', 'error'], ['--5', 'error'], ['1.2.3', 'error'],
    ['0x10', 'error'], ['1/2', 'error'], ['1,23,456', 'error'], ['12.34.56,7', 'error'], ['10000000000000', 'error'], ['0.0000001', 'error'], ['1e99', 'error'],
  ];
  for (const [s, want] of cases) eq(P(s), want, `"${s}" -> ${want}`);
  // the lone separator with three digits follows the invoice's locale; any other count is a decimal point
  eq(P('1,234', ','), '1.234', 'German invoice: 1,234 is one point two three four');
  eq(P('1.234', ','), '1234', 'German invoice: 1.234 is a thousand two hundred');
  eq(P('1.234', '.'), '1.234', 'English invoice: 1.234 is a decimal');
  eq(P('0,125', '.'), '0.125', '0,125 is never a thousands group');
  eq(P('12,5', '.'), '12.5', 'two digits after a comma are decimals anywhere');
  check(C.parseNumber('abc').error.length > 10, 'errors say what would be accepted');
  eq(['45o', '4S', 'l00', '1o.5', '12,5O', 'abc', 'o'].map(x => C.parseNumber(x).suggest || ''), ['450', '45', '100', '10.5', '12,50', '', ''], 'a letter typed for a digit gets a suggested fix');
}

if (suites.includes('money')) {
  section('money');
  eq(C.rescale(1005n, 3, 2), 101n, '1.005 rounds up to 1.01 (no float error)');
  eq(C.rescale(-1005n, 3, 2), -101n, 'halves away from zero for negatives');
  eq(C.rescale(1004n, 3, 2), 100n, '1.004 rounds down');
  eq(C.rescale(-1004n, 3, 2), -100n, '-1.004 rounds toward zero');
  eq(C.rescale(5n, 0, 2), 500n, 'scaling up is exact');
  eq(C.minorDigits('USD'), 2, 'USD has 2 decimals'); eq(C.minorDigits('JPY'), 0, 'JPY has 0'); eq(C.minorDigits('KWD'), 3, 'KWD has 3'); eq(C.minorDigits('BHD'), 3, 'BHD has 3');
  eq(usd(123456n), '$1,234.56', 'USD format'); eq(usd(-1000n), '\u2212$10.00', 'negative USD with a true minus sign');
  eq(C.formatMoney(123456n, 'EUR', 'de-DE'), '1.234,56 €', 'EUR in German');
  eq(C.formatMoney(123456n, 'EUR', 'fr-FR'), '1 234,56 €', 'EUR in French');
  eq(C.formatMoney(12345678n, 'INR', 'en-IN'), '₹1,23,456.78', 'Indian lakh grouping');
  eq(C.formatMoney(1000n, 'JPY', 'en-US'), '¥1,000', 'JPY has no decimals');
  eq(C.formatMoney(1234567n, 'KWD', 'en-US'), 'KWD 1,234.567', 'KWD three decimals');
  eq(C.formatMoney(100000000000000n, 'USD', 'en-US'), '$1,000,000,000,000.00', '1e12 dollars exact');
  eq(C.formatMoney(1234567890123n, 'USD', 'en-US'), '$12,345,678,901.23', '12,345,678,901.23 exact (the old page printed .20)');
  eq(C.formatMoney(100n, 'GEL', 'en-US', ch => ch !== '₾'), 'GEL 1.00', 'a symbol the PDF font lacks falls back to the ISO code');
  eq(C.formatUnit(12500n, 'USD', 'en-US'), '$0.0125', 'a unit price keeps its extra decimals');
  eq(C.formatUnit(12500000n, 'USD', 'en-US'), '$12.50', 'a plain unit price shows the currency decimals');
  // line amounts
  const L = (q, p, cur = 'USD') => C.compute(inv({currency: cur, items: [item(q, p)]})).lines[0].amount;
  eq(L('1.5', '33.33'), 5000n, '1.5 x 33.33 = 49.995 -> 50.00');
  eq(L('3', '1.005'), 302n, '3 x 1.005 = 3.015 -> 3.02');
  eq(L('0.1', '0.2'), 2n, '0.1 x 0.2 = 0.02');
  eq(L('3', '333.333', 'JPY'), 1000n, '3 x 333.333 yen = 999.999 -> ¥1,000');
  eq(L('2', '0.0125'), 3n, '2 x 0.0125 = 0.025 -> 0.03');
  eq(L('-2', '10'), -2000n, 'negative quantity is a credit line');
  eq(L('1', '-10'), -1000n, 'negative price is a credit line');
  eq(L('0', '99'), 0n, 'quantity 0 is zero');
  eq(L('', '25'), 2500n, 'empty quantity means one');
  eq(L('1', '9999999999999'), 999999999999900n, 'largest accepted price stays exact');
  // sums: 0.1 + 0.2 is 0.30
  eq(run({items: [item(1, '0.1'), item(1, '0.2')]}).total, 30n, '0.1 + 0.2 = 0.30');
  eq(run({items: [item(1, '45o')]}).errors['items.0.price'] !== undefined, true, 'a typo in a price is an error on that field');
  eq(run({items: [item(1, '45o')]}).ok, false, 'and the invoice is not ok');
  eq(run({items: [item('x', '5')]}).errors['items.0.qty'] !== undefined, true, 'a typo in a quantity is an error');
  eq(run({items: [{desc: '', qty: '1', price: '', tax: ''}]}).anyItem, false, 'an untouched row is not an item');
  eq(run({items: [{desc: 'Free consultation', qty: '1', price: '', tax: ''}]}).anyItem, true, 'a described row without a price is an item at 0');
}

if (suites.includes('tax')) {
  section('tax');
  // the example on the page: 1 x 2400, 6 x 450, 3.5 x 95, 5% discount, VAT 20%
  let r = run({items: [item(1, 2400), item(6, 450), item(3.5, 95)], discount: '5', taxRate: '20'});
  eq([r.subtotal, r.discount, r.taxes[0].base, r.taxes[0].tax, r.total], [543250n, 27163n, 516087n, 103217n, 619304n], 'example: 5432.50 - 271.63 = 5160.87, VAT 1032.17, total 6193.04');
  // identity: base + tax + shipping = total, for every invoice
  r = run({items: [item(3, '19.99'), item(2, '7.45')], discount: '12.5', taxRate: '7.7', shipping: '4.95'});
  eq(r.net + r.taxTotal + r.shipping, r.total, 'net + tax + shipping = total');
  eq(r.subtotal - r.discount, r.net, 'subtotal - discount = net (tax exclusive)');
  // fixed discount
  r = run({items: [item(1, 100)], discount: '15', discountType: 'amount', taxRate: '10'});
  eq([r.discount, r.taxTotal, r.total], [1500n, 850n, 9350n], 'fixed 15 off 100, 10% tax -> 93.50');
  r = run({items: [item(1, 50)], discount: '80', discountType: 'amount'});
  check(!!r.errors.discount && r.total === 5000n, 'a fixed discount above the subtotal is an error, not silently capped', js(r.errors));
  check(/50\.00/.test(r.errors.discount), 'and the error names the subtotal');
  check(!!run({items: [item(1, 40)], discount: '150'}).errors.discount, '150 % is an error');
  check(!!run({items: [item(1, 40)], discount: '-5'}).errors.discount, 'negative discount is an error');
  check(!!run({items: [item(1, 40)], shipping: '-3'}).errors.shipping, 'negative shipping is an error');
  check(!!run({items: [item(1, 40)], taxRate: '-10'}).errors.taxRate, 'negative tax rate is an error');
  check(!!run({items: [item(1, 40)], taxRate: '120'}).errors.taxRate, 'tax above 100 % is an error');
  check(!!run({items: [item(1, 40)], paid: '-1'}).errors.paid, 'negative paid is an error');
  eq(run({items: [item(1, 40)], discount: '100'}).total, 0n, '100 % discount is zero');
  // credit note: negative subtotal stays negative (the old page showed 0)
  r = run({items: [item(1, -10)]}); eq([r.subtotal, r.total], [-1000n, -1000n], 'credit -10 totals -10.00');
  r = run({items: [item(1, -100)], taxRate: '20'}); eq([r.taxTotal, r.total], [-2000n, -12000n], 'credit with tax: -100, tax -20, total -120');
  // tax inclusive: 119 gross at 19 % has 19.00 tax
  r = run({items: [item(1, 119)], taxRate: '19', inclusive: true});
  eq([r.net, r.taxTotal, r.total], [10000n, 1900n, 11900n], '119 incl. 19 % -> net 100, tax 19, total 119');
  r = run({items: [item(1, '10')], taxRate: '20', inclusive: true});
  eq([r.net, r.taxTotal, r.total], [833n, 167n, 1000n], '10.00 incl. 20 % -> 1.666.. tax -> 1.67, net 8.33');
  r = run({items: [item(3, '9.99')], taxRate: '7.7', inclusive: true, discount: '10'});
  eq(r.total, r.subtotal - r.discount, 'inclusive: the total is what the lines say, less the discount');
  // several rates, a discount shared out so the bases add up to the discounted subtotal
  r = run({perLineTax: true, taxRate: '19', items: [item(1, 100), item(1, 50, '7'), item(1, 25, '0')], discount: '10'});
  eq(r.taxes.map(t => [t.rate, t.base, t.tax]), [[19000000n, 9000n, 1710n], [7000000n, 4500n, 315n], [0n, 2250n, 0n]], 'per-line 19 / 7 / 0 with 10 % off: bases 90, 45, 22.50');
  eq(r.taxes.reduce((a, t) => a + t.base, 0n), r.subtotal - r.discount, 'rate bases add up to the discounted subtotal');
  eq(r.total, 15750n + 1710n + 315n, 'total 157.50 + 17.10 + 3.15');
  // a fixed discount that does not divide evenly: the cents still add up
  r = run({perLineTax: true, taxRate: '20', items: [item(1, 10), item(1, 10, '10'), item(1, 10, '5')], discount: '1', discountType: 'amount'});
  eq(r.taxes.reduce((a, t) => a + t.base, 0n), 2900n, '1.00 off three equal groups: 0.34 + 0.33 + 0.33');
  eq(C.allocate(100n, [1n, 1n, 1n]).reduce((a, b) => a + b, 0n), 100n, 'allocate keeps every cent');
  eq(C.allocate(-7n, [3n, 3n]), [-4n, -3n], 'allocate negative');
  eq(C.allocate(5n, [0n, 0n]), [5n, 0n], 'allocate over zero weights');
  // a line's own rate is ignored unless per-line tax is on
  eq(run({taxRate: '10', items: [item(1, 100, '50')]}).taxTotal, 1000n, 'line rate ignored while per-line tax is off');
  eq(run({perLineTax: true, taxRate: '10', items: [item(1, 100, '')]}).taxTotal, 1000n, 'an empty line rate uses the invoice rate');
  check(!!run({perLineTax: true, items: [item(1, 100, 'abc')]}).errors['items.0.tax'], 'a bad line rate is an error on that line');
  // zero rate prints no tax row; mixed with others it does
  eq(run({items: [item(1, 100)]}).taxes.length, 0, 'no tax rate, no tax row');
  // JPY and KWD
  r = run({currency: 'JPY', items: [item(3, '333.333')], taxRate: '8'}); eq([r.subtotal, r.taxTotal, r.total], [1000n, 80n, 1080n], 'JPY 1,000 + 8 % = ¥1,080');
  r = run({currency: 'KWD', items: [item(1, '1.2345')], taxRate: '5'}); eq([r.subtotal, r.taxTotal, r.total], [1235n, 62n, 1297n], 'KWD rounds to 3 decimals: 1.235 + 0.062');
  // paid and balance
  r = run({items: [item(1, 100)], paid: '40'}); eq([r.total, r.paid, r.balance], [10000n, 4000n, 6000n], 'paid 40 of 100 leaves 60');
  r = run({items: [item(1, 100)], paid: '150'}); eq(r.balance, -5000n, 'overpaid shows a negative balance');
  // shipping after tax, untaxed
  r = run({items: [item(1, 100)], taxRate: '10', shipping: '5'}); eq([r.taxTotal, r.total], [1000n, 11500n], 'shipping is added after tax');
  // decimal comma throughout, German invoice
  r = run({locale: 'de-DE', currency: 'EUR', items: [item('1,5', '1.234,50')], taxRate: '19', discount: '2,5'});
  eq([r.subtotal, r.discount, r.taxTotal, r.total], [185175n, 4629n, 34304n, 214850n], 'German input: 1,5 x 1.234,50 = 1.851,75 - 2,5 % (46,29) = 1.805,46 + 19 % (343,04) -> 2.148,50');
  // huge invoice
  r = run({items: Array.from({length: 1000}, (_, i) => item(1, '0.01'))}); eq(r.total, 1000n, '1000 lines of 0.01 = 10.00');
  r = run({items: [item(1, '1000000000000')], taxRate: '7.7'}); eq(r.total, 107700000000000n, '1e12 + 7.7 % exact');
}

if (suites.includes('old')) {
  section('old');
  // the inventory's sample inputs, run through the old page in Chromium; where the old figure was wrong the new one is
  const T = o => { const r = run(o); return r.ok ? usd(r.total) : 'error'; };
  eq(T({items: [item(1, 0)]}), '$0.00', '#1 one empty item');
  eq(T({items: [item(0, 10)]}), '$0.00', '#2 qty 0');
  eq(T({items: [item(1, -10)]}), '\u2212$10.00', '#3 a credit of -10 totals -10 (old: $0.00, a bug)');
  eq(T({items: [item(1, 100), item(1, -30)], taxRate: '10'}), '$77.00', '#3b 100 - 30 + 10 %');
  eq(T({items: [item(1, '12,50')]}), '$12.50', '#4 "12,50" is 12.50 (old: 0 or 1,250)');
  eq(T({items: [item(1, '1000000000000')], taxRate: '7.7'}), '$1,077,000,000,000.00', '#5 1e12 + 7.7 %');
  eq(T({items: [item(1, '12345678901.23')]}), '$12,345,678,901.23', '#5b no lost cents (old: .20)');
  eq(T({items: [item('1.5', '33.33')], taxRate: '7.7'}), '$53.85', '#6 1.5 x 33.33 + 7.7 %');
  eq(T({items: [item(1, 50)], discount: '80', discountType: 'amount', taxRate: '10', shipping: '5'}), 'error', '#7 80 off 50 is an error (old: capped silently, $5.00)');
  eq(T({items: [item(3, '19.99')], discount: '15', taxRate: '7.7'}), '$54.89', '#7b 3 x 19.99, 15 % off, 7.7 %');
  eq(T({items: [item(1, 40)], discount: '150'}), 'error', '#7c 150 % is an error (old: $0.00)');
  eq(C.formatMoney(run({currency: 'EUR', items: [item(2, '9.995')]}).total, 'EUR', 'en-US'), '€19.99', '#8 2 x 9.995 EUR = 19.99');
  eq(C.formatMoney(run({currency: 'JPY', items: [item(3, '333.333')], taxRate: '8'}).total, 'JPY', 'en-US'), '¥1,080', '#9 JPY');
  eq(T({items: [item(1, 100)], discount: '-5', shipping: '-3', taxRate: '-10'}), 'error', '#10 negative discount, shipping, tax are errors (old: $91.50 with the rows hidden)');
  eq(T({items: [item(1, '0.1'), item(1, '0.2'), item(3, '1.005')], taxRate: '5'}), '$3.49', '#11 0.1 + 0.2 + 3 x 1.005 + 5 %');
  eq(T({items: Array.from({length: 60}, () => item(1, '1.01')), taxRate: '7.7'}), '$65.27', '#12 60 rows of 1.01 + 7.7 %');
}

if (suites.includes('dates')) {
  section('dates');
  eq(C.addDays('2026-11-21', 14), '2026-12-05', 'net 14');
  eq(C.addDays('2028-02-15', 14), '2028-02-29', 'into a leap day');
  eq(C.addDays('2027-02-15', 14), '2027-03-01', 'no leap day in 2027');
  eq(C.addDays('2026-03-01', 30), '2026-03-31', 'across the spring DST change (old page: 03-30)');
  eq(C.addDays('2026-10-15', 30), '2026-11-14', 'across the autumn DST change');
  eq(C.addDays('2026-12-15', 30), '2027-01-14', 'across new year');
  eq(run({issued: '2026-01-31', terms: 'net30'}).due, '2026-03-02', 'Jan 31 + 30');
  eq(run({issued: '2026-11-21', terms: 'receipt'}).due, '2026-11-21', 'due on receipt is the issue date');
  eq(run({issued: '2026-11-21', terms: 'custom', due: '2026-12-24'}).due, '2026-12-24', 'custom due date');
  check(!!run({issued: '2026-11-21', terms: 'custom', due: '2026-11-01'}).errors.due, 'a due date before the issue date is an error');
  check(!!run({issued: '2026-02-30'}).errors.issued, 'Feb 30 is not a date');
  check(!!run({issued: ''}).errors.issued, 'an empty issue date is an error');
  eq(C.validIso('2028-02-29'), true, 'leap day valid'); eq(C.validIso('2027-02-29'), false, 'no leap day in 2027'); eq(C.validIso('2026-13-01'), false, 'month 13');
  eq(C.formatDate('2026-03-01', 'en-US'), 'Mar 1, 2026', 'dates print the day they say in every time zone (old page: Feb 28 west of UTC)');
  eq(C.formatDate('2026-03-01', 'de-DE'), '1. März 2026', 'German date');
  eq(C.formatDate('2026-03-01', 'en-GB'), '1 Mar 2026', 'British date');
  eq(C.isoToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05', 'today is the local date, not UTC');
}

if (suites.includes('numbers')) {
  section('numbers');
  const N = [['INV-0042', 'INV-0043'], ['INV-0099', 'INV-0100'], ['2026-009', '2026-010'], ['A99', 'A100'], ['7', '8'], ['INV-0042-B', 'INV-0043-B'],
    ['Rechnung', 'Rechnung-2'], ['', '1'], ['  INV-9  ', 'INV-10'], ['99999999999999999999', '100000000000000000000'], ['INV-2511-007', 'INV-2511-008']];
  for (const [a, b] of N) eq(C.nextNumber(a), b, `next after "${a}" is "${b}"`);
}

if (suites.includes('iban')) {
  section('iban');
  // ISO 13616 / SWIFT IBAN registry examples
  for (const s of ['DE89 3704 0044 0532 0130 00', 'GB82 WEST 1234 5698 7654 32', 'FR14 2004 1010 0505 0001 3M02 606', 'NL91 ABNA 0417 1643 00', 'CH93 0076 2011 6238 5295 7',
    'AT61 1904 3002 3457 3201', 'BE68 5390 0754 7034', 'ES91 2100 0418 4502 0005 1332', 'IT60 X054 2811 1010 0000 0123 456', 'PL61 1090 1014 0000 0712 1981 2874', 'de89370400440532013000'])
    eq(!!C.checkIban(s).value, true, 'valid ' + s);
  eq(C.checkIban('DE89 3704 0044 0532 0130 00').pretty, 'DE89 3704 0044 0532 0130 00', 'pretty print in fours');
  check(/check digits/.test(C.checkIban('DE89 3704 0044 0532 0130 01').error), 'one wrong digit is a typo');
  check(/22 characters/.test(C.checkIban('DE89 3704 0044 0532 0130').error), 'wrong length names the right one');
  check(!!C.checkIban('hello').error, 'not an IBAN');
  eq(!!C.checkIban('').empty, true, 'empty');
  // EPC069-12 v2: BCD, 002, 1 (UTF-8), SCT, BIC, name, IBAN, EUR amount, purpose, structured ref, text
  eq(C.epcPayload({name: 'Juniper & Reed Studio', iban: 'DE89 3704 0044 0532 0130 00', bic: 'cobadeffxxx', amount: 619304n, text: 'INV-0042'}).value,
    'BCD\n002\n1\nSCT\nCOBADEFFXXX\nJuniper & Reed Studio\nDE89370400440532013000\nEUR6193.04\n\n\nINV-0042', 'EPC payload');
  eq(C.epcPayload({name: 'A', iban: 'NL91ABNA0417164300', amount: 1n, text: ''}).value.split('\n')[7], 'EUR0.01', 'one cent');
  check(!!C.epcPayload({name: 'A', iban: 'DE89370400440532013000', amount: 0n}).error, 'no QR for a zero amount');
  check(!!C.epcPayload({name: 'A', iban: 'DE89370400440532013000', amount: 100000000000n}).error, 'no QR above 999,999,999.99');
  check(!!C.epcPayload({name: '', iban: 'DE89370400440532013000', amount: 100n}).error, 'no QR without the account holder');
  check(!!C.epcPayload({name: 'A', iban: 'DE89370400440532013000', bic: 'XYZ', amount: 100n}).error, 'a malformed BIC is an error');
  check(/SEPA/.test(C.epcPayload({name: 'A', iban: 'BR1800360305000010009795493C1', amount: 100n}).error || ''), 'non-SEPA IBAN refused');
  eq(C.epcPayload({name: 'A'.repeat(90), iban: 'DE89370400440532013000', amount: 100n}).value.split('\n')[5].length, 70, 'name capped at 70');
}

if (suites.includes('saves')) {
  section('saves');
  // the old page's `invoices` entry, shape from its own export
  const old = {data: {business: {name: 'Acme Design', address: '1 Main St\nSpringfield', phone: '555-0100', email: 'a@acme.example', logoUrl: 'https://x/logo.png', logoData: ''},
    client: {name: 'Bob Co', address: '2 Side St', email: 'bob@bob.example', phone: ''}, info: {number: 'INV-2511-123', date: '2026-11-21', dueDate: '2026-12-21', terms: 'net_30'},
    items: [{description: 'Consulting', quantity: 1.5, rate: 120, amount: 180}, {description: 'Travel', quantity: 1, rate: 35.5, amount: 35.5}],
    subtotal: 215.5, taxRate: 7.5, taxAmount: 16.16, discount: 10, discountType: 'percentage', shipping: 5, total: 214.67,
    notes: 'Thanks!', currency: 'EUR', paymentMethod: 'bank', paymentDetails: 'IBAN ...', template: 'modern', signature: '', showBranding: true, showQrCode: false, customCss: 'body{}', showSignature: false},
    timestamp: '2026-11-21T15:43:40.520Z'};
  const m = C.fromOld(old, '2026-11-22');
  eq(m.from, 'Acme Design\n1 Main St\nSpringfield\n555-0100\na@acme.example', 'business fields become the From block');
  eq(m.to, 'Bob Co\n2 Side St\nbob@bob.example', 'client fields become Bill to');
  eq([m.number, m.issued, m.terms, m.currency], ['INV-2511-123', '2026-11-21', 'net30', 'EUR'], 'number, date, terms, currency');
  eq(m.items.map(i => [i.desc, i.qty, i.price]), [['Consulting', '1.5', '120'], ['Travel', '1', '35.5']], 'items, each once (the old page doubled them on load)');
  eq([m.taxRate, m.discount, m.discountType, m.shipping, m.notes, m.payment], ['7.5', '10', 'percent', '5', 'Thanks!', 'IBAN ...'], 'totals fields and notes');
  const r = C.compute(m); eq(C.formatMoney(r.total, 'EUR', 'en-US'), '€213.50', 'recomputed: 215.50 - 21.55 = 193.95, tax 14.55 (14.54625), + 5');
  // the old page stored a due date of +15 days with Net 30 selected: the date it showed wins
  const o2 = JSON.parse(JSON.stringify(old)); o2.data.info.dueDate = '2026-12-06';
  eq([C.fromOld(o2).terms, C.fromOld(o2).due], ['custom', '2026-12-06'], 'a stored due date that differs from the terms is kept');
  eq(C.fromOld({data: {info: {terms: 'due_on_receipt', date: '2026-01-01', dueDate: '2026-01-01'}}}).terms, 'receipt', 'due on receipt');
  eq(C.fromOld({data: {}}).items.length, 1, 'an empty old invoice gets one blank line');
  eq(C.fromOld({data: {discountType: 'fixed', discount: 0}}).discount, '', 'a zero discount stays empty');
  eq(C.fromOld({data: {discountType: 'fixed', discount: 7}}).discountType, 'amount', 'fixed discount is an amount');
  eq(C.oldClient({name: 'Bob', address: 'x\ny', phone: '', email: 'b@b'}), 'Bob\nx\ny\nb@b', 'saved client');
  eq(js(C.oldItem({name: 'Consult', description: 'per hour', rate: 120})), js({name: 'Consult', desc: 'Consult – per hour', price: '120'}), 'catalog item');
  // sanitize trusts nothing
  const s = C.sanitize({number: 42, items: [{desc: {a: 1}, qty: 2, price: null}], taxRate: ['x'], inclusive: 'yes', logo: 'javascript:alert(1)', signature: 'data:image/svg+xml;base64,AAAA',
    terms: 'net999', discountType: 'weird', currency: 'XX', locale: 'zz-ZZ', evil: '<script>'}, '2026-11-21');
  eq([s.number, s.items[0].desc, s.items[0].qty, s.items[0].price, s.taxRate, s.inclusive, s.logo, s.signature, s.terms, s.discountType, s.currency, s.locale, 'evil' in s],
    ['42', '', '2', '', '', false, '', '', 'net14', 'percent', 'USD', 'en-US', false], 'sanitize: types fixed, unsafe images dropped, unknown keys gone');
  eq(C.sanitize(null).items.length, 1, 'sanitize(null) is a blank invoice');
  eq(C.sanitize({items: Array.from({length: 5000}, () => ({}))}).items.length, 2000, 'at most 2000 lines');
  eq(C.sanitize({logo: 'data:image/png;base64,iVBORw0KGgo='}).logo, 'data:image/png;base64,iVBORw0KGgo=', 'a PNG logo survives');
  // tax names and typed currencies
  eq(['en-US/USD', 'en-GB/GBP', 'en-IE/EUR', 'en-AU/AUD', 'de-DE/EUR', 'fr-FR/EUR', 'nl-NL/EUR', 'pl-PL/PLN'].map(x => { const [l, c] = x.split('/'); return C.taxLabel({locale: l, currency: c, taxName: ''}); }),
    ['Tax', 'VAT', 'VAT', 'GST', 'USt.', 'TVA', 'Btw', 'VAT'], 'default tax names follow language and currency');
  eq(C.taxLabel({locale: 'de-DE', currency: 'EUR', taxName: ' MwSt. '}), 'MwSt.', 'a typed tax name wins');
  eq(['£350', '42,50 €', '12 EUR', '1.234 zł', '$5', '350', 'abc'].map(C.typedCurrency), ['GBP', 'EUR', 'EUR', 'PLN', '', '', ''], 'currencies people type into amounts');
  eq([C.localeFor('en-US', 'GBP'), C.localeFor('en-US', 'EUR'), C.localeFor('de-DE', 'CHF'), C.localeFor('fr-FR', 'CAD'), C.localeFor('de-DE', 'JPY'), C.localeFor('en-GB', 'GBP')],
    ['en-GB', 'en-IE', 'de-CH', 'fr-CA', 'de-DE', 'en-GB'], 'the format follows a new currency within the same language');
  // locale picking
  eq(C.pickLocale(['de-AT', 'en']), 'de-AT', 'exact browser locale'); eq(C.pickLocale(['de']), 'de-DE', 'language only'); eq(C.pickLocale(['ja-JP']), 'en-US', 'unsupported falls back');
  eq(C.labelsFor('de-CH').invoice, 'Rechnung', 'German labels'); eq(C.labelsFor('xx').invoice, 'Invoice', 'English fallback');
  for (const l in C.I18N) eq(Object.keys(C.I18N[l]).sort().join(), Object.keys(C.LABELS).sort().join(), `${l} has every label`);
}

if (suites.includes('layout')) {
  section('layout');
  const m = (s, z, w) => [...s].length * z * (w >= 600 ? 0.56 : 0.5); // a stand-in for the font's widths
  const lay = (o, opt) => { const i = inv(o); return C.layout(i, C.compute(i), m, opt || {}); };
  const texts = L => L.pages.flat().filter(o => o.t === 'text').map(o => o.str);
  let L = lay({from: 'Me\nStreet 1', to: 'Client', items: [item(2, 50, '', 'Work')], taxRate: '10'});
  eq(L.pages.length, 1, 'a short invoice is one page');
  eq([L.w, L.h], [612, 792], 'en-US prints on Letter');
  eq([lay({locale: 'de-DE'}).w, lay({locale: 'en-GB'}).w, lay({locale: 'en-US', paper: 'a4'}).w], [595.28, 595.28, 595.28], 'A4 elsewhere, or when chosen');
  check(texts(L).includes('$110.00') && texts(L).includes('Total due'), 'total printed', js(texts(L)));
  eq(texts(L).filter(t => t === '$110.00').length, 1, 'the total appears once');
  // 200 lines with long wrapping descriptions paginate, header repeated, nothing past the bottom margin, total on the last page
  const many = Array.from({length: 200}, (_, i) => item(1, 1, '', 'Line ' + i + ' ' + 'with a description long enough to wrap onto a second line in the table '.repeat(1 + (i % 3))));
  L = lay({items: many, notes: 'n\n'.repeat(80)});
  check(L.pages.length > 5, 'paginates: ' + L.pages.length + ' pages');
  let off = 0, heads = 0;
  L.pages.forEach(p => p.forEach(o => { if (o.t === 'text') { if (o.y > L.h - 40 || o.y < 30) { if (!/^INV|Page/.test(o.str) && o.y > L.h - 40) off++; } if (o.str === 'DESCRIPTION') heads++; if (o.align !== 'right' && o.x + m(o.str, o.s, o.w) > L.w - 49) off++; if (o.x < 49) off++; } }));
  eq(off, 0, 'nothing runs off the paper or into the margins');
  check(L.pages.every(p => !p.some(o => o.t === 'text' && /^Line \d+ /.test(o.str)) || p.some(o => o.str === 'DESCRIPTION')), 'every page with lines repeats the table header');
  check(L.pages.every((p, i) => p.some(o => o.t === 'text' && o.str.endsWith('Page ' + (i + 1) + ' of ' + L.pages.length))), 'every page is numbered');
  check(L.pages.flat().filter(o => o.str === '$200.00').length === 1, 'the total once, after all lines');
  // a word longer than the column wraps by characters
  L = lay({items: [item(1, 1, '', 'x'.repeat(400))]});
  check(L.pages[0].filter(o => o.t === 'text' && /^x+$/.test(o.str)).length > 3, 'a 400-letter word wraps');
  // while a field is wrong no total is printed
  L = lay({items: [item(1, '45o', '', 'Work')], discount: '10'});
  check(!texts(L).some(t => /\$\d/.test(t)), 'no money figure is printed while a line is wrong', js(texts(L)));
  check(texts(L).includes('45o'), 'the wrong value is shown where it was typed');
  // tax rows: several rates show their bases; inclusive says so
  L = lay({perLineTax: true, taxRate: '19', items: [item(1, 100), item(1, 50, '7')]});
  check(texts(L).some(t => /^Tax 19%$/.test(t)) && texts(L).includes('on $100.00'), 'each rate with its base', js(texts(L)));
  L = lay({taxRate: '19', inclusive: true, items: [item(1, 119)]});
  check(texts(L).includes('Tax 19% incl.'), 'inclusive tax is labelled');
  L = lay({locale: 'de-DE', currency: 'EUR', taxName: 'USt.', taxRate: '19', items: [item('1,5', '1.234,50', '', 'Beratung')]});
  check(texts(L).includes('Rechnung') && texts(L).includes('1,5') && texts(L).includes('1.234,50 €') && texts(L).includes('USt. 19%'), 'a German invoice reads German', js(texts(L)));
  L = lay({items: [item(1, 100)], paid: '40'});
  check(texts(L).includes('Balance due') && texts(L).includes('$60.00') && texts(L).includes('\u2212$40.00'), 'paid and balance');
  L = lay({items: [item(1, 100)]}, {qr: [[true, false], [false, true]], qrIban: 'DE89 3704'});
  eq(L.pages[0].filter(o => o.t === 'rect').length, 2, 'QR modules drawn as rectangles');
  check(texts(L).includes('Scan to pay'), 'QR caption');
  L = lay({items: [item(1, 100)], logo: 'data:image/png;base64,AA=='}, {logoSize: [800, 200]});
  const img = L.pages[0].find(o => o.t === 'img'); check(img && img.w <= 160 && img.h <= 60 && Math.abs(img.w / img.h - 4) < 1e-9, 'logo scaled into 160 x 60, aspect kept');
  L = lay({items: []});
  check(texts(L).includes('No items yet'), 'an empty table says so');
  // the wrapper breaks on spaces and keeps every character
  const w = C.wrap('alpha beta gamma delta', 60, 10, 400, m);
  eq(w.join(' '), 'alpha beta gamma delta', 'wrap keeps the words'); check(w.length > 1, 'and wraps');
  eq(C.wrap('a\n\nb', 100, 10, 400, m), ['a', '', 'b'], 'blank lines kept');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
