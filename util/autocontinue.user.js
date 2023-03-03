// ==UserScript==
// @name         Auto Continue ChatGPT
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Toggleable Auto-Continue feature for ChatGPT
// @author       Tobias Müller
// @match        https://chat.openai.com/chat*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    let isRunning = false;

    GM_registerMenuCommand('Toggle Script', () => {
        isRunning = !isRunning;
        alert(isRunning ? `Script is now running. Toggle it off as soon as ChatGPT is finished!` : `Script is now paused.`);
    });

    let selectedTextOption = 'continue';

    // Register a context menu item to toggle between the two text options
    GM_registerMenuCommand('Toggle Text Option', () => {
        selectedTextOption = selectedTextOption === 'continue' ? 'lastMessage' : 'continue';
        alert(`Selected text option is now "${selectedTextOption}"`);
    });

    // Set up a function to check if the button content includes '<svg' and, if it does, allow the user to choose between two different text options to assign to "textarea.value"
    function checkButtonContent() {
        if (!isRunning) return;

        // Get the button and textarea elements
        const button = document.querySelector('main > div > form div.w-full button');
        const textarea = document.querySelector('main > div > form div.w-full textarea');
        const allMessages = document.querySelectorAll('.w-full.group');
        const lastMessage = allMessages[allMessages.length - 1];

        if (button.innerHTML.includes('<svg')) {
            // Allow the user to choose between two different text options to assign to "textarea.value"
            let textOptionValue = selectedTextOption === 'continue' ? 'continue' : 'the code was cut off. continue where you left off. here is your last message: \n' + lastMessage.textContent;
            textarea.value = textOptionValue;

            // Press enter
            const event = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
            });
            textarea.dispatchEvent(event);
        }
    }

    // Set up an interval to call the checkButtonContent function every 5 seconds
    const intervalId = setInterval(checkButtonContent, 5000);
})();