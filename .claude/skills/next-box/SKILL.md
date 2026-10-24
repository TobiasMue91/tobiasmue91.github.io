---
name: next-box
description: Add the next box to Contents May Vary (games/contents_may_vary.html), the incremental anthology - compare ideas against the ledger, build a pure core with bots, a view in its own art direction, filmstrip critique rounds, update the rulebook, PR.
argument-hint: "[optional: an idea for the box]"
disable-model-invocation: true
---
Add one new box to Contents May Vary: a complete incremental game, 30 to 90 minutes long, with a
mechanic and an art direction unlike every box before it. Make every decision yourself and explain
the important ones in the PR. Do not stop to ask me.

Idea requested (may be empty): $ARGUMENTS

THE BAR
Each box has to stand on its own as a game someone was paid to make, and it has to surprise a player
who has opened every box before it.

1. READ `CONTENTS_MAY_VARY.md` in full: the rules, the contract, the ledger, the ideas and the
   lessons. Run `npm run test:cmv` and keep it green from here on. Claim the page with
   `python util/claim.py games/contents_may_vary.html`, so no other session works on it at the
   same time; stop if the claim fails.
2. CHOOSE. First read **What the owner plays** in CONTENTS_MAY_VARY.md and answer its checklist for
   every candidate; a candidate with a dull answer is out. Even with an idea requested, write down at least eight pairs of mechanic and art
   direction and score each for surprise, depth, fit to 30 to 90 minutes, and distance from the
   ledger's seven axes (rule 3). Pick one; name it (id, title, handling note). Two lines in the PR
   on why this box, and why after the last one.
3. THE RULES FIRST. Write the core in your scratchpad: `init`, `step`, `act`, `done`, `progress`,
   `milestones`, an eager and a casual bot with a person's limits. Tune with `KIT.simulate` across
   several seeds until both bots land in the window with no cliff and no dead stretch.
4. THE LOOK. Derive the art direction (medium, palette, type, motion, sound, the interface
   metaphor) from the box's theme, mock up one frame at phone and desktop size, and have a critic
   subagent that has not seen your reasoning score it (first impression, clarity, art direction,
   phone). Revise until every score is at least 8. Decide how the box teaches itself in its first
   thirty seconds and how it ends with a box of its own (rule 8).
5. BUILD the view as a `<template data-world>` and splice it, with the core, above the marker in
   `games/contents_may_vary.html`. Add the id to `SHIPPED` in `test/contents_may_vary.mjs`, and a
   suite for the box if one of its rules could break quietly. Keep within the budget (rule 2).
6. PLAY AND CRITIQUE. With `?world=<id>` and `&at=<minutes>`, drive the box with real input in
   headless Chromium on a phone and a desktop. Record filmstrips (8 to 12 frames) of the first
   minute, a typical action, each big moment and the ending, and give them to a fresh critic, now
   also scoring feel. Fix the biggest issues and repeat until every score is at least 8, for at
   most four rounds; if a score stays lower, say so in the PR.
7. WRITE IT DOWN. Fill in the box's row in the ledger and its pacing, move the runners-up into the
   ideas, add what you learnt to the lessons. Set the page's `updated` date in `data/games.json`
   (CLAUDE.md, "Changing an existing game or tool"), commit, push, open a PR, and give me the
   filmstrips and the critic's last scores.

One box per session.
