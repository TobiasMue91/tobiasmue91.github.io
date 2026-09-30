// Step 4: film trailer.html frame by frame and put the soundtrack under it.
//
//   node util/trailer/render.mjs                     the whole trailer -> build/gptgames_trailer.mp4
//   node util/trailer/render.mjs --from 16 --to 24   a stretch of it   -> build/part.mp4
//   node util/trailer/render.mjs --stills 1,8.5,17   PNG stills         -> build/stills/
//
// Nothing on the page moves by itself: window.renderAt(t) draws the moment t and resolves
// once its pictures are decoded, so every frame is exactly the frame of its time. Needs
// ffmpeg with libx264 on the PATH (or FFMPEG=/path/to/ffmpeg).
import {spawn} from 'child_process';
import http from 'http';
import {mkdirSync, writeFileSync} from 'fs';
import {readFile} from 'fs/promises';
import {join, normalize} from 'path';
import {chromium, REPO, BUILD} from './snap.mjs';

const FPS = 30;
const arg = (name, fallback) => {
    const i = process.argv.indexOf('--' + name);
    return i < 0 ? fallback : process.argv[i + 1];
};

// The page reads build/plan.json, its pictures and the site's own screenshots, so the
// repository root is served as it is.
const TYPES = {html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', jpg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', woff2: 'font/woff2'};
const server = http.createServer(async (req, res) => {
    const path = normalize(join(REPO, decodeURIComponent(req.url.split('?')[0])));
    try {
        if (!path.startsWith(REPO)) throw new Error('outside');
        const body = await readFile(path);
        res.writeHead(200, {'content-type': TYPES[path.split('.').pop()] || 'application/octet-stream'});
        res.end(body);
    } catch (e) {
        res.writeHead(404);
        res.end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const browser = await chromium.launch({args: ['--font-render-hinting=none', '--disable-lcd-text']});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
page.on('pageerror', e => console.error('page:', e.message));
await page.goto(`http://127.0.0.1:${port}/util/trailer/trailer.html`);
await page.waitForFunction(() => window.ready === true, null, {timeout: 300000});
const stage = await page.$('#stage');
const duration = await page.evaluate(() => window.duration);

async function frame(t, type = 'jpeg') {
    await page.evaluate(t => window.renderAt(t), t);
    return stage.screenshot({type, quality: type === 'jpeg' ? 94 : undefined});
}

if (arg('stills')) {
    const out = join(BUILD, 'stills');
    mkdirSync(out, {recursive: true});
    for (const t of arg('stills').split(',').map(Number)) {
        const file = join(out, `t${t.toFixed(2).padStart(6, '0')}.png`);
        writeFileSync(file, await frame(t, 'png'));
        console.log(file);
    }
} else {
    const from = Number(arg('from', 0)), to = Number(arg('to', duration));
    const whole = from === 0 && to === duration;
    const out = arg('out', join(BUILD, whole ? 'gptgames_trailer.mp4' : 'part.mp4'));
    const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-ss', String(from), '-t', String(to - from), '-i', join(BUILD, 'soundtrack.wav'),
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '18'), '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out], {stdio: ['pipe', 'inherit', 'inherit']});
    const done = new Promise(resolve => ff.on('close', resolve));
    const started = Date.now();
    for (let n = Math.round(from * FPS); n < Math.round(to * FPS); n++) {
        if (!ff.stdin.write(await frame(n / FPS))) await new Promise(r => ff.stdin.once('drain', r));
        if (n % 300 === 0) console.log(`${(n / FPS).toFixed(0)} s of ${to} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    if (await done !== 0) throw new Error('ffmpeg failed');
    console.log('wrote', out);
}
await browser.close();
server.close();
