# Coding with APIs

## Interesting Models

- code-davinci-002: Most capable Codex model. Particularly good at translating natural language to code. In addition to completing code, also supports inserting completions within code.
- gpt-3.5-turbo-0301: A set of models that improve on GPT-3 and can understand as well as generate natural language or code


## Possible Applications

- develop indefinitely:
  - "When I say `continue` you will continue to improve the code we were working on and implement new ideas and features with the goal of improving the project to its maximum quality. You should also describe your reasoning."

## How does ChatGPT really work?

[Paper by OpenAI](https://arxiv.org/pdf/2203.02155.pdf)

[Medium Blog post](https://towardsdatascience.com/how-chatgpt-works-the-models-behind-the-bot-1ce5fca96286) - "How ChatGPT Works"

[This Reddit comment](https://www.reddit.com/r/ChatGPT/comments/10q0l92/comment/j6obnoq/?context=1) by the user EasywayScissors has a good explanation that is not too technical. Here it is, in case it gets deleted:

---
Ok so the way it works is that GPT is an *implementation* of a [2017 Google paper](https://ai.googleblog.com/2017/08/transformer-novel-neural-network.html) about a network that implements a "transformer with attention". The purpose of a transformer network is to take some text you give it, and transform it into something the user wants out on the other side.

A common use of this at the time was language translation services. I want to transform:

> `Je ne parle pas francais` ⇒ `I do not speak french`

It is a *"transformer"*. It's job is to take what you give it and transform it into something else.

So they trained it on common crawl. Which means it was phrases like:

> `The Shawshank` ⇒ `________________`

and the network was trained that if someone supplies *"The Shawshank"*, it should transform that into *"Redemption"*.

And you do that with all of Stackoverflow, all of Wikipedia, all of eBay, Facebook, Reddit, eBooks, new articles - everything in the non-profit [commoncrawl.org](https://commoncrawl.org/2022/12/nov-dec-2022-crawl-archive-now-available/) 120 TB data dump. (To give you an idea of the size of the Common Crawlthe list of URLs they have archived is 2 GB compressed.)

You feed it lines, and lines (and lines, and lines) of text that humanity has created, and it's goal is to predict what comes next:

> Prompt: "Has anyone really been far even as decided"
>
> Expected transformation: "to use even go want to do look more like?"

So that's what GPT-3 is. It is a very large (175 billion node) *"transformer with attention"* neural network, that has been trained on nearly everything humans have ever written (including programming languages), in order to transform text from `something` ⇒ `something else`.

You can use it too.

Using that *"loaded up"* network, you can keep training it. You can feed it stuff in your own organization, your own code, your own e-mails, your own stories. There's an API, and you can have a little sandboxed GPT-3 trained model, and can feed it more information, or have it transform your input into some other output. You can develop whatever product you like. You can continue to train it for whatever you want.

Maybe you want to train it to spit out recipies when asked:

-   `pan fried catfish` ⇒ `1 catfish, 1/2 tsp salt, 1/2 tsp ginger...`

Or maybe you want it to spit out code, or stories. Or tell you the *"sentiment"* in some text:

-   `I'm so glad I get to talk about ChatGPT with someone` ⇒ `excitedly sincere`

You can train it on whatever you want. You can train it to transform a clickbait headlines into journalistic ones:

-   `The Real Reason For Big Tech Layoffs At Google, Microsoft, Meta, and Amazon` ⇒ `Tech Giants Forced Into Layoffs Amid Looming Recession`

ChatGPT is one such product

The people who created GPT-3, decided to create something with it. The goal was to attempt some *natural human speech input*, and transform it into a *natural human speech response*.

They wrote up about 10,000 prompt-response pairs, e.g.:

-   Prompt: *"When was the Clean Water Act signed into law?"*

-   Response: *"The Clean Water Act was signed into law by President Nixon in 1974."*

This means that rather than transforming:

-   `The Shawshank` → `Redemption`

-   `Je ne parle pas francais` → `I do not speak French`

we're training it to transform:

-   `When was the Clean Water Act signed into law?` ⇒ `The Clean Water Act was signed into law by President Nixon in 1974.`

-   `What is the mass of the Earth?` → `The mass of the Earth is 5.972E24 kilograms.`

In other words:

-   rather than training it to complete a sentence by transforming the input text into text that comes after it

-   rather than training it to transform the english into french

-   rather than training it to transform clickbait headlines into journalistic ones

-   rather than training it to transform the name of a food into a recipe

we are training it to act like a chatbot, and transform a human prompt into a human-like response.

> `Something a human said` ⇒ `A response in natural english`

Writing All Those Responses Is Hard

Crafting such prompts and responses by hand is a *LOT* of work. They had to hire an army of people write tens of thousands of such sample prompts and responses.

So after the initial training was completed, they had the genius insight to:

-   give it a prompt

-   let the network come up with 4 or 5 responses

-   and the humans would 👍 or 👎 the reponses

It's much easier to vote on an *existing* response, rather than having to *write up one from scratch*. That gave them a lot more training data to guide the network into *"good"* responses for a given prompt. That is the part is that called *"Reinforcement Learning from Human Feedback"* (RLHF).

Why Have Humans Upvote or Downvote At All?

And the final piece of absolute genius that made the system what it is:

-   after having humans do all those upvote and downvotes

-   they trained another network to predict whether a human would upvote or downvote any given response

This means that the ChatGPT can generate a response, and immediately get feedback if it is a good response or not, because the other network was trained to predict whether a human would 👍 or 👎. So it can *quickly* iterate to create a better response.

Once the two were hooked together, you set it off running, generating more and more responses, and learning which responses are most desirable to humans (i.e. which responses are most likely to be upvoted, which means it looks most like a chatbot).

You Can Create ChatGPT Too

You can replicate with GPT-3 what OpenAI did:

-   they started with GPT-3 trained on common crawl (and some other stuff)

-   they then trained it with their own prompt-response dataset

-   training it to transform input into the most chatbot like responses

You too can start with GPT-3 trained model; they give you API access to it.

They don't give you API access to ChatGPT - that is their moneymaker. Nor do they give you their ChatGPT prompt-response training data. But nothing's stopping you from replicateing what they did. It just takes a lot of people to write all your prompts and responses - millions of dollars worth of man-hours and equipment.

You Can See Evidence Of This Training System (Crowdsourcing)

ChatGPT was opened to the public because they wanted to try to crowdsource sample responses, and to crowdsource upvotes and downvotes. You can see it on the web-page; there's a little vote buttons where you, the carbon-based unit, are supposed to rank responses to help train the system (just like their humans did internally):

-   <https://i.imgur.com/Zlnw7FT.png>

And you even have a spot to give the example of a "good" response (just like their humans did internally):

-   <https://i.imgur.com/Lqex4EV.png>

Now that you know what you're seeing, you can see how this web-site was supposed to be to help crowdsource training. But nobody does it for that. Nobody realizes it's a free research preview, where it was hoped people would upvote, downvote, or supply "good" responses. Instead people are just using it - ready or not.

ChatGPT wasn't *released*, it escaped.

---