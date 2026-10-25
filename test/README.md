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

## Air Synth

`node test/air_synth.mjs` (or `npm run test:airsynth`) runs the DOM-free `<script id="core">` block of `tools/air_synth.html`
in Node: the functions that turn hand landmarks plus time into notes, the band and the loop. No browser, no server; under a
second. Synthetic hands are built with real finger geometry (open, two fingers, one, fist, pinch), with per-landmark jitter.

- *Time and harmony.* Under slow drifts, fast sweeps, 15 fps with jitter and dropped frames, irregular frame timing, the
  arpeggio and chords changed by pinches, every note is a tone of the chord playing when it starts, every event lies on a
  sixteenth and is scheduled ahead, and no sixteenth gets two. A still hand re-pitches only on a chord change.
- *Dropouts and flutter.* 40, 100 and 140 ms dropouts never cut a note (mid-sweep too); 600 ms releases it. A still hand on a
  note boundary does not flutter under three levels of jitter, and a control with the hysteresis off shows it would.
- *Hands.* Swapped left/right labels or hand order keep the lead hand; when the lead hand leaves, the other one leads; the
  second hand's height is the space and never steals the melody. The filter reaches 90% of a jump within two frames.
- *Poses.* Each pose reads as itself through jitter and only as itself; a hand half open right on the threshold changes pose
  at most once in 5 s; a pose must hold ~90 ms; a dropout keeps it for the hold only. Pinches are built the way a real hand
  makes them - the index bent forward to the thumb, the tips 0.1 to 0.3 palm lengths apart, the other fingers relaxed,
  stretched or curled - and each is exactly one chord change without changing the pose; a slow pinch (fingers relax first,
  then the tips close) is one chord change and is never read as a fist on the way. A fist with the thumb on the curled
  index, an open hand, two fingers and tips 0.6 apart are never a pinch. (The first pinch detector failed most of these:
  it wanted another finger stretched out, and it read a relaxed hand as a fist.)
- *What they do.* A fist rests the melody on the grid; two fingers play an arpeggio in sixteenths (eighths while calm) that
  keeps its rhythm at 10 camera frames a second; the Arp latch turns an open hand (or a mouse) into the arpeggio; a pinch
  moves the chord on at the next beat.
- *The band.* It changes level only on a bar line, one level at a time, and every rise is announced by a fill; a busy
  player takes it to the top within 20 s, a still hand settles it to a pulse, no hand to air. Bass is always the chord's
  root, every pad chord is the chord and no pad voice jumps more than a fourth. A fist starts a one-beat snare fill on the
  next beat, then a crash and no drums. A fist the tracker loses for half a second at a time stays a break. Opening the hand
  starts the build at once - snare on the beats, eighths, then a sixteenth roll - and the drop lands on the next bar line, at
  most a bar and a beat later, at the top level with crash and boom, and holds it for two bars under a still hand; a fist
  again during the build returns to the break.
- *The loop.* It records from the next bar line, plays every note back once per pass at its step and in its sound, a held
  note lasts until the next thing played, pressing again layers a new pass, notes snap to the chord playing now, clear empties it.
- *Different playing, different music.* A drifting hand, a dancing one and a held arpeggio give measurably different pieces
  (notes per second, pitch, band level, filter) - printed, and checked in the direction each should go.

It also prints what the One-Euro filter and the 40 ms prediction buy against a camera that is 70 ms late, and checks that the
filter cuts a still hand's jitter by at least 40% and that the prediction brings a moving hand closer than the filter alone.

`node test/air_synth_browser.mjs [sound] [camera] [export]` (`npm run test:airsynth-browser`) needs Playwright's Chromium.
`sound` renders a scripted 30 s performance (sweeps, jumps, dropouts, a pinch, a loop, an arpeggio, a break and the drop)
through the page's own engine with `OfflineAudioContext`, once per sound in its own scene, and checks that each plays, that
the peak stays under the limiter's -1 dBFS ceiling, that RMS loudness is between -30 and -10 dBFS, that the band went up,
broke and came back, and - measured in the audio, not the rules - that the last beat of the build is at least 3 dB and the
first second of the drop at least 6 dB louder than the break; rendered again with sine waves, the largest second difference anywhere stays under 0.03 (no clicks at
note changes), while a control engine that jumps its envelope on each note is caught by the same measure. `camera` replaces
the webcam with a canvas showing MediaPipe's own photos and checks that the hand model loads, finds the hand on more than 90%
of frames, that the note goes up and down with the hand, that a slow GPU delegate (headless Chromium has only software
WebGL) is swapped for the CPU one, that `right_hands.jpg` (its open hand), `fist.jpg`, `victory.jpg` and `pointing_up.jpg`
read as open, fist, two and one and play melody, rest, arpeggio and melody - and none as a pinch, though in the fist photo
thumb and index tip are only 0.2 palm lengths apart - and that a fist held up breaks the band and
opening it drops it back in. It prints camera frame rate, detection time, picture-to-mapper delay and the grid wait - a
headless machine's numbers, not a laptop's. `export` records a few seconds with Rec and checks that a video file comes out
and that its sound track decodes to more than silence. The camera part needs network access to storage.googleapis.com and
`npm i --no-save @mediapipe/tasks-vision@0.10.14` (or `MEDIAPIPE=<folder of that package>`), served in place of jsDelivr;
it skips without them. `DELEGATE=GPU` or `DELEGATE=CPU` pins the delegate. Two minutes or so.

## Push Mine

`node test/push_mine.mjs` (or `npm run test:pushmine`) runs the DOM-free `<script id="core">` block of `games/push_mine.html`
in Node. No browser, no server; under a second. It feeds the rep detector synthetic push-ups - camera noise, dropped frames,
fast and slow reps, both camera positions and tap mode - and checks that a held plank plus one rep calibrates it and that rep
counts, that every full rep counts exactly once, that half reps are called shallow and never counted, that bouncing at the
bottom without locking out farms nothing, and that the range grows with a player who goes deeper. Around it: rock takes the
hits it says, a seed is the same mine, rhythm heats and a pause cools, a break pays exactly its ore, the daily streak crosses
month ends and breaks on a missed day, damaged saves heal, the first Push Mine's `pushmine2` save carries over, and a player
doing three sets a few days a week reaches a new stratum every week or two. Knee, incline and wall push-ups dig a gently
discounted share but count in full towards the goal; each stratum's guardian falls only to its run of reps in a row and
heals on a pause or a shallow rep; a jittery face box still calibrates a held plank quickly. The history logs every set (reps, best run, depth,
pace, type) and caps its length, daily and Monday-start weekly totals line up, a max test suggests a goal, a 7-day streak
earns a rest pass that a missed day spends, and milestones are earned once. Every relic is hidden exactly once, two per stratum and never
on a guardian, and each one changes the rule it names; chests pay and TNT chains but stops at a guardian; the day's three
contracts are the same for a seed and day, grow with the player and pay once; passing your best set is called once. Magma closes its cracks over a pause and crystal
only gives to deep reps; the twelve journal pages lie in order off the guardians; the Deep Heart at 400 m takes 30 in a
row and descending again keeps what you carry and makes ore 25% richer. And ESLint's `no-undef` over both scripts, when
ESLint is installed, so a stray rename cannot throw only on the screen that uses it.

`node test/push_mine_camera.mjs` (`npm run test:pushmine-camera`) runs the page with the real MediaPipe models on a fake
camera: a canvas showing MediaPipe's own photos (`pose.jpg` for in front, `portrait.jpg` for below you), moved or scaled
as the body goes down. It checks that each tracker finds the body, that a still plank sets the top within a few seconds
although the face detector's box wobbles by several percent on a still face, and that every slow push-up counts once.
It needs Playwright's Chromium, network access to storage.googleapis.com, and `npm i --no-save @mediapipe/tasks-vision@0.10.14`
(or `MEDIAPIPE=<folder of that package>`); it serves that package in place of jsDelivr. It skips without them. A minute or two. `VERBOSE=1` prints the pacing.

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

## Color Flood

```sh
npm run test:colorflood          # or: node test/color_flood.mjs [rules deal solver levels hint bots daily save page]
```

`color_flood.mjs` runs the DOM-free `<script id="core">` block of `games/color_flood.html` in Node, and its `page` suite drives the real page in
Chromium (skipped without Playwright).

| suite | what it checks |
| --- | --- |
| `rules` | every move on 600 random boards against a fixpoint reference written the slow way round (cells, territory, size, the rings a swallowed cell joins in), refusals cost nothing, undo restores everything |
| `deal` | a seed is a board; every ink in play appears, none outside; no level starts solved; the corner territory never starts over a tenth of the board |
| `solver` | the region-graph lower bound never exceeds the true optimum; exact search equals breadth-first search over every position; beam search is always a legal finishing sequence, optimal on 85% of small boards and never two over |
| `levels` | forty levels, size and inks never fall; each stored solution replays to a solved board in exactly par moves; par climbs tier on tier from 3 to 25; the limit and the 3/2/1 star lines fall where the card says |
| `hint` | a hint always captures something, following hints alone always finishes the board within par + 3 |
| `bots` | the biggest-bite bot clears the ponds and earns far less later; a random legal ink mostly fails the late levels |
| `daily` | one board per date, Monday smaller than Sunday, the day before across month, leap-year, year and clock changes, shared-board addresses clamped |
| `save` | hostile stored values, stars and bests only improve, streaks, the old page's bests (an Easy best opens the Lakes, nothing becomes free stars), share lines |
| `page` | desktop and phone: boot, the coach tip, press/tap/undo/keys, a whole level to three stars, reduced motion, a lying save, the old page's data, a shared board and the daily board |

The levels' `VARIANT`, `PAR` and `SOL` tables in the core are generated: for each level the first board variant whose solved par lands on a
target curve (3 at level 1, 25 at level 40), solved with the widest beam. If you change `deal`, `CLUSTER`, `TIERS` or the solver, they have to be
generated again (the `levels` suite says so).

## Alphabet Typing Speed

```sh
npm run test:alphabet            # or: node test/alphabet.mjs [rules keys daily ghost ranks share save history bots page]
```

`alphabet.mjs` runs the DOM-free `<script id="core">` block of `games/alphabet.html` in Node, and its `page` suite drives the real page in
Chromium (skipped without Playwright).

| suite | what it checks |
| --- | --- |
| `rules` | the clock runs from the first right key to the last, a wrong key is a slip that costs only its time, nothing before the first key counts, non-letters are ignored, splits add up |
| `keys` | the drawn keyboard holds each letter once, distances are symmetric, `MEAN_TRAVEL` is what random shuffles really cost |
| `daily` | 1,100 dates: one board per date, a permutation, no step runs on to the next letter, finger travel within 7 % of the mean, no repeats, every letter starts some days |
| `ghost` | the best run's marker never goes back, stops on Z and glides without jumping |
| `ranks` | a faster time never ranks lower on any board, each rank starts exactly at its threshold, the gap to the next is what is left |
| `share` | the strip has a bar per step, the slowest is the tallest, a Daily share gives nothing of the board away |
| `save` | hostile stored values, ghosts that do not end at the time, bests only improve, daily bests belong to their day, streaks across month, leap-year and new-year, the old page's bests carry over |
| `history` | every finished run is kept per board with its day and slips, trimmed to the newest 120, cleaned when hostile, the last ten against the ten before only claimed with enough runs, best-so-far only falls, the rolling average looks back no further than its window, the old page's attempts carry over |
| `bots` | typists of four skills finish in order of skill on every board and spread across the ladder, mashing random keys does not finish |
| `page` | desktop and phone: boot, wrong key, a whole run with real keys and with taps, Enter and Escape, no scroll, reduced motion with a lying save, no console errors |

`test/shots/alphabet/` holds the before and after screenshots, the filmstrips the critics saw, and the design notes.

## Fugue (Flappy Bird)

```sh
npm run test:fugue               # or: node test/fugue.mjs [physics hits course fair bots tune score save page]
```

`fugue.mjs` runs the DOM-free `<script id="core">` block of `games/flappy_bird.html` in Node, and its `page` suite drives the real page in
Chromium (skipped without Playwright). The core runs at a fixed 120 Hz whatever the display does; heights of the gaps are rows of a pentatonic scale
so that a course is also a melody.

| suite | what it checks |
| --- | --- |
| `physics` | the same presses at 120, 60 and 30 fps end in the same place; a flap sets the speed rather than adding to it and rises v²/2g; terminal speed, ceiling and floor; an idle bird and a flat-out flapper both die before the first gap; death is final (the world stops, the bird rests once, a flap is refused); no step is long enough to tunnel; `view` lies between two steps |
| `hits` | 1,500 random bird positions around the pipes agree with a reference that samples the disc against the drawn rectangles (body and brass collar); gap centres are clear and pipes solid; the bird fits the gap down to its radius; the first pipe is pushed out on a wide screen |
| `course` | a seed deals the same course asked for forwards or backwards; the first gap is where the bird starts; every eighth gap is the tonic; no step beyond three up or four down; all step sizes occur and most are one or two rows; the melody comes back to the middle; seeds and dates are cleaned; pipes get narrower as they rise |
| `fair` | an exhaustive memoised depth-first search over flap / no flap every four steps finds a way through 40 pipes on 40 seeds, 100 pipes on 10 more, on a wide screen, and with a bird 8 units fatter deciding every 67 ms |
| `bots` | bots with human timing noise are paid in order: steady > average > sloppy ≥ poor; a steady player reaches double figures, an average one a few gaps; perfect timing and a plain rule go a long way |
| `tune` | a higher gap is a higher note; the rows are a pentatonic scale; one voice for eight gaps, then voices at 8, 16 and 24; every later voice repeats the melody late and only pipes already passed; every note is in the scale and in earshot; the page plays exactly what the core names |
| `score` | a point is a pipe passed, reported at the pipes' centre, once and in order |
| `save` | garbage and hostile saves clean up; a best has a ceiling; equalling a best is not beating it; the daily best is kept apart and resets with the day; a shared course keeps no record; a save survives a round trip |
| `page` | in Chromium on a desktop and a phone: the ground band equals itself shifted by a camera step and a glide of the camera has no spikes in the hall behind it; opens ready with a one-line course switch and nothing scrolling; the first tap starts and flaps; the title leaves and does not return; taps hold the bird up; losing focus pauses and a tap resumes; the card shows the score and stays on screen; the run is filed; Enter retries; tapping through your own death does not skip the card; `?seed=` plays that course; Daily and Free; a lying save; blocked storage; reduced motion; no console errors |

## AI Quote Generator (QuotoSaurus)

```sh
npm run test:quotes              # or: node test/quotosaurus.mjs [input request reply share store card page]
```

`quotosaurus.mjs` runs the DOM-free `<script id="core">` block of `tools/quotosaurus.html` in Node, and its `page` suite drives the real
page in Chromium (skipped without Playwright) with the model replaced by canned replies, so nothing needs the network. A language model
writes the quotes; the suite checks everything around it.

| suite | what it checks |
| --- | --- |
| `input` | stray spaces, pasted newlines and control characters; "by Name", "— Name" and quoted names; one comma in a name is fine, a list is refused; 80 characters fit and 81 do not, counted as characters; non-ASCII and decomposed accents; a 100,000-character paste is cut at a word to 300 at once, never inside an emoji; creativity with a percent sign or either decimal separator, clamped; every one of the old page's 20 voices can be picked and Random never repeats the name in the field |
| `request` | the body is only the model call; instructions are a system message, the person's words a user message holding exactly the topic and voice as JSON; text that looks like a message cannot add one or reach the system prompt |
| `reply` | the asked-for shape, chatter and code fences, the old page's `{quote, author}`, bare arrays; quotation marks of every style removed, inner ones kept; a trailing attribution or list number removed; duplicates, refusals, empty strings and run-ons dropped; cut-off, two-object and prose replies fail instead of showing "undefined"; never more than three |
| `share` | a link round-trips quotes and names with any characters, holds the quote and author only, refuses blanks, overlong values and broken escapes; copied text always says imagined |
| `store` | hostile saves become a fresh start, the last result is cleaned like a reply, kept quotes are cleaned, de-duplicated and capped; keep and unkeep; the old page's saves move out of `savedQuotes` (oldest-first there, newest-first here, without the "— "), the Daily Quote Generator's strings stay, broken or foreign values are left alone, migrating twice changes nothing |
| `card` | the square image's layout: the largest size that fits, no line wider than the box, every word in order, a 400-character word broken by characters; file names for accented, non-Latin and hostile names; the worked example passes the same cleaning as a reply |
| `page` | desktop and phone: the example on arrival with the result on the first screen; Enter writes; Balanced by default, one tap on Funny asks for jokes and is remembered; nothing can be copied while writing and the card does not shrink; choose, Copy, Link, Image download, Keep; a reload keeps fields, last quotes, the chosen one and kept; a shared link; Remove and Undo; a list of names refused at the field with nothing sent; an empty voice filled in visibly; no connection, a refusal and Cancel; the old page's saves; broken saves; blocked storage in dark mode with reduced motion; no console errors |

`test/shots/quotosaurus/` holds the before and after screenshots and an exported image.
## Quote of the Day (Daily Quote Generator)

```sh
npm run test:dailyquote                   # or: node test/daily_quote.mjs
node test/daily_quote.mjs daily authors   # one or more named suites
```

`daily_quote.mjs` runs the DOM-free `<script id="core">` block of `tools/daily_quote_generator.html` in Node. The page's
promise is that a quote shown as a quotation is one, and that promise is kept upstream: `util/quotes/verify.py` builds the
bank from Project Gutenberg texts and writes a checksum next to it, which this suite recomputes.

| suite | what it checks |
| --- | --- |
| `bank` | the checksum, unique ids and texts, every quote typeset, cited and in a real topic, a month of quotes per topic, no author above a tenth of the bank |
| `daily` | a date is one quote for everyone, a topic runs through every quote before one repeats, no author two days running over three years (cycle seams included), real calendar dates only, local midnight in eight time zones |
| `another` | random picks stay in the topic and use every quote before any comes back |
| `authors` | full names, surnames, aliases (Lao Tzu, Samuel Clemens, Socrates), accents, typos offered as suggestions, "john" asking which, a writer who is not here never mistaken for one who is, huge and hostile input |
| `params` | `?q=`, `?topic=`, `?d=` accepted only when real |
| `copy` | copied text carries its source and translator; AI lines copy labelled and never credited |
| `ai` | the request asks for an original line and holds nothing but the cleaned topic, style and creativity; answers are parsed as untrusted text (fences, markup, fake attributions, refusals, essays); a real quotation coming back is recognised |
| `state` | saves trust nothing; the old page's `savedQuotes` and `quoteHistory` come across once, marked as written by AI unless the words are a checked quote |

## Index of suites

One line per suite (what `npm run` calls it and what it needs), then a paragraph on what each one promises.
Run a page's suite before and after changing that page.

```sh
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
npm run test:pong           # Pong (table tennis) suite (plain Node, no server or browser)
npm run test:animals        # Dusk (A Game for Cats) suite (plain Node, no server or browser)
npm run test:kemari         # Kemari (Ball Bouncing) suite (plain Node, no server or browser)
npm run test:frogger        # Frog Crossing (Frogger) suite (plain Node, no server or browser)
npm run test:describing     # Describing Words suite (plain Node, no server or browser)
npm run test:quotes         # AI Quote Generator (QuotoSaurus) suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:dailyquote     # Quote of the Day (Daily Quote Generator) suite (plain Node, no server or browser)
npm run test:grammar        # Grammar Checker suite (plain Node; its harper suite needs harper.js installed)
npm run test:humanizer      # AI Text Humanizer (Naturalizer) suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:casing         # Case Converter suite (plain Node, no server or browser)
npm run test:challenge      # AI Game Challenge Generator suite (plain Node; its page suite uses Playwright's Chromium)
npm run test:opposites      # Opposite Word Finder suite (plain Node, no server or browser)
npm run test:textshadow     # CSS Text Shadow Generator suite (plain Node; its browser suite uses Playwright's Chromium)
npm run test:gradient       # CSS Gradient Generator suite (plain Node; its browser suite uses Playwright's Chromium)
npm run test:bmi            # BMI Calculator suite (plain Node, no server or browser)
npm run test:timer          # Online Timer suite (plain Node, no server or browser)
npm run test:pomodoro       # Pomodoro Timer suite (plain Node, no server or browser)
npm run test:palette        # Color Palette Generator suite (plain Node, no server or browser)
npm run test:colorpicker    # Color Picker suite (plain Node, no server or browser)
npm run test:scrambler      # Word Scrambler suite (plain Node, no server or browser)
npm run test:hash           # Hash Generator suite (plain Node, no server or browser)
npm run test:life           # Conway's Game of Life suite (plain Node, no server or browser)
npm run test:numberbase     # Number Base Converter suite (plain Node, no server or browser)
npm run test:base64         # Image to Base64 Converter suite (plain Node, no server or browser)
npm run test:colorextractor # Image Color Extractor suite (plain Node, no server or browser)
npm run test:pdfmerger      # PDF Merger suite (plain Node; its inspect and merge suites need pdf-lib installed)
npm run test:cropper        # Image Cropper suite (plain Node, no server or browser)
npm run test:wordexplainer  # Word Explainer suite (plain Node, no server or browser)
npm run test:names          # Baby Name Generator suite (plain Node, no server or browser)
npm run test:cmv            # Contents May Vary suite (plain Node; its browser suite needs Playwright's Chromium)
```

`test/everything_converter.mjs` drives
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
rower up and down, the log keeps its last 200 races in order with a best-so-far line that never falls and the last ten against the
ten before, the old page's runs are carried in without counting as races, every passage uses only keys every keyboard has, and saves
trust nothing. Run it after touching the core.

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
over where its species live here too. The `shop` and `hour` suites cover the quay: tackle bought in order and never on credit, the
line deciding how deep a cast goes and deep fish rising little for a short one, the starter rod unable to hold a tuna, orders that pay
exactly what they say, legends that come only to an angler with the tackle, the bait and some catches of their kin, and a
person-paced bot that buys its first tackle inside four minutes, most of it inside 75 and never goes long without a new species or
new tackle. Run it after touching `SPECIES`, `TUNE`, `GEAR`, `VAL` or the fight.

`test/pong.mjs` runs the DOM-free `<script id="core">` block of `games/pong.html` (Pong), table tennis seen from above against a
ladder of eight club players: a bat waiting where the ball arrives always hits it and one a blade away never does, at 30 to 144 fps
and at full rally speed; where the ball meets the blade sets the angle, each hit speeds the rally up to a ceiling, and only a moving
bat curves the ball; the CPU's prediction lands where the ball really crosses; serve order, two clear and every point of whole
machine matches against references written the other way round; a seed is one match; and bots with a person's reaction time find
the rungs harder in order while an expert can still beat the champion. Run it after touching the core or a rival's numbers.

`test/animals.mjs` runs the DOM-free `<script id="core">` block of `games/animals.html` (Dusk), a game for cats, who cannot report a bug:
prey that are out on the field stay on it at 30 to 144 fps and on four screen shapes and never move faster than their kind can, a paw within
reach (measured to the body, not a point) is a catch and one a pixel beyond is not, a prey in the grass cannot be caught but a paw on the grass
flushes it, a near miss sends it further from the paw even in a corner, prey grow bold when nobody plays and shy again when a paw comes back,
every hunt ends and ends on a catch for a cat still playing, cat bots catch in order of keenness (a lazy one still catches several in three
minutes, random paws far fewer than aimed ones), all three never sends the same prey three times running, and the ledger of nights trusts
nothing it reads. Run it after touching the core.

`test/ball_bouncing.mjs` runs the DOM-free `<script id="core">` block of `games/ball_bouncing.html` (Kemari), keepie-uppie
whose promises are timing and fairness: a free flight is the same at any frame rate, no kick at any tempo on any screen shape sends the
ball above the court or out of it and a low kick always leaves time to kick again, a tap touches the ball exactly within its reach (a
thumb's reaching further, and from below), a ball is kicked only once it is falling and below its kicking height so drumming on it earns
nothing, the side you touch sends it the other way and the middle sends it straight up, seasons turn every 25 kicks and years every 100,
a dropped ball rolls to a stop, the wind of autumn and winter never stops a careful player getting through the year, and players with a
person's reaction time and timing error are paid in order of their care. Saves trust nothing, and the replaced page's paddle score is
kept but never made a best. Run it after touching `TUNE` or the kick.

`test/frogger.mjs` runs the DOM-free `<script id="core">` block of `games/frogger.html` (Frog Crossing), a Frogger whose page
only draws what the core returns: every lane is a pure function of the clock (the same night for everyone, nothing wrapping on
screen, no two things overlapping, every road gap wide enough to stand in), a hit is a real overlap against a check written
separately, a log carries the frog to a millionth of a cell and the edge sweeps it away the moment its centre leaves, a rider
drowns exactly while its copper turtle is under and the bubbles show first, an inlet saves and the bank or a taken pad kills,
the score, clock, lives and nights follow the rules, the same presses give the same game at 30, 60 and 120 fps, and a
breadth-first search over the real core reaches all five inlets on every night from 1 to 12 deciding only five times a second.
Run it after touching a lane, a speed or a rule.

`test/describing_words.mjs` runs the DOM-free `<script id="core">` block of `tools/descriptocraft.html` (Describing Words)
against the word list it loads, `data/describing_words.txt` and `_more.txt`: both files read the same through a second decoder
written from the format notes, what is typed is understood the way a person means it (plurals, phrases whose head is the last noun,
accents, stray punctuation, words that are both noun and adjective), known nouns list the words books really use with them and
known adjectives their synonyms but never their opposites, filters only ever remove words, a typo suggests the word that was meant,
the old page's favourites come across while two other tools' entries under the same key do not, and saves and links cannot be
forged. The list itself is built by `util/describing_words/` (fetch.sh, build.py, inline.mjs) from Google Books' syntactic
n-grams, WordNet, Moby, VADER and wordfreq; run the suite after rebuilding it or touching the core.

`test/quotosaurus.mjs` runs the DOM-free `<script id="core">` block of `tools/quotosaurus.html` (AI Quote Generator), where a
language model writes the quotes and everything around it is promised: only the tidied topic and name are sent, as data the
model is told not to obey; a reply is shown only when it holds real quotes (refusals, JSON debris, a trailing attribution,
duplicates and run-ons are dropped); copied text, the image and a link all say the quote is imagined and a link never carries
the topic; a list of names or an overlong one is refused at the field; saves trust nothing, and the old page's saves move out
of `savedQuotes`, which it shared with the Daily Quote Generator, leaving that page's strings in place. The `page` suite plays
the real page in Chromium on a desktop and a phone against canned replies (no network): example, write, tone, choose, copy, link,
image, keep, undo, reload, a shared link, failure, cancel, migration and blocked storage. The site's proxy only answers pages
served from www.gptgames.dev, so trying the page against the real model locally needs the requests relayed. Run it after
touching the core, the prompt or the page.

`test/daily_quote.mjs` runs the DOM-free `<script id="core">` block of `tools/daily_quote_generator.html` (Quote of the Day),
whose one promise is that a quote it shows as a quotation is one. The bank is written by `util/quotes/verify.py`, which downloads
each source from Project Gutenberg and keeps a remembered quote only when its words are a run of the book's words, replacing memory's
wording with the book's (it dropped "My life has been full of terrible misfortunes" from Montaigne and "I prayed for twenty years" from
Douglass, among others); the suite checks the bank against the checksum the script writes, so a quote edited by hand in the page fails.
It also checks that the quote of the day is the same for everyone on a date, runs through a topic's every quote before one repeats,
never shows one author two days running and turns at local midnight in every time zone; that a typed name finds the author meant
(aliases, accents, typos) and never a different one; that the AI writer is asked for original lines only and what it returns is
cleaned, labelled and never credited to a person; and that saved quotes, including the old page's `savedQuotes` and `quoteHistory`,
cannot be forged. To add quotes, edit `util/quotes/candidates.txt` and run `python util/quotes/verify.py`, then the suite.

`test/grammar_check.mjs` runs the DOM-free `<script id="core">` block of `tools/grammar_check.html` (Grammar Checker). The page
checks text in the browser with Harper (an open-source rule checker, WebAssembly from jsDelivr) and sends text out only when the
person asks for the AI proofread. The suite checks what the page adds around Harper: which marks are shown (names and words with
non-English letters are not misspellings, a few confusions Harper misses are caught), that a fix changes exactly its words and every
other mark stays on its own word in any order, that the AI request carries the text only as JSON data, that an AI reply is shown only
as small located fixes (a rewrite, an answer or an obeyed injection is refused) whose sum is exactly the model's text, and that the
old page's `grammarProText` survives. Its `harper` suite runs the real checker (`npm i --no-save harper.js@2.10.0`). Run it after
touching the core or bumping Harper.

`test/ai_text_naturalizer.mjs` runs the DOM-free `<script id="core">` block of `tools/ai_text_naturalizer.html` (AI Text
Humanizer), where a language model rewrites the text and everything around it is promised: the stock-phrase check marks what
its list names and never part of another word, only the text and the settings are sent, as data the model is told not to obey,
a reply is shown only when it is a rewrite (refusals, an unchanged text, a cut-off reply are refused), the marked changes
rebuild the rewrite exactly, and saves - including the old page's `inputText`, `outputText`, `darkMode` and `preset_<name>`
keys - trust nothing. The `page` suite plays the page in Chromium on a desktop and a phone against canned replies. Run it
after touching the core, the prompt or the page.

`test/code_case_converter.mjs` runs the DOM-free `<script id="core">` block of `tools/code_case_converter.html` (Case
Converter), whose promise is that it finds the words a person sees: XMLHttpRequest is xml, http, request, IDs and URLs stay
one word, user's is user, accents and decomposed letters survive, and each identifier style joins them its own way and is
stable when converted back; Title Case follows Chicago (small words lower except first, last and after a colon; NASA,
iPhone and user_id kept), Sentence case capitalises after . ! ? and at each line, text styles change letter case and nothing
else, a megabyte converts in well under a second, and the old page's `conversionHistory` is cleaned before it is shown.
Run it after touching the core.

`test/game_challenge.mjs` runs the DOM-free `<script id="core">` block of `tools/ai_game_challenge_generator.html`, where a language
model writes the challenge and everything around it is promised: input is read the way people type it (stray spaces, quotes, a decimal
comma, 0 to 100 clamped), the instant offline draft is the same for the same settings and always a whole challenge with no placeholder
left, only the game name and the settings are sent and as JSON data the model is told not to obey, a reply is shown only when it is a
challenge (refusals, HTML, debris and a cut-off reply are refused) and always as text, old `?challenge=` links still open with their
HTML gone, and the old page's `challengeHistory` is carried over without its stored HTML. The `page` suite plays the page in Chromium on a
desktop and a phone against canned replies. Run it after touching the core, the prompt or the page.

`test/opposite_finder.mjs` runs the DOM-free `<script id="core">` block of `tools/opposite_finder.html` (Opposite Word
Finder) against the data it loads, `data/opposites.json`, which `util/opposites/build.py` makes from Princeton WordNet 3.0
(every synset with an antonym, the satellite adjectives around it, tagged sense counts, the irregular forms, and a Bloom
filter of every WordNet word). Its promises: textbook pairs come out on the headline, a word's rare sense never does (cat
the verb means to vomit), plurals, -er, -ing and irregular forms find their base, a word with no opposite (dog) is told
apart from a typo (hapy, shown as happy), numbers get none, every pair in the data is recorded both ways, the optional AI
request carries the text only as JSON data and its reply is cleaned, and the old page's history survives while markup in
it stays text. Its `languages` suite covers the nine other languages in `data/opposites/<code>.json`, which the same
script makes from the Open Multilingual Wordnet 1.4 (French, Spanish, Italian, Portuguese, Polish, Finnish, Catalan,
Romanian, Japanese; each tied to WordNet 3.0 synsets, loaded only when chosen): textbook pairs in each, no word its own
opposite, and every synset one the English data has. Run it after rebuilding the data or touching the core.

`test/text_shadow.mjs` runs the DOM-free `<script id="core">` block of `tools/text_shadow_generator.html` (CSS Text
Shadow Generator), whose CSS box is both its output and an input for any text-shadow a person pastes: colours against
CSS Color 4 (hex, rgb/hsl in both syntaxes, named), what people paste (a whole rule, comments, !important, pt and em,
colour first or last, none) read and every mistake named by shadow number, everything it prints read back unchanged,
the old page's `textShadowApp*` keys loaded and corrupt ones survived, links that never carry the text, and a `browser`
suite in which Chromium's own computed style must agree with the core on printed and pasted values. Run it after
touching the core.

`test/css_gradient.mjs` runs the DOM-free `<script id="core">` block of `tools/css_gradient_generator.html`, whose promise is
that the CSS it prints draws the gradient on screen and that a pasted gradient is read the way a browser reads it: colours against
CSS Color 4 (hex, rgb/hsl in both syntaxes, hwb, names), Oklab against the spec's values, interpolation premultiplied with missing
hues and the shorter way round, stop positions fixed up as CSS Images 3 says, directions, prefixed `-webkit-` gradients, radial
and conic preludes, errors that name the bad part, the old page's printed CSS read back unchanged in meaning, and an sRGB
fallback that stays within a just-noticeable difference of the real Oklab or OKLCH blend. Its `browser` suite has Chromium draw
what was pasted and what the page prints and wants the same pixels. Run it after touching the core.

`test/bmi_calculator.mjs` runs the DOM-free `<script id="core">` block of `tools/bmi_calculator.html` against its sources:
WHO's adult cut-offs (and the lower ones WHO 2004 and NICE give for Asian, Black and Middle Eastern backgrounds) at every
boundary, a shown BMI and its category that always agree, a healthy range whose every weight is healthy and is not 0.1 kg too
narrow, and for ages 2 to 19 the percentile curves CDC publishes beside its LMS table reproduced from L, M and S alone. It also
reads what people type (decimal commas, units, feet and inches, stone) and the old page's `bmiData`. Run it after touching the core.

`test/timer.mjs` runs the DOM-free `<script id="core">` block of `tools/timer.html` (Online Timer): what people type or paste
(`5`, `1,5`, `1:30`, `1h 20m`, `5m30`, `set a timer for 10 minutes`, units in German) becomes the length they meant and
everything else is an error that names the problem; a countdown that shows the full length at the start and 0:00 only at the end;
the "ends" clock across midnight, new year, leap day and both DST changes; links with `?t=`; and the old page's `timerSettings`
read back and written in a shape the old fields still fit. Run it after touching the core.

`test/word_scrambler.mjs` runs the DOM-free `<script id="core">` block of `tools/online_word_scrambler.html` (Word Scrambler),
whose promises nobody can check by eye on a long text: every word comes out a rearrangement of its own letters with every
space, mark, number and capital position where it was (no emoji or accent torn apart, ß never SS), a word that can change
does, the shuffle is fair (chi-square over every arrangement), a seed is stable while typing so editing one word moves no other,
the old page's four switches still mean what they meant, the worksheet never gives a first letter away, and saves - including
the old `darkMode` key - trust nothing. Run it after touching the core.

`test/game_of_life.mjs` runs the DOM-free `<script id="core">` block of `tools/game_of_life.html` (Conway's Game of Life),
whose promise is that the board shows what the rule says: every generation of soups under ten Life-like rules, on the endless plane
and on a torus, against a dense-grid stepper written in the test; what LifeWiki records (the R-pentomino has 116 cells at 1103, the
acorn 633 at 5206, diehard is gone at 130, the Gosper gun adds a glider every 30); still life, oscillator and spaceship readouts
checked against brute force with the smallest period; rules as LifeWiki and Golly write them (B3/S23, 23/3, names, :T torus); and
RLE, plaintext, Life 1.05 and 1.06 read as those programs read them, written back in 70 columns and round-tripped. Run it after
touching the core.

`test/number_converter.mjs` runs the DOM-free `<script id="core">` block of `tools/number_converter.html` (Number Base Converter),
whose promise is that every row is the same number: whole numbers of any size against BigInt's own parsing and printing in bases 2
to 36, fractions as exact rationals (every repeating block expanded back must equal the input, 0.1 is 0.0(0011) in binary), two's
complement at 8 to 64 bits round-tripped, what people paste (0x, #, 0b, 0o, a trailing h or b, spaces, _, ' and : as grouping, a
decimal comma, fullwidth digits, a Unicode minus), errors that name the wrong character and what the base accepts, the old page's
outputs, and the working shown for homework. Run it after touching the core.

`test/image_base64.mjs` runs the DOM-free `<script id="core">` block of `tools/image_to_base64_converter.html`, whose one promise
is that the string is the file byte for byte and that what it reads back is the file again: the RFC 4648 vectors, every length to
300 and thousands of random buffers against Node's own Buffer, 76-column MIME wrapping, the messy text people paste into the decoder
(data: URIs, quotes, url(), line breaks, base64url, missing padding, %3D) with errors that name the wrong character, the type read
from the bytes rather than the name, pixel sizes read from real headers, percent-encoded SVG URIs that decode back to the SVG, and
the exact strings of every copy format. Run it after touching the core.

`test/pdf_merger.mjs` runs the DOM-free `<script id="core">` block of `tools/pdf_merger.html` (PDF Merger), whose promise is
that the file it hands back holds exactly the pages shown, in that order and turned that way: page ranges read the way people
type them in a print dialog (1-3, 5, 8-, 5-1, en dashes, "last", fullwidth digits) with every bad part named, files are sniffed by
their %PDF- header rather than their type, a password-locked file is refused instead of merged as garbled pages, and merges of
source files whose every page has its own size are read back page by page with pdf-lib (`npm i --no-save pdf-lib@1.17.1`).
Run it after touching the core.

`test/image_cropper.mjs` runs the DOM-free `<script id="core">` block of `tools/image_cropper.html` (Image Cropper), whose
promise is that the file holds exactly what the frame shows: the draw matrix against crops, quarter turns and flips done the
plain way on numbered pixel grids, thousands of drags, moves, ratio changes and straightens that never leave the photo (no empty
corners), keep a locked ratio and keep the opposite corner still, the largest frame for a ratio against a 0.1 % larger one,
whole-number ratios giving files of exactly that ratio, brightness and contrast by the Filter Effects formulas, the numbers
people type (1 080 px, 12,5, 1,080, 16:9, 4x5), file names and saved settings that trust nothing. Run it after touching the core.

`test/image_color_extractor.mjs` runs the DOM-free `<script id="core">` block of `tools/image_color_extractor.html`,
whose promise is that each swatch is a colour really in the image, its % is the share of the visible image it covers, and its
codes say exactly that colour: OKLab against Ottosson's and CSS Color 4's published values with every 8-bit colour round-tripping,
HSL against CSS Color 4's hslToRgb, WCAG contrast; images whose answer is known (one colour gives one swatch, two at 70/30, three
asked for twelve give three, a noisy four-colour photo gives its four at 25% each, transparency left out, 1x1), every swatch a real
pixel of its image with its marker on a pixel of that colour, shares that add to 100, exports byte for byte and saved settings that
trust nothing. Run it after touching the core.

`test/word_explainer.mjs` runs the DOM-free `<script id="core">` block of `tools/word_explainer.html` (Word Explainer)
against the dictionary it loads, `data/word_explainer/<two letters>.json`, which `util/word_explainer/build.py` makes from
Princeton WordNet 3.0 (every synset, with its examples, synonyms, opposites and the word it is a kind of, sharded by the
first two letters so a look-up loads one small file). Its promises: all 117,659 synsets and 206,941 word-sense pairs of
WordNet 3.0 are there, the everyday meaning comes first, plurals, -ing, -ed, -er, possessives and irregular forms (went,
mice) find their base for the part of speech they inflect, pasted quotes, footnote marks and odd spaces are cleaned, a typo
suggests the word meant, a sentence is offered as its words, the optional AI request carries the word only as JSON data
and its reply is cleaned, and the old WordSage page's `wordSageHistory` and `wordSageFavorites` survive. Run it after
rebuilding the data or touching the core.

`test/name_generator.mjs` runs the DOM-free `<script id="core">` block of `tools/name_generator.html` (Baby Name
Generator) against the records it loads, `data/names.txt`, which `util/name_generator/build.py` makes from the US Social
Security baby-name files 1880-2017 (every name given to 300+ babies). Its promises: every name shown is in the records with
the count the records give, every filter holds for every name drawn (against a brute-force reading of the same rules), every
theme name is a real name, a seed draws the same list and a link never carries the parents' names, what people type (decimal
commas, accents, reversed lengths, a 200k-character paste) is read or refused next to its field, the old page's
`nameGeneratorFavorites` survives while forged ones do not, and Ask AI sends only the theme and filters, as JSON data, and
shows only cleaned names checked against the records. Run it after rebuilding the data or touching the core.

`test/wordle_helper.mjs` runs the DOM-free `<script id="core">` block of `tools/wordle_helper.html` (Wordle Helper) - the same
text the page hands its Web Worker - against the data it loads, `data/wordle_helper/` (answers.json, guesses.json,
tree_salet.json), which `util/wordle_helper/build.py` makes from the original Wordle word lists (pinned by SHA-256) by compiling
and running `util/wordle_helper/solve.c`, an exact branch and bound over all 12,972 accepted guesses (needs a C compiler; about
ten minutes on four cores). Its promises: feedback exactly as Wordle colours it, repeated letters included (SPEED on ABIDE, ERASE
on SPEED, three Es); the candidates left are exactly the words that would have given every row; Hard Mode refuses what the NYT
refuses and nothing else; the SALET tree wins all 2,315 games in 7,920 guesses (3.421 on average, at most five, Bertsimas and
Paskov 2025); the SLANT / PRICE / any-fitting-word strategy averages 3.669; the page's live exact search equals the optimal tree on
every SALET group it can solve; SALET, LEMON, FIELD leaves BUGLE and CYCLE; and the explanation only says an information word
beats going for the answer when it does. Its `page` suite drives the real page on a phone in Chromium (needs
`npx http-server -p 8099`) and is skipped without one. Run it after rebuilding the data or touching the core.

`test/color_palette.mjs` runs the DOM-free `<script id="core">` block of `tools/online_color_palette_generator.html`
(Color Palette Generator): OKLab against CSS Color 4's values with every sRGB colour round-tripping through OKLCH and HSL,
WCAG contrast against known ratios and never rounded up into a pass, the Machado 2009 simulations keeping white, black
and grey, what people paste (rgb(), hsl(), names, CSS declarations, short and alpha hex) and errors that name the bad
part, every palette type at every size holding the person's colour exactly, an Accessible palette that really passes,
locks, the old page's CSS export, `?colors=` links and `savedPalettes`. Run it after touching the core.

`test/online_notepad.mjs` runs the DOM-free `<script id="core">` block of `tools/online_notepad.html` (Online Notepad), whose
promise is that what is typed is what comes back: pasted or stored markup is cleaned to bold, italic, underline, strike, lists
and lines and never to a script or an attribute (thousands of random fragments, stable when cleaned twice), the text that is
copied and downloaded is the text on the sheet (Chrome's `<div>` lines, line breaks, nested lists, entities) and survives text to
note and back, Markdown escapes what would change its meaning, words and characters are counted as a person counts them
(graphemes, no line breaks), the old page's `notes` (a blank title stored as "Untitled", a missing title, a script in a title)
load without loss or crash, and a backup imports back whole while adding nothing twice. Run it after touching the core.


`test/paste_to_markdown.mjs` runs the DOM-free `<script id="core">` block of `tools/paste_to_markdown.html` (Paste to
Markdown) on HTML parsed by linkedom (`npm i --no-save linkedom@0.18.5 marked@15.0.4`). Its promise is that the Markdown shows
what was pasted: the output is rendered again with marked and must give back the same text, links, list items and table cells;
literal `*`, `_`, `#`, `1.`, `<tag>`, `&amp;` and friends stay literal without needless escapes; Google Docs (the bold-off
wrapper, styled spans, `aria-level` lists, `google.com/url` links, code-font paragraphs), Word (`mso-list` paragraphs),
GitHub and VS Code code blocks and web pages convert to golden strings; every style option; plain text kept as written; the
HTML shown in the page carries no script, handler or remote load and converts like the paste; and a paste a thousand times
the usual size stays fast. Run it after touching the core.
## Box Shadow Generator

```sh
npm run test:boxshadow                   # or: node test/box_shadow.mjs
node test/box_shadow.mjs parse errors    # named suites only
```

`box_shadow.mjs` runs the DOM-free `<script id="core">` of `tools/box_shadow_generator.html` in Node: colour
parsing, lenient number entry (decimal comma, units, unicode minus), how layers print, the box-shadow grammar
(lengths together, colour and `inset` in any order, no negative blur, rem/em read at 16px), the smoothing split,
presets, stored state, the share hash, and size limits. Expected strings are worked out from CSS Backgrounds 3 and
CSS Color 4 by hand. The `browser` suite needs Chromium via Playwright (a global install is found too) and wants
Chromium's computed style of every pasted input to equal that of what the page prints; it is skipped without it.

## CSS Grid Generator

```sh
npm run test:cssgrid                          # or: node test/css_grid_generator.mjs
node test/css_grid_generator.mjs track parse  # named suites only
```

`css_grid_generator.mjs` runs the DOM-free `<script id="core">` of `tools/css_grid_generator.html` in Node: one
`<track-size>` per box read as CSS Grid Layout 1 §7.2 reads it (no negative lengths, fr only as a flexible maximum,
minmax()/fit-content()/calc(), decimal comma, "200 px", a bare number up to 12 as fr and above as px), gaps, area names as
valid `<custom-ident>`s (not auto/span/CSS-wide keywords), drawing, renaming and deleting areas and tracks, the exact CSS and
HTML printed (template rows lined up, line-number placement, stacking below a width, breakpoints, card grids), pasted CSS
read back (repeat(), line names, legacy grid-gap, non-rectangular areas refused) with every preset round-tripping, stored
and linked state sanitised, the old page's sample outputs, and a 24×24 grid. Expected strings are worked out from the spec
by hand. The `browser` suite needs Chromium via Playwright (a global install is found too): every declaration the page
prints must pass `CSS.supports`, placing areas by name and by line number must give identical boxes, and stacking must
give one column below its width and not above; it is skipped without it.

## CSS Filter Generator

```sh
npm run test:cssfilter                   # or: node test/css_filter.mjs
node test/css_filter.mjs read errors     # named suites only
```

`css_filter.mjs` runs the DOM-free `<script id="core">` of `tools/css_filter_playground.html` in Node: how a filter prints
(neutral values left out, `none` when nothing is set, two decimals, no `-0`), the filter grammar from Filter Effects 1
(omitted argument = 1, number = ratio, negative invalid, grayscale/invert/opacity/sepia clamp at 100%, deg/rad/grad/turn),
what people paste (`filter:` / `-webkit-filter:`, `!important`, comments, decimal comma, stray commas, open brackets),
drop-shadow() and url() kept verbatim in place, plain-word errors, the number boxes, the presets carried over from the old
page, randomize ranges, stored state, the `#f=` link and huge pastes. The `browser` suite needs Chromium via Playwright
(a global install is found too): Chromium's `CSS.supports` must agree with the core on what is valid, and what the page
prints must render pixel-identical to what was pasted; it is skipped without it.

`test/hash_generator.mjs` runs the DOM-free `<script id="core">` block of `tools/hash_generator.html` (the same source the page
hands its file workers) against the standards rather than the page: FIPS 180-4 and FIPS 202 example vectors, the RFC 1321 MD5
suite, RFC 4231 / RFC 2202 HMAC cases, the CRC-32 check value and Keccak-256 of "" - then Node's crypto over random data at every
block-boundary length, fed in random chunk splits as a file is. It also pins what people paste: text hashed exactly as typed (no
trim; UTF-8, lone surrogates as U+FFFD, line-ending conversion), hex and Base64 input, and every form of expected checksum the
compare box takes (sha256sum and BSD lines, uppercase, groups, 0x, Base64/SRI). The `contract` suite holds the old page's sample
outputs. Run it after touching the core.

## Movie Script Generator

```sh
npm run test:moviescript                       # or: node test/movie_script_generator.mjs
node test/movie_script_generator.mjs fountain  # named suites only
```

`movie_script_generator.mjs` runs the DOM-free `<script id="core">` of `tools/movie_script_generator.html` in Node; no
browser, no server, and the model is never called. The parser is checked against the Fountain syntax reference
(fountain.io/syntax) and the plain-text export against standard screenplay indents; then what gpt-4o-mini really sends
back (blank lines inside dialogue, code fences, markdown bold, END SCENE markers), Fountain export read back unchanged,
the request built from the form, the plain-words errors, and the old page's `saved_settings` and `scriptHistory`.

## Base64 Decode and Encode

```sh
npm run test:base64text                  # or: node test/base64_encoder_decoder.mjs
node test/base64_encoder_decoder.mjs rfc lenient   # named suites only
```

`base64_encoder_decoder.mjs` runs the DOM-free `<script id="core">` of
`tools/base64_encoder_decoder.html` in Node; no browser, no server. It checks the RFC 4648 §10
vectors, round-trips 300 random byte strings against Node's own `Buffer` (standard and base64url),
the forgiving decoder (whitespace, URL-safe alphabet, missing or extra padding, data: URIs,
%-escapes, a copied `"key": "…",` JSON line), errors with their positions, the text encodings
(UTF-8, ISO-8859-1, UTF-16LE), file-type sniffing, the hex dump and the paste-direction guess.
Suites: rfc, roundtrip, lenient, errors, text, sniff, detect.

## Pomodoro Timer

`test/pomodoro_timer.mjs` runs the DOM-free `<script id="core">` block of `tools/pomodoro_timer.html`. Time is never
ticked: every call gets an explicit `now`, so the suite checks the countdown, pause/resume, skip and the auto-started
chain a locked phone sleeps through against plain timestamp arithmetic, and the cycle against Cirillo's method (a long
break after every N sessions; only a session that runs out counts). It also covers what people type into a length
field (decimal commas, units, m:ss, hours), links with lengths in them, and the old page's `pomodoroSettings` and
`tasks`. Suites: `parse`, `format`, `cycle`, `clock`, `links`, `saves`. Run it after touching the core.

## CSV to JSON Converter

```sh
npm run test:csvjson                        # or: node test/csv_json_converter.mjs
node test/csv_json_converter.mjs rfc json   # named suites only
```

`test/csv_json_converter.mjs` runs the DOM-free `<script id="core">` block of `tools/csv_json_converter.html` (the same source
the page hands its worker for large inputs). Expected values come from RFC 4180 and RFC 8259, and the `oracle` suite cross-checks
the CSV reader and writer against Python's `csv` module on random grids full of delimiters, quotes, line breaks and emoji (it is
skipped when `python3` is missing). It pins the typing rule (a column becomes JSON numbers or booleans only if every filled value
in it is one; a number has no leading zero and at most 15 significant digits; decimal comma with semicolon files), delimiter
detection, readable JSON errors with line and column, JSON numbers carried to CSV exactly as written, and in `contract` the old
page's sample outputs, with the intended differences named. Run it after touching the core.

## AI Code Explainer

```sh
npm run test:codeexplainer               # or: node test/ai_code_explainer.mjs [detect|input|prompt|parse|text|history]
```

`test/ai_code_explainer.mjs` runs the DOM-free `<script id="core">` block of `tools/ai_code_explainer.html` in Node. The
explanation comes from a language model and is not tested; everything around it is. It pins that the code reaches the model
with the line numbers its answer refers to (and no code fence the snippet could break), that any reply - clean, fenced,
braces inside strings, trailing commas, prose, truncated, wrong types - becomes steps whose line ranges exist in the code,
the input limits and their messages, language detection, stripping line numbers pasted along with the code, and that history
in the old `savedExplanations` shape still loads, searches, imports and exports without throwing. No browser, no server.

## Web Accessibility Checker

```sh
npm i --no-save linkedom@0.18.13                       # every suite
npm i --no-save playwright-core@1.64.1                 # browser suite; Chromium at /opt/pw-browsers/chromium
npx http-server -p 8099                                # browser suite
npm run test:a11y                                      # or: node test/web_accessibility_checker.mjs [contrast|names|rules|document|locate|edges|output|browser]
```

`test/web_accessibility_checker.mjs` runs the DOM-free `<script id="core">` block of `tools/web_accessibility_checker.html`
in Node, on documents parsed by linkedom. Expected values come from the specifications, not from the page: the WCAG 2.2
contrast formula and thresholds (ratios cross-checked with an independent calculation), large text as 18pt / 14pt bold,
the WAI-ARIA 1.2 roles and required states, the accname 1.2 / HTML-AAM naming steps, and BCP 47 language tags. It also
pins line numbers that ignore tag-like text in comments and scripts, fragments being spared page-level checks, the fixes
it offers (a suggested colour must really pass; a mistyped `<label for>` is named), CSV that cannot smuggle formulas, and a
200 000-element page. The `browser` suite opens the real page and checks that `<style>` contrast is measured in the
rendered copy, that checking makes no request outside the page, that input survives a reload and that nothing is logged
as an error. Run it after touching the core.

## Color Blindness Simulator

```sh
npm run test:colorblind                       # or: node test/color_blindness_simulator.mjs [suite ...]
```

Runs the page's DOM-free `<script id="core">` in Node; no browser or server needed. Simulation is checked
against `color_blindness_simulator.vectors.json`, produced by colorspacious 1.1.2
(`cspace_convert(rgb, {"name": "sRGB1+CVD", "cvd_type": "deuteranomaly", "severity": 60}, "sRGB1")`), which carries
Machado, Oliveira & Fernandes' (2009) published matrices; the page must agree within one 8-bit level. CIEDE2000 is
checked against Sharma, Wu & Dalal's (2005) test pairs. Also: what people paste as colours, links, saved settings,
the pixel path against the single-colour path, and that suggested replacements really stop clashing.
To re-record the vectors, re-run that colorspacious call for the inputs listed in the JSON.
## SEO Meta Tag Generator

```sh
npm run test:metatags                    # or: node test/seo_meta_tag_generator.mjs [parse build fit migrate edges]
```

Runs the DOM-free `<script id="core">` of `tools/seo_meta_tag_generator.html` in Node; no browser, no server.
It checks that pasted values (URLs without a scheme or with spaces, `en_US`, `x.com/handle`, `7 days`, keyword lists
with empty items) become clean values or a plain error that leaves the tag out, that every value is escaped for HTML
text or attributes, the exact tag output, the Google-style pixel truncation (never splitting a character), huge-input
speed, and that settings the old page stored under `seoMetaFormData` still load. Expected values come from the HTML
spec, the Open Graph protocol, X card docs and BCP 47, written by hand.

## Afterglow (music video maker)

```sh
npm run test:afterglow                       # or: node test/music_video_maker.mjs
node test/music_video_maker.mjs beats shots  # one or more named suites
VERBOSE=1 node test/music_video_maker.mjs    # print the measurements
```

`music_video_maker.mjs` drives the real `tools/music_video_maker.html` in headless Chromium (file://, no
server; needs Playwright). The page promises a video cut to the music, which no single frame can show, so it
synthesises songs in the page with WebAudio whose beats, downbeats and drops are known exactly - human timing
jitter, tempo drift, swing, syncopated kicks, intros and breaks with only off-beat hi-hats, sections of 3, 5 and
7 bars, a live band drifting by 4.5 % - and measures what the analysis and the cut plan make of them.

| suite | what it checks |
| --- | --- |
| `beats` | tempo (half tempo counts for drum & bass), beats within 50 ms, downbeats within 70 ms, a cut within 60 ms of every drop, the share of cuts on a true beat |
| `shots` | dissolves run 0 -> 1 into the scene the next shot shows, none ends on a drop; every drop is a hard cut; every cut is on the beat grid; chops between bars do not knock the long shots off the bar |
| `scenes` | each of the twelve scenes compiles and draws a picture, calm and at a drop, that is neither black nor blown out |
| `loop` | seeking while playing leaves one render loop, not one per seek |

The onset weights and the beat tracker's tightness in the page were chosen by a grid search over these five
songs and five more made differently (numpy, other kick and bass sounds). Measured on all ten at the time: 0.91 or
better on nine (beats, downbeats and drops averaged), and 0.56 on one with odd section lengths and a late pickup,
where the grid slides half a beat in places. Tuning further only traded one song for another, so it stopped
there. If you change the analysis, run `beats` and `shots` before and after; the thresholds are the bar it
cleared, not aspirations.

## Leetspeak Converter

```sh
npm run test:leet                # or: node test/leetspeak.mjs [contract intensity style decode settings edges]
```

`leetspeak.mjs` runs the DOM-free `<script id="core">` of `tools/1337.html` in Node; no browser or
server. It holds the basic and advanced alphabets to the outputs the earlier page gave at full
intensity (`contract`), checks that an intensity below 100% swaps exactly that share and the same
letters every time, that decoding reads common leetspeak back to English words while numbers,
decimals, times and emoticons stay as they are, that settings saved by the earlier page migrate, and
that empty, non-ASCII and megabyte input survive. The decoder's word list and letter-pair table are
built by `util/1337/bigrams.py` (needs `pip install wordfreq`); paste its two lines over `LEXICON` and
`BIGRAM` in the core, never edit them by hand.

## Favicon Generator

```sh
npm run test:favicon                      # or: node test/favicon_generator.mjs
node test/favicon_generator.mjs ico zip   # named suites only
```

`favicon_generator.mjs` runs the page's DOM-free `<script id="core">` in Node. The files it writes are
checked with independent readers: the `.ico` (BMP entries, flipped rows, AND mask) is decoded by
Pillow and the `.zip` by Python's `zipfile`, so both suites need `python3` with Pillow. It also holds
the HTML snippet to the files the package actually ships, and covers colour parsing (pasted
`rgb()`, short hex, stray spaces), crop placement, the old Favicon Studio's saved designs and SVGs
without a size. Suites: `crc`, `zip`, `ico`, `color`, `fit`, `text`, `migrate`, `svg`.

## Living RPS

```sh
npm run test:livingrps           # or: node test/living_rps.mjs
```

`living_rps.mjs` runs the DOM-free `<script id="core">` block of `games/living_rps.html` in Node: conversions
only ever follow the rock > scissors > paper > rock cycle, the army total and the walls hold, every board
finishes on phone, square and wide layouts (the late-game heat-up), a seed replays the same board, and the
underdog never pays less than the favourite. No browser, no server.

## Contents May Vary

```sh
npm run test:cmv                                   # or: node test/contents_may_vary.mjs
node test/contents_may_vary.mjs registry budget    # named suites only
node test/contents_may_vary.mjs pacing --world=guests --report
node test/contents_may_vary.mjs browser            # needs Playwright's Chromium; serves the repo itself
```

`contents_may_vary.mjs` holds `games/contents_may_vary.html`, an anthology of incremental games, to the
promises in `CONTENTS_MAY_VARY.md`. Every box's rules sit in a DOM-free `<script type="text/x-core">` block,
which the suite runs in Node with the page's own kit.

| suite | what it checks |
| --- | --- |
| `registry` | box ids are unique, the shipped boxes keep their ids and their order (saves depend on both), every box has a core, a title, a handling note, a souvenir, registers with `K.world` and ends with `K.complete`, keeps no storage of its own, and its core never calls `Math.random` |
| `budget` | the shell and kit, and each box (template plus core), against the weights the rulebook allows |
| `contract` | every core runs in Node and has the functions and both bots the shell relies on; a fresh state is not done; a seed gives the same start; an unknown action does nothing |
| `saves` | after 3, 15 and 40 minutes of play the state is plain data under 100 KB, a saved and loaded state carries on identically, and ten minutes away handed over in one step leave a valid state |
| `pacing` | on three seeds the eager bot takes at least 30 minutes and the casual one at most 90 (or the box's own tighter targets), neither waits too long for something new, something can be bought in the first minute, and progress never goes backwards |
| `starter` | box 1's rules: a perfect tap pays and streaks, the apprentice never bakes at the peak, a kitchen left alone earns well under a played one, rolling pins only take bulges about to burst, money alone never opens the Last Loaf and a cellar left to its pins proves far slower than a punched one, a quarter risen she heaves everywhere, a version 1 save keeps its place, and the end cannot be skipped |
| `lawn` | box 2's rules: a full grass box cuts nothing and the compost bin pays, a lawn stays cut until it is finished and pays its owner once before growing back, the judges pay straight stripes well over a ragged mow and need a mown lawn, the cutters lift off a show lawn so a turn on the headland cuts nothing, something that gets onto a show lawn keeps the judges away, dodges, and pays when seen off but not when left to wander, and midnight opens only when the string is mown |
| `clew` | box 3's rules (Tilt): a ball dropped from any column of any board, with or without the extra tulips, leaves within a minute; the first game lasts 8 to 30 seconds, chips the Big One and pays for a bulb; the thumb pours at its rate and letting go stops it; a tulip pays for what it holds and then closes; a broken block pays when it breaks, the game ends with the tray and the next one refills it while the Big One stays broken; with every bulb lit a game on the mountain still ends; fever rains across the board; a bomb breaks the blocks round it; the board never holds more than its cap and the overflow becomes mega balls; the Big One opens the next board and its panel, the last one is a box that opens one step at a time; saves from the three earlier versions start afresh |
| `flurry` | box 4's rules (Snow Day): a snowball thrown at a running kid lands on them, one crouched behind cover is safe from a plain ball and not from an ice ball; a run ends when you are too cold, and even with every warmth upgrade and nobody throwing; a kid's resolve stays down between runs, a kid with none left comes over and your side throws by itself; a snowball in the air can be swatted and one that gets through costs warmth; the sledge passes in front of every yard's cover; winning a yard moves the war on and keeps your side, the yeti comes over last and opening his present is the end |
| `warren` | box 5's rules (Here Be Rabbits): every folio's horde can reach the castle from every entrance; no rabbit is lost or made through waves with engines and the dragon (every rabbit that came in is slain, gone home from the wall, or still on the land); an undefended folio against the strongest wall is still lost, waits to be played again, and starts over at the first wave with a whole wall; once a wave is all in the next can be called early for leaf, and left alone it comes by itself after the pause; neither bot loses a folio more than four times (no farming) |
| `browser` | in Chromium: a first visit shows the title box, opening it lands in box 1, finishing a box lands in the next, the save remembers both, and every box starts and runs without errors on a phone and a desktop, Keep Off the Grass thins its grass when the blades make frames slow and only then, and moves through every place it has (street, three shows, cup final, midnight) without an error; every box, saved early, in the middle and seconds before its end, comes back from a reload with everything bought and earned (once from a hand-made save, once through the page's own save), Starter's recipe box is put away in its finale, Tilt never loads with a thumb on the board, and a box opened just before the page closed goes on into the next one |

When a box ships, append its id to `SHIPPED` at the top of the suite. A box whose rules can break quietly
gets a suite of its own here, named after its id.

