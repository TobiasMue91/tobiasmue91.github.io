## Gaps worth filling

Checked against the catalogue on 2026-08-21 (89 games, 196 tools) and picked to fit the constraints the
rest of the collection works under — one file, no assets, reproducible from a seed. Anything here may
have been built since; the point is the shape of the gap, not the specific suggestion.

**Games**

- **Deck-builder.** The card games here are all classics — blackjack, freecell, crazy eights. None
  build a deck across a run.

Filled since: hidden-rule deduction, by `games/glyphgate.html`; cooperating with recordings of your
own past, by `games/selfsame.html`; **pinball**, by `games/escapement.html` — swept-circle continuous
collision so nothing tunnels at any speed, flippers you can cradle on, habitrails, a slingshot that
throws along its own rubber, and a mission stack that bolts new parts onto the playfield as you go.
The physics core in it is reusable, though the two candidates once listed here for it are both rejected
below — a reusable core is a reason a build is cheap, never a reason the result is worth playing.

**Tools**

- **CSS keyframe editor.** Nine CSS tools exist and none of them touch `@keyframes`.
- **Cubic-bezier easing editor.** Pairs naturally with the above.
- **WCAG contrast checker.** There is a colour-blindness simulator but no contrast ratio checker.
- **CSS clip-path editor.** Visual polygon editing with copyable output.
- **Aspect ratio calculator** and **browser storage explorer** — small, useful, and on the list below
  for years.

Filled since: classical cryptanalysis, by `tools/cribwork.html` — cipher identification from the index of
coincidence, solvers for the Caesar/affine/substitution/Vigenère/transposition families, and a cryptogram
worksheet. Nothing in the catalogue had touched ciphers beyond the toy converters (`1337`, `morse_code_translator`,
`base64_encoder_decoder`), which is the shape of gap worth looking for: a whole subject the collection only
gestures at. The neighbouring one still open is **cipher-based puzzle games** (nothing here is a word game
built on deduction from letter statistics).

Filled since: **fonts**, by `tools/sorts.html` — the structural gap in the tool catalogue: 215 tools, a great
deal of text and typography work among them, and not one that opened a font file. `file_type_identifier` sniffed
magic bytes and stopped; `character_map_explorer` browsed Unicode knowing nothing about any font. Sorts parses the
sfnt container itself — cmap, name, OS/2, post, fvar, GSUB/GPOS — and leads with the question people actually have:
paste your text and it names every character the font cannot draw. Three things in it are worth reusing. The parser
was checked field by field against fontTools over 147 real fonts and matches exactly, cmap coverage included, which
is the only reason the coverage and language claims can be stated flatly rather than hedged. Two cheaper approaches
were measured and thrown away first: detecting coverage by canvas width comparison scored 79.8% against the true
cmap, and pixel-exact render comparison did worse at 59.4% with 4,442 false positives — both depend on the reader's
installed fallback fonts, so neither can be trusted to describe a file. And the feature list measures rather than
asserts: each OpenType feature is rendered on and off and the advance widths compared, so the ones that genuinely
change your text are marked and the ones that do nothing to it are not oversold.

Still open on this side: **WOFF2 cannot be read byte by byte in a browser.** Its tables live in one Brotli stream and
`DecompressionStream` offers gzip and deflate but not br (checked, Chrome 141). A dictionary-free Brotli decoder would
have been small enough to ship, but 274 of 276 real WOFF2 files sampled from Google Fonts use the static dictionary,
so that shortcut is closed — full support means carrying the ~120KB dictionary. Sorts reads the WOFF2 table directory,
which is uncompressed, and renders the font, and says plainly that the rest is out of reach. The neighbouring gap still
open is **hinting and rasterisation**: nothing here shows what a font does at 11px, where hinting and `gasp` decide
whether it is readable at all.

Filled since: **pitch**, by `tools/overtone.html` — the audio-side version of the same gap, where a dozen
audio tools existed and not one showed you pitch. It is framed as an instrument rather than a tuner: a
cent-accurate pitch ribbon over time, a log-frequency spectrogram, a harmonic ladder that measures how far
each partial sits from a whole-number multiple (enough to show piano-string inharmonicity), and per-note
vibrato rate and depth, attack settling, sway and drift, plus a profile accumulated across held notes.
Two things in it are reusable: a YIN detector whose clarity gate was tuned by measurement (0.88 removed
all 729 octave errors across 5,760 synthetic frames while keeping every clean one), and the observation
that a pitch track is a moving average of the analysis window, so vibrato depth is attenuated by
sinc(pi·fv·W/sr) and can be corrected back out. Still open on the audio side: **rhythm and timing**
(nothing measures how far off the beat you are), and **polyphonic** pitch — Overtone is monophonic and
reports the common subharmonic of a chord rather than trying to guess that it is hearing one. An attempt
to detect chords from the spectrum was removed after it turned out to fire on hummed low notes: a
microphone that rolls off the fundamental leaves a spectrum shaped much like a chord's, and every
statistic that separated the two also mistook quiet fundamentals for chords.

Filled since: **minigolf**, by `games/nine_holes.html`. Worth reusing are three results, all of which
contradicted what the design assumed before it was measured.

The cup's capture speed, not the level generator, decided whether open holes could exist at all. A
forgiving cup swallows any weight, so on a hole where you can see the flag every power drops and the
acceptance filter throws it out as a barn door — silently banning open holes and leaving a course of
nothing but blind doglegs. Over 2,400 candidates: at capture 9, 3% of accepted holes had line of sight
and 27% were rejected as barn doors; at capture 4, 31% and 4%. A single physics constant was producing
what read as a level-design problem.

"Every hole can be aced" was true and hollow. The coarse angular sweep only proves an ace exists near
some angle; refining it showed 10% of accepted holes had an ace window under one degree. The judge now
measures the real angular tolerance and requires 1.25 degrees, so the median hole gives you 2.25 and the
promise survives contact with a human hand.

Par cannot come from the optimum when every hole is aceable by construction — the optimum is always 1.
It has to come from how a plausible player actually fares, which makes the player model a tuned
parameter rather than a detail: at 2 degrees of aim error 95% of holes came out par 2 and difficulty
stopped showing, at 6 degrees par 5 became common, and 1.5 degrees gives 59% par 2 and 32% par 3 with
mean par rising across the tiers. The round is then ordered by measured par rather than by the nominal
difficulty tier, because the tiers turned out not to be monotone — tightening corridors made some holes
easier. Mean par by position is now 2, 2, 2, 2, 2.25, 2.5, 2.88, 3.5, 4.

The general lesson, which is the same one the rejected tactics prototype produced: the fraction of an
action space that is "good" measures nothing, because the space is mostly nonsense. Ask instead whether
a deliberately stupid player reaches the good play.

## Tried and rejected

Built or prototyped, then deliberately not shipped. These are **not** open gaps — do not re-propose
them, and do not treat the empty space they leave in the catalogue as an opportunity. The catalogue
being thin somewhere is not on its own a reason to build there. Two of the entries below were
recommended as gaps for exactly that bad reason before being turned down; an empty category is
evidence about the catalogue, not about whether anyone wants to play the thing that would fill it.

- **Air hockey.** Rejected. Not because the physics duplicates `pong` — a free 2D mallet with real
  momentum transfer is a genuinely different control space from a paddle on a rail — but because
  nothing about that survives to the catalogue card, where it reads as two paddles and a bouncing
  thing, and the momentum transfer that makes it interesting is already the whole of `8-ball`. A worse
  `pong` next to a better `8-ball`.

- **Line-routing sims** (Mini Metro's shape: growing demand, limited track, procedural maps). Rejected
  on taste. The genre as a whole, not this framing of it.

- **Turn-based tactics on a grid** (Into the Breach's shape: small grid, perfect information, enemies
  that telegraph next turn's move). Rejected on taste, not on mechanics — it was tried and was not
  interesting enough to put on the page. `strategy` being the thinnest category does not resurrect it.
  Nor do its variants: the version where the player has no weapon at all and every kill comes from
  shoving enemies into each other, into walls, or into their own crossfire, is the same idea and is
  also rejected.

  Worth keeping from the prototyping, because it generalises past this idea: exhaustive enumeration
  showed that under 1% of legal turns were both safe and productive, which looked like difficulty and
  was not. A deliberately myopic greedy player — deflect unit by unit, no lookahead — survived 97% of
  solvable boards. Density of good plays in an action space measures nothing; the space is mostly
  pointless wandering. Measure instead whether a stupid heuristic reaches the good play.

## Other
- household planner
  - single time tasks that are removed after being completed
- autocontinue script
  - on network error, copy the text that has already been written and append it to the last user message with the words "you already started responding but got cut off due to an error: <cutMessage>"
- argumentator
  - add permalinks to the generated arguments
- auto-improver script
  - improvement history, to prevent repeated or duplicate improvements
- userscript to let gpt-4 communicate with gpt-3.5

## Practical Tools
- csv<->json converter
- text<->morse converter
- text<->emoji converter (GPTranslator can do that! :D)
- form builder
- text<->ascii converter
- ASCII Art Generator
- Image to Text Converter
- CSS Beautifier
- Akinator
- CSS Animation Creator: An editor to create custom CSS animations with keyframes, easing, and delay settings.
- Broken Link Checker: A tool to check a list of URLs for broken links and report their status.
- Currency Converter: A real-time currency converter using exchange rate APIs to provide accurate conversions.
- SVG Editor: A simple SVG editing tool to modify shapes, colors, and sizes of SVG files.
- Audio Visualizer: A tool to generate visual representations of audio files based on waveform or frequency data.
- Browser Storage Explorer: A tool to view and manage browser storage (local and session storage) data for debugging purposes.
- CSS Flexbox Builder: A visual builder for creating and customizing CSS flexbox layouts, generating the corresponding code.
- Keyboard Shortcut Tester: A tool for users to test and discover various keyboard shortcuts for different operating systems and applications.
- Favicon Generator: A tool to create and download favicons in multiple sizes and formats from an uploaded image.
- Image Placeholder Generator: A tool to generate placeholder images with customizable dimensions, colors, and text for use during website development.
- Website Color Extractor: A tool to extract the color palette from a website URL or CSS code.
- Online Flowchart Maker: A simple flowchart creation tool with drag-and-drop functionality.
- Aspect Ratio Calculator: A tool to calculate the aspect ratio of images or videos, and resize dimensions while maintaining the aspect ratio.
- CSS Grid Builder: A visual builder for creating and customizing CSS grid layouts, generating the corresponding code.
- Font Pairing Tool: A tool to preview and compare different font pairings for web design.
- Image to ASCII Converter: A tool to convert images into ASCII art, with options for customization.
- Morse Code Translator: A tool to convert text to Morse code and vice versa.
- Online Banner Maker: A simple banner creation tool to design custom banners for websites and social media.
- Online Signature Maker: A tool to create and download digital signatures using a drawing interface.
- CSS Variables Generator: A tool to manage and generate CSS variables for consistent styling across projects.
- Online Mind Mapping: A simple mind mapping tool to organize and visualize ideas and concepts.
- CSS Transform Playground: A playground for experimenting with CSS transform properties, such as scale, rotate, and skew.
- Browser Compatibility Checker: A tool to check the compatibility of HTML, CSS, and JavaScript features with various browser versions.
- CSS Blend Modes Generator: A tool to experiment with different CSS blend modes on images or backgrounds.
- Online Whiteboard: A collaborative whiteboard tool for users to draw, write, and share ideas in real-time.
- Sitemap Visualizer: A tool to generate visual sitemaps from XML files or website URLs.
- Web Accessibility Checker: A tool to identify potential accessibility issues in HTML and CSS code.
- Online Photo Collage Maker: A tool to create custom photo collages from uploaded images.
- CSS Clip Path Generator: A tool to create and export custom CSS clip paths using a visual editor.
- Browser Mockup Generator: A tool to generate browser mockups of websites or app interfaces.
- Online Diagram Maker: A tool for creating various types of diagrams, such as flowcharts, Venn diagrams, and organizational charts.
- Online Sticky Notes: A tool to create, edit, and manage digital sticky notes.
- CSS Pseudo-Class Tester: A tool to experiment with various CSS pseudo-classes and see their effects in real-time.
- Online Logo Maker: A simple logo creation tool with customizable shapes, colors, and fonts.
- File Format Converter: A tool to convert files between different formats, such as image, audio, or document types.
- Character Encoding Converter: A tool to convert text between different character encodings, like UTF-8, ISO-8859-1, and Windows-1252.
- Online Icon Editor: A tool to create and modify icons in various sizes and formats, such as ICO, PNG, and SVG.
- CSS Filters Playground: A playground for experimenting with different CSS filters, such as blur, brightness, and contrast.
- Online Post-it Board: A collaborative board for users to create, edit, and organize digital Post-it notes.
- CSS Selector Tester: A tool to test and experiment with CSS selectors on sample HTML code.
- CSS Box Model Visualizer: A tool to visualize and understand the CSS box model, with options to modify padding, border, and margin values.
- Online Calendar Creator: A tool to create and download custom calendars with customizable dates, holidays, and events.
- JavaScript Event Listener Tester: A tool to test and experiment with JavaScript event listeners and their effects on HTML elements.
- Web Font Tester: A tool to preview and compare different web fonts on sample text, with options to adjust size, color, and other styling properties.
- Online Receipt Generator: A tool to create and download custom receipts for personal or business purposes.
- CSS Background Patterns Generator: A tool to create and customize repeating background patterns using CSS.
- "AI Cooking Challenge": Players input ingredients they have on hand, and your API generates creative and unique recipes to try. Players can adjust the complexity, cuisine style, and dietary preferences.
- "CodeGPT": Players input the desired functionality and language for a simple programming task, and your API generates the necessary code. Players can adjust the level of optimization, readability, and programming paradigms.
- "AI Poetry Slam": Players input a theme, style, and mood for a poem, and your API generates a unique poem based on their preferences. Players can challenge friends to create better poems with the same parameters and vote on their favorites.
- "GPT Mind Mapper": Users input a central topic or problem, and your API generates a mind map with related subtopics, ideas, and connections. Users can customize the map's complexity, depth, and level of detail.
- "AI Study Buddy": Users input a subject, topic, or question, and your API generates a concise summary, explanation, or tutorial. Users can adjust the level of detail, difficulty, and learning style.
- "GPT DIY Guide": Users input a home improvement or repair project, and your API generates step-by-step instructions and a list of necessary tools and materials. Users can adjust the level of detail, difficulty, and project type.
- "AI Riddle Inventor": Players input a topic or theme, and your API generates original riddles with answers. Players can adjust the difficulty, humor, and complexity of the riddles.
- "GPT Skill Builder": Users input a skill they want to learn or improve (e.g., public speaking, negotiation, cooking, etc.) and provide their current level of expertise. Your API generates a customized learning plan with resources, exercises, and milestones. Users can adjust the level of detail, pace, and focus on specific sub-skills.
- "AI Life Event Planner": Users input the type of event they're planning (wedding, party, corporate function, etc.) and provide relevant details, such as budget, guest count, and theme. Your API generates a comprehensive plan, including checklists, timelines, and vendor recommendations. Users can adjust the level of detail, uniqueness, and formality.
- "GPT Creative Prompt Generator": Users input a preferred medium (writing, painting, photography, etc.) and a theme or emotion, and your API generates a series of unique creative prompts to inspire their work. Users can customize the level of challenge, abstractness, and number of prompts generated.
- "AI Text Naturalizer" which aims to modify AI-generated text to make it appear more human-like and less recognizable by tools like ZeroGPT.
- CSS Grid Layout Generator
- Invoice Generator
- SVG Editor
- Font Pairing Tool
- Animated GIF Maker
- Photo Collage Creator
- Color Palette Generator
- Website Screenshot Tool
- Online Video Trimmer
- Icon Library and Generator
- Audio Converter
- Video to GIF Converter
- Online Flowchart Maker
- Online Mind Map Creator
- Text to Speech Converter
- Speech to Text Transcription Tool
- Online Meme Generator
- Online Video Editor
- Character Name Generator
- Online Logo Maker
- Browser Compatibility Checker
- Email Signature Generator
- Language Translator
- Online Music Editor
- Social Media Post Designer
- Recipe Builder
- Online PDF Editor
- Banner Ad Creator
- Online Calendar Maker
- GIF to Video Converter
- Online Whiteboard
- Social Media Image Resizer
- IP Address Lookup Tool
- Online File Converter
- Online XML Editor
- Resumé Builder
- Online Sketchpad
- Website Accessibility Checker
- Online Video Subtitle Editor
- Screen Recorder
- Online Slideshow Maker
- Online Budget Planner
- Online Grammar Checker
- Online Image Vectorizer
- Color Contrast Checker
- Meta Tag Analyzer
- Online Poster Maker
- Online Typography Generator
- Online Icon Editor

## Games
- War (Card Game)
- Snake Ladder
- Bouncing Ball Shooter
- Pac-Man clone
- Trivia Quiz
- Crossword Puzzle
- Jigsaw Puzzle
- Solitaire
- Pinball
- Roulette
- Shooting Gallery
- Scrabble
- Checkers
- Backgammon
- Bingo
- Racing Game
- Platformer
- Maze Runner
- Archery Game
- Ice Hockey
- Pool
- Basketball
- Air Hockey
- Racing Game clone
- Tower Defense
- Dragon Slayer
- Kung Fu Fighting
- Mastermind
- Music Rhythm Game
- Treasure Hunt
- Ball Drop Game
- Coding challenges as game idea provider
- human benchmark


## Plugins
- a plugin that looks for the cheapest price of a specific product.
- a plugin for web developers that lets users perform acceptance (or E2E) tests on a specified web service; can be expanded to let ChatGPT also perform performance checks, look for console errors, check for security flaws and be a mighty tool for asserting the quality a website as a whole while giving improvement suggestions
- use ChatGPT to assign a trust value to a website; as the web is flooded with scam sites, fake shops and unserious businesses and ChatGPT might be able to detect and analyze such websites before they even appear on TrustPilot and co
- a "discover" plugin that helps the user to discover new content for specific topics (music, tv series, movies etc.) while ChatGPT considers the users taste based on existing public accessible information (imdb ratings given by the user, spotify favorite song playlists, myanimelist list etc.) or based on a list of favorites provided by the user

## API Functions
- add web search functionality
- web voice assistant (maybe app later)