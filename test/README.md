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
camera, the yeti, the penguin, the tape and the level, particles, sound — around a small
fixed-step physics core in `<script id="core">`, and the promise is that none of it touches the
throw. So the test runs that block in Node's `vm`, feeds it frame times the way the page's
`requestAnimationFrame` loop does, and presses on chosen frames.

| suite | what it checks |
| --- | --- |
| `gameplay` | the distance for 21 swings at 60 Hz and 144 Hz, to the centimetre, against a table recorded from the version before the remake (a55e355); no swing, a whiff and its timing, and that the page's slow motion after a hit moves nothing |
| `ghost` | a ghost — your best, or a friend's challenge link — carries only the height the penguin was struck at, and flown from that alone lands on the same number |
| `page` | the page's own script in a bare window: it saves a throw under the old keys, shows a best the old page saved, reads a friend's link and ignores malformed ones |

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

## Bubble Break

```sh
npm run test:bubble                      # or: node test/bubble_break.mjs  (about five minutes)
node test/bubble_break.mjs sheet rules materials   # named suites only
node test/bubble_break.mjs --page=old.html
```

An incremental is a web of numbers in which every constant pulls on all the others: one cheaper
node, one more second of break time or a bigger sheet can turn a ninety-minute career into
twenty minutes, or a break into one that never ends, and nothing in the diff shows it. The page
keeps its sheets, verbs, trees and economy in a `<script id="core">` block with no DOM; the suite
runs that block alone in Node's `vm`. Its player is limited the way a person is: five taps a
second with a few pixels of aim error, swipes at 1,500 px a second across a sheet drawn 900 px
wide, specials first (sugar before the rest), thick bubbles held, and once it has Cordon tape it
draws loops at the same speed. On fragile wrap it never presses the print and ends a swipe short of
it. Between breaks it buys the cheapest thing it can, and it quits when its callus gain stops growing.

| suite | what it checks |
| --- | --- |
| `sheet` | a circle pops exactly the bubbles whose centres lie inside it (480 circles against brute force), and so does a hand-drawn loop (30 loops); the count of bubbles left matches the bitset after mixed actions; a swipe never pops more than its strength; a press, a swipe and a new sheet at half a million bubbles, and a sheet, a press and a loop at thirty million, stay within a frame's budget |
| `rules` | thick bubbles need a held press; pressing a flat one spoils the combo, swiping over it costs strength; machines leave gold and espresso to the player; espresso never adds more than 75 % of the break; giants take exactly their presses, a swipe counts once, and their shockwave pops; a cleared sheet pays and stops the clock while the next slides in; no forks (the intern buys both sides), Own mug; quitting and the coffee fund's first five breaks; the calluses shown live during a break are what quitting pays, and the next one comes at exactly the Plopps shown (200 mixed states); workplaces promoted by calluses earned and never sold, the next job always at the newest one (an old save's pick of an older one dropped), the world opened by calluses earned in the country; a visit plays one break at another reached workplace with this job's upgrades, counts its bubbles, sheets and time, and leaves the job's Plopps, upgrades, orders and progress untouched; a sugar rush multiplies and holds the combo, and machines leave sugar alone; a zipper opens its row, Cross stitch its column; a closed loop pops its inside and pays triple, an open curve does not; a chain reaction spreads and dies out by itself; Iron thumb; lightning: a press charges it, a full charge sends one bolt of exactly its strikes that pop and charge nothing back, no bolt goes where nothing is left to pop and the charge waits, none on fragile wrap, a bolt pays the combo, Forked lightning branches, Thunderstorm strikes only in a sugar rush, the Tesla coil starts a job with it; a country sheet counts a hundred bubbles to a cell and pops and pays them all; orders, their bonus and who gets which; stickers; a first-version save still loads, gets back the calluses it spent on workplaces and the promotions it has earned, and an order its workplace no longer gives is swapped on load |
| `materials` | special deliveries: none at the desk, jumbo wrap on the second sheet in the warehouse and then one sheet in four, fragile wrap first in the factory, a visit brings only its own workplace's; the first sheet of a new material holds the clock. Jumbo: about 160 giant bubbles at every workplace, the machine off, worth 11 s of the player's usual popping; the first touch only squashes, one stroke never pops what it squashed, and a pop sets off exactly the squashed bubbles connected to it (against a flood fill). Fragile: by fingertip with no machine, no lasso, waves or giants, and the clock at half speed; the print is not in the count and a machine goes round it; pressing it cracks it, pays nothing and ends the combo; an untouched print pays ×4, one crack ×2, more ×1. A small sheet carries a few specials, not the dozens its rates would give. Shrink: warm bubbles pay ×1.5, the heat takes exactly what is left and pays nothing for it, its pace is four fifths of yours on ordinary wrap, between 5 and 40 s. Mastery levels and what each gives, the four new stickers, a save from before deliveries |
| `idle` | a break without touching the wrap earns nothing; a fully built machine earns under 40 % of a player, at the desk and in the city |
| `pacing` | two seeded careers: first quit, warehouse, factory, city, country and world each inside their window, no break's clock past 90 s and fragile wrap's half-speed clock adding at most 20 s, each workplace popping far faster than the last, no job handing over half its break tree after one break, one to four jobs per workplace, orders done along the way |

Each check has been seen failing: bonus time without its cap, flat bubbles that spoil a swipe,
machines that take gold, a swipe that overshoots its strength, a circle a third of a bubble too
wide, a giant counted twice by one swipe, thick bubbles that pop at a
touch, a clock that runs during the slide, a machine that takes gold and giants (87 % of a
player), a start-of-job lump sum worth most of the tree, and a first break stretched to 137 s;
and for the second version: loops paying single, a chain reaction with no cap (181 blasts
waiting), machines taking sugar, a missing cross stitch, loop edges rounded instead of floored,
combos that lapse during a rush, Iron thumb without effect, orders worth nothing, a lost save
migration, loops without Cordon tape, stickers worth double, a zipper that stops at one end, and
an unreachable order kept in an old save; and for the third: a swipe popping what it squashed
itself, a machine cracking the print, a crack that keeps the combo, the wrong print bonus, jumbo
wrap at full strength (the world twelve minutes early), deliveries one sheet too often, the new
material arriving on the first sheet or at a workplace it does not belong to, a heat gun that pays
for what it takes or runs at the player's full pace, a cascade that pops unsquashed bubbles, the
clock running through a new material's first sheet, and the lasso on fragile wrap. Then, after the
first player's notes on it: a small sheet worth a whole ordinary one (six times the pace in the city),
the pace measured on the special sheets themselves, thirty specials on a sheet of 165, and a bot that
tapped thick bubbles with Iron thumb and never held one, which stalled it on fragile wrap for a whole break.
And for the fourth: lightning whose strikes paid no combo, so buying it lost a player money, and a
country whose first break bought two thirds of the tree. After the first player's notes: bolts striking
wrap that was already popped, and lightning cracking the print on fragile wrap.

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
npm run test:firefly                      # or: node test/firefly_jar.mjs  (a few minutes)
node test/firefly_jar.mjs rules sky skill
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
at what they are worth where they are (a coloured beam, a puddle); `sweeper` takes whatever is nearest; `idle` never moves. The shop lights
whatever is cheapest and turns the season once nothing cheaper than the gate is left to buy. A
person is assumed to take about half as long again as the bots.

| suite | what it checks |
| --- | --- |
| `rules` | a dark firefly is caught at once and is worth the same as one caught in its flash; each rarer kind is worth what its page says and the femme fatale eats one firefly from the jar; a glow-worm sits still and never goes dark; a synchronous cloud flashes in unison and is dark most of the time; a brimming jar counts ×1.5; each journal page adds 4%; a full jar catches nothing; the lantern takes the whole jar and dawn takes what is left unless Late Homecoming keeps it; no night is longer than 80 s; turning a season darkens the crown, keeps gates and roots, pays rings and remembers levels, relit lanterns cost a quarter (Old Wood a tenth), Relight restores exactly what burned, Embers starts with 6% of the gate; a finished wisp trail lays a path and what is dropped at its stone arrives home; a bud stores the jar and blooms after three nights; a night replays from its seed |
| `sky` | the first three nights are clear; every season has at least four kinds of night, none more than 45% of them, and always opens under its own sky; the moon runs through eight phases every eight nights; after rain there are 1.3× the fireflies, puddles lie clear of the lantern and a catch over one counts ×2; lightning makes every firefly flash back and doubles catches for a moment; fog lets the jar empty from further away; snow slows the fireflies to 85%; a full moon makes them flash less often and a moonless night brings more; wind drifts them downwind without blowing them off the meadow; no weather earns less than 80% of a clear night; lighting the Milky Way hangs the year's tree in the sky as a constellation, another year keeps the journal and the stars and makes light ×1.5, and an older finished save gets its constellation on load |
| `skill` | on both meadows, from early summer to late spring: steering for the rare lights never costs more than 3% and earns at least ×1.12 on average once they are about, sweeping keeps at least 60% of the steerer, and the jars in the grass earn at most 12% of it on their own |
| `pace` | the whole year on both meadows: Summer 11–20 bot minutes, each later season 9–22, the year 60–105; each later season relights the summer lanterns at least three times as fast as the first summer lit them; outside Midsummer no night earns more than four times the one before; Midsummer runs away over at least seven nights and at most ×16 a night; never more than four nights in a row with nothing to light; on the phone meadow, year two takes 55–85% of year one without any season shorter than five minutes |

The numbers came from a tuner that priced each season in turn, so that a bot has lit all of its
lanterns about three minutes before its target and meets a gate worth about two and a half of its
best nights. Three things the suite caught on the way: paths that multiplied everything by 6.5 and
turned Autumn into a jump, the prestige re-climb running only 1.5× faster than the first summer
(a multiplier on income barely shortens an exponential climb; cheaper relights do), and Keen Eye
widening the glow until hunting it was worth nothing. Version 2 then dropped the bonus for catching
a firefly in its flash altogether (a flash lasts under a second, and people sweep), and moved the
reason to watch the lights to the rarer species, which are told apart by colour and rhythm.
Version 3 added weather and years: rain, storms, three more journal pages and ×1.5 a year made
everything richer, so every season's prices were raised by 15 to 60 percent, most in Midsummer
with its storms and in summer and spring, which see the most rain, until the year took as long as
before.

## Audio Normalizer

```sh
npm run test:normalizer                  # or: node test/audio_normalizer.mjs
node test/audio_normalizer.mjs meter     # one or more named suites
node test/audio_normalizer.mjs --page=old.html
```

The page's promise is a number: pick the Podcast preset and a loudness meter reads -16 LUFS,
with no true peak past -1 dBTP. The page cannot check that itself, because it measures its own
output with the same meter it normalizes by - the version this replaced reported -16.0 to -16.3
on six recordings while ffmpeg's `ebur128` read anywhere from -18.3 to -13.8. The meter, the true-peak scan
and the limiter live in a `<script id="core">` block with no DOM, and the suite runs that block
in Node's `vm` against references that do not come from the page. Programme material is
synthesised from a seed (talkers with pauses and plosives, a bass-heavy groove), since no
recordings are committed. It takes about 7 seconds.

| suite | what it checks |
| --- | --- |
| `meter` | EBU Tech 3341 tests 1–5 within ±0.1 LU at 48 and 44.1 kHz; 997 Hz at 0 dBFS reads -3.01; sines from 20 Hz to 10 kHz read the gain of the 48 kHz K-weighting coefficients printed in BS.1770 within 0.05 dB; 30 s of silence inside the programme and a passage 20 dB down both drop out; surrounds count 1.41×, the LFE not at all; silence, under 400 ms, and everything under -70 LUFS have no loudness |
| `truepeak` | the fast scan agrees with a plain implementation of the Annex 2 interpolator on arrays of awkward lengths with bursts at both ends; a quarter-rate sine at 45° reads 0 dBTP though its samples sit 3 dB lower |
| `limiter` | speech and music driven 3 to 20 dB over stay under -1 dBTP at 44.1 and 48 kHz; audio under the ceiling passes through bit for bit; a lone spike gets exactly the gain it needs, reached by a straight ramp that starts 5 ms ahead; a file that starts loud and one that ends on a burst are both caught |
| `render` | speech and music land within 0.1 LU of -23, -16 and -14 under -1 dBTP; a 0 LUFS target stops short instead of piling on gain; without a ceiling it is a plain gain; a DC offset comes off first |

Each check has been seen failing, by planting the bug back into a copy of the page: the
high-pass Q read as decibels and the missing gate (both in the page this replaced, caught by 12
and 9 checks), a clamp in place of the limiter (25), a ramp that starts from unity at the top
of the file (11), a make-up loop that chases an unreachable target (1), surrounds weighted like
fronts (2), and in-between peaks attributed three samples early (1) or late (10).

## The Crusher and HTML Minify

```sh
npm run test:minifier                    # or: node test/code_minifier.mjs
node test/code_minifier.mjs css sql      # one or more named suites
node test/code_minifier.mjs css --css=node_modules/bootstrap/dist/css/bootstrap.css
node test/code_minifier.mjs --page=old.html --minify-page=old.html
```

A minifier makes one promise: what it hands back does what it was given. A broken result
looks exactly like a working one, so nothing on either page can show whether the promise was
kept. The version of `tools/code_minifier.html` this replaced minified every language but
JavaScript with regular expressions over raw text: Bootstrap came back without its responsive
headings and its form-validation messages, 45 of this site's own 330 pages drew differently
at desktop width once their stylesheets went through it (51 at phone width) and 70 once the
whole page did (72), three Python standard library modules came back as syntax errors, and SQL
strings lost their double spaces.
`tools/minify.html` had the same stylesheet collapse. Both pages keep their minifiers in a
`<script id="core">` block with no DOM; the suite runs those blocks in Node's `vm` and judges
what they return with things that do not come from the pages. It needs Playwright's Chromium,
no server, and takes about two and a half minutes, nearly all of it the `html` suite. Without
python3 or php those suites run their written-out cases only and say what they skipped; with
terser installed (`npm i --no-save terser@5.16.1`) the `html` suite also checks minify.html's
own JavaScript scanner.

| suite | what it checks |
| --- | --- |
| `css` | every `<style>` block on the site (344), through The Crusher with its defaults and with comments kept, and through minify.html: Chromium parses the result to the same rules in the same order, with the same computed value for every declaration (values that use `var()` or `env()`, and custom properties, compared as written, strings exactly); thirty-one sheets that each hold one trap - spaces around `+` in `calc()`, `.form :valid`, `0%` in a custom property, a zero inside `calc()`, `flex: 0px`, strings and no-break spaces, escapes, unquoted `url()`s, `@supports selector()`, a comment between two words, hex in a custom property, nesting - come out meaning the same and written as expected |
| `html` | every page on the site, drawn with scripts off at 1280 and 390 px as written and through each minifier (The Crusher with unquoted attributes on): the same visible text, the same box for every element, the same attributes; written cases for spaces between inline elements, no-break spaces, `<pre>` and `<textarea>`, an element the page's CSS sets to `pre-wrap` or `inline-block`, text beside a `<script>`, JSON-LD and shader blocks, conditional comments, `<img src="a.png"/>` and SVG; with terser, all ~390 inline scripts on the site through minify.html's scanner print the same syntax tree |
| `python` | eight written cases (a `#` in a string, blank lines in a triple-quoted string, a verbose regex, f-string fields holding quotes, the `#!` and encoding lines, string prefixes, a line continuation); with python3, every module of its standard library, minified with each combination of options, has the same `ast.dump` as the original |
| `sql` | ten scripts written out exactly: string contents, a mysqldump (version comments, backslash escapes, a `#` comment), SQL Server's `GO`, `#temp` and `[names]`, `DELIMITER`, psql's `COPY ... FROM stdin` rows and `\commands`, a `$$` body in PL/Python, PostgreSQL's `#>`, SQL*Plus's lone slash, a comment that opens another; with both options off nothing changes |
| `php` | one file with an attribute, a heredoc and a nowdoc, interpolation holding quotes, output outside `<?php`, a comment ending at `?>` and data after `__halt_compiler()`: all kept, comments gone; with php, each combination of options lints, tokenizes to the same tokens and prints the same when run |

Each judge has been seen failing. The replaced page fails 12 of the thirty-one CSS traps, and its
Python, SQL and PHP paths fail 23 of the 39 checks in those suites; deleting the whitespace
between tags, as its HTML path did, is caught on the two pages the suite plants it in; and
minify.html's JavaScript scanner, before template literals inside `${...}` were walked rather
than searched, printed a different tree for one inline script on the site
(`tools/html_template_generator.html`).

## Family Tree Builder

```sh
npm run test:familytree                   # or: node test/family_tree.mjs
node test/family_tree.mjs layout messy    # one or more named suites
node test/family_tree.mjs --page=old.html
```

The page draws a family as rows of generations: partners side by side, a child under the
middle of its two parents. The version this replaced stored a family as a plain graph and laid
it out breadth-first, so a married-in partner came out on their own children's row and a child
could only be given one parent. Entered through its own form, 21 generated families (729 people)
kept 50% of their parent links and put 0 of 347 couples on one row; trees built up from one
person kept 66% and 45%. Whether the new layout holds
for a real family - in-laws with their own parents, second partners, half-siblings, a tree
started from yourself and built upwards - is not something the sample shows, so the page keeps
its family model and layout in a `<script id="core">` block with no DOM and no Cytoscape, and the
suite runs that block alone in Node's `vm`. It takes about three seconds.

| suite | what it checks |
| --- | --- |
| `layout` | 155 generated families of three kinds - four generations of descendants, the same with in-laws' parents and siblings, and a tree built from one person up both sides of their family - plus own trees entered in shuffled order: every parent exactly one row above their child, every couple side by side, no two cards closer than a partner's width; plain descendant trees drawn with no crossing lines, and children on average within three quarters of a card of the middle of their parents; two small families that can be drawn without a crossing and must be (a father's second partner and their son; a couple with four generations of ancestors on both sides); a 500-person tree laid out in under five seconds (it takes about 0.1). Prints crossings per tree and how far off centre children sit for each kind |
| `messy` | what old saves and imports can hold: an empty tree, strangers, two people each the other's parent, a three-cycle, someone partnered with a grandparent or their own child, three parents, self links, links to nobody, a chain of four partners, five partners, duplicates, cousins who marry, someone whose two partners are a generation apart - everyone placed once, nobody overlapping, and the consistent part of the family still in clean generations |
| `links` | what the Link button refuses: linking someone to themselves, a link that exists, a third parent (asked either way round), a partner as the other's parent, a grandchild as a parent or a grandparent as a child, a partner who is already an ancestor; and what it allows |
| `rows` | the "Generations" figure: none for an empty tree, one for one person, the taller of two separate families, and partners' ancestries counted side by side rather than added |

Each check has been seen failing, against copies of the page with one thing broken: partners
not grouped, rows counted from the top only, the pull-down that keeps an in-law's parents above
them removed, no gap between groups, no final centring pass, no reordering, only one starting
order or no turning a group round (the half-brother family then crosses), the cycle or
two-parent refusal missing, and the generation count off by one. One refinement is measured but
not asserted, because it only moves an average: starting from a depth-first order, which takes
own trees from 0.5 crossings a tree to 0.4.

## Frame Extractor and Thumbnail Extractor

```sh
npm run test:frames                       # or: node test/frame_step.mjs
node test/frame_step.mjs step vfr         # one or more named suites
node test/frame_step.mjs --only=frame     # one page: frame or thumbnail
node test/frame_step.mjs --frame-page=old.html --thumbnail-page=old2.html
```

`tools/video_frame_extractor.html` and `tools/video_thumbnail_extractor.html` exist to get one
exact frame out of a video, and a step that lands on the wrong frame looks exactly like one that
lands on the right one. Both pages stepped by adding 1/30 s to `currentTime`: every video that is
not 30 fps stepped wrong, and in WebM, whose frame times are rounded to the millisecond, half of
those exact-boundary seeks landed just before the frame they meant. Both now read the start time
of each frame the video presents (`requestVideoFrameCallback`), learn the frame duration from
those when a video loads, and step to the middle of the neighbouring frame - or, where frames
are not on a regular grid, search seek times for where the picture changes, because a browser
seeking through a recording does not always show a frame from its own start time. Such a video
is labelled "variable frame rate", and its frames by their start times only: a number worked
out from the time would be a guess, and for the uneven recording below one counted 110 frames
in a file that holds 71.

The suite drives both real pages in headless Chromium. It needs Playwright's Chromium and an
ffmpeg that writes VP8 WebM (Playwright's own, installed beside its browsers, is found
automatically; `FFMPEG` names another), no server, and takes about nine minutes. Every clip is
made at run time and carries its own number, in blocks, on every frame, so the suite reads which
frame is on screen and which is in each grab from the pixels: eight clips from ffmpeg (24, 25,
29.97, 30, 50, 60 and 120 fps, and 30 fps starting at 0.5 s) and two recordings made with
MediaRecorder the way a screen recorder makes them, one with uneven gaps and held frames and one
steady, both with no duration in the file. What a recording holds is found by brute force on a
plain `<video>`, seeking every 2 ms.

| suite | what it checks |
| --- | --- |
| `step` | the frame count; 30 presses of next frame show frames 1 to 30 and 10 of previous walk back; six quick presses move six frames; previous on the first frame and next on the last stay put, and the last frame is called by the right number; the frame number shown is the frame on screen |
| `grab` | a grab holds the frame on screen, including the same frame twice and a grab clicked straight after next frame, and is labelled with its number and its start time to the millisecond |
| `slider` | the Frame Extractor's slider runs over the real frames, lands on the frame it names, and a fast drag ends on the frame it was let go at |
| `batch` | extracting every 0.5 s (Frame Extractor) or 1 s (Thumbnail Extractor) takes, for each of those times, the frame a plain `<video>` shows there, each frame once - on every clip and both recordings |
| `vfr` | on both recordings, next frame visits every frame once, in order, and stops at the last; previous walks back through every frame; grabs clicked straight after previous frame hold the frames it lands on, though a step here takes a search; any frame number a page shows is the frame's own |

Every judge has been seen failing. Against the pages this replaced, 30 presses of next frame
stayed put 7, 6, 2, 10, 0, 0, 0 and 10 times, and skipped a frame 0, 0, 1, 9, 19, 20, 30 and 9
times, on the 24, 25, 29.97, 30, 50, 60 and 120 fps clips and the one starting at 0.5 s -
the same on both pages - and next frame stepped over frames in both recordings. Their extraction
every N seconds was already right apart from taking one frame twice, and it still seeks by time.

Knowing which frame a seek showed is the hard part, and it went wrong twice, each time on only
the odd load - one or two in a full run. Taking the first frame presented after setting
`currentTime` let a seek finish during the next one (seen with the suite running beside another
run); waiting for both `seeked` and a presented frame still took the wrong one, because Chromium
can present the frame already on screen once more as a new seek begins (seen on a quiet run). The
pages now count a presented frame as the seek's own once the seek has ended, or before that if it
is a different frame, and accept a repeat of the frame already on screen only when nothing newer
follows. A grab waits behind any step still seeking - without that, a grab clicked straight
after a step through a recording took whatever frame the search was passing. The whole suite
passes idle and with three CPU-bound processes running beside it, and 160 loads of ten clips
measure right either way.

## 2048

```sh
npm run test:2048                        # or: node test/2048.mjs
node test/2048.mjs rules plan            # one or more named suites
node test/2048.mjs bots --games=40       # more bot games (default 16)
```

`2048.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` block of
`games/2048.html` in Node. The page draws every move from the plan the core returns - which
cell each tile slid to, and which two met - so a plan that disagrees with the board draws tiles
that are not there, and a merge rule that is almost right looks right on most moves: the page
this replaced merged `2 2 4` into `8`, on about one move in seventy of ordinary play.

| suite | what it checks |
| --- | --- |
| `rules` | hand cases (`2 2 2 2`, `2 2 4`, `4 2 2`, gaps) and every row of 0 to 32 in all four directions against a plainly written reference; `canMove` against trying all four moves; a move that changes nothing is not a move; a 4 spawns one time in ten, evenly over the empty cells; winning happens once; game over is set exactly when nothing can move |
| `plan` | on 40,000 boards, replaying the plan on the old board gives the new one: every tile moves once, toward the edge, never past another, and a cell reached by two tiles is exactly a listed merge |
| `seed` | a seed and a list of moves always give the same game; a game saved to JSON halfway goes on identically; broken saves are refused |
| `bots` | a random player, a corner habit and a two-move look-ahead play whole games: random never reaches 512, the corner habit beats random, and the look-ahead makes 2048 in at least half its games |

The balance is the original's (a 4 one time in ten) and is not tuned here. The bots show that
the rules play like it. `bots` takes about 25 seconds, most of it the look-ahead.

## Monkeytype Clone

```sh
npm run test:monkeytype                  # or: node test/monkeytype.mjs
node test/monkeytype.mjs input bots      # one or more named suites
```

`monkeytype.mjs` runs the DOM-free `<script id="core">` block of `games/monkeytype.html` in Node.
A typing test makes one promise nobody can check from the page: that the number it shows is
true. The page this replaced counted Shift, Tab and Enter as letters, scored every space as a
word whether the word was right or not, and printed "Typed Characters: 104 (Correct: 120)".

The page feeds the core the whole value of a hidden text field after each edit, not keys - that
is what a phone keyboard sends - so the suites do the same.

| suite | what it checks |
| --- | --- |
| `words` | both word lists are clean and unique; a seed always gives the same words, also while typing; never one word twice in a row; punctuation makes sentences of sensible length that start with a capital; numbers are about one word in eight |
| `input` | the clock starts on the first key; space ends a word and does nothing on an empty one; backspace steps back only into a wrong word; extra letters stop at 20; autocorrect replacing a word, two words in one event, newlines, and composed letters; a timed test ends exactly on time and ignores what comes after |
| `scoring` | a steady 60 wpm typist scores 60 at 15, 30 and 60 seconds, with wpm equal to a hand count; a wrong word earns raw but no wpm; consistency orders even and ragged paces |
| `bots` | six players (beginner to fast, a sloppy one who never fixes a slip, a phone) type 18 tests each: the reported wpm, accuracy and keystrokes equal each bot's own tally, faster bots score higher, and leaving slips in costs wpm; mashing keys and walking away do not count |
| `store` | broken saves load clean; personal bests per test type; tests that do not count cannot set one; practice lists hold each missed word three times, never twice in a row |
| `page` | in Chromium: modifier keys do not start a test, typing a whole test shows the result, keys typed just after the end do not skip it, Tab and Escape restart, config and best are saved, the caret stays in the three visible lines for 80 words; on a phone, a tap focuses the field and whole-value edits, autocorrect and backspace on an empty field behave. Skipped without Playwright |

The bots print a table of pace against score. A typist at 90 wpm with 1.5% slips, all fixed,
scores about 87; one at 80 who leaves 5% of letters wrong scores about 62.

## Hands Up

```sh
npm run test:rps                                   # or: node test/rock_paper_scissors_mp.mjs
node test/rock_paper_scissors_mp.mjs protocol --runs=400
```

`rock_paper_scissors_mp.mjs` runs the DOM-free `<script id="core">` block of
`games/rock_paper_scissors_mp.html` in Node. Two phones write to one shared match and each derives
the score from it; nothing in the match is ever a verdict. The old page stored each choice in the
clear, so either player could read the other's throw before choosing, and it kept score by having
one phone add up rounds - which is how the two screens came to disagree.

Each throw is written as sha256(match/round/seat|throw|nonce), set only if the seat has none yet,
and opened after both are in. A player cannot read a throw early, copy the other seat's seal,
or re-seal after seeing the other hand; a phone that lost its secret forfeits the round.

| suite | what it checks |
| --- | --- |
| `core` | sha256 against `node:crypto` on 3009 strings (block edges, astral characters); the win table; a seal is bound to its seat and round |
| `protocol` | 150 sessions of three matches each between two phones behaving exactly as the page does, under a network that interleaves their writes, delivers snapshots late and loses in-flight writes on reload, with some phones losing their secrets: nothing but a seal is in a round until both are in, both phones agree with the server, and every round, match and head-to-head equals a reference computed from the throws made |
| `cheats` | no reveal while the other has not thrown; the document holds no throw or nonce until then; copying the other seal, re-sealing after the reveal, a reveal that does not match, a phone that throws twice, forfeits and double forfeits; matches end at the target; rematches need both; 3000 malformed documents derive without throwing |
| `page` | in Chromium, against an in-memory stand-in for Firebase: start, invite, join, a sealed throw that survives a reload, the result on both screens, a rematch, a third visitor turned away, an old `#id` link, the match listed on the start screen, and no console errors. Skipped without Playwright |

## Peel & Seek

```sh
npm run test:emoji                          # or: node test/emoji_puzzle_mania.mjs
node test/emoji_puzzle_mania.mjs boards     # one or more named suites
```

`emoji_puzzle_mania.mjs` runs the DOM-free `<script id="core">` block of
`games/emoji_puzzle_mania.html` (Peel & Seek) in Node. The game is a visual search - one emoji on
the stamp, its match somewhere on a sheet of lookalikes - and what can go wrong is invisible on
the page: a decoy that is the target, two copies where the stamp promised one, a turned moon that
now reads as another phase, a tape that grows past its end or runs while paused.

| suite | what it checks |
| --- | --- |
| `boards` | 3,000 boards across twenty rounds: exactly the stated number of targets and no stray one; moons and clocks never turned; no tilting or spinning before its round; a 3×3 shows nine different things; the lookalike share is about a third in round 1 and nearly all by round 11; sheets only grow, 3×3 to 6×6; a target never repeats straight away |
| `clock` | the starter sheet costs nothing and does not run the clock; the flip after a find is not taken from the tape and no tap counts during it; a miss tears off exactly its cost; the tape never passes its maximum; a minute paused changes neither tape nor score; the run ends exactly when the tape is empty |
| `score` | a quick find pays more, at most double; the multiplier rises every third find in a row, to ×6; the score is the sum of the finds; five finds make a round; round 4 is a collector sheet whose copies leave empty spots, and its last copy starts round 5 |
| `seed` | the same seed and taps give the same run; today's sheet differs from tomorrow's |
| `runs` | three bots with a person's search speed (slower per sticker, and slower still on lookalikes and turned stickers, sometimes tapping a lookalike first) play 30 runs each: score and round follow skill, a slow player always reaches the collector sheet, runs last a minute or two, and tapping at random scores far less than looking |

`runs` prints each bot's average round, run length and score, which is the place to look after
changing a number in `SHEETS` or the clock.

## Under the Lamp

```sh
npm run test:mystery                  # or: node test/mystery_ai.mjs
node test/mystery_ai.mjs fair play    # one or more named suites
node test/mystery_ai.mjs --cases=5000 # more cases (default 1500)
```

`mystery_ai.mjs` runs the DOM-free `<script id="core">` block of `games/mystery_ai.html` (Under
the Lamp) in Node. Every case is a truth sheet built from a seed - who was where at the stopped
clock, who lies about it and why, what lies in which room - and a language model only voices it.
The one promise the page cannot show is that each of the 9,000 cases is fair, and a change to one
room, role or line can break that for a handful of seeds without anything looking wrong.

| suite | what it checks |
| --- | --- |
| `build` | a seed always builds the same case; four people with distinct first names, motives, hair colours, coats and opening lines; six distinct rooms; the clock stops between 9:20 and 10:55; every object lies in exactly one room; daily case numbers never repeat within a year |
| `fair` | the trait left at the scene belongs to the two liars and nobody else; the honest two share a true alibi; only the murderer was at the scene; exactly one weapon fits the coroner; every card shown to every person breaks a lie only if it contradicts it, and a broken lie does not break twice |
| `play` | a player who asks everything, searches everything and presents everything breaks both lies, finds every card and is left with exactly one suspect; the accusation offers every weapon and motive once found, and exactly one of the 48 combinations is right; the murderer never volunteers a motive; the rank falls with wrong accusations |
| `text` | no broken or unfilled text in any line, card, room or reconstruction; claim marks come in pairs; typed questions find their topic without the model; what the model is told never names the hidden room, places the murderer at the scene, or gives away the motive before the player has uncovered it |

## Vigil (Breakout)

```sh
npm run test:breakout                    # or: node test/breakout.mjs
node test/breakout.mjs windows physics   # one or more named suites
```

`breakout.mjs` runs the DOM-free `<script id="core">` block of `games/breakout.html` (Vigil) in
Node. The page is Breakout in the window of a ruined abbey: twelve windows of stained glass, a
spark, a gilded bar, candles for lives. What can go wrong does not show on a first look: a pane
tucked behind lead that no spark can reach, a spark that slips into a pane at a seam or out
through the arch, a rally that rattles for minutes without touching glass, a save that comes back
with the wrong panes.

| suite | what it checks |
| --- | --- |
| `windows` | twelve named windows; every pane inside the pointed arch and well above the bar; every breakable pane reachable from open air without crossing lead; no pane lidded with lead above and below; every lantern holding a jewel |
| `physics` | 1,500 seeded sparks in every window with a third of the glass knocked out: never inside a standing pane, never through the arch or a jamb, always at the speed the rules give, never flatter than the least climb |
| `rules` | blows per kind of pane; the aim sways to both sides and no further; the bar sends the spark by where it lands; each pane in a rally counts once more, up to twenty; the bar ends a rally; lead never breaks; a lantern drops the jewel it shows and each jewel does what it says, then wears off; nine sparks at most; candles, the bonus and the extra candle for a window; the second night is faster |
| `save` | a snapshot mid-window comes back pane for pane; missing, broken and empty saves give a whole window |
| `bots` | bots that always reach the spark, reach it quickly, or reach it at a stroll play the whole night: every window cleared, no window over ten minutes, no rally over two and a half minutes without glass, and the steady bot never loses a candle |

`bots` prints each bot's night - windows, minutes, candles lost, longest window, longest dry
rally - which is the place to look after changing a window, a speed or the stall assist.

## Last Words (Hangman)

```sh
npm run test:hangman                     # or: node test/hangman.mjs
node test/hangman.mjs words fair         # one or more named suites
```

`hangman.mjs` runs the DOM-free `<script id="core">` block of `games/hangman.html` (Last Words) in
Node. The page is Hangman on an execution broadside: a woodcut, a word, a type case. The rules are
small; what can go wrong quietly is in the 800 words and the order they come in: a word nobody can
reach from its clue, a daily sheet that repeats or puts the same clue on two days running, a share
line that gives the word away, a streak that miscounts.

| suite | what it checks |
| --- | --- |
| `words` | every clue has thirty words or more and reads after "His last word -"; every word is 4-11 plain letters and belongs to one clue only |
| `rules` | a hit names every slot it fills; a letter tried twice costs nothing; anything but one letter is refused; five marks stand, the sixth hangs; the last letter pardons even at five marks; nothing is taken after the end; the share line gives nothing of the word away |
| `daily` | sheet numbers follow the local calendar day, through clock changes; a sheet is the same for everyone; every fair word comes round once before any repeats; no clue two days running; every sheet 5-10 letters and neither giveaway nor lottery |
| `fair` | no word can be lost by a player who knows every word in its clue; players who know 80%, 50% and 20% of each clue win what they did when the list was made |
| `docket` | the endless docket never gets easier, never repeats a word in forty cases, lets a player in and wears them down |
| `saves` | a half-played sheet comes back exactly; damaged saves are dropped; the old page's games played and won carry over; streaks count consecutive sheets and each sheet once |

`fair` and `docket` print what the simulated players won, which is the place to look after
changing a list.

## Highlight (Word Search)

```sh
npm run test:wordsearch                  # or: node test/word_search.mjs
node test/word_search.mjs puzzles input  # one or more named suites
```

`word_search.mjs` runs the DOM-free `<script id="core">` block of `games/word_search.html`
(Highlight) in Node. Every puzzle there is built from a seed - a numbered book that grows from
8×8 across-and-down to 10×10 in every direction, and one daily grid that is the same for everyone -
and each makes a promise nobody can check by looking: every listed word is in the grid exactly
once and nowhere by accident, and the cells no word uses spell the theme's hidden message in
reading order. A word list that gains a word hidden inside another, a message that happens to
contain a listed word, or a change to the generator can break that for one seed in a thousand.

| suite | what it checks |
| --- | --- |
| `themes` | every word list and message is plain capitals; no word sits inside another, forwards or backwards; no message holds a listed word; every theme fits some grid size |
| `puzzles` | the first 300 book puzzles, a year of dailies and 25 seeds of every theme at every size it fits: each word straight, in an allowed direction, reading exactly once; the leftover cells are exactly the message; the message takes a fair share of the grid; no grid is mostly one direction; the same seed gives the same grid |
| `book` | grids grow and directions arrive in order, backwards last; no theme returns within twelve puzzles and the book uses them all; neighbouring days never share a theme |
| `input` | drags snap to the eight directions, clip at the edge and hold a direction through a wobble; every angle gives a straight run; tap-tap joins two cells; a word reads from either end, part of a word does not |
| `play` | bots find every word through the calls the page makes: the message is dealt in order, never back, whole at the end; touching strokes never share a pen; a guess at the message reads only when it is exactly the part not yet dealt |
| `save` | junk and old saves come back usable; the book never sits behind a solved puzzle; streaks count consecutive days, across the clock change |
## Tells (Rock Paper Scissors)

```sh
npm run test:tells                            # or: node test/rock_paper_scissors.mjs
node test/rock_paper_scissors.mjs fair tells  # one or more named suites
node test/rock_paper_scissors.mjs --matches=1000
```

`rock_paper_scissors.mjs` runs the DOM-free `<script id="core">` block of
`games/rock_paper_scissors.html` (Tells) in Node. The page is rock paper scissors against six
machines, each with one habit to find, and the last, the Oracle, reads the player. The promises a
player cannot check from the table: the machine never sees the throw it is playing against, the
tell card names the habit the machine really has, and what the Oracle says about you is true.
Players here see only what a person at the table sees - the tape, the score and, against Bluff,
the call.

| suite | what it checks |
| --- | --- |
| `rules` | every pairing of throws; forty matches per machine end at exactly five and keep their books; nothing plays after the end; a throw that is not rock, paper or scissors is refused |
| `fair` | three copies of a match that differ only in the player's throw this round get the same machine hand and the same call - the machine commits before it can see yours |
| `tells` | knowing a machine's tell wins 88%+ of matches and shortens them; throwing at random wins 40-60%; each machine keeps its habit well above chance; the count on the tell card equals the count from the tape |
| `ladder` | a player who reads the tape beats the first three machines easily, Bluff and Grudge less often, and loses to the Oracle more often than not |
| `oracle` | a truly random player gets a fair coin; cycling, sticky, rock-heavy and human-like players are read; with saved memory it wins the opening rounds of a new match more often |
| `lines` | every sentence the Oracle says ("After rock, you went paper 3 of 4.") is recounted from the tape and true, and only said on a round its read won; Echo, Spin and Grudge play back exactly the throw they acted on |
| `memory` | junk in the saved Oracle memory is replaced, never trusted; the memory survives JSON; the same memory and seed play the same match |

`ladder` prints how often a tape-reading bot beats each machine, which is the number to watch after
changing how often a machine keeps its habit.

## Squiggle (Doodling)

```sh
npm run test:doodling                    # or: node test/doodling.mjs
node test/doodling.mjs squiggle dots     # one or more named suites
```

`doodling.mjs` runs the DOM-free `<script id="core">` block of `games/doodling.html` (Squiggle) in
Node. The page is a tear-off sketch pad: every day the same squiggle is printed on everyone's sheet
as a dotted line, pens take in the dots they pass over, and torn-off sheets keep every stroke so
they can draw themselves again. What can go wrong quietly is the promise behind all of that - two
phones that print different squiggles on the same day, dots that come back after a reload, a
drawing that does not survive storage, a link that opens someone else's squiggle, yesterday's sheet
thrown away instead of filed.

| suite | what it checks |
| --- | --- |
| `squiggle` | a seed is the same squiggle everywhere; 3000 squiggles stay inside their box on tall and wide sheets, cross themselves at most twice, turn enough, are big enough and evenly sampled; share codes come back as the same seed and malformed ones are refused |
| `days` | day numbers follow the local calendar for two years, through clock changes, and agree with their dates; ten years of days never repeat a seed |
| `dots` | dots are evenly spaced and never pile up where the line crosses itself; printing dot by dot ends on the dots shown afterwards; a traced squiggle is taken in, a far stroke takes nothing, the eraser rubs dots out; dots taken while drawing equal the dots taken after a reload |
| `pen` | the brush pen thins with speed and widens with stylus pressure; every pen keeps a sensible width; the same hand gives the same stroke; a tap leaves a dot |
| `codec` | 200 random sheets, off-sheet points included, come back from storage exactly at a few bytes a point; damaged data is refused |
| `sheets` | the first visit, the same day, a new day with and without ink, tearing, extra sheets, undo and redo, taking a sheet back out of the sketchbook, removing and restoring, and links to a squiggle |
| `saves` | a packed sheet unpacks to the same sheet without what undo kept |

## Prickle Patch (Whac-a-Hedgehog)

```sh
npm run test:whac                  # or: node test/whac.mjs
node test/whac.mjs rules bots      # one or more named suites
```

`whac.mjs` runs the DOM-free `<script id="core">` block of `games/whac.html` (Prickle Patch) in
Node. Hedgehogs come up out of nine burrows over one sunset; a boop on the nose scores, a wasp
touched burns four seconds of sun, an apple buys two back. What goes wrong here does not show on a
first look: a burrow holding two things at once, a wasp that is safe to tap, a miss that leaves the
streak counting, an evening tuned so that drumming every burrow beats playing.

| suite | what it checks |
| --- | --- |
| `rules` | duds, boops (quick and slow), five pips to a step of multiplier and its cap, a miss and the grace at the end of a tuck, a sting's cost and its floor at zero, a wasp left alone costing nothing, an apple's gift and its ceiling, nothing tappable after nightfall, the ranks |
| `evening` | 200 seeded rounds: one thing per burrow, every arrival warned, wasps one at a time before dusk, never more burrows busy than the cap, the garden never empty for long, every round exactly as long as the sun; the tempo quickening but never past what a person can see; the first round's three hedgehogs and lone wasp; a wasp within 8 s of every later round; a seed always the same evening |
| `bots` | quick, average and slow bots with one finger and a person's reaction time: the quicker scores clearly more and misses less, the slow still boops a dozen, the ranks fall between them; a spammer drumming all nine burrows scores less than half an average player and is stung out of his evening |

`bots` prints each bot's average round - score, boops, misses, stings, rank - which is the place to
look after changing a number in `tempo`, a price or the ranks.

## Blackjack

```sh
npm run test:blackjack                   # or: node test/blackjack.mjs
node test/blackjack.mjs rules money      # one or more named suites
node test/blackjack.mjs bots --rounds=4e6
```

`blackjack.mjs` runs the DOM-free `<script id="core">` block of `games/blackjack.html` in Node:
the shoe, hand values, the round as a state machine that answers every move with events for the
page to animate, settlement, and the book (basic strategy). A table that pays 3:2 on split aces,
lets the dealer hit a soft 17, never peeks under an ace, or loses fifty cents on an insured
natural looks exactly like a correct one on the page.

| suite | what it checks |
| --- | --- |
| `values` | hard and soft totals, several aces, naturals; every two-card total against a count written out by hand |
| `shoe` | six full decks, the cut card between 72% and 80%, a seed always making the same shoe, and a new shoe only ever at the deal after the cut card came out |
| `rules` | stacked shoes, hand by hand: a natural paid 3:2 at once; the dealer peeks under an ace or a ten and takes only the first bet; insurance pays 2:1 and even money pays one bet whatever the hole card; the dealer stands on soft 17 and draws on soft 16; no dealer draw when every hand is bust; double, surrender and their limits; split and resplit to four hands, double after split, split aces with one card each and 21 paid 1:1; nothing offered that the bank cannot pay for; illegal moves and bets refused |
| `money` | 200,000 rounds of random legal moves and bets: every dollar staked is paid back or kept, every payout matches a settlement worked out separately from the final cards, the bank never goes negative, the dealer always stops at 17 and never before |
| `book` | the strategy chart, every cell of hard, soft and pair hands against every upcard, compared with the published chart for these rules, and the fallbacks when a double or surrender is not allowed |
| `bots` | the book plays 800,000 hands and must lose what these rules put the house edge at (about 0.36%); mimicking the dealer loses about 5.5%; standing on every 12 does clearly worse than the book |

The `bots` suite prints each bot's edge with its standard error; it is the place to look after
changing a rule. It takes about half a minute.

## Boogie Woogie (Blockdrop)

```sh
npm run test:blockdrop                   # or: node test/blockdrop.mjs
node test/blockdrop.mjs srs spin         # one or more named suites
node test/blockdrop.mjs bots --games=8   # more Marathon games for the bot (default 4)
```

`blockdrop.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/blockdrop.html` in Node's `vm`: the rules of a modern falling-block game, around which the
page only draws and plays music. Almost everything that can go wrong there still looks right on the
screen - a kick with one sign flipped turns pieces correctly nearly everywhere, a T-spin that counts
as a mini, a back-to-back that never ends - so each rule is checked against something written here
rather than read from the page.

| suite | what it checks |
| --- | --- |
| `srs` | spawn columns, and every turn on 6,000 random boards against a reference that rotates about a true centre and nudges by the guideline's offset tables (not the kick tables the page uses), kick for kick |
| `spin` | the T-spin double and the mini every player learns, a slid-in T scoring as a plain double, and every T locked in random play judged by a plain three-corner rule |
| `score` | every point of hundreds of random and bot games against a scorer written from the guideline table: lines, spins, back-to-back, combos, all clears, soft and hard drops |
| `bag` | each bag of seven holds each piece once, seeds deal the same pieces, the daily seed is fixed by the date, shuffles are fair |
| `timing` | gravity per level, the lock delay and its fifteen resets, a new lowest row restoring them, the clear delay and a turn buffered during it, the daily's two minutes, a block-out |
| `bots` | a bot plays Marathon: every lock adds four cells and every cleared row takes ten, a save made at any moment plays on identically, and it reaches level 15 |
| `auto` | `sink` and `clone`, and the band's own player from Watch (`<script id="auto">`): every key it plans is legal, each plan ends in its one drop and fits in a bar and a half, three 500-piece games never top out, and at least 35% of rows go four at a time (`--pieces=N` for longer games) |

## Last Smile

```sh
npm run test:lastsmile                   # or: node test/last_smile.mjs
node test/last_smile.mjs offers night    # the fast suites (about 15 s)
```

`last_smile.mjs` runs the DOM-free `<script id="core">` block of `games/emoji_horde_survival.html`
in Node, with no browser or server. The page only draws what that block decides, so everything a
player could lose without seeing why lives there.

| suite | what it checks |
| --- | --- |
| `offers` | 18,000 level-ups chosen at random: no duplicate card, no gift past level 5, no fifth gift or charm, no evolved gift offered again; an evolution offered exactly when its gift is at 5 and its partner charm is owned; a finished build gets a cookie; two levels at once give two offers |
| `night` | the same seed and inputs give the same night; every ring, stream and storm arrives when the schedule says, bosses carry names, the horde stays near its cap; lightning warns, then hurts inside its ring and not outside; nothing moves while a card is up; sunrise cheers every face left, nearest first |
| `bots` | whole nights at 60 steps a second (about 90 s): standing still loses, though never inside 15 s, a careful kiter sees the sunrise and evolves a gift, reaches level 10 inside three minutes and its first level inside 20 s; a kiter who picks cards at random still lasts past the first storm |

## Tumbler (Guess the Number)

```sh
npm run test:tumbler                     # or: node test/number_guess.mjs
node test/number_guess.mjs rules bots    # one or more named suites
```

`number_guess.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/number_guess.html` in Node's `vm`. Tumbler is guess-the-number as a heist: each safe hides a
number, every guess spends a lockpick, the safe answers higher or lower, and picks left over carry into
the next, bigger safe. Nothing on the page can show that a safe told the truth, that a pick went missing
between safes, or that the daily is the same on every phone, so those are checked here.

| suite | what it checks |
| --- | --- |
| `rules` | 300 heists of random guesses: every answer against the combination, the window never losing it, one pick per wrong guess, the next safe's picks paid exactly, an empty roll ending the heist with the secret; guesses already ruled out refused for free; saves taken at any moment playing on identically; the share line holding a square per safe and no combination |
| `safes` | every combination inside its safe, fixed by the seed, spread evenly; the first four safes always open for a player who halves, and later ones do not without a spare pick or luck; `certain()` true exactly when halving cannot fail |
| `bots` | 3,000 heists each by a careful player who halves, a sloppy one and a novice: every heist ends, a careful one opens ten to sixteen safes at the median and always gets past the fourth, and better play goes further |

The `bots` suite prints how many safes each player opened; it is the place to look after changing a
safe's size or the picks it brings.

## Six Digits (Color Guessing Game)

```sh
npm run test:sixdigits                   # or: node test/color_guessing_game.mjs
node test/color_guessing_game.mjs colour notes   # one or more named suites
```

`color_guessing_game.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/color_guessing_game.html` in Node's `vm`. Six Digits gives five hex codes a day; the player mixes
each one by eye on three bars (hue, vividness, lightness) and stamps it, and the page says how close
they came and which way each bar was off. Nothing on the page can show that the colour difference is
the real CIEDE2000, that a tick sits where the target is, or that "too dark" was said of a mix that
really was too dark, so those are checked here.

| suite | what it checks |
| --- | --- |
| `colour` | CIEDE2000 against 33 of Sharma, Wu & Dalal's published pairs and both ways round; Lab of white, black and sRGB red; 40,000 colours surviving hex -> HSL -> hex, so the bars can reach every target |
| `score` | ten for an invisible difference, five at dE 10, never rising as the difference grows, one decimal place |
| `sheet` | 1,500 days: the same sheet twice, five distinct hex targets at least 25 degrees of hue apart, a dark-to-light spread, starting mixes 90 degrees or more from their targets, near-greys now and then; day numbers and leap years |
| `notes` | 50,000 mixes: every word under every bar matches the mix's real offset; knobs set on the ticks score 10; a violet mix for a blue target is "too violet" |
| `record` | stamps only in order and only once, five to a day; streaks across days, half-played days and gaps; damaged saves; the habit named on the sheet is what the bars said; the share line gives away no colour |
| `bots` | 600 days each by a perfect, careful, sloppy and random player: 50, about 43, about 25, about 5, in that order |

The `bots` suite prints the median sheet for each player; it is the place to look after changing the
score curve.

## point & line (Dodge the Obstacles)

```sh
npm run test:pointline                   # or: node test/obstacle_dodge.mjs
node test/obstacle_dodge.mjs geometry fair   # one or more named suites
SEEDS=8 node test/obstacle_dodge.mjs bots    # more runs per sheet (default 3)
```

`obstacle_dodge.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/obstacle_dodge.html` in Node's `vm`. point & line is a dodge game on a printed sheet: shapes wait
in the bleed outside the trim as a halftone, then cross it, and the player's pink mark must not touch
them. The page draws exactly the geometry the core judges, so a shape that kills before it was shown,
or a line whose gap the point cannot fit, would look like the player's fault - those are checked here.

| suite | what it checks |
| --- | --- |
| `geometry` | 4,480 distances to rotated squares, triangles and circles against brute force on a half-unit grid; lines are two bars and a clear gap, upright or flat; a triangle's first corner is its tip |
| `fair` | 48 seeded runs on a portrait and a landscape sheet, played through every hit: no waiting shape reaches into the trim, every one waits its full warning, nothing hits before that, every line's gap fits the point with room to spare, every triangle darts along the angle it locked on, circles bounce exactly as often as they were given and then leave, every stage starts on its second |
| `rules` | the shapes that come, and when, are the seed's alone whatever the player does; a run replays exactly; a point flung across a square as fast as it moves is caught; passing close grazes a shape once and touching it ends the run, naming what did it |
| `bots` | per sheet, runs by a player who stands still, one who moves without looking, and planners with a person's reaction time: the first two lose within two stages, both planners outlast them by far and reach the black lines |

The `bots` suite prints the median seconds for each player; it is the place to look after changing a
spawn rate, a speed or a warning.

## Crazy Eights

```sh
npm run test:crazyeights                 # or: node test/crazy_eights.mjs
node test/crazy_eights.mjs rules voids   # one or more named suites
node test/crazy_eights.mjs --matches=4000   # more simulated matches (default 1500)
```

`crazy_eights.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/crazy_eights.html` in Node's `vm`. The page lifts only the cards the rules allow, and marks an opponent
"out of" a suit once they draw instead of following it; a rule that is slightly off, or a mark that outlives the card
that broke it, would look exactly like a right one on the page.

| suite | what it checks |
| --- | --- |
| `deal` | 400 deals: five each from the dealer's left, 52 cards, an eight never the starter, the same seed dealing the same hands, the deal moving round |
| `rules` | stacked hands: suit, rank and eights; an eight's named suit counts, not its own; no drawing while a card fits; a drawn card that fits must be played; the pile reshuffled under its top card; passing when nothing is left |
| `score` | card values, the hand that went out paying nothing, the match ending at 100 with the lowest total winning, ties shared |
| `play` | whole matches by the computer players (and a random player in seat 0): every move legal, all 52 cards somewhere after every move, every match ending, blocked hands rare |
| `voids` | every crossed-out suit on every seat at every moment is true of that seat's hand; the next card drawn clears it |
| `save` | a match saved and loaded at any moment carries on move for move |
| `skill` | the computer players pay less per hand than a random player and beat it at matches |

## Departures (Time Travel Agency)

```sh
npm run test:departures                    # or: node test/time_travel_agency.mjs
node test/time_travel_agency.mjs price away  # one or more named suites
node test/time_travel_agency.mjs pace --report   # each bot's game, five minutes at a time
```

`time_travel_agency.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/time_travel_agency.html` in Node's `vm`. The board only draws what the core says - a coupon's price, a fare,
the "a second" figure, what the away stub pays - so a core that is slightly wrong looks exactly like a right one.

| suite | what it checks |
| --- | --- |
| `price` | a bulk buy costs the sum of the single cars it replaces; MAX buys the most that is affordable and not one more, even with exactly the price in the till |
| `rules` | lines open in order, nothing on credit, guides only on open lines, a busy train cannot be sent twice, the three classes need a guide and each triples the fares, the Big Bang is sold once and arrives on time |
| `tick` | one long frame pays what 60fps frames pay, a manual train pays once, every milestone halves the trip, a guided line earns its "a second" figure |
| `away` | time away pays what the same time on the board pays, capped at a day; nothing is earned without a guide |
| `save` | a game saved at any moment carries on exactly; broken and hostile saves are refused or cleaned |
| `migrate` | the old page's `timeTravelAgency` save opens the lines its player had reached, never the Big Bang |
| `pace` | attentive, steady and casual bots reach the Big Bang inside their windows, each line after the last, the first guide within minutes |
| `fmt` | numbers read the way the flaps print them |

## Moodswing

```sh
npm run test:moodswing                       # or: node test/emoji_match_three.mjs
node test/emoji_match_three.mjs rules events # one or more named suites
node test/emoji_match_three.mjs levels --full   # every level, 24 attempts each (slow)
```

`emoji_match_three.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/emoji_match_three.html` in Node's `vm`. The page draws nothing it decides itself: it plays back the swap,
clear, fall, shuffle and payout events the core returns. A rule that is slightly off, or an event that moves a piece
the core did not, would show as a glitch nobody can reproduce.

| suite | what it checks |
| --- | --- |
| `deal` | every level's opening board for three attempts: no line already made, at least three moves open, holes empty, each cloud where a line can cross it both ways, the cloud goal counting every layer, star marks rising |
| `rules` | stacked boards: three, four across and down, five, L and T and where each special is born; what a striped piece, a burst and a ring clear; every pairing of specials; refused swaps change nothing; goals count specials too |
| `clouds` | one layer off per clear, a storm turning into a white cloud, the goal counting layers |
| `events` | random games replayed from their events alone end on exactly the core's board, after every move and after the payout |
| `play` | thousands of random moves: one move spent each, the board full, no piece in two places, no line left standing, a move always open, the score and goals only moving one way |
| `save` | a game saved as JSON mid-level carries on move for move |
| `finale` | every move left is paid out, and the board is left with no special and no line |
| `levels` | a bot that plays the best move it sees 85% of the time wins each level about as often as the `TABLE` was measured for, and level 1 is won even by mostly random play |

The `TABLE` in the core holds, per level, a variant, the moves and the bot's median score at the win; the star marks
come from that score. After changing a rule or a price, re-measure it before trusting the levels.

## Bedtime (Lights Out)

```sh
npm run test:bedtime                 # or: node test/lights_out.mjs
node test/lights_out.mjs solver      # one or more named suites
```

`lights_out.mjs` needs no browser and no server. It runs the DOM-free `<script id="core">` of
`games/lights_out.html` in Node's `vm`. The page's one promise is the par beside each block: a solver that is
almost right gives a par one too high on a few boards, and nobody playing could tell.

| suite | what it checks |
| --- | --- |
| `solver` | the GF(2) solver against brute force over every press subset, on every outline (rect, door, gable, tower, wings, stepped): fewest presses on every reachable board, `null` on every unreachable one; 5x5 solutions always clear the board |
| `levels` | 120 levels: the same twice, clearable, par as designed and equal to the true minimum, no light in a wall, blocks never shrinking; level 1 is one press in the middle |
| `tonight` | 400 nights: the same everywhere, clearable at par, at least four outlines; the next day across clock changes and leap days |
| `record` | three moons at par, two within two, one beyond, a hint capping at two; a streak grows by one a night, counts a night once and restarts after a gap |
## Reversi

```sh
npm run test:reversi                 # or: node test/reversi.mjs
node test/reversi.mjs rules search   # named suites only
node test/reversi.mjs --games=60     # more simulated games
```

`reversi.mjs` runs the DOM-free `<script id="core">` block of `games/reversi.html` in Node: the rules, the record of a game
and the three computer opponents. The page only animates what the core returns, so a flip rule that is slightly off looks
right on screen and plays wrong. The `skill` suite plays whole games and takes about a minute; the others take a second.

| suite | what it checks |
|---|---|
| `rules` | perft 1 to 7 against the published Othello counts (4, 12, 56, 244, 1396, 8200, 55092); 300 random games in which every legal move and every flipped cell matches a finder written the other way round, each animation line runs outward from the stone, a pass keeps the turn with the side that can move, a game ends only when neither can |
| `record` | a game is its list of moves: replaying it, or any prefix of it, gives the board seen at that moment; an illegal move changes nothing |
| `search` | alpha-beta returns exactly what plain minimax does on 40 positions; the endgame solver returns the true final margin (empty squares to the winner) |
| `skill` | no opponent ever plays an illegal move; each beats a random mover; Regular beats Apprentice and Waterman beats Regular |

## Ludo

```sh
npm run test:ludo                 # or: node test/ludo.mjs
node test/ludo.mjs rules play     # named suites only
node test/ludo.mjs --games=3000   # more simulated games
```

`ludo.mjs` runs the DOM-free `<script id="core">` block of `games/ludo.html` in Node. The page only animates the
moves the core returns, so a wrong rule looks exactly like a right one on screen.

| suite | what it checks |
|---|---|
| `board` | 52 distinct track squares a step apart, each lane off the track and entered from the square beside it, the same board seen from every seat |
| `rules` | stacked positions: a six to leave, the exact roll home, captures (two at once too), none on starts or stars, bonus rolls, three sixes, empty seats skipped |
| `play` | whole games with two, three and four seats: legal moves only, every pawn always somewhere, two colours only on safe squares, every game ends |
| `save` | a game copied through JSON at any moment carries on identically |
| `skill` | the computer player beats a player who moves any legal pawn at random |

## Patience (Solitaire)

```sh
npm run test:patience                 # or: node test/solitaire.mjs
node test/solitaire.mjs rules seeds   # named suites only
node test/solitaire.mjs --seeds=all   # re-solve every listed deal, not a sample (slow)
node test/solitaire.mjs --relist=3000 # make the page's lists of winnable deals again
```

`solitaire.mjs` runs the DOM-free `<script id="core">` block of `games/solitaire.html` in Node. The page deals only
seeds its own solver has cleared, stored as one bit mask per draw size; deal number n is the n-th set bit. A change to
the deal or the solver silently breaks that promise, so re-list with `--relist` and paste the two lines into the page.

| suite | what it checks |
|---|---|
| `deal` | columns of one to seven with only the last card up, 24 in the stock, 52 distinct cards, same seed same deal |
| `rules` | stacked positions: alternate colours, kings to empty columns, suits home from the ace, nothing from under a face-down card, draw one and three, recycling |
| `play` | thousands of random games: every offered move legal, apply never touches its input, every card always somewhere |
| `tap` | a tapped card goes home first, else somewhere legal, and is refused only when there is nowhere at all |
| `seeds` | the masks decode in order, and a sample of listed deals is solved and replayed move by move to a win |
| `hint` | every hint legal; a hint marked sure leads on to a win |
| `finish` | a table with nothing hidden always finishes by sending the lowest card home |

## Yacht (Yahtzee)

```sh
npm run test:yahtzee                  # or: node test/yahtzee.mjs
node test/yahtzee.mjs scoring joker   # named suites only
node test/yahtzee.mjs skipper --games=30
```

`yahtzee.mjs` runs the DOM-free `<script id="core">` block of `games/yahtzee.html` in Node. The card is the game:
a box that pays wrong on one roll in a thousand, or an extra Yacht let into the wrong box, looks right on screen.

| suite | what it checks |
|---|---|
| `scoring` | all 13 boxes on all 7776 rolls against rules written the other way round, the textbook pattern counts, the 63 bonus line, the 1575 ceiling |
| `joker` | where an extra Yacht may go and what it pays, the +100 only after a 50, `score()` refusing a forbidden box |
| `dice` | seeded faces equally likely, the same everywhere, and a kept die never changing what the others become |
| `games` | 2000 random games fill thirteen boxes, score what the preview showed and add up |
| `skipper` | the computer rival averages 215 or more and scores the same on the same dice, so a daily result is fair (slow, about 3s a game) |

## Lights On (Missile Command)

```sh
npm run test:missile                  # or: node test/missile_command.mjs
node test/missile_command.mjs rules   # named suites only
```

`missile_command.mjs` runs the DOM-free `<script id="core">` block of `games/missile_command.html` in Node, on the
geometry the page hands it for a desktop and for a phone. A burst that misses what it visibly touches, a chain that
pays the wrong amount or a wave that never ends all look fine on a screenshot.

| suite | what it checks |
|---|---|
| `rules` | a burst catches inside its radius only, chains count 1,2,3,4 and pay n times the n-th, no chain across empty sky, ten shells a bunker with the nearest answering, A/S/D picks a bunker, no burst in the streets, impacts take cities and bunkers, the last city ends the run, the count, a city relit per 10,000, the multiplier table |
| `waves` | forty seeds of twelve waves on both skies: the right number of warheads, each aimed at something standing, no splitters before wave 3, every wave ends; fall time does not depend on angle; same seed and taps, same game |
| `bots` | players with a person's reaction time: one who never fires is gone by wave 3, a careful one outlasts a sloppy one, gets past wave 6 and sees chains of three |

## Checkers

```sh
npm run test:checkers                    # or: node test/checkers.mjs
node test/checkers.mjs rules search      # named suites only
node test/checkers.mjs --games=20        # more simulated games (default 10)
```

`checkers.mjs` runs the DOM-free `<script id="core">` block of `games/checkers.html` in Node (no server, no browser): the page
only animates the moves its core returns, so a jump rule that is slightly off looks right on screen and plays wrong.

| suite | what it checks |
|---|---|
| `rules` | perft 1-7 from the start (7, 49, 302, 1469, 7361, 36768, 179740); every position of 150 random games gives the same moves as a generator written the other way round; compulsory jumps, whole chains, crowning ends a chain, kings jump backwards and loop, no piece is jumped twice; a blocked side or one with no pieces loses |
| `record` | a game is its list of moves: replaying gives the same board, turn and draw count; an illegal move is refused; the same position three times and forty moves without a jump or a man moving are draws |
| `search` | alpha-beta returns what plain minimax does; every level takes a last piece; the strong level crowns a free man |
| `skill` | every computer move is legal; hard beats easy, medium beats easy, hard does not lose to medium |

## Tesserae (Nonogram)

```sh
npm run test:nonogram                  # or: node test/nonogram.mjs
node test/nonogram.mjs lines pictures  # named suites only
```

`nonogram.mjs` runs the DOM-free `<script id="core">` block of `games/nonogram.html` in Node: the line solver, the pictures, the
rules of laying and marking, hints and saves. A nonogram that needs a guess, or has two answers, looks exactly like a good one,
so the pictures are held to the promise rather than the page. The whole suite takes about a second.

| suite | what it checks |
|---|---|
| `lines` | the one-line solver against listing every way to lay the clue, on thousands of random lines of 1-9 cells with random cells shown, including lines that contradict themselves; and the brute-force counter used below sees two pictures where a 2x2 has two |
| `pictures` | every picture: its own id and name, the size of its set, a glaze for every tile, no clue longer than five numbers (it must fit a phone), finished by line logic alone and on the picture itself, and up to 10x10 the only picture its numbers describe |
| `play` | a wrong tile cracks and becomes a mark, a mark on a tile is refused, both cost a crack; finishing a line reports it once and marks its leftovers; stroke modes and spans; random play can never leave a wrong tile or a mark on a tile, and `solved` is reported exactly when the last tile lands |
| `hints` | every hint is true, a `full` hint really is full, and following hints alone solves every picture with no crack |
| `saves` | a save comes back cell for cell, a forged save keeps only what is true, the daily panel is the same everywhere and prefers unsolved ones, the clock and Roman numerals |

## Shatter Field

```sh
npm run test:shatter                     # or: node test/shatter_field.mjs
node test/shatter_field.mjs hits warn    # named suites only
```

`shatter_field.mjs` runs the DOM-free `<script id="core">` block of `games/asteroids_3d.html` in Node (no server, no browser). Suites: `hits` (swept
bolt against brute force, no tunnelling at 15-240 fps), `split` (two pieces, one size down, parent's momentum kept), `warn` (the threat list against a
brute-force run), `assist` (the aim nudge stays inside its cone), `rules` (score, chain, hull, clearing, wrapping, difficulty), `seed` (same seed, same
night) and `bots` (idle, poor, mid and sharp players are ordered by skill).

## Lanternfall

`node test/lanternfall.mjs` (or `npm run test:lanternfall`) runs the DOM-free `<script id="core">` block of
`games/webcraft.html` in Node. No browser, no server; about half a minute. Suites: `gen`, `mesh`, `ray`, `body`,
`clock`, `mining`, `murk`, `save`.

| suite | what it checks |
| --- | --- |
| `gen` | the same seed gives the same chunk, in any loading order; bedrock under every column; the sea is solid water to its surface; every trunk stands on grass; 15-60% of the world is sea; caves and ember crystals exist; spawn is grass with two cells of air above the sea; the heightmap matches the blocks; an edit comes back when its chunk is generated again |
| `mesh` | the number of opaque and of water/glass faces against a plain reference, every vertex inside its chunk, shade and sky in range, every index valid, sampled faces wind outward from a block into open space, digging and refilling a hole restores the exact mesh, a roofed floor gets less sky than open ground |
| `ray` | thousands of random rays hit the cell a 4 mm brute-force march hits, and the reported face opens into free space; ray against box |
| `body` | thousands of random steps at 30-120 fps never leave a player inside a block or below the world; a 50 block fall at 10 fps lands on the ground; a one-block ledge is hopped and a two-block wall is not; a jump rises 1.15-1.5 blocks; water slows a fall and holding jump swims up |
| `clock` | the day repeats exactly, noon is bright and midnight dark, 50-70% of the cycle is daylight, daylight only falls through the evening, the day number turns at sunrise, the sky glows at sunset only, a new world starts with a while until dusk |
| `mining` | break times follow the table, drops (grass gives dirt, an ember crystal gives three torches), bedrock never breaks, placing refuses the player's own cell, a torch needs solid ground and becomes a light, a flower goes with its ground |
| `murk` | they come on a dark night and never in daylight, appear 15-26 blocks out and never in or beside torchlight, one that keeps coming at a torch is soon gone, a night beside a torch costs no hit while a night in the dark costs the player, sunrise clears the field, two punches settle one, death and rising |
| `save` | seed, hotbar, hearts and time come back; every edited block comes back and nothing else changes; 400 edits fit in a few KB; junk is refused; two loads of one save walk the same road |

## Backgammon

`node test/backgammon.mjs` (or `npm run test:backgammon`) runs the DOM-free `<script id="core">` block of `games/backgammon.html` in Node. No browser, no
server; about ten seconds. Suites: `setup`, `rules`, `ref`, `score`, `undo`, `save`, `ai`.

| suite | what it checks |
| --- | --- |
| `setup` | fifteen checkers each and 167 pips on both sides; the opening roll is the higher die and ties roll again; dice are fair; a seed is the same dice; doubles give four moves |
| `rules` | hits and made points, the bar before anything else and a closed entry, bearing off (only when all are home, a higher die only from the rearmost point), black as the mirror, the duty to play both dice and the larger die when only one fits |
| `ref` | a second generator written the other way round (own-side coordinates, immutable positions, every dice order) agrees with the core on the whole set of final positions of every roll of sixty random games |
| `score` | single, gammon (none borne off) and backgammon (on the bar or in the winner's home) are worth 1, 2 and 3, for both colours; the match is won at its target |
| `undo` | undoing any run of moves, hits included, restores the position exactly; every destination `reach` offers is a legal run of moves, doubles reach four steps along |
| `save` | a save comes back and plays on dice for dice; rubbish, wrong checker counts, impossible dice and unknown phases are refused |
| `ai` | the computer only plays legal moves and uses every die it can; hard beats random almost always, easy still beats random, hard beats easy and is not weaker than medium; it hits and makes a point with 4-4 and enters from the bar first |

## Two Truths & a Lie

```sh
npm run test:truths                      # or: node test/two_truths.mjs
node test/two_truths.mjs bank deal       # named suites only
```

`two_truths.mjs` runs the DOM-free `<script id="core">` block of `games/two_truths_one_lie.html` in Node, no browser or
server. The page's one promise is that a lie can only be found by knowing, so the suites check what would give it away:

| suite | what it checks |
| --- | --- |
| `bank` | every case is two truths, one lie and a correction; statement lengths, no duplicates, six files of ten, enough cases at each difficulty |
| `deal` | the lie lands on each place equally often, and is not the longest or shortest statement more often than chance allows |
| `runs` | a seed is the same run, a mixed run climbs 1-1-1-2-2-2-2-3-3-3 across files, a file run is all ten cases, seen cases come last, guessers score a third |
| `days` | a date is the same file for everyone, day keys across month and year ends, streak rules |
| `save` | hostile saves are clamped, a run is recorded, a save round-trips, the share line |
| `ai` | what a language model sends back is refused unless it is two truths, one lie and a correction |

Run it after adding a case to `BANK`: every new lie must be about as long as its truths.

## Wick

`node test/deep_miner.mjs` (or `npm run test:wick`) runs the DOM-free `<script id="core">` block of `games/deep_miner.html`
in Node. No browser, no server; a few seconds. It checks that a seed is the same mine everywhere, that all sixteen relics
exist once each and lie in their own zone, that digging takes exactly the time the pick and rock say, that a sale pays what
the pack held, that the light only shrinks as the oil falls and that a dying lamp costs half the pack and nothing more, that
hauling from deep with too little oil fails the same way, that saves come back cell for cell and carry on identically (damaged
ones are healed), and that a bot with a person's pace buys the cheapest upgrade and reaches the Deep Heart on nearly every
seed in about half an hour. `VERBOSE=1` prints its trips and the minute each zone is reached.

## Simon Says

```sh
npm run test:simon                  # or: node test/simon_says.mjs [sequence rules tempo saves bots]
```

`simon_says.mjs` runs the DOM-free `<script id="core">` block of `games/simon_says.html` in Node. The
page only lights and sounds what the core says, so the core carries the promises: the sequence a seed
deals is the same for everyone and is prefix-stable (a longer round only adds to the end), no pad comes up
four times running, every press is judged against the pad that was shown, the tempo tightens but never
below what a person can follow, damaged saves load clean, daily streaks cross month ends, and bots with a
longer memory score higher.
