## Read this first

This file spent a year making the catalogue narrower, and it did it while every individual
entry in it was true. If you are about to propose something, read this section before the gap
lists, because the gap lists are not where the pressure comes from.

**The drift, measured on 2026-09-09** (92 games), comparing the 16 most recent against the 76
before them:

| | earlier 76 | last 16 |
|---|---|---|
| `multiplayer` tag | 18 (24%) | **0** |
| `aiPowered` | 7 in the whole catalogue | **0** |
| `competitive` tag | 19 | 1 |
| `card` + `board` + `strategy` + `trivia` categories | 16 | **0** |
| `logic` tag | 10 (13%) | 5 (31%) |
| median page size | 38–42 KB | **117 KB** |

Every one of the last sixteen is singleplayer, offline, keeps no shared state, ships no written
content, and is about three times the historical size. The site's own premise is that language
models wrote these, a Cloudflare proxy for calling one is already wired up and used by 27 tools,
and no game has called a model since `death_by_ai`. That is not a run of coincidences. It is this
file.

**Four things in here caused it.** They are worth naming because each one still looks reasonable
on its own:

1. *The "Findings worth reusing" essays below are the file's real instructions.* They are two
   thirds of the curated text, and all six narrate the same method: find a structural gap, run an
   exhaustive search, ship the table. Nobody wrote "build abstract combinatorial puzzles"
   anywhere. Six worked examples of one shape did it instead.

2. *The quality bar is denominated in a currency only one genre can pay.* Every essay earns its
   authority with a number from enumerating a combinatorial space — 614,656 rulebooks, 1,023
   vocabularies, 2,400 candidate holes. A game about timing, feel, humour, or another person
   cannot produce that number, so under this file it can never look rigorous, and it gets
   discarded at the proposal stage before anyone weighs whether it would be good. **Verification
   should fit the claim, not the file.** If the idea rests on a generator being varied, generate
   hundreds. If it rests on a joke landing, the verification is that someone laughed. If it rests
   on a game feeling good in the hand, the verification is playing it and showing the screenshots.
   An idea is not weaker because its risk cannot be enumerated; it is weaker when nobody checked
   the thing it actually depends on.

3. *"Tried and rejected" is the same direction three times.* Air hockey, Mini Metro, Into the
   Breach — every rejection on the list is of something physical, thematic, or genre-shaped. Each
   was turned down on its own merits and those judgements stand. Read as a block, which is how
   anyone skimming reads them, they say "non-abstract has been tried and it did not work here."
   That is not what they say individually and it is not true.

4. *The one force that would have corrected this was explicitly disarmed.* The line "an empty
   category is evidence about the catalogue, not about whether anyone wants to play the thing that
   would fill it" is correct as written, and it is also what made `multiplayer` going 24% → 0%
   unnoticeable for a year. Both halves are true: an empty category is not on its own a reason to
   build. A category that *emptied out* is a different fact, and it is worth looking at.

Most recently the drift produced a proposal for a language-decipherment deduction game — glyphs,
procedural grammar, exhaustive identifiability checking — pitched as filling a gap. It was the
seventh abstract deduction puzzle in a row and it was pitched without noticing that. Set aside for
that reason rather than on its merits; the idea is not on the rejected list.

## Axes, not categories

The catalogue's variety does not live in the `categories` field. It lives in axes that no field
records, and the recent entries have collapsed to one end of every one of them. When proposing,
say where the idea sits on these. Landing at the same end as the last five entries is not
disqualifying, but it should be a choice.

- **Alone ←→ with someone.** 18 games have a second player; `firebase.js` already carries six
  pages. Nothing in sixteen months. Pass-and-play on one device counts and needs no backend.
- **Deterministic ←→ a model in the loop.** `death_by_ai` and `mystery_ai` are among the most
  distinctive things here and there are seven of them, ever. The interesting version is a model as
  a *character or a judge* — something to persuade, something that rules on an answer no lookup
  table could — not a model as a content faucet.
- **Systems ←→ writing.** Nothing recent has a voice. No jokes, no world, nothing whose appeal is
  what it says. A page can be worth visiting because it is funny.
- **Deep ←→ immediate.** Ten-minute depth is a good target and it became the only target. `suika`,
  `stack_tower` and `downhill_dreamer` are excellent and are none of that.
- **Screen-only ←→ using the device.** Camera, microphone, pointer, gyroscope, touch. The tools
  side does this constantly (`ascii_camera`, `online_webcam_filters`, `overtone`); games almost
  never do.
- **Novel ←→ well-made version of a known thing.** Not a fallback — one of the main themes of the
  collection, and the clearest way it tracks what AI can actually do. A known game has a fixed,
  externally-defined target, so how close a model gets to it is a reading you can take year over
  year in a way that a novel mechanism never gives you: nobody can say whether an invented puzzle
  came out as well as it could have. A genuinely good Pac-Man, jigsaw, crossword or racing game is
  a first-class entry, and the Games backlog at the bottom of this file has been listing them
  unbuilt for years on the unstated grounds that they are unoriginal. Originality of mechanism is
  one virtue among several, and it is not the one this catalogue exists to demonstrate.
- **Big ←→ small.** The historical median page is about 40 KB. The recent median is 117 KB, and
  three of the last sixteen are over half a megabyte. Nothing was decided to make that happen. A
  40 KB page is not a lesser entry, and "it would only be small" is not a reason to drop an idea.

## Gaps worth filling

Checked against the catalogue on 2026-09-09 (92 games, 216 tools) and picked to fit the constraints
the rest of the collection works under — one file, no assets, reproducible from a seed. Anything
here may have been built since; the point is the shape of the gap, not the specific suggestion.
These are suggestions, not a queue, and an idea that is on none of these lists is not worse for it.

**Games — mechanism gaps**

- **Deck-builder.** The card games here are all classics — blackjack, freecell, crazy eights. None
  build a deck across a run.
- **Cipher-based word game.** Nothing here is a word game built on deduction from letter
  statistics; `cribwork` covers the workbench side, not the play.

**Games — the axes above**

- **Two players, one device.** Asymmetric information is the cheap way to make this good: the two
  halves of the screen know different things. No backend, no accounts.
- **A model you have to talk round.** A character with a position, a secret, or a price, that a
  language model plays and that you have to move. The proxy is already there.
- **Something with a voice.** A game that is funny, or that has a world, where the writing is the
  reason to stay.
- **Sixty seconds well spent.** One verb, immediate, no tutorial, a score you want to beat once
  more. Held to the same standard of polish as the ten-minute ones.
- **A sensor game.** Point the camera at something, blow into the microphone, tilt the phone.
  *Partly filled by `games/hummingbird.html` (microphone). Camera and gyroscope are still open on
  the games side — `push_mine` is the only other game that touches a sensor.*
- **A known genre, done properly.** Pac-Man, a racer, a platformer, a jigsaw from an image the
  player drops in, a crossword, bingo, a shooting gallery. Listed in the backlog below for years.
- **A toy, not a game.** `interactive_buddy` and `doodling` have no win state and are among the
  most replayed pages here. There has been nothing like them in a long time.
  *Filled by `games/strata.html` (a falling-sand world whose materials you discover).*

**Tools**

- **CSS keyframe editor.** Nine CSS tools exist and none of them touch `@keyframes`.
- **Cubic-bezier easing editor.** Pairs naturally with the above.
- **WCAG contrast checker.** There is a colour-blindness simulator but no contrast ratio checker.
- **CSS clip-path editor.** Visual polygon editing with copyable output.
- **Aspect ratio calculator** and **browser storage explorer** — small, useful, and on the list below
  for years.
- **Rhythm and timing.** Nothing measures how far off the beat you are — the open audio-side gap
  next to `overtone`, which handles pitch and explicitly does not handle this.
- **Hinting and rasterisation.** Nothing shows what a font does at 11px, where hinting and `gasp`
  decide whether it is readable at all. Open next to `sorts`.
- **Polyphonic pitch.** `overtone` is monophonic by design and reports the common subharmonic of a
  chord rather than guessing it is hearing one.

## Findings worth reusing

Technique notes from things that shipped. **These are notes on how a specific problem was solved,
not a template for what to build or a model of how a proposal should read.** Six of them describe
exhaustive search because six abstract puzzles were built in a row; that is a fact about the last
year, not a standard. Skim for the one that touches your problem and ignore the rest.

Filled since: hidden-rule deduction, by `games/glyphgate.html`; cooperating with recordings of your
own past, by `games/selfsame.html`; **pinball**, by `games/escapement.html` — swept-circle continuous
collision so nothing tunnels at any speed, flippers you can cradle on, habitrails, a slingshot that
throws along its own rubber, and a mission stack that bolts new parts onto the playfield as you go.
The physics core in it is reusable, though the two candidates once listed here for it are both rejected
below — a reusable core is a reason a build is cheap, never a reason the result is worth playing.

Filled since: classical cryptanalysis, by `tools/cribwork.html` — cipher identification from the index of
coincidence, solvers for the Caesar/affine/substitution/Vigenère/transposition families, and a cryptogram
worksheet. Nothing in the catalogue had touched ciphers beyond the toy converters (`1337`, `morse_code_translator`,
`base64_encoder_decoder`), which is the shape of gap worth looking for: a whole subject the collection only
gestures at. The neighbouring one still open is **cipher-based puzzle games** (nothing here is a word game
built on deduction from letter statistics).

Filled since: **fonts**, by `tools/sorts.html` — the structural gap in the tool catalogue: 215 tools, a great
deal of text and typography work among them, and not one that opened a font file. `file_type_identifier` sniffed
magic bytes and stopped; `character_map_explorer` browsed Unicode knowing nothing about any font. Sorts parses the
sfnt container itself — cmap, name, OS/2, post, fvar, GSUB/GPOS — and leads with the question people actually have:
paste your text and it names every character the font cannot draw. Three things in it are worth reusing. The parser
was checked field by field against fontTools over 147 real fonts and matches exactly, cmap coverage included, which
is the only reason the coverage and language claims can be stated flatly rather than hedged. Two cheaper approaches
were measured and thrown away first: detecting coverage by canvas width comparison scored 79.8% against the true
cmap, and pixel-exact render comparison did worse at 59.4% with 4,442 false positives — both depend on the reader's
installed fallback fonts, so neither can be trusted to describe a file. And the feature list measures rather than
asserts: each OpenType feature is rendered on and off and the advance widths compared, so the ones that genuinely
change your text are marked and the ones that do nothing to it are not oversold.

Still open on this side: **WOFF2 cannot be read byte by byte in a browser.** Its tables live in one Brotli stream and
`DecompressionStream` offers gzip and deflate but not br (checked, Chrome 141). A dictionary-free Brotli decoder would
have been small enough to ship, but 274 of 276 real WOFF2 files sampled from Google Fonts use the static dictionary,
so that shortcut is closed — full support means carrying the ~120KB dictionary. Sorts reads the WOFF2 table directory,
which is uncompressed, and renders the font, and says plainly that the rest is out of reach. The neighbouring gap still
open is **hinting and rasterisation**: nothing here shows what a font does at 11px, where hinting and `gasp` decide
whether it is readable at all.

Filled since: **pitch**, by `tools/overtone.html` — the audio-side version of the same gap, where a dozen
audio tools existed and not one showed you pitch. It is framed as an instrument rather than a tuner: a
cent-accurate pitch ribbon over time, a log-frequency spectrogram, a harmonic ladder that measures how far
each partial sits from a whole-number multiple (enough to show piano-string inharmonicity), and per-note
vibrato rate and depth, attack settling, sway and drift, plus a profile accumulated across held notes.
Two things in it are reusable: a YIN detector whose clarity gate was tuned by measurement (0.88 removed
all 729 octave errors across 5,760 synthetic frames while keeping every clean one), and the observation
that a pitch track is a moving average of the analysis window, so vibrato depth is attenuated by
sinc(pi·fv·W/sr) and can be corrected back out. Still open on the audio side: **rhythm and timing**
(nothing measures how far off the beat you are), and **polyphonic** pitch — Overtone is monophonic and
reports the common subharmonic of a chord rather than trying to guess that it is hearing one. An attempt
to detect chords from the spectrum was removed after it turned out to fire on hummed low notes: a
microphone that rolls off the fundamental leaves a spectrum shaped much like a chord's, and every
statistic that separated the two also mistook quiet fundamentals for chords.

Filled since: **programming games**, by `games/everywhere.html` — the structural gap on the game side, where
91 games contained nothing in which the player writes something that then runs without them. The first framing
was the obvious one, a procedurally generated RoboZZle: one board, find the short looping program. It was
measured and thrown away, and the measurement is the reusable part. Generating levels by sampling a program and
carving the path it walked gave boards that were 56% solvable in three instructions or fewer, and across 107
levels 44 had the *same* answer — walk forward, repeat. Rendering them as ASCII showed why: the colours were
noise, so either they meant nothing (a straight corridor with random paint) or the solution was an arbitrary
program nobody could deduce. Generating board-first — pick a path motif, then colour the cells by backtracking
search so an intended program template traverses it — fixed legibility completely, and made the problem worse:
colour became signal, and 51 of 60 boards then had *exactly* the template's four-line answer. Every level in a
family is the same puzzle. The general lesson, which is the third time this list has recorded a version of it:
in a puzzle whose answer is a short program, the space of sensible answers is small, so procedural boards
repeat the answer even when they look different.

What survived was the inversion: **the level is not a board, it is a set of boards.** The player writes one
rulebook and it must solve every maze the stage can generate, including the hundreds it never sees; the game
answers a failure by showing the specific maze that beat it with the robot's path drawn on it. That framing has
the property the single-board version lacked, and it was checked by exhaustive enumeration rather than assumed.
Of all 614,656 rulebooks three lines long, exactly **twelve** solve every perfect maze — six phrasings of the
right-hand rule and six of the left — and nothing of two lines works at all. Near-misses are dense and
instructive: the same three instructions in the two other orders fail on all 200 mazes, because a turn on line
one changes what line two is looking at. The slot budget turns out to be the difficulty dial: of the rulebooks
that solve the first maze, 100% are universal at four lines, 48% at six, and 5% at ten, with the median failure
on the third board — so a tight budget forbids overfitting and a generous one guarantees the counterexample
loop has something to show you.

Two results are worth keeping past this game. The first is a negative one. The intended final stage was mazes
with loops knocked through, where wall-following provably breaks, with chalk marks on the floor as the fix.
No small rulebook for it was found: exhaustive search over three lines, 51,840 programs formed by splicing one
or two chalk instructions into both wall-followers (none scoring above 298/300), seven hand-written
Trémaux-flavoured strategies (best 70/200), and seeded hill-climbing up to eight lines in two independent
implementations (best 96/120 at 7×7, decaying to 28/60 at 10×10 — the signature of a rule that is tuned rather
than general). The stage was cut. **A finite rulebook of this kind that solves braided mazes is still open**,
and probably needs edge-marks or a turn counter rather than one bit per tile.

The second is the finding that came out of chasing it, and it contradicts the premise the stage was built on:
**loops are not what beats wall-following.** Sweeping loop density with the goal in a corner, the right-hand
rule solved 200 of 200 at every density tried, from 0.02 to 0.20. The same rule on the same boards with the
goal moved to the middle fell from 190 to 57 of 200. Wall-following fails when the goal is not on the wall you
are holding; the loops were never the problem. The replacement stage came from asking what else breaks it and
verifying before building: take the sideways senses away and leave only "wall ahead", and a universal answer
still exists at four lines — at least five of the 6,561, all leaning on a trick the earlier stages never need,
the same line twice in a row. Verify a stage has an answer before designing around it; two of the six shipped
here changed shape because the search said no.

A later pass asked whether it had room to grow, and the measuring is the useful part, because almost
everything obvious turned out to be a dead end. Harder mazes do nothing: the wall-following rule is 200 of
200 at 25×25 and 200 of 200 with a random start cell and random facing, so difficulty cannot come from the
boards. An efficiency score is dead too — all 90 universal rulebooks of three and four lines average between
38.6 and 38.8 steps to the goal, a spread of nothing, against a shortest route of 23.7 that a robot with no
memory cannot reach. And new *worlds* mostly have no answers at all: one-way doors break the rule hard (12 of
200) but have no rulebook up to five lines even when given a "the way back is shut" sense; ice tiles (173 of
200) and spinner tiles (6 of 200) the same. That is three more stage ideas killed by search, on top of the
loops stage killed earlier.

What does work is the opposite of adding: take tools away. Keep the mazes and shrink the vocabulary, and
answers keep existing at longer and longer lengths — full vocabulary 3 lines, no side senses 4, only
wall-senses and no "open ahead" 5, no left turns 6, no side senses *and* no left turns 6. That generalises,
which is the actual find: a stage is just a subset of the vocabulary, there are 1,023 of them, and
solvability is monotone, so a subset's answer bounds every superset's. Processing subsets smallest-first and
inheriting those bounds turns an impossible enumeration into 19 seconds of work, and yields the whole table:
**163 of the 1,023 vocabularies can solve a maze at all**, with shortest rulebooks of 3 (38 of them), 4 (31),
5 (9) and 6 (85) lines. Shipping that table is what lets the endless mode hand out a handicap and promise it
can be beaten, and say in how many lines, without shipping any answers.

Two mechanical notes worth reusing. The table only became affordable after the machine was reimplemented
allocation-free — boards flattened to a Uint8Array of passable directions, and cycle detection against one
reusable stamped buffer instead of a Set per run — which was about thirty times faster and, checked against
the shipped engine over 480,000 runs, agrees on every one. The check earned its keep: the first version of it
disagreed on 0.17% of runs because the condition indices were mapped in the wrong order, which no amount of
staring would have caught. And the promise is verified against the boards the game actually generates, not
the ones the table was built on — every one of 200 Deep rounds re-checked on its own 200 mazes.

Filled since: **minigolf**, by `games/nine_holes.html`. Worth reusing are three results, all of which
contradicted what the design assumed before it was measured.

The cup's capture speed, not the level generator, decided whether open holes could exist at all. A
forgiving cup swallows any weight, so on a hole where you can see the flag every power drops and the
acceptance filter throws it out as a barn door — silently banning open holes and leaving a course of
nothing but blind doglegs. Over 2,400 candidates: at capture 9, 3% of accepted holes had line of sight
and 27% were rejected as barn doors; at capture 4, 31% and 4%. A single physics constant was producing
what read as a level-design problem.

"Every hole can be aced" was true and hollow. The coarse angular sweep only proves an ace exists near
some angle; refining it showed 10% of accepted holes had an ace window under one degree. The judge now
measures the real angular tolerance and requires 1.25 degrees, so the median hole gives you 2.25 and the
promise survives contact with a human hand.

Par cannot come from the optimum when every hole is aceable by construction — the optimum is always 1.
It has to come from how a plausible player actually fares, which makes the player model a tuned
parameter rather than a detail: at 2 degrees of aim error 95% of holes came out par 2 and difficulty
stopped showing, at 6 degrees par 5 became common, and 1.5 degrees gives 59% par 2 and 32% par 3 with
mean par rising across the tiers. The round is then ordered by measured par rather than by the nominal
difficulty tier, because the tiers turned out not to be monotone — tightening corridors made some holes
easier. Mean par by position is now 2, 2, 2, 2, 2.25, 2.5, 2.88, 3.5, 4.

A presentation pass afterwards produced two findings worth reusing for any canvas page here.
Splitting the scene into a baked layer and a live one is what makes detail affordable: everything that
cannot move — surround planting, table, felt, sand, slopes, rails, ambient occlusion — is drawn once into
an offscreen canvas per hole, and only the ball, trail, water, flag and particles are drawn per frame.
The rail itself is not tiles but an offset outline: dilate the play mask, subtract it, and the band that
falls out follows the hole's real shape at even width, where drawing it cell by cell wandered between one
and two cells thick and read as chunky. And the profiler contradicted the obvious guess about cost — the
blur and the dilation were 10ms and 22ms, while building those alpha buffers at full device resolution
cost about two seconds a hole. They are deliberately blurred, so resolution buys nothing there: building
them at 0.55 scale and scaling up on composite took a bake from 3.1s to 0.38s with no visible difference.
A full-screen vignette gradient filled per frame also cost more than the entire rest of the loop; baking
it took frames from 20ms to 16.7ms.

A later pass replaced the bitmap smoothing entirely, and the replacement is the reusable part.
Terrain lives on a grid, but a grid-shaped bunker looks like a spreadsheet, and smoothing the mask as a
bitmap gave soft mushy edges for a bake of nearly two seconds. Tracing the cell region to a polygon
instead — walk the boundary between filled and empty cells emitting each edge with the filled side on
its left, then round it with two passes of Chaikin corner cutting — gives crisp curved edges, exact
clipping, and a bake of 20ms rather than 1780ms. Two traps came with it, both found by looking at
screenshots rather than by reasoning. Corner cutting eats into convex corners, so a hazard smoothed
naively ends up smaller than the cells it stands for and can catch a ball on a square that did not look
like a hazard; hazards are grown outward first so the painted region is always a superset of the real
one. And offsetting a polygon by moving each vertex along its normal self-intersects wherever a concave
inlet is narrower than twice the offset, leaving an inverted loop that punched a hole clean through the
rail on about one hole in three; stroking the outline at twice the width and clipping to the far side
has no such failure mode. Unrelated but found the same way: the generator could wall off little pockets
of green that no ball can reach, which are not playable but do collect the whole of the edge shading and
render as a black blob, so a flood fill from the tee now turns anything unreachable back into rail.

The general lesson, which is the same one the rejected tactics prototype produced: the fraction of an
action space that is "good" measures nothing, because the space is mostly nonsense. Ask instead whether
a deliberately stupid player reaches the good play.

Filled since: **the maze chase**, by `games/scatter.html` — the first entry built deliberately against the
drift described at the top of this file, and the first "well-made known thing" since the drift began. The
useful part is that its central premise turned out to be **wrong**, and the measurement that killed it is
worth more than the game.

The pitch was that the original's four ghost personalities — Blinky chasing, Pinky's four-ahead cut with the
up-direction overflow bug, Inky's vector doubled through Blinky, Clyde losing his nerve inside eight tiles —
are not decoration but the entire difficulty, and that the naive all-chase every clone ships cannot catch
anyone. A Python prototype said exactly that: same evading player, same maze, same speeds, **21 deaths against
the authentic AI and 0 against naive chase**, with the naive ghosts clumped into one blob 35.6% of the time
against 15.3%. On that basis the game was approved and built.

Measured again in the finished game, with the same bot driving both builds, it reverses: **0 deaths authentic,
6 naive**, over 8 runs of 45 seconds each; ghost spread identical at 9.10 against 9.13 tiles; naive pincers
slightly *more* often, 12.7% against 10.7%. Naive chase is the harder game, and obviously so in hindsight —
the real ghosts spend **25% of level 1 in scatter**, walking deliberately away from you, and a naive chaser
never lets up.

Two lessons, and the first is the general one. **The prototype omitted the ghost house.** All four ghosts
started outside and on top of each other, so "bunching" measured the spawn arrangement rather than the
targeting, and the effect vanished once ghosts were released on the real dot counters (Pinky at 0, Inky at 30,
Clyde at 60). The prototype was faithful about the thing being tested and careless about the surrounding
machinery, which is the failure mode to watch for: it is not the model of the mechanism that is usually wrong,
it is what was left out around it.

The second is about the original rather than the clone. The ghost AI is not a difficulty system, it is a
**legibility** system. Four distinguishable characters and a quarter of the level where they let you go is
what makes Pac-Man learnable, pattern-playable and fair; a relentless chaser is harder and much worse. So the
fidelity is still worth having — just not for the reason claimed. The game now leads with a target overlay
that draws each ghost's chosen tile, Inky's construction line through Blinky and Clyde's eight-tile nerve
radius, which is the honest version of the pitch: not "this is what makes it hard" but "this is what it is
doing."

A polish pass added a practice mode and then measured whether it does anything, which produced a more
useful result than the feature. Against a bot that moves with intent but can only see ghosts two tiles away
— the obvious model of a beginner — **level 1 is cleared 8 of 8 with practice mode off and 8 of 8 with it
on**. The assist only starts to matter for a bot that also moves at random 55% of the time, and even there
it is 0 of 8 against 1 of 8, with average score up 37%. So slowing the ghosts is close to irrelevant: the
game is not beating people with speed, and an assist aimed at speed is aimed at the wrong thing. What beats
a human is not knowing where four ghosts are going at once, which is an argument for the target overlay and
for the new countdown strip to the next scatter, not for a difficulty slider. Practice mode stayed because
it is harmless and clearly labelled, but it is not the answer and is not described as one.

Three mechanical notes worth keeping. **The maze has a checksum**: the original is 240 pellets plus 4
energizers, mirror-symmetric, with every pellet reachable and exactly one sealed region (the 6x3 ghost house).
A hand-transcribed maze that hits all of those on the first try is almost certainly right, and it caught that
Pac-Man's start tile had been walled in — walls and empty floor both score zero pellets, so the count alone
would not have found it. **Tile-centre movement has a trap**: checking the wall ahead only on *arrival* at a
tile centre lets an actor parked on a centre walk straight into the wall on the next frame; the check has to
run before each move, not after. That one shipped as Pac-Man strolling through the maze walls and wrapping
across a row with no tunnel in it. And a **13-check spec suite run against the shipped page** rather than
against the prototype — the up-overflow firing only when facing up, Inky inheriting it through his own
two-ahead tile, Clyde flipping at exactly 8 tiles, the door passing eyes but not Pac-Man, the level-1 speed
and wave tables — is what makes it safe to say "faithful" in the description flatly instead of hedging.

Filled since: **the microphone**, by `games/hummingbird.html` — you hum, and a bird follows your
voice along a melody line. Four results are worth keeping.

**A pitch detector tuned for accuracy is the wrong instrument for a controller, and the difference is
one number.** Overtone's YIN was re-measured against 120,000 synthetic frames (3 timbres x 37 pitches
x 5 room conditions, including a laptop-mic low-end rolloff) purely on controller terms — latency,
dropped frames, octave jumps. A **1024-sample window** is the answer: 98-100% of frames pass the
0.88 clarity gate with **zero octave errors** and 0.3 cents of error on a clean tone. 512 samples
(12ms) collapses — it drops a third of all frames and throws 1-2% octave errors, which for a
controller means the avatar teleports an octave. 2048 and 4096 pass just as cleanly and buy nothing
but latency, so Overtone's default is 23ms of lag this game does not need. False firing turned out to
be a non-problem: 0 of 239 frames on digital silence, room tone, loud white noise, pink noise, typing
clicks and 50Hz mains hum.

**Then measure the same thing through the actual page, because it will disagree.** Chromium in a
container exposes no audio input device at all, so the fake-mic flags are useless; handing the page a
`MediaStreamAudioDestinationNode` playing a synthesised singer instead exercises the whole real chain
— getUserMedia, AnalyserNode, YIN, smoothing. It reported 100% detection and zero octave errors over
23 notes across A2-A4, and **82ms to land a note against the 23ms the offline test promised.** The gap
was the smoothing. One time constant cannot both iron out the wobble in a held note and get out of
the way when someone deliberately leaps, so the glide is now chosen by distance — jumps over a
semitone are followed almost at once — which took it to 65ms, close to the floor of window plus frame.

**The melody generator was measured, was bad, and the fix is the nine_holes shape.** The obvious
generator — key, chord progression, phrase repetition, step-versus-leap weighting — produced, over 400
lines, leaps of up to 28 semitones, ranges to 26 semitones (nobody can sing two octaves), and a
difficulty dial that ran **backwards**, with difficulty 0 leaping more than difficulty 0.5. "400/400
distinct melodies" was true and measured nothing. Growing a line and then *judging* it against range,
maximum leap and a minimum proportion of stepwise motion gives a ladder that climbs: median max leap
2 -> 4 -> 5 -> 7 semitones, stepwise motion 100% -> 85% -> 78% -> 75%, at a rejection cost of a few
milliseconds. The judge also caught a bug no amount of staring would have: a singer whose comfortable
range is eight semitones was being handed fourteen-semitone tunes, and the placement code quietly
shoved half of each one under their floor. Asking for no more range than the singer has fixed it, and
0% of notes now fall outside the voice across 8,400 songs at three voice widths.

**The sloppy-player model is the tuned parameter, and the first one was nonsense.** Testing the
difficulty curve with a bot whose pitch was jittered every frame said ±0.9 semitones scored 100% at
every meadow — because white noise is exactly what the game's own smoothing removes. Real amateur
singing is slow drift, a per-note bias and a late reaction to a leap. Modelled that way the meadows
separate properly: a ±0.9-semitone singer goes 100% -> 96% -> 57% -> 43% across the journey while an
accurate one stays at 100% throughout and a random one never breaks 2%. This is the third time this
file has recorded a version of the same lesson — *what is wrong is usually the machinery around the
thing being tested, not the model of the thing itself.*

One mechanical note, and it is the nine_holes finding again: painting a full-screen sky gradient, three
filled hill paths and a handful of clouds every frame cost **39ms a frame at desktop size — 25fps —
against 16.7ms on a phone**, because none of it moved. Baking the backdrop once per meadow and capping
the backing store by pixel budget rather than by device ratio alone took it to 16.7ms on both.

A polish pass afterwards produced one note worth reusing for any drawn character on a canvas.
The bird's wings were stacked **behind** her body, which is invisible at game size and reads as a
broken sprite the moment anyone actually looks — a bird with no near wing at all. A character seen
side-on needs both: a far wing behind the body and a near wing in front of it, beating together. The
way to see this, and the reason it survived a whole build unnoticed, is to render the character on a
contact sheet at 4x through a full animation cycle and in each of its states. At that size three more
faults were obvious that no test would ever have failed on — a beak longer than her body, a tail like
a fish fin, and a downstroke that swung the wing across her chest like a leaf, all of which came from
numbers that looked reasonable in code.

Once believed, now false, and corrected 2026-09-09: **an offline environment cannot verify a
model-in-the-loop game at all.** It depends entirely on the sandbox. A later session reached
`https://chatgpt.tobiasmue91.workers.dev/` fine through its egress proxy and ran ~700 scored calls
against it. Two mechanical notes for whoever tries next: Python's `urllib` got a flat 403 from that
proxy where `curl` succeeded, so shell out to `curl` rather than concluding the host is blocked; and
the worker passes `response_format: {"type":"json_object"}` straight through, which is what makes a
scored game practical. **Check before assuming you cannot measure it.**

What that session measured, for the still-open "a model you have to talk round" gap. The idea was a
council you argue in front of, and the finding is worth keeping whatever gets built there:
**asking a model to play a stubborn character makes it immovable in both directions.** Under a
"be hard to move by flattery" system prompt, five characters over 300 calls dropped 2.17 points on
an argument that threatened what they privately wanted and correctly ignored flattery (-0.18) — but
went *up* on the argument that guaranteed it exactly **0 times out of 60**. Replacing the character
acting with an explicit numeric rubric, and letting the model judge relevance rather than perform
stubbornness, separates cleanly: aligned **+2.75 (20/20 up)**, threatening **-3.00 (20/20 down)**,
flattery **0.00 (20/20 unchanged)**. Scoring a whole five-member room in one call per turn agreed
with hand labels 94.7% of the time over 320 judgements with **zero false negatives**, and the
disagreements were mostly the model catching side-effects the labels missed. Broken promises land
too: contradict an earlier promise and the member relying on it drops 3, 8/8. One defect to design
around — told "earlier promises: none", it still invented a broken promise and scored it, 8/8, so a
breach has to name which promise it broke and be checked against the real list. Two things did not
survive: characters leak a "private" concern in 45-75% of replies even under pure flattery, so
hidden levers do not work and the concerns may as well be public; and the setting matters more than
the machinery — a town planning meeting was correctly rejected as a page nobody would open.

Filled since: **the material sandbox**, by `games/strata.html` — the "toy, not a game" gap, and the
first thing here with no win state since `interactive_buddy`. 26 materials, five to start, the rest
discovered by putting things together. Five results, and four of them are the same lesson in
different clothes: *the prototype was faithful about the mechanism and careless about everything
around it.*

**The stupid-player test is the whole verification, and it must run against the shipped page.** A
Python prototype of the reaction network said a bot that drops a blob of a random known material in
a random place, 70 times, ends up knowing 13.4 of 23. The finished engine agreed on the total —
13.6 — and disagreed completely on the composition: **soil, ore and salt were found 0/10 times.**
The bot pours from the sky and never digs, so the entire buried layer, and the metal, rust and acid
gated behind it, was unreachable by anything except an action the game never suggested. Digging now
discovers what it cuts through and the spade is called Dig, not Erase.

**A hub with one improbable recipe is a dead tree.** Lava gates obsidian, metal, acid and the main
route to glass, and its only recipe was fire sitting on stone at p=0.006 — which never happens,
because fire without fuel dies in under a second. It came out **0/10**. Two fixes, both more
legible than the constant they replaced: heat accumulates in stone and sand under sustained fire, so
building a bonfire on a stone floor genuinely melts it; and sealed magma chambers sit at the bottom
of the world, so digging far enough down also works. Lava is now found by 7 of 12 random bots and
the final curve is 5 -> **mean 18.1 of 26** (min 13, max 25) over 12 runs of 80 drops, with a
reliable early ladder (plant, salt, ore, oil, wood all 12/12), a middle that half of players reach
(steam, snow, ice, charcoal, lava 7-9/12) and a real tail still out there (obsidian 2/12, rust 1/12,
acid 0/12 — reachable, since a deliberate player gets 23/26, just not by accident).

**A simulation will hand the player discoveries nobody earned, and it will do it out of sight.** The
generated magma reacted with the ore and salt it happened to touch, so **8 of 8 untouched worlds**
announced Lava and Metal before anyone clicked anything. Sealing the magma in rock did not work
either — it melts its own cage in about a second and then discovers itself. The fix generalises past
this game: **player influence is a per-cell property that propagates with the matter.** Painting or
digging marks a cell; a reaction marks both sides if either was marked; movement carries the mark
along; and nothing is ever discovered in an unmarked cell. Deep magma can now do whatever it likes
in the dark. The check that catches this class of bug is one line — *open the world, touch nothing
for nine seconds, assert the count has not moved* — and it is worth writing for anything with an
autonomous simulation behind it.

**A world that shows you its own map has nothing to discover.** The strata rendered in full from the
first frame, so the salt seam was a white stripe you simply dug to. Ground is now opaque until an
air pocket *the player has reached* touches it, with light creeping through connected air one cell
per frame. The first attempt at this still leaked, and only a screenshot showed why: unexplored
caverns were drawn as cave-dark rather than rock, so every cavity in the world was a legible black
silhouette against the grey. Both the fault and the fix were invisible in code and obvious in a
picture.

A later pass, driven by playtest feedback, produced two bugs worth keeping and one method note.

**"It crashed" was the world being deleted, and the cause was in the brush, not the simulation.** The
report was that dragging fire around to clear the board broke the game. Reproducing it rather than
adding the requested Clear button found the real fault: painting a material *overwrote* whatever
occupied the cell, so a fire stroke replaced terrain with fire, which then burnt out and left
nothing. Measured over a scripted eight-stroke sweep, occupied cells fell from **23,263 to 570** —
bare bedrock. Placing now only fills empty space and Dig is the only thing that removes matter, which
holds the same sweep at ~17,900. The general point is that a destructive brush is indistinguishable
from a crash to the person holding it, and the bug report will describe the symptom in the
simulation's terms even though nothing in the simulation is wrong.

**Anything that converts its neighbours into copies of itself needs a brake, and it will not show up
in a short test.** Lava's own heat melted the rock around it, so a single pool the player touched
turned the world molten without limit — 296 cells to 2,098 and still climbing fifteen seconds later
with no fire anywhere. It never appeared in any earlier measurement because those ran for a few
seconds and the growth is slow. The fix is physical rather than a fudged constant: molten rock chills
against cold rock, so lava contributes no heat to melting stone (only real fire does), and a flow with
few hot neighbours crusts over. Lava now recedes, 296 to 97 over the same run. Worth running any
autonomous simulation for a minute with nobody touching it and plotting each element's population,
not just checking it looks right.

**Adding materials moved the tail, not the middle.** Eight more (mud, clay, ceramic, coal, diamond,
steel, tar, gas) took the set from 26 to 34, extending the burial chain to plant -> oil and charcoal ->
coal -> diamond. The random-bot curve barely moved — mean 18.1 of 26 became **18.2 of 34** — because
every new material needs burial, sustained heat, or waiting, and none of that happens by accident.
That is the right shape for a toy: the same generous early ladder, and sixteen rather than eight
things left that only a deliberate player will reach. It does mean the headline "found by flailing"
number stops being a useful summary once a collection grows a deliberate tier, and the reachability
test for a knowledgeable player becomes the measurement that matters.

**A palette can be measured instead of eyeballed.** The request was a high-contrast mode for telling
visually similar materials apart. Rather than judging swatches by eye, computing CIE76 distance
between all pairs names the actual offenders and scores the fix: the normal palette's closest pair is
**dE 2.1** (soil/mud), with 15 pairs under dE 10; the high-contrast palette went to dE 7.2, and
tuning the six worst pairs it named took it to **dE 13.0 with nothing under 10**. Three rounds of
this took a few minutes and are far more reliable than looking at a contact sheet, because the eye
adapts to a picture and a number does not.

**Two mechanical notes.** Iterating occupied cells instead of scanning the grid was about 30x, and
is the only reason the headless experiments were affordable at all. And sizing the world from the
viewport against a fixed **cell budget** — `h = sqrt(33000/aspect)`, clamped — rather than a fixed
grid gives 237x140 on a desktop and 132x250 on a phone, both filling the screen with no letterbox
and both landing at 16.7ms median with ~18k occupied cells. Fixing the grid and letterboxing it,
which was the first attempt, wasted about a third of a phone screen.

## Tried and rejected

Built or prototyped, then deliberately not shipped. These are **not** open gaps — do not re-propose
them, and do not treat the empty space they leave in the catalogue as an opportunity. The catalogue
being thin somewhere is not on its own a reason to build there. Two of the entries below were
recommended as gaps for exactly that bad reason before being turned down; an empty category is
evidence about the catalogue, not about whether anyone wants to play the thing that would fill it.

One caveat on reading this list, added 2026-09-09. All three rejections below are of something
physical, thematic or genre-shaped, and the taste judgements in them stand exactly as written. But
three entries pointing the same way is a coincidence of what happened to get prototyped, not a
ruling on that whole direction, and treating it as one is part of how the catalogue narrowed. These
reject air hockey, line-routing sims and grid tactics. They do not reject making something physical.

- **Air hockey.** Rejected. Not because the physics duplicates `pong` — a free 2D mallet with real
  momentum transfer is a genuinely different control space from a paddle on a rail — but because
  nothing about that survives to the catalogue card, where it reads as two paddles and a bouncing
  thing, and the momentum transfer that makes it interesting is already the whole of `8-ball`. A worse
  `pong` next to a better `8-ball`.

- **Line-routing sims** (Mini Metro's shape: growing demand, limited track, procedural maps). Rejected
  on taste. The genre as a whole, not this framing of it.

- **Turn-based tactics on a grid** (Into the Breach's shape: small grid, perfect information, enemies
  that telegraph next turn's move). Rejected on taste, not on mechanics — it was tried and was not
  interesting enough to put on the page. `strategy` being the thinnest category does not resurrect it.
  Nor do its variants: the version where the player has no weapon at all and every kill comes from
  shoving enemies into each other, into walls, or into their own crossfire, is the same idea and is
  also rejected.

  Worth keeping from the prototyping, because it generalises past this idea: exhaustive enumeration
  showed that under 1% of legal turns were both safe and productive, which looked like difficulty and
  was not. A deliberately myopic greedy player — deflect unit by unit, no lookahead — survived 97% of
  solvable boards. Density of good plays in an action space measures nothing; the space is mostly
  pointless wandering. Measure instead whether a stupid heuristic reaches the good play.

## Other
- household planner
  - single time tasks that are removed after being completed
- autocontinue script
  - on network error, copy the text that has already been written and append it to the last user message with the words "you already started responding but got cut off due to an error: <cutMessage>"
- argumentator
  - add permalinks to the generated arguments
- auto-improver script
  - improvement history, to prevent repeated or duplicate improvements
- userscript to let gpt-4 communicate with gpt-3.5

## Practical Tools
- csv<->json converter
- text<->morse converter
- text<->emoji converter (GPTranslator can do that! :D)
- form builder
- text<->ascii converter
- ASCII Art Generator
- Image to Text Converter
- CSS Beautifier
- Akinator
- CSS Animation Creator: An editor to create custom CSS animations with keyframes, easing, and delay settings.
- Broken Link Checker: A tool to check a list of URLs for broken links and report their status.
- Currency Converter: A real-time currency converter using exchange rate APIs to provide accurate conversions.
- SVG Editor: A simple SVG editing tool to modify shapes, colors, and sizes of SVG files.
- Audio Visualizer: A tool to generate visual representations of audio files based on waveform or frequency data.
- Browser Storage Explorer: A tool to view and manage browser storage (local and session storage) data for debugging purposes.
- CSS Flexbox Builder: A visual builder for creating and customizing CSS flexbox layouts, generating the corresponding code.
- Keyboard Shortcut Tester: A tool for users to test and discover various keyboard shortcuts for different operating systems and applications.
- Favicon Generator: A tool to create and download favicons in multiple sizes and formats from an uploaded image.
- Image Placeholder Generator: A tool to generate placeholder images with customizable dimensions, colors, and text for use during website development.
- Website Color Extractor: A tool to extract the color palette from a website URL or CSS code.
- Online Flowchart Maker: A simple flowchart creation tool with drag-and-drop functionality.
- Aspect Ratio Calculator: A tool to calculate the aspect ratio of images or videos, and resize dimensions while maintaining the aspect ratio.
- CSS Grid Builder: A visual builder for creating and customizing CSS grid layouts, generating the corresponding code.
- Font Pairing Tool: A tool to preview and compare different font pairings for web design.
- Image to ASCII Converter: A tool to convert images into ASCII art, with options for customization.
- Morse Code Translator: A tool to convert text to Morse code and vice versa.
- Online Banner Maker: A simple banner creation tool to design custom banners for websites and social media.
- Online Signature Maker: A tool to create and download digital signatures using a drawing interface.
- CSS Variables Generator: A tool to manage and generate CSS variables for consistent styling across projects.
- Online Mind Mapping: A simple mind mapping tool to organize and visualize ideas and concepts.
- CSS Transform Playground: A playground for experimenting with CSS transform properties, such as scale, rotate, and skew.
- Browser Compatibility Checker: A tool to check the compatibility of HTML, CSS, and JavaScript features with various browser versions.
- CSS Blend Modes Generator: A tool to experiment with different CSS blend modes on images or backgrounds.
- Online Whiteboard: A collaborative whiteboard tool for users to draw, write, and share ideas in real-time.
- Sitemap Visualizer: A tool to generate visual sitemaps from XML files or website URLs.
- Web Accessibility Checker: A tool to identify potential accessibility issues in HTML and CSS code.
- Online Photo Collage Maker: A tool to create custom photo collages from uploaded images.
- CSS Clip Path Generator: A tool to create and export custom CSS clip paths using a visual editor.
- Browser Mockup Generator: A tool to generate browser mockups of websites or app interfaces.
- Online Diagram Maker: A tool for creating various types of diagrams, such as flowcharts, Venn diagrams, and organizational charts.
- Online Sticky Notes: A tool to create, edit, and manage digital sticky notes.
- CSS Pseudo-Class Tester: A tool to experiment with various CSS pseudo-classes and see their effects in real-time.
- Online Logo Maker: A simple logo creation tool with customizable shapes, colors, and fonts.
- File Format Converter: A tool to convert files between different formats, such as image, audio, or document types.
- Character Encoding Converter: A tool to convert text between different character encodings, like UTF-8, ISO-8859-1, and Windows-1252.
- Online Icon Editor: A tool to create and modify icons in various sizes and formats, such as ICO, PNG, and SVG.
- CSS Filters Playground: A playground for experimenting with different CSS filters, such as blur, brightness, and contrast.
- Online Post-it Board: A collaborative board for users to create, edit, and organize digital Post-it notes.
- CSS Selector Tester: A tool to test and experiment with CSS selectors on sample HTML code.
- CSS Box Model Visualizer: A tool to visualize and understand the CSS box model, with options to modify padding, border, and margin values.
- Online Calendar Creator: A tool to create and download custom calendars with customizable dates, holidays, and events.
- JavaScript Event Listener Tester: A tool to test and experiment with JavaScript event listeners and their effects on HTML elements.
- Web Font Tester: A tool to preview and compare different web fonts on sample text, with options to adjust size, color, and other styling properties.
- Online Receipt Generator: A tool to create and download custom receipts for personal or business purposes.
- CSS Background Patterns Generator: A tool to create and customize repeating background patterns using CSS.
- "AI Cooking Challenge": Players input ingredients they have on hand, and your API generates creative and unique recipes to try. Players can adjust the complexity, cuisine style, and dietary preferences.
- "CodeGPT": Players input the desired functionality and language for a simple programming task, and your API generates the necessary code. Players can adjust the level of optimization, readability, and programming paradigms.
- "AI Poetry Slam": Players input a theme, style, and mood for a poem, and your API generates a unique poem based on their preferences. Players can challenge friends to create better poems with the same parameters and vote on their favorites.
- "GPT Mind Mapper": Users input a central topic or problem, and your API generates a mind map with related subtopics, ideas, and connections. Users can customize the map's complexity, depth, and level of detail.
- "AI Study Buddy": Users input a subject, topic, or question, and your API generates a concise summary, explanation, or tutorial. Users can adjust the level of detail, difficulty, and learning style.
- "GPT DIY Guide": Users input a home improvement or repair project, and your API generates step-by-step instructions and a list of necessary tools and materials. Users can adjust the level of detail, difficulty, and project type.
- "AI Riddle Inventor": Players input a topic or theme, and your API generates original riddles with answers. Players can adjust the difficulty, humor, and complexity of the riddles.
- "GPT Skill Builder": Users input a skill they want to learn or improve (e.g., public speaking, negotiation, cooking, etc.) and provide their current level of expertise. Your API generates a customized learning plan with resources, exercises, and milestones. Users can adjust the level of detail, pace, and focus on specific sub-skills.
- "AI Life Event Planner": Users input the type of event they're planning (wedding, party, corporate function, etc.) and provide relevant details, such as budget, guest count, and theme. Your API generates a comprehensive plan, including checklists, timelines, and vendor recommendations. Users can adjust the level of detail, uniqueness, and formality.
- "GPT Creative Prompt Generator": Users input a preferred medium (writing, painting, photography, etc.) and a theme or emotion, and your API generates a series of unique creative prompts to inspire their work. Users can customize the level of challenge, abstractness, and number of prompts generated.
- "AI Text Naturalizer" which aims to modify AI-generated text to make it appear more human-like and less recognizable by tools like ZeroGPT.
- CSS Grid Layout Generator
- Invoice Generator
- SVG Editor
- Font Pairing Tool
- Animated GIF Maker
- Photo Collage Creator
- Color Palette Generator
- Website Screenshot Tool
- Online Video Trimmer
- Icon Library and Generator
- Audio Converter
- Video to GIF Converter
- Online Flowchart Maker
- Online Mind Map Creator
- Text to Speech Converter
- Speech to Text Transcription Tool
- Online Meme Generator
- Online Video Editor
- Character Name Generator
- Online Logo Maker
- Browser Compatibility Checker
- Email Signature Generator
- Language Translator
- Online Music Editor
- Social Media Post Designer
- Recipe Builder
- Online PDF Editor
- Banner Ad Creator
- Online Calendar Maker
- GIF to Video Converter
- Online Whiteboard
- Social Media Image Resizer
- IP Address Lookup Tool
- Online File Converter
- Online XML Editor
- Resumé Builder
- Online Sketchpad
- Website Accessibility Checker
- Online Video Subtitle Editor
- Screen Recorder
- Online Slideshow Maker
- Online Budget Planner
- Online Grammar Checker
- Online Image Vectorizer
- Color Contrast Checker
- Meta Tag Analyzer
- Online Poster Maker
- Online Typography Generator
- Online Icon Editor

## Games
- War (Card Game)
- Snake Ladder
- Bouncing Ball Shooter
- Pac-Man clone
- Trivia Quiz
- Crossword Puzzle
- Jigsaw Puzzle
- Solitaire
- Pinball
- Roulette
- Shooting Gallery
- Scrabble
- Checkers
- Backgammon
- Bingo
- Racing Game
- Platformer
- Maze Runner
- Archery Game
- Ice Hockey
- Pool
- Basketball
- Air Hockey
- Racing Game clone
- Tower Defense
- Dragon Slayer
- Kung Fu Fighting
- Mastermind
- Music Rhythm Game
- Treasure Hunt
- Ball Drop Game
- Coding challenges as game idea provider
- human benchmark


## Plugins
- a plugin that looks for the cheapest price of a specific product.
- a plugin for web developers that lets users perform acceptance (or E2E) tests on a specified web service; can be expanded to let ChatGPT also perform performance checks, look for console errors, check for security flaws and be a mighty tool for asserting the quality a website as a whole while giving improvement suggestions
- use ChatGPT to assign a trust value to a website; as the web is flooded with scam sites, fake shops and unserious businesses and ChatGPT might be able to detect and analyze such websites before they even appear on TrustPilot and co
- a "discover" plugin that helps the user to discover new content for specific topics (music, tv series, movies etc.) while ChatGPT considers the users taste based on existing public accessible information (imdb ratings given by the user, spotify favorite song playlists, myanimelist list etc.) or based on a list of favorites provided by the user

## API Functions
- add web search functionality
- web voice assistant (maybe app later)
