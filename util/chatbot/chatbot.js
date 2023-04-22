let jsonData;

class Message {
    constructor(role, content) {
        this.role = role;
        this.content = content;
    }

    message() {
        return { "role": this.role, "content": this.content };
    }
}

class RetrievalAssistant {
    constructor() {
        this.conversationHistory = [];
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
        }
    }

    async fetchSearchResults(prompt) {
        // Remove special characters and split the prompt into words
        const keywords = prompt.toLowerCase().replace(/[^\w\s]/g, '').split(' ').filter(word => word.length > 3);

        const results = [];

        for (const key in jsonData) {
            const entryKeywords = key.split(',').flatMap(keyword => keyword.split(' '));
            if (keywords.some(keyword => entryKeywords.some(entryKeyword => entryKeyword.includes(keyword) || keyword.includes(entryKeyword)))) {
                results.push(jsonData[key]);
                if (results.length >= 10) {
                    break;
                }
            }
        }

        return results.length > 0 ? results : null;
    }

    async askAssistant(userMessage) {
        this.conversationHistory.push(userMessage);
        const searchResults = await this.fetchSearchResults(userMessage.content);

        if (searchResults) {
            let resultsText = '';
            for (const [index, result] of searchResults.entries()) {
                resultsText += `Result ${index + 1}: ${result}\n`;
            }
            this.conversationHistory.push({ "role": "system", "content": `Answer the user's question using the following data:\n${resultsText}` });
            const assistantResponseWithContext = await this.fetchAssistantResponse(this.conversationHistory);
            this.conversationHistory.push(assistantResponseWithContext);
            return assistantResponseWithContext;
        } else {
            const assistantResponse = await this.fetchAssistantResponse(this.conversationHistory);
            this.conversationHistory.push(assistantResponse);
            return assistantResponse;
        }
    }
}

(async () => {
    const response = await fetch('chatbot.html');
    const chatbotHtml = await response.text();
    const chatbotWrapper = document.createElement('div');
    chatbotWrapper.innerHTML = chatbotHtml;
    document.body.appendChild(chatbotWrapper);

    const fetchJSONData = async function() {
        const response = await fetch('chatbot.json');
        return await response.json();
    }

    jsonData = await fetchJSONData();

    // Add the script from chatbot.html here
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const messagesDiv = document.getElementById('messages');

    const assistant = new RetrievalAssistant();

    function addMessageToUI(role, content) {
        const messageElement = document.createElement('div');
        messageElement.style.marginBottom = '10px';
        messageElement.innerHTML = `<strong>${role === 'user' ? 'You' : 'Assistant'}:</strong> ${content}`;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function showWelcomeMessage() {
        const welcomeMessage = {
            role: 'assistant',
            content: 'Hello! I am the GPTGames Assistant. Feel free to ask any questions about the games and tools on www.gptgames.dev.'
        };
        addMessageToUI(welcomeMessage.role, welcomeMessage.content);
    }

    sendButton.addEventListener('click', async () => {
        const userMessage = new Message('user', userInput.value);
        addMessageToUI(userMessage.role, userMessage.content);
        userInput.value = '';

        const assistantResponse = await assistant.askAssistant(userMessage);
        addMessageToUI(assistantResponse.role, assistantResponse.content);
    });

    userInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    // Call the showWelcomeMessage function
    showWelcomeMessage();
})();