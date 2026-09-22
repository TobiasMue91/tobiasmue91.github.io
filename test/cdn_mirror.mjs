// Serve the Everything Converter's CDN requests from locally installed npm packages, for
// test runs without internet access (`node test/everything_converter.mjs --mirror`).
//
// The page loads its heavy libraries - ffmpeg.wasm, pdf.js, SheetJS, tesseract.js and a
// dozen more - from jsDelivr, unpkg and cdnjs. The same files ship in the npm packages, so
// installing the pinned versions and answering the page's requests from node_modules
// runs exactly the code production would, with no network. Install them with:
//
//   npm i --no-save heic2any@0.0.4 json5@2.2.3 pdf-lib@1.17.1 xlsx@0.18.5 js-yaml@4.1.0 \
//     jszip@3.10.1 mammoth@1.11.0 marked@15.0.4 msgpack-lite@0.1.26 pdfjs-dist@3.11.174 \
//     tesseract.js@5.1.0 turndown@7.2.1 jspdf@2.5.2 @ffmpeg/ffmpeg@0.12.10 \
//     @ffmpeg/util@0.12.1 @ffmpeg/core@0.12.10 @tesseract.js-data/eng
//
// Keep those versions in step with the URLs in tools/everything_converter.html.

import {existsSync, readFileSync} from 'fs';
import {join} from 'path';

// cdnjs names its files differently from the packages they come from.
const CDNJS = {
    'js-yaml': 'js-yaml/dist/js-yaml.min.js',
    'jszip': 'jszip/dist/jszip.min.js',
    'mammoth': 'mammoth/mammoth.browser.min.js',
    'marked': 'marked/marked.min.js',
    'msgpack-lite': 'msgpack-lite/dist/msgpack.min.js',
    'turndown': 'turndown/dist/turndown.js',
    'tesseract.js': 'tesseract.js/dist/tesseract.min.js',
    'pdf.js/pdf.min.js': 'pdfjs-dist/build/pdf.min.js',
    'pdf.js/pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js'
};
const TYPES = {js: 'application/javascript', mjs: 'application/javascript', wasm: 'application/wasm', json: 'application/json'};
const CDN_HOSTS = /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)\//;

// A CDN URL -> the file in node_modules that holds the same bytes, or null.
export function resolveCdn(url, modules) {
    const u = new URL(url);
    let rel = null;
    if (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'unpkg.com') {
        // /npm/@scope/name@1.2.3/path, /name@1.2.3/path, or unversioned /npm/@scope/name/path
        const m = u.pathname.replace(/^\/npm\//, '/').match(/^\/((?:@[^/]+\/)?[^@/]+)(?:@[^/]+)?\/(.+)$/);
        if (m) rel = m[1] + '/' + m[2];
    } else if (u.hostname === 'cdnjs.cloudflare.com') {
        const m = u.pathname.match(/^\/ajax\/libs\/([^/]+)\/[^/]+\/(.+)$/);
        if (m) rel = CDNJS[m[1] + '/' + m[2]] || CDNJS[m[1]];
    }
    if (!rel) return null;
    const file = join(modules, rel);
    return existsSync(file) ? file : null;
}

// Route every CDN request the page makes. Returns {hits, misses} that fill in as it runs;
// a miss is aborted, so the page sees the same failure it would see offline.
export async function mirrorCdn(page, modules) {
    const seen = {hits: new Set(), misses: new Set()};
    await page.route(CDN_HOSTS, async route => {
        const url = route.request().url();
        const file = resolveCdn(url, modules);
        if (!file) {
            seen.misses.add(url);
            return route.abort();
        }
        seen.hits.add(url);
        await route.fulfill({
            status: 200,
            body: readFileSync(file),
            headers: {'content-type': TYPES[file.split('.').pop()] || 'application/octet-stream', 'access-control-allow-origin': '*'}
        });
    });
    return seen;
}
