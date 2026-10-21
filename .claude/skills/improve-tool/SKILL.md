---
name: improve-tool
description: Remake one tool on gptgames.dev as the best version of it that can be built today - claim, blind inventory, design thesis, mockup critique, rebuild with a tested core, user tests, PR.
argument-hint: "[tool id, e.g. qr]"
disable-model-invocation: true
---
Remake one tool on gptgames.dev as the best version of it that can be built today.
Make every decision yourself and explain the important ones in the PR. Do not stop to ask me,
unless the claim in step 1 fails.

Tool requested (may be empty): $ARGUMENTS

THE BAR
Measure it against the best version of this tool that exists anywhere, paid or free. Name that
product in your thesis. Not against the old page and not against other pages on this site.
A stranger who arrives from a search in the middle of some other task should get a correct
result within seconds, trust it without checking it elsewhere, and bookmark the page.

WHAT YOU MAY CHANGE
Look, layout, structure and flow are all open. Write the new page from an empty file.
What stays: the file name and URL, a plain name that says what the tool does in the words
people search for, everything the tool can currently do (step 2), links and saved settings
that exist today, and the fact that nothing the person enters leaves their browser.
If the page already has a DOM-free core that a suite in test/ checks, you may keep that core.

1. CLAIM THE TOOL before anything else. With no tool requested above, run
   `python util/claim.py --tools`; with one, run `python util/claim.py tools/<id>.html`.
   It prints the tool that is now yours. If it fails, that tool is taken: stop and tell me.
   The claim branch it pushes is the only extra branch you may push. Never touch another
   session's claim.
2. INVENTORY WITHOUT LOOKING. You do not open the old page or its code until step 8. Send a
   subagent to do it. It returns a functional list and nothing else: every input the tool
   accepts, every output and format, every option, every URL parameter or hash it reads,
   every storage key and its shape, and the exact output for about ten inputs, including
   awkward ones. Not a word about layout, colour or structure. This list is the contract.
3. UNDERSTAND THE JOB. In a few lines: who arrives and what they have in hand (a pasted text,
   a file, a number, a vague question), what they want to leave with, what the best versions
   of this tool do well and where they annoy, and what a phone user needs. Name the one
   moment that matters: the result is there and the person believes it.
   That is your design thesis.
4. THE FIRST TEN SECONDS. Before anything visual, write out step by step what a new visitor
   on a phone sees on arrival, what they touch first, when the result appears, and how they
   take it away (copy, download, link). The tool is usable without scrolling and shows a
   worked example, so nobody faces an empty box. Results update as the input changes; a
   button only where the work is slow or cannot be undone. Then: what happens on bad input,
   on input a thousand times larger than expected, and when they come back tomorrow.
   List every state (example, empty, valid, partly valid, invalid, working, done, failed)
   and what is on screen in each.
5. CHOOSE THE LOOK. Derive it from the thesis and from the material the tool handles: palette,
   typography, shapes, and one motion idea whose only job is to show what just changed.
   The result is the most prominent thing on the page, the person's input the second.
   Type must suit the data: aligned figures for numbers, a real monospace for code. Write
   down why each choice belongs to this tool; a reason that would fit any tool is not a
   reason. The tool may have its own character, but people use it for seconds: quiet beats
   striking.
   Build a static mockup in your scratchpad, not in the repo, in two states: filled with
   realistic, awkward content and its result, and the error state. Screenshot both at desktop
   and phone size. Show the screenshots, one sentence about the tool and the principles below
   to a critic: a subagent that has not seen your reasoning. It reviews as a harsh critic:
   what looks cheap, what is confusing, what would make a stranger doubt the result? It must
   name the three worst defects and give scores from 1 to 10 for first impression, clarity,
   trust and phone. Do not tell it the pass mark or which round it is. Revise until every
   score is at least 8, for at most three rounds.
6. BUILD IT as CLAUDE.md describes a page.
   Correctness: the logic lives in a DOM-free core with a suite in test/. Derive it from the
   authoritative source (the spec, the standard, the published formula), not from the old
   page. Test it with published test vectors or independently checked values, and with the
   inputs that break tools: empty, whitespace, huge, malformed, non-ASCII, zero and negative,
   decimal comma, and the boundaries of the domain (leap days, time zones, rounding). Keep the
   suite in proportion: a text reformatter needs a dozen cases, anything that calculates
   money, dates or units needs many more.
   Input: accept what people actually paste, with stray spaces, units and either decimal
   separator. Never lose it: not on error, not on reload, and undo works. Errors appear next
   to the field that caused them, in plain words, saying what would be accepted.
   Speed: typing never stutters. Heavy work runs off the main thread, shows progress and can
   be cancelled.
   Access: every control is labelled and reachable by keyboard, the phone shows the right
   keyboard for each field, and result changes are announced to screen readers.
   No layout jumps when a result or error appears, readable contrast, reduced motion
   respected, no console errors, no network request that carries the person's data.
7. CHECK AGAINST THE CONTRACT. Run the inventory's sample inputs through the new tool. Every
   difference is a bug in yours or a bug in the old one: decide which and say so in the PR.
   Every capability on the list is either present or dropped with a reason in the PR. Old
   links with parameters still work and saved settings are migrated.
8. TEST IT ON SOMEONE, IN ROUNDS. Write three tasks in a visitor's words, not the tool's
   ("I have this and need that"), one of them with messy input. Give each to a fresh subagent
   that knows nothing but the local URL and the task. It works in headless Chromium at phone
   size from screenshots and clicks alone, without reading the source, and reports what it
   tried, where it hesitated, how many actions it took and the result it got. Check that
   result yourself.
   Then give a fresh critic, as in step 5, screenshots of every state on desktop and phone,
   the testers' reports and, now, the old page for comparison. It also scores speed to
   result. Fix the biggest issues and repeat until every score is at least 8 and no tester
   got stuck, for at most three rounds. If you disagree with the critic, show why in the next
   round instead of arguing. If a score is still below 8 after the last round, say so in the
   PR with the open defects. Do not call it done.
9. HOUSEKEEPING AND COMMIT as in CLAUDE.md. The commit message says what the tool does, what
   changed for the person using it, and why it looks and works the way it does. Push, open a
   PR, and give me before/after screenshots, the contract check from step 7, the testers'
   action counts and the critic's last scores.

PRINCIPLES

* Correct before beautiful. A wrong result is a failure at any level of polish.
* The result is the page. Everything else is on screen only while it helps someone reach it.
* Faithfulness is owed to what the tool does for people, not to how it used to look.
* The tool explains itself through labels, a worked example and a live result. A paragraph of
  instructions means the design has not done its job. The exception is trust: where the
  result depends on a method or assumption (which standard, which rounding), say so in one
  line near the result.
* The default is right for most people. An option exists only where real needs differ, and
  rare ones are folded away.
* Every visual choice is deliberate: if you cannot say why this font, this colour and this
  shape belong to this tool and not to any other, choose again.
* Take nothing from the person: no sign-up, nothing sent anywhere, nothing stored that would
  surprise them, and no content of theirs in a link they did not ask for.

One tool per session.
