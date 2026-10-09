## The first 30 seconds (written before the code)

**Phone, first visit.** The page opens straight on level 1 (Pond 1, a 4x4 board, three inks). No menu, no modal, no "how to play".
The paper board slides in (380 ms). Your corner wears a white dot and sits inside a lifted, outlined shape: that is you. Under the
board: three tiles of ink, each with a "+N" badge saying what it would swallow; the one that swallows most breathes, and a single
dark tip points at it: "Flood the board with one colour". That sentence is the only text the game ever uses to teach, and it goes
after the first move.
- **Touch** an ink: the tile sinks into its shadow and the cells it would swallow lift off the board with their own "+N". Slide off
  the tile and let go: nothing is spent. A mouse gets the same preview from hover.
- **Release:** the tile springs back; the new ink washes out of the corner through your region (260 ms), then every swallowed cell
  blooms ring by ring (46 ms per ring), one note of a marimba scale per ring, so a big move is a longer rising run. The counter
  ticks up the same frame; the moves bar fills one segment.
- **Level 1 is solved in three moves.** The last cells bloom, a ring of light crosses the board, tiles of ink burst from the corner dot,
  the page floods with the winning colour from the dot outwards and the board seals into one mosaic. A card springs up where the
  inks were; the stars land one at a time, each with its own note. Next level is the big gold button.
- **Level 2-3**: the best tile still breathes. From level 4 it does not: the "+N" badges are the teacher.

**First mistake.** A move that swallows little is legal and cheap to take back: the badge said so, the counter ticks up, the star
tier you were in dims and drops by a star with a small tumble. Undo is free and unlimited, always one thumb away; it plays the move
backwards (outer ring first). An ink that touches nothing is dashed and dim and says nothing when pressed except a dull knock.
Running out of moves leaves the board in view (desaturated, settled), the counter turns orange and a card says how many cells were
left unflooded: Try again keeps the same board, Undo a move steps back into it.

**End of a game.** Win: the card shows the stars earned, "Par!" or "Under par!" at the biggest size, "N moves - par P", a new best if
it is one, and Next level. The daily board adds a streak chip and Share result: one coloured square per move you played, and nothing
of the board. After level 40 Next becomes today's board.

**Tomorrow.** Stars and bests are saved. The game opens on the next level you have not cleared. The level chip wears a gold "Today"
tag until today's daily board (same for everyone, bigger from Monday to Sunday) has been played; the streak counts consecutive
days. A player of the old page lands in the tier of the preset they had beaten (Easy - Lakes, Medium - Seas, Hard - Oceans) and finds
their old best moves in the levels sheet; nothing is turned into stars.

## Screen states
1. **Play** (the only screen you ever land on). Sub-states: idle, press (preview), animating (a new press fast-forwards the old animation
   and plays at once), hint (3 s: the ink pings, its cells are previewed), restart armed (the button turns gold for 2.6 s), out of
   moves. In: page load, Next, Replay, Try again, a tile in the levels sheet, `?level=`, `?daily`, `?seed=&n=&k=` (a shared board).
   Out: win, lose, the level chip.
2. **Win card** (over the inks; the board stays in view, lifted and shrunk so the two never touch). Out: Next level, Replay, the level chip.
3. **Out-of-moves card** (same place). Out: Try again, Undo a move, the level chip.
4. **Levels sheet** (bottom sheet on a phone, a panel on a desktop): Today's board, Pond / Lake / Sea / Ocean with stars per level, sound,
   erase progress (two taps), the old bests. In: the chip or M. Out: a tile, Today's board, close, a tap outside, Esc.

Input: ink tiles (press shows, release plays), keys 1-6, U or Z or Backspace undo, H hint, R restart (twice), M levels, Esc.
