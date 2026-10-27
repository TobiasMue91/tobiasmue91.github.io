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
   measures it) and should aim for 100; the shell and kit at most 96 KB (72 until the stickers, the return and the post office). Quality is bought with craft,
   not with bulk: a box that wants more room cuts something first. Libraries a box loads from a CDN
   inside its own template do not count, but must be pinned to an exact version. (The cap was 120 KB until
   the owner raised it, when the shows in Keep Off the Grass gained intruders, upgrades and a match day.)
   Here Be Rabbits alone may weigh **210 KB**: the owner raised its cap after the art was redone and a
   budget round that changed no pixel brought it only to 203 KB (`BOX_CAP` in the suite).
   Starter may weigh **200 KB**: for its refinement session (rule 16) the owner lifted every limit the
   anthology had set itself where it stood in the way of the result.
   Keep Off the Grass may weigh **200 KB** for the same reason: its refinement session (October 2026) began at
   133 KB, over the old cap, once the box had its close-up camera and props list.
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
16. **Finished, not finished enough.** (October 2026, the owner.) The internet meets AI-made games with
    suspicion and accepts only what looks and plays like a game that was years in development. That is
    the bar for every box, in every respect: art, interface, the hand's feel, sound and music, balance,
    progress, and everything else a player notices. No other rule is broken to reach it, but the limits
    the anthology set itself (the byte budget above all) give way when they stand in its path; the owner
    decides, and says so in the rulebook. More critic rounds alone do not get there: alternate them
    with **research rounds** (how do the paid games the box resembles solve this? what gives AI-made
    work away?), and work round what a language model cannot do well (draw a hand, a face, a convincing
    instrument) with outside resources whose licence allows it: free type, MIT-licensed vector sets,
    the box's own props drawn small, rather than improvising them. Starter was the first box taken
    through this; its notes are under **Open work on the shipped boxes**.

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
  feats: [[id, name, what, S => bool], ...],   // five stickers (see below)
  migrate(S, from)      // optional, once version > 1
  revisit(S)            // optional: a done state turned back into one to carry on in (see below)
};
```

**Stickers.** Every shipped box has five, `[id, name, what earns it, a pure test on the state]`. The shell
runs the core itself (`new Function('KIT', core)`), reads the live state every two seconds through `K.peek()`
and a saved state at boot, so a sticker needs nothing from the view: if it wants a count the state lacks, the
core keeps one (`S.ears = (S.ears | 0) + 1`, never a call to the PRNG, so the bots play exactly as before).
A whole game by either bot earns one to four of them (the suite checks this): about two come with playing
through, the rest want a purpose (a skill, a hidden feature, playing a part of the box harder). A box's
stickers appear only once it has been opened (rule 7).

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
a Playwright script needs to find (screen rectangles of the things to tap, the way out), `look(x, y, scale)`
to point the camera anywhere, and `props`: every object worth a close look as `[name, minutes, x, y, scale]`.
`node util/cmv_props.mjs <id> <outdir>` shoots each of them large, one tile each (see **Drawing without
glitches** below).

**Going back to a box.** The shelf offers every opened box twice: *Back to it* carries on in the box's own save,
*Play it again from the start* plays it afresh in the replay slot. A box that is done can be gone back to only
if its core has `revisit(S)`, which turns the finished state into one to carry on in (Starter: Mother back in
the cellar, risen, every card for sale, the Last Loaf hers to bake again). Its ending then leads back to the
shelf and pays nothing twice; the box the player is in stays where it was. A box without `revisit` offers only
the replay. Give every new box one where carrying on means something (upgrades still to buy, a last level to
play), and test it in the box's suite.

### Drawing without glitches

The owner found, in one look at Starter, a flower whose leaves floated free, a bowl both see-through and solid,
spoons that stood beside their crock with the lines of how they were built still showing, a lamp's light that
stopped dead, a tea towel stuck to a shelf. Every box before it has had faults of the same kind. They come from
drawing with primitives in code, where nothing forces the parts to touch, overlap in the right order or fade.
The long-term answer is a habit and a tool:

- **One thing, one outline.** A thing built from parts (a spoon is a handle and a bowl, a flower is five petals)
  is filled as one shape and outlined once round its silhouette: `solid(col, fn)` in Starter strokes all the
  parts in ink under the colour, so no line shows where they meet. Inner lines are drawn on purpose (a crease, a
  seam), never left over from construction.
- **Back to front, and things are inside things.** Anything in or behind something else is drawn in three passes:
  the back (a crock's dark mouth, a bowl's far rim), what stands in it, then the front over it. A nested bowl
  shows only above the outer rim; a spoon disappears into its crock.
- **Everything is held.** Leaves hang on stems that come out of the soil; a towel folds over the board's edge;
  a pot stands on the shelf with a shadow under it; a picture hangs from a pin. If nothing holds a part, it floats.
- **Light and shadow fade.** A cone of light is a gradient that dies away, softened at its sides, with a pool
  where it lands; a shadow is halftone or a soft ellipse. A hard-edged polygon of light reads as a cut-out.
- **Look at every prop alone, large, before calling art done.** List it in `K.debug.props`, run
  `util/cmv_props.mjs`, and look at every tile at full size, with a critic given this list as a checklist
  (floating parts, construction lines, wrong overlap, see-through solids, hard light, missing contact shadows,
  props that are a primitive and nothing more). Play-size filmstrips do not show these; the owner does.
- **Animations are checked as video.** Record the moment with Playwright's `recordVideo`, cut it into frames at
  80 ms with `ffmpeg`, and look at each frame: Starter's slice snapped shut and open again when the box was
  tapped, because the halves counted their time from the start of the current step, and opening the box began
  a new step. An animation that must hold its end pose in later steps gets it from the step it belongs to
  (`st > 4 ? 1 : ...`), never from a clock that restarts.

## The anthology's own round: stickers, returns, printings

- **Stickers.** Five per box (above) and ten for the anthology (`GLOBAL` in the shell): the first box, the
  whole stack with nothing returned, the whole stack in under four hours inside (the eager bots take about
  three; "Next-day delivery"), returning a box, replaying one, copying the save, playing between midnight and
  four, repacking, opening a box at the fastest post, thirty box stickers. Three are secret and show a hint
  until earned. A toast shows each new one; the packing slip lists the open box's, the shelf has the book.
- **Return to sender.** "Return this box unopened…" in the packing slip, for a box the player does not want.
  The hurdle is a taping game in the shell: hold at the arrow and drag along three seams of the box while it
  shifts on the table, more with each seam; straying off, running ahead or letting go tears the tape and the
  seam starts again; then a tap stamps it. A script that does it perfectly needs ten to fifteen seconds; a
  person about half a minute. The box counts as opened for the stack (the next one comes), stands on the shelf
  shut and "returned unopened", earns no postage, and spoils "Handle with care" until it is played through
  from the shelf, which counts as opening it after all.
- **The post office and later printings.** Every box opened in a printing earns postage: one stamp, two if
  it took under half an hour inside. Postage buys two perks of three levels each (3, 6, 10 stamps): *Express
  post* runs a box's time ×1.25, ×1.5, ×2 (`K` multiplies `dt`, as `?speed` does); *A head start* begins a
  fresh box as if its own eager bot had played it for 2, 4 or 6 minutes (as `?at` does). Once every box of a
  printing is open, *Repack the stack* starts the next printing: every box from nothing, the shelf, stickers,
  perks and postage kept, best times remembered. Nothing in a box changes for it, so a new box needs no work
  for it; a box that wants a printing of its own could read one through `K` later.

## Adding a box

1. Read this file, the ledger and the ideas. Run `npm run test:cmv` and keep it green throughout.
2. Write down at least eight pairs of mechanic and art direction, score them against rule 3 and the
   ledger, and choose. Name the box (an id that is a plain word, a title, a handling note that hints
   at the danger but not the content).
3. Build the core first, in a scratch file, with its two bots; tune it with `KIT.simulate` until the
   pacing is right for both bots across several seeds, with no cliffs and no dead stretches. Give it its
   five stickers and check with the bots that a whole game earns one to four of them.
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
| 1 | `starter` | Starter · "Contains live culture." | tap jars at their peak, swipe along a scoring line, punch bulges flat | timing streaks → bench and oven → containing a creature that grows through a house | 1950s cookbook print: key line, misregistered colour plates, halftone | mint, tomato, mustard, cream | mid-century domestic, cosy | kitchen foley, lounge exotica with vibraphone and theremin | a price tag on a string, index cards in a red enamel recipe tin, each with a cut of its own | the whole house bakes into a loaf; slicing it shows a bakery box tied with string in the crumb |
| 2 | `lawn` | Keep Off the Grass · "Keep hands and feet clear." | steer a mower by holding and dragging; no timing anywhere | grass box and compost trips → jobs for the street and robot mowers → stripes judged at three shows, the judges asking for something else each visit (towards their table, along it, edged with a lap), with a dog, a sheep, geese and a pitch invader to chase off, and a cup final judged before kick-off, at half-time and at full time → a crop circle | real-time miniature: toy voxel houses on real grass, blade by blade, in hand-written WebGL 2 with a shadow map, shown through a miniature photographer's lens (tilt-shift, contact shade) | lawn greens in stripes, lemon, cobalt, flamingo pink; indigo and moonlight at the end | 1990s suburban summer, small-town show | a two-stroke engine and grass hiss, a cheap keyboard's demo song, brass for the show, a music box at midnight | a moulded plastic dashboard, blister packs on a hardware-store pegboard | the field was a box: the crop circle is its net, it folds up, and the number is printed underneath |
| 3 | `clew` | Tilt · "Contents may rattle." (first shipped as Minos Wants a Map · "Do not unwind.", then as The Minotaur Moves Out, then built as Stand Well Back) | hold a thumb on the board and steel balls pour in at that column; slide to aim the stream; tap to set the auto-launcher and to catch lanterns | games of a few seconds to two minutes, each ending with the tray, and a skill tree between them; a Big One on each board keeps its damage between games and opens the next, taller board | 2D canvas neon: glowing tubes, chrome balls with a hard highlight, a painted playfield behind glass, a brick wall at night for the sign | navy, hot pink, cyan, gold, cigarette haze | 1980s pachinko parlour, escalating to the absurd (the parlour on its side, the street, the mountain) | thousands of tiny ticks, tulip chimes, the reels, a fever fanfare, a neon tube striking; an original chiptune march that gains a part per board | the parlour's neon sign as a lucky wheel: 162 bulbs, a four-quartered star round TILT and a ring per board | the mountain's Big One is a cardboard box with the next number; OPEN IT, and the lid lets the light out |
| 4 | `flurry` | Snow Day · "Contents may be thrown." | tap a kid to throw at them (the rules lead a runner, cover stops a plain ball); tap their snowballs in the air to swat them; tap a passing sledge; fire the catapult | runs that end when you are too cold, a felt tree between them; every hit wears a kid's resolve down for good, and a kid with none left crosses over and throws for you, so the gang you fight becomes the army you have; a yard falls when its whole gang has come over | real-time 3D as a stop-motion TV special: felt puppets with fibre and fuzz, cotton-wool snow, poses that change twelve times a second, a warm grade, grain and vignette | snow white and frost blue, cranberry, pine, mustard; the light goes from morning to a pink sunset to a violet night | 1960s Christmas TV special, winter suburb escalating to a yeti's mountain | crunch and splat foley, sleigh bells, a celesta waltz with pizzicato bass that gains a voice per yard, muffled indoors | a felt Christmas tree on a wall hanging in the front room, a tier per yard, baubles as nodes | the yeti gives up last and brings a present with the next number on its tag; open it and the lid lets the light out |
| 5 | `warren` | Here Be Rabbits · "Contents may multiply." | drag towers anywhere on open ground and turn a monk's fan; sound the horn for the next wave; draw the dragon's line, the ink's pour and the great bell's ring across the horde; tap golden hares that run for the castle | folios of waves with a pause between them and one wall for them all; a lost folio starts over, its leaf kept; the Tree of Jesse between folios and between waves; the castle's valley, the river, the forest and village, the mappa mundi, the rabbit king | an English Gothic manuscript of about 1320 on a 2D canvas: every folio a page painted with more of the land (meadow, roads, bracken, woods, a river with bridges, a village) round a castle, the rest of the page a faint underdrawing; a crowd of tens of thousands of marginal rabbits | vellum, iron-gall brown, vermilion, lapis, verdigris, raised gold | the 14th century, the world turned upside down | quill scratches, arrows, squeaks, a bell, a dragon's roar; an original estampie for shawm over a hurdy-gurdy drone that gains a tabor, a second shawm and chimes chapter by chapter | a Tree of Jesse: Jesse asleep at the root, four scrolling boughs, a gilded initial in every medallion | the defeated rabbit king kneels with a book shrine (a cumdach) with the next number on its lid; OPEN IT, and the light comes out |
| 6 | `guests` | Unwelcome Guests · "Do not open after dark." (built first as a tap-the-furniture draft) | hold a finger on the house and drag: the ghost glides after it and its cold drives people away; tap a doorway, the telephone, the chandelier | short nights against ectoplasm and the dawn, the organ between them; every exit costs a pip of resolve for good; five casts, from a family of three to a film company and thirty extras | silent film: Reiniger cut-outs, black people before grey furniture, frost round a cream card ghost, tinted stock, grain, intertitles, iris | night blue, cream, black; warm sepia in the cellar | 1920s, gothic comedy | an upright piano in the pit, organ pipes that sound when bought, a telephone, a crash | intertitle plates, cast cards with pips of resolve, the organ in the cellar | a crate delivered after dark; the iris closes on it |

Pacing as measured by the test (eager / casual minutes, three seeds): Starter 30–32 / 48–50,
Keep Off the Grass 30–34 / 58–64, Tilt 42–46 / 58–64, Snow Day 35–38 / 54–58,
Here Be Rabbits 41–43 / 75–85, Unwelcome Guests 35–38 / 71–78.

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
and the plan for the fourth attempt that follows. Stand Well Back had already been merged to `main`
(PR #391), so Tilt replaces it in place.

**Tilt** (`CORE.version` 4) is the fourth attempt, built from the plan below; what changed on the way is
noted under it. The owner played it and liked it; their notes (frame rate, the sign on a desktop and as
a figure, feedback for every payout, tulips that pay a prize, a launcher set by hand, a bonus to catch,
the Big One's last stretch in view, damage you can see) are recorded below and in the lessons.

### Box 3, fourth attempt: Tilt (the plan)

Written for the session that builds it. It replaces Stand Well Back under the same id `clew` (rule 9):
`CORE.version` 4, and a `migrate` that starts old saves fresh.

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
- *A tulip pays coins and shoots the ball back up.* With pockets paying a ball each and no limit, a
  well-upgraded game fed itself for minutes. Then a tulip took a few balls and paid one back for each, and
  the owner found a catch felt like a punishment: one ball back only drags the game out. Paying five balls
  (and 2% of the tray) instead swamped the balance: 385 balls became 1,350 in seconds. What fits: a tulip
  takes two balls a game; for each it pays a prize in coins (four times the board's value; "Rich tulips"
  adds half per bulb) and fires the ball straight back up the rail ("Double tulips": as two), so a catch
  is a win and another lap, the tray does not grow, and the game does not drag. A full tulip closes into a
  dome over its posts that balls roll off; the start pocket takes four once the reels are bought. After 60
  seconds it is *last call*: the pockets stop paying and the tray pours three times as fast.
- *The Big One takes the square root of a blow.* Damage grows by multipliers, so a Big One big enough to
  last ten games barely moved for the first eight (0.3% a game) while showing "−127,590" under it; the
  owner asked why so many hits did so little. Now it takes the square root of each ball's damage (its own
  multipliers, Break the bank, Hairline cracks and Open sesame, in full), and its counts are small enough
  (1,500 · 150K · 1.2M · 5.5M · 75M) that every game takes 2.5 to 5% off at the start of a board and 15 to
  25% at the end. It cracks a little more at every fifth.
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
  a crate of balls).
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

Unwelcome Guests waits below the marker as the draft for slot 5.

### Box 4: Snow Day

The owner asked for a 3D game where you either farm things or shoot them, as something unlike the other
boxes, and left the choice open. Snow Day takes the shooting half and makes it a snowball war, which keeps
the anthology's tone (nobody is hurt, the losers change sides) and gives the shooter a reason to be
incremental: the gang you fight is the army you end up with.

**Why after Tilt.** Tilt's hands hold still and watch a stream fall; here they pick a target and tap it
the moment it stands up, and swat what comes back, so the rhythm is reaction rather than pour-and-watch.
Tilt is 2D neon on a canvas; this is lit 3D, but felt and cotton wool rather than Keep Off the Grass's
voxel miniature, and seen from behind a wall rather than from a drone. Against the ledger it is new on
verb, medium, palette, era, sound and interface; its loop shares only rule 15's run-and-tree shape.

**The eight that were weighed** (surprise / depth / fit / distance, out of 10): a snowball war in felt
stop-motion 9/8/8/9 (chosen); an asteroid laser in a 1970s paperback cockpit 6/7/8/6 (a Big One again,
and generic); a pumpkin patch to defend, farming and shooting, in claymation 7/7/7/5 (a garden right
after box 2's lawns); harpoons from a sky trawler, Ghibli-painterly 8/6/7/8 (leading a shot is fiddly on
a phone); a 3D fairground shooting gallery in painted tin 6/6/8/5 (gambling again after Tilt); a tiny
planet to harvest, toon 6/6/7/4 (tap-when-ripe is Starter's verb); a top-down horde survivor in a toy box
5/7/8/7 (too familiar); hi.exe 8/6/6/9 (neither 3D nor shooting). Flotsam's raft was weighed again and
still steers a vehicle.

**The checklist, answered.**
1. *Second one:* a kid stands up behind a snow wall with a snowball; tap them and yours lands with a splat,
   they fall over in the snow and coins fly to the counter. The first hit on each kid in a run pays three
   times.
2. *The limit:* warmth, 24 seconds at the start, draining faster as a run goes on and four seconds for
   every snowball that gets through. The first run lasts 15 to 25 seconds.
3. *The challenge on screen:* the gang behind their cover, each with a bar under their feet, Big Rosa
   named; "0 of 4 won over" under the yard's name.
4. *The first buy:* two baubles at the foot of the tree cost 2: Packed hard (+1 damage) and Woolly scarf
   (+4 seconds of warmth).
5. *Nodes that change the game* (eager bot): Two-handed, a second snowball at another kid (min 3);
   Good swat (min 2); the snowman on the wall (min 6); ice balls through cover (min 7); Biscuit the dog,
   who catches what comes at you (min 15); the catapult (min 21); Volley! (min 23). The kids who cross
   over arrive from minute 2 and keep arriving: 34 by the end.
6. *Minute 40 against minute 1:* four kids in a garden and you alone with three snowballs on the wall,
   against the yeti on a violet mountain with thirty kids, two snowmen, a dog and a catapult on your side
   and the air full of snowballs.
7. *Automation:* your side throws by itself, the snowmen and the dog too; you keep choosing the target
   (finish a kid off to win them over, or spread hits for coins), swatting, catching the sledge, and
   firing the catapult.

**As built.**
- *The yard is narrow and deep because of the phone.* The rules' yard is 7 wide and 15 deep; an upright
  phone looks down from the top of the fort (the camera is fitted to the yard's width), its wall is drawn
  nearer the gang, and the puppets are drawn half as large again as life. The desktop stands lower and
  closer. Only the view does this; the rules are the same.
- *A kid's bar lives in the state and never refills.* That is the cumulative goal, as Tilt's Big One
  was, but spread over a gang: a run that wins nobody over still visibly moves several bars.
- *The rules lead a running target* and resolve every snowball where it lands, so a kid who ducks in
  time is behind cover and the ball says BEHIND COVER!. Ice goes through.
- *Pacing* is set by each yard's resolve (6, 75, 2,600, 40,000, 600,000 a point) against the tree's tiers
  (1, 40, 1,500, 60,000, 2.5M a bauble): the eager bot takes about 7 minutes a yard, the casual 11.
- *A yard won stays on screen* until the next run: the last kid crosses over, your side cheers, and only
  then the card.
- *The music* is an original waltz for celesta, pizzicato bass and sleigh bells, faster and fuller with
  each yard and muffled behind glass in the front room.

**Critique (rule 4).** Four rounds, each a fresh critic with phone and desktop filmstrips (the first
minute, minute 12, a kid crossing over, the run's end and the tree, the ending). First impression,
clarity, art direction, phone, feel: 5/4/6/4/4, then 6/4/6/5/5, then 6/5/6/5/5, then 7/5/6.5/5/6. The owner then asked for one more round of polish (cotton-wool snow from a
lumped normal, walls of snow lumps, your side's coins added up in one tally under the counter, only the nearest
of your side on a phone with a tag for the rest, cards that arrive, a yeti who nudges his present); a fifth
critic scored 6/5/7/5/6, and its cheap notes were done after it (names on felt pills, the news line under the
yard's name, the catapult explained when it first appears, rings only once a ball has left the thrower, no BUY
button without a bauble, felt fibre and stitching on the tree). Fixed on the way: the end card that drew over the
tree on a reload (stale events), a first run that paid one coin, a phone camera that showed the yard in
its top third, bars across faces, minus numbers that read as your loss, a yard that changed before the
last kid had crossed, a giant incoming snowball that whited out the screen, the present that cut to the
next box without opening, a tree whose locked tiers filled the screen. Every score is still under 8 after the four rounds the procedure allows, and after the fifth. What the last critic asked for,
most valuable first: the call-outs still stack on the mountain, where coins arrive by the million (the
threat rings were made thicker and darker and the big payouts summed after that round); kids at the back
of a crowded yard are still small on a phone, and your own side becomes a wall of hats by the mountain;
the snow walls, snowballs and ground are smooth where the puppets are felt; the yard-won card and the
yeti's present wait without an idle animation. Two notes from every round came from the capture rather
than the game: an automated player tapping once a second in a software renderer earns a third of a
person's coins, and frames a second apart cannot show a walk that takes two. Nobody has played it on a
device yet.

### Box 5: Here Be Rabbits (the plan, and as built)

Written for the session that builds it, after the owner asked for a box that feels big and escalating
from its first second, in the manner of *Sir, We Have an Orc Problem* and the horde-survivor
incrementals, with levels larger than the earlier boxes' so that the player does not feel hemmed in.
Five pitches were put to the owner (October 2026); this one was recommended and the other four are in
the ideas below. Unwelcome Guests stays a draft below the marker.

**One line.** Tower defense as a medieval manuscript: the killer rabbits of the margins pour onto the
page by the thousand, flowing round everything like a liquid, and you hold the castle in the
illuminated initial with archer monks, snails and a dragon. Every run pays, the book grows a page at a
time, and by the end the battlefield is the whole world on a mappa mundi with a hundred thousand
rabbits coming from its rim.

**Id, title, handling.** `warren` · *Here Be Rabbits* · "Contents may multiply." (Change them if the
comparison in step 2 finds better; the handling note must not say rabbit.)

**What the research found** (store pages, reviews, guides; October 2026):
- *Sir, We Have an Orc Problem* (Mumpitz Games, July 2026, about 86% positive): the first stage is
  400 orcs, the last about 160,000, up to 40,000 on screen without stutter; they flow along routes like
  a fluid and fly off hits "like pinballs". You place a limited number of turrets (12 at first, one more
  is a big purchase) and turn their firing arcs; abilities (strafing run, orbital laser, cryo beam,
  nuke) save a front that is about to break; a rare silver orc pays extra; a run pays even when it is
  lost; turret positions are kept per level, so re-arranging them is a small puzzle. Players love
  "filling the map with turrets" and the sight of the horde shredded. They complain that after the
  first few levels it becomes farming the same maps for currency, that most nodes are stat-only and the
  tree bloated, and that the demo felt better than the full game. Its model, *Outhold*, starts slow and
  opens up with its tree; players asked for a faster-wave button.
- The rabbits are real: the Smithfield Decretals (London, 1340s, BL Royal MS 10 E IV) tell in strips
  across several pages how rabbits shoot, try and behead a hunter; the Breviary of Renaud de Bar (Metz,
  1302–03) has a rabbit riding a snail with a lance; the Gorleston Psalter (1310–24) has a knight
  swinging at a rearing rabbit and an axe-wielding rabbit before a king. Knights kneeling before
  snails are a standing joke of the margins from about 1290. Scholars read both as *the world turned
  upside down*. The pointing hand in the margin, the manicule, is the period's own way of saying
  "look here" (rule 10).

**Why it fits the owner.** It is the game they asked for, with the two fixes its reviews ask for:
every run advances the book, so there is nothing to farm, and the nodes that matter change what is on
the page. The verb (place and aim, then fire abilities across a wide map) is new to the anthology, and
it follows Snow Day's reaction taps with a different rhythm: choose, watch it play out, and keep
several fronts in the air.

**The checklist, answered.**
1. *Second one:* 400 rabbits are already pouring in at the bottom margin. A manicule points at a gold
   roundel by the castle; drag an archer monk onto it and swing his fan of fire, and the stream breaks
   into tumbling rabbits and flakes of gold leaf that fly to the counter. The first run also has one
   free dragon: swipe a line across the horde and it strafes it.
2. *The limit:* the castle wall. Every rabbit that reaches it takes a bite; at zero the run is over.
   The first run lasts about 20 seconds and holds back maybe a third of the horde. Later runs last one
   to three minutes. A run that beats the whole horde clears the folio.
3. *The challenge on screen:* the horde itself, a counter in red rubric ("CCCC rabbits", Arabic
   figures beside it), the wall's bar, and the folio's number.
4. *The first buy:* the first run pays about 15 to 25 leaf. The root of the tree has three medallions
   at 5 to 12: a second monk, sharper arrows, the dragon kept for good (one strafe a run).
5. *Nodes that change the game* (eager bot, roughly): snails, which the horde has to flow round and
   which slow it (min 3); golden hares, a rare rabbit worth fifty (min 4); the trebuchet, splash at
   range (min 8); the bell tower, whose peal chains through a crowd (min 12); hounds, the Smithfield
   hounds turned round, which push the stream back up its route (min 16); the inkpot, tipped over a
   front to make a slow, dark pool (min 20); the flood, the box's nuke, washing a whole page clean once a
   run (min 26); the rabbit knights on snails, armoured, and the rabbit king who comes last.
6. *Minute 40 against minute 1:* one page, one stream, two monks; against the world disc of a mappa
   mundi, rabbits from every edge where the monsters live, a hundred roundels manned, the bells going,
   the dragon and the flood in the same minute, a front you scroll to.
7. *Automation:* towers fire by themselves; the abilities are the hands' work all game (each a drag:
   the dragon's line, the inkpot's pour, the bell's ring); a golden hare to grab before it leaves the
   page; and between runs the placing and turning of towers, which the player keeps by hand. A late
   node can fire the dragon on its own at the thickest front, but only along a line the player drew.

**The book, growing** (the levels; units 100 wide, as in Tilt, the screen shows about 100 × 180 on a
phone). The map never zooms out to fit; it grows under a camera that travels (*An upgrade must not
shrink the picture*):
1. **A page**, folios 1–3: a Psalter page about two screens tall, the castle in the initial at the top,
   the horde from the bottom margin; each folio adds a route. 400 · 900 · 2,000 rabbits.
2. **The bifolium**, folios 4–6: the facing page opens, the gutter is a river with bridges; a second
   front. 3,000 to 12,000.
3. **The open codex**, folios 7–9: the book lies open with its quires fanned out, rabbits climb in
   through bookworm holes and over the page edges; three or four fronts, about six screens' worth.
   15,000 to 50,000.
4. **The mappa mundi**, folios 10–12: the world as a disc with Jerusalem at its centre and east at
   the top, the castle there; rabbits pour in from the rim where the Blemmyes and Sciapods live
   ("hic sunt lepores"), about twenty screens' worth. 60,000 to 150,000.
5. **The way out:** a book shrine (a *cumdach*, the metal box a medieval gospel book was kept in),
   jewelled, with the next number on its lid, carried in by the defeated rabbit king. Open it and the
   light comes out (rule 8).

Towers stay where they were placed when the map grows, so the player's own work fills the world. A
strip along the rim shows the whole map with the fronts marked red, and is a scroll bar (Tilt's lesson);
drag pans, wheel and pinch zoom within limits, and AUTO CAMERA follows the front that is about to break.

**Tree: a Tree of Jesse.** The period's own picture of a tree: a vine growing from a sleeping figure
at the root, medallions on its branches. Designed as a figure, symmetric, with four main boughs (monks
and arrows; snails and hounds; trebuchet, bells and the inkpot; the dragon, the flood and the leaf), and
a bough per chapter that stays dark until that chapter opens. About 150 medallions, first ones at
5 leaf, faint outlines from the start (*A skill tree is a picture*). Give stat nodes a visible face
(the monk's tonsure gets a gold ring, arrows grow red fletching) so that a small number still shows.

**Look and sound.** An English Gothic manuscript of about 1320: vellum with its grain and a ruled
grid, iron-gall ink outlines, flat body colour (vermilion, lapis ultramarine, verdigris, lead white)
and raised gold leaf that glints as the camera moves. Rabbits are drawn as the margins draw them,
upright, muscular, with weapons; a few drawn sizes and poses suffice because the crowd is the picture.
Hit rabbits tumble off the vellum with an ink splash; nobody bleeds. Headings in a textura from Google
Fonts, numbers in red. Sound: quill scratches, the thwip of arrows, squeaks, a bell; the music an
original estampie (shawm, tabor, hurdy-gurdy drone) that gains a voice per chapter.

**Ledger check.** Against Snow Day, the box before it: verb (place and aim, abilities by drag against
tap to throw), medium (2D manuscript against felt 3D), palette, era (14th century against the 1960s),
sound and interface (a Tree of Jesse against a felt Christmas tree) all differ; the loop shares only
rule 15's run-and-tree shape, and both have a crowd that grows, so make the horde a flood and not a
gang of people. Against the ledger as a whole it is new on six of the seven; the loop is rule 15's shape, as in every box since Tilt. It takes the look of
**Scriptorium** from the ideas; strike that one through if it ships.

**Engineering notes.**
- *The core counts, the view draws.* The horde lives in the core as a count per grid cell (2 units a
  cell) flowing along a flow field toward the castle (Dijkstra from the wall over a cost field;
  recomputed only when a snail, a pool or a new page changes the costs), with a cap per cell so a crowd
  backs up and spreads round obstacles. Towers take rabbits from the cells in their arc. Only special
  rabbits (golden hares, knights, the king) are agents. Integer counts and the PRNG in the state keep
  it pure (rule 12) and fast enough for the pacing test's six whole games.
- *The view draws individuals from the counts:* a rabbit's place inside its cell comes from a hash of
  the cell and its index, it moves with the cell's flow, so the crowd never shimmers and the camera's
  rule from CLAUDE.md holds. WebGL 2, one instanced draw, a budget that drops when frames are slow
  (Keep Off the Grass's `gauge`); past the budget the densest cells become a tide of packed rabbit
  fur drawn as one texture.
- *Pacing:* the eager bot 35 to 50 minutes, the casual under 90, a new thing at least every three
  minutes; a folio must never need more than three or four lost runs (measure it: *A gate only money
  opens turns a level into a grind*). Budget: aim for 100 KB, cap 130.
- *Phone first, desktop as carefully:* roundels 44 px or more, the arc turned by dragging the
  monk's fan, abilities from a strip at the thumb; on a desktop hover reads, click buys, the wheel zooms.

**Before building**, the session shows the owner one still frame at phone and desktop size (the first
page with the horde and the tree) and then follows `.claude/skills/next-box` from step 3.

The owner saw the still (the first page with the horde, and the tree, at phone and desktop size) and the
box was built from the plan. What moved away from it, and why:

**The eight that were weighed** (surprise / depth / fit / distance, out of 10), to sharpen the chosen
idea rather than replace it: tower defence in a Gothic manuscript's margins 9/8/8/8 (chosen); the same
horde stitched into a Bayeux-style embroidered strip 7/8/8/5 (textile right after Snow Day's felt, but it
gave the camera that travels instead of zooming out); the horde behind stained glass, the lead lines as
walls 8/7/7/8 (a window cannot grow page by page, but it gave the idea that the page's own furniture is
the maze); a reverse tower defence where you are the rabbits 8/6/6/7 (it loses the defending verb the
owner asked for, but gave the golden hares that run their own way); Kaiju on the Tōkaidō 9/7/7/8; The
Colony 8/7/7/7; General Staff 7/7/8/5; Kraken Brood 7/6/8/7 (the last four as pitched for this slot). The
name and the handling note stayed: "Breeds in the margins." was weighed and says too much.

**The checklist, as first built** (the remake below changed the levels, towers and waves). (1) In second one four hundred rabbits pour out of the warren at the foot
of the page; a manicule walks a ghost monk from the tray to a roundel by the castle, and once he shoots,
the hand points at the dragon: the first run has one flight free. (2) The wall: every rabbit that reaches
the castle takes a bite and runs off with it; the first run lasts about 20 seconds. (3) The horde's count
and bar, the wall, and the stream itself. (4) Run 1 pays 60 to 90 leaf; the trunk's three medallions cost
22 to 45 (Brother Anselm, Sharper arrows, Keep the dragon). (5) For the eager bot (seed 1): snails at
minute 1, golden hares 1.6, the trebuchet 2.4, the hounds and the dragon's second wind 4.5, the great
bell 5, the inkpot 6, the flood 11, the dragon that flies your line by itself 25, the king 30. The new
pages carry the stretch from 11 to 25 (the open codex at 11, the mappa mundi at 20); a game-changer there
is the first thing to add if the middle drags. (6) Four hundred rabbits up one column of one page against seventy thousand on a world map at
once. (7) Towers fire and the hounds run by themselves; the hands place and turn, draw the abilities, chase
the hares and move monks to the front that breaks.

**As built** (what moved away from the plan, and why):
- *(First build, replaced by waves in the remake below.) Every run turns the folio further, by design.* A rabbit that reaches the wall takes a bite and runs
  off with it, out of the folio's count, so a lost run removes the wall's worth (15% of the folio at the
  start) plus whatever was killed. With the last 4% scattering by themselves, the bots need at most three
  lost runs on any folio (the suite checks four); that is the plan's "no farming", measured.
- *Canvas 2D, not WebGL.* The vellum, the minims of the script and the gold need crisp vector strokes at
  any zoom, so the page is painted into 64-unit tiles at the camera's scale and only moved; the rabbits
  are one sprite atlas (two directions, four coats, run and hop, a spear), each placed by a hash of its
  cell and index and sliding along its cell's flow, so the crowd never shimmers. A gauge drops the
  number drawn when frames are slow; the densest cells lie on a fur texture underneath.
- *(First build, replaced by the land in the remake below.) The page itself is the maze.* Lanes (margins, the intercolumn) are fast, the script is slow (a crowd
  that spills over it wades), bars, miniatures and initials are walls. Each folio adds a way: the
  intercolumn, then the outer margin, then the inner one.
- *Snails slow, they do not block.* Blocking snails rerouted the whole horde away from the monks' fans,
  and overlapping slow rings stacked to 1% speed and jammed runs for minutes. Now the way is found by
  the page alone and a snail only slows the crowd round it (to at least 18%).
- *No rabbit knights, no bell tower.* Both were built and cut for the budget; the great bell stayed as
  the ability, and the trebuchet's bough gained counterweights, mangonels and Greek fire for the ink.
- *The view keeps the castle in mind.* AUTO follows the front nearest to breaking and keeps the castle in
  frame when both fit; when it does not, a badge at the screen's edge points to the castle with the wall
  round it. The overview strip in the bar is a scroll bar; the wheel and a pinch zoom, never out beyond a
  quarter less than the start.
- *The Tree of Jesse is a figure, ~100 medallions.* Jesse asleep at the root, the trunk with the first
  buys, four scrolls that curl inwards (monks; snails and the wall, once with the hounds; engines and ink; the dragon,
  the hares, the flood and the leaf), each medallion a gilded initial; a chapter's medallions wait as
  faint roundels with its numeral. Fewer than the plan's 150, for the budget.
- *Sizes:* the horde grows from 400 to 180,000 a folio and then the king's household; up to about
  70,000 rabbits stand on the mappa mundi at once (eager bot, seed 1).

**Critique (rule 4).** A critic scored the still before the view was built (first impression, clarity,
art direction, phone: 5/4/6/5); its notes gave the parchment control bar under the page, the manicule and
the ghost monk, the rubrics and line fillers in the script, the art on the waiting verso and the
medallions on the tree's empty scrolls. Then four rounds, each a fresh critic with phone and desktop
filmstrips (the first minute with real drags, the bifolium, the open codex, the mappa mundi, the king's
household and the ending): first impression, clarity, art direction, phone, feel 7/5/7/5/5, then
7/5/7/5/5, then 7/5/8/5/6, then 7/5/7/5/5. Fixed on the way: a dragon flight that drew nothing (an event
field overwrote its kind), monks shooting into nothing after snails rerouted the horde, a crowd that read
as brown noise (sepia outlines, cream coats, a fur carpet with three runners, a large rabbit in every
crowd), slain counts for the abilities, a badge for the castle when it is out of sight, empty roundels
with a cross, coloured bases and a parchment halo under the towers, which now stand over the horde,
chapter cards, prices on the tree, a red flash and shake when the wall falls, a card that leads with how
many rabbits are gone for good, captions moved up away from where the horde comes in. Every score stays
under 8 after the four rounds. Still open, from the last critic, most valuable first: the horde should
be a lit liquid with individual rabbits only at its front and where it dies, so ten thousand of them
never cover the art; on a phone the later chapters want their own framing (a pull-back to the whole
spread or the world before the dive); kill counts larger and fewer; the Tree of Jesse larger on a phone,
with cost and effect on the medallion; the book shrine drawn as a real reliquary with tracery, and the
king given a phase or two; on a desktop the dead verso could carry a run log or a bestiary. Nobody has
played it on a device yet; the frame-rate gauge is untested on a real phone.

**The owner's playtest, and the remake.** The owner played the first folio on a phone and found the
auto camera shaking, no time to prepare before the rabbits came, the gold roundels arbitrary (why not
place towers freely?), the levels straight lines, and the foot of the Tree of Jesse unreadable; they
wanted realistic terrain and nature for a horde tower defence rather than the page's columns. Then, after
a second look: the defenders at the top left had nowhere to stand, the box could look much better, the
dragon vanished while its fire was still burning, and some of it felt borrowed from the pachinko box
without fitting a tower defence. The box was rethought on its own terms rather than patched:
- *Waves, not runs that wear the level down.* "Every run turns the folio further" was Tilt's Big One,
  which keeps its damage between games, carried over to a genre where it reads as a cheat: losing moved
  you on. Now a folio is a tower defence level of three to six waves with one wall for all of them; the
  first wave waits for the horn, each later one comes by itself nine seconds after the last is all in,
  and calling it early pays leaf. A lost folio starts again from the first wave; the leaf won is kept,
  and the Tree opens between waves too, so a level can be turned round in its pauses. The stragglers that
  scattered by themselves and the leaf counter that popped over every kill went with it.
- *The land, not the page's columns.* Every folio is a page painted with more of the country round the
  castle, which now stands on its mound in the land itself: roads (fast), meadow (slower), bracken (slow),
  woods, rocks, ponds and a river (walls, with bridges where the roads cross), a village. The four
  chapters are the castle's valley, the river to the west, the forest and village to the east and north,
  and the mappa mundi. What is not painted yet is bare vellum with a faint sepia underdrawing of the woods
  to come. The meadow, woods, roads and rivers are drawn as smooth shapes from the folio's own list, then
  tufts, flowers, bracken, boulders and trees cell by cell; the horde's ways are worn into the grass.
- *Towers stand anywhere on open ground*, at least 20 units from the castle and 7 from each other; a
  dragged tower floats above the finger, green where it may stand and red where not, with a gold ring at
  the best spot. The bots set every tower again by the new ways when a folio opens.
- *Abilities rest, not run out.* Each has charges that come back after a rest (dragon a minute, ink 30 s,
  bell 35 s, flood 90 s). The dragon flies its line in 2.6 s and then climbs away over its dying embers.
- *Golden hares run for the castle* along the horde's way and take 8% of the wall if they get there; a tap,
  the dragon or the flood catches them. The hounds were cut for the budget the landscape needed.
- *The camera* eases toward the front nearest the castle and only moves once that leaves a dead zone in
  the middle of the screen. Jesse is drawn asleep in a bed with a caption under him.
Measured with the bots: the eager bot never loses a folio more than once, the casual bot at most three
times; the casual bot's 80 minutes are mostly the pauses it waits out between waves.

**The second playtest, on a desktop.** The owner liked how it plays and asked for much more detail in
the art, with the budget set aside until the box looks right (the budget suite fails for warren until
then, on purpose). Their notes and what changed:
- *Rabbits that flickered and jumped.* The view drew up to three sprites per cell from the rules' counts,
  so a rabbit vanished from one cell and reappeared in the next. Now the view keeps rabbits of its own
  that run the flow field at the rules' pace, each choosing its next cell where the rules have rabbits it
  lacks, and every frame brings their number back towards the rules' count block by block (three cells
  a side): a surplus runs over to the nearest shortfall, and only what is left fades out or in. That cut
  the fades from about 250 a second to about 10 in the first wave.
- *Art with detail*, painted once at load into sprites and patterns: field rabbits in five coats (one
  gold, for the hares) gathered and stretched, side on, with shadow, belly, fur, ear and scut; oaks,
  firs, birches and bushes with lit leaf clumps; a castle of dressed stone with round towers, roofs,
  banners and a portcullis; cottages in thatch and tile; burrows; boulders; grass, earth, water and
  bracken textures laid in the land's own units so that no tile seams; monks with habit, tonsure,
  quiver and a longbow; a timber trebuchet; a shaded snail; a dragon seen from above with ribbed bat
  wings. Cloud shadows drift over the land and a vignette closes the edges.
- *The archer tray cut in half at the bottom left*: the bar keeps a height of its own on a desktop.
- *Burrows on top of each other*: they are spaced along each entrance.
- *Woods and meadows over the edge of the land*: woods and bracken now grow only on painted ground,
  and everything but the trees is clipped to the meadow.
- *Jesse still broken*: drawn again as a figure on a carved bed under a lapis coverlet, the vine from his
  breast, and the tree is framed on a desktop with Jesse at its foot.
- *Text and controls too small on a large screen*: they grow with the screen, and A− / A+ (or the + and
  − keys) set the size, kept in the save.

**A polish round** after the owner pointed at the manicule ("that is not a hand") and asked for more of
the same kind of fault to be found. Every sprite was dumped into one gallery and every scene shot close
up, which found: the manicule (now a hand in a red cuff with a pointing finger, three curled ones and a
thumb, painted once at three times the size); the rabbit king (a crude stick rabbit on an outsize snail,
now a seated king in an ermine-trimmed robe with crown and sceptre on a smaller snail); the ending (a flat
yellow box with dots and stick rabbits, now a gilt cumdach with an engraved arcade, pearls, cabochons and
a crystal on its cross, before a court of field rabbits and the king kneeling towards it, in a gold frame
with quatrefoils, and the HUD and captions cleared away); the ink (a black sausage, now a spilt pool
with a sheen and splashes); ponds (perfect circles with stitched rims that read as globes, now uneven
flattened shores with rushes); woods (round balls of trees, now ragged at the edge, in the rules too);
the dragon (twice too big on a phone) and its icon; a flood icon that was a blue box; a trebuchet whose
counterweight tilted with the arm and stood on a white disc; tree medallions crowding the trunk and
their prices. The mappa mundi gained ploughed, wheat and green fields, villages, mountain ranges, and
cogs and sea serpents on the ocean round the world; bracken has a soft edge and ferns.

**A second polish round**, from the owner's play: the wall shows its points (`92 / 100`) and every bite
floats its loss over the castle, which flushes red, sheds stone chips and throbs on the off-screen marker;
roads are drawn all at once, layer by layer, so junctions merge, with rounded bends, ruts, a grassy crown
and pebbles, and never over water; rivers run out over the land's rim instead of stopping in a notch or
mid-meadow; fields line the roads, clear of woods, banks and holes; the minimap marks the horde's holes
with arrows to the castle; a *Recall all* button takes every defender back to the tray, and a monk set
down anew faces the way the last one was turned on that folio; the abbot's nimbus is a gold disc behind
the head, not a ring round it. The crowd was smeared because the view's rabbit budget was measured on the
whole frame (so a slow page thinned the horde to near nothing) and rabbits came and went see-through:
now the budget follows only the horde's own cost, a cell shows at most nine rabbits, they grow out of and
sink into the ground opaque, and only a few dozen slain tumble at once.

**Two more kinds of defender**, because the owner found one archer a thin war: the **falconer** (on the
engines' bough from chapter II) sets his falcon on the rabbits nearest the wall within a wide ring, and on
golden hares and the king first, and is drawn with his falcon hooded on his fist and stooping out and back
from it; the **ferret** (on the snails' bough from chapter III) may only be set beside a rabbit hole, and
bolts what comes out of it. They are drawn in the monk's manner (a hooded falcon with a barred breast and
jesses, a sable ferret sitting up with its mask), since the Fluent set's flat animals did not match the
page. Each answers a question the archer cannot: the falconer what slips through to the wall, the ferret
where the horde is born. The view's event log is capped, and at the late folios kills overflowed it and
pushed out stoops (and could push out bites): the oldest kills now go first.

**Weighed again** (budget round 1). The box weighed 218.9 KB. Fixed shapes are now SVG-like path data
(`P(c, 'M… L… Q… C… Z')`, which replays the same canvas calls, so nothing is redrawn differently), with small
helpers for polylines, one-colour fills and strokes, and a dressed-stone `block` for the castle; the Fluent paths
are kept to 0.01 of their 32 grid; `rabbitPath` (dead since the field rabbits) is gone; the comments say what a
thing is in fewer words. That is 203 KB, every sprite and every scene pixel for pixel the same as before except
sub-pixel edges of the hand and Jesse, and the core untouched, so both bots play exactly as before. The rest could not
come out without losing art or play, so the owner raised this box's cap to 210 KB.

### Box 6: Unwelcome Guests, remade (the plan)

Written for the session that builds it, after the owner asked whether the draft could become box 6. An
assessment against rule 15 (October 2026) found that it passes rule 3 against Here Be Rabbits but fails
the owner's checklist: there are no runs (one continuous game whose only limit is ectoplasm that refills
by itself), the eager bot spends 31 of its 39 minutes in pauses of more than three seconds between frights
(wait until something is ready, then tap: Starter's rhythm, the reason it left the stack), minute 30
looks like minute 0 (the same six rooms, one family fewer), and the Newlyweds reel runs ten and a half
minutes without anyone leaving. The shell is worth keeping: Hollowmere House as a Reiniger cut-out, the
tint of the hour, intertitles, the piano in the pit, a family per reel, the crate after dark. The loop
is remade under the same id (`CORE.version` 2, and a `migrate` that starts any old save afresh).

**Compared** (mechanic and look; the look stays the shell's silhouette film, so the mechanic decides):

| # | pair | surprise | depth | 30 to 90 min | rule 3 and the checklist |
| --- | --- | --- | --- | --- | --- |
| 1 | **Boo them out**: the ghost is under the finger; a cold spot rattles what it passes and people run from it; herd them out of the doors before the ghost fades | 8 | 8 | 8 | an area under the cursor, as in the owner's favourites; chases with resistance; drag and sweep, last used two boxes back |
| 2 | Possession catapult: grab a thing and fling it at people | 6 | 6 | 6 | aim and release, the rhythm Stand Well Back failed with |
| 3 | Haunted dominoes: one tap a night sets off a chain through the house, the tree adds links | 7 | 6 | 7 | choose and watch; the hands are idle |
| 4 | The pit pianist: frights on the beat of the accompaniment | 7 | 5 | 6 | timing taps, Starter's verb |
| 5 | Hide and pounce: wait inside a thing, jump out when someone passes | 6 | 5 | 6 | wait, then tap: the rhythm that took Guests out of the stack |
| 6 | Ectoplasm trails: draw slime on floors and stairs, people slip and slide | 7 | 6 | 7 | drawing lines across the field is Here Be Rabbits' power, the box right before |
| 7 | Ghost train: the house as a dark ride, trigger frights as the cart passes | 6 | 5 | 6 | timing and waiting |
| 8 | The ouija board: spell words under the sitters' fingers | 7 | 4 | 5 | no physical answer, a word puzzle |
| 9 | Possess a family member and walk them into the others | 7 | 6 | 6 | fiddly; the screen does little |

**One line.** You are the ghost of Hollowmere House: hold a finger on the house and the ghost glides
after it, a cold spot rattles everything it passes and terrifies whoever is in it, and people bolt from
it, along the floors, down the spiral stair and out of the doors. A night ends when the ghost has faded
(its ectoplasm drains while it is out) or dawn comes; each person driven out pays screams and leaves
with less nerve for good. Between nights the screams buy pipes on the organ in the cellar.

**The checklist, answered.**
1. *Second one:* put a finger on the house; the ghost swoops there, the chandelier swings, the clock
   chimes, and Edith shrieks and runs. Chasing squealing silhouettes is fun with nothing bought.
2. *The limit:* the ghost's ectoplasm, which drains while it haunts and does not come back during the
   night (a pale ghost frightens less, so the end of a night winds down rather than stops dead). Night 1
   lasts about 20 seconds; dawn caps a night at about 90.
3. *The challenge on screen:* the family's cards with their nerve, and OUT TONIGHT 0 OF 3 under the
   title. Night 1 gets Harold halfway to the door.
4. *The first buy:* night 1 pays about 15 screams; the organ's centre pipes cost 8 to 15 (more
   ectoplasm, a wider cold spot, louder rattling).
5. *Nodes that change the game* (about one every five minutes): doors that slam (tap a door to shut it
   and steer the stampede, min 4); the chandelier falls (stuns a room, min 8); the telephone rings
   (everyone near goes to answer it, min 12); imps keep rooms you are not in rattling (min 16); the grey
   lady, a second ghost who replays your last sweep (min 22); secret passages (sweep through a wall to come
   out on another floor, min 27); the hearse at the gate, which takes whoever reaches the garden for double
   (min 32).
6. *Minute 40 against minute 1:* three Pembertons in a quiet house at the start; at the end a film crew
   and its extras, a coach party and a ghost-hunting society, forty and more silhouettes stampeding
   through a house that has grown a wing and a tower, doors slamming, imps in every room, two ghosts.
7. *Automation:* imps keep up the fright where you are not, the grey lady repeats your last sweep;
   the herding stays in your hand.

**Nerve, not a gate.** Everyone driven out comes back next evening with less nerve (wear that never
heals, as in the old core); a person with none left does not come back, and a reel ends when its last
member has gone. So every night moves the reel on, there is no all-in-one-night trial, and the goal is
fed by the verb (lesson: the last gate should be the verb, not the bank). The casts grow: the Pembertons
(3), a man of science and his housekeeper with lodgers (6), a medium's seance circle (10), newlyweds with
their wedding party (18), the picture people with a coach party of extras (40).

**Rhythm against Here Be Rabbits** (rule 3): there nothing follows the finger; towers are placed, waves
called and a line drawn across a horde that comes at you. Here the hand never lets go during a night and
pushes people away from it. The crowds of the last reels must stay people (separate silhouettes with
their own panic) and never become a flowing mass, or the last reel will look like the box before.

**Tree.** The organ in the cellar: ranks of pipes rising to a tall centre, in a Gothic case cut out of
black card; about 60 pipes in four themes (the ghost; the house; the fright; the family's fears), opening
from the centre outwards, faint until found. A bought pipe sounds its note; the full organ plays the
box's theme. On a phone the pipes are too narrow to tap: a finger slides along the keyboard under them
and the nearest pipe is chosen and described, then bought with the card's button.

**Look and sound.** As the draft: Reiniger cut-outs, tinted stock by the hour, grain and weave, the
iris, the upright piano in the pit and the projector. New: the cold spot as a ring of frost round a
cream ghost, a frosted trail through the walls, doors that fly open, hats in the air, and OUT! as an
intertitle over whoever leaves.

**Engineering notes.** The core keeps the house as rooms on three floors joined by the spiral stair and
doors; people are agents with a position, a room and a panic that steers them away from the cold spot
towards the nearest way out (a stair, a door, a window later). The finger's position is an action
(`act('ghost', x, y)` while held, `act('lift')`). Bots hold the finger near whoever is closest to a
door and sweep them towards it, with a person's reaction time. Pacing target: eager 32 to 45 min,
casual under 80, no gap over five minutes. Budget: the draft weighs 105.5 KB (the core 21.9); aim to
stay under 120.

**Before building**, the owner confirms this plan and the mock-ups (night and organ, phone and desktop).
(The owner asked for it to be built straight away, to try it rather than judge a plan; it shipped as box 6.)

**As built** (October 2026; what moved away from the plan, and why):
- *Thirty-two pipes, not sixty.* The bots never reached the outer half of a longer organ; with 32 in four
  registers (9, 8, 8, 7) both buy the whole organ near the end. Each register's pipes cost its base times
  1.47 per step out, the first one 18 screams, so night 1 pays for it.
- *Nerve wears down; tricks scale with you.* See the lessons: an exit needs enough fright, every fright wears
  nerve down for good, and the chandelier, the imps and Mrs Mudge's shriek frighten by the player's own power.
- *A house that grows* (a wing, a tower) was cut: the crowds carry the escalation, and the budget is spent on
  the organ. The secret passages went too: the ghost already crosses floors freely, and the lift-and-set-down
  (which costs a little ectoplasm) is the way round.
- *Teaching:* a dashed route (along the floor, down the stair, out of the door) and THE DOOR in the first reel;
  a hand that shows where to hold; NOT FRIGHTENED ENOUGH — CLOSER over someone stopped on the step, and
  CORNERED — COME ROUND THE OTHER SIDE over someone pinned at the far wall.
- *The night's clock is the moon,* going down the sky towards the hills, the sky paling as the dawn comes.
- *The ghost spends a third while its cold touches nobody,* so looking for someone is not punished on the
  first nights (a critic's note: the first night ran out before anything was learnt).
- Pacing (three seeds): eager 34.7–37.7 min, casual 71–78, never more than six and a half minutes without
  something new.
- *Critic rounds on the built box* (first impression, clarity, art direction, phone, feel): 8/4/8/6/6, then
  7/5/8/6/6. What stayed below 8, for the next pass: clarity (crowds on one floor still merge; the cards of
  people gone for good read as dead rather than done), the phone layout (the HUD and the cards are small),
  and feel (the ghost covered whoever it frightened: now smaller on a phone and lifted off the finger).

**The mock-ups, four critic rounds** (October 2026). One frame of a night and one of the organ, at phone and
desktop size, drawn into the draft's own view (its house, people and film), each round scored by a fresh
critic with no stake in it (first impression, clarity, art direction, phone):

| round | night | organ |
| --- | --- | --- |
| 1 | 6 / 4 / 6 / 4 | 7 / 3 / 6 / 3 |
| 2 | 7 / 5 / 6 / 6 | 6 / 4 / 5 / 6 |
| 3 | 7 / 5 / 6 / 6 | 6 / 4 / 6 / 6 |
| 4 | 7 / 5 / 6 / 6 | 6 / 5 / 6 / 6 |

What the rounds settled: a blue night tint and a moon (a sun in the sky had said afternoon), the front
door as a lit open doorway with THE DOOR over it and a printer's hand on the first nights, the ghost as
hard cut paper (no glow) with punched almond eyes, lace holes and a scalloped hem, one HUD row on a phone
and the cast cards in the ground band, a dawn bar under the title; on the organ, the pipe's own crown
outlined when it can be bought, a horizontal price tag under it, the chosen pipe raised and glowing, an
emblem cut into every pipe, four draw-knobs of 48 px (on a phone one register on show, on a desktop four
ranks with gaps), the card as an intertitle with BUY on it, the film's grain and tint over the cellar.

What stayed below 8, and why: every critic said it does not yet look like Reiniger. The mock-ups were
painted over the draft's view, whose furniture is mid-grey and whose rooms are a flat wash, so the
family (thin black figures) gets lost among the furniture; a contrast filter on the backdrop was not
enough. The view has to be redrawn rather than overlaid: flat tinted paper per room lit from its middle,
every piece of furniture solid black with fretwork cut into it pushed one plane back (smaller, behind a
haze), people the only solid black in front, larger and with a pale rim while frightened. The rest of
the last critic's list, for the build: one scream plaque at a time, above the screamer and off the
ghost, about 30% smaller on a phone; ectoplasm and dawn as two different shapes (a vial, a moon that sets
along an arc) with units; three clearly different pipe states (cream bought, black with a cream outline
buyable, nearly invisible locked) and a bold thread from the parent pipe's foot; one emblem per skill
everywhere; no rosettes over the pipes and flat pipe feet; price tags and glyphs at 14 px or more on a
phone; nerve bars of 6 px or more; the desktop HUD next to the title.

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
  are small there (a tap near a jar now reaches it, which helps but does not solve it); bulges that push the house out of shape rather than sitting on it like stickers; a
  phone layout composed for 390 px in every act; teach with the world rather than with words
  (an early tap could bake a flat loaf instead of refusing).
  **The cellar's end is played, not waited for** (October 2026, `CORE.version` 2). The owner found the
  last stretch to the Last Loaf's $10M a grind that turned the box into an idle game: by then every card
  was bought, income compounded slowly, the jars and the bench were worth nothing next to a punch, and
  the rolling pins did the punching. Now Mother *proves*: every punch knocks her back and makes her
  stronger (a ripe one counts double), a perfect tap or a clean score counts a little, a rolling pin's
  punch a tenth; money counts not at all. The Last Loaf opens when she has fully risen (and costs $1M).
  As she rises she lifts the house off its street (the neighbours and the street sink, she squeezes
  out round its foot), she heaves more often the closer she gets, and at a quarter, a half and three
  quarters she heaves through all twelve places at once and writes HIGHER, ALL OF IT and NEARLY on
  the wall. The recipe card says how far she has risen. A player who punches at half the bots' pace
  now finishes the cellar in about 19 minutes instead of 27, and one who leaves her to the pins
  barely moves. `migrate` turns a version 1 save's earnings into how far she has risen.
  **Graphics round 1** (October 2026), every prop shot close up on a desktop (`K.debug.look(cx, cy, s)`) and
  every act on both sizes. Glitches fixed: the starburst clock's ink was set inside a comment, so its rays
  took whatever stroke came before; the box's stencil face was never fetched (only the canvas used it), so
  the box said CONTENTS MAY VARY in Times; OPEN IT stood half off the top of a desktop and the number ran
  over the box's edge; the big loaf's crust was cratered with crumb holes like a moon; the cellar dough's top
  was a polyline with corners; the oven's bricks were square outlines like windows; a grey halftone sheet
  hid the cupboards behind the bench; the timer's bell floated above it and stood still while it rang. Detail
  added, lit from the upper left as the rest: an oven in running bond with an arch of bricks on end, embers
  and a flue; a crust with blisters, speckles, cracks and flour, and a crumb whose holes are shaded inside;
  cupboard doors with raised panels; a fridge with enamel shine, hinges, a gasket and a grille; a clock with
  balls on its rays and hours on its dial; glass jars with a thick foot and light through the far edge; tiled
  roofs, brick chimneys and shutters on the neighbours. World paths go through `mv/ln/qc/bz`, which paid for
  most of it: 118.6 KB before, 122.8 KB after.
  **The refinement session** (October 2026, rule 16). The owner asked for Starter to be taken to the bar
  of a finished commercial game, with research rounds between the critic rounds instead of more critics.
  Four critics with no stake in it scored phone and desktop filmstrips played with real input (first
  impression, clarity, art direction, phone, feel, and "would pass as a commercial game"): before the
  session 5/5/6/4/5 and 3, then 6/5/6.5/4/5.5 and 3.5, 6/5/7/5/5 and 4, 6/5/7/4.5/5 and 4, and
  5/5/6/4/5 and 3. The last, the strictest of the five, scored below the one before it on frames that
  only gained; that spread between critics is the reason for the lesson *Stills plateau*. What the research rounds found and what it changed:
  - *What gives AI-made art away* (artists' checklists, October 2026): perfect symmetry and even spacing,
    repeated motifs copied exactly, a style that shifts within one picture, background that competes with
    the subject. So the kitchen got things that live in it, placed unevenly: canisters (FLOUR, SUGAR,
    TEA), a crock of wooden spoons, a tea towel over the shelf, a pendant lamp with its cone of light, a
    chequered lino floor in perspective; and the places where later jars will stand hold a geranium,
    cookbooks, a cake tin and mixing bowls until a jar takes them, so the kitchen fills up as the player
    buys rather than starting as a bare stage.
  - *What makes an incremental's shop feel finished* (clicker UI guides, players' requests on itch.io):
    affordability visible at a glance, never only in a tooltip, and how near the next purchase is. The
    recipe cards became index cards standing in a red enamel tin, each with a picture drawn by the box's
    own print helpers (`ICON`, painted into a canvas per card at its size), a pencil line along the foot
    that fills towards the price, a red ring round a price that can be paid, a rubber stamp (TRIED) on
    a purchase, the cards not dealt yet face down below the dealt ones on a desktop, and a plate on the
    tin. On a phone the tin is a rail of cards at the thumb, 152 px high, so the kitchen gets the rest of
    the screen; the sealed recipe (the goal) leads the rail as an envelope with a wax seal.
  - *Juice without clutter* (game-feel guides): one channel per event, matched to its weight. Sums and
    verdicts are printed on paper slips, kept whole on screen, step aside for a newer one, and at most
    two are up at once; a loaf for the bench says nothing (the loaf is the news); a perfect tap no longer
    sends straight yellow rays, which every critic called clip art; a ready jar gives off three curls of
    aroma, the cookbook's way of saying "ready", and its lid lifts less. A phone buzzes on a perfect tap,
    a clean score and a punch (`navigator.vibrate`, off with `K.reduced`).
  - *Samples instead of synthesis* (the music is the box's weakest part that no still shows): sampled
    vibraphone and upright bass would beat any oscillator, but the sets found carry CC BY 3.0
    (FluidR3_GM, needs a credit) or an unclear origin (`soundfont-for-samplers`), and the CDN was out of
    reach from the session, so nothing could be tested. It stays synthesised and the decision is the
    owner's. What changed: the radio's combo now plays through a warm top cut and a small hall (a
    generated impulse), the vibes through a motor tremolo, each bar struck with its fourth and tenth
    partials and a mallet click, the bass plucked with a falling filter.
  The rest, from the critics: on an upright phone the jars stand in two columns on the counter and two
  shelves (a little smaller there, so three rows fit under the ceiling), with the clock and the timer
  between the columns; the cellar act keeps the kitchen and the cellar in frame on every screen, and
  Mother comes through twelve places that are all inside it (the floor, the fridge, the window, the
  oven's bricks, the ceiling, the room upstairs), so jars and bulges are half as large again on a phone
  and a third on a desktop; a hole she leaves is full of dough behind splintered edges, not a black blob;
  the dashed scoring line is red on a cream backing and thicker; the sky is one ink with a halftone that
  thins towards the horizon and keyed, flat-bottomed clouds; the sun is a starburst in two inks; the
  house goes golden as it bakes and steam rises off her; the cut springs open into a dark-lipped ear;
  the crumb is irregular alveoli of every size, stretched upward; the box is a bakery box printed in
  tomato with a scalloped label and red-and-white string. The shell's hidden sticker toast no longer
  shows its shadow along the top of every box.
  Still open, from the last critic (the band now carries a PEAK tab, so it is not taken for the lid's
  seal): Mother's bulges still lie over the props they come through rather than behind them, and want torn
  plaster round them; the crumb could be paler, with depth on the cut faces; scored loaves on the bench
  read as a zigzag until they bake; every jar is the same jar (vary Kilner, mason, crock, squat); the
  phone bench crops its outer loaves; the baker's ring over a loaf reads as a debug marker; the dough
  lettering of the ending (SCORE ME, SLICE ME, OPEN IT) reads to some critics as WordArt, though it is
  Mother writing; the print could go further (line weights that vary, a coarser halftone). The music has
  not been heard by anyone since its rework; the owner's own play on a device is the next judge.
  **The second pass** (the owner's look, October 2026) fixed what they saw and what a close-up critic then found
  with the checklist under **Drawing without glitches**: lids that floated over their jars at the peak, aroma
  that rose into the jar above, cabinets you could see the wall through (now a carcass, a reveal and a kick),
  a towel that seemed to hang inside a jar (it now hangs over the counter's edge), a calendar held by nothing
  (a magnet, and dates instead of dashes), a fridge without feet, wallpaper that stopped at the house's edge, two
  posts at each end of the bed, a bowl's foot in front of the bowl it sat in, a fire without flames. Still open
  from that review: halftone that stops in a hard edge on many props (the print convention allows it, the critic
  did not), the radio and the roof without detail, the cake tin's seam, the bench's scoring guide read as a red
  zigzag sticker on the dough, Mother's cellar floor cutting through her bubbles.
  **The third pass** closed those: `turn()` grades a prop's halftone across its own outline, the radio has a
  handle, speaker cloth, a numbered dial and knobs, the roof an eave board and the chimney flashing, the cut line is
  a cookbook diagram (dashed ink, a dot where the blade goes in, an arrowhead), Mother sits on flagstones, the crumb
  is pale with fewer, longer holes and an oven-spring line under the crust, the loaf is a quarter larger, the jars
  stay on the shelves while the house bakes, and the sealed recipe says from the start what opens it. A fifth critic
  scored 7/5/7/5/5 and 4. Still open from it: on a phone the oven sits off the right edge in the bakery act; the
  bulges want Mother's own glossy dough and plaster cracking from them; the phone rail could snap whole cards; the
  dough lettering of the ending still reads to critics as off-style.
  **The fourth pass** closed the first three: on an upright phone the oven moves in beside the counter (`OVEN`) and
  the loaves move right with it (`LOAF`), so the bakery act shows where they go; the bulges are glossy stretched
  dough with bubbles, shade that turns and a long highlight, cracks that run out from the rim, fork and thin, and
  flakes of plaster lifted round the hole, and two of them no longer come through behind the bench; on a phone the
  cards snap whole into the tin, whose rolled edge stands at the right with a › to turn on. The dough lettering stays
  until the owner decides: it is Mother writing, not a typeface.
  A sixth critic scored 6/5/6.5/4.5/5 and 4, on frames taken before the bulges were moved inside a phone's frame
  (twelve places, all on screen at once in the great heaves). Its other notes, for the next pass: the "what an ear!"
  slips still stack over the jar labels when a fast hand scores loaf after loaf; the coins from a punch are flat yellow
  dots; the ending's loaf sits on the roof like a hat rather than lifting it; the desktop cellar has bare margins
  beside the house. Done since: one slip at a time (a new verdict sends the last away at once); coins struck with a
  milled edge, a rim, a star and a glint; past the house's walls Mother spills over the eaves and hangs down the
  outside in lobes that stretch as she rises. Then: no two neighbouring jars alike (a mason jar with a screw band, a
  tall apothecary jar with a cork, a squat jar under a gingham cloth tied with string, as a baker covers a starter;
  the shapes are the view's, the rules never see them), the aroma drawn as printed steam (a cream ribbon with an ink
  edge), and the neighbours moved in so the desktop cellar has no bare margins. Ready for the owner's playtest.
  **The owner's playtest** (October 2026): the box "looks much more mature"; the bulges were too large and are 10%
  smaller (`BR`: 180 on a wide screen, 194 on a phone).
- **Unwelcome Guests** (box 6, remade; the notes below are the old draft's, kept where they still apply): a graphics pass for glitches at phone size first; then more of Reiniger in the puppets (finer filigree, lace that reads at phone size),
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
- ~~**Scriptorium**~~ (its look went into Here Be Rabbits) — illuminate a manuscript letter by letter; monks and gold leaf as upgrades.
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
- **Sky Trawler** — harpoon drifting jellyfish from a skyship's turret; they pop into resources, a sky whale
  per zone. Ghibli-style painterly 3D. Runner-up for box 4: lovely, but leading a moving target is fiddly
  on a phone.
- **Pumpkin Patch** — the farming half of the owner's box-4 request: grow a giant pumpkin for the fair and
  keep crows and moles off it with a slingshot at night. Claymation. Wait until a box or two after Keep Off
  the Grass.
- **Cockpit** — a mining laser swept across asteroids that crack into ore of rarer tiers, from a 1970s
  paperback-cover cockpit (Chris Foss). Too close to Tilt's Big One for box 4.
- **Tin Gallery** — a fairground shooting gallery in 3D, tin ducks on rails, cork guns, a fair that grows
  into a carnival. Painted tin and a band organ. Not right after a pachinko parlour.

- **Kaiju on the Tōkaidō** — a horde survivor turned round: you are huge from the first second, a
  woodblock monster in Edo Bay, and the shogun's armies are the horde; swipe for the tail, tap to stamp,
  hold and drag for the fire breath, a run as long as your rage. The world is a handscroll that unrolls
  along Hiroshige's 53 stations to Mount Fuji. Ukiyo-e, Prussian blue and vermilion; taiko and shamisen.
  Pitched for box 5 as the biggest surprise.
- **The Colony** — you are the horde: paint scent trails with a finger and five hundred, then a million
  ants follow them through a garden fifty screens wide under a fog, carrying crumbs, then a car. Copper
  engravings after Maria Sibylla Merian; baroque chamber music. Pitched for box 5; closest to
  Physarum.
- **General Staff** — a war simulation on the nursery floor: two thousand green and two thousand tan
  plastic soldiers, a flag you drag for the charge, the cat as an air strike, the vacuum cleaner as the
  enemy's superweapon; carpet, house, garden, street. 1970s Airfix box-art painting and a map table with
  pins. Pitched for box 5; two sides throwing at each other, so not right after Snow Day.
- **Kraken Brood** — a standing survivor with a light for a weapon: at night thousands of small squid
  crawl out of the sea, and you hold and sweep a lighthouse beam (the hover verb of Keep on Mining) to
  drive them back; a Fresnel lens that turns by itself, the foghorn as a shockwave, a lighthouse per
  island along a whole coast, the kraken mother last. Woodcut, as in The Keeper. Pitched for box 5.

- **Bayeux** — the same kind of horde stitched into an embroidered strip that unrolls sideways, wool on
  linen. Weighed for box 5; textile right after Snow Day's felt.
- **Stained Glass** — a horde of light poured into a cathedral window, the lead lines as walls, panes to
  tint and shatter. Weighed for box 5; a window cannot grow, so the map could not.
- **The Warren** — the same manuscript turned round: you are the rabbits, finding a way past the monks to
  the castle. Weighed for box 5; it loses the defending verb.

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
  - Since: the medal is a rosette (pleats and two tails, in CSS), and the cup final lies along an upright phone
    (the camera turns a quarter round there) with the whole stadium in view.
  - Next, most valuable first, from the last critique: clarity (7) and phone (7) are still under
    8 - the judges' sheet covers the show tent on a phone, and "6% short" beside "81% stripes" reads
    like a bug to a stranger; the stadium's crowd reads as confetti. The critic also asked why
    midnight turns to amber daylight; that is dawn breaking as the box folds, and stays. Then a
    frame-time reading on a real phone, above all in the stadium (`K.debug.blades()`), and the mower's
    sound once the owner has heard it.

  **The refinement session** (October 2026, rule 16), first round. Before anything else the box got the tools
  Starter's session had: `K.debug.look(x, y, d, { pitch, yaw, setup })` holds the 3D camera anywhere (on a point,
  or on something that moves: `mower`, `robot`, `pest`, `judges`, `box`; a setup lets an intruder in, stops the
  judges on the lawn or folds the field), `K.debug.props` lists 33 things worth a close look, and
  `util/cmv_props.mjs` saves `K.debug.snap()` for a WebGL box, the canvas itself, instead of a page screenshot.
  Its minutes come from the eager bot as the page runs it (seed 1, after round 2: Elm Street 6.75, the Village
  Show 17.25, the County 22.25, the National 25.75, the Cup Final 30.75, midnight 34); they move whenever the
  pacing does. `revisit(S)` takes a finished game
  back to the Cup Final with every show won, the rest of the pegboard for sale and the note in the cup there
  again (a test in the box's suite). What the research found and what it changed:
  - *How the paid games do it.* PowerWash Simulator counts a part as clean at 95 to 98% and then cleans the
    last specks itself, with a flash and a ding: a finished lawn here now takes its last tufts with it and
    glints. Miniature photography and the voxel games read as models because of a shallow focus, soft
    contact shadow and saturated paint: the frame is now drawn into a texture and shown through one more
    shader (`develop`: sharp in a band round the mower or the middle, soft above and below; ambient occlusion
    from the depth of the solids alone, compared in pairs so a slanted ground does not shade itself; colour
    ×1.12; a vignette), with the canvas's antialiasing kept by a multisampled framebuffer. A device that had
    to lose blades twice loses the contact shade too.
  - *What gives AI-made work away* (players' threads, studios' notes, October 2026): generic interface
    defaults, identical cards with line icons, props that are primitives. Every blister pack now holds the
    upgrade itself, built from the world's own boxes and lit by its sun (`MODEL`, rendered once into a canvas
    per card); the close-ups found a hedge that was a row of tiles, a tree with two level stubs for boughs,
    ornaments on bare squares of soil, flowers that were coloured sticks, a car of two boxes, bunting of
    cubes, a flat green beyond the show ground, benches of two planks, people without faces. Now hedges are
    one mass with clumps, boughs climb into the crown, ornaments stand in the lawn's earth, flowers have a
    stem, a leaf and a head, the car a glasshouse, pillars, lamps and bumpers, bunting is a cord with
    pennants, the show ground sits in a patchwork of fields, benches have slats and frames, everyone has eyes.
  - *Resources.* jsDelivr is reachable from the session now (it was not for Starter), so samples could be
    tested; the Versilian Community Sample Library (VCSL, CC0, github.com/sgossner/VCSL) is the candidate for
    the keyboard demo song, the brass and the music box, untried. Kenney's kits (CC0) are low-poly, not voxel,
    and were not used.
  - *The shows, the owner's call.* Both bots won gold at nearly every show's first judging and then called
    the judges 13 to 17 times more for the next entry fee. The owner chose "every visit wants something else":
    the head judge asks for stripes towards the judges' table first, along it second, then any of four
    (those two, each finished with a lap round the edge) but the last one. The wish is named by the table so
    it holds however the camera stands; the sheet shows it as a little lawn with the table on it, turned with
    the camera, and an Edge bar for an edged wish; the judge says what was asked if it was missed, and what
    they want next time as they leave. The ring round an edged lawn is as wide as a lap leaves it. On a show
    lawn the mower lays short grass its own way, as a striping roller does, so a lawn mown the wrong way can
    be put right. Gold came easier, so the prize per judging went from 2.5 to 1.8 to keep the eager bot over
    thirty minutes; the visits per show went up to 18 to 24 for both bots, each now asking something
    different. If that still reads as too many, the next lever is a bigger lawn per visit, not a longer wait.
  - *Fixed on the way.* The judges' walk ran on game time while their cards, rosette and comments came by
    `setTimeout`, and the field's flaps were built 2.6 s after the reveal by the clock while they began to fold
    at 2.8 s of game time: on a slow device or under express post they drifted apart, and paused they did not
    wait. Everything sequenced now goes through `later(sec, fn)`, drained by `dt`. The sheet's first bar says
    Mown, not Short, and shows no stripes until there is enough lawn mown to judge. On an upright phone every
    show lawn lies along the screen (the camera turns a quarter, as it did for the Cup Final), so the lawn
    fills the height instead of leaving its lower third as meadow; the judges are drawn larger.
  The box now weighs 155 KB; its cap is 200 KB (rule 2).
  **Round 2.** A fresh critic scored filmstrips of the box as it was before the session (phone first, real
  pointer input, every place): 6/5/6/5/5 and 3 for "would pass as a commercial game". What it found that round 1
  had not fixed, and what changed: the mower drove over the show's rope (the rope is now cells the rules keep it
  out of, two cells round the lawn, with a gate toward the way in and one toward the judges' table, and the bots
  turn closer, .8 of a cell past the lawn); the gang mower's reels were flat slabs (now a reel of blades under a
  hood, side plates and a land roller) and the ride-on's deck stood out like wings (a housing with a skirt and a
  chute); every tier of an upgrade said the same sentence (every card with levels now says what the next one
  does: "clippings ×2.3 → ×3.4", "holds 50 → 91 litres"); the three shows looked alike (the Village Show has a
  church behind its tent, the County a grandstand with flags, the National a manor with a portico and topiary);
  the show ground's rough was as tall as the lawn on show and the two could not be told apart (it is kept shorter);
  "Gold won here. On to the next show." read as a dead end (now "Gold won. Prizes still pay; the next show is on
  the pegboard."); the desktop pegboard stood half empty (it shows everything that can be bought ahead, greyed);
  the phone strip faded its last card into the lawn behind (an arrow tab now); intruders were small and could be
  off screen (larger, and a badge at the screen's edge points to one out of view); the moon stayed in the dawn sky
  (a rule for `.night` came later in the sheet than the one for `.dawn`); the haze over the far edge washed the
  roofs out (halved, as the lens blurs that band now); the lamp post had no foot, the postbox no plinth, the string
  at midnight read as a debug wireframe (a thin cord on wooden pegs). The sticker for seeing off intruders asks for
  sixty, since the longer shows brought the casual bot to forty. The prize per judging is 1.7.
  The fold, filmed at a quarter speed so each frame of the software renderer is about 60 ms of game time and cut
  into its distinct frames with `ffmpeg -vf mpdecimate`, rises flap by flap with no jump, and the camera's
  distance and pitch ease without a step. The dive into box 3 shows as a cut in that film: the shell's dive is a
  Web Animation of the frame, and while box 3 mounts the software renderer draws nothing; on a device it runs on
  the compositor, but nobody has seen it there yet.
  The sound was measured, not changed (MediaRecorder on the box's two buses, `ffmpeg -af volumedetect`): effects
  average −28 to −29 dB with peaks at −13 to −15, nothing clips; the music averages −42 to −44 dB with peaks at −12
  to −22, some 13 dB under the engine, which on a phone's speaker is close to silent. That balance is the owner's
  call, with the mower's sound.
  **Round 3.** A second fresh critic scored filmstrips of the box after rounds 1 and 2, phone only: 7/5/6/5/5 and 3
  (first impression up one; the rest held). Its sharpest point was one round 1 had made: a lawn striped the wrong way
  scored "stripes 0.0" with nothing to say why, which reads as a bug. Now the stripes card says "wrong way" or "no
  edge lap" in red when that is the reason, and every new wish is chalked on the lawn for a few seconds (double
  arrows the way the stripes should run, a dashed lemon ring for a lap). The rosette comes up at the judges' table,
  not over the lawn being judged, and the score cards float higher, over the judges' heads. Prices are rounded as a
  shop prints them (cents under $10, whole dollars under $100, then three figures), and every tier after the first
  has a line of its own ("Whetted on the back step with Dad's stone.", "It has its own postcode."), with the numbers
  under it. "Open it." waits until the last flap is up, the dashboard says dawn once it is, the hollows the flaps
  leave are soil and stubble, the rope's gates have posts, and the desktop pegboard leaves the shell's box chip room.
  Also from it, not yet done: the stadium reads as rings of seat texture (raked stands, a roof and pylons would help);
  the light jumps from moonlight to dawn as the box folds (the owner's call, kept); the push mower can run into the
  road on Elm Street; the robots read as tiles at play size.
  Found on the way: three times a line comment written into the middle of a line swallowed the code after it, once
  shipping the ride-on mower without its body. The box's suite now refuses a line comment in the view that holds a
  call.

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
  Since: what the Big One pays shows as one sum over its sign rather than a heap across its face, the star's four
  quarters burn in four colours (balls cyan, pins and reels gold, damage pink, fever orange), the game-over card
  fades in by game time rather than by frames, and OPEN IT stands under the box on a desktop.

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
| We Need More Humans! | fly a UFO round the world and abduct people | abduct everyone on Earth; the humans evolve as you go; isometric 2.5D, an absurd premise played as a cosy idler |
| Crack the Pack | open booster packs | cards in seven rarities; sell duplicates; a magnet, workers and a fusion lab for automation |
| Fortune Mill | darts, scratch-offs, dice, pachinko, sushi, one room each | earn 1,000,000 to escape; every room boosts all the others; full automation; 120+ upgrades |
| Keep on Mining! | hover the cursor over rocks and the pickaxes go to work | ores become bars for a permanent skill tree; talent cards on level-up; an idle mine; reviewers love the feel and the huge tree, dislike a weak late game and an abrupt ending |
| Chop Chains | hover over trees to chop them | wood buys a deep skill tree and prestige; complaints: trials that block progress, grind plateaus |
| Timber Rush | chop one big tree; every swing showers logs, gold and power-ups | an incremental roguelite of short runs; a massive skill tree of automation, special logs (lightning, freeze time, magnet the screen) and synergies |
| Sip Fisher | drain a lake through a straw and sell the fish | an absurd premise played straight; gear upgrades; very positive reviews, an IGF student nomination |
| Berry Bury Berry | first person: grow berries and drop them into a hole for money | Berry Buddies grow higher tiers; puzzles, cassette tapes and a creeping horror; several endings |
| How to Fish | physics fishing after a drunken boat crash on an island: catch, kill and sell fish, with trick shots | gear and weapons from nothing, quests, bosses that open new islands, rare variants of every fish, gambling with fish; cartoon violence, very positive reviews |
| Project P.I.T.T. | build a chaotic physics production line of rubber ducks and feed them to a bottomless pit | combos for dumping many at once; corporate targets; scripted events that break your machines |
| Sir, We Have an Orc Problem | place a few turrets, turn their firing arcs, fire a nuke or a strafing run where a front is breaking | 400 to 160,000 orcs flowing like a liquid; every run pays, won or lost; turrets stay where they were put; named by the owner as the feel a box still lacks (big and escalating from the start); its reviews complain about farming the same maps and stat-only nodes |

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
- **Running away is not leaving.** The remade Unwelcome Guests first let anyone who fled from the cold out of the
  door, however calm; nerve then meant nothing, and a cast of thirty went out in one night. Now only someone
  frightened past a share of their nerve (or in a panic) goes through a door; a calm one stops on the step and
  says so. Herding wants resistance at the gate, not only on the way.
- **Scale a trick by your power, not by its target.** The chandelier and the imps first frightened people by a
  share of their own nerve, so every cast fell to them alike and the late reels took a minute each. Frights
  that grow with the player's fear upgrades keep a bigger cast bigger.
- **Wear turns a wall into a slope.** A casual bot spent twenty minutes on the medium's circle with no one going
  out and almost no screams. Every fright now wears a person's nerve down for good (to a third, at most), so a
  hard cast gives way night after night even to a weak hand, and the economy never starves.
- **The last gate should be the verb, not the bank.** Starter's cellar ended at $10M; once the cards were
  bought, that was minutes of waiting for compounding income while the hands did nothing that mattered.
  A goal fed by the verb itself (Mother proves with each punch) moves with every action, keeps a slow
  player and a quick one close, and leaves nothing to idle for. Measure it: list each box's novelties
  (a first purchase, a new stage) and look at the longest gap before the end; Starter's cellar had eight
  minutes and more of it with nothing new.
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
- **A prize that drags the game out is a punishment, and one that floods it breaks it.** One ball back from
  a tulip made a catch feel like a delay; five balls back made the tray triple in seconds. Pay the reward in
  the currency that does not feed the run (coins), and keep the run's fuel bounded (the ball goes back up
  once, not into the tray). Check every reward against both the time it costs and the balance it shifts.
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
- **The owner plays on a desktop.** Rule 11 puts the phone first, and every critic round looked at phone
  frames first, but the owner's own playtests are on a desktop with a mouse: most of their notes on Tilt
  (the buy button far from the bulb, coins in a far corner, hover, the wheel, the camera) were desktop
  notes. Film and polish the desktop as carefully as the phone, at a large monitor size too.
- **The end of a run is a moment, not a caption.** A small "tray empty" note was easy to miss. The game
  over card is large, counts its coins up, says how this game compares with the last one (▲ +23% or
  ▼ −12%), marks a best game, and tells what the tulips gave back.
- **Hit points do not scale like damage, and the player sees the bar.** Tilt's damage grows by multipliers,
  so the Big One's count had to be huge to last, and then most games barely scratched it. A goal that
  takes many sessions has to move visibly in each one: feed it a damped damage (the square root), keep its
  count close to what a game deals, and tune the counts with a script that measures how much damage the
  eager bot deals in the minutes a board should last (`autobig` in the session's scratchpad did this).
- **Leave a ball's width round a dome too.** Closed tulips first wedged balls against their own posts, then
  against a pin or a boulder next to them; a closed tulip now ignores its posts, its grid cells cover its
  dome, the pin field keeps clear of it, extra tulips look for a free spot, and the suite drops balls over
  every closed tulip on every board and wants them gone in a second and a half.
- **A page that saves on its way out writes over what was just put in storage.** Loading a pasted save code and
  "Throw everything away" both reloaded the page, and the shell's own `pagehide` save put the old game straight
  back: neither had ever worked while a box was open. The shell now sets `leaving` before it replaces itself on
  purpose, and nothing writes after that. A test that hands the page a save has to do the same, from an empty page
  of the same origin.
- **`start(saved)` has to rebuild what the events built.** A view that only reacts to events forgets, after a reload,
  everything an event did once: Starter's recipe box stayed out over the Last Loaf, Tilt loaded with a thumb still
  pouring, a crop circle saying "Open it." crashed because it was placed before the camera existed, and an opened
  box whose trip never happened was stuck in Tilt. The browser suite now saves every box early, in the middle and
  seconds before its end, reloads, and wants it back as it was; and every box must go on by itself from "opened".
- **A search needs a bound past the largest case.** Keep Off the Grass fits each place to the screen by bisection
  up to a distance of 300; the cup final on an upright phone needs about 400, so it never fitted and sat cut off and
  off-centre. Beyond the sun's shadow map, everything read as shadow, a dark wedge in the corner once the camera
  stood back that far.
- **An upright phone is narrow, so the yard is narrow.** A 3D scene fitted to a portrait screen's width
  shows its targets at a third of the size it shows them on a desktop. Snow Day narrowed the rules' yard
  (7 wide, 15 deep), stood the phone's camera on top of the fort looking down so depth fills the height, and
  drew the puppets half as large again; kids went from 20 px to about 60.
- **Events left in a saved state come back.** The state saved in the front room still held the run's
  'end' event, so a reload drew the run's end card over the tree. A view clears `S.ev` when it starts.
- **Delay by game time, not by the clock.** A card timed with `setTimeout` came up before the last kid
  had crossed in a slow renderer, where the game runs at a few frames a second; waiting for the walkers in
  game time keeps the order whatever the frame rate.
- **A number that subtracts reads as your loss.** "−50,277" over a kid looked like a penalty. The damage
  now shows on the kid's bar (a white chunk that drains away), and only coins get numbers.
- **A puppet drawn larger than life has to crouch deeper.** Snow Day draws its kids half as large again on a
  phone, and a crouch that sank them a fixed .42 left heads and bobbles above a metre of cover while the rules
  counted them as hidden; the owner saw snowballs pass through kids in plain sight. A crouch now sinks the whole
  kid below the cover's top at any scale, the low covers (a snowman's mound, a bench, a drift) are a metre tall,
  and a kid ducks in a fraction of a second.
- **A face goes under the hat, not in it.** The kids' eyes sat at the height of the hat's brim, so they peered
  out of the knit. Features in the lower half of the head, a hat that starts above them.
- **Measure a shader change in the slow renderer too.** Snow Day's cotton-wool snow (three noise lookups
  bending the normal) doubled a desktop frame in SwiftShader, 0.75 s to 1.3 s, and halved the frames a capture
  script could take. A real GPU does not notice, but captures need longer runs after such a change.
- **A flow field is liquid only if the crowd spreads sideways.** A count per cell with a capacity made
  single-file columns down the shortest line; a second pass that moves a sixth of the difference to any
  neighbour no further from the goal turned them into a flood that fills its lane and spills over the text.
- **Compare floats of one width in Dijkstra.** Distances stored in a `Float32Array` and compared with the
  popped float64 key skipped every cell whose rounding went down: half the page was unreachable.
- **An obstacle that reroutes the horde defeats the towers aimed at it.** Blocking snails sent the whole
  stream down another margin, away from every monk's fan. Find the way without the obstacles and let them
  only slow the crowd; and clamp slowdowns that overlap (min, not product), or a crowd waits at 1% speed
  and a run lasts eight minutes.
- **The kit's `hash` is slow inside the suite's `vm`.** It is fine on a page, but it reads `Math.imul`
  through the context's interceptor on every call; a core that dithers every cell every tick spent 80% of
  its time there. A local hash with `imul` destructured made the pacing suite five times faster.
- **A dense crowd of outlined sprites turns to brown noise.** Ten thousand rabbits with dark outlines read
  as grey lint to every critic. Sepia outlines, cream coats, a fur carpet under dense cells with three
  runners on top, and one rabbit in each crowd drawn half as large again made the mass read as rabbits.
- **A mechanic from the box before does not travel by itself.** Tilt's Big One keeps its damage between
  games, and in pachinko that is the fun; carried into a tower defence it meant a lost run moved you on,
  which the owner read as a borrowed part that did not fit. Ask what losing means in the genre at hand.
- **Fixed build spots read as arbitrary.** Gold roundels put where the code liked them looked scattered,
  and left fronts with nowhere to stand. Let a tower stand on any legal ground, show legal and illegal as
  it is dragged, and mark the best spot instead of the only ones.
- **Paint terrain as shapes, not cells.** A circle per 4-unit cell turned meadow edges into clouds, a road
  into beads and a pond into bubble wrap. Draw the map's own discs and polylines smoothly and use the cells
  only for what grows on them; and check a union of discs for bare pockets with a script.
- **A count per cell is not a crowd.** Drawing the rules' counts cell by cell made rabbits blink and
  hop, because the rules move a rabbit by chance and spread a jam sideways. Keep the view's own walkers
  on the same field and correct them in blocks, moving a surplus to a shortfall before fading anything;
  measure the fades per second with a debug counter.
- **For a hand, start from a drawn hand.** Three manicules drawn from primitives (lobes, rounded boxes,
  then curves) all failed the owner's eye. The one that passed takes the outline and creases of the
  backhand pointing finger from Microsoft's Fluent Emoji (MIT, as Hands Up and Tells already do) and
  only colours, inks and cuffs it. Anatomy is the one thing not to improvise. Jesse's face went the same
  way: a pink disc with a smile was not a face; Fluent's "old man" with shut lids and a beard is.
- **Look at every sprite on its own, large.** Faults hide at play size and in motion: a hand that is not
  a hand, a stick rabbit for a king, a counterweight tilting with its arm. Dump all sprites into one
  gallery (a debug call returning data URLs) and shoot each scene close up before calling art done.
- **Weigh the box while building it, not after.** Here Be Rabbits reached 157 KB before anyone measured;
  getting under 130 cost the rabbit knights and the bell tower. Give each part a budget before writing it.
- **Prove a refactor with frozen frames.** To shrink a box without changing it, freeze the box's clock: an
  init script in Playwright replaces `performance.now`, `requestAnimationFrame` and `Math.random` inside the
  box's iframe, so `?world=<id>&at=<min>&seed=1` plus a fixed number of frames draws the same picture every
  time. Shoot every scene and the sprite gallery before, again after each change, and compare the canvases
  pixel for pixel. It caught two helpers that overwrote their own definitions and a local `st` shadowing a new
  one, which a glance at the screen would have missed. A comparison must count missing images as failures: a
  crashed box simply has fewer canvases. And compare the colour channels, not only alpha: PIL's `getbbox()` on an RGBA
  difference looks at alpha alone, so every opaque change passes unseen. Page screenshots also catch DOM captions
  whose CSS transitions run on the real clock; judge the canvases.
- **Draw objects, not shapes.** Starter's second polish pass (October 2026) redrew a geranium with stems,
  scalloped leaves and flower heads; nested bowls; spoons in a crock; a towel over a shelf; a pencil with facets,
  ferrule and eraser; gingham curtains with folds, a valance and bows; a bed with turned posts and a patchwork
  quilt; a nightstand and lamp; plain curtains and a milk bottle of flowers upstairs. Each took a few lines more
  than the primitive it replaced, and each was a fault the owner had seen. See **Drawing without glitches**.
- **Filmstrips find what still frames hide**: a hand pointing at the wrong thing, a man waiting
  on-screen before his cue, a crash that only happens after a run ends.
- **An upright phone wants its own layout, not a smaller one.** Starter's kitchen is a wide stage; fitted
  to a phone's width it left jars at a third of their size under half a screen of bare wallpaper. Two
  columns of jars on three shelves, a camera that stays on the kitchen and the cellar in the last act,
  and the shop as a rail at the thumb gave the scene twice the room. Positions that only the view uses
  (where a jar stands, where Mother breaks through) can differ by screen; the rules never see them.
- **Let what a purchase replaces fill the stage until then.** An empty shelf waiting for jars reads as
  unfinished. Props that stand where the next jars will go (a geranium, cookbooks, a cake tin) make the
  first screen a lived-in kitchen and turn each new jar into a visible change.
- **Draw the shop's pictures with the world's own pen.** Card icons painted by the same print helpers as
  the scene (key line, plates off register, halftone) match it at no cost in assets; a borrowed icon set
  would have looked pasted on.
- **Stills plateau.** Four critics scoring filmstrips moved Starter's "commercial" score from 3 to 4 while
  the kitchen's art direction reached 7; every round also re-found the popups that only pile up because
  the capture script taps ten times faster than a person. Past that point a person playing it on a device
  is the only judge left; treat further still-frame rounds as a check for regressions.
- **Headless frames do not finish CSS transitions over a busy WebGL canvas.** The moon at dawn stayed bright in
  every film of Keep Off the Grass, before and after its rule was fixed: with `transition: none` the computed opacity
  was 0, with the 2 s transition it never left 1 while the software renderer was drawing. Check a CSS state with
  `getComputedStyle` and the transition switched off before calling it a bug.
- **Never write a line comment into the middle of a line.** An edit that puts `// why` after a statement on a line that
  goes on swallows the rest of the line; when what is left still parses, nothing fails and a part simply stops being
  drawn (Keep Off the Grass lost its ride-on's body that way). Put such a note in `/* */`, or on its own line, and let a
  test look for calls inside line comments.
- **A lens makes a miniature.** Keep Off the Grass drew its voxels straight to the screen and looked like an engine's
  test scene; drawn into a texture and shown through one more shader (sharp in a band, soft above and below, a
  contact shade from the depth, a little more colour) the same scene reads as a photographed model. Two traps: take
  the depth for the shade before drawing the grass, or every blade shades the ground; and compare the depth in pairs
  either side of the pixel, or a ground seen at a slant shades itself all over.
- **Timers in a sequence run on game time, in every box.** Snow Day learnt it with a card; Keep Off the Grass had it
  again with its judges and its folding field. A view that sequences anything keeps a small queue of its own
  (`later(sec, fn)`) drained by `dt`, so it waits while paused and keeps step under express post and on a slow device.
- **A props list needs the page's own seed.** The minutes in `K.debug.props` are minutes of the eager bot as the page
  runs it (`KIT.simulate`, seed 1); minutes measured with another seed point the camera at the wrong place.
- **A wish only works if it can be put right.** Asking for stripes one way is a punishment if a lawn mown the other way
  must wait to grow back; letting the mower lay short grass its own way made a missed wish a second pass, not a wait.
- **A browser intervention is a console error.** `navigator.vibrate` before the player has touched the frame does
  nothing and logs a console error, which the browser suite counts; it failed two runs in five, whenever events
  from a scripted state reached the view before a tap. Guard such calls with `navigator.userActivation.hasBeenActive`.
