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

## Mistakes that have come back in more than one game

Check these before calling a remade page done; each has now shipped broken in several games.

- **Balance tuned on top of a bug.** Tilt's mega balls stuck and Snow Day's knocked-down kids could not be hit by the
  next snowball; both games were paced around the fault, and mending it took ten and more minutes off a bot's game. The
  remade Unwelcome Guests counted a thing standing on a floor to the floor below, so its whirl never lifted a chair.
  Before tuning anything, have a bot count what the core verb actually achieves (hits against throws, by cause) and
  look for a cause that should be rare and is not; after a fix, run the pacing again.
- **Backdrops that move wrong under the camera.** Every layer has a depth: the ground and what grows on it (soil,
  pebbles, grass lip, rocks) move 1:1 with the camera, distant layers (hills, clouds) move by a small fraction of it, the
  sky and sun not at all. Whatever moves must move *rigidly*: give each layer's shapes positions on a fixed grid in that
  layer's own space (a hash of the cell index, never of the pixel index and never `Math.random()` per frame) and only
  translate it; re-sampling a curve at fixed screen positions makes the outline morph, and a wrap-around or an
  "avoid the sun" nudge that happens on screen makes things pop. Wrap only while fully off screen. Check it by gliding the
  camera in a script and comparing frames: the ground band must equal itself shifted by the camera step, and the
  frame-to-frame change of the sky must have no spikes.
- **Round things that never stop.** A circle on flat ground only turns its slide into a roll, so without rolling
  resistance it carries on to the edge of the level. Anything round that can roll needs damping while it touches
  something, and a test that pushes it along the floor and wants it at rest.
- **Animations that snap.** State changes (a thing jumping into place, being released, leaving) need an eased or
  sprung path with a start and an end pose, never a position swap. Record frames at 20 to 60 ms around the moment
  (Playwright's `recordVideo`, then `ffmpeg -vf fps=12`), and never time an end pose from a clock that restarts
  with the next step: it snaps back.
- **Sequences timed by the wall clock.** A ceremony whose actors move in game time but whose cards, sounds or next
  steps come from `setTimeout` falls apart on a slow device, under a speed-up, or paused: cards before the judges
  arrive, a fold that starts before its parts exist. Anything that follows the game's own motion waits on game time
  (a small queue drained by the frame's `dt`); keep `setTimeout` for things that are truly about real time.
- **Canvas text in the wrong face.** `ctx.font = '700 20px Caveat'` draws in the browser's default serif until the web
  font has loaded, and a sprite or backdrop cached in that moment keeps the serif for good. Give every canvas font a
  generic fallback (`'700 20px Caveat, cursive'`, `'400 12px Bungee, sans-serif'`) and clear cached drawings when
  `document.fonts.ready` resolves.
- **Props drawn as primitives.** Parts that float free (leaves without stems), lines left where two shapes were
  joined, a solid drawn over what should be in front of it, light that stops in a hard edge. Fill a many-part
  thing as one silhouette and outline it once, draw back to front (a crock's mouth, the spoons, the crock's front),
  give everything something that holds it and a shadow, fade light with gradients. Then look at each prop alone at
  two or three times its size (`util/cmv_props.mjs` does this for Contents May Vary from `K.debug.props`).
- **Layers ignored.** Whatever stands up off the ground (trees, houses, walls, defenders, enemies) must be drawn in one pass
  sorted by the line it stands on; baking trees into the ground tiles and drawing every unit over them put an archer in
  front of a trebuchet that stood before him, and rabbits on top of the woods they ran behind (Here Be Rabbits). Someone the
  player needs who ends up hidden is shown as a silhouette over what hides them, not by making the tree see-through.
- **A count drawn as walkers that pop.** A view that keeps its own sprites for a crowd the rules only count must never fade
  them in or out where it can be seen: a liquid count spreads along a road while sprites keep together, and the correction
  then deletes them at the back and adds them at the front. Make and drop sprites only off screen, at a spawn point or deep
  in a crowd, let a surplus walk to a shortfall, and count the fades that remain in view with a debug counter.

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

## Changing an existing game or tool

Any commit that changes a page in `games/` or `tools/` - a remake, a fix, a tweak - also sets that page's
`updated` field in `data/games.json` / `data/tools.json` to today's date (`YYYY-MM-DD`), in the same commit.
The catalogue sorts and badges by it, and nothing else updates it for you: `util/update.py` only runs when
someone remembers to. Edit the one field by hand (do not run `update.py` over the whole file for it), leave
`date` (the first release) alone, and check the diff of the JSON before committing. A remake that renames the
page also updates `title` and `description` there and its line in `sidebar.html`.

## Commands

```sh
npx http-server -p 8099     # serve locally; pages need http, not file://
python util/update.py       # refresh entry dates from git, re-shoot stale screenshots
python util/new_entry.py    # register a newly added page
python util/timeline.py     # rebuild timeline_data.json and timeline_pages.json: the days and page versions time travel offers
node util/trailer/render.mjs # the site's trailer, filmed from its own history - four steps, see util/trailer/README.md
python util/claim.py        # claim a game (--tools: a tool) before reworking it, so two sessions never take the same one
python util/seo_report.py exports/  # Search Console / Bing CSV exports -> title rewrites, near-page-one pages, unanswered queries
node util/cmv_props.mjs starter out/ # Contents May Vary: every prop of a box shot large, to find drawing faults
```

Page tests live in `test/`; `cypress/` (homepage e2e) stays separate because Cypress dictates its layout.
Most pages have no tests and do not need them. **Before changing `games/<x>.html` or `tools/<x>.html`, run
`grep -l "<x>.html" test/*.mjs`.** If a suite exists, read its header, run it before and after the change
(`npm run test:<name>`, names in `package.json`) and keep it green. Each suite's header and `test/README.md` say
what it promises, which ones need Chromium, a server or an `npm i --no-save` dependency, and how to re-record
golden tables. A page earns a new suite once a change to one corner can quietly break another; describe it in its
own header and in `test/README.md`, add its `test:` script to `package.json`, and leave this file alone.

`util/` is the site-maintenance toolkit - mostly Python, and nothing in it is a test; its scripts need `pillow`,
`selenium`, `beautifulsoup4` and `requests`. Data files some tools load (`data/describing_words*.txt`,
`data/opposites*.json`, `data/word_explainer/`, `data/names.txt`, the Daily Quote bank) are built by scripts in
`util/<tool>/`, never edited by hand; `test/README.md` names the script for each. `util/hands_up/hands.py`
re-makes the hands Hands Up embeds, from Microsoft's MIT-licensed Fluent Emoji 3D set. Tells
(`games/rock_paper_scissors.html`) inlines the same set's Flat SVGs verbatim, coloured by CSS, so it needs no script.

## Shared services

- **OpenAI** — ~27 tools call a Cloudflare Worker proxy (`https://chatgpt.tobiasmue91.workers.dev/`)
  that holds the key, so nothing sensitive is in the pages.
- **Firebase** — 6 pages share one project via `firebase.js` for multiplayer, highscores and saved
  plans. Everything else runs entirely client-side.

`README.md` covers intent and licence; `IDEAS.md` is the backlog — read it before pitching a new entry,
starting with **Read this first**, which measures how the last year of entries narrowed and names what in
the file caused it, then **Axes, not categories**, the gap lists, and the **Tried and rejected** list so an
idea that was already turned down does not come back; `PROMPTS.md` and `TIPS.md` are the prompting notes.
`CONTENTS_MAY_VARY.md` is the rulebook of the incremental anthology in `games/contents_may_vary.html`; read it before
touching that page.
