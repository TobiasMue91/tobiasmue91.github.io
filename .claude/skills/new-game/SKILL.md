---
name: new-game
description: Design and ship a brand-new game on gptgames.dev at commercial quality - pick an idea from IDEAS.md (or take the one given), design thesis, art direction with critique, build, filmstrip critique rounds, register it, PR.
argument-hint: "[name and/or description of the game]"
disable-model-invocation: true
---
Build one new game for gptgames.dev, as good as it can be built today.
Make every decision yourself and explain the important ones in the PR. Do not stop to ask me.

Game requested (may be empty): $ARGUMENTS

THE BAR
Measure it against the best commercial game of this kind that exists now, not against other
pages on this site. A stranger who came across it should believe someone was paid to design it.

1. CHOOSE THE GAME. If a game is requested above, that is the game; use its name if given,
   otherwise choose a short one. If nothing is requested, read IDEAS.md (starting with **Read
   this first**, then **Axes, not categories**, the gap lists and **Tried and rejected**) and
   pick the idea that best fills a gap the file names. Either way, check `games/` and
   `data/games.json` so it does not duplicate an existing game, and pick a file id that is not
   taken. In the PR, say in two lines why this game and why now.
2. UNDERSTAND THE GAME. In a few lines: what the best versions of this kind of game do well,
   what the one moment is that makes it satisfying, what the player should feel, and what a
   phone player needs. That is your design thesis.
3. CHOOSE THE ART DIRECTION. Derive it from the design thesis and the game's theme: palette,
   typography, shapes, a motion idea and a sound idea. Write down why each belongs to this game;
   a reason that would fit any game is not a reason. Build a static mockup of the main screen in
   your scratchpad, not in the repo, and screenshot it at desktop and phone size.
   Then show the screenshots, one sentence about the game and the principles below to a critic:
   a subagent that has not seen your reasoning. It reviews as a harsh critic: would a stranger
   call this bad? What looks cheap, what is confusing, what is weakest? Scores from 1 to 10 for
   first impression, clarity, art direction and phone. Do not tell it the pass mark or which
   round it is. Revise the mockup until every score is at least 8 before writing the game.
4. THE FIRST 30 SECONDS. Before any code, write out step by step what a new player on a phone
   sees, touches and learns, what happens on their first mistake, at the end of a game and when
   they come back tomorrow. List every screen state and how you get in and out of each.
5. BUILD IT as CLAUDE.md describes a page: `games/<id>.html`, one self-contained file. Every
   input gets feedback in the same frame. Everything that moves is eased. No layout jumps, a
   steady frame rate, readable contrast, reduced motion respected. Anything reproducible
   (levels, boards) comes from a seeded PRNG. Check the recurring mistakes CLAUDE.md lists.
6. CORRECTNESS WHERE IT MATTERS. The rules the game stands on belong in a DOM-free core with a
   suite in test/ if a change in one corner could quietly break another. No console errors.
   Tests must not eat the session; most of the effort belongs in steps 3, 4 and 7.
7. CRITIQUE THE GAME, IN ROUNDS. In headless Chromium, record filmstrips (8 to 12 frames each)
   of the key moments, on desktop and on a phone. Give them to a fresh critic as in step 3, now
   also scoring feel. Fix the biggest issues and repeat until every score is at least 8, for at
   most four rounds. If you disagree with the critic, show why in the next round instead of
   arguing. If a score is still below 8 after the last round, say so in the PR.
8. REGISTER AND COMMIT as "Adding a game or tool" in CLAUDE.md describes (JSON entry with
   `featured` off unless it truly earns the shelf, sidebar, sitemap, screenshot). The commit
   message says what the game is and why it looks and plays the way it does. Push, open a PR,
   and give me screenshots and the critic's last scores.

PRINCIPLES

* Every visual choice is deliberate: if you cannot say why this font, this colour and this shape
  belong to this game and not to any other, choose again.
* Everything on screen serves play. A panel, label, number or effect that neither helps the
  player decide nor makes them feel something goes.
* The game teaches through play, not through text. Settings and modes only where the game
  would be worse without them.
* Polish before features: no system the core game does not need.

One game per session.
