# GPTGames

Over 110 browser games and 200 browser tools, almost all of them written by language models.
Plain HTML, CSS and JS — every page is a single self-contained file, no framework, no build step.

**View current version:** https://www.gptgames.dev/

---

**Disclaimer:**

~99.3% of the code has been written and improved by AI — first [ChatGPT](https://chatgpt.com/),
today mostly [Claude](https://claude.ai/). Other models are tested as they appear.
(0.7% were debugging and minor styling tweaks done by me)

Some games contain assets (mainly background images). The images have been generated with the help of MidJourney and some sounds have been taken from pixabay.

No cookies, tracking or server-sided data saving is done in this project. Almost all tools are client-sided, limited to JS, CSS and HTML.

Some data is stored in firebase and firestore. (multiplayer functionality in Tic-Tac-Toe and Rock-Paper-Scissors, highscores in Flappy Bird, savegames in Family Feud and Who Wants to Be a Millionaire and plans from the Household Planner)

A few dozen tools call a language model through a Cloudflare Worker proxy, so no API key ever sits in a page.

## Workflow

The early entries were copy-pasted out of a chat window. These days most work runs through
[Claude Code](https://claude.com/claude-code), usually from the web app against this repository:

- `CLAUDE.md` tells the agent how a page is built and what has to be touched when one is added.
- `IDEAS.md` is the backlog; new entries are pitched from there.
- A session develops on its own branch and opens a pull request; merging to `main` publishes,
  since GitHub Pages serves the repository as-is.

Registering a finished page is still five edits (`games/` or `tools/`, the JSON catalogue,
`sidebar.html`, `sitemap.xml`, a screenshot) — `util/new_entry.py` does them interactively,
and `util/update.py` refreshes dates and stale screenshots.

## Documentation

- [Ideas for Future Projects](https://www.gptgames.dev/IDEAS) - Explore potential future additions to the collection.
- [Prompt Examples](https://www.gptgames.dev/PROMPTS) - See examples of prompts used to create the games and tools.
- [Prompt Engineering Tips](https://www.gptgames.dev/TIPS) - Discover tips and tricks for effective prompt engineering.
- [Instruction for Custom GPTs](https://www.gptgames.dev/GPTS) - Instructions for GPT's that have been created by me.

## Attribution

GPTGames is released under the MIT License, meaning you're free to use, modify, and distribute this project however you like. If you found this project helpful or are using it as the foundation for your own work, I'd appreciate (though don't require) the following:

- A simple mention that your project is based on GPTGames.dev
- A link back to the original repository
