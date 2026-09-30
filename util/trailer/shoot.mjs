// Step 1: photograph the past. Reads the local git history (a full clone, not a shallow one).
//
//   build/shots/home/<day>_<hash>.png   the home page on every day of timeline_data.json
//   build/shots/today.png               the home page as it is now (HEAD)
//   build/shots/pages/<page>/vNN.png    every version, from timeline_pages.json, of PAGES
//   build/shots/pages/index.json        what each of those versions is
//
// Pictures that exist are kept; --force takes them again. The page's own idea of today
// (daily picks, "new" badges) is set to the day of the snapshot.
import {launch, wire, ORIGIN, REPO, BUILD} from './snap.mjs';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';

// The pages the trailer steps through, compares or quotes (plan.py names the versions).
export const PAGES = ['games/snake.html', 'games/pong.html', 'games/asteroids.html', 'games/frogger.html',
    'games/chess.html', 'games/duck_hunt.html', 'games/escape_the_maze.html', 'games/blockdrop.html',
    'games/fishing.html', 'games/breakout.html'];

const FORCE = process.argv.includes('--force');
const SHOTS = join(BUILD, 'shots');
const days = JSON.parse(readFileSync(join(REPO, 'timeline_data.json'), 'utf8'))
    .filter(d => d.hash && d.GptVersion !== 'CURRENT')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
const history = JSON.parse(readFileSync(join(REPO, 'timeline_pages.json'), 'utf8'));

const browser = await launch();

async function shoot(context, hash, path, file, when, settle) {
    if (!FORCE && existsSync(file)) return;
    context.state.hash = hash;
    const page = await context.newPage();
    page.on('pageerror', () => {});
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.clock.setFixedTime(when);
    await page.goto(ORIGIN + path, {waitUntil: 'load', timeout: 30000}).catch(e => console.warn(path, hash.slice(0, 8), e.message.split('\n')[0]));
    await page.waitForTimeout(settle);
    await page.addStyleTag({content: '#tt{display:none!important}'}).catch(() => {});
    await page.screenshot({path: file});
    await page.close();
}

// The home page: 1440 x 900, drawn at 1.25x so it stays sharp at the trailer's 1600 px.
{
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1.25});
    await wire(context);
    mkdirSync(join(SHOTS, 'home'), {recursive: true});
    for (const [n, d] of days.entries()) {
        const file = join(SHOTS, 'home', `${d.timestamp.slice(0, 10)}_${d.hash.slice(0, 8)}.png`);
        await shoot(context, d.hash, 'index.html', file, new Date(d.timestamp), 1000);
        if (n % 25 === 0) console.log(`home ${n + 1}/${days.length}`);
    }
    await shoot(context, 'HEAD', 'index.html', join(SHOTS, 'today.png'), new Date(), 1800);
    await context.close();
}

// The pages: 1280 x 800 at 1.5x.
{
    const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1.5});
    await wire(context);
    const index = {};
    for (const key of PAGES) {
        let rows = history[key];
        if (typeof rows === 'string') rows = history[rows];
        const id = key.replace(/\//g, '__').replace(/\.html$/, '');
        mkdirSync(join(SHOTS, 'pages', id), {recursive: true});
        index[key] = [];
        for (const [k, [hash, time, message, extra]] of rows.entries()) {
            const path = (extra && extra.path) || key;
            const file = `${id}/v${String(k + 1).padStart(2, '0')}.png`;
            await shoot(context, hash, path, join(SHOTS, 'pages', file), new Date(time), 1200);
            index[key].push({file, hash, time, message, path});
        }
        console.log(key, rows.length, 'versions');
    }
    writeFileSync(join(SHOTS, 'pages', 'index.json'), JSON.stringify(index, null, 1));
    await context.close();
}
await browser.close();
