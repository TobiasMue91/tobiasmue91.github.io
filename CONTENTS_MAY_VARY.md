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
   Here Be Rabbits may weigh **300 KB**: the owner raised its cap to 210 KB after the art was redone and a
   budget round that changed no pixel brought it only to 203 KB, then lifted every limit for its refinement session
   (October 2026, rule 16), which began at 204 KB and passed 210 KB with its scenes, close-ups and diagnostic switches
   (`BOX_CAP` in the suite).
   Starter may weigh **200 KB**: for its refinement session (rule 16) the owner lifted every limit the
   anthology had set itself where it stood in the way of the result.
   Keep Off the Grass may weigh **200 KB** for the same reason: its refinement session (October 2026) began at
   133 KB, over the old cap, once the box had its close-up camera and props list.
   Tilt may weigh **230 KB**: its refinement session (October 2026) began at 126 KB and passed 130 KB with its
   scenes, close-ups and diagnostic switches before a pixel of the art had changed, then 200 KB when the street and the
   mountain were redrawn at the owner's request; the owner lifted the cap in advance. The owner raised it to **300 KB**
   (November 2026, calling the limit arbitrary anyway) when the play-test's fixes had brought the box to 229.6 KB and the
   open points (a desktop layout of its own among them) were still to do.
   Snow Day may weigh **230 KB**: its refinement session (October 2026) began at 116 KB and passed 130 KB with its scenes,
   close-ups and diagnostic switches and the first round of art (cotton-wool snow, wood, the leaders, the present); the owner
   lifted the cap in advance.
   Unwelcome Guests may weigh **260 KB**: for its refinement session (November 2026, rule 16) the owner let it be remade
   from the verb up (a poltergeist's whirl in place of the cold that herded people) and lifted the cap; the remade box
   began at 145 KB with its scenes, close-ups and diagnostic switches.
   Still Water may weigh **300 KB**: for its refinement session (November 2026) the owner set the cap there, calling it arbitrary
   anyway; the box passed 130 KB with its leaf-card woods, the fish in 3D, the remade fight and the guitar.
   The owner raised it to **350 KB** (November 2026) for the work toward a commercial feel (the catch's ceremony, gestures with a
   licensed hand, upgrades that show what they do), when the box stood at 287 KB with three small CC0 photographs in it.
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
   **The one exception (2026-11-06, the owner).** Before the anthology was shown on r/aigamedev, where most
   visitors try one box on a phone and leave, the owner lifted this rule once and had the shipped boxes put in the
   order that opens strongest: Tilt, Snow Day, Here Be Rabbits, Still Water, Unwelcome Guests, Starter, Keep Off the
   Grass (it was Starter, Keep Off the Grass, Tilt, Snow Day, Here Be Rabbits, Unwelcome Guests, Still Water). For
   this reorder only, neighbours had to differ on at least five of the seven axes of rule 3 (not all seven), and in
   rhythm and drawing style. Saves keep everything, since they name boxes by id (see **The reorder of November 2026**
   below). From now on the rule holds again: append only.
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
- **Two faces in one plane flicker.** In 3D, two solids whose faces overlap at the same height or depth fight over
  which is in front, and the seam frays as the camera moves (z-fighting). Keep Off the Grass's terraced roofs each
  overhung their house by .2 on both sides, so neighbouring roofs overlapped at one height; the owner saw the jagged
  seam. Things that meet should meet edge to edge, or one should be clearly higher; an overhang belongs only where
  nothing else is. Look for it close up from above, with the lens's blur off (`K.debug.lens.blur = 0`).
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
  person about half a minute. Once per save, 45 seconds into the first box, a tag under the box chip points at it.
  The box counts as opened for the stack (the next one comes), stands on the shelf
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

Numbered as the boxes stand since the reorder of 2026-11-06 (the slot each first shipped in is in brackets).

| № | id | title · handling | verb | loop | medium | palette | era · genre | sound | interface | ends with |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 (1) | `starter` | Starter · "Contains live culture." | tap jars at their peak, swipe along a scoring line, punch bulges flat | timing streaks → bench and oven → containing a creature that grows through a house | 1950s cookbook print: key line, misregistered colour plates, halftone | mint, tomato, mustard, cream | mid-century domestic, cosy | kitchen foley, lounge exotica with vibraphone and theremin | a price tag on a string, index cards in a red enamel recipe tin, each with a cut of its own | the whole house bakes into a loaf; slicing it shows a bakery box tied with string in the crumb |
| 7 (2) | `lawn` | Keep Off the Grass · "Keep hands and feet clear." | steer a mower by holding and dragging; no timing anywhere | grass box and compost trips → jobs for the street and robot mowers → five shows, each judged once and each a good deal larger than the last (a village green, a county showground, the National, the racecourse infield, a cup final pitch), each with a wish of its own (stripes towards the judges' table or along it, edged with a lap) and something to chase off it (a dog, a sheep, geese, a loose horse, a pitch invader) → a crop circle | real-time miniature: toy voxel houses on real grass, blade by blade, in hand-written WebGL 2 with a shadow map, shown through a miniature photographer's lens (tilt-shift, contact shade) | lawn greens in stripes, lemon, cobalt, flamingo pink; indigo and moonlight at the end | 1990s suburban summer, small-town show | a two-stroke engine and grass hiss, a cheap keyboard's demo song, brass for the show, a music box at midnight | a moulded plastic dashboard, blister packs on a hardware-store pegboard | the field was a box: the crop circle is its net, it folds up, and the number is printed underneath |
| 1 (3) | `clew` | Tilt · "Contents may rattle." (first shipped as Minos Wants a Map · "Do not unwind.", then as The Minotaur Moves Out, then built as Stand Well Back) | hold a thumb on the board and steel balls pour in at that column; slide to aim the stream; tap to set the auto-launcher and to catch lanterns | games of a few seconds to two minutes, each ending with the tray, and a skill tree between them; a Big One on each board keeps its damage between games and opens the next, taller board | 2D canvas neon: glowing tubes, chrome balls with a hard highlight, a painted playfield behind glass, a brick wall at night for the sign | navy, hot pink, cyan, gold, cigarette haze | 1980s pachinko parlour, escalating to the absurd (the parlour on its side, the street, the mountain) | thousands of tiny ticks, tulip chimes, the reels, a fever fanfare, a neon tube striking; an original chiptune march that gains a part per board | the parlour's neon sign as a lucky wheel: 162 bulbs, a four-quartered star round TILT and a ring per board | the mountain's Big One is a cardboard box with the next number; OPEN IT, and the lid lets the light out |
| 2 (4) | `flurry` | Snow Day · "Contents may be thrown." | tap a kid to throw at them (the rules lead a runner, cover stops a plain ball); tap their snowballs in the air to swat them; tap a passing sledge; fire the catapult | runs that end when you are too cold, a felt tree between them; every hit wears a kid's resolve down for good, and a kid with none left crosses over and throws for you, so the gang you fight becomes the army you have; a yard falls when its whole gang has come over | real-time 3D as a stop-motion TV special: felt puppets with fibre and fuzz, cotton-wool snow, poses that change twelve times a second, a warm grade, grain and vignette | snow white and frost blue, cranberry, pine, mustard; the light goes from morning to a pink sunset to a violet night | 1960s Christmas TV special, winter suburb escalating to a yeti's mountain | crunch and splat foley, sleigh bells, a celesta waltz with pizzicato bass that gains a voice per yard, muffled indoors | a felt Christmas tree on a wall hanging in the front room, a tier per yard, baubles as nodes | the yeti gives up last and brings a present with the next number on its tag; open it and the lid lets the light out |
| 3 (5) | `warren` | Here Be Rabbits · "Contents may multiply." | drag towers anywhere on open ground and turn a monk's fan; sound the horn for the next wave; draw the dragon's line, the ink's pour and the great bell's ring across the horde; tap golden hares that run for the castle | folios of waves with a pause between them and one wall for them all; a lost folio starts over, its leaf kept; the Tree of Jesse between folios and between waves; the castle's valley, the river, the forest and village, the mappa mundi, the rabbit king | an English Gothic manuscript of about 1320 on a 2D canvas: every folio a page painted with more of the land (meadow, roads, bracken, woods, a river with bridges, a village) round a castle, the rest of the page a faint underdrawing; a crowd of tens of thousands of marginal rabbits | vellum, iron-gall brown, vermilion, lapis, verdigris, raised gold | the 14th century, the world turned upside down | quill scratches, arrows, squeaks, a bell, a dragon's roar; an original estampie for shawm over a hurdy-gurdy drone that gains a tabor, a second shawm and chimes chapter by chapter | a Tree of Jesse: Jesse asleep at the root, four scrolling boughs, a gilded initial in every medallion | the defeated rabbit king kneels with a book shrine (a cumdach) with the next number on its lid; OPEN IT, and the light comes out |
| 5 (6) | `guests` | Unwelcome Guests · "Do not open after dark." (built first as a tap-the-furniture draft, shipped as a cold that herded people, remade in November 2026 as a poltergeist) | hold a finger on the house: a whirl follows it, tears loose whatever it passes (teacups and candles first, chairs, then the long-case clock and the armour, last the piano and the chandelier) and carries it round; what it carries hits people; let go and it all crashes down, or with Fling flies on | short nights against ectoplasm and the dawn, the organ between them; a hit frightens and shoves, past their nerve they panic and run out of the door, and every exit costs a pip of resolve for good; five casts, from a family of three to a film company and twenty-six extras | silent film in coloured cut paper: black silhouettes before rooms of lit, tinted paper (teal, ochre, wine, green, violet, rose), what is built in one plane back in the room's own shade, a cream card ghost, grain, intertitles, iris | indigo night, six room colours, black, cream; warm sepia in the cellar | 1920s, gothic comedy | an upright piano in the pit, organ pipes that sound when bought; porcelain, thuds, smashes and the whirl's wind | intertitle plates, cast cards with pips of resolve, the organ in the cellar | a crate delivered after dark; the iris closes on it |
| 4 (7) | `jetty` | Still Water · "Keep away from water." | walk the jetty, swipe up to cast, tap when the float goes under, then play the fish: hold to reel, let go when the line is red, slide the held finger to lean against a run, let go while it jumps, pump a sulk | no runs and no clock: a day of eight minutes turns over one lake; ten kinds by distance, hour and bait, each met with the tackle of its time and fighting its own way, sizes up to a trophy; the tackle board between casts; a bank rod in the reeds that rings and is walked to | first-person real-time 3D in hand-written WebGL 2: leaf-card woods, willows and reeds from a painted atlas, the sun's shadow, a lake that knows its depth and mirrors the banks; fish painted in ink and wash, the same painting wrapped round a 3D body | meadow and willow greens, peat water, a red float; gold dusk, blue night with fireflies | English summer, cosy angling, the uncanny in the deep | lapping water, birds, crickets, the reel's clicks; a fingerpicked acoustic guitar (Karplus-Strong) that thins at dawn, slows into B minor at dusk and plays harmonics at night | paper cards on the water: the tackle board, the logbook of painted fish, the catch card | the Old One takes the bait in the deep with a tobacco tin wired to its jaw, the next number on the lid; tap it and the lid lifts |

Pacing as measured by the test (eager / casual minutes, three seeds): Starter 30–32 / 48–50,
Keep Off the Grass 30–34 / 59–61, Tilt 38–41 / 60–62, Snow Day 35–36 / 62–64 (after its refinement session),
Here Be Rabbits 41–43 / 75–85, Unwelcome Guests 35–37 / 66–71 (remade, November 2026), Still Water 40–50 / 40–46.

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
  (1,500 · 150K · 1.4M · 18M · 600M since the mega balls were mended; first 1,500 · 150K · 1.2M · 5.5M · 75M) that
  every game takes 2.5 to 5% off at the start of a board and 15 to 25% at the end. It cracks a little more at every fifth.
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
- **Here Be Rabbits** (box 5). **The refinement session** (October 2026, rule 16). The owner asked for the box to be taken to
  the bar of a finished commercial game, lifted the byte cap (rule 2: now 300 KB; the box began at 204 KB) and gave four notes
  from their own play: the hint "Draw across the horde" jumped about, rabbits slowed by a snail should change colour, the
  chosen archer's dashed ring ran over his head, and rabbits seemed to vanish and reappear at random; then, mid-session, that
  layers must be respected everywhere (an archer stood behind a trebuchet that was drawn over him).
  - *Tools first.* `CORE.revisit` (back before the king's folio from the shelf, the tree and the leaf kept; tested);
    `?world=warren&scene=<name>` plays the eager bot (`&bot=`, `&seed=`) to the moment and starts there: first, tree1, prep,
    folio1..13, crowd, hare, falc, ferret, treb, dragon, ink, bell, flood, won, lost, chapter2..4, king, kneel, end (a name is
    looked up whole before a digit is split off; only moments keep their events). `K.debug.look(x, y, scale, { freeze, on:
    'tree', sel })` takes things by name (`monk`, `snail`, `treb`, `falc`, `ferret`, `tower<i>`, `king`, `hare`, `crowd`), 25
    close-ups in `K.debug.props`, `snap()` the canvas (or the tree). Switches for a real phone: `?fps` (frame rate, draw calls,
    rabbits drawn and the budget, DPR, canvas size, and milliseconds per part, each part flushed with a one-pixel read),
    `?dpr=1`, `?fx=0` (no particles, cloud shadows, vignette or shake), `?glow=0`, `?horde=<n>` (rabbits drawn at most). The
    suite refuses a line comment in the view with a statement after it, as for Snow Day.
  - *A bot that never rang the bell.* Counted by cause over the eager bot's game: monks 62%, dragon 13%, trebuchets 9%, ferrets
    6%, flood 5%, ink 3%, falcons 3%, and the great bell **never**. The bots weighed a single cell against thresholds of 20 to
    30 rabbits, and a cell holds at most 24 (`P.cap`): the bell could not fire and the ink rarely did, so the pacing had been
    tuned without them. `thick()` now weighs a cell with its four neighbours; the bell takes 2% and the ink 16%, and the eager
    bot takes 43 minutes (41.5 before), the casual one 75 to 82 (79 to 86 before), the longest wait 3.8 minutes.
  - *Rabbits that popped.* Counted with `K.debug.ch()`: the view faded 25 to 50 rabbits a second in and out mid-route, because
    the rules' count spreads like a liquid along the road while the view's walkers keep together, so the correction removed
    them at the back and added them at the front. Now a rabbit may only be made or dropped where nobody can see it happen (off
    the screen, at a hole, deep in a crowd of nine and more); anywhere else a surplus runs to the nearest shortfall within 52
    units, and a slain rabbit falls over where it stood into an ink blot (charred, if fire took it) instead of vanishing; at the
    wall they gnaw and run off home, fading. Measured again: no fade left in sight on a phone.
  - *Layers.* Rabbits, defenders, golden hares, the king, every tree, every cottage and the castle's walls (its sprite cut where
    they meet the mound) are drawn in one pass sorted by the line each stands on; a defender, hare or king hidden by a tree, a
    cottage or the crowd is drawn over it as a pale silhouette, as strategy games do (see-through trees read as a drawing
    fault). The chosen defender's ring lies on the ground under him.
  - *The owner's other notes.* The dragon hint holds its line on the land and moves on only when the crowd has left it,
    gliding; a rabbit near a snail takes a green glaze as strong as the snail slows it (the slime map is the flow field's speed
    against the same land without snails), so its reach and effect show.
  - *A critic's round* (fresh, phone filmstrips with real touch): 7/5/7/6/5 and **5** for "would pass as commercial". What it
    asked for and what changed: the horde read as gravel (rabbits a fifth larger on a phone, red eyes with a glint: they are the
    margins' killer rabbits); grey ability buttons that could not be told apart while resting (they keep their colours under a
    dark wedge that sweeps away, with the seconds left on a tag); the ending's frame let silhouettes of the land through and the
    bottom bar stayed over it (both gone); every monk's fan showed all the time (only while the land waits for the horn, for
    the chosen monk and while dragging); the HUD covered the castle (the auto camera eases it out from under); the wall bar read
    full after a lost run (it shows how the run ended until the next begins); AUTO was never explained (said the first time the
    player takes the camera); a pink castle while gnawed (a flush at a third of the strength); place names on the world map
    shouted over the play (smaller, quieter). Not done, the owner's call: the leaf runs into millions by the world map (the
    critic finds idle-game numbers off-tone for a manuscript).
  - *Also new.* The book shrine is a reliquary, a chasse of gilt and blue enamel on four paws with an arcade of trefoil niches
    (a gold rabbit saint in each), a lid diapered with quatrefoils, the next number on a label, a pierced cresting and crystal
    knops; opened, the lid tips back, light pours out, and the opening grows out of the shrine until the view looks down into
    it, a floor of light between gilt walls, which is the rectangle handed to the shell. The rabbit king has two phases: at
    three fifths he calls his court out of the holes, at a quarter once more, and spurs his snail on. A folio held is kept on the
    desk (the rules have already moved on: the HUD and the land no longer give the next page away behind the card) and turned
    over, right to left, when the player goes back to the land, with a fold, the back of the page and its shadow. Medallions on
    the Tree of Jesse show what they give, drawn with the box's own pen (monk, arrow, dragon, snail, castle, trebuchet, inkpot,
    falcon, ferret, hare, leaf, bell, wave), with the price on a tag and the effect in a word or two ("×1.3 kills", "+2
    monks"); on a phone the tree frames only what is bought and can be bought, larger. On a desktop the empty left page keeps a
    chronicle: who slew how many on this folio (with the medallion pictures) and the last events in the scribe's hand. Kill
    counts of the gifts are larger, in the textura, and one per use. Sequences run on game time (`later`), never `setTimeout`.
  - *A desktop critic* (fresh, same capture at 1280×800): 7/5/7/**4**/5 and **4**: the wide screen added nothing a phone did
    not show. Changed: every message after the first run goes to the chronicle on the left page, never over the battlefield;
    the land is framed as a page, a bar border of lapis and vermilion between gold rules round what is painted so far, with
    ivy sprays curling out of it (hairline stems, leaves in gold, lapis and verdigris) and gilt bosses at the corners, a rabbit
    with a spear facing a snail in the lower margin and a golden hare leaping over the top; the unpainted vellum's underdrawing
    is a scribe's sepia sketch of little trees and its stains are uneven, darker at the rim (the critic took the old discs for
    placeholder wallpaper); the tray holds every kind of defender the player owns, greyed when all are on the land, and a click
    on a greyed one finds the next of its kind; the gifts carry their hotkeys; the ending's frame is half as large again. The
    close-ups (`util/cmv_props.mjs warren`, 25 tiles) found a red square over the castle when the wall fell (a leftover
    `fillRect`; now the castle's own red-tinted sprite), a zigzag sheen on the ink (a polyline through jittered blobs; now a
    curve through their midpoints), charred rabbits and their blots that made a brown mud where the dragon burnt (lighter),
    and the tree's snapshot without its parchment. Every first-run loss now reads "A first taste": what the run paid, and what
    to do with it, instead of "The wall is eaten!" after a tutorial. A monk who has just shot holds an empty string and rocks
    back before he nocks the next arrow. On a phone the Tree of Jesse opens on Jesse and the trunk, large, and gold arrows at
    the edge point to medallions out of view (a tap on one brings it in).
  - *A third critic* (fresh, phone, after the two rounds above): 7/4/6/6/5 and **4**, the plateau *Stills plateau* names; some
    of its points were wrong about the frames (it saw no burn trail behind the dragon). What it found and what changed: hidden
    defenders filled pale read as disabled (now a crisp gold outline with a faint fill, all of them in one layer a frame); the
    ↺ of *Recall all* on a phone read as "restart" (it carries the word now); the numbers under resting gifts read as costs
    (they say "22s"); "Wave IV ▸ 7" read as a price ("Wave IV in 7 ▸"); "A first taste" over an eaten wall read as a
    contradiction (the card says the wall is eaten and then what the first taste paid); the ending had no summary (a colophon
    under "Explicit.": rabbits slain, folios held, battles; the rules keep `S.slain`, no call to the PRNG, so the bots play as
    before). A herald's scroll drops for the great moments (the king rides out, he kneels, a new chapter), on game time.
    Its two largest points are the owner's to decide and are not done: the playfield is a cartoon meadow rather than a page
    (the remake made the land "realistic terrain and nature" at the owner's request; the border, the underdrawing and the
    chronicle now carry the manuscript round it), and the leaf runs into millions.
  - *Cost again*, after this round: the horde's lit body was enlarging three world-sized sheets every frame (33 ms in the
    software renderer); it now enlarges only the cells in view (13 ms). The sorted pass of rabbits, trees and defenders costs
    20 to 50 ms there with 2,000 to 3,000 rabbits; `?fps` shows each part (`h:blots`, `h:body`, `h:sorted`, `h:silo`).
  - *The owner's phone* (October 2026): the frame rate was very poor. What it paid for, and what changed: trees and cottages
    had been taken out of the painted tiles and drawn one by one every frame for the sorted pass; they are back in the tiles,
    and one is drawn again in the sorted pass only when a rabbit, a defender, a hare or the king stands behind it within its
    outline (the castle's walls likewise), so the depth stays right for a handful of draws instead of hundreds. The cloud
    shadows and the vignette were screen-sized gradients made anew every frame; they are painted once into small canvases and
    stretched. A touch screen draws at most 1.5 pixels a point (`?dpr=` overrides). The rabbit budget follows the real time
    from one frame to the next as well as the horde's own cost, down to 500 rabbits drawn when a device cannot keep up. The
    main canvas is opaque. In the software renderer the sorted pass fell from 30–80 ms to 11–15 ms. Still to be measured on
    the device.
  - *The frame meter itself was the brake.* On the owner's phone every variant ran at about one frame a second, all of them
    with `?fps`: the meter read one pixel back after each part of the frame (Tilt's way of timing the raster), and on a real
    phone each read makes the GPU stop and wait, after which Chrome moves the canvas to the CPU for good. The read now happens
    only with `?fps=flush` (for the test browser); `?fps` is a strip over everything at the top of the page. Then the
    silhouettes: composited over the screen (or round each hidden figure) they cost 13 to 60 ms in the software renderer; now
    each kind of figure has its outline made once, and a hidden one is a single draw (0.1 ms). Lesson below.
  - *Firefox on a phone.* On the owner's Redmi Note 13 Pro the stripped-down scene (`?land=0&horde=300&body=0&border=0&fx=0&
    hud=0&dpr=1`) ran at 59 fps in Chrome and 6 in Firefox (frame 168 ms, script 24 ms), and Tilt ran at 9 in Firefox too:
    Firefox there pays for every draw call, whatever is drawn. So the count of calls came down (`K.debug.pcalls()` counts them
    by part): the crowd's shadow under thinned stretches was an ellipse a cell (714 calls; now four paths by strength), arrows
    in flight two strokes each (now two strokes in all), every defender and its footing drawn stroke by stroke (now painted
    once at 12 px a unit, a monk once per 32 turns of his bow, drawn or just loosed, and per what the tree gave his arrows,
    then placed with one draw), the page border's ivy every frame (now painted into the tiles). The scene went from about
    1,700 calls to about 450 at 300 rabbits; the rabbit budget falls to 250 when frames stay slow.
    Measured by the owner in Firefox afterwards: the largest horde 25 fps (3 to 7 before), the stripped scene 32 (6), an early
    folio 62. The next cost was the minimap (18 ms in the largest horde: a rectangle a cell); it is three paths by strength now,
    redrawn ten times a second. A heavier moment then measured 8 fps in Firefox (script 116 ms: figures 51, HUD 17, body 16,
    clouds and vignette 6); the HUD writes to the page only 15 times a second and only what changed, the body's three washes are
    laid on a small sheet and enlarged in one draw, the vignette is a CSS layer over the canvas, cloud shadows only with a mouse.
  - *A last round, close-ups first* (November 2026, the owner at 20 fps on the phone and asking for one more round). A fresh
    close-up critic with the checklist went through the 25 props and found twenty faults; three were the props list's own
    aim (the dragon and the flood had left the frame; it now points at the gift itself, `look('gift')`). Fixed: the king's
    silhouette was cut by a sprite too small for him and lay over the crowd as a pale slab (the king and the golden hares are
    now drawn over the crowd, opaque, the king with a contact shadow: a boss and a prize are never lost in it); the ink pool
    was drawn over the defenders standing in it (it lies on the ground now, under everything that stands); new rabbits grew
    from a third of their size and read as a second, smaller breed (they climb out of the ground at full size, ears first);
    the Tree of Jesse's boughs showed a rounded cap where they met the trunk (trunk and boughs are one silhouette now: every
    dark stroke, then every light one), its leaves floated beside the vine (each on a stalk), and the trunk rose from the
    top of the coverlet (it is drawn first and comes out from under it); price tags overlapped when the whole tree was in view
    (they show once the medallions have room); the trebuchet's counterweight was a grey square (a timber box of stones with an
    iron band and rivets); a lone dark ball sat in the bracken (gone); every cottage was the same cottage (every other one
    mirrored); a river that ended in a blunt cap in the meadow rises from a spring in a ring of stones with rushes; the young
    green field's dark plot with hard lines read as a grate (rows of green with soil between). Not done, from the same list:
    straight worn tracks across the world map's meadow, tufts drawn over the fields, the ink running past the painted land.
  - *The owner's long play on a desktop* (November 2026). They liked the kill split in the chronicle. Their notes and what
    changed: the chronicle folds away to its title (a click on it; the save keeps which); the grey-brown mass of a big crowd
    is a light, warm fur half see-through to the ground, laid only under a thick crowd, with more of each rabbit showing
    above it; the monk's handle is drawn last of all, over trees and figures; from the tray a click (no drag) picks a kind up
    and every click on the land sets the next one down until none is left (Esc, a right click or the tray again stops), and
    *Set all* puts every waiting defender on the ground the bots would choose (a click on the tray used to set the defender
    down right under it); the last run's rabbits are cleared when a run starts (the view's walkers outlived the rules' count
    for a moment); trees no longer jump between layers (a tree redrawn because someone stood behind it was drawn over its
    neighbours in front, which were only in the tile: those that overlap it are redrawn with it); when fewer rabbits can be
    drawn than there are, every rabbit near the castle and within a defender's reach is drawn, and the rest of the crowd
    shares what is left (monks shot at nothing and the wall was bitten by rabbits that were not drawn). An F5 in
    `?world=warren` loses the game, as that mode saves nothing; `&keep` plays into the real save.
  - *The opening, in the round* (November 2026, the owner: "it looks rather two-dimensional", and after a first try, "still
    faulty": that try only squashed pictures, so the lining grew while the lid's face still showed, the inside sat on the chest
    like a storey, and flaps stuck out at the end). It is now a real model: the chest a box, the lid a hipped roof, both
    projected with a camera whose pitch rises from the picture's own view (at which the projection is the picture exactly, so
    nothing jumps) to straight above, in perspective that grows as it rises; faces turned away are culled, far faces drawn
    first, the painted front and the lid's painted slope laid on their projected faces with an affine transform; the roof's
    hollow shows its four velvet faces once it has turned up, and it fades as the camera passes over it. Before that, the
    first try had made it a sequence of pictures: the lid swings back on its
    hinge along the back edge (its outer face shortens with the cosine of the angle, then the hollow of the roof shows its red
    velvet lining, narrower at the ridge, with a gilt hinge band), light pours from the opening, and the camera rises over the
    shrine: the front shortens with the cosine of the pitch, the opening grows with its sine, the inside is four gilt walls in
    perspective round a floor of light, until the camera looks straight down into it; that opening is the rectangle handed to
    the shell. Filmed frame by frame on the game's clock (`?speed=0.25`). The film found two more faults: the end card's
    timer reset the finale's own clock 1.4 s in, so the closing miniature faded in twice, and the herald's scroll for the
    kneeling king lay over it. Also from the close-up list: no tufts or scuffs on the fields (a mask of the cells under them),
    the horde's worn ways as uneven scuffs rather than a ruled band, and no ink beyond the painted land.
  - *Two calls the owner left to the session* (November 2026). The leaf keeps running into millions: the genre the box follows
    (Sir, We Have an Orc Problem, the paid incrementals) counts up that way, the tree's prices are built on it, and rescaling it
    would retune every folio for a complaint about tone; the colophon and the chronicle count in plain figures. The playfield
    stays the painted land the owner asked for in the remake; the manuscript is carried by the page border, the underdrawing of
    what is not painted yet, the chronicle, the Tree of Jesse and the shrine.
  - *Sound*, rendered offline (`OfflineAudioContext`, the box's own sound functions in a page of their own): the music peaks
    at −19 dB with an average of −37; a dense moment of effects (kills, bites, stones, the dragon, the bell, the flood, a hare)
    peaks at −10 dB, average −32. Nothing clips; nothing changed.
  - *Cost of a frame* (`?fps`, the world map's largest horde, phone, headless software rendering): about 2,000 rabbits drawn,
    1,800 draw calls, horde 29 ms, land 7 to 14 ms. Nobody has measured it on a real phone yet.
- **Unwelcome Guests** (box 6). **The refinement session** (November 2026, rule 16). The owner found it the least fun of the
  boxes (though its music among the best), lifted the cap (rule 2: 260 KB) and let everything be remade.
  - *Why it was not fun, counted by the bots.* A hundred nights of 24 seconds; 80% ended because the ectoplasm ran out; one in
    five nights nobody left; a panic (the state that sends someone to the door by themselves) came two or three times in the
    whole game, so the pipes that act on it did nothing; the bots never slammed a door; the organ took 1.4 of 40 minutes; minute
    25 looked like minute 1. A fresh critic scored 6/4/6/5/4 and 3: the verb is a leash, the night ends on a timer, feedback is
    text, crowds are a black mass, the finger covers the ghost.
  - *Chosen* (rule 5, nine pairs; the owner picked the first, liking the second's theme more): **the poltergeist's whirl**, over a
    night parade of tsukumogami in an Edo inn (woodblock print), and shaking a dollhouse. The look keeps the silhouette film and
    the music, and moves from Reiniger's grey to Michel Ocelot's lit colour.
  - *The core, `CORE.version` 3* (`migrate` starts versions 1 and 2 afresh; `revisit` brings the picture people back for another
    take, the organ kept). Thirty-eight things in six rooms in four tiers (the grip pipes open each); each has a mass, crockery
    breaks. A hit frightens by the power of the mass and shoves away from the whirl; a panicking person runs for the nearest way
    out and a hit only speeds them on; nobody is pinned against the far wall (they duck past). Screams are paid by the hit, not
    by the share of someone's nerve, so a bigger cast pays more. Pipes that change the game: the grip (chairs, clocks and
    armour, the piano), doors that slam as the whirl passes, Fling, the grey lady's whirl, imps that throw things in other
    rooms, a stampede, heirlooms worth five. Stickers: the piano, eight in a row, ten in a night, three out with nothing broken,
    the full organ (a whole game by a bot earns two or three).
  - *Two bugs that held up the first tuning.* A thing standing on a floor (`y = -f * FH`) was counted to the floor below, so the
    whirl never picked up a chair and the bot hovered over it all night; a panicking person hit from the door's side was shoved
    against the far wall and pinned there by the whirl for the rest of the night.
  - *Pacing* (three seeds): eager 35.0–36.6 min, casual 66.4–71.2, the longest wait 1.5 min; the first night lasts 15 seconds,
    gets one or two out and pays for the first pipe.
  - *Tools.* `?world=guests&scene=<name>` (first, night<n>, organ<n>, reel<n>, grip<n>, fling, grey, imps, slam, piano, crash,
    panic, crowd, finale, end), `K.debug.look(x, y, scale, { freeze })` (x may be `ghost`, `item:<kind>`, `person:<id>`,
    `door`, `crate`), 19 close-ups in `K.debug.props`, `snap()`; `?fps` (`=flush` in the test browser only), `?dpr=`, `?fx=0`,
    `?film=0`, `?people=0`, `?things=0`, `?whirl=0`. Every thing is a sprite made once per scale; sequences wait on game time.
  - *Critic rounds on the remake.* First (phone and desktop filmstrips, real input): 6/4/6/6/5 and **4**. Changed after it:
    the counter starts at 0, labels and screams move out of each other's way, the pale rim only on someone frightened, a
    bolder whirl and larger crockery, the ring kept inside the walls, the coat cut to the body, the organ's register whole on
    a phone, on a desktop a larger house and the cast in a column.
  - *Second round* (fresh critic, same captures): 7/5/7/6/6 and **5**. Changed after it and the close-ups
    (`util/cmv_props.mjs guests`, 19 tiles): a heavy hit knocks someone over about their feet and they get up again; the
    ghost swells with what it carries; hands with a thumb, hair, legs with some weight to them; a portrait is an ancestor's
    silhouette on a pale oval; calm people keep a little apart, so a crowd stands as people; the whirl and what it carries
    are clipped to the house, and nothing in the ring comes closer to a wall than its own half-width; every lesson is said in
    one place, in the sky over the roof, and THE DOOR is named only once someone panics; the bar says reel and night; a night
    that got someone out is not called a fade; on a desktop the cast column, the counter and the bill are larger.
    Pacing after it: eager 33.0–37.0, casual 73.7–76.1, the longest wait 2.3 min.
  - *Third pass.* The people are no longer one template with a hat each: a build and a nose of their own, a bustle, a train,
    a fringed dress, an apron, a shawl, a stooping professor with a cane, a camera on Sparks's shoulder, girls with legs under
    a knee-length frock (`K.debug.lineup()` draws every look side by side). Locked pipes show their emblem, dimmed. On a wide
    screen the film is shown in a picture house: red velvet curtains held back with gold ropes, a valance with a fringe,
    painted once and laid over the film in one draw. Sound measured offline: the densest moment (four heavy hits, the piano
    landing, china smashing, a door slamming, at once) peaked at −1 dB and now at −4 dB; nothing clips.
  - *The close-up critic* (19 tiles, the checklist): Edith climbing the stair stood through the ceiling (each floor now has a
    hole for the stair, with a rail round it); a figure knocked over rotated through floors and walls (clipped to its room);
    doorways between rooms were wall stubs ending in the air (a lintel and posts); the armour was boxes (one silhouette with
    pauldrons, a gauntlet round the spear); the piano read as a sideboard (pale keys in every look); the rocking horse
    floated over its rocker; candles in the whirl burnt upside down (blown out in the air); the range had no hob; the lamp
    by the front door hung on the sky (a bracket); the door was a slab (panels and a knob). Six tiles aimed at nothing, the
    props list's fault: they aim at the last hit, slam, imp or landing now, and the curtains stay off in a close-up.
  - *Third critic round* (fresh, filmstrips): 7/5/7/6/6 and **5** again, the plateau. Done after it: what the whirl carries
    keeps a pale paper edge of a fixed width on screen, so a piano in a heap of chairs still reads; the whirl draws torn
    paper scraps spiralling in instead of frost crystals (critics read the crystals as snow); OUT! and the scream plates stay
    inside the house; half the extras are a breath lighter than black, so a crowd has depth (lighter still read as
    see-through); the HUD fades out faster when the organ comes; the bed has a frame, the maid's apron is a bib in half-tone
    (a white bar read as a hole); the intertitle card fills more of the screen; on a phone the house sits higher.
    The owner looked at the frame rate on their phone and found it fine.
  - *Fourth round* (fresh critic, after paper layers, wallpapers and copy): 7/5/6/6/5 and **4**, the plateau again, now with
    one critic's spread. Done after it: the cellar opens with the iris from black after the night's card (the card, the
    organ and the cast cards had shown through each other for a frame); the film's scratch lines are gone (two critics took
    them for a rendering fault; the dust specks stay); screams stay under the roof; the front door's leaf is drawn in the
    frame and flung wide when someone bolts through it, then swings back; a lesson sits in a slot measured under the bill;
    plates fly to the counter sooner; a heavy hit holds only its victim for a moment; the ring spreads heavy things further
    out; the organ's copy is plainer. Pacing after it: eager 34.3–36.5, casual 70.1–70.8 (two seeds).
  - *The people, traced from period silhouettes* (the owner's go-ahead for the large lever, rule 16). Every figure now comes
    from a cut-paper silhouette of the 1830s and 1840s in the Metropolitan Museum of Art's Open Access collection (CC0,
    public domain; most by Auguste Edouart, d. 1861, one by J. D. Croome): Harold is James Tooley with his top hat and cane,
    the professor Aaron Willard with spectacles in his hand, Teddy George Wright holding a cup, Kessler J. Schwartz Massett
    reading, Sparks the Reverend Gorham Abbott with both hands out; the ladies are Kate Lucas (without her dog) and a young
    girl with long braids; Cyril is Harry Lucas; extras draw from eight gentlemen and the two ladies.
    `util/guests/silhouettes.py` fetches them through the museum's API, finds the figure, traces it with potrace into a path
    1000 high with its feet on y = 0, and measures the trouser legs; the table `SIL` in the view is its output (about 23 KB).
    A gentleman walking is cut at the knee and his shins swing below it; a lady's skirt hides her feet, so she bobs like a
    puppet on its stick. Wikimedia Commons, where most of these are also kept, refuses requests from this environment.
  - *Fifth round* (fresh critic, with the traced people): 7/**6**/7/6/6 and **5**; the traced silhouettes are "the best thing
    here". Done after it: what the whirl carries goes round behind the people, so whoever it hits is seen; extras are all
    black again (a shade lighter read as see-through); the upstairs windows are frames with an open casement, not cream tabs.
    Next, by the critic's list: the props are still drawn from primitives beside traced people (the same lever again: cut-paper
    furniture of the period, Edouart's own chairs, tables and harp, traced the same way), every reel in the same staging, the
    boxed small-caps panels everywhere.
  - *The owner's first play* (November 2026): four nights from the start bought one pipe. The tuning had raised every price by
    one factor to fit the bots' pace, so after the first pipe (14) the cheapest cost 240, eight first nights for a person (the
    bots earn more a night than a person does, so their pacing never showed it). Each register now starts cheap (14, 35, 50,
    90) and grows steeply to the same top; the later casts have more nerve to keep the pace (eager 36.8–38.2, casual
    80.3–83.8, the longest wait 3.4 min). The suite wants four pipes under two first nights.
  - *The owner's verdict on the remake* (November 2026): still the dullest box; repetitive after five minutes, the number of
    people in the house (on which the score depends) is not theirs to change, little growth, nothing left to discover. Three
    answers compared (rule 5): **A, the house's reputation** (screams spread rumours, the organ buys more and new kinds of
    guests, the house is built onto: cellar, attic, crypt, tower); **B, a haunting on tour** (a new house each stage: cottage,
    hotel, opera, castle); **C, haunting cards** (one of three random rule-changing cards a night). A answers every point (the
    crowd is the player's to grow, as in Garbage Growth; the house grows in the frame), B escalates but keeps the cast
    fixed, C varies without growing. Chosen: A, with B's new scenery as the annexes; the owner lets the house change shape.
  - *The house's reputation, built* (`CORE.version` 4; `migrate` starts versions 1 to 3 afresh). The Pembertons live in the
    house and come back every night; everyone else is a guest the organ's third register draws (more visitors, then new
    kinds: neighbours, men of science who scoff at teacups, ghost hunters whose lanterns drain the ghost, reporters whose
    flash in a panic frightens their floor, a wedding party braver two by two, the picture people). Guests' nerve does not
    grow with fame: a first version made them braver as the house grew famous, and the bots never drove out more than eleven
    a night whatever they bought (the escalation cancelled itself out); with fixed nerve and braver kinds, a late night
    drives out thirty and more. The house is built onto (a wine cellar with the old kitchen, an attic under a new roof, the
    crypt, a tower with a spire), each floor with its own light, paper and furniture and things to tear loose (casks,
    bottles, urns, coffins, trunks, birdcages, a telescope, a globe); the stair at the left joins them all. A house taller
    than the screen keeps its size and the camera follows the ghost up and down; the house is painted into a tile of the
    world once and the frame only moves it. The last gate is the verb: with the tower built and the picture people come,
    they film the house, and every person driven out is filmed (six reels of sixty, each one news); then the delivery.
    Pacing: eager 32.9–33.4, casual 56.5–62.0, the longest wait 4.4 min.
  - *The owner's play of the reputation* (November 2026): fun, the cosiest box and still the dullest; the curtain was lopsided
    and hung into the tower on a desktop; the last nights lagged on a phone and a desktop. The curtain was painted once for the
    first scale and never again as the house grew (it now follows the scale, keeps clear of the walls, and the film starts
    under the valance); the house's tile was painted afresh, its canvas allocated anew, twice a second as the moon moved (the
    moon now moves only the sky); forty traced silhouettes were filled path by path every frame (each figure, step and rim is
    now a bitmap made once at the camera's scale).
  - *Peaks and choices* (the owner chose two of three: a frenzy and a booking a night; an exorcist who ends a night early was
    turned down as needless frustration, and nights had felt short). Every hit fills a meter under the ectoplasm; full, the
    whirl runs wild for seven seconds (gold ribbons, POLTERGEIST! across the screen, the piano agitato): it lifts one tier
    heavier, carries more, spins faster, drains nothing and screams pay half again; each frenzy in a night wants more. A first
    version lifted everything and paid double, and the first night emptied the house. Before every night from the third, three
    bookings are offered and one taken: an ordinary night, a séance (sitters and a medium whose lamp drains the ghost, screams
    worth half again), a Halloween ball (twelve dancers, a short night), a thunderstorm (thunder frightens the whole house, the
    ghost stronger), buyers (hard to frighten, worth six), a full moon (more ectoplasm). Nights last longer (15 s of ectoplasm,
    dawn at 46 s). The sticker *Not a cup out of place* made way for *Poltergeist* (four frenzies in a night).
    The curtain was drawn in device pixels and scaled by the device's pixel ratio once more: lopsided on any screen but a
    test browser's. Pacing: eager 32.8–33.7, casual 53.3–57.5, the longest wait 5.0 min.
  - *Scores that stayed below 8* (the last critic's, phone first): clarity 5 (the pips, "104 to go" and the counter that waits
    for its plates before it counts still need reading), phone 6 (sky above the roof and a band under the house), feel 6,
    "commercial" 5. What the critics still name: flat vector rather than cut paper (no torn edges, no off-register), one
    wallpaper motif in six tints, the same small-caps plate on every surface, copy that sounds like labels. These are the next
    session's: a motif per room, an edge on the props and figures, and a pass over every line of copy. Begun: what is built in
    casts its own shadow on the wall a few units down and right, as a layer of cut paper does, and the ceiling and the walls
    cast a torn edge of shadow into each room; the study's window spills a soft light (all painted once into the backdrop).

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
  to −22, some 13 dB under the engine, which on a phone's speaker is close to silent. The owner chose to raise it
  about 8 dB: the box's music now goes through its own gain (×2.5) and a limiter (threshold −10 dB, ratio 20) into the
  shell's music bus, and measures −32 to −35 dB on average with peaks at −6 to −9; the mower's sound is untouched.
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
  **Round 4**, from the same critique: the stadium has a pale roof over its back rows on columns, with a cobalt
  fascia, and advertising boards round the pitch; the fields round the shows have a hedgerow now and then and a tree
  in it (a hedge on every other edge read as a maze); robots are drawn a third larger; the road on Elm Street is no
  longer for mowing (the gardens are joined through the gaps in their hedges). Money lands: coins fly from the lawn,
  the bin or the judges' table to the dashboard and the sum counts up only as they arrive (`held` keeps it back, and
  lets it go after six seconds if a change of place swallowed the coins); a full grass box says "full: to the bin!";
  chaff drifts in the first light round the folded box.
  **Round 5.** A third fresh critic, on phone filmstrips after round 4 and two desktop frames, scored 6/5/6/4/5 and 3:
  no higher than the second, on frames that had only gained, the spread *Stills plateau* describes. Several of its
  points came from the capture script (it mows a lawn perfectly in one step, so the cards read 10.0 at once; it
  compares money between separate games). One was right and large: on an upright phone the judges' sheet covered the
  top-left third of the lawn, and with the camera turned a quarter the table, the tent and often the intruder lay
  under it (which is also why the edge badge stayed hidden: the dog was "on screen", under the sheet). On a phone the
  sheet is now a bar at the thumb over the pegboard (the wish across the top, Mown and Stripes side by side, the
  verdict beside the button), the camera frames only what is above it, the edge badge counts the dashboard as off
  screen, the camera stands back further on an upright phone when it keeps the mower and an intruder in view, and the
  rosette is three quarters of its size. The folded box read as a planter, full of the field's standing wheat with
  wheat on its inner walls: once its last flap is up the box is hollow, a dark card floor with a few stalks and
  walls lined with card, the flaps' own wheat no longer drawn. The browser suite caught the sheet's bar being laid out
  while the veil still hid the move to a show (the rules were already there, the view had not built it): the bar
  now follows the place as built. Still open from it: the crop circle is the net of a box rather than a ring (by design: the field was a box), the phone strip
  shows one card and a third.
  **The owner's playtest** (October 2026): they like the box a great deal, all of it (art, play, music, progress).
  They found hedgerows and trees of the country growing through the village church (the meadow placed them without
  knowing where the landmark stands; it now leaves the landmark's ground clear), and roofs that flickered where two
  houses met (z-fighting, see **Drawing without glitches**).
  **The shows, remade** (October 2026, the owner's call after their playtest): "mowing large amounts of lawn is more
  fun than the judges; having to do it more than once holds the fun back; after the first show I would rather have
  escalation in the size of the ground." Each show is now judged once: gold wins it, the judges do not come back, and
  the next show is on the pegboard at once and free (prizes buy machines; a lawn that misses grows back for another
  go at the same wish). There are five, each a good deal larger: the Village Show 22×12, the County Show 48×30, the
  National 76×46, the Racecourse 104×64 (new: the infield, with the home straight between white rails, the winning
  post and a stand with a clock behind it, and a loose racehorse for an intruder) and the Cup Final 124×80, judged once
  before kick-off, after which the match is played on your stripes. Each has one wish (towards the table, along it,
  towards with a lap, along with a lap, towards). A show lawn is mown at .62 of the speed, the engine adds ×1.1 a
  level and the widest gang ×3.4, so the large grounds take mowing, not waiting: the eager bot spends about 2, 6,
  4 and 3 minutes on the last four, the casual one 4, 8 to 13, 5 and 3.5. The bots now wait for a gold estimate
  before calling the judges and for an edged lawn's lap, their patience counts from a lawn nearly mown rather than
  from the show before, and they drive over stripes an intruder scuffed (a scuffed stripe can now be laid again).
  Gold is a little easier on the two largest grounds (.85 and .87). `CORE.version` 3; `migrate` moves a version 2
  save at the cup final to the new fifth show with the racecourse counted as won, and lays every show lawn out again
  at its new size. Round the two largest lawns the rough is drawn as ground, not blades, for phones.
  Found on the way: three times a line comment written into the middle of a line swallowed the code after it, once
  shipping the ride-on mower without its body. The box's suite now refuses a line comment in the view that holds a
  call.
  **Round 6, after the remake** (October 2026): every show was won by hand in a script (the lawn laid right, the
  judges' button and the next card pressed for real) and filmed at 390×844 and 1280×800. Found: on a phone the free
  card for the next show was inserted at the end of the sideways strip, two screens out of sight, while the HUD said
  "the next show is on the pegboard"; a new place's card now scrolls the strip to itself. At the cup the view gave the
  rules' verdict away: the note in the cup came onto the pegboard while the judges were still looking, the
  "Kick-off!" card came before the score cards, and 22 players stood on the pitch the instant gold was decided. Now
  the rosette comes first, the teams walk out of the tunnel to their halves with the camera close, the whistle goes,
  the ball starts from the centre spot, and only then the note (a card for a new place waits for the medal, at the
  cup for the kick-off). The whistle and the note follow the match's own clock, not a timer, so a slow frame cannot
  put the whistle before the teams. The County card's "four times the size" became five. The browser suite plays
  the cup's ceremony through and checks the order.
  Close-ups of all 37 props again: the stadium's were aimed where the old, smaller pitch had been and were moved; the
  farmhouse beyond the wheat was a box with a lid (now walls with a plinth, a stepped roof, a chimney, a door, two lit
  windows); the tunnel was a black block and is now a mouth between white walls under a canopy, tall enough for a
  player (they first walked out with their heads through its roof), and the teams come straight out, round the
  ends of the judges' table and on to their places. On a phone held upright the camera that keeps the mower and an
  intruder in view stood too close by half (the sheep ran along under the money); it now stands back 1.5 times.
  A fresh critic on sixteen frames of the shows (phone and desktop, every ground, an intruder, the walk-out):
  6/6/5/5/5, and 3 for "would pass as a finished commercial game". Fixed from it: mowing took the pitch markings off
  (they were only a tint on the blades, and a mown blade is nearly flat), so the cup's match was played on a pitch
  with no lines; the paint is now on the ground as well. The halfway line had never been drawn at all (an even
  pitch has no cell whose centre is within half a cell of the middle). The rosette at the cup hung over the tunnel
  as the teams came out; it now hangs over the near third of the pitch. The countryside round the grounds was hedge
  fragments that read as a maze (the critic's strongest "procedural" tell); hedges now close round fields: long ones
  run the whole way across, and between each two of them hedges at heights of their own meet them in T-junctions,
  with a gate here and there and the trees grown up in the hedges. Unmown grass far off shimmered like static on a
  phone (a blade smaller than a pixel, dark at the foot and bright at the tip); past 35 units a blade's colour now
  settles toward its mean, so the near lawn keeps its depth.
  Then the venues, which differed by size more than by silhouette: the Racecourse got a whole course round its
  infield (a home straight past the stand, a back straight beyond the near rough, a bend at each end, short turf
  striped across, white running rails either side; the fields keep their hedges off it), the Cup Final a full car
  park on the near side and two terraces of the town beyond the far stand (the street's car is now `car()`, and
  `turnQ` turns what was just drawn a quarter round, so the car park's cars stand nose to the ground). A new ground
  is first seen whole: the camera arrives at 1.7 times the overview, holds it 1.8 seconds, then comes in. The
  judges' sheet is a score sheet on a clipboard (ruled paper, hardboard, a steel clip), its button red, and a ground
  won shows a gold plaque instead of a greyed button.
  The walk-out is staged: the teams come out in two files, stand side by side in front of the tunnel facing the main
  stand with the referee between them, then go to their places, and the whistle goes (`KO`, 6.2 s on the match's
  clock). The "Kick-off!" card was checked by holding its CSS animation mid-way (`getAnimations`, paused when it
  appears), since a headless page does not run CSS animations at speed. `K.debug.boxes()` counts what each place
  draws: the street about 3 300 boxes, the Village Show 6 900, the Racecourse 12 900, the Cup Final 28 100 (most of
  it the crowd; the car park and the town add about 6 500), against about 220 000 blades of grass, which the gauge
  thins on a slow device.
  A second critic on 21 new frames: 6/6/5/5/5 and 3 again. Two of its points came from frames set up by script (a
  kick-off over a lawn the script had not mown, stripes two cells wide that no gang lays); the rest were fixed: the
  pitch has its full markings (goal areas, penalty spots and arcs, a centre spot), the circles are painted round on
  the ground rather than in cells, the goals stand at a real goal's height with a net strung back from them, two
  reds stand over the ball on the centre spot at the kick-off, the fields round the grounds are larger (fewer, longer
  hedges), and the sheep has lumps of fleece, so from above it is not a white box. Still open from it: the largest
  grounds seen whole make the mower a speck on a phone (the camera comes in once you drive); the stadium's stands are
  low; the tilt-shift is strong round the match. Gold at the cup now has its beat: at the whistle the stands throw
  confetti in the teams' colours, most of it from the stand by the tunnel where the camera is (420 cards, none with
  reduced motion).

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
  **The refinement session** (October 2026, rule 16). The owner asked for Tilt to be taken to the bar of a finished
  commercial game, with research rounds between the critic rounds, and lifted the byte cap (rule 2: now 230 KB; it is at
  200 KB). Tools first: `CORE.revisit` (back on the mountain from the shelf, every bulb kept, a whole box to break
  again; tested); `?world=clew&scene=<name>` plays the eager bot (`&bot=`, `&seed=`) until a moment comes up and starts
  there, so every board and moment is reached in a real state of play (first, tree1, reels, fever, lantern, auto,
  nearly1..5, board2..5, end); `K.debug.look/props/snap` give `util/cmv_props.mjs` 28 close-ups (it learnt
  `options.scene`); diagnostic switches for a real phone: `?glow=0` (no shadowBlur at all), `?dpr=1`, `?fx=0` (no
  particles, flashes, shake), `?cache=0` (repaint every still part every frame), `?fps` (frame cost, DPR, canvas size).
  Fresh critics on filmstrips of every station played with real input, phone (390×844) and desktop (1280×800), scored
  first impression, clarity, art, phone, feel and "would pass as commercial": before 6/5/4/6/6 and **3** (desktop
  first impression 4), after round 1 6/4/5/6/6 and 4, after round 2 6/5/5/6/6 and **4** (desktop 5). A close-up critic
  with the checklist under **Drawing without glitches** went through all 28 props after round 2.
  - *Research: the paid games it resembles* (real CR pachinko machines, Peggle, Peglin, Ballionaire, BALL x PIT, Demon's
    Tilt, Pinball FX; October 2026). A machine reads as layers, each shadowing the one below: printed board, brass
    nails, moulded plastic fittings (*yakumono*), chrome rails, glass with streaks. A tulip is a plastic cup with two
    hinged petals that widen the catch; the start pocket sits under the centre display in a fitting of its own. Score
    popups belong to the object that scored and must not drown the board (BALL x PIT is criticised for exactly that).
  - *Research: what gives AI-made games away*: flat primitives with one `shadowBlur` and no material, everything
    glowing equally, unicode or emoji as icons, generic fonts or a serif fallback, text-heavy UI and spreadsheet tags
    ("+5", "×1.2"), identical particles and popups, styles from different games side by side, nothing that moves when
    the player does nothing.
  - *What changed.* Brass nails with a highlight and a shadow (drawn a little larger than they collide, so they read at
    phone size); tulips moulded in each board's plastic under a chrome rim with two screws, petals that swing open and
    shut into a bud, the balls they still take as lamps in the rim; a Big One per board as an object (a riveted gold
    slab with chasing lamps, a safe, a bank, a carton) with a seven-segment counter; prize blocks as objects (acrylic
    prize lamps, pachinko cabinets, vending machines, a night bus, log cabins, ore); the tall machine an art-deco print,
    the parlour a carpet, the street an upright wall of buildings with neon shop signs, the mountain two ranges of
    peaks over snow; reels in a chrome housing under a plate of drawn sevens, drawn symbols, drums that curve and blur;
    every lit word a neon tube (`neon()`: a shadow off the wall, a halo, the coloured glass, a white core); bulbs with
    drawn pictures instead of tags (the open point "U, XL, BIG mean nothing" is closed), named quarters, edges that glow
    towards bulbs out of view, on a phone a card docked above NEXT GAME; a carton at the end whose flaps open and let a
    soft column of light out. A broken Big One is staged on the old board: the last frame stays on the glass, the slab
    is cut out and bursts into pieces that fall and bounce, BIG ONE BROKEN, then the floor gives way and the camera drops
    while the new board comes up, and only then do its name, its tray line and its ring on the sign appear (the rules
    moved on in the step it broke). The end's trip and every such sequence wait in game time (`later`), never
    `setTimeout`. On a desktop the machine plays alone in the middle of a parlour aisle of other machines and the sign
    slides in between games. Popups gather over wider cells, skip what is small against the recent largest, add to a
    live one nearby and stay inside the glass; the Big One's damage is one running sum beside it.
  - *Free resources.* The two faces are Google Fonts under the SIL Open Font License 1.1 (Bungee, Tilt Neon; no
    credit needed on screen). Considered and not used yet: DSEG7 (OFL, a seven-segment face; the box draws its own
    segments instead), Kenney's Casino and Impact sound sets (CC0, "attribution is not required"; the sound was not to
    change character without the owner), Lucide (ISC), Tabler and Phosphor (MIT) icons (line icons look generic beside
    neon; the box draws its own pictures), game-icons.net (CC BY 3.0, needs a credit).
  - *Sound.* Levels measured through an analyser on the box's two gains with real play: peaks 0.34 in fever and 0.20 in
    the tree, nothing near clipping; nothing changed.
  - *Still open*, from the last critics: the "would pass as commercial" score stays at 4 on stills (the critics' spread
    is wide, and the latest named things that were fixed after their frames were shot: the tube lettering, the LED
    ghosts, the board 5 stakes, the lantern); the sign's chains of six identical bulbs still read as a generated node
    graph to a critic (a bulb could change shape along its chain); desktop shows the machine at phone width (the board is
    portrait); the first game still ends after about 15 balls for 25 to 45 coins (rule 15, the owner's call); the coin
    count still leaps between boards; the right-edge camera strip is unexplained; the sound has had no ears on it.
  **The owner's look after it** (October 2026): the first game is fine as it is (kept); a pitch that climbs with every
  pin hit, as in Peggle, would run away when balls strike pins many times a second (not done); mega balls now and then
  hung; opening the next box looked bad and wrong; the street and the mountain could be much nicer.
  - *Mega balls hung, and that had hidden a balance.* A mega ball (6.8 wide) did not fit through the field's gaps (6.8
    on the machines, 6.4 on the mountain): 105 of 115 mega balls dropped over the five boards were shaken loose as
    stuck. Now it ploughs through every pin, bumper, boulder and tulip post (lighting and paying for each pin, losing
    a little speed), grinds through blocks, but only strikes the Big One with a real impact (lying on it, it struck
    twelve times a second). Mended, the eager bot finished in 24 to 27 minutes instead of 42 to 46, every minute of
    it lost after the mega ball is bought; the Big Ones of boards 3 to 5 grew to match (1.4M, 18M, 600M). The suite
    drops a mega ball every four units on every board and wants none stuck.
  - *The way out falls into the box, not into its label.* The shell dives into whatever rectangle `K.complete` is given;
    Tilt gave the whole carton, so the camera flew into its printed front. Now the flaps open, the board darkens, the
    camera rises over the box until one looks straight down into it (four inner walls of card, a floor of light), and
    the dive goes into that floor, which is what the next box's inside looks like too. The rule for any box: hand the
    shell the opening, seen as the dive will see it.
  - *The street* is a stack of night streets seen from the side, as the board is upright: in each, flats over
    shopfronts with striped awnings and neon names, a pavement the lamp posts and vending machines stand on, a wet road
    with the neon mirrored in it on which the bus drives, a kerb and the dark under it; a moon over the top one.
  - *A critic on the two boards alone* (4/10 each) found pins that read as washers and truffles, balls lost on the snow,
    striped flanks, streets cut off with a ruler and a lift drawn as one line. Since: the street's pins are squat
    bollards with a red band, the mountain's dark stakes tapering under a cap of snow, each with its own shadow; a steel
    ball has a dark rim, so it reads on snow; each street strip has a sliver of sky with stars over roofs of their own
    heights (parapets, tanks, aerials), shops with goods in a lit window, a door, a scalloped awning and a lit sign on a
    board, pools of lamp light on the pavement, the signs smeared soft in the wet road; the ranges are faceted peaks, lit
    left and shaded right, the far one hazed; the snow has a lip over the rock, drifts, ski tracks and darkens towards
    the foot; pines stand in clumps; the lift has pylons with crossbars, a sagging cable and chairs; the bus's headlight
    is a fading beam; a ball a tulip shoots up leaves a short fading streak, not a rod.
  - *The mountain* is a mountain face from top to bottom: a band of sky with stars and a moon, two ranges of rock with
    snow on every summit and shade on their right flanks, then snow down to the foot with pines in clumps, a chair lift
    on pylons and a village with lit windows; cabins and ore stand in drifts of their own (drifts in the backdrop were
    left in the air when a cabin broke).
  - *Last round of the session.* Each bulb of a chain now grows a little along it and shows its step as pips, so six
    in a row read as a progression; a new board says why the coins leap ("EVERYTHING HERE PAYS ×2.5"); the strip that
    maps a tall board has grips and, for its first games, DRAG TO LOOK, never at once with the launcher's pill; the
    tray's line is light on a dark slot and a fever drains a gold bar there; the tulip tip is a pill, not body text.
    A last fresh critic scored 7/6/6/7/6 and **4** (desktop first impression 5). Still open from it, most valuable
    first: the sign from board 2 on is a crowd of small bulbs (collapse lit chains into a tube with a level number and
    show only the next bulb large); a desktop is a phone column in an aisle (a two-panel cabinet, or neighbouring
    machines worth looking at); FEVER is a banner and gold balls (a tinted board, the reels turning behind); popups
    still land on the reels; the boards share no material language beyond pins and tulips (the parlour shows nothing
    on its side); the bottom drain tulips are half under the rim on board 1; coins run to billions against a Big One
    of millions. Nobody has heard the sound yet.
  **The owner's play-test before release** (November 2026, `CORE.version` 5). The owner played Tilt to board 4 and noted:
  ordinary balls hung between the nails on the first board; the reels seemed to jump to a random result at the end; prices
  on the sign were hidden by other bulbs when zoomed out; the sign kept gliding back to the middle, so its right side could
  not be looked at; did the twin stream follow the auto-launcher; balls poured from the tray and never seen; from board 3 the
  game grew slow with the sign nearly bought out and the Big One far from broken, and on board 4 there was nothing left to
  save for and nothing to do but tap lanterns. They suggested a goal on the board (light every pin for a big blow) and
  upgrades that go on. Measured first with the bots (eager, seed 1): 19 / 425 / 72 / 366 / 161 balls shaken loose as stuck
  on the five boards; the glass at its cap of 260 balls 40% of the time; the sign bought out 3.2 minutes into an 8-minute
  board 4; at the end of every game from board 2 on, every pin had been struck at least once.
  - *Hanging balls, three causes.* The nails of the ways stood 3.2 apart, so a ball (2.4) lay in the notch between two of
    them, and the first nail left a gap at the wall to wedge in; a mega ball (6.8) was wider than the gap between the wall
    and a *closed* drain tulip (6.6) on boards 4 and 5, and the balls behind it piled up (the old test only dropped mega
    balls past open tulips); and the shake-loose only came after 1.5 s. Now the ways' nails stand closer than half a ball
    with the first one at the wall, a mega ball rolls over a closed dome as over pins, and a ball that has all but stopped for
    a quarter of a second gets the knock a player gives the glass. About twenty a game are left (a crowd on top of a Big One).
    Mending it, as with the mega balls in October, changed the pacing, so the balance below was set after it.
  - *The reels.* The result was rolled when the reels had stopped: the right reel had stopped at 0.8 s on the previous
    result, and at 1.3 s all three swapped to the new one. Now the rules decide as the reels start (the `spin` event carries
    the symbols); each reel runs up, turns at a speed chosen so that an even brake ends a little past its symbol at its stop
    time, and settles back onto it, left to right a quarter of a second apart (the pattern of commercial slot reels: spin,
    eased stop with overshoot, a short settle). On a REACH, as on a real pachinko machine, the first two agree and the third
    drops to a crawl for 1.4 s more (2.2 s since the critic rounds) under a pulsing pink frame and a rising whine before it decides; every win goes through a
    reach, so a reach is a real chance (about one in two). The stops click on game time, not on timers from the spin.
  - *The sign's camera is the player's.* A drag that left no bulb you could buy in view made it glide back to the middle;
    now it stays where it was left, from game to game, may zoom out until the whole wheel fits, is held to the wheel with a
    little give, and CENTRE frames the bulbs again. Prices are drawn last, over every bulb, the one being read first and
    then the cheapest, each trying under, over and beside its bulb and left out where it would cover another tab or bulb.
  - *Seen overflow.* With the glass full and the mega ball bought, what the tray pours goes into the mega ball being saved
    up at the tray's end (a gauge, and balls seen going there); without it the tray says GLASS FULL · WAITING.
  - *Twin stream* now follows the auto-launcher too, as "every ball you pour" promised.
  - *FULL HOUSE.* The owner's idea as such would have been met by itself (every pin is struck sooner or later), so a pin
    glows for a few seconds after a ball strikes it (5.5 · 7.5 · 6 · 4.5 · 5 s by board) and every pin glowing at once is
    FULL HOUSE: a share of the Big One off (2.5% since the critic rounds; the first of a game, each after it less), three seconds of fever,
    and every pin goes dark again. A tube on the top of the rim fills with the share alight; past 85% the dark pins pulse
    pink on the glass and on the map strip, so the thumb goes where the board is still dark. The ways' nails, the tulips'
    posts and the pins in a way's shade (no ball comes there; those pins were taken out) do not count. From the third game
    on, so board 1 has it within its first minutes. The eager bot aims at dark pins (the casual one a little).
  - *Overtime.* Four bulbs between the star's quarters that never run out (balls +5%, afterglow +6%, the Big One +5%,
    coins +10% a level, each level twice the last), opening on board 3 and priced for the board you are on, so coins
    always buy something. A damage bulb's card says what it does against the Big One (the square root of a blow).
  - *Critic rounds after it* (three fresh critics on filmstrips of real play, phone 390×844 and desktop 1280×800, new scenes
    `reach`, `house` and `full`). Phone first impression / clarity / art / phone / feel / commercial: 7/4/7/7/6/5, then
    7/4/6/6/6/5, then 6/4/6/6/5/4; desktop 5/4/6/–/5/4, 4/3/5/–/5/3, 4/3/5/–/4/3: the plateau *Stills plateau* names.
    Fixed between them: banners queue one at a time with their subtitles fitted on a plate (FULL HOUSE goes first, with a
    flash of the glass and its blow over the Big One); a REACH darkens the board and brings the reels half again as large
    and crawls for 2.2 s; reels rest on an unremarkable set; past 85% the lit pins step back, the dark ones turn black with
    a pulsing lime ring (no ball, pin or glow is lime) and lime arrows at the glass's edges count those out of view; the
    meter counts the pins left and says SO CLOSE with a groan when the house slips away; with 96% alight the lit pins hold
    twice as long, so the hunt for the last ones can be won (the critics watched it fail for ten seconds); pins under the
    parlour's ledges were taken out like those in a way's shade; the padlock on the reels says a bulb opens it; THE FLOOR
    GIVES WAY sits on a plate (it could not be read on snow); the sign's labels and tags are at least 11 px and CENTRE
    sits beside the count, clear of the tree. Still open from them, most valuable first (see the owner's second look below for
    what was done since): the first game ends without a loud moment; late boards in fever are a field of gold where balls and lit pins look
    alike; pop-ups print over the Big One's name; the desktop is a phone column among dim cabinets with small type; the
    phone sign's bulbs are small and its card covers the tree's foot; "25 ON THE HOUSE", "POWER" and the №1 box go
    unexplained.
  - *The owner's second look* (November 2026): the arrows' "4 DOWN" and THE FLOOR GIVES WAY ran past their plates (both
    plates now measure their text); on the mountain, cabins and boulders stood in front of the far peaks and seemed to float
    (the two ranges now stand above the field, the slope starts at a tenth of the board, and the first row of things came
    down onto it); and, from the shell, the return's last step had no sign that the box wanted stamping, and the next box
    sometimes showed too early (below, under the reorder). Then the open points, at the owner's word: the first game has its
    loud moment (the first ball into START in the first two games spins the reels once for free, a REACH onto three sevens
    and three seconds of fever, "a free spin: a bulb on the sign keeps the reels"; every one of ten bot starts has it, at 6
    to 13 seconds); a lit pin glows cyan-white, the colour of its tube, so it is not taken for a ball in fever's gold;
    pop-ups rise from above the Big One's name and the reels, not over them; a new FULL HOUSE or BIG ONE BROKEN clears the
    banners in the way; the tray says "25 OF THEM FREE" and "EACH HITS 1,061" (not "ON THE HOUSE" and "POWER"); on a phone the
    sign frames the bulbs above the docked card and never zooms below 0.85, so a bulb stays about 30 px. Then, with the cap
    at 300 KB: on a desktop the aisle either side of the machine holds two cards while it plays (the Big One's counter,
    what this game took off it and LIGHT EVERY PIN on the left; the four cheapest bulbs being saved for, each with how far the
    coins have got, on the right), which fade as the sign slides in; and a phone sign with more to show than fits at a usable
    size frames the cheapest bulb that can be lit, the one its card reads.
  - *Poured balls that were never seen* (the owner, again): with 2,000 balls in the tray, a thumb on the rail poured nothing
    while the tray counted down, because at the glass's cap of 260 the tray fed the mega ball unseen. A cap of 1,200 was
    tried and broke the box: the late games ran three to four minutes (that overflow had been the tray's drain), saves passed
    230 KB, the casual bot took 108 minutes. What stayed: the cap is 400, and at the cap a ball poured still goes in where the
    thumb is, while the lowest ball on the glass (past the Big One, or else a long way under the rail) makes room and counts
    towards the mega ball; only with every ball near the rail does the tray feed the mega ball, and GLASS FULL then shows at
    the thumb and in the tray, never merely because the glass is crowded. Fever's rain does not push balls out, and a
    FULL HOUSE brings fever only for the first two of a game and not after last call (fever lit every pin again and again,
    and a game ran on for minutes after the tray was empty). The reels' housing, grown in a REACH, moves in from the glass's
    edge instead of being cut off by it. Rebalanced (Big Ones 1,500 · 300K · 2.9M · 80M · 2.4B; the street's and the
    mountain's rings cost 1M and 150M a bulb; a FULL HOUSE 1.8% and less for each after the first): eager 41.5–42.2,
    casual 67–75 minutes, longest wait 2.6.
  - *Balance after it* (eager / casual, three seeds): 36.2–43.3 / 63–68 minutes (before: 39–40 / 62–65), longest wait for
    something new 3.0 min; the Big Ones are 1,500 · 260K · 2.3M · 65M · 1.8B, a FULL HOUSE takes 2.5% (the first of a game);
    from board 3 a game takes about 10 to 30% off the Big One.

- **Snow Day** (box 4). **The refinement session** (October 2026, rule 16). The owner asked for Snow Day to be taken to the
  bar of a finished commercial game, with research rounds between the critic rounds, and lifted the byte cap in advance
  (rule 2: now 230 KB). Tools first: `CORE.revisit` (back on the mountain from the shelf with the tree, the coins and your
  side kept, the mountain's gang and the yeti dug in again; tested); `?world=flurry&scene=<name>` plays the eager bot
  (`&bot=`, `&seed=`) until a moment comes and starts there, keeping that moment's events so the view stages it (first,
  tree1, join, yard2..5, won1..4, sledge, dog, cata, crowd, yeti, end; a name with a digit of its own is looked up whole
  first, which Tilt's copy of the parser does not do, so its `tree1` starts a fresh game); `K.debug.look(x, z, s, { y,
  yaw, pitch, freeze, stand, clear, on: 'tree' })` with things to name (`kid3`, `ally0`, `wall`, `dog`, `cata`, `sentry`,
  `sledge`, `yeti`, `present`), 31 close-ups in `K.debug.props`, and `snap()` composites the CSS sky under the canvas;
  switches for a real phone: `?fps` (frame rate, draw calls, DPR, canvas size, antialiasing), `?dpr=1`, `?fx=0` (no
  particles, falling snow, splats or shake), `?film=0` (no grade, vignette or grain), `?aa=0`, `?boil=0`.
  - *A bug was holding up the balance.* A kid knocked down by one snowball could not be hit by the next one already in the
    air: in the eager bot's game 85% of its own throws said "behind cover" or fell in the snow (345 hits in 2,300), and
    most of your side's balls were wasted too. Now a ball lands on a kid who is down (without keeping them down longer)
    and the kid you aimed at is still caught for .3 s after ducking. Both bots then finished in 11 and 29 minutes, so
    the yards' resolve went ×4, ×8, ×12, ×12, ×22 and the tree's tiers ×1, ×4, ×8, ×10, ×10; the catapult winds on 180
    hits instead of 30; "Snowball season" counts your own hits (4,000) and the catapult sticker wants 150 shots. The bots
    now take 35–37 (eager) and 63–66 (casual) minutes, longest wait 3.5 min. In the very first run the gang hits only
    one throw in five, so a stranger has time to find out what a tap does; a run without a coin says how to throw
    instead of "+0".
  - *Fixed on the way:* snowballs in flight when the yeti gave up hung in the air for good (the rules stop at the end;
    they now clear what is in the air, tested); the view's shadows lay flat at one height under a ground that rose and
    fell by half a unit, so they floated over hollows (the yard is now nearly flat where the war is and shadows lie on
    its height); the present was built with its "lid" as a slab at the bottom, so the ribbon and bow flew off with it.
  - *Critics.* Fresh critics on phone filmstrips played with real touch input (first impression, clarity, art, phone,
    feel, and "would pass as commercial"): before 5/4/6/4/5 and **4**; after rounds 1 and 1b 6/4/6/4/4 and **4** (the
    plateau *Stills plateau* describes); desktop after round 1b 5/3/6/4/4 and **4**. Two close-up critics with the
    checklist under **Drawing without glitches** went through 30 and 31 props, after round 1 and after round 2, and
    found the faults the rounds after them fixed. Several of the filmstrip critics' points came from the capture: a
    scene that kept a run's end event (the tree came up behind a "Too cold!" card) and a scene name the parser split
    (`tree1` started a fresh game), both fixed; a software renderer at two frames a second that plays worse than a
    person; stations started from separate saves, so the coins jump between them.
  - *Research: the look* (Rankin/Bass, Kirby's Epic Yarn, Yoshi's Woolly World, Tearaway, Harold Halibut, Animal Logic's
    LEGO Movie). The look comes from flaws in surfaces and mixed real materials (wood, cloth, hair, felt over hard forms),
    not from the frame rate; poses on twos while the camera and projectiles move every frame; a fibrous halo, not a glow.
    *Research: juice and the turn-over* (Juice it or lose it, Time Crisis's crisis flash, Peggle's Extreme Fever, Dragon
    Quest's recruitment): hit-stop on both, squash, a mark left on the target, only shots that will hit marked; a beat when
    an enemy changes sides. *Research: a phone HUD* (RTS and tower-defence practice, Brawl Stars, Vampire Survivors'
    number floods): bars only on what was hit, sums at the target, information at the top and actions at the bottom.
  - *What changed.* Snow is cotton wool (lumps, fluff, a broken-up fuzzy edge; no square glints); felt has fine fibre,
    round pilling and per-object shade; wood has grain and a sheen; ice is faceted crystal with its own material; light
    from below off the snow, contact darkening at the foot, soft shadows cast away from the sun (long in the park's
    sunset, which now has a sun). Spheres are finer. Walls are rolled lumps with no lid and no seam; a snowman cover
    stands whole beside its drift (the owner saw them buried); the hedge is a leafy mass with snow over its edge; the car
    a toy saloon with flush windows and lumps of snow on its roof; the bin ribbed with a lid; boulders are lumps with snow
    in their hollows; the bench has iron ends and slats; houses framed sash windows, a door in a frame, a step; lamps
    glow with a halo. Kids have hair, brows that lift when hit, thumbs and cuffs, a collar and a blanket stitch round the
    hem; snow sticks to their coats as they are worn down; the four leaders have outlines of their own (Rosa's plaits,
    the twins' goggles, Hector's school cap and specs, the Big Kids' earmuffs and height). Biscuit sits with legs, paws
    and felt ears; the sledge's runners curl on struts; the yeti has a brow of fur over a felt face, a nose, a mouth that
    opens and fists. A hit holds the picture 55 ms (100 on a splat) and kicks the camera; a kid who gives up throws felt
    scraps and holds the picture a quarter second. A clump of cotton wool sticks to the lens and slides off. A new yard
    opens on a felt title card while the yard holds still. Words that pop up are felt patches in their meaning's colour,
    three at most; bars show on leaders and for a while after a hit; leaders' names sit over their heads; the gang's
    line carries a strip for how worn down the whole gang is; tutorials are kept in the save (`S.vt`, the view's notes)
    and sit under the yard's name, clear of your side. The run's coins are counted onto its card a tick at a time. The
    tree's baubles are stuffed felt on a thread, smaller on a phone so they no longer overlap, and the hanging hangs on a
    cord from a brass nail on a papered wall. The cards breathe; the present jumps now and then as if something wanted
    out. A wide screen comes in a little.
  - *The way out.* The present is a box with a lid a little wider than it, a ribbon round both and a bow; opened, the lid
    tips back on its far edge, light pours out (added to what is behind, fading to its edge), the camera rises until it
    looks down into the box, and only then does the shell get the box's mouth as the dive will see it (`mouthRect`). Seen
    frame by frame on game time (`gtshots`): the dive lands in box 5's own box. Sequences wait on game time (`later`).
  - *Sound.* In this container's headless Chromium an analyser on the box's gains reads silence, even for a test oscillator
    with the context running; an `OfflineAudioContext` renders without a device, so the box's sound functions were loaded
    into a page of their own and rendered there (`.work/sndtest.html`, not kept). Before the shell's volume: the music
    peaks at −20 dB with an average of −40; a busy moment of effects (a throw, splats, a swat, a hit to you, a kid coming
    over, a boulder) peaked at −2.4 dB, close to clipping. The effects now pass through a limiter of their own (a
    compressor at −9 dB, 12:1, fast, then ×.62 to take back its make-up gain): the same moment peaks at −5.5, twice as
    many sounds at once at −4.2, the average 1 to 2 dB lower. Nothing else changed; the music sits some 14 dB under the
    effects (Keep Off the Grass's owner raised its music 8 dB for the same reason; for Snow Day the owner decides).
  - *Free resources.* Mountains of Christmas is under the **Apache 2.0** licence (not the OFL), Nunito under the OFL; no
    credit needed on screen. Considered and not used: VCSL (CC0; no celesta, but a glockenspiel and sleigh bells), VSCO 2
    CE (CC0), Kenney's impact sounds (CC0); the Sonatina orchestra's celesta is CC Sampling Plus 1.0 (avoid).
  - *Rounds 2 and 3* (from the critics above and a second research round on phone HUDs and a produced feel): bars only on
    leaders and on a kid recently hit, smaller; words that pop up are felt patches in their meaning's colour, three at
    most; leaders' names over their heads, only when they stand; snow caked on a kid's coat by how worn down they are;
    puffs of snow are tufts of wool, not see-through discs, and a snowball darkens where it turns from the light (a
    bright rim made every ball a soap bubble); a yard won is cheered with felt scraps in three volleys on the game's
    clock, with the HUD kept; the yard's name sits on felt and steps back once read; long shadows away from a low sun
    in the park, which has a sun and white snow (its cool shade made it lilac); the phone frames the whole yard (the
    covers stand a tenth nearer the middle in the rules, the puppets a size larger in the view); the desktop tree has a
    card of what can be hung next; the tree is a felt fir with drooping hems on a cord; the run's coins are counted onto
    its card. The browser suite caught a word patch with a negative radius in its first frame.
  - *Round 4* (a third phone critic: 6/4/6/4/5 and **4**). The catapult is a cart behind the middle of your wall, its arm
    drawn back as it winds and swinging up as it fires; a kid coming over shrinks to your side's size on the way rather
    than popping; a run that ends while someone is still walking over waits for them before its card; the coin counter has
    a fixed width so the warmth bar never shrinks; bars stay inside the screen and come up only for your own hits (your
    side's kept every bar up); each yard has a tint of its own light (warm at sunset, cold on the mountain); the yard's
    name is an opaque felt chip that shrinks once read; scarves are thinner (from above they read as beards); the open
    present has walls of felt round a floor of light; the very first run opens on the title card. The suite now refuses
    a line comment in the view that is followed by a statement on the same line: it happened twice in this session.
    Since: kids are built differently (taller, shorter, stockier, slighter by a hash); words never land on the yard's
    name; the warmth bar flashes red and jolts when a snowball gets through, so the loss has a cause. The title card was
    checked by holding its CSS animation along its length (`getAnimations`): it drops, sways, settles and fades.
    A desktop critic on frames taken before round 4: 6/4/7/5/5 and **5** for "would pass as commercial", the first score
    over 4 in this session (the tree screen "the most finished screen"; the battle "a good prototype").
  - *The owner's look after it* (October 2026, on the merged state's predecessor and then the branch). Music is fine as it
    is. Found and fixed: a crouching kid was sunk into the ground (the old way to hide behind a metre of cover), which
    from a phone's high camera read as a kid sitting in the snow; now a kid squats and leans into the cover, feet on the
    snow, head and arms coming down with the body. Brown spots at the kids' temples were side tufts of hair (gone). A kid
    stood right behind the snowman of a snowman cover: the drift now fills the middle where kids crouch and the snowman
    stands at its end. The sledge felt random to hit: a tap had to fall near one point and a nearby snowball took it first;
    now a tap anywhere on the sledge and its rider (with a margin) catches it before anything else, a snowball flies, the
    rider tumbles off over the back and GOT IT! pops up; the rider sits with legs and boots out in front (they had been
    sunk too). The lid of the present opened downward into the box (the sign of its turn at the hinge). The schoolyard
    was slower and the mountain lagged when throwing fast: the session's detail had taken a frame to about 1,200 draws
    and 2.5 million vertices (a sphere was 3,024 vertices, eyes and buttons included). Now spheres are drawn as finely as
    they show (three levels by size over distance), a far kid leaves off its small parts, the backdrop and covers are baked
    once per yard into one buffer (colour and material per vertex, their shadows and lights kept with them), your side
    off the screen is not drawn, and the joint stack and local transforms reuse their matrices, so drawing allocates
    nothing a frame: phone about 600 draws and 0.5 million vertices, desktop on the mountain 570 draws. Asked for: two
    nodes, **Strong arm** (tier 1, your snowballs fly 15% faster a level, four levels) and **Hold to throw** (tier 3: a
    finger kept down goes on throwing at the standing kid nearest it, as fast as the pile allows; the view repeats the
    tap, the rules count each throw). Both bots buy both; pacing 36–37 eager, 63–65 casual. Also: the zip and buttons lay
    off the narrowing coat at the top (now on its surface).
    Then: the hit-stop is gone. Holding the whole picture 55–100 ms on every hit (and longer when a kid came over) was
    meant as juice and read as stutter as soon as snowballs came fast: the bursting snow stood still in the air (the
    owner took it for a frame-rate drop). A hit now kicks the camera a little and the kid squashes, and nothing else
    stops. The two balls on the sledge (brown and glowing gold) meant nothing to the owner: it is a hessian sack tied
    with red string, chocolate coins at its mouth and spilt on the deck, at the back, with the rider at the front. The
    dog's red collar ran through his chest and back; it now goes round his neck, tilted with it, the bell at its front.
  - *Still open.* The "commercial" score stays at 4 on phone stills (5 on desktop), through four critics with frames that only gained; the
    critics now name staging rather than drawing (one puppet model recoloured across five yards, your side half off a
    phone's foot, the modal cards over a yard's big moments). Also from the last critics, not yet done: snowballs without a
    streak; the WINDING/FIRE button unlabelled in the felt HUD; the snow bursts large over the middle of the screen; the
    violet mountain's range is out of a phone's frame during play. The browser suite's two failures at the cup final are
    Keep Off the Grass's and fail without this session's changes. Nobody has played Snow Day on a device yet: for a test,
    `?world=flurry&scene=<name>` reaches any moment, and `?fps`, `?dpr=1`, `?fx=0`, `?film=0`, `?aa=0`, `?boil=0`
    narrow down a fault seen only there. From the last critic: the phone yard is crowded where kids
    gather behind one cover and their bars and labels pile up; kids at the edges of the park and the mountain are cut by
    the screen; your side shows only as hats at the foot of a phone; the win of a yard stays a card in an empty yard; the
    numbers run into the hundreds of millions on the mountain.

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

### Measuring the whole stack (November 2026)

After Unwelcome Guests the owner asked for what the whole anthology needs to shine under a commercial lens. Agreed: no common
thread, no shared mechanics and no shared interface between boxes ("the more different, the better"); everything else was
taken up. Done in that session:

- **A performance budget for every box** (`npm run test:cmv:perf`): each box in a late, full moment on a phone, measured alike
  from outside the box (draw calls a frame for every box; for a 2D box the main thread's work a frame in Chromium's software
  renderer). Measured then: Starter 1,537 draws and 22 ms, Keep Off the Grass 8 draws, Tilt 412 and 7 ms, Snow Day 1,071
  draws, Here Be Rabbits 918 and 18 ms, Unwelcome Guests 84 and 15 ms. The budgets are those and about a third more, so a box
  may not quietly get slower. Starter and Snow Day draw over a thousand times a frame, which Firefox on Android pays for one by
  one: the next candidates for a pass.
- **A newcomer bot** (`bots.novice`, the `novice` suite): the eager and casual bots earn faster than a person new to a box, so a
  steep start hides from them. A box that brings one must give a newcomer something new within two minutes and six new things
  in ten. Unwelcome Guests has one; the other boxes should get theirs in their next pass.
- **Notes from real players**: the packing slip of every box has *A note on this box* (one to five stars, where it dragged,
  what was liked), kept with the save; the shell quietly keeps how long the first new thing took and at what progress a player
  left the box. *Copy all notes* gives it all as plain text to hand to the session that works on a box.
- **Touch targets of 44 px**: measured on a 390 px phone, every control of every box; the shell's menu button (42 px),
  Starter's peek (30 px, now a larger invisible hit area round the same disc) and Here Be Rabbits' *Auto* (30 px high) were
  short and are mended.
- **Keep Off the Grass's cup in software GL**: the browser suite's kick-off checks wait up to two minutes of real time, and in
  this container's SwiftShader the cup pitch draws about one frame in four seconds (the same before this session), so they
  can fail here while passing on a GPU. A run that fails only those two is not a regression; the cup pitch's draw cost is
  worth a look in Keep Off the Grass's next pass.

Left for later, each too large for one session: a German translation (per box, text lives in cores and views alike), a
keyboard and text-size pass per box, the big-lever pass with public-domain sources for the boxes that have none, draw-call
passes for Starter and Snow Day, loudness levelled across the boxes, and a first impression (trailer, title screen) that
sells the anthology in ten seconds.

### Worth Its Salt (draft, November 2026)

The owner wanted an incremental in a 3D world that is walked freely, with no run timer, and leaned towards a classic
(fishing, mining). A research round over the walkable incrementals the owner plays and their neighbours (Berry Bury
Berry, Sip Fisher, How to Fish, A Game About Digging a Hole, Cast n Chill) found the same shape in all of them: **one
place that changes visibly** (the lake drains, the hole deepens, walls come down) rather than new places; no clock, the
limit is the gear; walking is the cost and the upgrades shorten it (Sip Fisher's later walks to the shop are its most
common complaint); a verb that is good before any upgrade; an absurd or uncanny thread under a cosy surface; a short
game with a real ending (abrupt endings are what Digging a Hole and Keep on Mining are blamed for).

The owner chose a salt mine whose wall becomes a chapel, after Wieliczka, and asked whether it could look right. The
answer the prototype tests: **the carving already waits in the rock.** `CORE.relief(x, y)` is a designed altar wall
(dado, fluted pilasters with capitals, a frieze of rosettes, a scallop-shell niche, St Kinga on a pedestal, the miners'
crossed hammer and pick in a medallion), and every blow only takes rock off down to it, so the end is as good as the
design and never depends on where the player struck. The rules keep a grid of cells (7.5 cm) with the depth each is cut
to; the view draws `max(rough face, min(carving, cut))` into a 920-wide half-float heightfield with a cubic B-spline over
the cells (bilinear showed every cell's edge), chisel grooves on the cut, crystalline facets on the rough face (rock salt
breaks along cubes), and bedding that runs on through the carving. The **mason's chalk** on the rough face, drawn where
the carving steps, shows from the first second where the figure waits and where to strike (rule 10).

Light: the lantern is held low and to the right and a miner's lamp stands by the wall, so the relief is raked rather
than lit from the eye. A first-person pick built from boxes looked like a stepped black bar and was taken out; a tool in
the hand needs to be modelled properly or left away. Pacing (prototype tuning): eager 31 to 33 min, casual 66 to 72.
Still to come before it is a box: automation (helpers or a cart), walking that matters (the cart, a lift), music, the way
out (a casket in the pedestal with the next number), a proper pick, stickers, a critic round.

**Dropped** (the owner, the same day): progress felt slow and stodgy, striking the wall over and over was tedious on a
phone, and the result still had faults. The lesson: a verb that is one tap repeated thousands of times needs a
strong answer per tap and a fast early curve, and a prototype of a verb should be judged in the hand before its look is
polished. The draft was taken out of the page; the commit that added it is
`940774956afd8dbe9912b284167152a8fe99d875`. In its place the owner asked for a fishing game at one idyllic jetty in a
very green landscape, with a catch mechanic that scales with upgrades so later fish come quicker and easier.

### Box 7: Still Water (draft, then shipped, November 2026)

The jetty the owner asked for, as a first-person prototype to try the catch in the hand before anything is polished
(`?world=jetty`). One wooden jetty on a lake in a green bowl of hills: broadleaves, pines, willows, reeds with bulrushes,
lilies, a meadow; the water mirrors it all (a half-size reflection pass) and rings where the float lands or a fish runs.
The day turns on its own (eight minutes: dawn, day, a gold dusk, night with fireflies and stars), with showers now and
then; there is no run timer anywhere.

The catch, in the rules: swipe up to cast (the length of the swipe is the distance); the float waits and goes under;
a tap in that moment strikes; then the fight: holding winds the fish in and loads the line, letting go gives it line;
a fish runs and rests and tires, and a line loaded past its strength for longer than the rod can soak up snaps. Every
part of it scales with the tackle, as the owner asked, so later fish come quicker and easier: sharper hooks widen the
strike's moment, a stronger line and a longer rod raise what a run can do before it snaps, a faster reel shortens the
fight, better bait brings bites sooner and rarer fish, a longer jetty reaches the deep, a lantern opens the night, a
second rod rings its bell when it has caught (walk over and take it), a smokehouse pays more, and the reel brake gives
line by itself before the line breaks. Fish: ten kinds by distance, hour and bait, each drawn for the logbook in ink and
wash by the view; when the book is full and the jetty long, the Old One takes the bait in the deep with the next box in
its jaw. Pacing (prototype tuning): eager 32 to 49 min, casual 34 to 41.

The first build ran its sky, wind and water on `K.loop`'s second argument, which is the page's clock in milliseconds,
not seconds: the owner saw clouds race and trees shiver at a thousand times their pace. A view keeps its own clock
(`now += dt`), which also stops with the box when it is paused.

The owner then could not land a single fish: the line always snapped. A person strikes and keeps the finger down, so
the reel winds against the first run, and with the first tackle a perch loaded the line past its strength and snapped
it in 0.4 s, quicker than anyone sees the bar and lets go. Measured with two people in the rules (one who always holds,
one who lets go half a second after the line passes 90 %), both lost every perch. Now the reel loads the line less, an
overloaded line holds for 1.1 s times the rod's soak (2.5 times that for the first three fish), and the line creaks, the
phone buzzes and the hint says *Red! Let go!*. After three fish the one who always holds lands every roach and about
half the perch, the late one four in five: holding through works at first, letting go is learned from the perch.
`node util/jetty/naive.mjs [fish caught]` is the measure; the bots never showed it, because they let go at once. The owner
then found the line could not snap at all after the first few upgrades: the fight must stay a fight for the later fish.

Still open: the owner's verdict on the catch; music (ask first); a proper look pass (the trees are lumps of spheres,
the rod a ribbon); the second rod's bell needs the walk to matter; stickers; critics.

**The refinement session** (November 2026, rule 16), which took the draft into the stack as box 7.
- *Research: how the paid fishing games keep a fight a fight.* Webfishing scales its reel by the fish's difficulty, size and
  quality (a size multiplier of 0.7 to 1.8 and a flat step per quality tier), so a better rod never makes every fish trivial;
  Dredge gives every kind of water and fish its own minigame and makes the gear faster, not the game different; Cast n Chill
  lets a fish run past the line's length until the line is upgraded, and loses a fish off the hook rather than with the line;
  Stardew's bar moves differently per fish (darting, sinking, floating). What they share: the fish grows to meet the tackle,
  and each kind fights its own way. Players of Sip Fisher complain most about walking the same way again and again.
- *The fight, remade in the rules* (the owner chose leaning plus a way per kind): holding winds in and loads the line, letting
  go gives line; sliding the held finger leans the rod: against a run it takes the strain on the rod's side (the line carries
  up to 40 % less and the fish tires and turns sooner), with the run it carries more. Every kind has a way (`WAY` in the core):
  roach and rudd short runs, perch darts, tench and carp run for the lilies (a fish past `COVER` metres to the side is caught in
  them and lost in three seconds unless led out by leaning the other way), bream heavy, pike rise (a swirl, then a leap: held
  through, the hook is thrown), zander zigzag, the wels sulks on the bottom (only hold, let go, hold lifts it, holding on
  loads the line more and more), eels zigzag for the roots at night, the Old One does all of it. Weights spread to *big*,
  *specimen* and *trophy*, and pull grows with weight, so a trophy roach fights like a perch. Pulls are set against the
  tackle each kind is met with in the eager bot's game. The reel brake no longer stops every snap: it softens the load past
  90 % and lets line out. The bank rod sits in the reeds left of the jetty; when something has hooked itself its bell rings
  and it stays on 28 seconds (45 with the bite alarm); walking there (along the bank, or the boardwalk from the second level)
  brings the line on the jetty in, and the fish is played by hand. A night without a lantern passes six times as fast while
  the angler dozes on the bench. A kind not yet in the book bites two and a half times as readily, so the book never stalls on
  luck. Milestones count a new size per kind and a notch every twenty fish.
- *Measured with people, not bots* (`node util/jetty/naive.mjs`, 100 fights each, at the meeting tackle): someone who only
  holds lands 0 to 20 % of every kind from the tench on (the perch 20 %, the roach about three in four); someone who lets go
  0.6 s late but never leans lands the open-water kinds and loses carp and the Old One to the lilies (10 to 17 %); the same
  person leaning lands nearly all but the wels and the Old One (two in three); a quick hand lands nearly all, with the line
  above 85 % for a fifth to a third of the fight. Three purchases later the late hand's carp is still only 17 %: leaning is
  the skill, not the tackle. The box's suite holds the lines.
- *Pacing* (three seeds): eager 39.6 to 49.5 min, casual 40.4 to 45.3, the longest wait 3.4 min; the casual bot's first fish
  in about 15 s pays for the first hook. Both bots earn two or three stickers (the whole book, the Old One first time, often a
  trophy); *Out of the lilies* (lead five back out) and *Night shift* (forty at night) want a purpose.
- *The look, rebuilt* (every limit lifted, rule 2). Crowns are leaf cards cut from a painted atlas (clumps of broad leaves on
  twigs, willow strands, pine boughs, grass and reed blades), turned outward over clumps on real limbs, their normals bent
  out from the crown's centre and darker inside it; undergrowth closes the woods' edge; trees grow in stands by a noise, not
  evenly. The sun casts a shadow map over the near lake and banks, refreshed every twenty frames. The lake bed is baked into
  a texture, so the water is clear and brown in the shallows, dark green in the deep, with a pale wet line at the edge and a
  sun glitter that fades at your feet. The rod is a solid: tapered cane with whipped rings, a cork grip, a reel whose handle
  turns while it winds. Fish are the logbook's painting wrapped round a body lofted from the same outline, with the fins and
  tail as a cut-out card through it: dark under the water while they fight, in the air when they jump, hanging on the line
  in front of you when landed. A jetty with posts and cross-braces, a bench, a mooring post with a notch for every twenty
  fish, a lantern on a bracket, the smokehouse with plank walls and a shingled roof, the boardwalk.
- *The way out*: the Old One lands with a tobacco tin wired to its jaw, the next number on its lid; a tap lifts the lid on the
  card, light comes out on the box's own clock, and the shell dives into the tin's mouth. `revisit` brings a finished jetty
  back with the book and tackle, and the Old One takes the bait again.
- *Tools*: `?world=jetty&scene=` `min<n>` (the eager bot's game), `fight:<kind>`, `jump`, `land:<kind>`, `night`, `dark`,
  `bell`, `old`, `pods`, `garland`, `garland:landed`; `?tod=0..1`, `?rain=0|1`, `?fps`, `?dpr=1`, `?fx=0`, `?refl=0`, `?shadow=0`, `?a2c=1` (leaves through alpha to coverage,
  which dithered in the software renderer); `K.debug.look(x, z, yaw, pitch)`, `tod(u)`, `snap()` (renders, then reads the canvas).
- *Controls*: a mouse looks the way it moves; so does a finger (it first dragged the world as on a map, which the owner found inverted on both axes). The owner found the mouse's up and down inverted.
  Then, at the owner's wish, the first click with a mouse takes the pointer (pointer lock) and puts the whole page in full
  screen (the parent's document, so the shell's menu stays): the mouse looks without dragging, a held click winds up a cast
  and throws on release (the view turns to the lake if it faced away), a click strikes, a held click reels and moving the
  mouse sideways leans the rod, a short click walks to the boards under the dot in the middle; E goes to the bank rod, L
  opens the logbook, Esc frees the mouse for the tackle cards. The pointer must be asked for before full screen: the full
  screen request uses up the click's activation, and the lock is then refused.
- *Critic rounds* (fresh critics on twelve phone frames of every moment, scored first impression, clarity, art direction, phone,
  feel and "would pass as commercial"): 7/6/6/5/5 and **5**, then 7/6/6/6/4 and **5**. Fixed after the first: the sun's
  reflection was a smooth white disc at the angler's feet (it breaks into glitter now, faded near the eye, and the moon lays
  a path at night); the lantern was a box cut off at the screen's edge (a hurricane lamp on a hook, below the eye); the
  rod stayed straight (it bends half as much again); the logbook lay under the tackle cards and had no close button; the
  strip of cards gave no sign it scrolls; the tension bar had no words; the Old One's tin sat on its belly (it hangs from the
  jaw on a wire); every fish was one outline recoloured (bream deep, tench round-tailed and thick at the tail, rudd high-
  backed, an eel's fin all round with a pectoral fin and a bigger eye, whiskers that taper). After the second: the night was
  black (moonlight now lights the jetty and the banks), the frame showed sky more than jetty (the view tilts down), the
  fish under the water was too deep to see on a run (it rolls just under the surface, and a sulk sends up silt bubbles), the
  line hums near breaking and the rod kicks in the hands, the bank rod's bell no longer pops up over a fight.
  Still open, from both critics: the fight shows less in a still than in play (a jump between frames, a wake that moves);
  the painted fish and the photographic lake are two styles (a paper frame round the catch card helps, a painterly pass on
  the water would close it); no hands on the rod (a hand drawn from primitives would be worse than none: rule 16 says take a
  licensed one, or leave it); the shell's №7 chip is the shell's, not the box's.
- *The owner's look after it* (November 2026): the right direction, and seven points left for the next session. (1) Reeds and
  trees look broken: crowns grow darker toward their rim and grass toward its tips (the atlas's transparent texels are black,
  and mipmapping bleeds them into every edge: bleed the colours out into the transparent texels or premultiply), the willows
  read as rectangular curtains under bare arcs, the bulrush heads float apart from their stalks (a tube's first ring sways 0
  and its last fully, so a head built on a stalk's tip does not move with it); take real tree models and photographs as the
  reference. (2) The water should be measured against the best three.js water examples. (3) No way to run. (4) The rain shows
  single drops; it needs streaks, rings and a darker, misty light. (5) No way to reel in a line cast by mistake (the rules
  have `reelin`; the view gives it no gesture). (6) The jetty's posts are hollow tubes (no caps). (7) The late game should
  escalate: more lines at once, up to ten baits in the water, the fight perhaps left to the small fish by then.
- *Performance*: 32 draw calls a frame late in the game (the perf suite's budget is 45). In the software renderer the trees cost
  86 % of a frame, mostly the far woods seen edge on, layer behind layer; beyond 48 m they use fewer, larger cards and every
  other tree, the slopes carry a painted canopy, and a phone frame went from 2.6 to 1.4 s there. Nobody has measured it on a
  real phone yet; `?fps`, `?dpr=1`, `?refl=0`, `?shadow=0` and `?hide=oak,pine,…` narrow down a slow device. The guitar has
  had no ears on it either.
- *Loading in the test browser*: a desktop page took 18 to 20 seconds to fire `load` because the shell's own fonts from
  fonts.gstatic.com came slowly through the session's proxy; the box built in about 150 ms. The browser suite's 30-second
  `goto` can fail on that, not on the box. The box now draws its first heavy frame only after the page has loaded.

**The second refinement session** (November 2026, the owner's seven points).
- *Foliage.* The atlas goes up premultiplied and the shader divides the alpha back out, so the black of the clear texels no
  longer bleeds into every rim through the mipmaps (crowns no longer darken outward, blades no longer toward their tips); with
  the black gone the grass tips were straw-yellow and are now a dry olive, the pines darker. The oak tile's twigs began below
  its leaves and stuck out of every card as a fan of black spikes; they now stay inside the leaf mass. The willow is rebuilt
  from how a weeping willow grows (a short trunk, five limbs that climb and arch over, unbranched hanging shoots all along
  them, longest at the outer end, so the curtain is a rounded dome down to the grass; narrow cards with ragged lower ends;
  shoots draped over the top of every limb so no bare bow shows). `tube()` takes the sway at its start (`s0`), so a bulrush
  head built on a stalk's tip sways with it, and caps (`caps`: 1 start, 2 end), so posts are solid. It also ignored the first
  element of its material vector: the float's red tip and white band and every bit of brass had never shown.
- *Water* (the owner chose the techniques of three.js's Water and Water2 in the box's own renderer over a port). A tileable
  field of slopes baked at start from sine waves with whole-number wave vectors, sampled in three layers that drift apart; a
  breeze that ruffles the water in patches (cat's paws) and leaves calm lanes; refraction from a copy of the frame taken
  before the water is drawn (a `blitFramebuffer`, not a draw call); Schlick's fresnel with water's 0.02; sun glints only off
  the steep sides of ripples; foam broken by noise at the bank and round every post, with a ring round each post.
- *The canvas's alpha.* Cut-out edges and blended lines wrote an alpha below 1, which a page shows as a pale fringe round every
  leaf (white "snow" on the trees in rain). The frame now writes colour only after its clear.
- *Rain* (the owner: single drops). Streaks, as Tatarchuk's ATI rain work and every game since: one instanced draw of thin
  quads placed by a hash of their number in a box that stays put in the world, falling on the shader's clock, brighter against
  the light; two layers of ring cells in the water's slopes; the light greys and dims, the haze thickens with the shower
  (`uMist`), shadows fade, and all of it eases in and out over seconds (`rainA`), never at a switch; the sound is a bright
  hiss over a dull body with single plinks on the water and taps on the boards; splashes jump off the boards round you.
  `?rain=1` holds a shower for captures.
- *Running and reeling in.* Shift runs; a second tap or click on the spot you are walking to runs there (a tip says so once
  on the first long walk); walking slides along an edge rather than stopping dead. A line out by mistake comes back with the
  *Reel in* card (bottom right while the float is out), a swipe down, R, or the right button with the mouse taken; the float
  skims home across the water and rises to the tip.
- *Escalation* (the owner chose rods on rests with bite alarms out of rests, a paternoster, and a feeder swim with a whip).
  *Rod on a rest* (8 levels) sets another rod on the end's rails, alternately left and right, lines fanned out over the water;
  each bites on its own clock (11 times the hand's mean wait), a fish takes it and runs, the alarm sounds in the rod's own pitch
  and its LED flashes, the hanger snaps up, and the hand picks it up (tap the rod, the card, or its number) and plays it;
  thirty seconds untaken and it is off. *Self-hooking rigs* (3 levels) let a fish whose pull the rig can hold (0.9, 1.7, 2.7)
  hook itself; the rest winds it into a keepnet hung off the end, a price tag rises off the rod, and it is paid and written in
  the book. With the hand rod and the bank rod that is ten lines. The Old One now comes to a lake full of lines (every rest
  out) and may take a rest's bait, its run unlike any other. Version 2 of the rules; `migrate` adds the rests to an old save.
- *Measured.* The first build stalled the eager bot past 150 minutes: it took every alarm, so its own line never went out
  again, it never shopped (it shopped only when idle) and the Old One, then only on the hand's line, never came. Counted by
  cause with a log of the bot's game (`hookedH` stuck at 49 after minute 35). Now the bots shop between fights, the rests
  bite half as often, the Old One can come on a rest. Pacing: eager 45.8 to 47.8 min, casual 49.7 to 54.7, the longest wait
  3.6 min; the rests come from minute 14 and the eighth just before the end. The people in the rules (`naive.mjs`) are where
  they were: holding alone loses nearly everything from the tench on, leaning is the skill. Draws: 35 a frame (budget 45).
- *Critic round 1* (fifteen phone frames and close-ups): 6/6/5/6/4 and **4**. Fixed: the fight showed nothing in the world (a
  wake now opens behind a running fish at Kelvin's angle, from the fish's own motion, with a boil where the line goes in); the
  rod stood straight in a fight unless the finger was down (a rod with a fish on is always loaded); floats far out were specks
  (they keep a size the eye can find); grass and reeds glowed like lamps and stood like wallpaper (less light through blades,
  darker, tufts of every size, a quarter sun-dried); the lantern at the end was a cut-off blob at a phone's left edge (it hangs
  behind where you stand to cast); pale smears on the water near the rests (every running rest set a ring nearly every frame,
  and the refraction followed their steep slopes: rings now come at a pace, the refraction's bend is bounded); which rod was
  running could not be told (a numbered ring in the rod's colour over its alarm, or at the screen's edge pointing the way, and
  a bell for the bank rod); the shop strip kept spent cards in front (they go to its end); dozing was only a sentence (the lids
  come down from above and below); the rain was thin and the boards stayed dry (denser streaks, wet dark shining boards).
  Still open from it: no hands on the rod (rule 16: a licensed model or none), the landed fish read as a cut-out to the critic,
  the logbook's fish too alike, dusk without a low sun on the water, the boards' texture smeared.
- *Critic round 2*: 6/6/4/5/5 and **3** (critics differ by a point or two from round to round on the same frames). Fixed: clouds
  lit white at night (a cloud is a darker shape against the stars), the same cloud in the same place in every frame (the sky
  drifts with the game's clock, a day's worth of drift between one dawn and the next, never a jump), floats still specks far out
  (larger with distance), the mooring post a cut-off block at a phone's left edge (you start just past it). Still open, and
  now the largest: the painted, outlined fish (card, logbook, the landed fish in 3D) against the lit lake read as two games; the
  logbook's kinds too alike in outline; the jetty's boards plain at a phone's size; the shop strip and the parchment cards
  cover the lower fifth and read as a template to the critic (a tackle-box drawer would clear it); dusk without a low sun's
  path on the water; no hands.
- *The guitar, heard at last by someone*: `K.debug.music(seconds, hour)` renders the box's own music code into an
  OfflineAudioContext and returns a WAV; measured, the day plays at about -17 dB with no gaps, the night is harmonics over
  silence.

**The third look** (November 2026, the owner after playing: "many fish on one rod would satisfy more than working many rods").
- *The paternoster* (the owner chose a garland that fights at once, and rests that fish alone). `pater` (9 levels) puts more
  hooks on droppers along the hand's line, up to ten. While a fish is on and still out past three metres, the commotion draws
  others to the free hooks (`joinRate`, more with better bait); each runs and rests its own way, pulls on the same line and
  tires, a garland reels in a little slower, and the line holds or snaps for all of them. A jumper that throws its hook leaves
  the rest on, the strongest leading. The garland is landed, booked and paid together; it hangs before you on its droppers, the
  card says "A garland of 7" with every kind and the sum, and a run up the scale plays one note per fish. Under the water the
  others follow the lead as dark shapes (a pale belly at half darkness read as a ghost). The Old One now waits for the full
  paternoster and never joins a garland. Measured with people in the rules at the 4th, 7th and 10th hook: someone who only
  holds lands 63 to 83 % of garlands, the one who leans every one, about eight or nine fish a garland at ten hooks, fifteen
  seconds a fight. Pacing: eager 38.5 to 48.7 min, casual 45.6 to 50.4, the longest wait 3.6.
- *The rests fish alone*: no alarms to answer; what the rig can hold (0.9, 1.8, 2.8, anything) is wound into the keepnet,
  anything stronger runs and is off. Version 3 of the rules; `migrate` clears an old save's alarms.
- *Softer guitar*: the pluck is a fingertip's (noise smoothed twice), a three-tap average in the string's loop takes the high
  overtones down sooner, a slower onset, the tone cut at 2.3 kHz, more room, a lighter thumb. Measured on the offline render:
  the spectral centroid fell from about 2200 Hz to 1050, the energy above 2 kHz from 12 % to 1 %, the strings within 7 cents.
- *Trees, again*: a broadleaf is grown as an oak or an ash grows: a short, stout trunk flaring into its roots, limbs leaving at
  different heights and forking once, twenty-odd clumps of smaller cards over an uneven dome (a cloud of clouds, not a ball),
  each clump its own shade, dark beneath and inside. Cards seen edge-on fade out (their true face normal from `dFdx`/`dFdy`)
  instead of standing as slivers; bark has long furrows between plates and moss low down; twice the undergrowth closes the
  woods so no colonnade of stems shows under far crowns.

**A graphics pass** (November 2026, before the owner's next look).
- *Fish as field-guide plates*: the outlined, cel-filled fish were the critics' plainest giveaway. `drawFish` now paints volume
  (a soft rim shade blurred inside the body, light along the upper flank, shade under the belly), scales as glints of light
  on their rims at random strength, see-through fins with their rays and a lighter edge, sitting where each kind has them
  (`FINS`: the perch's and zander's spiny first dorsal, the pike's far back, the bream's long anal fin, the carp's long dorsal,
  the tench's rounded fins, the wels's long fin beneath), a gill cover with a soft shadow, an iris with a pupil and a glint, and
  a fine edge in the body's own dark instead of black ink. The eel tapers to its tail inside a narrow fin fringe. A deep fish is
  drawn smaller on its plate so its fins stay on it. The same painting wraps the 3D fish, so the lake's fish changed with it.
  `K.debug.fishArt(kind)` returns one plate.
- *The jetty*: grain along every board and up every post (in world space), knots bending it, tops weathered silver, two nail
  heads over each stringer; the shadow's normal bias doubled (striped acne on round posts).
- *Light*: a low sun lays a broad gold path over the ripples; the sun's reflection near you breaks into sparks (a high sun's
  reflection on the smooth near water read as a pale smear on the lens; three critics saw it, found by switching the water's
  terms off one at a time); shadows show on water only faintly; in the dark colours fade to blue-grey (`tone()`), so the night
  is moonlit, not green.
- *Plants*: greener, darker reeds and grass; bulrushes each with their own head; a second, taller pine and pines from 0.7 to 1.45
  in size; a quieter willow; lily pads green, not black far out.
- *Critic round 3* (graphics only): 5/4/5 and **3**. Still open from it: the HUD's parchment cards read as web UI to the critic,
  hints over the water, the shore a hard seam with no muddy bank, the rope round the mooring post a stack of beads.
- Draws: 38 a frame (budget 45) with the second pine.

**The owner's fourth look** (November 2026) and what it found.
- *The garland's lines* did not meet: the extra fish hung by their middle and their droppers left the main line high up near
  the tip. A paternoster's droppers sit at even steps on the main line just above the lead, short, each fish by its mouth.
  Lifted, the garland hangs upright as a paternoster does (the line from the rod's tip to the top of a short run, droppers left
  and right in turn, the lead at the bottom): along the slanting line to the tip, the topmost fish came at the eye.
- *Wood that looked wrong everywhere*: the grain was laid in world coordinates, so it ran right only on boards lying across the
  jetty; on the bench, its legs and every beam it ran across the piece as zebra stripes, too strong and fine enough to shimmer.
  `cuboid()` now gives wood u along its longest side and v across it, in metres, offset per piece; round wood (`tube()` with
  material 0) takes v round its girth in metres; the shader lays long streaks, fine lines that fade before they would alias
  (`fwidth`), and a knot now and then.
- *Stars* were raster cells switched on whole (little squares, blinking as one). Each is now a point at its own place in its
  cell, about a pixel across and anti-aliased, faint to bright on a power law, warm to blue, a quiet twinkle, and a faint
  Milky Way.
- *Crowns that came off their wood in the wind*: the shader moves a vertex by its sway times its height, and leaf cards, limbs
  and trunks each had sways of their own. A tree now has one sway field read by every part (`stube()` for its tubes); a willow's
  hanging shoot starts with the limb's movement at its top and swings more below.
- *A wake that flipped*: its V followed the smoothed velocity's direction, so a fish turning about turned it at once. The V now
  turns at most 1.2 radians a second, and while the fish swims against it the old wake dies away before a new one builds.
- *Fish that gaped*: the lofted body ended open at the root of the tail card, hollow inside; from behind it read as two flanks
  pulling apart. The body is closed there.
- *The tackle hut* (the owner: a little shop, no shopkeeper). The strip of tackle cards along the bottom is gone; the screen is
  the lake's. A board hut stands on the meadow by the path: an open window with its shutter propped over a counter, rods for
  sale leaning inside, a shingled roof, a sign with one of the box's own fish. Tapping it, or *Tackle* by the logbook (T on a
  keyboard), walks you there at a run (a line out comes in) and opens it: paper tags on brass pegs on a board wall, each
  thing drawn small in the fish's ink and wash (`drawIcon`), its levels and its price; what is as good as it gets hangs at the
  end. The button counts what you can afford; once a first fish is in and the cast is learnt, a hint says where to buy.
  `K.debug.openShop()`.
- Draws: 39 a frame (budget 45) with the sign's fish.

**Wood from photographs** (November 2026, the owner: the wood still did not convince; look for reference). Procedural grain kept
reading as stripes, so the box now carries two small CC0 photographs from Poly Haven, as rule 16 allows: three weathered boards
cut from Rob Tuytel's *Brown Planks 03* (gaps trimmed, side by side, a metre long, 192×512, 17 KB) and Dimitrios Savva's *Bark
Willow* (processed by Dario Barresi; 256×256, 7.5 KB), both as JPEG data in the template (`PHOTO`), loaded into textures on
start. Every piece of wood takes one of the three boards (`vY.y`), laid along its length and mirrored across so no seam shows;
round wood takes whole periods round its girth; the photograph is stretched to 2.2 m so a wall of boards shows no grid; sawn
tops of posts draw rings round the heart instead of a smear of one texel row. Trunks wear the bark, greyed toward an oak's,
twice round and a metre up. The rope round the mooring post is a helix three turns round, its end hanging (it was a stack of
beads). Then the leaves, the same way: three oak leaves, three willow leaves and a conifer's sprig from ambientCG's CC0 *Leaf
Set 016, 013* and *019*, cut out by their opacity maps and packed into one 192×128 WebP with alpha (8 KB). The atlas is
painted at once as before, and when the photograph has decoded its first three tiles are painted again with it: each leaf in
four lights, oak leaves pointing out round a clump, willow leaves along the strands, sprigs fanned along a pine's drooping
bough; then the atlas is uploaded again. The roofs are split shingles cut from the same wood photograph, row on row. A
photographed leaf has many holes smaller than a pixel far off, which sparkled as a distant crown's alpha thinned in the
mipmaps; the cut-out's threshold now lifts more with distance. The box weighs 286 KB of its 300.

- *Critic round 4* (graphics, after the photographs): 6/6, wood 4, foliage 3, and **4**. Fixed from it: the moon stood behind the
  angler and was never seen (it rises ahead and to the left, where its light comes from, and lays its path on the water); the
  bench was four blocks (slats with gaps, a rail under the seat); every deck board one width with its ends in a line (widths and
  lengths vary, the odd board a shade off); posts clean to the water (a slick of algae where it laps them); the hut's gable an
  open black triangle (boarded, board by board); willows a curtain with a straight hem (five narrow shoots a point, every
  length); the garland hidden behind a phone's catch card (it hangs above it); fish out of the water black against the sun
  (a fill from the sky and the lake on the near flank). Still open: trees without a branch skeleton up into the crown, grass
  tufts that read as starfish from above, reeds in an even comb, the rope.

- *Polish after round 4.* Reeds grow in clumps of two to five stools, each its own height, the odd one dry and pale (they stood
  in an even comb). A grass tuft is five blades at odds with each other, turned, set off the root and leaning each its own way:
  three crossed cards were a starfish from above, and a symmetric ring of leaning cards a pentagon. Every clump of a broadleaf's
  dome is held by a branch from the nearest limb, so wood reaches through the whole crown. The rope round the mooring post shows
  its three strands laid in a twist (rope's u starts at 5, so the shader tells it from a cork grip). A band of wet mud, darker and
  shining a little, runs just above the water along every bank. The rod's material was meant to whip it in red here and there,
  but `tube()` handed it the angle round the blank instead, so one side of the rod was red all along it (the critics' "orange
  plastic"): the blank is now a deep varnished cane, and a short silk whipping holds each ring.

**Toward a commercial feel** (November 2026). A producer's critique on fresh frames (5 for "commercial": the lake would sell a
capsule, the minute-to-minute play would not) and research into Stardew, Dredge, Cast n Chill, Webfishing and Nodebuster gave
nine gaps; the owner chose the first four for this iteration (the rest are below, under *still open*).
- *The fight on the water.* The strike snaps the rod up, jolts the view and thumps the phone; the rod is loaded harder under
  tension; a running fish sits just under the surface and throws spray; a jump plays a third of a second in slow motion on the
  box's clock (the view slows `dt`, the rules see the same smaller steps); the fight panel is slimmer.
- *The catch's ceremony.* On the card, on the box's own clock: a brass spring balance whose needle swings past and settles
  while the weight counts up (its scale in quarters of 1, 2, 4, 8, 12, 20, 40 or 60 kg, so the numbers are round); the money
  counting up in rising clicks; a stamp, NEW for a first of its kind, RECORD for a heavier one than the book had (the rules
  now say `rec`), a new kind's plate painted in from left to right, and a phrase on the guitar. Money shows pence only below ten
  pounds.
- *Gestures, not prose.* On a touch screen a hand (Fluent Emoji's pointing finger, MIT, as another box draws it) shows each
  gesture where it is needed: a tap on the jetty's end, a swipe up to cast, a tap on the float that goes under, hold to reel,
  lift for red or a jump, slide away from the lilies, pump a sulk, a tap on *Tackle*; beside it at most four words. Every longer
  message was cut to a few words. At dusk without a lantern it says once a day that night is coming. The very first float goes
  under within seconds (the rules wait 2.5 to 4.5 s while nothing has been caught).
- *Upgrades that say what they do, and a goal in sight.* Every tag in the hut gives the purchase's effect in an angler's
  measures (lb of line, metres cast, metres a second wound, seconds to a bite, hooks, rods out, which kind the rigs land up to,
  the smokehouse's price); the logbook and the hut list what brings the Old One (every kind, the jetty's reach, ten hooks),
  ticked as each comes true, and each is said when it does.
- *Measured, and what it moved.* The faster first bite shifted the eager bot's whole game, and with it the tackle each kind is met
  with: a tench met at minute 11 and a zander at minute 33 were landed by someone who only holds. Checked over five seeds, not
  one: the tench pulls 2.65 and the zander 6.6 now. The paternoster had let fish join a sulking wels until even a quick hand
  landed it two times in three: nothing joins a sulking fish now. The top rig could land a wels on a rest, and once the book
  filled without the hand ever playing one: rigs land up to a carp. Pacing: eager 40.5 to 43.7 min, casual 44.6 to 47.7. The
  rests' alarm code, dead since they fish alone, is gone. The owner raised the box's cap to 350 KB; it weighs 299.
- *The producer again* on fresh frames: **6** (from 5): the hut's effects and the Old One's checklist make the goal clear, the
  hand and its few words are a commercial tutorial, the catch has ceremony. Fixed from it at once: the weight on the card
  counted past its value with the needle (it read as a wrong number on a still; the number only climbs now, the needle alone
  swings), the plate painted in behind a hard vertical cut (a wet, feathered edge now), the bank rod's "♪" floated unlabelled
  over the water ("♪ bank rod"). Next, by its ranking: the fish seen in the water while it fights (a dark shape and a swirl
  where the line goes in, the jump framed), the Old One's catch as a moment of its own (a gold-framed plate, a closing page of
  the hours and fish), every kind on a garland's card, bounties on a board in the hut for the middle of the game.
- *Still open from the critique:* a finale (rumours of the Old One from minute ten, a last night of fog, a fight in phases, the tin
  as an object); conditions per kind and rare colour variants; life in the world (a heron, dragonflies, moths at the lantern, a
  pool of its light); a second typeface for numbers; the sound checks a producer would make (a drag that screams with the
  tension, the guitar drawing back in a fight).

**The producer's next four, and the owner's fifth look** (November 2026).
- *The fish seen while it fights*: the water darkens in a body's shape along the fish's way (drawn a little larger than life so
  it reads ten metres out, the mirror thinned over it) with a swirl where the line goes in.
- *A garland's card* shows every kind on a small plate of its own, a badge for the count.
- *The Old One's catch*: its card framed in gold, the angler's season on it (days at the water, fish landed, kinds, trophies, the
  heaviest before it), a moment of slow motion as it comes in; then the tin.
- *Bounties*: once three kinds are in the book, the hut's cork board holds two notes ("Tench over 1.6 kg, £40"): a kind from the
  book above about one and a third of its usual weight, paid on top when the hand lands one, a new note in its place. The bots
  fill thirteen to seventeen in a game, about a twentieth of what they earn; the longest wait for something new fell from 3.6 to
  1.6 minutes. Pacing: eager 34.0 to 35.6 min, casual 40.3 to 43.9.
- *The hut dressed*: the heaviest fish so far mounted on green felt in a wooden frame with a brass plate, the bounties pinned to
  cork, a landing net on its peg with a coil of rope.
- *The owner*: the space bar casts no more and jumps instead (gravity, a soft bend of the knees and a thud on landing; it still
  strikes at a bite and reels in a fight); the rod's tip twitches at nibbles while you wait and pulls down at a take; the lily
  beds grow in ragged patches of every size, and the first fish that heads for them says that it gets stuck there; the mirror
  (drawn at half size) is softened by five taps, so trees in the water no longer show hard steps, and a willow's inside is less
  black.
- *Rigs by kind*: a small zander pulled less than a big carp and was landed by a rest, so once the book filled without the hand
  ever playing one. A rest now lands a kind only if its usual pull is within the rig, whatever the fish's size.

**The owner's sixth look** (November 2026). The owner saw no decoration (they meant the hut in the world, not its shop screen)
and the trees in the water as blocky as before (they meant the willows standing in the lake, not the mirror). Both read again:
- *The hut in the world*: a red and white life ring beside the window, an oar at the corner, a barrel of floats with iron hoops,
  a net drying on the side wall, floats on the counter, a lamp from the shutter. Its gable was stepped boards that poked through
  the roof; it is one triangle of boards now, the photograph laid across it.
- *Willows*: two stood in the lake (their places were never checked against the ground); each is walked out from the lake's
  middle until the ground is dry. Their shoots hung straight, so the curtain was a box with a black inside and a hem cut by the
  water: they flare out as they fall (a bell), stop short of the ground at ragged lengths, and are narrower with light between.
- *Golden fish*: about one in forty of a kind comes golden, worth four times, stamped GOLDEN, its painting in warm metal, counted
  in the book. Whether a fish is golden is read from its weight by a hash, not drawn from the PRNG, so every game the bots play
  is the same as before.
- *Each kind its hour or weather*: tench bite best at dawn, eels in rain, pike at dusk, rudd by day, carp shy of rain.
- *Life*: dragonflies over the lilies on a dry day (moved on the box's clock, drawn with the line), moths circling a lit lantern.
- *Rumours of the Old One*: from five kinds in the book, every few minutes something huge rolls far out (a great ring, spray, a
  deep sound; said once), more often once all three conditions are met; its nights then come in fog.

**The owner's seventh look**: "many graphics faults". The life ring was sixteen tubes with gaps at every joint (one torus now);
the roof floated a hand's breadth over the walls (its slope passed through the wall tops only if the eaves sat lower: they do,
with a fascia under each, and an underside); the hut could be walked through (it and the barrel and the sign's post are solid now,
for the keys and for a path of taps); floats stood on the counter and in the barrel like orange pins nobody could read, and a lamp
perched on the shutter like a chimney: all gone; the shutter is propped low enough to clear the eave. Lesson: dressing drawn as
a few primitives at small size reads as faults, not as things; a prop earns its place only if it reads at play size. The
willows are out of the scene for now, at the owner's wish (they read as blocks however they were built). On a desktop a click
on the water casts, longer held throws further, and from anywhere off the jetty's end the angler walks out first.

**The owner's eighth look.**
- *The rod's bend*: a fixed share of every bend pointed down, so a fish to the side bent the tip below the line that pulled it.
  The blank now turns along its length from its own direction toward the line's (stiff at the butt, most at the tip), and never
  past it; with no fish on it droops a little under its weight. The rests' rods the same way.
- *The float* stood on the water like a skittle: it hangs lower, only the painted tip out, with a faint ring now and then.
- *The roof* was two sheets with an open edge and a single texel of colour beneath: each side is a slab now, shingles on top,
  boards beneath, its three edges closed.
- *Inside the hut*, seen through the window: three shelves of brass and dark tins, boxes and jars of floats, a table with an
  open ledger, a wooden stool, a landing net on a peg in each corner.
- *A desktop*: the browser takes Esc to free the mouse (and leave full screen), so a second Esc was needed for the packing slip;
  when the mouse is freed and the box did not free it, the box now opens the slip itself. While the mouse is held, L and T are
  shown on the logbook's and the hut's buttons.
- *Three more kinds* (thirteen in the book): a gudgeon in the near shallows by day (dark-blotched, a barbel), a crucian carp at
  dawn and dusk that runs for the lilies (deep and round, big scales), a burbot deep at night that twists (barbel, a long low
  fin, mottled). The crucian first pulled 1.9 and was met so late that someone who only holds landed nine in ten; it pulls 2.7.
  The suite now counts a kind as met when it first comes onto the line, as the lead or on a free hook: with the paternoster,
  some kinds are met only in a garland. Pacing: eager 33.5 to 45.1 min, casual 40.8 to 52.0, the longest wait 3.5.

**The owner's ninth look**: half an hour of play, "real fun"; the sound fits. They wondered at a second hut that appeared, with
graphics faults, its purpose unknown: the smokehouse, still the first session's rough build (a stack of boxes, sheets for a
roof, gables of one texel). Rebuilt as the tackle hut was: board walls with a plank door, its battens and latch, gables of
boards, a roof of two closed slabs whose slope passes the wall tops, a stone chimney with its cap and its smoke; before the door
a rack with fish hung by the mouth in the smoke, so what it is for shows. Buying it says that every fish sells for more now, and
each catch card says "Smoked: ×1.3". It is solid too. Lesson: an upgrade that appears in the world must say what it is, there.

**Critic round after the ninth look**: 7/5/7/6 and **4**. The worst it found was real and old: every board of the jetty and both
huts showed a pattern of waves instead of the photographed wood. `cuboid()` gave wood its v (across the grain) from the world
coordinate plus a per-piece offset, and both go negative (the lake lies at negative z; `%` keeps the sign in JS); a negative v
is how a post's sawn top asks the shader for growth rings, so every such board was drawn as end grain. v now counts from the
piece's own middle and the offset is kept positive: the jetty, the walls, the bench and the door show the weathered boards at
last. Lesson: a value that doubles as a flag (v < 0 means end grain) must be made impossible elsewhere, not just unlikely.
Also fixed from the round: the rests' front sticks stood out past the jetty's edge in the water (they stand on the boards now);
toasts covered the catch card (they wait until it is put away); the balance was clipped off a phone's left edge; the smokehouse's
rack hid its door (it stands beside the house, each fish on a string); a garland's fish crowded and turned face-on (wider
droppers, side-on); the rod is carried low away from the water's edge.

**A desktop critic** (1280×800, the way the owner plays): 7/6, desktop UI 5, and **5**. Fixed: the landed catch hung behind its
card on a wide screen (it hangs above it now, a garland too); before the mouse was taken a desktop was told to "swipe up" (it
is told to click), and a lean said "Slide" (it says "Mouse ←"); the logbook was a 620-pixel column (four columns, all thirteen
kinds in view) and the hut a narrow board (wider, five or six tags a row); the HUD was small for a large window (a sixth
larger). Before: the carp became a mirror carp (a row of great flat scales, longer barbels), the Old One scarred and pale-eyed;
the hut's window glows warm at dusk and night, and the jetty's lantern has a halo.

**The owner at the desktop** (tenth look).
- *Fish that gaped for a few frames*: the lofted body read the painting right up to its outline, where the painting's alpha falls;
  the cut-out then opened slits along the back and belly whenever the mip level changed. The body reads the painting a little
  inside its outline now.
- *Tree shadows that jumped*: the shadow map is redrawn every twenty frames, and the trees swayed in it, so each redraw moved the
  shadows at once. The shadow pass draws the trees still.
- *Two floating lights in the hut at night*: the window's glow points are seen only from outside, more than three metres off.
- *The float on the water*: it was drawn after the water, so all of it showed above the surface. Floats are drawn before the
  water now, and the water hides what is under it: only the painted tip stands out, at a bite less.
- *A garland's lines*: every line runs from the rod's tip straight to a mouth.
- *The fish's shadow pointed elsewhere than the fish*: the dark shape in the water took the wake's direction; it takes the 3D
  fish's own heading now.
- *Stars*: a star near its cell's edge was cut into a broken shape, and under rain they showed through the cloud. Each sits well
  inside its cell, under a pixel and a half, and clouds and rain hide them (and the Milky Way).

- *The bank rod asked for a long walk with nothing to show for it*: the bell now says what is on, and it is always worth it:
  the bank rod's fish is picked when the bell rings (tench, rudd, crucian; carp from the fourth bank-rod level; eel and burbot
  at night), heavier than the jetty's, and its card names it with the seconds left.
- *The smokehouse*: its walls stood through the roof; the eaves sit above them now, and the tin chimney is a fieldstone stack.
- *The fight's panel*: higher, just under the horizon where the fish is, and larger at a desktop.
- *Trees through trees*: trees are placed on a four-metre grid with a minimum distance of 3.3 m; the woods stay as dense.

**The first fight, explained calmly** (eleventh look). The owner: the fight's two rules (do not pull against a fish that flees,
lean against one that pulls to a side) were only ever said in two words. Now each is a lesson, given once and kept with the
save, during the first five catches (`&lesson` in the address shows them on any save): when one is due, the water eases almost to a stop (to 7%, over a fifth of a second), a card
high above the panel names what the fish is doing and what the hand does about it, the panel's row it is about is ringed, and the
hand shows the gesture under the panel. The box runs on once the hand has done it for half a second (and the card has stood at
least 1.6 s): *It's on!* (hold to wind in), then at the first run *It bolts!* (let go), then at a later run *It pulls to the
right* (hold and lean the other way). A lesson whose run ends first comes back at the next run. The card's timers run on the
frame's own time, since reading is about real time; the fish, as always, on the box's.

**The owner's list, checked again** (twelfth look). The owner asked whether every point had been looked at; two had not been
fixed at their cause.
- *Fish still split open*: the earlier fix (reading the painting inside its outline) was a guess at the wrong cause. The fins
  and tail sit on a card through the fish's middle that carried the whole painting, body included, and it was one flat quad.
  The wiggle bends the body per vertex; a quad has four, so the card stayed flat while the body curved away, and its painted
  body cut out through a flank as a pale second half. The card is now 48 strips along the fish, bending with the body, and its
  painting has the body erased (a second half of the fish's texture). Lesson: a part that has to move with another needs the
  same vertices along the direction of the motion, not only the same shader.
- *Tree shadows still jumped*: drawing the trees still in the shadow pass was not enough. The map is redrawn every twentieth
  frame while the sun moves on, and a low sun's shadow of a 15 m tree is 80 m long: a fifth of a degree moves its tip more than
  a metre. There are two maps now, and the newest fades in over the last before the next is drawn.
- *Words for the mouse*: at a desktop the bite said "Tap!" and the catch card "tap to go on"; they say click.
- Checked at a desktop and found right: the float shows only its painted tip and goes under at a bite; no light points in the
  hut at night; stars small and hidden by rain; a garland's lines all from the rod's tip; the lifebuoy whole; the smokehouse's
  roof over its walls and its stone chimney.

**Stars and the hut's light, on the owner's GPU** (thirteenth look).
- *Stars looked different on a real GPU*: they were drawn as broken corners and strokes there and as clean points here. Moving
  the pixel-size derivative out of the per-pixel branch did not mend it: on the owner's GPU they were still the outlines of
  little squares and triangles, the shapes where the sky's sphere cuts the cells of space the shader hashed into stars. The
  stars are no longer made in the sky shader at all: 1600 fixed directions drawn as round points (`starP`, one draw at night),
  a pixel or two across, hidden by the same cloud the sky draws and by rain. Lesson: a sky detail made from cells and
  derivatives can look right in the software renderer and wrong on hardware; plain geometry looks the same everywhere.
- *Stars slid across the sky*: they turned at 0.004 rad per second of the box's clock, a star's width in a few seconds. Now
  0.0005: a whole night turns them a few degrees.
- *The light points in the hut*: two large glow sprites with no source hung in the room. A storm lantern hangs from the rafters
  now, its glass lit from dusk (a flag on the lantern-glass material, `uHutL`), with a small halo on the glass only.

**Polish the owner chose** (fourteenth look).
- *The hut at night*: the lantern lights the room now: a warm point light in `shade()` (`uHutP`, `uHutB`), full inside the hut's
  box and outside only along rays that leave through the open window, so it does not shine through the walls. The water
  mirrors the lit window: where a reflected ray meets the window's opening, a warm pane broken by the ripples.
- *The float at a desktop*: it keeps a size the eye can find further out (0.21 of its distance instead of 0.16), and while a
  fish has it, a ring spreads from where it went under every third of a second, on the box's clock.
- *Night sounds*: a tawny owl far off now and then (the hoot or the kee-wick), frogs in the reeds from dusk, and under rain
  near the hut the drum of drops on its roof, louder as you come near.

### The reorder of November 2026

The owner wanted to share the anthology on r/aigamedev, a critical audience that mostly plays on a phone and tries a
box or two. Starter, box 1 until then, opens on a still jar and earns "about 0¢ a minute" for its first half minute.

- *Measured first.* Every box was filmed on a 390×844 phone (its first ten seconds untouched, a crude touch script for
  a minute, and the eager bot's game at 1, 3, 8 and 20 minutes); the bots timed the first new thing (Still Water 10 s,
  Tilt 15, Here Be Rabbits 24, Unwelcome Guests 24, Snow Day 26, Starter 30, Keep Off the Grass 30, for the eager bot).
  Two fresh critics scored the openings (loop understood, hook in ten seconds, teaching without text, phone, feel,
  plays past minute 2). Means: Still Water 7.1, Tilt 6.8, Snow Day 6.8, Starter 6.1, Keep Off the Grass 6.0, Here Be
  Rabbits 5.1, Unwelcome Guests 4.1. Still Water read to one critic as a stock 3D scene and is the heaviest load on a
  phone; Tilt is 2D, shows its goal and its verb in the first frame and pays within fifteen seconds, so it opens.
- *The order and the axes.* Tilt → Snow Day (7 of 7 differ) → Here Be Rabbits (5: both wear a crowd down, both buy on a
  tree) → Still Water (7) → Unwelcome Guests (5: night blues, cards) → Starter (6: cream) → Keep Off the Grass (6:
  suburban homes). Kept apart: Starter and Still Water (wait, then tap), Keep Off the Grass and Unwelcome Guests (a
  finger that something follows), Starter and Snow Day (mid-century, mustard, tapping).
- *What the shell does for it.* The box a world is told comes next (`K.next`) is the first box this save has not
  opened, not the next in file order, so a save from before the reorder sees the right number on every way out and
  goes into it (a save that had opened Starter and Keep Off the Grass and was in Snow Day goes on to Here Be Rabbits).
  Seeds come from the slot a box first shipped in (`SEEDN` in the shell, `K.sn` in a box), so a fresh box plays the
  boards it always played. A save from before says once, on the title, that the boxes have new numbers (`SAVE.order`).
  Starter's bakery box printed `K.n + 1`; it prints `K.next.n` now. The `browser` suite plays such a save.
- *Tilt as the opener.* The very first game has a bucket on the house (forty balls instead of fifteen, `HOUSE`), so
  it breaks blocks and pays for two or three bulbs (about 58 coins against 17); the pacing did not move. Before the
  first touch, ghost balls run from the top through the teaching hand, so the board shows what a thumb does. On the
  sign, the first-time hint and "N MORE OUT OF VIEW" were drawn on one line over each other; the hint now has it to
  itself. A swipe that leaves no bulb you can buy in view lets the sign glide back.
- *Critics on the new opening* (fresh, phone stills of the first minute played with real touch): 6/6/6/6/6 and **5**, then,
  after the fixes below, 6/5/6/6/5 and **5**: the plateau *Stills plateau* names. Done between them: repeated sums merge
  into one growing number; a hit on a prize block no longer pops a bare "−1" beside the coins; between games the tray says
  NEXT GAME: and in the first game "25 ON THE HOUSE", so the fifteen after it is not a tray that shrank; the first game's
  blow on the Big One is counted in points ("YOU KNOCKED 34 OFF THE BIG ONE") until it is worth five per cent; the buy
  button says BUY; HUD labels and the teaching plate are larger and darker; a bulb takes a tap from 22 px; the first two
  machines have curved fences of nails along their walls (the ways), so the field reads as laid out, not tiled (funnels
  of nails over the tulips were tried and let balls rest on a closed tulip, and slowed the casual bot to 88 minutes).
  Still open from the critics, most valuable first: a tulip catch taught by the event (time slows, the ball flies back
  to the tray) instead of the pill; a designed board 1 with gates and a windmill; one display face and one number face;
  the sign's tree larger and less symmetric, its edge labels inside the screen; a celebration on buying a bulb and on
  every blow to the Big One. One critic would show the return tag later (after a purchase), since it invites a stranger
  to leave; the owner asked for it to be found in the first minute, so it stays at 45 seconds.
- *Returning a box, found.* Both critics found no way to tell, in the first minute, that a box can be sent back: the
  title said "Finish one to find out what is in the next", and the packing slip is behind an unlabelled chip. The
  title now adds "or send one back unopened from its packing slip", and once per save, 45 seconds into a first box,
  a shipping tag swings out under the chip ("Not for you? Send it back") and opens the slip with the return button
  nudging (`SAVE.tag`).
- *The stamp and the reveal* (November 2026, the owner). Once the three seams were taped, only a line of small type said
  to tap the box to stamp it; now a rubber stamp bobs over the box above a pulsing dashed outline of RETURN TO SENDER, with
  TAP THE BOX TO STAMP IT under it. The returned box then goes on as from the title (the box just taped grows into the next
  one while the table dims), not by diving the paused world into a spot where the return's box happened to be drawn. And the
  tissue in a box now stays opaque while it swings open: it faded to a fifth as it turned, so the next world showed through
  closed tissue before the box had opened.

## Lessons from the boxes so far

- **A cut-out atlas goes up premultiplied.** Clear texels painted by a 2D canvas are black; a mipmap of straight colours
  averages that black into every edge, so leaves darken toward a crown's rim and blades toward their tips, more the further
  away. Upload with `UNPACK_PREMULTIPLY_ALPHA_WEBGL` and divide by alpha in the shader. And whatever the atlas hid under that
  black (Still Water's straw-yellow grass tips) shows once it is gone: look again after the fix.
- **The canvas's alpha must stay 1.** A soft cut-out edge or a blended line that writes alpha below 1 is composited by the page
  as a pale fringe; mask alpha out after the clear.
- **More lines for the hand can starve the goal.** Rods on rests that rang faster than a fight lasts kept the bot in fights for
  good: its own line never went out, it never shopped, and the last fish, which came only on that line, never came. Count a
  bot's actions by kind before tuning (here fights by rod), let the goal come by the new verb too, and let shopping happen
  between the new verb's turns.

- **A tackle that only grows makes the fight vanish.** Still Water's line, rod and reel each scaled the margin while the fish stayed
  as they were, so after four purchases nobody could snap a line. Set each kind against the tackle it is met with in a bot's
  game, let size push back, and measure people (one who only holds, one who is late, one who is quick) rather than the bots,
  which let go at once.
- **Cut-out cards keep their crown's normal on both faces.** Flipping the normal for back faces, as solids need, lit every
  grass card black on one side; leaves and blades take the normal bent out from their clump whichever side is seen.
- **A canvas read after the frame is blank.** WebGL clears the drawing buffer once it is shown, so a snapshot must draw the frame
  and read it in the same call.

- **A lid that opens is a model, not a squashed picture.** Scaling the closed lid's picture and growing a lining picture behind it
  looked like two lids and a box on a box. A few projected points (a box, a roof turning on its hinge, a camera that pitches)
  with culled faces and the paintings laid on them read as an object at once, and match the still picture exactly when the
  projection starts from the picture's own view.
- **A close-up script waits on the box's clock; a frozen camera stops that clock.** `util/cmv_props.mjs` waits until the
  state's `t` has moved on, and `look(..., { freeze })` stops the rules, so every tile waited a minute and the run timed out.
  A frozen view keeps its clock running without stepping the rules.
- **A staircase needs a hole in the floor above it.** The stair was drawn, the floor over it was whole, and every climber
  stood through the ceiling for a second. Whatever passes between floors needs the opening drawn.
- **A score paid by the share of someone's nerve starves a bigger cast.** Unwelcome Guests paid screams as fright over nerve,
  so the reel after the Pembertons paid a third as much per hit and the bot stalled for two hours. Pay by what the hand did
  (the mass that struck) and let the cast's nerve set how long it takes.

- **The bots earn faster than a person, so they hide a steep start.** Unwelcome Guests' eager bot bought its second pipe in a
  minute; the owner bought one in four nights. Read the first prices against what a person's first night pays, not the bot's,
  and keep the first few nodes of every branch within a night or two of it.

- **Firefox on Android pays for every canvas call.** The same page ran at 59 fps in Chrome and 6 in Firefox on one phone, and
  the box before it fared no better there. Count draw calls per part and keep them down: paint what does not change into
  tiles, paint each figure once into a sprite and place it, gather many small shapes into one path.

- **Never read a canvas back on a phone, not even to measure it.** Reading one pixel after each part of a frame shows the
  raster's real cost in a software renderer, but on a phone each read stalls the GPU and Chrome then moves the canvas to the
  CPU: Here Be Rabbits' frame meter turned every test link into a slide show. Keep the read behind a switch of its own.
- **Effects that composite a whole screen are made once, not every frame.** Silhouettes, vignettes and cloud shadows built as
  screen-sized layers per frame were the largest costs after the sprites; a silhouette sprite per kind of figure, and small
  canvases stretched to the screen, cost almost nothing.

- **A bot's threshold above what the rules can hold means it never acts.** Here Be Rabbits' bots waited for 25 rabbits in one
  cell to ring the bell, and a cell holds 24: in the whole of the eager bot's game the bell never rang, and the pacing had been
  tuned without it. Count every ability's uses by cause before trusting the pacing, and weigh a crowd, not a cell.
- **The rules turn the page in the step that wins it; the view keeps the old one on the desk.** The folio held and the next
  one painted happened in the same step, so the next page showed behind the card that said this one was held. The view copies
  the canvas at the win and draws that copy until it turns the page itself.
- **A see-through tree reads as a drawing fault.** To keep a defender visible behind a tree, draw the defender's silhouette
  over the tree; fading the tree shows trunks and crowns through each other.

- **A bug can hold up the balance, twice now.** Snow Day was tuned while a kid knocked down by one snowball could not be
  hit by the next one in the air, so 85% of the player's own throws were wasted; mending it took the eager bot from 35
  to 11 minutes. Before any tuning, count what the verb actually does (hits against throws, by cause) with a bot.
- **When the rules stop, nothing may hang in the air.** Snow Day's rules stop stepping at the end, and the snowballs in
  flight stayed where they were, round the yeti's head, for good. Whatever stops the rules clears or lands what is
  moving.
- **A hit-stop that stops the whole picture reads as lag.** Freezing every animation for a moment on each hit works for a
  heavy blow now and then; with a hit every few hundred milliseconds the picture stutters and the player blames the frame
  rate. Hold only the one hit (its target, its squash), never the particles and the rest of the scene.
- **Measure sound offline when the test browser is deaf.** Headless Chromium may run an AudioContext whose analysers read
  nothing; an `OfflineAudioContext` renders the box's own sound functions to a buffer whose peak and average are exact.
- **A shadow lies on the ground, not on a plane.** A ground that rises and falls needs its shadows at its own height
  (or a ground flat where things stand); shadows at one height float over every hollow.
- **A bug can be holding up the balance.** Tilt's mega balls stuck and were cleared within a second and a half, so
  the late game was tuned without them; mending them took fifteen minutes off the eager bot's game. After any fix to
  something a bot uses, run the pacing suite before calling it a fix, and compare when each board opens.
- **Hand the shell the opening.** `K.complete(rect)` is where the camera dives; a rectangle round a whole box dives into
  its printed side. Stage the box so its opening faces the camera, then hand over that opening.

- **A canvas font needs a fallback family.** `ctx.font = '400 12px Bungee'` before the face has loaded draws in the
  browser's default, which is a serif; a critic took Tilt's "START POCKET" in Times for the plainest giveaway of an
  amateur game. Write every canvas font with a generic family (`'400 12px Bungee, sans-serif'`) and repaint cached
  sprites and backdrops once `document.fonts.ready` resolves.
- **Keep the old picture while the rules have moved on.** Tilt's core is on the next board in the very step the Big One
  breaks. The view copies the last frame into a canvas when the break event arrives, cuts the Big One out of it with the
  old board's cached print, and plays the break and the drop over that copy; everything that names the new board waits
  until the copy has left the glass. This is cheaper and more honest than teaching the view to draw two boards.
- **A shadow follows its object.** A rounded-rectangle shadow under every block sprite left a dark square tile behind
  an irregular rock and a dark plate under a bank's pediment; a close-up critic found both at once. Draw each shadow
  from the object's own outline.
- **Test the closed state too.** Tilt's mega balls passed the test that dropped them past every tulip, but only open ones:
  closed, a drain tulip's dome left less room by the wall than a mega ball needs. A test that clears a path should also run
  with everything that can close, fill up or be bought in its other state.
- **Decide a result when its animation starts.** A reel stopped by the view before the rules had rolled shows the old
  result and then swaps. Roll first, send the result with the start, and drive each moving part to it on game time.
- **A goal that the late game meets by itself is not a goal.** Before adding "do X for a bonus", have the bot measure how
  often X already happens; with hundreds of balls every pin was struck every game, so the goal had to be "at once".
- **Stills plateau, close-ups do not.** Three critics on play-size filmstrips scored Tilt's "commercial" 3, 4, 4 while
  the art changed a great deal; one critic on 28 close-ups returned forty concrete faults, every one fixable. Alternate
  the two, and send the close-ups first when the scores stop moving.

- **A depth buffer is coarser on a phone than in a test browser.** The owner's phone showed dark bands across a flat
  lawn: the contact shade read each step of the far depth as an edge. Differences below the step (growing with the
  square of the distance) were then counted as flat, which did not cure it; `?ao=0` on the phone did, so a touch
  screen goes without the contact shade (`?ao=` and `?blur=` set the lens from the URL). Headless SwiftShader never
  showed it.
- **The rules decide at once; the view must not tell before its ceremony.** A verdict the core reaches in one step
  (gold, a new place opened) reaches every part of the view in that frame: the pegboard, the HUD line, what is drawn
  on the ground. Keep Off the Grass showed the note in the cup and the players on the pitch while its judges were
  still looking. Anything a verdict opens waits for the moment the view announces it, on that moment's own clock.
- **A card that matters must be on screen.** A phone's sideways strip inserts by order, so a new key card can land
  two screens away while the HUD points at it. Scroll to it when it appears.
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
