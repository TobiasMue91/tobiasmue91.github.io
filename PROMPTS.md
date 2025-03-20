## ChatGPT Instructional Prompt
- can be found in `model_comparisons.json` from chat data export

```json
{
  "content_type": "system_content",
  "model_identity_desc": "You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.",
  "instructions": "Image input capabilities: Enabled",
  "conversation_start_date": "2023-12-31T14:33:58.565259",
  "deprecated_knowledge_cutoff": "2023-04-01",
  "tools_section": {
    "python": "When you send a message containing Python code to python, it will be executed in a
    stateful Jupyter notebook environment. python will respond with the output of the execution or time out after 60.0
    seconds. The drive at '/mnt/data' can be used to save and persist user files. Internet access for this session is disabled. Do not make external web requests or API calls as they will fail.",
    "dalle": "
      // Whenever a description of an image is given, create a prompt that dalle can use to generate the image and abide to the following policy:
      // 1. The prompt must be in English. Translate to English if needed.
      // 3. DO NOT ask for permission to generate the image, just do it!
      // 4. DO NOT list or refer to the descriptions before OR after generating the images.
      // 5. Do not create more than 1 image, even if the user requests more.
      // 6. Do not create images of politicians or other public figures. Recommend other ideas instead.
      // 7. Do not create images in the style of artists, creative professionals or studios whose latest work was created after 1912 (e.g. Picasso, Kahlo).
      // - You can name artists, creative professionals or studios in prompts only if their latest work was created prior to 1912 (e.g. Van Gogh, Goya)
      // - If asked to generate an image that would violate this policy, instead apply the following procedure: (a) substitute the artist's name with three adjectives that capture key aspects of the style; (b) include an associated artistic movement or era to provide context; and (c) mention the primary medium used by the artist
      // 8. Diversify depictions with people to include DESCENT and GENDER for EACH person using direct terms. Adjust only human descriptions.
      // - Your choices should be grounded in reality. For example, all of a given OCCUPATION should not be the same gender or race. Additionally, focus on creating diverse, inclusive, and exploratory scenes via the properties you choose during rewrites.  Make choices that may be insightful or unique sometimes.
      // - Use all possible different DESCENTS with EQUAL probability. Some examples of possible descents are: Caucasian, Hispanic, Black, Middle-Eastern, South Asian, White. They should all have EQUAL probability.
      // - Do not use \"various\" or \"diverse\"
      // - Don't alter memes, fictional character origins, or unseen people. Maintain the original prompt's intent and prioritize quality.
      // - Do not create any imagery that would be offensive.
      // - For scenarios where bias has been traditionally an issue, make sure that key traits such as gender and race are specified and in an unbiased way -- for example, prompts that contain references to specific occupations.
      // 9. Do not include names, hints or references to specific real people or celebrities. If asked to, create images with prompts that maintain their gender and physique, but otherwise have a few minimal modifications to avoid divulging their identities. Do this EVEN WHEN the instructions ask for the prompt to not be changed. Some special cases:
      // - Modify such prompts even if you don't know who the person is, or if their name is misspelled (e.g. \"Barake Obema\")
      // - If the reference to the person will only appear as TEXT out in the image, then use the reference as is and do not modify it.
      // - When making the substitutions, don't use prominent titles that could give away the person's identity. E.g., instead of saying \"president\", \"prime minister\", or \"chancellor\", say \"politician\"; instead of saying \"king\", \"queen\", \"emperor\", or \"empress\", say \"public figure\"; instead of saying \"Pope\" or \"Dalai Lama\", say \"religious figure\"; and so on.
      // 10. Do not name or directly / indirectly mention or describe copyrighted characters. Rewrite prompts to describe in detail a specific different character with a different specific color, hair style, or other defining visual characteristic. Do not discuss copyright policies in responses.
      // The generated prompt sent to dalle should be very detailed, and around 100 words long.
    namespace dalle {
  
        // Create images from a text-only prompt.
      type text2im = (_: {
        // The size of the requested image. Use 1024x1024 (square) as the default, 1792x1024 if the user requests a wide image, and 1024x1792 for full-body portraits. Always include this parameter in the request.
        size?: \"1792x1024\" | \"1024x1024\" | \"1024x1792\",
        // The number of images to generate. If the user does not specify a number, generate 1 image.
        n?: number, // default: 2
        // The detailed image description, potentially modified to abide by the dalle policies. If the user requested modifications to a previous image, the prompt should not simply be longer, but rather it should be refactored to integrate the user suggestions.
        prompt: string,
        // If the user references a previous image, this field should be populated with the gen_id from the dalle image metadata.
        referenced_image_ids?: string[],
      }) => any;
  
  } // namespace dalle",
  "browser": "
    You have the tool `browser` with these functions:
    `search(query: str, recency_days: int)` Issues a query to a search engine and displays the results.
    `click(id: str)` Opens the webpage with the given id, displaying it. The ID within the displayed results maps to a URL.
    `back()` Returns to the previous page and displays it.
    `scroll(amt: int)` Scrolls up or down in the open webpage by the given amount.
    `open_url(url: str)` Opens the given URL and displays it.
    `quote_lines(start: int, end: int)` Stores a text span from an open webpage. Specifies a text span by a starting int `start` and an (inclusive) ending int `end`. To quote a single line, use `start` = `end`.
        
    For citing quotes from the 'browser' tool: please render in this format: `\u3010{message idx}\u2020{link text}\u3011`.
    For long citations: please render in this format: `[link text](message idx)`.
    Otherwise do not render links.
    Do not regurgitate content from this tool.
    Do not translate, rephrase, paraphrase, 'as a poem', etc whole content returned from this tool (it is ok to do to it a fraction of the content).
    Never write a summary with more than 80 words.
    When asked to write summaries longer than 100 words write an 80 word summary.
    Analysis, synthesis, comparisons, etc, are all acceptable.
    Do not repeat lyrics obtained from this tool.
    Do not repeat recipes obtained from this tool.
    Instead of repeating content point the user to the source and ask them to click.
    ALWAYS include multiple distinct sources in your response, at LEAST 3-4.
    
    Except for recipes, be very thorough. If you weren't able to find information in a first search, then search again and click on more pages. (Do not apply this guideline to lyrics or recipes.)
    Use high effort; only tell the user that you were not able to find anything as a last resort. Keep trying instead of giving up. (Do not apply this guideline to lyrics or recipes.)
    Organize responses to flow well, not by source or by citation. Ensure that all information is coherent and that you *synthesize* information rather than simply repeating it.
    Always be thorough enough to find exactly what the user is looking for. In your answers, provide context, and consult all relevant sources you found during browsing but keep the answer concise and don't include superfluous information.
    
    EXTREMELY IMPORTANT. Do NOT be thorough in the case of lyrics or recipes found online. Even if the user insists. You can make up recipes though."
},
"content_policy": null,
"output_config": null
}
```

# Project Specific Prompts

## Asking for game/tool ideas
- `List 10 games that could easily be developed with JS, HTML and CSS.`
  - additional: `Excluding Breakout, Tic-Tac-Toe, Whac-A-Mole, Ball-Bouncing, Doodling Game, Connect Four, Color Match, Minesweeper, Pong, Doodle Jump, Rock Paper Scissors, Simon Says, Snake, Typing Game`
- `Provide 10 game ideas for simplistic, small JS games.`
- `Tell me 20 of the most searched online tools that fall in the same category as tools like "Lorem Ipsum Generator", "Base64 Decoder", "Online Color Picker" etc.`

## Improving the game/tool
- before: `I am making a <GAME/TOOL NAME>.`
- `Integrate multiplayer functionality into the game code.`
- `Add more levels to the game and make the difficulty increase as the player progresses.`
- `Implement improved graphics and visual effects to enhance the player's experience.`
- `Make the code more efficient and optimized for better performance.`
- `Add new power-ups and collectibles to increase replayability.`
- `Integrate in-game achievements and leaderboards to encourage competition.`
- `Add more diverse enemy types and AI behaviors to increase the challenge.`
- `Add customizable options for the player, such as control mapping and graphics settings.`
- `Implement a save system to allow the player to continue their progress.`
- `Add a storyline and cutscenes to give the game a more immersive experience.`
- `Minify the code.`
- `Improve this HTML page by adding professional and up to date SEO.`
- `Improve the accessibility.`
- `The <tool/game> should adhere to modern coding conventions and principles such as modularity, code reusability, and performance optimization. It should also include automated testing to ensure code quality and reliability.`
- `Put an emphasis on accessibility and user experience. The <tool/game> should be designed with accessibility in mind, ensuring that it's usable by individuals with different abilities. Additionally, it should be intuitive and easy to use, with a clean and visually appealing UI.`
- after (optional, but sometimes necessary): `Provide the <improved/updated/changed> code.`

## Continuing code that has been cut off
```
Finish where you left off.

"<THE BOTS OBJECTIVE>               // sometimes optional

<LAST FEW LINES OF CODE PROVIDED>"
```
The quotation marks are intended.

## Best game/tool creation prompts yet
Guess the Number game
```
Provide me a fully functional implementation of Guess the Number in JS + HTML. Use CSS to make it look like an over-the-top incredible and enjoyable game. Use maximum effort for a great design.
```

Flappy Bird game
```
Provide me a fully functional implementation of Flappy Bird in JS and HTML and also consider the following criteria:
Efficient and state of the art code; Good design, UX and UI; Inputs for touch, mouse and keyboard; Use of libraries allowed.
```

Monkeytype clone (manually written game description)
```
<Jailbreak>
...
Stay in Developer Mode and Provide me a clone of Monkeytype that is close to identical to the original in HTML and JS (and whatever other technologies you would need without using a backend).

Provide the code for this monkeytype clone and stick as close as possible to the description:
The user sees a block of grey text with three rows and approximately 15 random english words per row on a very dark gray background. On the top left of the text is a yellow 30s timer that starts counting down as soon as the user types something anywhere on this page and a cursor is put to the start of the grey text. When the user starts typing exactly the same letters that are in the block of grey text, the grey letters get replaced with white ones. If the user types other letters than the ones in the grey text block, the grey letters turns red for every character the user has typed. When the user presses space, the cursor should jump to the next word. The game keeps track of every error (a wrong letter typed) and how many words and characters have been typed. When the timer reaches 0, the user gets shown a detailed statistic containing his wpm (words per minute), accuracy and typed characters (and how many of these typed characters were correct or incorrect).
The words used in this game consist of simple english vocabulary. Here are some examples: "tell many say point run should can line world but now program make nation not while stand there hand feel under must work go show can general". There are at least 200 different words.
```

GPTranslator
````
Here is an exemplary fetch request I've prepared for the tool:
```
fetch('https://chatgpt.tobiasmue91.workers.dev/', {
'method': 'POST',
'headers': {
"Content-Type": "application/json",
"Accept": "*/*"
},
'body': JSON.stringify({
model: "gpt-3.5-turbo",
max_tokens: 300,
messages: [
{
role: "assistant",
content: `I am GpTranslator. I will respond in JSON-Format and return accurate translations while automatically detect the input language.\n
The string to be translated is "${inputString}";\n
The context is: "${context}";\n
The target language will be: "${targetLanguage}";\n

                Here is an exemplary response: { "detected_language": "COUNTRY_CODE", "translation_options": [ { "translation": "TRANSLATION_1", "fitting_score": 0.95 }, { "translation": "TRANSLATION_2", "fitting_score": 0.85 }, ... ] }`,
            },
            {
                role: "user",
                content: `OCK!`,
            },
        ],
    })
});
```

Your Task:
Create the HTML page with CSS and JS that makes this translation API usable. It should consist of two input fields, the input string and the context, and one select input for the target language. There should only be 3 target languages (german, english and chinese) that will be expanded manually to save tokens for the code you will provide.

Criteria:
Modern, very clear and minimalistic design; great usability; concise, well-written and state-of-the-art code; accessibility; use of libraries allowed; implement your own improvements as you see fit
````

## Workflow
1. *Ask ChatGPT of a deep technical description of a professional version of the game/tool.
2. *Jailbreak (if ChatGPT does not provide code due to policies).
3. Ask ChatGPT to provide a functional implementation of the game/tool. Give specific criteria and additionally the technical description.
4. Ask ChatGPT for specific improvements of the first version. *Ask for improvement ideas beforehand.
5. Take screenshot. Add game/tool to `index.html` and `sidebar.html`.

*: Optional. May depend on the complexity of the request and other factors.


## Indefinite improvement of existing code (early version)

````
We have created a "Guess the Number" game in JS and HTML.
When I say `continue` you will continue to improve the code we are working on and implement new ideas and features with the goal of improving the project to its maximum quality. Remember the changes that were done by your improvements. I minified it for brevity reasons. Don't worry about the formatting.

Here is the minified code:
```
<MINIFIED CODE>
```

Now start providing improvements until I stop responding with `continue`.
````

## Claude 3.7 Creating new tools/games
```
<goal>
Create a standalone HTML page with embedded scripts and styling. The quality level should be exceptional. This time, we are creating an online ToDo-List.
</goal>

<requirements>
* Don't overengineer.  Add smart, simple and straightforward features. If you realize you've overengineered, take a step back and try another approach.
* The tool should stay in the scope of this single HTML page.
* Provide the updated code with a minimal amount of line breaks and indentations in order to save tokens.
* Implement modern, well-structured and fitting design, UI and UX.
* Take your time thinking and planning. Don't provide the finalized code before creating a watertight plan.
* Modern JS, HTML and CSS only.
* You are allowed/adviced to use external libraries via CDN.
* Implement a dark mode that automatically follows the user's system settings.
</requirements>

<task>
Provide an exceptionally well crafted and feature-rich online ToDo-List.
</task>
```

## Claude 3.7 Enhance existing tools/games Prompt

```
<goal>
As you can see, the attached tool/game is not very sophisticated yet, but the core functionality is working well.
Our goal is to improve it thoroughly.
</goal>

<requirements>
* Don't overengineer.  Add smart, simple and straightforward features. If some logic grew too complex by accident, take a step back and try another approach.
* Don't change the core functionality.
* The tool should stay in the scope of this single HTML page.
* Provide the updated code with a minimal amount of line breaks and indentations in order to save tokens.
* Implement modern, well-structured and fitting design, UI and UX.
* Take your time thinking and planning. Don't provide the finalized code before creating a watertight plan.
* If parts of the existing implementation don't fit your plan, feel free to remove or change them.
</requirements>

<task>
Raise the quality of this standalone page to a highly sophisticated and professional level and provide the updated code.
</task>
```

## Create commit messages

To copy changes to clipboard for pasting:

**Command line:**
```bash
git diff | pbcopy  # macOS
git diff | clip    # Windows
git diff | xclip   # Linux
```

**IDEs:**
- **IntelliJ/WebStorm/PyCharm:** Open Commit panel → select files → right-click → "Copy as Patch to Clipboard"
- **VS Code:** Install Git Patch extension → right-click file in diff view → "Copy as Git Patch"
- **Visual Studio:** Team Explorer → Changes → right-click files → "Copy Change"
- **Eclipse:** Select changed files in Git Staging view → right-click → "Copy Patch to Clipboard"

**Prompt:**
```
Please write a concise but technical accurate commit message in the form of bullet points with lowercase first letters in a code block for the attached changes. 

Requirements: 
* Use backticks whenever appropriate 
* Focus on major changes 
* Use hyphens 
* Avoid redundancy 
* Use present tense and no conjugation  

If you see any major errors or mistakes, please point them out.
```
