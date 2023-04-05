# gptgames
Simple HTML games and tools created with ChatGPT.

---

**Disclaimer:**

~99.3% of the code has been written and improved by ChatGPT. https://chat.openai.com/
(0.7% were debugging and minor styling tweaks done by me)

Some games contain graphics (mostly background images). Those have been generated with the help of MidJourney.

No cookies, tracking or server-sided data saving is done in this project. All tools are client-sided, limited to JS, CSS and HTML and therefore somewhat safe to use. 

The only exceptions are the Multiplayer Tic-Tac-Toe where the game data is stored in firebase and deleted after each game and Flappy Bird where you can optionally enter a nickname to store your high score in a firestore database.

**View current version:**

https://tobiasmue91.github.io/gptgames/

---

**Jailbreak - used whenever necessary** ⚠️ Use at own risk! Might be patched already.

A good source for up-to-date jailbreaks: https://www.reddit.com/r/GPT_jailbreaks/ 

Collection of Jailbreaks: https://www.jailbreakchat.com/

---

## Changelog
- 05.04.2023 - changed background images; new ones have been generated with MidJourney v5 and prompts created by GPT-4; added [Time Zone Converter](https://tobiasmue91.github.io/gptgames/tools/time_zone_converter.html)
- 02.04.2023 - created AI-powered [QuotoSaurus](https://tobiasmue91.github.io/gptgames/tools/quotosaurus.html); added [Base64 Decoder/Encoder](https://tobiasmue91.github.io/gptgames/tools/base64_encoder_decoder.html)
- 01.04.2023 - removed updates to gpt-4 again, as I somehow lost access to this model; improved `developer.py` and created [Online Notepad](https://tobiasmue91.github.io/gptgames/tools/online_notepad.html) and [Image Comparison Slider](https://tobiasmue91.github.io/gptgames/tools/image_comparison_slider.html)
- 30.03.2023 - first time hitting the API usage limit due to excessive usage and research; added [File Size Converter](https://tobiasmue91.github.io/gptgames/tools/file_size_converter.html) which was created using the `developer.py` script
- 29.03.2023 - updated several tools, utils and games to gpt-4
- 28.03.2023 - added more practical tools: [JSON Formatter](https://tobiasmue91.github.io/gptgames/tools/json_formatter.html), [Age Calculator](https://tobiasmue91.github.io/gptgames/tools/age_calculator.html), [Emoji Search](https://tobiasmue91.github.io/gptgames/tools/emoji_search.html), [CSS Gradient Generator](https://tobiasmue91.github.io/gptgames/tools/css_gradient_generator.html), [Stopwatch](https://tobiasmue91.github.io/gptgames/tools/stopwatch.html)
- 26.03.2023 - did some research in /playground/api_parameters to determine the best values for the GPT-API parameters `temperature` and `top_p`
- 24.03.2023 - added [GPTranslator](https://tobiasmue91.github.io/gptgames/tools/gptranslator.html) - a AI-powered translation tool that can translate text from almost any language to many others
- 23.03.2023 - implemented a timeline feature that lets users see the evolution of the page; clicking on the games or tools on another version will show the user the source code at that point of time
- 22.03.2023 - added end-to-end testing with cypress to the deployment workflow; new features in [Argumentator](https://tobiasmue91.github.io/gptgames/tools/argumentator/argumentator.html) - adding favorites, creating counterarguments
- 21.03.2023 - added a new AI-powered tool called [Argumentator](https://tobiasmue91.github.io/gptgames/tools/argumentator/argumentator.html)
- 20.03.2023 - updated [Connect Four](https://tobiasmue91.github.io/gptgames/games/connect_four.html) - improved design; added opponent AI
- 18.03.2023 - added [Calculator](https://tobiasmue91.github.io/gptgames/tools/calculator.html) written in VueJS (Vue 3) using GPT-4
- 17.03.2023 - implemented [Checkers](https://tobiasmue91.github.io/gptgames/games/checkers.html) in VueJS (Vue 3) using GPT-3.5
- 16.03.2023 - played around with GPT-4 and created a [Jigsaw Puzzle Game](https://tobiasmue91.github.io/gptgames/games/jigsaw.html) (that still has some flaws); improved [Snake](https://tobiasmue91.github.io/gptgames/games/snake.html) with the "endless improvement" method (see [PROMPTS.md](https://github.com/TobiasMue91/gptgames/blob/main/PROMPTS.md))
- 14.03.2023 - gpt-4 released, created [Pong](https://tobiasmue91.github.io/gptgames/games/pong.html) once again for comparison purposes (GPT-4 provided code improvements by saying which function I have to replace or update instead of providing the full updated code)
- 13.03.2023 - bugfixes, mobile design and usability update for [Sudoku](https://tobiasmue91.github.io/gptgames/games/sudoku.html)
- 11.03.2023 - add chimp test and several minor improvements to the [Human Benchmark Tests](https://tobiasmue91.github.io/gptgames/games/human_benchmark.html)
- 10.03.2023 - add new game [Human Benchmark Tests](https://tobiasmue91.github.io/gptgames/games/human_benchmark.html)
- 10.03.2023 - add multiple levels of "leetness" to the text to [1337 converter](https://tobiasmue91.github.io/gptgames/games/1337.html)
- 09.03.2023 - introduction of "[Who Wants to Be a Millionaire?](https://tobiasmue91.github.io/gptgames/games/who_wants_to_be_a_millionaire.html)"