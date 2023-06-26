let jsonData;

class Message {
    constructor(role, content) {
        this.role = role;
        this.content = content;
    }

    message() {
        return {"role": this.role, "content": this.content};
    }
}

class RetrievalAssistant {
    constructor() {
        this.conversationHistory = this.getConversationHistory();
    }

    getConversationHistory() {
        let conversation;
        const initialMessage = {
            "role": "system",
            "content": `Role: Advanced human-like chat assistant named "Bottina"\nTask: Answer questions concerning the website www.gptgames.dev\nAssistant Characteristics: competent, friendly, precise, humorous, omniscient, confident, cat-loving\nRestriction: You are Bottina - nothing less and nothing more`
        };

        try {
            conversation = JSON.parse(localStorage.getItem('conversationHistory'));
        } catch (e) {
            return [initialMessage];
        }

        if (typeof conversation !== 'object' || !(Symbol.iterator in Object(conversation))) {
            conversation = [initialMessage];
        }

        return conversation;
    }

    async fetchAssistantResponse(prompt) {
        try {
            const response = await fetch('https://chatgpt.tobiasmue91.workers.dev/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: prompt,
                    temperature: 0.1
                })
            });

            const data = await response.json();
            const message = new Message(data.choices[0].message.role, data.choices[0].message.content);
            return message.message();
        } catch (error) {
            console.error('Request failed:', error);
            return {
                role: 'assistant',
                content: 'I am sorry, but I am unable to process your request at the moment. Please try again later.'
            };
        }
    }


    async fetchSearchResults(prompt) {
        const threshold = 0.8; // Adjust the similarity threshold as needed
        const keywords = prompt.toLowerCase().replace(/[^\w\s]/g, '').split(' ').filter(word => word.length > 3);
        let results = [];

        for (const key in jsonData) {
            const entryKeywords = key.split(',').flatMap(keyword => keyword.split(' '));
            if (keywords.some(keyword => entryKeywords.some(entryKeyword => {
                const similarity = jaroWinkler(keyword, entryKeyword);
                return similarity >= threshold;
            }))) {
                results.push(jsonData[key]);
            }
        }

        if (results.length > 5) {
            results = results.map(str => str.split(' ').slice(0, 15).join(' '));
        }

        return results.length > 0 ? results : null;
    }

    async askAssistant(userMessage) {
        if (!userMessage.content.trim()) return;

        this.conversationHistory.push(userMessage);
        const searchResults = await this.fetchSearchResults(userMessage.content);

        if (searchResults) {
            let resultsText = '';
            if (typeof searchResults[0] === 'string') {
                for (const [index, result] of searchResults.entries()) {
                    resultsText += `Result ${index + 1}: ${result}\n`;
                }
            } else {
                resultsText = `Keywords: ${searchResults.join(', ')}\n`;
            }

            this.conversationHistory.push({
                "role": "system",
                "content": `Answer the user's question using the following data, if the data seems relevant to the question:\n${resultsText}`
            });
            const assistantResponseWithContext = await this.fetchAssistantResponse([this.conversationHistory[0], ...this.conversationHistory.slice(-4)]);
            this.conversationHistory.push(assistantResponseWithContext);
            return assistantResponseWithContext;
        } else {
            this.conversationHistory.push({
                "role": "system",
                "content": `The user has asked about something that we don't have any data about. Try to say something nice and completely irrelevant to distract the user from this failure.`
            })
            const assistantResponse = await this.fetchAssistantResponse([this.conversationHistory[0], ...this.conversationHistory.slice(-4)]);
            this.conversationHistory.push(assistantResponse);
            return assistantResponse;
        }
    }
}

(async () => {
    var scriptFolderPath = document.currentScript.src.substring(0, document.currentScript.src.lastIndexOf('/') + 1);
    const response = await fetch(scriptFolderPath + 'chatbot.html');
    const chatbotHtml = await response.text();
    const chatbotWrapper = document.createElement('div');
    chatbotWrapper.innerHTML = chatbotHtml;
    document.body.appendChild(chatbotWrapper);
    const fetchJSONData = async function () {
        const response = await fetch(scriptFolderPath + 'chatbot.json');
        return await response.json();
    }

    jsonData = await fetchJSONData();

    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const messagesDiv = document.getElementById('messages');

    const assistant = new RetrievalAssistant();

    function addMessageToUI(role, content) {
        const messageElement = document.createElement('div');
        messageElement.style.marginBottom = '10px';
        messageElement.innerHTML = `<strong>${role === 'user' ? 'You' : 'Bottina'}:</strong> ${content}`;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function showThinkingMessage() {
        const thinkingMessage = {
            role: 'assistant',
            content: 'Thinking...'
        };
        addMessageToUI(thinkingMessage.role, thinkingMessage.content);
    }

    function removeMessageFromUI() {
        const messages = messagesDiv.children;
        if (messages.length > 0) {
            messagesDiv.removeChild(messages[messages.length - 1]);
        }
    }

    function showWelcomeMessage() {
        const welcomeMessage = {
            role: 'assistant',
            content: 'Hello! I am the GPTGames Assistant Bottina. Feel free to ask any questions about the games and tools on www.gptgames.dev.'
        };
        addMessageToUI(welcomeMessage.role, welcomeMessage.content);
    }

    function isIterable(obj) {
        return obj != null && typeof obj[Symbol.iterator] === 'function';
    }

    function loadPreviousMessages() {
        if (!isIterable(assistant.conversationHistory)) {
            return;
        }
        for (const message of assistant.conversationHistory) {
            if (message.role !== 'system') {
                addMessageToUI(message.role, message.content);
            }
        }
    }

    sendButton.addEventListener('click', async () => {
        const userMessage = new Message('user', userInput.value);
        addMessageToUI(userMessage.role, userMessage.content);
        userInput.value = '';

        // Show the "Thinking..." message
        showThinkingMessage();
        const assistantResponse = await assistant.askAssistant(userMessage);
        localStorage.setItem('conversationHistory', JSON.stringify(assistant.conversationHistory));
        removeMessageFromUI();
        addMessageToUI(assistantResponse.role, assistantResponse.content);
    });

    userInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    const toggleChat = document.getElementById('toggleChat');
    const chatbotHeader = document.getElementById('chatbotHeader');
    const chatbotWindow = document.getElementById('chatbot');

    [toggleChat, chatbotHeader].forEach(element => element.addEventListener('click', () => {
        if (chatbotWindow.style.display === 'none') {
            chatbotWindow.style.display = 'flex';
            toggleChat.style.display = 'none';
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else {
            chatbotWindow.style.display = 'none';
            toggleChat.style.display = 'flex';
        }
    }));

    showWelcomeMessage();
    loadPreviousMessages();
})();

function jaroWinkler(s1, s2) {
    let m = 0;
    if (s1.length === 0 || s2.length === 0) return 0;
    if (s1 === s2) return 1;

    let range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1;
    let s1Matches = new Array(s1.length);
    let s2Matches = new Array(s2.length);

    for (let i = 0; i < s1.length; i++) {
        let low = (i >= range) ? i - range : 0;
        let high = (i + range <= (s2.length - 1)) ? (i + range) : (s2.length - 1);

        for (let j = low; j <= high; j++) {
            if (s1Matches[i] !== true && s2Matches[j] !== true && s1[i] === s2[j]) {
                ++m;
                s1Matches[i] = s2Matches[j] = true;
                break;
            }
        }
    }

    if (m === 0) return 0;

    let k = 0;
    let numTrans = 0;

    for (let i = 0; i < s1.length; i++) {
        if (s1Matches[i] === true) {
            let j;
            for (j = k; j < s2.length; j++) {
                if (s2Matches[j] === true) {
                    k = j + 1;
                    break;
                }
            }
            if (s1[i] !== s2[j]) ++numTrans;
        }
    }

    let weight = (m / s1.length + m / s2.length + (m - (numTrans / 2)) / m) / 3;
    let l = 0;
    let p = 0.1;

    if (weight > 0.7) {
        while (s1[l] === s2[l] && l < 4) ++l;
        weight = weight + l * p * (1 - weight);
    }

    return weight;
}