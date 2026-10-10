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
  sprung path with a start and an end pose, never a position swap. Record frames at 20 to 60 ms around the moment.

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
python util/timeline.py     # rebuild timeline_data.json and timeline_pages.json: the days and page versions time travel offers
node util/trailer/render.mjs # the site's trailer, filmed from its own history - four steps, see util/trailer/README.md
python util/claim.py        # claim a game before reworking it, so two sessions never take the same one
python util/seo_report.py exports/  # Search Console / Bing CSV exports -> title rewrites, near-page-one pages, unanswered queries
npm run test:server         # http-server on :80
npm run test:cypress        # Cypress e2e — its baseUrl is :8080, so point one at the other
npm run test:converter      # Everything Converter suite (needs a server on :8099)
npm run test:pingu          # Pingu Throw suite (plain Node, no server or browser)
npm run test:moorhuhn       # Moor Chicken suite (plain Node, no server or browser)
npm run test:minesweeper    # Minesweeper suite (plain Node, no server or browser)
npm run test:connect4       # Connect Four AI suite (plain Node, no server or browser)
npm run test:downhill       # Downhill Dreamer suite (plain Node, no server or browser)
npm run test:bubble         # Bubble Break suite (plain Node, no server or browser)
npm run test:towers         # Three Gates suite (plain Node, no server or browser)
npm run test:firefly        # Firefly Jar suite (plain Node, no server or browser)
npm run test:normalizer     # Audio Normalizer suite (plain Node, no server or browser)
npm run test:minifier       # Crusher and HTML Minify suite (Playwright's Chromium, no server)
npm run test:familytree     # Family Tree Builder suite (plain Node, no server or browser)
npm run test:frames         # frame stepping in the two frame extractors (Playwright's Chromium and ffmpeg, no server)
npm run test:2048           # 2048 suite (plain Node, no server or browser)
npm run test:monkeytype     # Monkeytype Clone suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:emoji          # Peel & Seek suite (plain Node, no server or browser)
npm run test:rps            # Hands Up suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:mystery        # Under the Lamp suite (plain Node, no server or browser)
npm run test:breakout       # Vigil (Breakout) suite (plain Node, no server or browser)
npm run test:hangman        # Last Words (Hangman) suite (plain Node, no server or browser)
npm run test:wordsearch     # Highlight (Word Search) suite (plain Node, no server or browser)
npm run test:tells          # Tells (Rock Paper Scissors) suite (plain Node, no server or browser)
npm run test:doodling       # Squiggle (Doodling) suite (plain Node, no server or browser)
npm run test:whac           # Prickle Patch (Whac-a-Hedgehog) suite (plain Node, no server or browser)
npm run test:blackjack      # Blackjack suite (plain Node, no server or browser)
npm run test:blockdrop      # Boogie Woogie (Blockdrop) suite (plain Node, no server or browser)
npm run test:lastsmile      # Last Smile (Emoji Horde Survival) suite (plain Node, no server or browser)
npm run test:tumbler        # Tumbler (Guess the Number) suite (plain Node, no server or browser)
npm run test:sixdigits      # Six Digits (Color Guessing Game) suite (plain Node, no server or browser)
npm run test:pointline      # point & line (Dodge the Obstacles) suite (plain Node, no server or browser)
npm run test:crazyeights    # Crazy Eights suite (plain Node, no server or browser)
npm run test:departures     # Departures (Time Travel Agency) suite (plain Node, no server or browser)
npm run test:moodswing      # Moodswing (Emoji Match 3) suite (plain Node, no server or browser)
npm run test:bedtime        # Bedtime (Lights Out) suite (plain Node, no server or browser)
npm run test:ludo           # Ludo suite (plain Node, no server or browser)
npm run test:patience       # Patience (Solitaire) suite (plain Node, no server or browser)
npm run test:yahtzee        # Yacht (Yahtzee) suite (plain Node, no server or browser)
npm run test:missile        # Lights On (Missile Command) suite (plain Node, no server or browser)
npm run test:stack          # Stack Tower suite (plain Node, no server or browser)
npm run test:lanternfall    # Lanternfall (WebCraft) suite (plain Node, no server or browser)
npm run test:reversi        # Reversi suite (plain Node, no server or browser)
npm run test:checkers       # Checkers suite (plain Node, no server or browser)
npm run test:nonogram       # Tesserae (Nonogram) suite (plain Node, no server or browser)
npm run test:shatter        # Shatter Field (3D Asteroids) suite (plain Node, no server or browser)
npm run test:feud           # We Asked 100 (Family Feud) suite (plain Node, no server or browser)
npm run test:hanoi          # Tower of Hanoi suite (plain Node, no server or browser)
npm run test:glowtide       # Glowtide (Chain Reaction) suite (plain Node, no server or browser)
npm run test:catchcircle    # Catch Circle suite (plain Node, no server or browser)
npm run test:voidrunner     # Void Runner suite (plain Node, no server or browser)
npm run test:void           # VOID (black hole) suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:backgammon     # Backgammon suite (plain Node, no server or browser)
npm run test:truths         # Two Truths & a Lie suite (plain Node, no server or browser)
npm run test:hotseat        # Hot Seat (Who Wants to Be a Millionaire) suite (plain Node, no server or browser)
npm run test:deathbyai      # Death by AI suite (plain Node, no server, browser or network)
npm run test:qix            # QIX suite (plain Node, no server or browser)
npm run test:simon         # Simon Says suite (plain Node, no server or browser)
npm run test:artillery   # Artillery suite (plain Node, no server or browser)
npm run test:wick           # Wick (Deep Miner) suite (plain Node, no server or browser)
npm run test:fling          # Fling suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:wordrain       # Word Rain suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:horde          # Emoji Horde suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:rubik          # Rubik's Cube suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:buddy          # Interactive Buddy suite (plain Node, no server or browser)
npm run test:colorflood     # Color Flood suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:alphabet       # Alphabet Typing Speed suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:tictactoe      # Margins (Tic-Tac-Toe) suite (plain Node, no server or browser)
npm run test:fugue          # Fugue (Flappy Bird) suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:suika          # Suika suite (plain Node, no server or browser)
npm run test:regatta        # Regatta (Typing Game) suite (plain Node, no server or browser)
npm run test:fathom         # Fathom (typing dive) suite (plain Node, no server or browser)
npm run test:fishing        # Saltline (Fishing Game) suite (plain Node, no server or browser)
```

`util/` is the site-maintenance toolkit — mostly Python, and nothing in it is a test. `util/hands_up/hands.py`
re-makes the hands Hands Up embeds, from Microsoft's MIT-licensed Fluent Emoji 3D set. Tells
(`games/rock_paper_scissors.html`) inlines the same set's Flat SVGs verbatim, coloured by CSS, so it needs no script.
Page tests live in `test/`, which has its own README; `cypress/` stays separate because
Cypress dictates its layout. Most pages have no tests and do not need them. A page earns a
suite once a change to one corner can quietly break another.

Sixty-six exist so far. `test/everything_converter.mjs` drives
`tools/everything_converter.html` in headless Chromium and is worth running after any change
to it. Eight suites — `graph`, `detect`, `edges`, `roundtrip`, `adversarial`, `codecs`, `media`,
`ui` — run together or by name (`node test/everything_converter.mjs graph edges`). Without
network, `--mirror` serves the page's CDN libraries from `node_modules`; the README has the
install line.

`test/pingu_throw.mjs` runs the DOM-free `<script id="core">` block of `games/pingu_throw.html`
and checks every distance against a table recorded before the page was remade, so presentation
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
(sheets, verbs, trees, economy, orders, stickers, special deliveries, lightning): the sheet and lasso geometry
against brute force, every special rule and material, that a machine alone never replaces the player, that chain reactions die out, that
older saves still load, and a human-limited bot playing the whole career, which must reach each of
the five workplaces and the finale inside its time window without a break that never ends. Run it
after touching any number in that block.
`test/tower_defense.mjs` runs the DOM-free core of `games/mini_tower_defense.html` (Three Gates):
the maps keep their roads apart, every wave spawns what its preview card said, and bots play whole
games - a player who builds what the card names must outlast the same player building blind, and
the old page's two-tower build must fall by the mid-teens. Run it after touching any number in the
core; the `planner` suite (a bot that tries every purchase in a copy of the game) is slow and opt-in.
`test/firefly_jar.mjs` runs the DOM-free core of `games/firefly_jar.html`, an incremental: bots with a
person's reaction time play the whole year on a phone-sized and a desktop meadow, and each season
must take its share of the two hours, relight the old lanterns fast, climb as a curve rather than a
jump, and never leave the player saving for long with nothing to buy. The `sky` suite checks that
each kind of weather does what its forecast says and none spoils a night, and that a second year
comes round faster without skipping a season. Run it after touching any price or multiplier;
`pace --report` prints the year night by night.
`test/audio_normalizer.mjs` runs the DOM-free core of `tools/audio_normalizer.html` (loudness
meter, true peak, limiter) against things that are certain: the EBU Tech 3341 signals, the
K-weighting curve from the coefficients BS.1770 prints, analytic true peaks, and a limiter that
must hold -1 dBTP from the first sample to the last while each preset lands on its number. The
page grades its own output with the same meter, so this is the only place a wrong one shows.
Run it after touching the core.
`test/code_minifier.mjs` runs the DOM-free cores of `tools/code_minifier.html` (The Crusher) and
`tools/minify.html` and judges what they return with things that do not come from the pages:
Chromium's own parser and layout for CSS and HTML - every stylesheet and every page on this site
goes through, and must mean and draw the same - Python's `ast` over the local standard library,
PHP's tokenizer, and SQL scripts written out exactly. A minifier that changes what code does
looks exactly like one that does not, so run it after touching either page's core.
`test/family_tree.mjs` runs the DOM-free core of `tools/family_tree_builder.html` (the family
model, its generation layout and the Link rules) against families generated the way people enter
them - descendants, in-laws with their own parents, a tree built up from one person - and against
the contradictions old saves can hold: every parent one row above their child, every couple side
by side, nobody overlapping. Run it after touching the core.
`test/frame_step.mjs` loads clips whose every frame carries its own number into
`tools/video_frame_extractor.html` and `tools/video_thumbnail_extractor.html` and presses their
buttons: at 24 to 120 fps, from a late start, and in recordings with uneven frames and no
duration, each step must move exactly one frame, and each grab - even one clicked before the step
has finished - must hold, and be labelled with, the frame that was on screen. Run it after
touching either page's frame stepping.
`test/2048.mjs` runs the DOM-free `<script id="core">` block of `games/2048.html`: every merge
against a plainly written reference, the plan the page animates each move from against the board
it came with, seeded games and saves that carry on identically, and bots that play whole games.
Run it after touching the core.
`test/monkeytype.mjs` runs the DOM-free `<script id="core">` block of `games/monkeytype.html`, a
typing test whose one promise is that its numbers are true: bots type whole tests letter by letter,
with slips they fix and slips they leave, or a word at a time the way a phone's autocorrect sends
them, and the wpm, accuracy and keystrokes the page reports must equal each bot's own count. The
`page` suite presses real keys in Chromium, desktop and phone. Run it after touching the core or the input handling.
`test/emoji_puzzle_mania.mjs` runs the DOM-free `<script id="core">` block of
`games/emoji_puzzle_mania.html` (Peel & Seek), a visual search: every board holds exactly the
targets the stamp promises, moons and clocks are never turned, the tape never runs while paused or
passes its end, and bots with a person's search speed must reach the round their skill deserves.
Run it after touching `SHEETS`, the families or the clock.
`test/rock_paper_scissors_mp.mjs` runs the DOM-free `<script id="core">` block of
`games/rock_paper_scissors_mp.html` (Hands Up), where two phones share one match in Firebase and each
works out the score from it: a throw is sealed as a hash and opened only once both are in. Two
simulated phones play hundreds of matches through a network that reorders, delays and drops
writes, reload mid-round and lose their secrets; nothing but a seal may be in a round before both
have thrown, both phones must agree, and every result must match the throws made. The `cheats`
suite copies, swaps and forges seals. Run it after touching the core or how the page writes.
`test/mystery_ai.mjs` runs the DOM-free `<script id="core">` block of `games/mystery_ai.html`
(Under the Lamp), a detective game built from a seed: thousands of cases must each be fair - the
trait left at the scene belongs to exactly the two liars, each lie breaks on the cards that contradict
it and on nothing else, every card can be reached, and a player who has seen everything is left with
one suspect, one weapon and one motive. It also checks that what the language model is told never
holds a secret the player has not uncovered. Run it after touching the core.
`test/breakout.mjs` runs the DOM-free `<script id="core">` block of `games/breakout.html` (Vigil),
Breakout in an abbey window: every pane of the twelve windows sits inside the arch and can be
reached without passing lead, thousands of seeded sparks never slip into a pane, through the arch
or off their speed, the combo, jewels and candles do what the page shows, a save comes back pane
for pane, and bots of three skills keep the whole night without a rally going dry for long. Run it
after touching `WINDOWS`, the physics or the stall assist.
`test/hangman.mjs` runs the DOM-free `<script id="core">` block of `games/hangman.html` (Last Words),
Hangman on an execution broadside: every word of the 800 is reachable from its clue by a player who
knows the clue's words, today's sheet is the same for everyone and runs through every fair word before
one repeats or a clue comes round two days running, the share line never gives the word away, a
streak counts the way the verdict says, and the endless docket lets a player in and then wears them
down. Run it after touching the word lists, the daily order or the record.
`test/word_search.mjs` runs the DOM-free `<script id="core">` block of `games/word_search.html`
(Highlight), a word search whose leftover letters spell a hidden message: hundreds of book puzzles,
a year of dailies and every theme at every size must hold each word exactly once and nowhere by
accident, with the unused cells spelling the message in reading order; word lists may not hide one
word inside another, and drags must snap straight at every angle. Run it after touching `THEMES`
or the generator.
`test/rock_paper_scissors.mjs` runs the DOM-free `<script id="core">` block of
`games/rock_paper_scissors.html` (Tells), rock paper scissors against six machines with one habit
each: no machine sees your throw before it commits to its own, each tell card states the habit the
machine really has (a player who knows it wins nearly every match, one who throws at random gets a
fair coin), the count the card shows matches the tape, and every sentence the Oracle says about you
is true of this match. Run it after touching a machine or the Oracle.
`test/doodling.mjs` runs the DOM-free `<script id="core">` block of `games/doodling.html` (Squiggle),
a doodle pad with a squiggle a day: every day's squiggle is the same on every device, stays on its
sheet in both orientations and never knots into a blot, its dots are evenly spaced, the dots a pen
takes in while drawing are the ones still taken after a reload, a sheet round-trips through storage
exactly, and a new day files yesterday's drawing instead of losing it. Run it after touching the
squiggle, the pens, the codec or the pad and sketchbook rules.
`test/whac.mjs` runs the DOM-free `<script id="core">` block of `games/whac.html` (Prickle Patch),
whac-a-mole with hedgehogs: every boop, sting, apple and miss is worth what the rules say, no burrow
ever holds two things or comes up unwarned, the first round meets a lone wasp before it gets busy,
and one-fingered bots with a person's reaction time must score in order of their speed while a
spammer drumming every burrow loses to an average player. Run it after touching the tempo or a price.
`test/blackjack.mjs` runs the DOM-free `<script id="core">` block of `games/blackjack.html`: stacked
shoes check every rule hand by hand (peeks, insurance and even money, splits, split aces, doubles,
surrender, the dealer standing on soft 17), random play over 200,000 rounds must account for every
dollar against a settlement worked out separately, the book must match the published basic
strategy chart cell by cell, and a bot playing it must lose the house edge these rules give. Run it
after touching the core.
`test/blockdrop.mjs` runs the DOM-free `<script id="core">` block of `games/blockdrop.html` (Boogie
Woogie), a falling-block game on modern guideline rules, against references written the other way
round: every turn on thousands of random boards lands where true rotation plus the guideline's
offset tables puts it, every T that locks is judged by a plain three-corner rule, and every point of
thousands of games matches a scorer written in the test (spins, back-to-back, combos, all clears);
bags hold each piece once, gravity and the lock delay's fifteen resets keep time, a save made at any
moment resumes identically, and a careful bot reaches level 15. Its `auto` suite plays the page's own
player (Watch, `<script id="auto">`): every key legal, a short plan per piece, no top-out over hundreds
of pieces, and mostly quads. Run it after touching the core or the player.
`test/last_smile.mjs` runs the DOM-free `<script id="core">` block of `games/emoji_horde_survival.html`
(Last Smile), a horde survival until sunrise: thousands of level-ups chosen at random never offer a
duplicate, a maxed gift or a fifth slot, and offer an evolution exactly when its recipe is complete;
every ring, stream and storm of the night arrives on time, lightning hurts inside its warning ring
only, nothing moves while a card is up, and sunrise cheers every face left. Bots play whole nights:
standing still loses, a careful kiter sees the sunrise, one who picks cards at random still outlasts
the first storm. Run it after touching any number in the core.
`test/number_guess.mjs` runs the DOM-free `<script id="core">` block of `games/number_guess.html`
(Tumbler), guess-the-number as a run of safes paid for in lockpicks: every answer must be true of the
combination, every pick spent and paid exactly, a guess already ruled out refused for free, and a save
carry on identically; the first four safes must always open for a player who halves, certain() must be
true exactly when halving cannot fail, and careful, sloppy and novice bots must reach the stage their
play deserves, in that order. Run it after touching the safe sizes or the picks they bring.
`test/color_guessing_game.mjs` runs the DOM-free `<script id="core">` block of `games/color_guessing_game.html`
(Six Digits), a daily game of mixing hex codes by eye: CIEDE2000 against Sharma's published pairs, every
colour surviving hex to HSL and back, a score that only falls as the difference grows, a daily sheet the
same on every device with five targets spread round the wheel and starts far from them, every word under
every bar true of the mix and every tick where the target sits, stamps that land once and in order, and
careful, sloppy and random bots that score in that order. Run it after touching the core.
`test/obstacle_dodge.mjs` runs the DOM-free `<script id="core">` block of `games/obstacle_dodge.html`
(point & line), a dodge game whose one promise is that you were warned: every distance a hit or a near
miss is judged by against brute force, every shape waiting in the bleed for its full warning without
reaching into the trim, nothing hurting before it has waited, every line keeping a gap the point fits
through, every triangle darting exactly where its line pointed when it locked, a seed being the same
run whatever the player does, and planners with a person's reaction time far outlasting players who
stand still or move without looking. Run it after touching the core.
`test/crazy_eights.mjs` runs the DOM-free `<script id="core">` block of `games/crazy_eights.html`: stacked hands
check every rule (suit, rank, eights naming a suit, drawing only when stuck, a drawn card that fits going straight
down, the pile reshuffled under its top card), the score (eights 50, courts 10, lowest wins past 100), and thousands
of whole matches by the computer players - every move legal, all 52 cards always somewhere, every crossed-out suit on
a portrait true of that hand, a match saved at any moment carrying on move for move, and a random player losing to
them. Run it after touching the core or the players.
`test/time_travel_agency.mjs` runs the DOM-free `<script id="core">` block of `games/time_travel_agency.html`
(Departures), an idle game on a departures board whose every figure comes from that core: a bulk buy costs exactly the
single cars it replaces and MAX never overspends, lines open in order and nothing is sold on credit, one long frame pays
what sixty short ones do, time away pays exactly what the same time on the board would, a save carries on exactly, the
old page's save opens the lines its player reached, and bots with a person's reaction time reach the Big Bang in about
an hour and a quarter with every line arriving in order. Run it after touching any price, fare or trip time.
`test/emoji_match_three.mjs` runs the DOM-free `<script id="core">` block of `games/emoji_match_three.html`
(Moodswing), a match-3 whose page only animates the events its core returns: stacked boards check every match shape
and what it makes, what each special and each pair of specials clears, and how clouds lose their layers; thousands
of random moves keep the board full, every piece in one place and a move always open; every move replayed from its
events alone must end on the core's board, a save carries on move for move, and each level must be about as hard as
the bot-measured `TABLE` in the core says. Run it after touching the core; `levels --full` re-measures every level.
`test/lights_out.mjs` runs the DOM-free `<script id="core">` block of `games/lights_out.html` (Bedtime), Lights Out
on apartment blocks whose one promise is the par it shows: the GF(2) solver must find the fewest presses on every
board brute force can check, in every building outline, and say so when a board cannot be cleared; every level and
a year of nightly blocks must be the same everywhere, clearable, and exactly as long as designed; moons and streaks
count the way the card says. Run it after touching the solver, `spec` or the outlines.
`test/ludo.mjs` runs the DOM-free `<script id="core">` block of `games/ludo.html`, whose page only animates the moves
its core returns: the 52 track squares and four lanes against the drawn board, stacked positions for every rule (a six to
leave the yard, the exact roll home, captures but never on a start or a star, bonus rolls for a six, a capture or a pawn
home, three sixes losing the turn), a thousand whole games in which every pawn is always somewhere legal and two colours
share only safe squares, a save that carries on roll for roll, and a computer player that beats a random mover. Run it
after touching the core.
`test/solitaire.mjs` runs the DOM-free `<script id="core">` block of `games/solitaire.html` (Patience), Klondike whose one
promise is that every deal can be won: the page lists its deals as bit masks of seeds its own solver cleared, and the suite
re-solves a sample and replays each way out move by move. Stacked positions check every rule (alternate colours, kings to
empty columns, suits home from the ace, draw one and three, recycling), thousands of random games keep all 52 cards in
place, a tap is refused only when the card truly has nowhere to go, a hint the page calls sure leads on to a win, and a
table with nothing hidden always finishes itself. Changing the solver or the deal means re-listing the seeds; run it after
touching the core.
`test/yahtzee.mjs` runs the DOM-free `<script id="core">` block of `games/yahtzee.html` (Yacht), Yahtzee on a
yacht's score pad: every box on all 7776 rolls against rules written the other way round, the joker rules for an
extra Yacht, seeded dice that are fair and the same for everyone with kept dice never changing the rest, thousands
of random games that add up, and a Skipper - the rival who plays the same daily dice - that averages over 215 and
always scores the same on the same dice. Run it after touching the core.
`test/missile_command.mjs` runs the DOM-free `<script id="core">` block of `games/missile_command.html` (Lights On),
Missile Command over six harbour cities: a burst catches exactly what is inside its radius and nothing a hair beyond,
a chain links only bursts that touch and pays its n-th catch n times, ten shells a bunker with the nearest answering,
impacts take cities and bunkers, the count at a wave's end pays every shell and standing city and relights one per
10,000; forty seeds of twelve waves send the right number of warheads, each at something still standing, and every
wave ends; and bots with a person's reaction time play on a desktop and a phone sky - one who never fires is gone by
wave 3, a careful one outlasts a sloppy one and gets past wave 6. Run it after touching the core.
`test/stack_tower.mjs` runs the DOM-free `<script id="core">` block of `games/stack_tower.html` (Stack Tower), where
the one promise is that the cut is honest: every drop on thousands of random towers is checked against plain interval
arithmetic (the layer is the overlap, the offcut is the rest of the slab and touches it, nothing spills into the other
axis), a drop within the tolerance snaps exactly and one hair outside it cuts, a run of perfects gives width back and never
past the starting size, a long frame moves the slab as far as sixty short ones, and bots with a person's timing error build
higher in order of their skill. Run it after touching the core or the speed curve.

`test/lanternfall.mjs` runs the DOM-free `<script id="core">` block of `games/webcraft.html` (Lanternfall), a voxel world
whose page only draws what the core returns: a seed makes the same world whatever order chunks load in, the mesh holds
exactly the faces a plain reference counts and every one winds outward from a block into open space, rays land on the
cell a brute-force march finds, bodies never end inside a block at 30 to 120 fps, the day is a bit over half light, the
Murk spawn only in the dark and out of torchlight, burn when they stay in it and never touch a player beside a torch
all night while a player in the dark falls, and a save carries on identically. Run it after touching the core.

`test/reversi.mjs` runs the DOM-free `<script id="core">` block of `games/reversi.html`, whose page only animates the events
its core returns: perft against the published Othello counts, every move and flipped cell against a finder written the other
way round, passes and the end of a game, a record that replays move for move, alpha-beta against plain minimax and the endgame
solver against brute force, and three computer opponents that must be ordered by playing strength and never move illegally.
Run it after touching the core, the evaluation or a level.
`test/nonogram.mjs` runs the DOM-free `<script id="core">` block of `games/nonogram.html` (Tesserae), a nonogram whose one promise is that
every picture can be worked out by logic alone: the line solver against listing every way to lay a clue, every picture finished
by line logic with no guess (and, up to 10x10, found to be the only picture those numbers describe by brute force), a tile where
none belongs cracking while a mark on a tile is refused, strokes, saves that trust nothing, the daily panel, and hints that are
always true and, followed alone, solve every picture with no crack. Run it after touching the core or adding a picture.

`test/shatter_field.mjs` runs the DOM-free `<script id="core">` block of `games/asteroids_3d.html` (Shatter Field), a first-person asteroids game
whose page only draws what the core returns: a bolt touches what its swept path crosses at any frame rate and nothing else, a split sends two pieces
apart carrying the parent's momentum, the red warnings name exactly the rocks that would hit (against a brute-force run), the aim assist never bends a
bolt past its cone, score, chain, hull and field rules, a seed deals the same night to everyone, and bots with a person's reflexes must reach deeper
fields in order of skill while a player who never fires is gone by field 3. Run it after touching the core.

`test/checkers.mjs` runs the DOM-free `<script id="core">` block of `games/checkers.html`, whose page only animates the moves
its core returns: perft against the published American-checkers counts, every position of hundreds of random games against a move
generator written the other way round (compulsory jumps, whole chains, a man crowned mid-jump stopping, no piece jumped twice), a record
that replays move for move, the 40-move and threefold-repetition draws, alpha-beta against plain minimax, and three computer opponents
that must be ordered by playing strength and never move illegally. Run it after touching the core, the evaluation or a level.

`test/family_feud.mjs` runs the DOM-free `<script id="core">` block of `games/family_feud.html` (We Asked 100), a survey
game whose promises are that a typed answer is read as a person means it and never as an answer it does not, and that every
survey is fair: every answer and alias in the bank means itself, near-miss spellings and transpositions match while one word of
a two-word answer does not, surveys from the language model are cleaned before they reach a board, the face-off, strikes,
steal and multipliers follow the show's rules on stacked boards, every point of thousands of random matches is accounted for, a
saved match carries on move for move, a day has one board for everyone, and the Hendersons are ordered by skill and beatable.
Run it after touching the bank, the matcher or the rules.

`test/tower_of_hanoi.mjs` runs the DOM-free `<script id="core">` block of `games/tower_of_hanoi.html`, whose two promises nobody can see
from the page: that par is the fewest possible moves (breadth-first search over every position, three to eight discs) and that
Show me, from any position the player has reached, names the first move of a shortest way home. Saves, medals and the
bell for each disc are checked too. Run it after touching the core.

`test/glowtide.mjs` runs the DOM-free `<script id="core">` block of `games/chain_reaction.html` (Glowtide), one tap and a chain of
blooms: a bloom lights exactly what its radius covers (against a reference written the other way round), every ignition is counted
once and in order, every level it deals has a tap that clears the goal while a random tap mostly fails from level 8, a seed deals
the same sea to everyone, lights and stars settle the way the card says, and saves trust nothing (the old page's high score is kept
apart). Run it after touching the spec, the radii or the speeds; `levels` is the one that notices.

`test/catch_circle.mjs` runs the DOM-free `<script id="core">` block of `games/catchcircle.html` (Catch Circle), a tap game whose
promise is that a catch is judged honestly: the disc under the finger wins (against brute force), nothing leaves the field at any frame rate,
an empty ring costs a life while a black disc costs one only if touched, points follow size and the chain multiplier, a seed is the same run,
and bots with a person's pace rank careful above random above idle. Run it after touching the core.

`test/void_runner.mjs` runs the DOM-free `<script id="core">` block of `games/void_runner.html` (Void Runner), an endless
runner whose one promise is that you were given room: every spike, beam, gap and wall the generator deals must be clearable
at the speed it arrives at by a player who acts anywhere inside the window the picture shows - bots acting as early as fair,
as late as fair and at random must all pass 1,800 m on forty seeds - a seed deals the same run to everyone, a press moves the
runner in the frame it is made at any frame rate, points are what the HUD says, and a quick bot outruns a slow one outruns a
button-masher outruns one standing still. Ledges (the high road) must be landable from below, droppable at the far end and never trap
a spike, a full chain earns a shield that smashes exactly one hazard and never saves a fall, and sectors announce once and pay once.
The fairness bots run with the shield off (`noShield`) so a mistake is never forgiven behind the test's back. Run it after touching the
physics, `minStart`, a ledge or a hazard's size.

`test/void.mjs` runs the DOM-free `<script id="core">` block of `games/void.html` (VOID), a black-hole game on one endless plane whose
promises nobody can see from the page: a street is the same street whichever order its cells are asked for, nothing within five sizes of
anything else overlaps (a country, a continent, a glacier or a storm is ground and carries things instead), vehicles stand in the lanes of roads, benches and trees
along footpaths and houses on lots, and the start is clear of every road tier; a thing
falls only if it fits (and never one that does not), the hole grows by exactly the area it ate, the clock pays for big mouthfuls and new
sizes, a bite announces exactly what it has just made swallowable, saves trust nothing; at every size, anywhere, something fits within
reach and something bigger is in sight, and bots with a person's reaction time must be paid in order of their skill (a sloppy one leaves
the first chapter, a casual one reaches the city and the world in three to five minutes, a good one the cosmos, nobody is spared by the clock
for ever). The `page` suite plays the real page in Chromium on a laptop, a phone and with reduced motion, with a real touch drag, and checks that every thing standing
on the screen, up to twelve hole radii, is drawn at every size and wherever the hole is. Run it after
touching a number in the core (`TUNE`), a kind in the catalogue or the page.

`test/backgammon.mjs` runs the DOM-free `<script id="core">` block of `games/backgammon.html`, a board game whose rules have more corners than they look: a second move generator written the other way round (own-side coordinates, every dice order) must agree with the core on every roll of thousands of positions, so the duty to play as many dice as possible, the larger die when only one fits, the bar before anything else and bearing off with a higher die only from the rearmost point are all judged by something that does not share the core's code. Gammons and backgammons score 2 and 3, undo restores a position exactly, a save carries on dice for dice and refuses forged ones, and the computer only ever plays legal moves and is ordered hard, medium, easy, random by playing strength. Run it after touching the core or the evaluation.

`test/two_truths.mjs` runs the DOM-free `<script id="core">` block of `games/two_truths_one_lie.html`, whose one
promise is that a lie can only be found by knowing: the bank of 60 cases is two truths, one lie and a correction each, the lie
lands on each place equally often and is not the longest or shortest statement more often than chance allows, a run climbs
1-1-1-2-2-2-2-3-3-3 and spreads across files, a seed (and a date) is the same run for everyone, cases already seen are dealt last,
saves trust nothing, and what a language model sends back is refused unless it is two truths, one lie and a correction. Run it
after touching `BANK` (every new lie must be about as long as its truths) or the dealing.

`test/fling.mjs` runs the DOM-free `<script id="core">` and `<script id="levels">` blocks of `games/fling.html` (Fling), a slingshot
physics game whose promises are that a level stands until the first bird, that every level can be won, and that the dots show where
the bird goes: stacks stand and sleep, every level is free of overlaps and holds still for six seconds, a throw is the same throw
every time (and a clone carries on move for move), pull, power, abilities, kegs and the score are checked against what the events
paid, the aim dots follow a real flight, and a bot that tries a grid of pulls on a copy of the world must win and earn two stars on
five levels (`bots --all`: all twenty, about three minutes). The `page` suite loads the real page in Chromium on a desktop and a
phone: no console errors through a pointer pull-and-release, and the old page's saved stars carry over. Run it after touching the
physics, a level or a number in the core.

`test/hot_seat.mjs` runs the DOM-free `<script id="core">` block of `games/who_wants_to_be_a_millionaire.html` (Hot Seat), a
fifteen-rung quiz whose promises are money and fairness: a safe rung really is safe and a walk or a miss pays exactly what the ladder
says at every rung, a run holds three questions a tier from easy to hard and repeats nothing while fresh ones remain, a seed is the
same night for everyone, 50:50 never removes the right answer, the room and the friend are right as often as a tier deserves, a
question written by the language model reaches a board only when it is clean and only in a slot not yet reached, a topic the player types is cleaned before the model sees it and a full night about it fills every slot in tier order, and a saved night
carries on move for move. Bots with a person's knowledge must be paid in order of it. Run it after touching the core or the bank.

`test/death_by_ai.mjs` runs the DOM-free `<script id="core">` block of `games/death_by_ai.html`, a theatre of seven deadly
predicaments judged by a language model whose word the page never takes blindly: every scenario's example plan must
survive the offline rules judge (the fallback when no model answers) and every trap word must kill, authored bad plans and a
random-words bot must not get through, a player's text can never act as instructions or write its own ending (injections are
dead whatever the model says), whatever a model returns is cleaned or refused, a day is one evening for everyone and a
streak counts the way the card says. Run it after touching a scenario, the judge or the prompt.

`test/qix.mjs` runs the DOM-free `<script id="core">` block of `games/qix.html` (QIX), where a claim must be honest: every
closing of a stake is checked against a flood fill written separately in the test (what the Qix cannot reach is claimed, and
nothing else), the stake, head, rim, Qix and Sparx stay consistent over thousands of random frames, the line is lost only to a
Qix that really touches it or a fuse that really reaches the player, a stake can be walked back to leave the board exactly as it
was, a seed is the same night for everyone at any frame rate, and bots must be ordered by skill. Run it after touching the core.

`test/simon_says.mjs` runs the DOM-free `<script id="core">` block of `games/simon_says.html` (Simon Says), whose promise is that the sequence is honest: a seed is the same sequence for everyone, a longer one only ever adds to the end of a shorter one, no pad comes up four times running, a press is judged against exactly the pad that was shown, the tempo tightens but never past what a person can follow, saves trust nothing and daily streaks count the way the card says, and bots with a longer memory score higher. Run it after touching the core.

`test/word_rain.mjs` runs the DOM-free `<script id="core">` block of `games/word_rain.html` (Word Rain), a typing incremental: nights of
falling words pay lumen, a constellation of 21 upgrades spends it, helpers type beside the player, and a Dawn lays the upgrades down
for stars. Its promises are that a first letter always picks out one word, that every number on screen is what the rules say, and that
the game cannot be solved by leaving it alone. Every wave on every seed spawns what its spec says and never two live words with the same
first letter; scoring and the multiplier against a separate tally; every lever (wick, rhythm, mercy, bell, gutters, roofs, mend, frost,
blast against brute force, thunder, gilded, charm) moves exactly the number it names; the upgrade tree has real prices, real
requirements and no cycles, and a save that lies is clamped; helpers type at their stated speed, take only what their role says, never
touch frost, blast, thunder, gilded or charm words or the player's own word, and a maxed town with nobody typing still falls before the
first Dawn's depth while a typist beside it goes far beyond, and a fully built town with every ceiling raised still cannot be played for ever; districts, bursts, a seed that deals the same storm at 30 and 120 fps; time
away pays only with helpers, never past the night shift's hours, and a small share of an hour of play; `ladder` plays bots at real typing speeds (the CHI 2018 study of 136 million keystrokes: average 40 to 52 wpm, the fastest 5 % above 80) and wants a 25 wpm night to end in under three and a half minutes in wave 3 to 7, an average typist beaten by wave 7 to 10 inside five minutes, a 100 wpm typist beaten by wave 14, the first wave paying for the first star, and a handful of early stars buying two more waves; and `career` plays the whole game
with a person-paced bot (it buys the cheapest star, starts three waves under its best, ends each night after ten minutes) and wants the
first Dawn at about an hour, later eras no shorter, faster typists sooner but a slow one not shut out. `page` (Playwright's Chromium,
skipped without it) plays a first night with real keys, buys stars, banks a paused night once, greets a Dawn, pays a night away, migrates
the old page's gold and bests, clamps a lying save, erases on Start over, and taps a night out on a phone. Run it after touching the
bank, a wave number, a price, a lever or the page.

`test/emoji_horde.mjs` runs the DOM-free `<script id="core">` block of `games/emoji_horde.html` (Emoji Horde), an incremental in which a
heart beats at the middle of the screen and crowds of bad moods close in. Its promises are that every number is what the rules say and
that the pace is real: a ring hits each face once and in ring order, and a face just inside the reach is hit while one just outside is
not; love gained equals love owed to the dead; a price is paid exactly and refused when short; cards appear at half price; a heartbreak
drops two waves and keeps the love; a Mend (wave 25 and up) adds its seams and takes the rest; time away pays share x rate, capped at
eight hours; saves trust nothing (hostile numbers, a forged cupid count, the old roguelike's progress); a wide screen starts the crowd
further out but it arrives as fast; and bots with a person's habits show that watching goes nowhere, the first boss comes after several
minutes and the first Mend after a quarter to forty minutes of play. The twelve-skill tree (`skills`) is checked for prices, order and
that each skill does what its card says, and `pressure` for the promise that a heart can lose: faces that are hit again and again stop
being shoved, a wave that drags on turns restless, surges, ghosts and a heart that only shoves still falls. `rush` covers calling the next
wave in early: only from wave 6, only with a healthy heart in a live wave and never into or during a boss wave; each face keeps the
strength of its own wave and pays 40% more per wave rushed; a break counts from the wave reached. `wall` plays a rushing, skill-buying bot for an hour: it is past wave 25 in twenty minutes but gains no more than 22 waves in the second half hour and ten in the last quarter, and a bot that mends when stalled gets further. `keeps` covers the ten keepsakes offered after every tantrum: three different ones, one taken, none twice, each doing exactly what its card says (a Spark bursts one kill in eight and never starts another), saves that cannot invent one and a Mend that gives them back. The `page` suite loads the real page in
Chromium on a phone and a desktop (title, Begin, a tap, a purchase, every settings switch and the volume slider remembered, the skill
tree, a swipe through a face, Rush, a reload that says welcome back, reduced motion, a hostile save). Run it after touching a price, a
wave number, a species, a skill or the page.

`test/artillery.mjs` runs the DOM-free `<script id="core">` block of `games/artillery.html` (Artillery), a tank duel whose page only
draws what the core returns: a shell lands where plain ballistics put it at any wind, a blast only lowers ground and hurts by
distance, every hill the generator deals can be shot across with a tank on level ground at either end, a match counts to three and
alternates the shooter, and the computer starts wide, closes in as it walks a shot in and beats a player who aims blindly. Run it
after touching the core or a constant.

`test/rubiks_cube.mjs` runs the DOM-free `<script id="core">` block of `games/rubiks_cube.html`, a cube whose promises are the ones
nobody can see from the page: every turn of faces, slices and half turns against a second simulator that rotates sticker centres with real
cosines (and the published orders, R U = 105 and R U2 D' B D' = 1260), a scramble that is the same for a seed everywhere, never already
solved and, on Easy, never within three turns of solved, a way home (the hint) that really leads home, saves that refuse anything forged,
and the drag geometry: whatever the view, the layer under the finger turns the way the finger moves (against a brute-force search for the
axis). The `page` suite plays a real run in Chromium on a desktop and a phone, a reload mid-run, and the old page's saved bests. Run it after
touching the core or the page's input.

`test/interactive_buddy.mjs` runs the DOM-free `<script id="core">` block of `games/interactive_buddy.html` (Interactive Buddy), a
ragdoll toy with no win state whose promises are the ones nobody can see from the page: thirteen particles that never
stretch, leave the room or hum at rest, a slide that stops, ten tools that do what their pictures say (a bomb pushes away
from itself and not beyond its reach, a rocket burns out, an anvil only hurts what it lands on, the Tesla shakes and never
launches), a best height that is the true peak and ignores a dropped-in buddy or one merely lifted and let go, saves that
trust nothing, and an economy where variety pays, spamming one tool does not, and nothing pays for doing nothing. Bots with
a person's pace buy their first toy inside a minute and all ten inside a sitting. Run it after touching any force, price or payout.

`test/color_flood.mjs` runs the DOM-free `<script id="core">` block of `games/color_flood.html` (Color Flood), a flood-fill puzzle whose
promises are that a move swallows exactly what the rules say and that par is a number someone reached: every move on hundreds of random
boards against a slow fixpoint reference (and its rings against a breadth-first order), undo restoring everything, a seed dealing the same
board with every ink present and never solved at the start, the region-graph lower bound never above the optimum and the exact search
equal to breadth-first search over every position on small boards, the beam search always finishing legally, the forty levels each replaying
their stored solution in exactly par moves (par climbing from 3 to 25, tier on tier), hints that always finish the board, bots (the biggest
bite, a random legal ink) that must be ordered by skill, a daily board that is one board for everyone, saves and the old page's bests that
trust nothing, and share lines that give nothing of the board away. Its `page` suite plays levels on a desktop and a phone in Chromium
(press, tap, undo, keys, reduced motion, a lying save, the old page's data, a shared board and the daily board solved in the worker).
Changing the dealer (`CLUSTER`, `deal`) changes every board: re-generate `VARIANT`, `PAR` and `SOL` in the core. Run it after touching the core.

`test/alphabet.mjs` runs the DOM-free `<script id="core">` block of `games/alphabet.html` (Alphabet Typing Speed), type A to Z against the clock,
whose promises are that the clock is the keys' own and that a board is fair: a run starts on the first right key and stops on the last,
a wrong key costs only the time spent finding the right one and is counted as a slip, splits add up to the time; a Daily board is the same
for everyone on a date, a permutation, never runs on to the next letter of the alphabet and keeps its finger travel on the keyboard the page draws
within a band of the mean (so no day is a lucky one) over three years of dates; the ghost glides at the pace of the best run; every rank
starts exactly where it says on every board and typist bots of four skills land spread across the ladder in order; saves trust nothing (a ghost
that goes backwards or does not end at the time is dropped, a best is replaced only by a faster run, streaks count across month, leap-year and
new-year ends), the history of every finished run (kept newest-last, trimmed, cleaned, with the last ten against the ten before and a best-so-far line that only falls) is what the History view and the results chart draw, and the old page's bests, ghosts, attempts and mute choice carry over. Its `page` suite plays Chromium on a desktop and a phone (real keys,
real taps, Escape, Enter, no scroll, a lying save, no console errors). Run it after touching the core, a threshold or the input handling.

`test/tic_tac_toe.mjs` runs the DOM-free `<script id="core">` block of `games/tic_tac_toe_mp.html` (Margins), where two phones replay one
record string and must agree on the board and the score: the whole classic game tree against a win check written the other way round
(255,168 games, the published counts), the Vanishing rule (three marks each, the oldest goes before the new one is judged), what
`canAppend` lets either phone write on whose turn, and a computer that takes every win in one, blocks every loss in one, never loses a
classic game at full strength and is beaten now and then by a careful player. Run it after touching the core.

`test/fugue.mjs` runs the DOM-free `<script id="core">` block of `games/flappy_bird.html` (Fugue), a Flappy Bird whose one promise is that a death
is the player's own: the same flight at 30, 60 and 120 fps, a hitbox checked against a reference that samples the drawn pipe geometry, and every
course a seed deals flown by an exhaustive search over flap and no flap (so a way through exists on every seed, with slack for a fatter bird and
slower decisions). The course is also a tune - heights are rows of a pentatonic scale, every eighth gap lands on the tonic, later voices repeat the
melody a few pipes late - and the suite checks that the page plays exactly the notes the core names. Bots with human timing noise must be paid in
order of their steadiness. The `page` suite plays the real page in Chromium on a desktop and a phone (tap, pause, the card, retry, shared and daily
courses, a lying save, blocked storage, reduced motion). Run it after touching the core, a constant or the page's input.

`test/suika.mjs` runs the DOM-free `<script id="core">` block of `games/suika.html` (Suika), fruit in a glass jar: a seed drops the
same fruit for everyone, no fruit leaves the jar or sinks into another, a jar left alone comes to rest and a fruit pushed along the
floor stops, crowded drops never launch fruit, every merge makes exactly the next fruit (two watermelons leave) and every point is a
merge, the jar overflows only once a landed fruit has sat over the line for the full countdown, saves trust nothing, each of the old
page's skin bests lands in the jar it became (the five labels share one core), and a careful bot outscores a random one. Run it after touching the physics or a size.

`test/regatta.mjs` runs the DOM-free `<script id="core">` block of `games/typing_game.html` (Regatta), a typing race whose numbers
must be true: a wrong key never moves the boat, wpm, accuracy and place follow exactly from the keys and the clock, every rival rows
at its stated pace and finishes when the result says, a typist at their rating places mid-pack in a close race, the ladder follows a
rower up and down, every passage uses only keys every keyboard has, and saves trust nothing. Run it after touching the core.

`test/fathom.mjs` runs the DOM-free `<script id="core">` block of `games/fathom.html` (Fathom), a typing dive on an engraved chart: live
specimens never share a first letter, a letter goes only to the name it can belong to, every fathom is paid by a finished name at the
chain's rate, hull and flares count the way the HUD shows, a seed is the same dive, every specimen takes the same time to reach the bell
from any bearing on any screen (a desktop, a phone, a phone with its keyboard up), and typist bots from 20 to 95 wpm sink deeper in order
of speed (an average typist reaches the midnight zone but not the hadal). Run it after touching the word list, `tempo`, `reach` or a kind.

`test/fishing.mjs` runs the DOM-free `<script id="core">` block of `games/fishing.html` (Saltline), float fishing in a bay
from dawn to night: every species lives inside the water and turns up at each hour it claims, every hour stocks several depths,
a strike on the plunge hooks while one on a nibble spooks and a late one misses, each bite stays open exactly its species' window,
a careful angler lands the biggest of every species inside a minute while one who reels through every run snaps the strong ones
and one who never reels loses them to slack, a leaping fish held through its leap throws the hook, a person-paced bot gets its first
bite inside half a minute, a seed and the same inputs replay exactly, saves trust nothing and the old page's (PLUMB) log carries
over where its species live here too. Run it after touching `SPECIES`, `TUNE` or the fight.

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
