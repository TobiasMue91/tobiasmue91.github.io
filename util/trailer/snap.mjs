// Show Playwright the site as it was at any commit, straight from the local git history.
//
// Every request to http://snap.test/<path> (or to gptgames.dev itself) is answered with
// <path> as it was at context.state.hash, so a page, its scripts, its screenshots and
// its JSON all come from the same commit - the time travel bar does the same through
// jsDelivr. CDN libraries the old pages used come from build/node_modules when they are
// installed there (see README.md); Google Fonts are fetched live, and anything else
// outside the repo is aborted, as it would be offline.
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import {existsSync, readFileSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const BUILD = join(HERE, 'build');
const MODULES = join(BUILD, 'node_modules');
export const ORIGIN = 'http://snap.test/';

// Playwright from the project, or the global install.
function loadPlaywright() {
    for (const base of [REPO + '/', execFileSync('npm', ['root', '-g']).toString().trim() + '/']) {
        try {
            return createRequire(base)('playwright');
        } catch (e) { /* try the next */
        }
    }
    throw new Error('Playwright not found: npm i playwright (or install it globally)');
}

export const {chromium} = loadPlaywright();

const TYPES = {
    html: 'text/html; charset=utf-8', js: 'application/javascript', mjs: 'application/javascript', css: 'text/css',
    json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', mp3: 'audio/mpeg', wav: 'audio/wav',
    ogg: 'audio/ogg', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', txt: 'text/plain', xml: 'application/xml'
};

const blobs = new Map();

// A file as it was at a commit, or null if it did not exist then.
export function gitFile(hash, path) {
    const key = hash + ':' + path;
    if (!blobs.has(key)) {
        let body = null;
        try {
            body = execFileSync('git', ['show', key], {cwd: REPO, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore']});
        } catch (e) { /* not there */
        }
        blobs.set(key, body);
    }
    return blobs.get(key);
}

// CDN URLs of the libraries old pages loaded -> the same file in an npm package.
const CDN = [
    [/font-awesome\/[^/]+\/(.+)$/, m => '@fortawesome/fontawesome-free/' + m[1]],
    [/fontawesome-free@[^/]+\/(.+)$/, m => '@fortawesome/fontawesome-free/' + m[1]],
    [/jquery(?:-|\/|@)?[\d.]*(?:\/dist)?\/?(jquery(?:\.min)?\.js)$/, m => 'jquery/dist/' + m[1]],
    [/toastr\.js\/[^/]+\/(toastr(?:\.min)?\.(?:js|css))$/, m => 'toastr/build/' + m[1]],
    [/p5(?:\.js)?\/[^/]+\/(p5(?:\.min)?\.js)$/, m => 'p5/lib/' + m[1]],
    [/p5@[^/]+\/lib\/(p5(?:\.min)?\.js)$/, m => 'p5/lib/' + m[1]],
];

export async function wire(context) {
    context.state = {hash: 'HEAD'};
    await context.route('**/*', async route => {
        const url = route.request().url()
            .replace(/^https?:\/\/(www\.)?(gptgames\.dev|tobiasmue91\.github\.io)\//i, ORIGIN);
        if (url.startsWith(ORIGIN)) {
            let path = decodeURIComponent(new URL(url).pathname.slice(1));
            if (!path || path.endsWith('/')) path += 'index.html';
            let body = gitFile(context.state.hash, path);
            if (body === null && !/\.[a-z0-9]+$/i.test(path)) {
                path += '/index.html';
                body = gitFile(context.state.hash, path);
            }
            if (body === null) return route.fulfill({status: 404, body: 'not in this commit'});
            return route.fulfill({status: 200, body, contentType: TYPES[path.split('.').pop().toLowerCase()] || 'application/octet-stream'});
        }
        // Web fonts are the one thing fetched live: the pages look wrong without them.
        if (/^(data|blob):|^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return route.continue();
        for (const [re, map] of CDN) {
            const m = url.match(re);
            const file = m && join(MODULES, map(m));
            if (file && existsSync(file)) {
                return route.fulfill({status: 200, body: readFileSync(file), contentType: TYPES[file.split('.').pop()] || 'application/octet-stream'});
            }
        }
        return route.abort();
    });
}

export function launch() {
    return chromium.launch({
        // Behind a proxy (as in a cloud sandbox) the fonts go through it.
        proxy: process.env.HTTPS_PROXY ? {server: process.env.HTTPS_PROXY} : undefined,
        args: ['--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none']
    });
}
