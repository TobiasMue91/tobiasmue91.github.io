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
2. **Proportionate.** A box weighs at most **130 KB** (template plus core, unminified, as the test
   measures it) and should aim for 100; the shell and kit at most 72 KB. Quality is bought with craft,
   not with bulk: a box that wants more room cuts something first. Libraries a box loads from a CDN
   inside its own template do not count, but must be pinned to an exact version. (The cap was 120 KB until
   the owner raised it, when the shows in Keep Off the Grass gained intruders, upgrades and a match day.)
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
15. **Shaped like the incrementals the owner plays.** The owner's favourites are short, paid Steam
    incrementals, not the browser idlers of the 2010s: the game starts in its fun verb at once, the
    challenge is visible on the first screen, a first run lasts 10 to 30 seconds and pays for the first
    node of a skill tree straight away. Read **What the owner plays** below and check a new box against
    its checklist before writing a line of the core. Three boxes in a row (Minos Wants a Map, The
    Minotaur Moves Out, Stand Well Back) failed with the owner because they skipped this.

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
| 2 | `lawn` | Keep Off the Grass · "Keep hands and feet clear." | steer a mower by holding and dragging; no timing anywhere | grass box and compost trips → jobs for the street and robot mowers → stripes judged at three shows, with a dog, a sheep, geese and a pitch invader to chase off, and a cup final judged before kick-off, at half-time and at full time → a crop circle | real-time miniature: toy voxel houses on real grass, blade by blade, in hand-written WebGL 2 with a shadow map | lawn greens in stripes, lemon, cobalt, flamingo pink; indigo and moonlight at the end | 1990s suburban summer, small-town show | a two-stroke engine and grass hiss, a cheap keyboard's demo song, brass for the show, a music box at midnight | a moulded plastic dashboard, blister packs on a hardware-store pegboard | the field was a box: the crop circle is its net, it folds up, and the number is printed underneath |
| 3 | `clew` | Tilt · "Contents may rattle." (first shipped as Minos Wants a Map · "Do not unwind.", then as The Minotaur Moves Out, then built as Stand Well Back) | hold a thumb on the board and steel balls pour in at that column; slide to aim the stream; tap to set the auto-launcher and to catch lanterns | games of a few seconds to two minutes, each ending with the tray, and a skill tree between them; a Big One on each board keeps its damage between games and opens the next, taller board | 2D canvas neon: glowing tubes, chrome balls with a hard highlight, a painted playfield behind glass, a brick wall at night for the sign | navy, hot pink, cyan, gold, cigarette haze | 1980s pachinko parlour, escalating to the absurd (the parlour on its side, the street, the mountain) | thousands of tiny ticks, tulip chimes, the reels, a fever fanfare, a neon tube striking; an original chiptune march that gains a part per board | the parlour's neon sign as a lucky wheel: 162 bulbs, a four-quartered star round TILT and a ring per board | the mountain's Big One is a cardboard box with the next number; OPEN IT, and the lid lets the light out |
| draft | `guests` | Unwelcome Guests · "Do not open after dark." | choose where and when to haunt, against people's timetables | fear builds and drains, nerves wear down; five families as five reels | silent film: Reiniger paper cut-outs, tinted stock, grain, intertitles, iris | sepia, rose, night blue, ectoplasm green-white | 1920s, gothic comedy | an upright piano in the pit, a projector | intertitle plates, a cast list, the repertoire | a crate delivered after dark; the iris closes on it |

Pacing as measured by the test (eager / casual minutes, three seeds): Starter 31–33 / 47–49,
Keep Off the Grass 32–34 / 53–57, Tilt 41–46 / 66–69,
Unwelcome Guests 39–41 / 54–57.

Unwelcome Guests was built as box 2 and taken out of the stack again before it shipped: it shares
Starter's rhythm (wait until something is ready, then tap it), so two boxes in a row felt like the same
game in a new costume. It waits below the marker as a draft for slot 3 or 4. Box 2 became Keep Off
the Grass instead: continuous steering rather than waiting and tapping, real 3D rather than flat print.
Box 3 had to leave both behind: no steering a vehicle, no timing taps, neither print nor voxels.

Box 3 is now Tilt, its fourth version; the story of the first three follows. The owner asked for a first-person 3D game in that slot,
so that boxes 1 and 3 would stop resembling each other, and named a labyrinth to chart, or a raft grown
from flotsam, as starting points; they also like absurdity and escalation.

It shipped first as **Minos Wants a Map**: chart the Labyrinth by choosing a way at every junction.
The owner played it on a phone and it did not hold them. After a few minutes it was repetitive and
slow; a tap on an arrow is a choice with nothing pushing back, the upgrades only made numbers faster,
and nothing on screen grew. It was remade in place as **The Minotaur Moves Out** (`CORE.version` 2): the
same Labyrinth and vase, but you ram your way out. The owner found that confusing: you could not walk
where you liked, and the Labyrinth no longer did anything for the game; the 3D view only made a wall
in front of you hard to read. So the slot went to the owner's pick from three new pitches (a wrecking
ball, pachinko with a twist, digging): **Stand Well Back** (`CORE.version` 3, and a `migrate` that starts
any old save afresh). It gives up the first-person 3D the slot was asked for: a destruction verb you
understand at a glance mattered more to the owner than the camera. It is flat 2D, seen from the side,
so it differs from box 2's lit 3D miniature and from box 1's print. Pachinko stays in the ideas.
The owner played Stand Well Back and found it boring too: pull the ball up, let it drop, again. Three
attempts at box 3 failed the same way, so the owner stopped and had the session research what the
incrementals they actually enjoy have in common (**What the owner plays**, below). That gave rule 15,
and the plan for the fourth attempt that follows. Stand Well Back is on the branch of PR #391 and was
never merged; it is replaced, not shipped.

**Tilt** (`CORE.version` 4) is the fourth attempt, built from the plan below; what changed on the way is
noted under it. The owner played it and liked it; their notes (frame rate, the sign on a desktop and as
a figure, feedback for every payout, tulips that pay a prize, a launcher set by hand, a bonus to catch,
the Big One's last stretch in view, damage you can see) are recorded below and in the lessons.

### Box 3, fourth attempt: Tilt (the plan)

Written for the session that builds it. It replaces Stand Well Back under the same id `clew` (on
`main`, box 3 is still Minos Wants a Map): `CORE.version` 4, and a `migrate` that starts old saves fresh.

**One line.** Pachinko as a modern Steam incremental: hold your thumb on the board and a stream of
steel balls pours in where it points; they rattle down through the pins, smash prize blocks into
coins, and drop into pockets that pay out more balls. When the tray is empty the run is over, and the
coins light up bulbs on the parlour's big neon sign, which is the skill tree.

**Why it fits the owner.** It answers the checklist; the owner kept coming back to pachinko; there is
nothing to place and nothing to aim precisely (the old pitch's "set your own pins" was too much work);
the board is portrait, so it fills a phone, where the wrecking ball fought the phone's shape.

**The checklist, answered.**
1. *Second one:* hold anywhere on the board and balls stream in at that column, four a second, with a
   roar of clicks; let go to stop. Chaos physics is fun with nothing bought.
2. *The limit:* the tray. Run 1 has 15 balls, gone in about 4 seconds, settled in about 12. Pockets pay
   balls back into the tray (the real pachinko tension: a good run feeds itself). Later runs last a
   minute or two.
3. *The challenge on screen:* every board has **the Big One**, a huge gold prize block with a counter
   (500 on board 1) sitting over the board's exit. Break it and the board opens to the next one.
   Run 1 chips it to 470 and the player sees where this is going.
4. *The first buy:* run 1 earns about 20 coins. The centre of the sign has three bulbs at 8 to 15:
   +5 balls, pins pay 1 coin when hit, heavier balls (+1 damage). After run 1 the player buys one or two.
5. *Nodes that change the game* (about one every 5 minutes):
   - golden pins that split a ball in two (min 4);
   - the start pocket: a ball in it spins a three-reel slot in the middle of the board, and three of a
     kind is **FEVER**, ten seconds of balls raining from the whole top edge (min 8);
   - bomb balls, every Nth ball explodes on its first block (min 13);
   - the auto-launcher, which holds for you between your own bursts (min 18);
   - magnet pockets that pull passing balls in (min 24);
   - the mega ball, where every 50 balls in a pocket fuse into one giant ball that ploughs through
     everything (min 30). It also caps the ball count for the frame rate.
6. *Minute 40 against minute 1:* fifteen balls on a small machine at the start; at the end hundreds of
   balls and fever rain on a board taller than the screen (the camera follows the flood down), mega
   balls rolling through, the reels spinning non-stop.
7. *Automation:* the auto-launcher and a ball boy who tops up the tray between runs. The player keeps
   choosing where the stream goes (at the start pocket, at the Big One, at a cluster of blocks) and
   when to hold back for fever.

**Boards, escalating to the absurd** (each Big One opens the next; each has its own pins, blocks and
look):
1. a pachinko machine in a parlour;
2. the same machine, now as tall as the parlour (the camera scrolls);
3. the parlour itself turned on its side, with stools and ashtrays as pins and other machines as
   prize blocks;
4. the street outside, with lamp posts, vending machines and a bus;
5. the mountain behind the town, where the last Big One is a box with the next number on it (rule 8).

**Tree.** About 70 bulbs on the neon sign, opening outwards; wires are the edges; a bought bulb lights
up with a buzz. Costs grow about ×1.5 per ring. Boards 2 to 5 are gated by the Big One, not by the
tree, and each opens a new arm of the sign.

**Look and sound.** A 1980s Japanese pachinko parlour: chrome balls with a hard highlight, neon tube
signs with glow (additive blending on a 2D canvas), deep navy, hot pink, cyan and gold, a cigarette-haze
gradient. English signage in a period display face (no fake Japanese). Sound: thousands of tiny
clicks, pocket chimes, the reel's tick and a fever fanfare, and a chiptune *Warship March* (Gunkan
March, 1897, public domain), which real parlours played for decades. Teaching: a glowing thumb on
the board and a sign over the Big One reading BREAK ME.

**Ledger check.** Against boxes 1 and 2: verb (hold and point a stream), loop (runs and a tree), medium
(neon on canvas), palette, era (1980s Japan), sound and interface (a neon sign as the tree) are all new.

**Engineering notes.** Physics in the pure core: balls are circles against circle pins and box blocks,
a fixed step of 1/120 s, a spatial grid, the PRNG in the state. The pacing test plays six whole games,
so keep a frame of 300 balls cheap; the mega ball is the cap. Between runs the core sits in a `tree`
phase until `act('run')`; the bots press it. Pacing target: the eager bot finishes in 40 to 50 minutes,
the first purchase comes after run 1, and nothing new is more than 3 minutes apart. Budget: aim for
100 KB.

**Before building**, the session confirms the plan with the owner (a one-frame mock-up of the phone
layout and the tree), then follows `.claude/skills/next-box` from step 3.

**As built** (what moved away from the plan, and why):
- *The Big One on board 1 counts down from 1,500, not 500.* At 500 the eager bot broke it in about two
  and a half minutes; at 1,500 it takes about three, and the first game still chips it visibly.
- *Tulips pay a prize and then close.* With pockets paying a ball each and no limit, a well-upgraded game
  fed itself for minutes. Then a tulip took a few balls and paid one back for each, and the owner found a
  catch felt like a punishment: one ball back only drags the game out. Now a tulip takes two balls a game
  and pays five for each (or 2% of the full tray, once that is more; "Rich tulips" adds a quarter per
  bulb, "Double tulips" doubles it), then closes into a dome that balls roll off. The start pocket takes
  four once the reels are bought. After 60 seconds it is *last call*: the pockets stop paying and the
  tray pours three times as fast. So every game ends, whatever is bought.
- *The auto-launcher is set by hand, every game.* It first poured on its own wherever the thumb had been,
  and the owner said that from then on the player had nothing to do. Now a short tap on the board sets it
  (a gold AUTO marker on the rail); it pours there beside the thumb for the rest of that game, and the
  next game starts without it.
- *Lanterns.* From the third game a paper lantern drifts down the glass every 20 to 35 seconds; a tap on
  it is four seconds of fever, and it is gone after eight. It asks for a hand in every game, also after
  the launcher is bought (the owner prefers busy incrementals to idle ones).
- *The sign is a figure: the parlour's lucky wheel.* It was built first as a tall tower of 45 bulbs with
  level pips; the owner found it awkward on a desktop and asked to follow the popular incrementals. What
  those trees have in common (guides and reviews, October 2026): 200 to 700 small nodes in five or six
  themed branches (Bills Must Be Paid: about 211 single-purchase nodes from $1 to $100M; Keep on Mining –
  Worlds: 200+ in six stat branches; Chop Chains: 700+ in five), a first node that costs next to nothing,
  a tree that spreads from the centre (Nodebuster), and complaints when the tree's UI gets in the way.
  A second version grew a web on a hex grid by algorithm; the owner said it looked thrown together, and
  that a finished tree should make a pattern or a figure. So the layout is designed, not grown: every
  level is a bulb (162), and the centre is a star of four quarters of the same shape, one per theme
  (balls and launching; pins, reels and the mega ball; damage and the Big One; fever and coins). Each
  quarter is a spine of six, two branches of four, a big bulb at the end of each and three more that curl
  back, so a finished quarter closes into a diamond. Round the star run four full rings, one per board,
  dark until its Big One breaks; lit up completely the sign is a compass rose inside a wheel. A chain
  opens when the chain it hangs from is full (as in Nodebuster), bulbs not found yet show as faint dots so
  the figure is there from the start, and the next bulbs and the one after them show as lit outlines and
  "?". A mouse reads a bulb by hovering and buys it with a click; a finger taps to read and again to buy;
  drag pans, the wheel and a pinch zoom. The first bulbs cost 3 to 5 coins. To make the quarters equal the
  upgrades were regrouped (six new ones: hard steel, break the bank, hairline cracks, neon glow, downpour,
  a crate of balls) and the Big Ones retuned (now 1,500 · 900K · 160M · 5B · 40B).
- *The march is original.* No transcription of the Warship March could be checked from here, and a
  misremembered one would be worse than none, so the parlour plays a march of its own in the same 2/4
  manner: square lead, oom-pah bass, snare from board 2, chords from board 3, a doubled lead from board
  4, faster and an octave up during fever. Swap in the real tune when someone has the notes.
- *The game-changers arrive* (eager bot, seed 1) at minute 3 (golden pins), 6 (the reels), 7 (more
  tulips), 9 (bombs), 13 (the auto-launcher), 17 (jackpot), 21 (magnets), 26 (mega balls and the twin
  stream) and about 36 (rockfall). Up to 260 balls are on the board at once; beyond that, pouring with the
  mega ball bought fuses the overflow into mega balls.
- Boards, in units 100 wide: 180, 360, 460, 560 and 660 tall; the camera follows the flood on the tall
  ones and a strip on the rim shows where the view is.


**Runners-up** (kept for later boxes): a vacuum cleaner that grows from a room to a planet (too close
to box 2's mowing, by rule 3); scratch tickets with quirks (Scritchy Scratchy already does it well);
a coin-flip table.

Unwelcome Guests waits below the marker as the draft for slot 4.

### Open work on the shipped boxes

Neither of the first two boxes has yet met rule 4's bar of 8 out of 10 on every count (Keep Off the Grass is closest: see below). The last critiques that ran (first impression,
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
- **Flotsam** — the owner's idea for box 3: start on a raft, haul in driftwood and plastic, grow it
  into a ship and cross the seven seas. Its whole case is the water, so it wants a real ocean shader
  (Gerstner waves, foam on the crests, a toon or painterly look). Set aside for slot 3 because it is
  steering a vehicle right after Keep Off the Grass; fine after any box that is not.
- **Babel** — Borges's library: endless hexagonal galleries, search them for one sentence that means
  something, librarians as automation. Candlelit oil painting in the first person. Close to Minos
  Wants a Map now: wait for several boxes.
- **Ewe Knit**, **Pachinko Parlour**, **hi.exe**, **Scratch** and **Fletcher** were weighed again for
  box 3 and lost to the labyrinth on surprise and on distance from the ledger.

- **Keep Off the Grass** (box 2) has been played through by the owner twice. The second playtest asked
  for: judges behind their table rather than inside it; a way to turn a huge gang mower without
  shaving the lawn; trees that look like trees; a gang mower that hangs together; a bigger cup final
  pitch; and above all less sameness at the shows, where the judges came round about twenty times a
  show. All of it is done: the cutters lift off a show lawn (turn on the headland); new trees; gangs
  on arms from a beam; an 84 by 54 pitch; something gets onto every show lawn about once a minute
  (`PESTS` in the core) and is seen off by driving at it; the judges' pause is 15 s, not 30, and their
  ceremony is brisk after the first visit at each show, with a comment on what was missing; three
  new upgrades (sprinklers, a bigger engine, a sheepdog); the cup final is a match day; and entry
  fees are lower, so fewer judgings are needed only for money. The judges still come round 13 to 19
  times a show for the eager bot: that is what keeps the eager game over 30 minutes. If it still
  drags, the next lever is a show that asks for something new each visit, not more of the same.
  Everything before the second playtest came from the first. No outside critique has run yet. Open, most
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
  - Done since the playtest's notes: the phone frame in act one no longer leaves its lower third
    empty (the camera comes closer to Dad's lawn on an upright phone, and across the road, toward the
    lens, there is a kerb, a pavement with a postbox, low brick walls with flower beds and the front
    gardens opposite, a shade darker than the lawns in play so they read as backdrop). The neighbours
    notice the robot mowers: the owner comes out to meet each new one, thanks it (not you) when it has
    finished their lawn, and now and then stands at the door watching it (`ROBO` in the view). Speech
    bubbles stay whole on screen and below the dashboard. The browser suite now buys its way through
    every place (the street, the three shows, the cup final, midnight) and wants no error on the way;
    on its first run it caught a neighbour's visit, timed for Elm Street, landing on the show ground.
  - **Critique (rule 4).** Three rounds, each one fresh critic subagent given 28 stills (the first minute,
    a full grass box, the street, a show with its judges, the National, the stadium, midnight, the
    reveal and the box, at 390×844 and 1280×800; the script films with real pointer input). Scores for
    first impression, clarity, art direction, phone and feel went 7/4/7/5/5, then 7/5/8/5/6, then
    8/7/8/7/7. Fixed on the way: stripes lit by the way they were mown; a judging sequence that says
    one thing at a time (looking, then the medal under the score cards, then what was won); the camera
    leaning toward the bin when the grass box is full; a pegboard strip as tall as its cards that
    fades while it can scroll; show lawns seen more steeply on an upright phone; a thicker string and
    a soft moon at midnight; cut wheat leaving pale straw so the net shows before the fold.
  - Next, most valuable first, from the last critique: the medal is a flat disc pasted on a 3D world
    (a moulded rosette that drops onto the lawn would fit); clarity (7) and phone (7) are still under
    8 - the judges' sheet covers the show tent on a phone, and "6% short" beside "81% stripes" reads
    like a bug to a stranger; the stadium's crowd reads as confetti. The critic also asked why
    midnight turns to amber daylight; that is dawn breaking as the box folds, and stays. Then a
    frame-time reading on a real phone, above all in the stadium (`K.debug.blades()`), and the mower's
    sound once the owner has heard it.

- **Tilt** (box 3, fourth version) has had one critic round, on filmstrips of the first minute, minutes
  10, 30 (with a fever) and 45, a Big One breaking and the ending, at 390×844 and 1280×800 with a real
  held pointer. Scores for first impression, clarity, art direction, phone and feel: 6/5/7/5/5. Fixed
  after it: the Big One's counter and a bar sit in the tray on every board, so the goal stays in sight
  on the tall boards; balls are drawn larger than they are and the pins are dimmer; a broken Big One gets
  its own moment (a flash, gold shards, BIG ONE BROKEN) before the floor gives way; big headings fit a
  phone; coin popups are larger and gold; OPEN IT clears the tray; the mountain lost its grey fog. No
  second round has run: the owner wanted to play it first. Open, from that critique: the first game
  drains in a few seconds for about fifteen coins (the critic asked for forty balls and a sure tulip
  catch, which would change rule 15's short first run, so it waits for the owner); the coin count leaps
  between boards with little felt in between; the sign's short tags (U, XL, BIG) mean nothing until a
  bulb is tapped. Stand Well Back's own critique notes went with it.

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

## What the owner plays

The owner's favourite incrementals, in no order. The first fifteen are short, paid (1 to 8 €) Steam
games of 2025 and 2026 that the owner enjoyed and that are about as complex as a box should be; the
last three were named earlier for their absurdity. What each one is, from store pages and reviews
(October 2026):

| Game | What the hands do | What makes it work |
| --- | --- | --- |
| Garbage Growth | people throw trash at you; you pick it up for money | add more people to throw more; hire rats to collect; a skill tree; you make the problem bigger on purpose |
| Bills Must Be Paid | smash piggy banks with a hammer that follows the mouse | a run ends when your stamina is gone; bills arrive during the run and take a cut until paid; piggies that run away or carry more; hammers with different radius, crit and speed; abilities (rock rain, an electrified hammer) in a branching skill tree |
| Scritchy Scratchy | scratch lottery tickets | a growing set of cards, each with a quirk or a penalty; a scratch bot to automate; luck and payout upgrades; prestige for permanent points |
| Gamblers Table | flip coins | buy better coins; failed flips drop skull tokens that buy items; helpers automate the flipping; a reset for bigger rewards |
| Chef Knight | fight monsters in a dungeon, cook what drops, sell the dishes | two short loops feeding each other (fight, then cook); a skill tree for faster fighting and cooking |
| Artillery Miner | shell huge blocks of ore with artillery | ores smelted into materials, 400+ upgrades in a tree that opens new worlds, ores and 33 guns; prestige once a world is obliterated |
| Fishing Inc | click fast to reel a fish in before it escapes | many places to fish out completely; skill per species; gear between trips |
| Growing My Manhole | be a manhole that swallows what is smaller than it | grow from a manhole to a black hole; a run-based Donut County |
| We Need More Humans! | (not found under this name; ask the owner) | |
| Crack the Pack | open booster packs | cards in seven rarities; sell duplicates; a magnet, workers and a fusion lab for automation |
| Fortune Mill | darts, scratch-offs, dice, pachinko, sushi, one room each | earn 1,000,000 to escape; every room boosts all the others; full automation; 120+ upgrades |
| Keep on Mining! | hover the cursor over rocks and the pickaxes go to work | ores become bars for a permanent skill tree; talent cards on level-up; an idle mine; reviewers love the feel and the huge tree, dislike a weak late game and an abrupt ending |
| Chop Chains | hover over trees to chop them | wood buys a deep skill tree and prestige; complaints: trials that block progress, grind plateaus |
| Timber Rush | chop one big tree; every swing showers logs, gold and power-ups | an incremental roguelite of short runs; a massive skill tree of automation, special logs (lightning, freeze time, magnet the screen) and synergies |
| Sip Fisher | drain a lake through a straw and sell the fish | an absurd premise played straight; gear upgrades; very positive reviews, an IGF student nomination |
| Berry Bury Berry | first person: grow berries and drop them into a hole for money | Berry Buddies grow higher tiers; puzzles, cassette tapes and a creeping horror; several endings |
| How to Fish | (named for its absurdity) | |
| Project P.I.T.T. | build a chaotic physics production line of rubber ducks and feed them to a bottomless pit | combos for dumping many at once; corporate targets; scripted events that break your machines |

### The shape they share

Almost all of them are one game: a **short run** with a **verb that is fun on its own**, then a **skill
tree** between runs.

- **The verb is fun before any upgrade.** Smashing, scratching, chopping, flipping, fishing: a
  physical action with an instant, juicy answer (particles, numbers, sound, shake). The mouse or finger
  usually *is* the tool, often an area under the cursor rather than a precise aim, so the hands never
  work hard and the screen does a lot.
- **A run is short and has a clear limit.** Stamina, a timer, a tray of balls, a hand that gets
  tired. The first run is over in 10 to 30 seconds; later runs grow to a minute or two. The limit is
  the challenge you can see from the first screen, and every upgrade visibly pushes against it.
- **The skill tree is the menu.** A big map of nodes that opens outwards from a cheap centre; the first
  nodes cost about one run's earnings, so something is bought after the very first run. Most nodes are
  small numbers (+1 ball, +10 % value), a few change the game (a new helper, chain lightning, a new
  object tier, a new area), and those are spaced so a new one arrives every few minutes.
- **Escalation is seen, not read.** More objects, bigger numbers on screen, rarer tiers with their own
  look, a helper that joins in, a screen that fills with chaos. By the end the first run looks absurdly
  small.
- **Automation joins the verb, it does not replace it.** Rats, a scratch bot, workers: they take the
  tedious part, and the player keeps the fun part.
- **Randomness with rarities.** Tickets, packs, coins, ores and fish come in tiers and odds; the next
  run might be the lucky one.
- **It is short and it ends.** One to five hours on Steam; a box is the same shape in 30 to 90 minutes.

### Checklist for a new box

Before the core is written, answer each with one sentence:

1. What do the hands do in second one, and why is it fun with nothing bought?
2. What limits a run, and how long is the first one (10 to 30 seconds)?
3. What is the visible challenge on the first screen?
4. What does the first run buy, and where does it sit in the tree?
5. Which five or six nodes change the game rather than a number, and when does each arrive?
6. What does the screen look like at minute 40 next to minute 1?
7. What does the player automate, and what do they keep doing by hand?

A box that answers these in a dull way (pull a ball back and let it go; tap an arrow at a junction)
is not saved by its art direction: the owner played both and stopped.

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
- **A gate only money opens turns a level into a grind.** Gold at each show came at the first judging;
  the next eighteen were rent for the next show's entry fee, and the owner was bored by the second
  show. Measure what actually gates progress (here: a bot's log of each judging and medal) before
  tuning thresholds, and put variety into each repetition rather than only fewer of them.
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
- **A verb needs resistance and a visible result.** Minos Wants a Map's tap on an arrow had neither:
  every choice was equally easy, and its upgrades changed numbers, not what the screen showed. The owner
  stopped after a few minutes. Breaking things, collecting things, beating things all push back and
  leave a mark; pick a verb from that family, or give a choice a cost.
- **A remake that keeps the setting can keep what was wrong with it.** The Minotaur kept Minos's
  Labyrinth and its first-person view and changed the verb; the owner then asked why they could not walk
  freely and what the Labyrinth was for. If the verb changes, ask again whether each piece of the old box
  still serves it, and drop the ones that do not, camera included.
- **An upgrade must not shrink the picture.** Stand Well Back's crane first grew a longer chain; the camera
  has to show the whole swing, so every upgrade zoomed out and the buildings shrank on a phone. Grow what is
  in the frame (the ball becomes the Moon), not the frame.
- **Check a destructible structure stands before anyone touches it.** Cutaway buildings with free-standing
  windows and wide ceilings fell in on the first hit and paid for it. A test now settles every job as built.
- **Make the gates harden faster than the player, and the rest slower.** In The Minotaur Moves Out a
  gate takes 7.8 times more each ring, an ordinary wall 3 times, and the horns grow to meet the gates.
  So within the current ring a blow outgrows the walls in front of it, and what is left of it ploughs
  on: two walls in the first minutes, thirty in one blow by the end. With walls and gates scaling
  alike, the bots never broke two walls with one blow in a whole game.
- **A raycaster is cheap and reads as 3D anywhere.** The Minotaur Moves Out casts one ray per screen column
  on the CPU (Wolfenstein's DDA), uploads the hits as a one-pixel-high float texture, and paints every
  pixel in one fragment shader: wall, floor or ceiling, the frescoes from a canvas atlas, the light
  posterised into four tones. About 12 KB, and fast on a phone. Two things it needs: stand a third of a
  pace back from the middle of a block and keep the camera at least .3 from any wall, or junctions
  become close-ups of a wall; and a wider field of view on an upright phone (80° against 66°).
- **`smoothstep` with its edges reversed is undefined in GLSL.** SwiftShader returns 0, so the bellow's
  echo and the stairwell's light were simply missing in every headless frame. Write `1. - smoothstep(a, b, x)`.
- **An `<svg>` has no `hidden` property.** Setting `el.hidden = false` on one does nothing; wrap it in a
  `<div>` when it has to come and go.
- **A cache key reset to the same value as "nothing to show" never clears.** The way discs stayed on screen
  through the ending because `waysKey = ''` was also the key for "no ways". Reset to `null`.
- **Helpers need more than one door.** With one door per ring, every Athenian walked four hundred paces to
  the same opening and crowded one corridor. Four doors, targets spread at least nine paces apart, and
  jogging along corridors already charted made them useful.
- **A gate you can buy must also be one you can earn.** A player who spends everything on sandals must
  not be stranded: a finished ring brings the next thread free, and buying it early is the shortcut.
- **On a phone, sort the shop.** The thread was the third sherd in a strip that shows two and a half; the
  most important purchase sat off screen. It now comes first, then by price.
- **`Math` is slow inside a `vm` context.** The test suite runs every core in `vm.createContext`, where a
  global like `Math` is looked up through the context's interceptor on every call: Tilt's physics ran eight
  times slower in the suite than it would on a page (1.6 µs a ball a step against 0.2). Destructure what a
  hot loop needs at the top of the core (`const { sqrt, abs, floor } = Math`) and the cost is gone.
- **A run that pays its own fuel has to run dry by design.** Pockets that paid a ball back with no limit
  let an upgraded game feed itself for minutes, and no tuning of the odds held across every upgrade. A
  hard, visible bound (tulips that close after a few balls, last call after 75 seconds) makes every game
  end, whatever is bought.
- **Leave room for the ball everywhere.** A pin closer to a wall, a ledge or another block than one
  ball's width wedges balls for ever, and two blocks two units apart make a notch that holds one. Pins
  keep a ball's width plus a margin from everything, clusters of blocks touch, and a ball that has not
  moved a unit and a half in one and a half seconds is dropped (the suite drops a ball from every column
  of every board and wants them all gone within a minute).
- **Measure the raster, not the script.** Tilt's frame cost 1 ms of JavaScript and still stuttered: the
  canvas only rasterises when it is flushed, so full-screen gradients and `shadowBlur` hide from
  `performance.now()` around the draw calls. Reading back one pixel (`getImageData(0, 0, 1, 1)`) after each
  part forces the flush and shows the real split (`K.debug.parts`); painting what does not change into
  its own canvas once cut the frame from 12.6 to 4.4 ms.
- **Every payout says so, where it lands.** The owner's first real playtest of Tilt was mostly about
  feedback: it was not clear when balls came back, what the golden START pocket did before the reels were
  bought, where a FEVER came from, or that the Big One was about to break. Now every coin shows a "+x"
  where it lands (pins and Big One hits gathered by place for a quarter second, so it reads and does not
  flood), a tulip's catch shows "+5 BALLS" and the balls fly into the tray, a full tulip says FULL,
  locked reels say LOCKED and what to buy, a ball into START draws a beam to the reels and SPIN!, the reels
  move to the top of the glass when they spin out of view, a miss says NO WIN, and the fever banner says
  what caused it. Under a fifth of its count the Big One glows, says NEARLY! and the camera keeps it in
  view. Rule of thumb: if the rules did something, the screen says what, and where.
- **A tall board's camera serves the hands.** When the board is empty and balls wait in the tray, the
  camera goes back up to the rail, where the thumb has to act; it follows the flood only while there is
  one, and holds the Big One in view when it is nearly broken.
- **Automation that removes the verb removes the game.** The auto-launcher poured by itself and the owner
  stopped having anything to do. Make automation something the player sets or aims each run, and keep a
  reason to touch the screen (a lantern to catch) after every upgrade.
- **A prize that drags the game out is a punishment.** One ball back from a tulip made a catch feel like
  a delay; five or more feels like winning. Check that every reward is worth more than the time it costs.
- **A skill tree is a picture.** Grown layouts (a tower, then a hex-grid web) read as random to the owner;
  the trees in the games they play end as a figure. Design the shape first (Tilt: four equal quarters and
  four rings, a lucky wheel), show its outline as faint dots from the start, and make what can be bought
  shout: a spreading ring round each such bulb, a count at the top, arrows at the edge to the ones out of
  view. On a desktop, read on hover and buy on click, with the coins in sight.
- **An upgrade has to show what it did.** The owner never felt that damage mattered and hardly noticed the
  bombs: their effect was a number nobody saw. Now each hit shows its damage in red ("−x" on blocks and
  under the Big One, gathered like the coins), the tray shows the damage per ball (HIT n), bombs trail
  sparks, and an explosion is a shockwave the size of its reach with a flash and BOOM!.
- **Give the player the camera, and a way to give it back.** On a board taller than the glass the owner
  wanted to look around by hand. The strip on the rim that maps the board is a scroll bar to drag (the
  wheel scrolls too on a desktop); while the camera is held, an AUTO CAMERA button hands it back, and
  every new game starts with the camera on its own.
- **Hit points do not scale like damage.** Tilt's damage grows by multipliers, so doubling a Big One's
  count only adds a run or two; when a change makes the game shorter, scale the later Big Ones by three
  to five and measure again.
- **Filmstrips find what still frames hide**: a hand pointing at the wrong thing, a man waiting
  on-screen before his cue, a crash that only happens after a run ends.
