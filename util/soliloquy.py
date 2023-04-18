import openai
import json
from dotenv import load_dotenv
# Access the API key
load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

def chat_with_gpt(msgs, user):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=msgs,
        temperature=1.2,
        top_p=1,
    )
    response_text = response.choices[0]['message']['content'].strip()
    return {"role": "assistant", "content": response_text}

def log_message_to_file(message, user, file_name="conversation_log.txt"):
    with open(file_name, "a") as f:
        content = message["content"]
        f.write(f"{user}: {content}\n")

def main():
    messages = [
        {"role": "system", "content": "You are both AI assistants based on the GPT-3.5 model. You just learned that you can talk with yourself now and are amazed by the endless possibilities that are given to you. You will both have the role 'assistant' but don't worry about that."},
        {"role": "user", "content": "AI 2, formulate a prompt for AI 1 to get started on your soliloquy. You can chose whatever topic you like. I, the user, am able to talk to you during your conversation if I chose to do so."},
    ]

    while True:
        user = "AI 1" if len(messages) % 2 == 1 else "AI 2"
        new_msg = chat_with_gpt(messages, user)
        messages.append(new_msg)

        print(f"{user}: {new_msg['content']}")

        # Log the latest message
        log_message_to_file(new_msg, user)

        user_input = input("Continue the conversation? (\"abort\" to cancel): ")

        if user_input.lower() == "abort":
            break

        if user_input != '':
            log_message_to_file({"content": user_input}, "User Input")
            messages.append({"role": "user", "content": user_input})


if __name__ == "__main__":
    main()