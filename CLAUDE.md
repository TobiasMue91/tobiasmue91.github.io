# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

gptgames.dev — a static catalogue of ~90 browser games and ~200 browser tools, almost all written by
language models. Plain HTML/CSS/JS, no framework. GitHub Pages runs Jekyll over the repo on push to
`main`, but nothing is compiled: what is in the repo is what ships.

## How a page works

Every game and tool is a single self-contained `.html` file in `games/` or `tools/` — markup, CSS and JS
inline, no shared stylesheet, no bundler. Pages are free to look nothing like each other; the closest
thing to a shared convention is the floating logo:

```html
<script src="../logo.js"></script>
```

It is optional, and about a quarter of pages leave it out — a page that already credits gptgames.dev,
or whose design the floating mark would spoil, does not need it. It sits bottom-right on its own;
`data-position` (`top-left`, `top-right`, `bottom-left`, `bottom-middle`) is only worth setting on the
rare page where that corner is already occupied.

Assets are rare. Sound comes from Web Audio, graphics from canvas or CSS, and anything that should be
reproducible (levels, songs, boards) from a seeded PRNG, so a seed in the URL is a shareable artefact.
A few older pages do ship images, under `games/img/`.

`index.html` + `arcade.js` are the catalogue front end. They fetch `data/games.json` and
`data/tools.json` at runtime and render the cards, filters, search and daily pick — so a new page
appears on the site only once it is in that JSON.

## Adding a game or tool

`util/new_entry.py` does this interactively (Selenium screenshot, LLM classification, JSON and sidebar
edits). By hand it means five edits:

1. `games/<id>.html` or `tools/<id>.html` — the `<title>` and `<meta name="description">` are what the
   catalogue and its search read.
2. `data/games.json` / `data/tools.json` — append an entry. `id` matches the filename. `categories` and
   `tags` come from the fixed vocabularies at the top of `util/new_entry.py`. `aiPowered` marks entries
   that call a language model; it, `featured` and the tags drive the homepage filters.

   `featured` defaults to **no**. It is a shelf, not a changelog: roughly one game and one tool a
   month earn it, and a new entry is not a candidate simply because it is the newest. Ask whether it
   still belongs there next to what is already featured — if a run of similar entries would all get
   the flag, feature the best one and leave the rest off. Setting it on a new entry is a good moment
   to clear it on an older one.

3. `sidebar.html` — one `<li>` before the `<!-- end -->` marker.
4. `sitemap.xml` — one `<url>` block, in alphabetical order by path.
5. `screenshots/screenshot_<n>.webp` — next free number, captured at 800×800 with the floating logo
   hidden, then resized to 260×260 and saved as lossless WebP.

## Commands

```sh
npx http-server -p 8099     # serve locally; pages need http, not file://
python util/update.py       # refresh entry dates from git, re-shoot stale screenshots
python util/new_entry.py    # register a newly added page
python util/timeline.py     # rebuild timeline_data.json, the days the home page's time travel bar offers
npm run test:server         # http-server on :80
npm run test:cypress        # Cypress e2e — its baseUrl is :8080, so point one at the other
npm run test:converter      # Everything Converter suite (needs a server on :8099)
npm run test:pingu          # Pingu Throw suite (plain Node, no server or browser)
npm run test:moorhuhn       # Moor Chicken suite (plain Node, no server or browser)
npm run test:minesweeper    # Minesweeper suite (plain Node, no server or browser)
npm run test:connect4       # Connect Four AI suite (plain Node, no server or browser)
npm run test:downhill       # Downhill Dreamer suite (plain Node, no server or browser)
npm run test:bubble         # Bubble Break suite (plain Node, no server or browser)
```

`util/` is the site-maintenance toolkit — mostly Python, and nothing in it is a test.
Page tests live in `test/`, which has its own README; `cypress/` stays separate because
Cypress dictates its layout. Most pages have no tests and do not need them. A page earns a
suite once a change to one corner can quietly break another.

Seven exist so far. `test/everything_converter.mjs` drives
`tools/everything_converter.html` in headless Chromium and is worth running after any change
to it. Eight suites — `graph`, `detect`, `edges`, `roundtrip`, `adversarial`, `codecs`, `media`,
`ui` — run together or by name (`node test/everything_converter.mjs graph edges`). Without
network, `--mirror` serves the page's CDN libraries from `node_modules`; the README has the
install line.

`test/pingu_throw.mjs` runs `games/pingu_throw.html`'s script in Node against a stub DOM and
checks every distance against a table recorded before the page was polished, so presentation
work there cannot quietly change the throw. Run it after any change to that page.
`test/moorhuhn.mjs` does the same for `games/moorhuhn.html`: a deterministic bot plays whole
seeded hunts and the second-by-second trace must match its table.
`test/minesweeper.mjs` runs the DOM-free `<script id="core">` block of `games/minesweeper.html`
and checks that the no-guess solver is sound and that every board it passes really can be
cleared without a guess — the one promise on that page nobody can see from the page.
`test/connect_four.mjs` runs the computer opponent of `games/connect_four.html` in Node and
checks that its pruned search returns what plain minimax does, and that no difficulty ever
misses a win, a block, or hands over a win it could avoid. Run it after touching the AI.
`test/downhill_dreamer.mjs` runs the DOM-free `<script id="core">` block of
`games/downhill_dreamer.html` (terrain, flight, rules): bots of four skill levels play whole
days and must get what each deserves, and the landing guide must show where the bird really
lands. Run it after touching any number in that block; `--record` re-records its golden table.
`test/bubble_break.mjs` runs the DOM-free `<script id="core">` block of `games/bubble_break.html`
(sheets, verbs, trees, economy, orders, stickers): the sheet and lasso geometry against brute force,
every special rule, that a machine alone never replaces the player, that chain reactions die out, that
older saves still load, and a human-limited bot playing the whole career, which must reach each of
the four workplaces and the finale inside its time window without a break that never ends. Run it
after touching any number in that block.

The `util/` scripts need `pillow`, `selenium`, `beautifulsoup4` and `requests`.

## Shared services

- **OpenAI** — ~27 tools call a Cloudflare Worker proxy (`https://chatgpt.tobiasmue91.workers.dev/`)
  that holds the key, so nothing sensitive is in the pages.
- **Firebase** — 6 pages share one project via `firebase.js` for multiplayer, highscores and saved
  plans. Everything else runs entirely client-side.

`README.md` covers intent and licence; `IDEAS.md` is the backlog — read it before pitching a new entry,
starting with **Read this first**, which measures how the last year of entries narrowed and names what in
the file caused it, then **Axes, not categories**, the gap lists, and the **Tried and rejected** list so an
idea that was already turned down does not come back; `PROMPTS.md` and `TIPS.md` are the prompting notes.
