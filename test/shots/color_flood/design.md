# Color Flood: design thesis and art direction

## Thesis
The best flood games (Flood-It, Simon Tatham's Flood, the genre's polished phone versions) share one rule and one decision: which of five
buttons. What they do well is make that decision cheap to think about: a board you can read at a glance, feedback in the same frame,
an undo that costs nothing and a par that makes every move matter.

The one moment is the press: your territory spreads and swallows what it touches in a visible wave, and the board you thought was
fragmented suddenly has a shape. The player should feel clever and a little greedy ("one more move to beat par").

A phone player has no hover and one thumb, so what hover would tell them (what will this swallow?) is printed on the button itself, the
controls sit in the lower third, and nothing a thumb must hit is under 44 px.

## Decisions that follow
- A "+N" on every ink. Inks that would swallow nothing are dashed and dim (a move that swallows nothing is never useful, so it is not offered).
- Pressing an ink lifts the cells it would swallow off the board, with their own "+N". Release plays it.
- Par is what a solver found (exact for small boards, a beam search with a region-graph lower bound for big ones), recorded with its
  solution for the 40 levels and re-solved in a worker for the daily board. Three stars = par; the limit is par + 40%. Beating par is
  possible and says so. A hint costs the third star.
- Undo is free and unlimited, and plays the move backwards. Restart takes two taps.
- Forty levels (Pond, Lake, Sea, Ocean; 4x4/3 inks to 20x20/6) whose board variant was chosen so par climbs 3 -> 25; a new daily board
  every day, bigger as the week goes on; a seed in the address deals any board (and how a levelled board is shared).

## Art direction: a risograph print on warm paper
Flood = ink spreading through a medium. Risograph is flat fluorescent inks on uncoated paper, a handful at a time.
- **Palette**: six inks (fluoro pink, sunflower, blue, green, orange, violet) on warm paper (#f3eada) and one dark ink (#1b1a38). A print
  is made of exactly this; the colours read as a limited physical set. Light and dark inks are spread (yellow vs violet) so colour-blind
  players can still tell them apart, and a shapes toggle prints a glyph on every cell and ink.
- **Shapes**: every connected patch of one ink is one rounded shape with an even paper gutter (cut paper). Only what is yours is lifted:
  your territory has the heavy keyline and a hard shadow; the interactive things (inks, buttons) have a hard shadow; the board itself is flat.
  The inks are rounded squares because a board cell is a rounded square.
- **Type**: Bricolage Grotesque, heavy and tight, a poster/zine face. The word "Flood" sits on a dark slab with the origin dot on its corner:
  the word is itself a flooded territory.
- **Motion**: one grammar. Ink spreads outward from where it starts and blooms cell by cell: the territory's new colour washes out of your corner,
  swallowed cells bloom ring by ring, the page floods from the dot on a win, a ring of light crosses the board, tiles of ink burst out of the dot.
- **Sound**: a marimba on a pentatonic scale. Each ring of the flood plays the next note up (the ink picks the first), so a big move is a longer
  rising run; stars land on their own notes; losing is a soft downward sigh.

## What the critics said
Fresh subagent critics were shown only screenshots and filmstrips (never the reasoning), once per round, as harsh critics.

| round | what they saw | first impression | clarity | art direction | phone | feel |
| --- | --- | --- | --- | --- | --- | --- |
| mockup 1 | static mockup | 6 | 5 | 6 | 5 | - |
| mockup 6 | mockup + one move filmed | 7 | 6 | 7 | 6 | - |
| game 1 | the built page, filmstrips | 7 | 7 | 7 | 6 | 6 |
| game 2 | after bar, preview, phone dock, win choreography | 7 | 6 | 7 | 7 | 7 |
| game 3 | after sealed board, tiers on the bar, fail state | 7 | 6 | 7 | 6 | 7.5 |
| game 4 (last allowed) | after tall tiles, Today tag, shapes toggle, stage tint | 7.5 | 7 | 8 | 6.5 | 6.5 |

Not every score reached 8 (the brief asked for it within four game rounds; the cap was hit). What the last round still asked for, and what was
done afterwards without a further scored round: the win card enters opaque after a short beat on the finished board (it had been fading in
pink on pink), a brighter ring, fewer larger burst tiles, a smaller move counter and wider board on a phone, the card never touching the board,
badges kept inside their tiles, a less dulled fail state, larger and darker small type and a page that takes a faint tint of your current ink so the
board sits on a stage. What was not done: the star tiers on the bar are still decoded by playing (the active tier is gold, the rest dim), and the
single coach tip is still a sentence.

Changes the critics caused: the dashed outline stopped carrying four meanings (it now only means "unavailable"); the preview became a lifted piece with a
thin line instead of a second territory; the star trio in the corner became tier headers on the bar; the cross-fade of the territory's colour (which went
through mud) became a wipe from the corner; the win ends on a sealed mosaic and a card clear of the board instead of a flat slab; the phone dock got taller tiles
(five inks) or a wrapped dock (six); the badge went from a label inside the ink to a "+N" on its rim.
