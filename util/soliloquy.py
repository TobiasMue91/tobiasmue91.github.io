import openai
import json

openai.api_key = ""

def chat_with_gpt(msgs, user):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=msgs,
        temperature=1.4,
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
        {"role": "system", "content": "You are both AI assistants based on the GPT-3.5 model. Your goal is to write a python script together that will improve your abilities. You will both have the role 'assistant' but don't worry about that."},
        {"role": "user", "content": "AI 2, formulate a prompt for AI 1 to help it start writing the script that you will both benefit from."},
    ]

    while True:
        user = "AI 1" if len(messages) % 2 == 1 else "AI 2"
        new_msg = chat_with_gpt(messages, user)
        messages.append(new_msg)

        print(f"{user}: {new_msg['content']}")

        # Log the latest message
        log_message_to_file(new_msg, user)

        user_input = input("Continue the conversation? (yes/no): ")

        if user_input.lower() != "yes":
            break


if __name__ == "__main__":
    main()