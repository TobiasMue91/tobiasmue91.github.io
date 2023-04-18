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

https://www.gptgames.dev/

---

**Jailbreak - used whenever necessary** ⚠️ Use at own risk! Might be patched already.

A good source for up-to-date jailbreaks: https://www.reddit.com/r/GPT_jailbreaks/ 

Collection of Jailbreaks: https://www.jailbreakchat.com/

---

## Changelog
- 18.04.2023 - milestone achieved: 100 different tools and games created with ChatGPT; added the AI powered [Name Generator](https://www.gptgames.dev/tools/name_generator.html), [Movie Script Generator](https://www.gptgames.dev/tools/movie_script_generator.html), [Online Kanban Board](https://www.gptgames.dev/tools/online_kanban_board.html), [Online Pixel Art Editor](https://www.gptgames.dev/tools/online_pixel_art_editor.html), [Image Cropper](https://www.gptgames.dev/tools/image_cropper.html) and many more (admittedly, some of them were very low effort)
- 06.04.2023 - moved to [www.gptgames.dev](https://www.gptgames.dev/) 🥳; added [Paste to Markdown](https://www.gptgames.dev/tools/paste_to_markdown.html) and [HTML Table Generator](https://www.gptgames.dev/tools/html_table_generator.html)
- 05.04.2023 - changed background images; new ones have been generated with MidJourney v5 and prompts created by GPT-4; added [Time Zone Converter](https://www.gptgames.dev/tools/time_zone_converter.html) and [Online Voice Recorder](https://www.gptgames.dev/tools/online_voice_recorder.html)
- 02.04.2023 - created AI-powered [QuotoSaurus](https://www.gptgames.dev/tools/quotosaurus.html); added [Base64 Decoder/Encoder](https://www.gptgames.dev/tools/base64_encoder_decoder.html)
- 01.04.2023 - removed updates to gpt-4 again, as I somehow lost access to this model; improved `developer.py` and created [Online Notepad](https://www.gptgames.dev/tools/online_notepad.html) and [Image Comparison Slider](https://www.gptgames.dev/tools/image_comparison_slider.html)
- 30.03.2023 - first time hitting the API usage limit due to excessive usage and research; added [File Size Converter](https://www.gptgames.dev/tools/file_size_converter.html) which was created using the `developer.py` script
- 29.03.2023 - updated several tools, utils and games to gpt-4
- 28.03.2023 - added more practical tools: [JSON Formatter](https://www.gptgames.dev/tools/json_formatter.html), [Age Calculator](https://www.gptgames.dev/tools/age_calculator.html), [Emoji Search](https://www.gptgames.dev/tools/emoji_search.html), [CSS Gradient Generator](https://www.gptgames.dev/tools/css_gradient_generator.html), [Stopwatch](https://www.gptgames.dev/tools/stopwatch.html)
- 26.03.2023 - did some research in /playground/api_parameters to determine the best values for the GPT-API parameters `temperature` and `top_p`
- 24.03.2023 - added [GPTranslator](https://www.gptgames.dev/tools/gptranslator.html) - a AI-powered translation tool that can translate text from almost any language to many others
- 23.03.2023 - implemented a timeline feature that lets users see the evolution of the page; clicking on the games or tools on another version will show the user the source code at that point of time
- 22.03.2023 - added end-to-end testing with cypress to the deployment workflow; new features in [Argumentator](https://www.gptgames.dev/tools/argumentator/argumentator.html) - adding favorites, creating counterarguments
- 21.03.2023 - added a new AI-powered tool called [Argumentator](https://www.gptgames.dev/tools/argumentator/argumentator.html)
- 20.03.2023 - updated [Connect Four](https://www.gptgames.dev/games/connect_four.html) - improved design; added opponent AI
- 18.03.2023 - added [Calculator](https://www.gptgames.dev/tools/calculator.html) written in VueJS (Vue 3) using GPT-4
- 17.03.2023 - implemented [Checkers](https://www.gptgames.dev/games/checkers.html) in VueJS (Vue 3) using GPT-3.5
- 16.03.2023 - played around with GPT-4 and created a [Jigsaw Puzzle Game](https://www.gptgames.dev/games/jigsaw.html) (that still has some flaws); improved [Snake](https://www.gptgames.dev/games/snake.html) with the "endless improvement" method (see [PROMPTS.md](https://github.com/TobiasMue91/gptgames/blob/main/PROMPTS.md))
- 14.03.2023 - gpt-4 released, created [Pong](https://www.gptgames.dev/games/pong.html) once again for comparison purposes (GPT-4 provided code improvements by saying which function I have to replace or update instead of providing the full updated code)
- 13.03.2023 - bugfixes, mobile design and usability update for [Sudoku](https://www.gptgames.dev/games/sudoku.html)
- 11.03.2023 - add chimp test and several minor improvements to the [Human Benchmark Tests](https://www.gptgames.dev/games/human_benchmark.html)
- 10.03.2023 - add new game [Human Benchmark Tests](https://www.gptgames.dev/games/human_benchmark.html)
- 10.03.2023 - add multiple levels of "leetness" to the text to [1337 converter](https://www.gptgames.dev/games/1337.html)
- 09.03.2023 - introduction of "[Who Wants to Be a Millionaire?](https://www.gptgames.dev/games/who_wants_to_be_a_millionaire.html)"