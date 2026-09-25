# test/

Tests for individual pages. Distinct from `util/`, which is the site-maintenance toolkit
(screenshots, sitemap, sidebar, new entries) — nothing in here changes the site.

Most pages in `games/` and `tools/` do not have tests and do not need them: they are small
enough to check by opening them. A page earns a suite here when it grows past the point
where a person can hold it in their head — when a change to one corner can quietly break
another, and the breakage would not be visible from the page itself.

The homepage has a separate Cypress suite in `cypress/`, kept there because Cypress dictates
its own layout.

## Everything Converter

```sh
npx http-server -p 8099                  # the page needs http, not file://
npm run test:converter                   # or: node test/everything_converter.mjs
node test/everything_converter.mjs graph edges   # one or more named suites
VERBOSE=1 node test/everything_converter.mjs     # print passing assertions too
```

`everything_converter.mjs` drives the real `tools/everything_converter.html` in headless
Chromium rather than unit-testing extracted copies of its code, because the failures that
matter there are the quiet ones — a conversion that returns the wrong file type, a parser
that drops half its input, a route through five steps that could never work.

Eight suites:

| suite | what it checks |
| --- | --- |
| `graph` | duplicate top-level functions, mimes missing from the registry, formats with no producer or consumer, route lengths, terminal edges used mid-chain, and that everyday conversions stay short |
| `detect` | what a dropped file is taken to be — extension first, content only when the extension says nothing |
| `edges` | every declared (converter, input, output) triple against a generated fixture |
| `roundtrip` | convert out and back, and insist the data survives |
| `adversarial` | malformed, empty, unicode and otherwise unkind input |
| `codecs` | the hand-written QR, BMP and TIFF codecs against reference implementations |
| `media` | the ffmpeg engine under failure — crashes, repeated failures, formats that once failed every time |
| `ui` | the real page flows with a hostile file name, merging, and the default target a dropped file gets |

Fixtures are generated at runtime — `everything_converter_fixtures.js` is injected into the
page and builds one sample per format (using the tool's own converters for the formats with
no convenient literal form), and `tiff_fixtures.mjs` writes TIFFs from the spec in every
byte order, photometric interpretation, strip layout and compression the decoder claims to
support. Nothing binary is committed.

Converters that fetch a library from a CDN (ffmpeg.wasm, pdf.js, tesseract, JSZip, mammoth,
js-yaml, marked, xlsx and more) are reported as **skipped, not passed**, when the network is
unavailable. To run them offline anyway, install the same pinned versions and pass
`--mirror`, which answers the page's CDN requests from `node_modules` — the exact files
production loads, with no network:

```sh
npm i --no-save heic2any@0.0.4 json5@2.2.3 pdf-lib@1.17.1 xlsx@0.18.5 js-yaml@4.1.0 \
  jszip@3.10.1 mammoth@1.11.0 marked@15.0.4 msgpack-lite@0.1.26 pdfjs-dist@3.11.174 \
  tesseract.js@5.1.0 turndown@7.2.1 jspdf@2.5.2 @ffmpeg/ffmpeg@0.12.10 \
  @ffmpeg/util@0.12.1 @ffmpeg/core@0.12.10 @tesseract.js-data/eng
node test/everything_converter.mjs --mirror
```

The versions must match the URLs in the page; `cdn_mirror.mjs` lists them and says which it
could not serve. With the libraries available, fixtures that need them are built too — PDF,
spreadsheets, DOCX and every audio and video container — so their converters are exercised
rather than skipped.

`qrcode`, `jsqr`, `utif` and `bmp-js` are optional: the `codecs` suite cross-checks against
them when they are installed and skips those comparisons when they are not.

## Pingu Throw

```sh
npm run test:pingu                       # or: node test/pingu_throw.mjs
node test/pingu_throw.mjs gameplay       # one or more named suites
```

`pingu_throw.mjs` needs no browser and no server. The page is almost all presentation — the
yeti, the penguin, particles, sound, the result card — around a small fixed-step physics core,
and the promise is that none of it touches the throw. So the test runs the page's own inline
script in Node's `vm` against a stub DOM (a canvas context whose every call is a no-op), calls
`requestAnimationFrame` by hand with exact timestamps and presses Space on chosen frames.

| suite | what it checks |
| --- | --- |
| `gameplay` | the stored distance for 21 swings at 60 Hz and 144 Hz, to the centimetre, against a table recorded from the version before the polish (a55e355) |
| `share` | a challenge link, which carries only the height the penguin was struck at, flies the friend's ghost to the same distance; malformed links are ignored |
| `result` | the result card: rank, new-best chip, timing in milliseconds, bounces, and the whiff and no-swing cards |

If a change is meant to alter the physics, the `GOLDEN` table has to be re-recorded on
purpose — that is the point of it.

## Moor Chicken

```sh
npm run test:moorhuhn                    # or: node test/moorhuhn.mjs
node test/moorhuhn.mjs --record          # print a fresh table instead of checking
node test/moorhuhn.mjs --page=old.html   # run against another copy of the page
```

Built like the Pingu Throw suite: the page's inline script runs in Node's `vm` against a stub
DOM, and `requestAnimationFrame` is called by hand. A deterministic bot then plays whole
ninety-second hunts on four seeds. It reads the moor the way a player would (which birds are
in view and where their hit boxes sit), aims at far, near and central birds by turns, knocks
off the scarecrow's hat, shoots windmill blades and the signpost, fires into the sky on
purpose, rides both edges to pan and reloads when dry.

| suite | what it checks |
| --- | --- |
| `hunt` | score, hits, shells and reloads at the whistle, and a hash of the second-by-second trace (score, hits, shells, reloads, birds in the air, pan), against the table |
| `cards` | the results card shows the score and the seed, and the first hunt is stored as the best |
| `aim` | a shot at the back or belly of a far bird that has bobbed off its flight line hits it: the hit box rides the bob the bird is drawn with |

Everything cosmetic on the page (feathers, dust, shells, shake) draws on `Math.random`, never on
the seeded stream, which is what lets a repaint leave the trace alone.

## Minesweeper

```sh
npm run test:minesweeper                 # or: node test/minesweeper.mjs
node test/minesweeper.mjs solver game    # one or more named suites
node test/minesweeper.mjs --page=old.html
```

The page's "No guessing" box promises that every board can be cleared by deduction from the
first click. A board that secretly needs a coin flip looks exactly like one that does not, so
the promise cannot be checked by playing. The page keeps its board, game rules, solver and
generator in a `<script id="core">` block with no DOM; the suite runs that block alone in
Node's `vm`.

| suite | what it checks |
| --- | --- |
| `solver` | on 4,500 random boards the solver never opens a mine or flags a safe cell; it reports a real 50/50 as needing a guess; the subset rule and the mine count each clear a board nothing else would |
| `generate` | exact mine counts, the first click and its neighbours never mined (with and without no-guess), every no-guess board cleared by the solver, a board too dense for no-guess giving up inside its time budget; prints tries and milliseconds per level |
| `game` | the first click never loses, re-clicking an open number changes nothing, flags block opening and do not count toward the win, chording opens the right cells and loses on a wrong flag, and solver-played no-guess games are won exactly when the last safe cell opens |

Each check has been seen failing: a solver that settles a subset difference as mines too
eagerly, a flood fill that reopens open cells, and a deal that spares only the clicked cell.

## Connect Four

```sh
npm run test:connect4                    # or: node test/connect_four.mjs
node test/connect_four.mjs search        # one or more named suites
node test/connect_four.mjs --page=old.html
```

The computer opponent is a search — negamax with alpha-beta, a transposition table, history
ordering and a narrowed window at the root — and every one of those is a way to skip a move
that should have been looked at. A pruning bug does not crash; it plays a slightly worse move,
which nobody can see from the page. The suite takes the AI block (`const AI_LEVELS` through
`function getAIMove()`, which touches no DOM) out of the page, splices a plain minimax beside
it that shares the board and evaluation, and runs both in Node. It takes about 40 seconds.

| suite | what it checks |
| --- | --- |
| `search` | on 400 random positions at depths 1–5 the pruned search returns exactly the minimax score, and the narrowed root finds the same best score and the same set of best moves as a full-window root |
| `tactics` | on 250 random positions, at every difficulty: the answer is a legal column, a win on the board is taken, a single threat is blocked (even when the game is lost anyway), and no move hands over a win that another move would avoid; each level also finds the last empty column |

Each check has been seen failing: swapped transposition-table bounds, move ordering that drops
the last candidate, and a lost position where the computer stopped blocking.

Playing strength is not asserted here, because Hard searches against a clock and its games
are not reproducible. It was measured when the search went in: against a red bot that looks
six moves ahead, Hard went 37–0 with 3 draws over 40 games (the old one-move heuristic lost
39 of 40), and a copy of the search given three seconds a move as red still beats it.

## Downhill Dreamer

```sh
npm run test:downhill                    # or: node test/downhill_dreamer.mjs  (about 30 seconds)
node test/downhill_dreamer.mjs rules guide
node test/downhill_dreamer.mjs --record  # print a fresh golden table instead of checking
node test/downhill_dreamer.mjs --page=old.html
```

The page is a one-button game and everything it promises is feel: that diving into the hills
gets you somewhere, that the landing guide tells the truth, that nobody ever crawls up a hill at
walking pace, that the night wins in the end. None of that shows in a diff, and every number in
the tuning table pulls on all of it at once. The page keeps its terrain, fixed-step flight and
rules in a `<script id="core">` block with no DOM; the suite runs that block alone in Node's
`vm`. Four bots play whole days on fixed seeds, each deciding 60 times a second and acting after
a reaction delay: `idle` never presses, `diver` holds whenever the bird is going down, `reader`
follows the guide ring (ten looks a second, a fifth of a second slow), and `sharp` compares
diving with floating every frame.

| suite | what it checks |
| --- | --- |
| `world` | seeds build the same hills every time; islands start where `islandAt` says and grow longer; no step or cliff at any border out past Dreamland; Dreamland's hills are flatter |
| `rules` | one landing at a time: perfect, great, good, hop and crash by angle; a slide comes out faster, a crash slower but moving; fever on the third slide, super fever on the eighth, a crash ends both; islands, speed milestones and nightfall |
| `guide` | from ~800 moments in the air, the prediction behind the ring (float a reaction time, then dive) and the plain dive and float predictions land within 3% of the real flight, with the same verdict |
| `feel` | each bot's day: the diver still slides more than a quarter of its landings; the reader slides seven in ten and chains a dozen; nobody crawls; skill pays in score, distance and time; the night wins within seven minutes |
| `golden` | the reader's first 90 seconds on three seeds, to the point; re-record on purpose with `--record` |

Each check has been seen failing: no dive tuck (the feel floors fall), a prediction that forgets
the push at an island border (the ring drifts), a border blend too short for Dreamland's hills
(a cliff at island 29), and a fever one slide late.

## Three Gates

```sh
npm run test:towers                       # or: node test/tower_defense.mjs  (about 15 seconds)
node test/tower_defense.mjs rules balance
node test/tower_defense.mjs planner       # opt-in, about two minutes
node test/tower_defense.mjs --page=old.html
```

`games/mini_tower_defense.html` used to be a tower defense nobody could lose: two fully upgraded
towers held sixty waves, gold piled up past twenty thousand, and nothing about any wave asked for
a different answer. The rework rests on three promises a screenshot cannot show - that the card
naming the next wave tells the truth, that different waves need different towers, and that a board
which ignores both eventually falls. The page keeps maps, waves, towers and rules in a
`<script id="core">` block with no DOM; the suite runs that block alone in Node's `vm` and plays
whole games through the same commands the buttons use, one decision every 0.7 game seconds.

Bots: `idle` builds nothing; `pair` is the old page's winning build (one laser, one gun, fully
upgraded); `greedy` is its dominant strategy (guns and lasers 2:1 on the best road cells, never
reading the card); `reader` builds the tower the card names for the coming wave's main threat;
`unread` is the same player building from a fixed rotation instead; `planner` tries every
affordable purchase in a copy of the game and plays each forward to the end of the coming wave;
`blind` is the planner shown a generic wave of the same strength instead of the card.

| suite | what it checks |
| --- | --- |
| `maps` | 300 seeds: three gates opening at waves 1, 7 and 15; routes one cell a step and inside the board; no road touches another or itself except where a side road joins; flyers' lines end at the core; room to build |
| `rules` | armour per hit with a 15% floor; every wave spawns exactly what its card listed, and the card does not depend on how you play; the five-wave introduction and alternating bosses; flyers keep to their line and ground towers never hit them; refunds, early calls, shield and bomb; same seed and play, same game |
| `balance` | twelve seeds per bot: building nothing loses by wave 5; the old two-tower build and the old greedy strategy fall by the mid-teens; the reader beats its blind twin by two waves at the median and four in the worst game, and beats the old build by four; nothing reaches wave 40 |
| `planner` | careful play gets five waves past the reader, still ends, and uses all five towers for at least 5% of its damage; reports, without asserting, what the card is worth to it |

Two mutants have been seen failing the balance suite: the old linear health curve (the reader
survives to wave 61) and a card that always says "grunts" (the reader falls to wave 10, behind
its blind twin). The planner's number is worth knowing: a bot that can price every answer the
instant a wave appears gains almost nothing from the card. The card is for people, who cannot.

## Firefly Jar

```sh
npm run test:firefly                      # or: node test/firefly_jar.mjs  (about 40 seconds)
node test/firefly_jar.mjs rules skill
node test/firefly_jar.mjs pace --report   # the bots' year, night by night
node test/firefly_jar.mjs pace --seed=11  # the same year on another seed
node test/firefly_jar.mjs --page=old.html
```

`games/firefly_jar.html` is an incremental, and an incremental goes wrong in ways no single
screen shows: a season that takes three times as long as the last, two multipliers that feed each
other until one night earns fifty nights' worth, a wall of saving in front of a gate, jars in the
grass that play better than the player. The page keeps its rules, its tree and its economy in a
`<script id="core">` block with no DOM, and the suite runs that block alone in Node's `vm`.

Players look at the meadow every 0.3 s and move the pointer at most 650 px/s on a 390×844 phone
meadow or 1000 px/s on a 1280×800 desktop one; the jar trails the pointer as it does on the page.
Both moving players follow wisp trails, ride the aurora and drop their catch at path stones and,
every other night, into buds; they differ only in which fireflies they go for. `hunter` steers for
the rarer kinds it can reach (glow-worms, blue ghosts, femmes fatales, synchronous clouds), valued
at what they are worth; `sweeper` takes whatever is nearest; `idle` never moves. The shop lights
whatever is cheapest and turns the season once nothing cheaper than the gate is left to buy. A
person is assumed to take about half as long again as the bots.

| suite | what it checks |
| --- | --- |
| `rules` | a dark firefly is caught at once and is worth the same as one caught in its flash; each rarer kind is worth what its page says and the femme fatale eats one firefly from the jar; a glow-worm sits still and never goes dark; a synchronous cloud flashes in unison and is dark most of the time; a brimming jar counts ×1.5; each journal page adds 4%; a full jar catches nothing; the lantern takes the whole jar and dawn takes what is left unless Late Homecoming keeps it; no night is longer than 80 s; turning a season darkens the crown, keeps gates and roots, pays rings and remembers levels, relit lanterns cost a quarter (Old Wood a tenth), Relight restores exactly what burned, Embers starts with 6% of the gate; a finished wisp trail lays a path and what is dropped at its stone arrives home; a bud stores the jar and blooms after three nights; a night replays from its seed |
| `skill` | on both meadows, from early summer to late spring: steering for the rare lights never costs more than 3% and earns at least ×1.12 on average once they are about, sweeping keeps at least 60% of the steerer, and the jars in the grass earn at most 12% of it on their own |
| `pace` | the whole year on both meadows: Summer 11–20 bot minutes, each later season 9–22, the year 60–105; each later season relights the summer lanterns at least three times as fast as the first summer lit them; outside Midsummer no night earns more than four times the one before; Midsummer runs away over at least seven nights and at most ×16 a night; never more than four nights in a row with nothing to light |

The numbers came from a tuner that priced each season in turn, so that a bot has lit all of its
lanterns about three minutes before its target and meets a gate worth about two and a half of its
best nights. Three things the suite caught on the way: paths that multiplied everything by 6.5 and
turned Autumn into a jump, the prestige re-climb running only 1.5× faster than the first summer
(a multiplier on income barely shortens an exponential climb; cheaper relights do), and Keen Eye
widening the glow until hunting it was worth nothing. Version 2 then dropped the bonus for catching
a firefly in its flash altogether (a flash lasts under a second, and people sweep), and moved the
reason to watch the lights to the rarer species, which are told apart by colour and rhythm.
