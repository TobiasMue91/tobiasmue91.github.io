# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

gptgames.dev — a static catalogue of ~90 browser games and ~200 browser tools, almost all written by
language models. Plain HTML/CSS/JS, no framework. GitHub Pages runs Jekyll over the repo on push to
`main`, but nothing is compiled: what is in the repo is what ships.

## How a page works

Every game and tool is a single self-contained `.html` file in `games/` or `tools/` — markup, CSS and JS
inline, no shared stylesheet, no bundler. Pages are free to look nothing like each other; the one
convention they share is the footer include:

```html
<script src="../logo.js" data-position="bottom-left"></script>
```

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

`README.md` covers intent and licence; `IDEAS.md` is the long backlog, `PROMPTS.md` and `TIPS.md` the
prompting notes.

## Ideas worth building

Verified gaps in the current catalogue, picked because they fit the constraints — one file, no assets,
reproducible from a seed.

**Games**

- **Hidden-rule deduction.** The game invents a secret rule and answers yes/no to the player's
  experiments (Zendo, Eleusis). Mastermind is code-breaking; nothing here does rule induction.
- **Pinball.** Flippers, bumpers and ramps are pure physics and vector graphics.
- **Deck-builder.** The card games here are all classics — blackjack, freecell, crazy eights. None
  build a deck across a run.
- **Line-routing sim.** Mini Metro-shaped: growing demand, limited track, procedural maps.
- **Air hockey.** 8-ball covers cue sports; nothing covers paddles.

**Tools**

- **CSS keyframe editor.** Nine CSS tools exist and none of them touch `@keyframes`.
- **Cubic-bezier easing editor.** Pairs naturally with the above.
- **WCAG contrast checker.** There is a colour-blindness simulator but no contrast ratio checker.
- **CSS clip-path editor.** Visual polygon editing with copyable output.
- **Aspect ratio calculator** and **browser storage explorer** — small, useful, long-standing entries
  in `IDEAS.md`.
