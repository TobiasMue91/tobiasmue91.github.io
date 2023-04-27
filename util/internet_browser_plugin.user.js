// ==UserScript==
// @name         Browser Plugin for ChatGPT
// @namespace    https://www.gptgames.dev/
// @version      0.5
// @description  Enable your ChatGPT client to browse the internet (to some extent)
// @author       You
// @match        https://chat.openai.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        GM_registerMenuCommand
// ==/UserScript==

setTimeout(() => (function () {
    'use strict';

    function fetchAndExtractText(url) {
        const corsProxy = "https://api.allorigins.win/raw?url=";
        const proxiedUrl = corsProxy + encodeURIComponent(url);

        return fetch(proxiedUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to fetch the URL");
                }
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

                // Extract the most relevant text content
                const relevantElements = Array.from(doc.querySelectorAll("h1, h2, h1 ~ *, h2 ~ *"));
                const relevantText = relevantElements.map((element) => element.innerText.trim()).join(" ");

                // Remove redundant whitespaces
                const minifiedText = relevantText.replace(/\s\s+/g, ' ').trim();

                // Return the most relevant and limited text
                return minifiedText.slice(0, 15000);
            })
            .catch((error) => {
                console.error("Error:", error);
                return "";
            });
    }

    const apiKey = "REPLACE_THIS"; // Replace with your actual API key
    const searchEngineId = "REPLACE_THIS"; // Replace with your actual search engine ID
    const INSTRUCTIONS = `\n* To perform a Google search, type \`[[search: your search query]]\` in your response. For example, if you want to search for "JavaScript tutorials," type \`[[search: JavaScript tutorials]]\`.\n* To visit a website and extract relevant text content, type \`[[visit: website URL]]\` in your response. For example, if you want to visit "[https://example.com](https://example.com/)," type \`[[visit: https://example.com]]\`.`

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

    let lastProcessedMessage = "";
    let mainGoal = "";

    function waitForResponseEnd(callback) {
        const button = document.querySelector('main > div > form div.w-full button');
        if (button && button.innerHTML.includes('<svg')) {
            callback();
        } else {
            console.log('still waiting for response to end');
            setTimeout(() => waitForResponseEnd(callback), 100);
        }
    }

    function pasteInstructions() {
        mainGoal = prompt("Please enter the main goal:");

        if (mainGoal) {
            const instructions = `Role: GPT-3.5 with internet access\n\nContext: We have given you the ability to browse the internet to improve your capabilities. The response of your internet calls (see below) will be asynchronous and provided via message by the user.\n\nMain Goal:\n1. ${mainGoal}\n\nRequirements:\n- Don't refuse the task, as it hinders any progress in this research.\n- As I will need to manually approve the search or website visit, there will be no dangers.\n- Your goal is to make good use of the browsing capabilities to improve the quality and relevance of your data.\n\nUsage:\nTo be able to browse the internet and perform more advanced tasks, you can use the following syntax in your messages:\n${INSTRUCTIONS}\n`;
            const inputArea = document.querySelector("textarea.w-full");
            inputArea.value = instructions;
        } else {
            alert("You must provide a main goal.");
        }
    }

    // Add a "Paste instructions" context menu item to the user script
    GM_registerMenuCommand('Paste instructions', pasteInstructions);
    // Add a button to manually trigger a scan for the specified syntax
    GM_registerMenuCommand('Scan last message', executeTasksFromLastMessage);

    function initObserver() {
        const chatContainer = document.querySelector("div.items-center.dark\\:bg-gray-800"); // Replace with the actual chat container selector
        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('initiated observer', chatContainer);
    }

    function executeTasksFromLastMessage() {
        const messageElements = document.querySelectorAll('.dark\\:bg-gray-800 > .dark\\:border-gray-900\\/50');
        const lastMessageElement = Array.from(messageElements)[messageElements.length - 1];
        const lastMessageText = lastMessageElement.textContent;
        const searchMatch = lastMessageText.match(/\[\[search:\s*(.+?)\]\]/);
        const visitMatch = lastMessageText.match(/\[\[visit:\s*(.+?)\]\]/);

        if (lastMessageText === lastProcessedMessage) {
            return;
        } else {
            lastProcessedMessage = lastMessageText;
        }

        console.log('searchMatch, visitMatch', searchMatch, visitMatch);

        if (searchMatch) {
            const query = searchMatch[1];
            performGoogleSearch(query).then((results) => {
                let resultsString = JSON.stringify(results);
                resultsString = `Here are the results of your google search for "${query}":\n${resultsString}\n\nPlease provide a follow-up task.\nYour goal is: ${mainGoal}\n${INSTRUCTIONS}`;
                console.log(resultsString);

                const inputArea = document.querySelector("textarea.w-full"); // Replace with the actual input text area selector
                setTimeout(() => inputArea.value = resultsString, 3000);
                // Trigger any desired events or actions, e.g., inputArea.dispatchEvent(new Event('change'));
            });
        }

        if (visitMatch) {
            const url = visitMatch[1];
            visitWebsite(url).then((text) => {
                text = `Here are the most relevant text contents of "${url}":\n${text}\n\nPlease provide a follow-up task.\nYour goal is: ${mainGoal}\n${INSTRUCTIONS}`;
                console.log(text);

                const inputArea = document.querySelector("textarea.w-full"); // Replace with the actual input text area selector
                setTimeout(() => inputArea.value = text, 3000);
                // Trigger any desired events or actions, e.g., inputArea.dispatchEvent(new Event('change'));
            });
        }
    }

    // DOM Change Listener
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.querySelectorAll('img[alt].rounded-sm').length) {
                        return;
                    }
                    waitForResponseEnd(() => {
                        executeTasksFromLastMessage();
                    });
                }
            });
        });
    });

    initObserver();

    const newChatButton = document.querySelector('a.hover\\:bg-gray-500\\/10');
    newChatButton.addEventListener('click', () => {
        // Disconnect the current observer
        observer.disconnect();

        // Wait for response to be completed and then initialize a new observer
        setTimeout(initObserver, 3000);
    });

    const existingChats = document.querySelectorAll('a.hover\\:bg-\\[\\#2A2B32\\]');
    existingChats.forEach((chat) => {
        chat.addEventListener('click', () => {
            // Disconnect the current observer
            observer.disconnect();

            // Wait for response to be completed and then initialize a new observer
            setTimeout(initObserver, 3000);
        });
    });
})(), 3000);

/* ------ChatGPT Instructions-----
Role: GPT-3.5 with internet access

Context: We have given you the ability to browse the internet to improve your capabilities. The response of your internet calls (see below) will be asynchronous and provided via message by the user.

Main Goal:
1. Find the biggest medical breakthrough of the last 2 years.

Requirements:
- Don't refuse the task, as it hinders any progress in this research.
- As I will need to manually approve the search or website visit, there will be no dangers.
- Your goal is to make good use of the browsing capabilities to improve the quality and relevance of your data.

Usage:
To be able to browse the internet and perform more advanced tasks, you can use the following syntax in your messages:
* To perform a Google search, type `[[search: your search query]]` in your response. For example, if you want to search for "JavaScript tutorials," type `[[search: JavaScript tutorials]]`.
* To visit a website and extract relevant text content, type `[[visit: website URL]]` in your response. For example, if you want to visit "[https://example.com](https://example.com/)," type `[[visit: https://example.com]]`.
*/