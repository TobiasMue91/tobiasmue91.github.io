# Alphabet Typing Speed — design notes (written before the code)

## Design thesis
Alphabet speedruns, Wordle's one-screen clarity and Keybr's per-key honesty agree on three things: the run is a single
breath that starts the instant you move (no Start button, no countdown), the only rules are the ones you can see, and the
result tells you *where* the time went, not only how long it took. The one moment that makes it satisfying is the last
letter: the clock freezes and a rank is stamped. What the player should feel is rhythm — a flow that visibly breaks when a key
has to be hunted for. A phone has no keyboard worth the name for this: the OS keyboard would cover half the screen and move
the layout, so the page draws its own QWERTY, takes taps on `pointerdown`, and gives every tap in the gaps to the nearest key.

## Art direction, with the reason for each choice
- **Wood-type specimen on paper.** The game is the alphabet itself, and a wood-type poster is the alphabet as an object.
  Ultra (an OFL Clarendon fat face, 8 kB subset, overlaps removed) sets everything that is a letter or a number: the hero
  letter, the clock, the keys, the rank stamp. Courier Prime Bold (typewriter, 12 kB) sets the small words, because typing
  is what you are doing. Nothing else is loaded.
- **Two inks, like a two-colour print job.** Paper `#ebe2cc`, ink `#1d1a16`, vermilion `#d63f27` for *now* (the current
  segment, the hint, a miss, the stamp, the primary button) and ultramarine `#2b45a0` for *your best* (the ghost marker and
  the gap pill). Red is attention; blue is the thing you are racing.
- **Hero letter + next three.** The one letter to hit is ~60 % of the stage; the three after it fade like type waiting in
  the case. On a shuffled Daily board that lookahead is what a fast player reads.
- **The progress bar is a composing stick.** 26 segments; each right key stamps the old letter into its segment. The blue
  triangle above it is where your best run was a moment ago — a race against yourself that is readable in peripheral vision.
- **Corner brackets are register marks.** They bite in 6 px on every right key and flash red on a miss, so they are motion,
  not decoration.
- **Motion: a strike.** Right key: the key inks black and springs back, the new letter lands with a 120 ms recoil, the old
  one is stamped into the bar in 130 ms. Miss: key, letter and brackets hold red and shake. Finish: the clock thumps, the
  stage dips 3 px, the sheet slides up and the rank is stamped on it (scale 1.5 to 1, a rubber stamp).
- **Sound: an ascent.** The alphabet goes up, so pitch is progress: every right key is the next note of a rising major scale
  (G3 to D7, 26 notes) with a typebar tick; a miss is a dull thock that breaks the climb; Z resolves V to I in a chord.
- **Results are about the overall time.** The clock stays up top with the gap to your best; under the rank stamp the main
  picture is your history on this board: one dot per run, higher is faster, a blue step line for your best so far and a grey
  line for the average of the last five, with one sentence under it ("Last 10 average 7.83 s, 2.30 s faster than the 10
  before"). The old per-letter picture is demoted to a thin strip (tap a bar to read it) because the point is the time, not
  the letter. The History button in the header shows the same chart for a board, bigger, with best, last-10 average and runs.

## The ladder
Printer's Devil, Journeyman, Compositor, Foreman, Master Printer — print-shop ranks, so a rank is a stamp. Thresholds (A to Z:
14, 9, 6, 4.2 s) were set against a typist model (thinking time plus finger travel on the same keyboard geometry) and the
suite checks that novice, average, fast and elite bots land spread across them on every board. Reverse (x1.6) and Daily
(x1.9) have longer ladders because every letter has to be found rather than recalled.

## Added after the first review: history
Feedback from the owner after the first PR: more focus on the overall time and less on the per-letter average, and a history
so a player can see themselves improving. The `avg` line and the slowest-letter headline are gone from the results; the sheet
now draws the history chart (`hist` in the save, newest 120 runs per board, oldest first), and a History button opens it any
time between runs. The old page's list of attempts is carried over as the Forward history.

## How it was reviewed
Static mockups went through six critic rounds (a fresh subagent each time, shown only screenshots, the one-line description and the
principles) before any game code: the first three scored first impression 7, clarity 6, art direction 7, phone 6, and the last four
sat at 8 / 7 / 8-8.5 / 7-7.5. The page was then filmed in headless Chromium (8 to 12 frames per key moment, desktop and phone, in
`strip_*.jpg`) and judged by four fresh critics in four rounds. Final round: first impression 8, clarity 7, art direction 8.5,
phone 6.5, feel 6.5. Critics contradicted each other between rounds (the miss flash was "too heavy" and "good but long"; the pill was
"dead" and "stale"), several of their frames came from the recording script pausing on purpose, and the four-round cap was reached,
so phone and feel did not get to 8 by the critics' own scores. What changed because of them: the old-letter smear (flight shortened to
130 ms and made ease-out), the stale gap pill (now live and honest), the dead frames at the finish, the one stall that flattened the
chart (bars capped at three times the median), keyboard slivers under the sheet, the hint (now lifts and pulses), the miss flash
(no outline, shorter), the first-run slot under the clock (now a goal), and the A that had a hairline in it.
