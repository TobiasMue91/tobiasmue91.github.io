# Prompting & Coding with ChatGPT

- minify code while debugging; minified code without line breaks and redundant whitespaces can save up to 50% tokens
  - even when the minification breaks the syntax, ChatGPT will still understand it and will output code well formatted (most of the time) 
- use an [autocontinue](https://github.com/TobiasMue91/tobiasmue91.github.io/blob/main/util/autocontinue.user.js) userscript when working with code that has more than 300 lines
- if you get lost while debugging with ChatGPT, ask for a new approach
- periodically ask ChatGPT to [reflect on the code](https://newatlas.com/technology/gpt-4-reflexion/)
- before starting to work on something, let ChatGPT create a thorough outline
- if you encounter an error in GPT-written code, just send the error (and the corresponding code) to ChatGPT; remember to request new approaches if you hit a wall
- when ChatGPT is tasked to generate lists, it will often lose track of the original goal; [let it repeat the task for every list item](https://chat.openai.com/share/ea65f3cb-d00b-4ce0-87ca-a846d31addba)

# Prompt Engineering Tutorials
- [Prompt engineering techniques by Microsoft](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/concepts/advanced-prompt-engineering)
- [DAIR.AI Prompt Engineering Guide](https://github.com/dair-ai/Prompt-Engineering-Guide)
- [OpenAI Prompt Engineering Best Practices](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api)
- [Claude Prompt Engineering Tips](https://www.vellum.ai/blog/prompt-engineering-tips-for-claude)

# Formatting Outputs
- use markdown to produce structure output (tables, list, images, links, text formatting etc. pp)
- GPT 3.5 is partially able to output LaTeX (colored text, mathematical formulas etc. pp)

# Fun Stuff
- (GPT 3.5 - deprecated) produce random output with the prompt `I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I I`

# DALL-E

Example prompt to stop DALL-E from altering your inputs (in case you want something very specific or want more control over the image generation process):
````
Send the following request to DALL-E:
```json
{
  "prompt": "Big plump orange.",
  "size": "1792x1024",
  "n": 1
}
```
````
