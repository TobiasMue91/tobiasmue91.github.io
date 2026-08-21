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
3. `sidebar.html` — one `<li>` before the `<!-- end -->` marker.
4. `sitemap.xml` — one `<url>` block, in alphabetical order by path.
5. `screenshots/screenshot_<n>.webp` — next free number, captured at 800×800 with the floating logo
   hidden, then resized to 260×260 and saved as lossless WebP.

## Commands

```sh
npx http-server -p 8099     # serve locally; pages need http, not file://
python util/update.py       # refresh entry dates from git, re-shoot stale screenshots
python util/new_entry.py    # register a newly added page
npm run test:server         # http-server on :80
npm run test:cypress        # Cypress e2e — its baseUrl is :8080, so point one at the other
```

The `util/` scripts need `pillow`, `selenium`, `beautifulsoup4` and `requests`.

## Shared services

- **OpenAI** — ~27 tools call a Cloudflare Worker proxy (`https://chatgpt.tobiasmue91.workers.dev/`)
  that holds the key, so nothing sensitive is in the pages.
- **Firebase** — 6 pages share one project via `firebase.js` for multiplayer, highscores and saved
  plans. Everything else runs entirely client-side.

`README.md` covers intent and licence; `IDEAS.md` is the backlog, including a list of gaps checked
against the current catalogue; `PROMPTS.md` and `TIPS.md` are the prompting notes.
