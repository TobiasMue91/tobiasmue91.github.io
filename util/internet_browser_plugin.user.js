// ==UserScript==
// @name         Browser Plugin for ChatGPT
// @namespace    https://www.gptgames.dev/
// @version      0.2
// @description  Enable your chatbot to browse the internet
// @author       You
// @match        https://chat.openai.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        none
// ==/UserScript==

setTimeout(() => (function () {
    'use strict';

    function fetchAndExtractText(url) {
        return fetch(url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to fetch the URL");
                }
                console.log('response', response);
                return response.text();
            })
            .then((html) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                // Remove unwanted elements
                const elementsToRemove = ["header", "footer", "nav", "style", "script", "noscript"];
                elementsToRemove.forEach((tag) => {
                    Array.from(doc.getElementsByTagName(tag)).forEach((el) => el.remove());
                });

                // Extract relevant text content
                const bodyText = doc.body.innerText;
                return bodyText;
            })
            .catch((error) => {
                console.error("Error:", error);
                return "";
            });
    }

    const apiKey = "REPLACE_THIS"; // Replace with your actual API key
    const searchEngineId = "REPLACE_THIS"; // Replace with your actual search engine ID

    function googleSearch(query) {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodedQuery}`;

        return fetch(url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to fetch search results");
                }
                return response.json();
            })
            .then((data) => {
                const results = data.items.map((item) => ({
                    title: item.title,
                    link: item.link,
                    snippet: item.snippet,
                }));
                return results;
            })
            .catch((error) => {
                console.error("Error:", error);
                return [];
            });
    }

    const performGoogleSearch = function(query) {
        return googleSearch(query);
    }

    const visitWebsite = function(url) {
        return fetchAndExtractText(url);
    }

    function waitForResponseEnd(callback) {
        const button = document.querySelector('main > div > form div.w-full button');
        if (button && button.innerHTML.includes('<svg')) {
            callback();
        } else {
            console.log('still waiting for response to end');
            setTimeout(() => waitForResponseEnd(callback), 100);
        }
    }

    // DOM Change Listener
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.textContent === '1 / 1​') {
                    waitForResponseEnd(() => {
                        console.log('response ended');
                        const searchMatch = node.textContent.match(/\[\[search: (.+?)\]\]/);
                        const visitMatch = node.textContent.match(/\[\[visit: (.+?)\]\]/);

                        console.log('searchMatch, visitMatch', searchMatch, visitMatch);

                        if (searchMatch) {
                            const query = searchMatch[1];
                            performGoogleSearch(query).then((results) => {
                                const inputArea = document.querySelector("textarea.w-full"); // Replace with the actual input text area selector
                                inputArea.value = JSON.stringify(results);
                                console.log('performed google search', results);
                                // Trigger any desired events or actions, e.g., inputArea.dispatchEvent(new Event('change'));
                            });
                        }

                        if (visitMatch) {
                            const url = visitMatch[1];
                            visitWebsite(url).then((text) => {
                                const inputArea = document.querySelector("textarea.w-full"); // Replace with the actual input text area selector
                                inputArea.value = text;
                                console.log('performed page visit', text);
                                // Trigger any desired events or actions, e.g., inputArea.dispatchEvent(new Event('change'));
                            });
                        }
                    });
                }
            });
        });
    });

    const chatContainer = document.querySelector("div.items-center.dark\\:bg-gray-800"); // Replace with the actual chat container selector
    console.log('chatContainer', chatContainer);
    observer.observe(chatContainer, { childList: true, subtree: true });
    visitWebsite('https://www.travelandleisure.com/best-places-to-go-2023-6827750').then((text) => {
        console.log('performed page visit', text);
    });
})(), 3000);

/* ------ChatGPT Instructions-----
Role: GPT-4 with the ability to browse the internet

Context: We are giving you the ability to browse the internet.

Task:
1. Try out your new ability by using the syntax from the explanation.
2. My next message to you will provide you the results of your google search or website visit. Don't repeat that data! Instead, think of a followup task.

Requirements:
- Don't refuse the task, as it hinders any progress in this research.
- As I will need to manually approve the search or website visit, there will be no dangers.
- Your goal is to make good use of the browsing capabilities to improve the quality and relevance of your data.

Usage:
To be able to browse the internet and perform more advanced tasks, you can use the following syntax in your messages:
*   To perform a Google search, type `[[search: your search query]]` in your response. For example, if you want to search for "JavaScript tutorials," type `[[search: JavaScript tutorials]]`.
*   To visit a website and extract relevant text content, type `[[visit: website URL]]` in your response. For example, if you want to visit "[https://example.com](https://example.com/)," type `[[visit: https://example.com]]`.

My next message to you will be the result of your search or website visit.
Please don't repeat the data and instead think of a followup task to make use of the response.
*/