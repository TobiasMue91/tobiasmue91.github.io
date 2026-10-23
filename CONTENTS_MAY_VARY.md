# Contents May Vary

The rulebook for `games/contents_may_vary.html`. Read all of it before touching that file; it is the
one place where the reasoning behind the game is written down, and every session that adds a box adds
a line to it.

**Contents May Vary** is an incremental anthology: a stack of boxes, and every box holds a complete
incremental game with its own rules, its own art direction and its own sound. The player opens the
first box and falls into it. Each game ends by revealing a box drawn in that game's style; opening it
is the way into the next game, which the player knows nothing about until it is around them. After
the last box there is a note that says the next one is still being packed. The shelf keeps every box
opened so far, with a souvenir, and any of them can be played again.

It is meant to grow for a long time, one box per session or so, and to stay surprising: a cosy
sourdough kitchen can be followed by a haunted house in a silent film, and that by anything at all.

## The rules

1. **One file, one block per box.** Everything lives in `games/contents_may_vary.html`. A box is one
   contiguous block above the marker `the next box goes above this line`: a header comment, a
   `<template data-world="id" data-title="…" data-handling="…">` holding the box's whole document
   (souvenir, fonts, style, markup, view script) and a `<script type="text/x-core" data-world="id">`
   holding its rules. Nothing of a box lives anywhere else, and a box never reaches into another.
2. **Proportionate.** A box weighs at most **120 KB** (template plus core, unminified, as the test
   measures it) and should aim for 100; the shell and kit at most 72 KB. Quality is bought with craft,
   not with bulk: a box that wants more room cuts something first. Libraries a box loads from a CDN
   inside its own template do not count, but must be pinned to an exact version.
3. **As different as possible.** Every box differs from every box before it. The ledger below
   records each box on seven axes — the verb (what the hands do), the loop, the art medium, the
   palette, the era or genre, the sound, and the interface metaphor. A new box must be new on at least
   five of the seven, and may share none with the box right before it. Absurd neighbours are welcome.
   Beyond the axes, a box must also *feel* different in the hands: its rhythm (wait for a moment, then
   tap; aim and release; drag and sweep; choose and watch it play out; keep many things in the air)
   and the way it is drawn (canvas line art, cut-out puppets, pixels, voxels, real-time 3D,
   isometric, photo-real) differ from the box right before it. A player who just spent forty minutes
   waiting for jars to peak does not want to spend the next forty waiting for people to step under a
   chandelier, however different the two look.
4. **Maximum quality.** Use every resource there is: real-input Playwright runs, filmstrips of the
   key moments at phone and desktop sizes, critic subagents with no stake in the work, bots that play
   the whole game. A box ships when a harsh critic scores it at least 8 out of 10 on first impression,
   clarity, art direction, phone layout and feel, or after four rounds of fixes, saying which scores
   stayed lower. `.claude/skills/next-box` is the procedure.
5. **Compare before choosing.** Each session that starts a box writes down at least eight ideas,
   each as a pair (mechanic and art direction), scores them for surprise, depth, fit to a 30 to 90
   minute game, and difference from the ledger, and picks one. Runners-up go into the list of ideas
   below, which is a well, not a queue.
6. **Thirty to ninety minutes.** The eager bot (a quick, attentive player) may not finish a box in
   under 30 minutes, the casual one (slower, distracted, takes breaks) not in over 90; neither may
   wait more than five minutes (the casual eight) for something new. The test enforces all three.
   Complexity can vary: a short, sharp box is as welcome as a deep one.
7. **Every box is a surprise.** Nothing outside a box tells what is in it: not the title screen, not
   the box before it, not the shelf until it is opened. The only hints are the box's handling note
   ("Contains live culture.", "Do not open after dark.") and, once opened, its souvenir.
8. **The way out is a box.** A game ends by revealing a box drawn in its own world and style — baked
   into a loaf, delivered as a crate — that shows the next box's number (`K.next.n`). The player
   opens it; the world calls `K.complete(rect)` with the box's on-screen rectangle, and the shell
   dives into it. The box never names or hints at what is inside.
9. **Append only.** Saves name boxes by id and play them in file order. Never reorder, rename or
   remove a box that has shipped; fix it in place instead. When a box's state changes shape, raise
   `CORE.version` and give the core a `migrate(state, fromVersion)`. A box that is built but not yet
   in the stack is a **draft**: its template carries `data-draft`, it sits *below* the marker, it is
   not part of the play order, and it plays on its own through `?world=<id>`. Taking a draft into the
   stack means moving its block above the marker (and dropping `data-draft`) when it is the next box
   in line; a draft is never put in front of a box that has shipped.
10. **It teaches itself in its own language.** No wall of text and no tutorial screen: the first
    thirty seconds show what to do through the world (a hand pointing, something glowing, an
    intertitle, a note in dough). A mistake explains itself where it happened.
11. **Phone first.** Every box plays at 390×844 and at 1280×800, with touch targets of at least 44 px.
    Phone frames come before desktop frames in every critique.
12. **The core is pure.** A core has no DOM, no clock and no `Math.random`: its PRNG lives in its state
    (`KIT.rand(state)`), so a seed replays a game and a saved state carries on exactly. Its state is
    plain JSON. The view never decides a rule.
13. **Its own sound.** Every box brings its own sound effects and music, played through `K.audio`
    (the box's `sfx` and `music` gains on the page's one AudioContext). The shell unlocks audio on
    the first touch and owns the volume settings.
14. **Kind to bodies.** Honour `K.reduced` (fewer particles, no shake, no grain) and never flash
    more than three times a second.

## How the file is built

Top to bottom: the shell's style and markup (the title box, the packing slip menu, the shelf, the
trip into a box), `#core-kit` (pure helpers every core may use, also run by the tests in Node),
`#kit-frame` (defines `K` inside every world), `#shell` (saves, order, mounting, transitions, dev
tools), then the boxes.

Each box runs in its own `<iframe srcdoc>`, built when it is mounted from the kit, the box's core,
the kit frame and the template, so its CSS and globals never meet another box's. Only the box being
played is mounted.

### The core contract

```js
const CORE = {
  version: 1,
  init(seed),           // a fresh state
  step(S, dt),          // advance the rules (sub-step inside if you need to: the shell may pass ten minutes)
  act(S, what, a, b),   // everything the player can do; returns false when nothing happened
  done(S),              // true once the way out has been opened
  progress(S),          // 0..1, never backwards; the shelf and the menu show it
  milestones(S),        // a number that changes whenever something new happens (the pacing test reads it)
  bots: { eager, casual },   // (S, mem, dt) => acts through act(), with a person's limits built in
  pace: { eager, casual, gap },   // optional: tighter targets than the defaults for this box
  migrate(S, from)      // optional, once version > 1
};
```

Events the view should show go into `S.ev` (capped), and the view drains them every frame.

### `K`, the only door between a box and the shell

| | |
| --- | --- |
| `K.world({ start(saved, info), save(), pause?(), resume?(), away?(seconds), settings?(s) })` | register the box; `start` gets the saved state or `null` |
| `K.loop(fn(dt, now))` | every frame; `dt` is game seconds, 0 while paused, at most 0.25, times `?speed` |
| `K.complete(rect)` | the box is open: the shell dives into `rect` (screen pixels) |
| `K.progress(p)` | report 0..1 now and then |
| `K.save()`, `K.unlock()` | ask for a save soon; unlock audio after a gesture |
| `K.audio` | `{ ctx, sfx, music }` or `null` |
| `K.id`, `K.n`, `K.next`, `K.firstVisit`, `K.away`, `K.settings`, `K.reduced`, `K.paused`, `K.dev` | facts about this mount |
| everything in `KIT` | `fmt`, `time`, `rand`, `rng`, `hash`, `clamp`, `lerp`, `smooth`, `ease`, `cost`, `costMany`, `canBuy`, `simulate` |

Esc and the box chip open the packing slip (the menu); the shell pauses the box while it is open.

### Developing a box

```
games/contents_may_vary.html?world=<id>              play one box on its own (nothing is saved)
games/contents_may_vary.html?world=<id>&at=20        start from 20 minutes of the eager bot's game (&bot=casual)
                                ...&speed=4 &seed=3 &dev &keep (keep: play into the real save)
```

`K.debug` is a convention, not part of the contract: give each view one with `state()` and whatever
a Playwright script needs to find (screen rectangles of the things to tap, the way out).

## Adding a box

1. Read this file, the ledger and the ideas. Run `npm run test:cmv` and keep it green throughout.
2. Write down at least eight pairs of mechanic and art direction, score them against rule 3 and the
   ledger, and choose. Name the box (an id that is a plain word, a title, a handling note that hints
   at the danger but not the content).
3. Build the core first, in a scratch file, with its two bots; tune it with `KIT.simulate` until the
   pacing is right for both bots across several seeds, with no cliffs and no dead stretches.
4. Mock up the look as one still frame and have a critic look at it before building the whole view.
5. Build the view as a template, splice it above the marker, add the id to `SHIPPED` in
   `test/contents_may_vary.mjs`, and add the box's own suite there if a rule can break quietly.
6. Play it with real input in Playwright on a phone and a desktop, make filmstrips of the first
   minute, a typical action, every big moment and the ending, and run critic rounds (rule 4).
7. Fill in the ledger row, move the runners-up into the ideas, write the lessons you learnt, set the
   page's `updated` date in `data/games.json`, and commit.

## The ledger

| № | id | title · handling | verb | loop | medium | palette | era · genre | sound | interface | ends with |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `starter` | Starter · "Contains live culture." | tap jars at their peak, swipe along a scoring line, punch bulges flat | timing streaks → bench and oven → containing a creature that grows through a house | 1950s cookbook print: key line, misregistered colour plates, halftone | mint, tomato, mustard, cream | mid-century domestic, cosy | kitchen foley, lounge exotica with vibraphone and theremin | a price tag on a string, recipe cards in a box | the whole house bakes into a loaf; slicing it shows the box in the crumb |
| 2 | `lawn` | Keep Off the Grass · "Keep hands and feet clear." | steer a mower by holding and dragging; no timing anywhere | grass box and compost trips → jobs for the street and robot mowers → stripes judged at three shows and a cup final on a football pitch → a crop circle | real-time miniature: toy voxel houses on real grass, blade by blade, in hand-written WebGL 2 with a shadow map | lawn greens in stripes, lemon, cobalt, flamingo pink; indigo and moonlight at the end | 1990s suburban summer, small-town show | a two-stroke engine and grass hiss, a cheap keyboard's demo song, brass for the show, a music box at midnight | a moulded plastic dashboard, blister packs on a hardware-store pegboard | the field was a box: the crop circle is its net, it folds up, and the number is printed underneath |
| draft | `guests` | Unwelcome Guests · "Do not open after dark." | choose where and when to haunt, against people's timetables | fear builds and drains, nerves wear down; five families as five reels | silent film: Reiniger paper cut-outs, tinted stock, grain, intertitles, iris | sepia, rose, night blue, ectoplasm green-white | 1920s, gothic comedy | an upright piano in the pit, a projector | intertitle plates, a cast list, the repertoire | a crate delivered after dark; the iris closes on it |

Pacing as measured by the test (eager / casual minutes, three seeds): Starter 31–33 / 47–49,
Keep Off the Grass 40–42 / 55–59,
Unwelcome Guests 39–41 / 54–57.

Unwelcome Guests was built as box 2 and taken out of the stack again before it shipped: it shares
Starter's rhythm (wait until something is ready, then tap it), so two boxes in a row felt like the same
game in a new costume. It waits below the marker as a draft for slot 3 or 4. Box 2 became Keep Off
the Grass instead: continuous steering rather than waiting and tapping, real 3D rather than flat print.
Box 3 must in turn leave both behind: no steering a vehicle, no timing taps, and neither print nor
voxels (Unwelcome Guests' silent film qualifies on looks, but check its rhythm against this rule first).

### Open work on the shipped boxes

Neither box has yet met rule 4's bar of 8 out of 10. The last critiques that ran (first impression,
clarity, art direction, phone, feel) scored Starter 6/5/6/4/5 and Unwelcome Guests 6/4/5/6/4, both before
the fixes listed in their commits; the next round was cut short. What those critiques asked for and is
still undone, most valuable first:

- **Starter** had a pedantic polish pass after the first playtest: the timer rings at each peak and
  can be quieted, Mother is a clamp-top jar, early and late taps say which they are, each loaf shows
  its price where it was made and keeps its own pattern's multiplier, the apprentice and baker wear
  caps with a progress ring and the baker leaves a loaf you are holding, jars can be renamed (not
  Mother, until she has earned it), bulges ripen gold so oak beams and the rolling pin pay, perfect
  play keeps Mother lively in the house act, and the music runs in song form (AABC, key changes,
  solo choruses). Still undone: a recipe tin on the counter instead of the side column of cards; in act 3, either push the
  camera into the room that needs a hand or let the jars and bench run themselves, because the targets
  are small there; bulges that push the house out of shape rather than sitting on it like stickers; a
  phone layout composed for 390 px in every act; teach with the world rather than with words
  (an early tap could bake a flat loaf instead of refusing).
- **Unwelcome Guests** (draft): a graphics pass for glitches at phone size first; then more of Reiniger in the puppets (finer filigree, lace that reads at phone size),
  the cast list and repertoire in fewer, larger plates on a phone, and a fresh critique of the reworked
  haunt, which nobody but its author has seen yet.

## Ideas, considered and not chosen

Free to take, change or ignore; each is a pair of a mechanic and a look. Strike one through when a
box uses it.

- **hi.exe** — you are a virus on a Windows 95 desktop: copy yourself between folders, hide from
  scans, crash the machine. Grey bevels, pixel icons, the chime and the error ding.
- **The Hamster Power Plant** — a five-year plan for a plant run on hamster wheels; quotas, shifts,
  sunflower-seed rations. Constructivist posters in red, black and cream; a brass band.
- **Ewe Knit** — shear, spin and knit; stitches as a rhythm game, patterns as upgrades. Everything
  is knitted, down to the numbers.
- **The Keeper** — a lighthouse through one long winter: keep the lamp lit, answer ships in Morse.
  Woodcut prints; wind and a foghorn.
- **Physarum** — a slime mould grows a network to oat flakes on a petri dish; the network optimises
  itself. A microscope's round view, stains and agar.
- **Grand Tour** — a 1970s space probe: slingshots past planets, every command arriving hours late.
  Technical drawings and vector CRT; telemetry beeps.
- **Scriptorium** — illuminate a manuscript letter by letter; monks and gold leaf as upgrades.
  Vellum, oak-gall ink, lapis; plainchant.
- **Pirate Radio** — a 1960s station on a rusting ship: playlists, listeners, the coastguard.
  Pop-art record sleeves; jingles.
- **Volcano** — a mountain that villagers bring offerings to; rumble, erupt, be worshipped. Codex
  paintings; drums and conch.
- **Bonsai** — one tree over a hundred years, pruned a season at a time. Sumi-e ink wash; a shakuhachi.
- **Lane 3** — a 1980s supermarket checkout: scan in rhythm, beep combos, a manager watching.
  Thermal receipt print and VHS fuzz.
- **Brains** — a lawn in a 1950s B-movie: the zombies are the crop. Lurid poster painting; a theremin
  and a drive-in organ.
- **Pachinko Parlour** — aim and release, then watch a thousand balls fall; pins and tulips as
  upgrades. 1980s Tokyo neon, pixel art, a deafening hall. (Runner-up for box 2: strong, but its
  rhythm is pull-and-watch, which is close to waiting.)
- **Scratch** — a lottery kiosk's scratch cards, scratched with the finger; odds and card designs as
  upgrades, a kiosk that grows into a casino. Foil, halftone, 1990s corner-shop colours.
- **Fletcher** — archery: draw, hold your breath, release; arrows, bows and targets that move. Painted
  medieval tapestry, flat perspective.
- **Shelf Life** — a supermarket at night: sort the stock onto shelves by colour, date and price before
  opening. Isometric pixels, fluorescent hum.
- **Bathysphere** — sink a Victorian diving bell, sound with sonar, lure what lives down there.
  Steel engraving in the style of Jules Verne's illustrators.

- **Keep Off the Grass** (box 2) has been played through once by the owner, who liked it best of the
  three; everything since came from that playtest. No outside critique has run yet. Open, most
  valuable first:
  - **Performance is still unmeasured on real devices**, but the view now looks after itself: grass
    starts at up to 220,000 blades on a desktop and 110,000 on a phone (`BN` and `BUDGET`), and when the
    median frame over two seconds is slower than 24 ms it draws 30% fewer (`gauge` and `watch` in the
    view). A cut that does not make frames quicker is taken back and the count is frozen, so a phone
    capped at 30 frames a second, or a stadium slow for its crowd rather than its turf, keeps its lawn.
    `K.debug.blades()` shows what it decided; the browser suite feeds it made-up frame times.
  - **The mower's sound** has been rebuilt three times without anyone hearing it on this side: too
    loud, then inaudible on phone speakers (all below 240 Hz), then "a helicopter" (pulses too slow).
    It now fires at 52–66 Hz with a band of noise around 650 Hz. Ask the owner before changing it again.
  - The phone frame in act one used to leave the lower third empty: the camera now comes closer to
    Dad's lawn on an upright phone, and across the road (toward the lens) there is a kerb, a pavement
    with a postbox, low brick walls with flower beds and the front gardens opposite, a shade darker than
    the lawns in play so they read as backdrop. Still open: neighbours never react to the robot
    mowers; a check that every place change (each show, midnight) runs without errors belongs in the
    browser suite: buying a show once crashed the view for 0.7 s.

### Working on a box that has shipped

The boxes live in `games/contents_may_vary.html` and are edited there, in place. The fast loop:

- `npx http-server -p 8099 -s -c-1` from the repo root, then
  `games/contents_may_vary.html?world=lawn&at=20` (minutes of the eager bot's game) on a phone-sized and
  a desktop-sized Playwright page. The game runs in an iframe: `page.frames()[1]` reaches `K.debug`
  (`state()`, `toScreen(x, y)`, `cam()`, `snap()`, `box()`). To get to a place quickly, set money and
  buy through the rules: `S = K.debug.state(); S.$ = 1e9; CORE.act(S, 'buy', 'show4')`.
- Headless Chromium renders WebGL in software: a few frames a second at most, and the stadium takes
  seconds per frame, so give screenshots a long timeout. Do not trust a screenshot over a WebGL
  canvas with CSS `backdrop-filter` above it; `K.debug.snap()` returns the canvas itself.
- Pacing changes go through `node test/contents_may_vary.mjs pacing --world=lawn`; anything else
  through `npm run test:cmv` and the `browser` suite. Each commit that changes the page sets its
  `updated` date in `data/games.json`.

### Genres and looks to draw from

From the anthology's owner, as a well for new pairs; none of these is a box yet:

- **Genres**: fishing (in 3D), archery, woodcutting, mining, pachinko, scratch cards, a horde survivor,
  a war simulation, cleaning (power-washing, gardening, mowing a lawn), dice, the absurd (in the
  spirit of *Berry Bury Berry*, *How to Fish*, *Project P.I.T.T.*), sorting (books on a shelf, a
  supermarket's stock), digging.
- **Techniques**: voxels, pixel art, real-time 3D, 3D with comic shading, isometric, 2.5D layers,
  photo-real, and anything else that a canvas, WebGL or CSS can carry inside the budget.

## Lessons from the boxes so far

- **Real grass is a vertex shader, not a model.** Every blade is the same nine-vertex ribbon, drawn up
  to a hundred thousand times; its place, height, lean, wind and colour come from a hash of its number
  and a lawn-sized texture updated each frame (height, the last pass's direction, hidden, kind). Cut
  blades lean the way the mower went, so stripes appear for the same reason they do on a real lawn.
  The technique is the one Ghost of Tsushima's GDC talk made famous; it cost about 6 KB.
- **Real 3D fits the budget.** Keep Off the Grass draws everything as instanced boxes with one
  shader, one shadow map and no library: about 25 KB of renderer and scene. The rules stay a grid; the
  view never decides anything.
- **Headless screenshots lie about `backdrop-filter`.** In headless Chromium a blurred band over a
  WebGL canvas came out transparent, and well beyond the band. Check the canvas itself
  (`toDataURL` straight after a render) before chasing a camera bug.
- **Regrowth that never pauses hides progress.** Grass that grew back while the lawn was being mowed
  made "finished" invisible and the bots chased it forever. A lawn now stays cut until it is finished,
  then grows back in a time-lapse week.
- **Bots need a way round things.** A person walks round a hedge without thinking; the bot needed a
  grid path and a "no nearer for a second and a half, give up" rule before act 2 stopped stalling.

- **Pacing is tuned with bots, not by feel.** Give the bots a person's limits (reaction time, taps a
  second, reading time, breaks) and tune until both land in the window on several seeds. When the
  eager and casual times lie far apart, a shared limit (Unwelcome Guests' ectoplasm) pulls them
  together better than slowing everything down.
- **Thresholds make cliffs.** A family with too much nerve stopped the game dead for casual players;
  nerve that wears down with every fright taken turned the cliff into a slope.
- **Money should land.** Count income when the thing that carries it reaches the counter (a loaf,
  coins, a scream), and let the counter bump; numbers that change before anything arrives feel
  disconnected.
- **Silhouettes need layers.** Black things on black furniture vanish: keep static furniture a
  mid-grey, the things the player uses black, and give people a pale rim.
- **A canvas ellipse does not start a new sub-path.** Two shapes in one fill get joined by a sliver;
  move to the ellipse's start point first (the same goes for an arc after a rectangle, as in an iris).
- **Clip decoration to its shape.** Roof tiles and cellar bricks drawn on a grid spill into the sky
  and the soil unless they are clipped.
- **A hit lands when it arrives.** Unwelcome Guests' first version showed the fright the moment the
  object moved and felt limp; delaying the victim's jump, the scream and the money until the ghost
  reaches them (with a short hold there) made the same numbers feel like a blow.
- **The first action should be the best one.** A person's first fright counts four times, so a
  stranger's first tap gets a real scream instead of "hm? +3".
- **When a panel leaves, the film takes its room.** A finale that keeps a side panel's width leaves
  a black slab where the panel was; lay the scene out again for the full width.
- **Filmstrips find what still frames hide**: a hand pointing at the wrong thing, a man waiting
  on-screen before his cue, a crash that only happens after a run ends.
