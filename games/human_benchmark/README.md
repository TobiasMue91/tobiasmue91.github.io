# Human Benchmark Tests

A free, open-source collection of cognitive benchmark tests. Part of the GPTGames showcase of AI-authored web tools.

*Parts of this readme are already outdated, as we've consolidated all html and js files into the index.html after this has been provided by Claude. Everything written in Italic are notes by me, the maintainer of this project.*

## What's here

A static web app with 24 short tests covering reaction time, memory, perception, attention, language, and reasoning. The landing page groups them into six categories. All progress is saved to `localStorage` — no accounts, no backend, no tracking beyond an optional GoatCounter snippet.

## Running locally

*Just open human_benchmark/index.html in any browser.*

~~Serve the directory with any static HTTP server. Don't open `index.html` directly via `file://` — jQuery's `$.getScript` and `$.get` need HTTP to resolve relative paths.~~

```
npx serve .
# or
python3 -m http.server 8000
```

~~Then open `http://localhost:8000`.~~

## Project structure

```
index.html                  Entry point. Renders landing grid at runtime from tests.js.
styles.css                  Theme system (CSS variables), component styles.
js/
tests.js                  Single source of truth for test metadata.
utils.js                  window.HB helpers (modal, toast, sound, etc.).
score.js                  Score persistence + stats modal.
main.js                   Routing, landing grid, theme toggle.
<test_id>.js              One module per test.
html/
<test_id>.html            One markup file per test.
img/benchmark/*.webp        Assets for the Emotion Recognition test (optional; emoji fallback otherwise).
audio/ping.mp3              Audio for Sound Localization.
```

## Adding a new test

1. **Pick an ID.** Lowercase snake_case, e.g. `digit_span`. It's used as the URL hash, filename, and localStorage identifier.
2. **Add a metadata entry to `js/tests.js`:**

   ```js
   { id: 'digit_span', name: 'Digit Span', icon: '🔟',
     description: 'Recall a sequence of digits.',
     genre: 'Memory', lowerIsBetter: false, scoreUnit: 'level',
     storageKey: 'Digit Span' }
   ```

3. **Create `html/digit_span.html`.** Start with the `<div id="digit-span-test" class="test-screen tab-content max-w-4xl mx-auto px-4">` wrapper. Use existing tests as references for markup conventions.
4. **Create `js/digit_span.js`.** Wrap everything in `$(function () { ... })`. Call `saveScore('Digit Span', score, lowerIsBetter)` on game over. Use `HB.showModal(...)` for results.
5. **Update the JSON-LD** in `index.html`. This block is static so search engines without JS still see the tests — keep it in sync with `tests.js` when you add or remove entries.
6. **Update the manual test checklist** in this README.

## The `TESTS` metadata contract

Each entry:

| Field | Meaning |
|---|---|
| `id` | URL hash + filename stem |
| `name` | Human-readable title |
| `icon` | Emoji shown on the card |
| `description` | One-line card subtitle |
| `genre` | Tag (Memory, Reflex, Language, etc.) |
| `lowerIsBetter` | `true` for metrics like ms error, reaction time |
| `scoreUnit` | Display unit (`ms`, `WPM`, `level`, etc.) |
| `storageKey` | Key used in `localStorage['humanBenchmarkScores']`. Must match the first argument passed to `saveScore()` in the test's JS. |

## localStorage schema

Keys:

- `humanBenchmarkScores`: `{ [storageKey]: bestScore }`
- `humanBenchmarkHistory`: `{ [storageKey]: [{ score, scoreNum, timestamp, isBest }] }` (capped at 50 per test)
- `humanBenchmarkSchemaVersion`: integer; currently `1`. Migrations live in `score.js`.
- `hb_theme`: `"dark"` | `"light"`. Absent means "follow OS preference".
- `hb_sound_enabled`: `"true"` | `"false"`.

When changing the shape of the first two, bump `CURRENT_SCHEMA_VERSION` in `score.js` and add a migration block.

## Keyboard shortcuts

- `Esc` — close any open modal; if none is open, return to the home screen.
- Per-game keys are documented in each test's intro copy.

## Manual test checklist

Run through each test after non-trivial changes. For each:

1. Start from the landing grid, click the card.
2. Play one full round.
3. Hit game-over, verify the results modal shows.
4. Check that the best-score display updates in the header.
5. Open Statistics, verify the new entry appears.
6. Click Home, click the card again, verify saved best persists.

Priority tests to check because they had recent bug fixes:

- **Blind Timer Challenge** — make a bad attempt first (off by >2s), then a better one (~100ms). Confirm best stores the *closer* attempt.
- **Sound Localization** — same pattern; best should be the *lowest* error percentage.
- **Pattern Memory** — play past level 10 on a small viewport; grid should cap at 7×7 and remain visible.
- **Chimp Test** — rotate device between rounds; grid columns should adjust.
- **Emotion Recognition** — if `img/benchmark/` is missing, app should fall back to emoji (with a toast).

## Known limitations

- No backend, no cross-device sync. Clearing browser data wipes scores.
- **Color Discrimination** inherently requires color vision. *duh*
- **Sound Localization** requires headphones or stereo speakers.
- Tailwind is loaded via CDN runtime compiler. Fine for this project; not recommended for high-traffic production use.

## Non-goals

- No user accounts.
- No leaderboards or cloud sync.
- No analytics beyond the existing GoatCounter.
- No gradients in the design.