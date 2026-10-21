---
name: improve-game
description: Remake one game on gptgames.dev as the best version of it that can be built today - claim, design thesis, art direction with critique, rebuild, filmstrip critique rounds, PR.
argument-hint: "[game id, e.g. 2048]"
disable-model-invocation: true
---
Remake one game on gptgames.dev as the best version of it that can be built today.
Make every decision yourself and explain the important ones in the PR. Do not stop to ask me,
unless the claim in step 1 fails.

Game requested (may be empty): $ARGUMENTS

THE BAR
Measure it against the best commercial version of this kind of game that exists now. Not
against the old page, not against the original from years ago, and not against other pages on
this site. A stranger who came across it should believe someone was paid to design it.

WHAT YOU MAY CHANGE
Nearly everything. Keep only the file name and URL, the core idea the catalogue entry promises,
and any saved data worth migrating. Look, structure, screens, modes and even the name are open.
Write the new page from an empty file. Do not read the old page's code until step 7. If the page
already has a DOM-free core that a suite in test/ checks, you may keep that core, because its
tests prove it. Everything around it starts fresh.

1. CLAIM THE GAME before anything else. With no game requested above, run
   `python util/claim.py`; with one, run `python util/claim.py games/<id>.html`.
   It prints the game that is now yours. If it fails, that game is taken: stop and tell me.
   The claim branch it pushes is the only extra branch you may push. Never touch another
   session's claim.
2. UNDERSTAND THE GAME, NOT THE PAGE. In a few lines: what the best versions of this game do
   well, what the one moment is that makes it satisfying, what the player should feel, and what
   a phone player needs. That is your design thesis.
3. CHOOSE THE ART DIRECTION. Derive it from the design thesis and the game's theme: palette,
   typography, shapes, a motion idea and a sound idea. Write down why each belongs to this game;
   a reason that would fit any game is not a reason. The game gets its own identity, independent
   of the rest of the site. Build a static mockup of the main screen in your scratchpad, not in
   the repo, and screenshot it at desktop and phone size.
   Then show the screenshots, one sentence about the game and the principles below to a critic:
   a subagent that has not seen your reasoning. It reviews as a harsh critic: would a stranger
   call this bad? What looks cheap, what is confusing, what is weakest? Scores from 1 to 10 for
   first impression, clarity, art direction and phone. Revise the mockup until every score is
   at least 8 before writing the game.
4. THE FIRST 30 SECONDS. Before any code, write out step by step what a new player on a phone
   sees, touches and learns, what happens on their first mistake, at the end of a game and when
   they come back tomorrow. List every screen state and how you get in and out of each.
5. BUILD IT as CLAUDE.md describes a page. Every input gets feedback in the same frame.
   Everything that moves is eased. No layout jumps, a steady frame rate, readable contrast,
   reduced motion respected. Check the recurring mistakes CLAUDE.md lists.
6. CORRECTNESS WHERE IT MATTERS. The rules the game stands on belong in a DOM-free core with a
   suite in test/ if a change in one corner could quietly break another. No console errors. Tests
   must not eat the session; most of the effort belongs in steps 3, 4 and 8.
7. MIGRATION. Only now read the old page, for its saved data, so existing progress and best
   scores survive.
8. CRITIQUE THE GAME, IN ROUNDS. In headless Chromium, record filmstrips (8 to 12 frames each)
   of the key moments, on desktop and on a phone. Give them to a fresh critic as in step 3, now
   also scoring feel. Fix the biggest issues and repeat until every score is at least 8, for at
   most four rounds. If you disagree with the critic, show why in the next round instead of
   arguing.
9. HOUSEKEEPING AND COMMIT as in CLAUDE.md. The commit message says what the new game is and why
   it looks and plays the way it does. Push, open a PR, and give me before/after screenshots and
   the critic's last scores.

PRINCIPLES

* Faithfulness is owed to the mechanics, not to how the game used to look.
* Every visual choice is deliberate: if you cannot say why this font, this colour and this shape
  belong to this game and not to any other, choose again.
* Everything on screen serves play. A panel, label, number or effect that neither helps the
  player decide nor makes them feel something goes.
* The game teaches through play, not through text. Settings and modes only where the game
  would be worse without them.
* Polish before features: no system the core game does not need.

One game per session.
