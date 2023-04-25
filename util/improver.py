import openai
import os
import re
import textwrap
import json
import ijson
from bs4 import BeautifulSoup
from io import StringIO
from dotenv import load_dotenv

# Access the API key
load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')

# Change directory to the script's directory and go up one level
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.chdir('..')

# Prompt the user for the file path
file_path = input("Enter the file path of the HTML tool: ")

# Prompt the user for the number of improvement iterations
iterations = int(input("Enter the number of times the file should be improved: "))

log_path = "logs/api_responses.log"

def handle_incomplete_json(data):
    items = []
    current_item = None
    attributes = ["type", "original_text", "suggested_text", "confidence_score"]

    try:
        # Parse the JSON data using a streaming parser
        parser = ijson.parse(StringIO(data))

        # Iterate through the parsed items
        for prefix, event, value in parser:
            if event == 'start_map':
                # Start a new dictionary for the current item
                current_item = {}
            elif event == 'map_key':
                current_key = value
            elif event == 'string' or event == 'number':
                if current_key in attributes:
                    current_item[current_key] = value
            elif event == 'end_map':
                # Append the completed item to the list of items, but only if it has all the necessary attributes
                if all(key in current_item for key in attributes):
                    items.append(current_item)

    except ijson.JSONError:
        # Ignore JSON errors, as we expect the JSON to be incomplete
        pass

    return items

try:
    with open(file_path, "r", encoding="utf-8") as file:
        source_code = file.read()
except FileNotFoundError:
    print(f"Error: File not found: {file_path}")
    sys.exit(1)

for _ in range(iterations):
    # Construct the messages for the first API call (instructions)
    messages_instructions = [
        {"role": "assistant", "content": "I am CODEMASTER, an AI coding expert with vast experience in all programming languages, best practices, and efficient coding techniques. I will provide improvement instructions for the given standalone HTML tool. I will analyze the code and provide suggestions for improvements."},
        {"role": "user", "content": f"Source: \n```html\n{source_code}\n```"}
    ]

    try:
        response_instructions = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages_instructions,
            max_tokens=500,
            n=1,
            temperature=0.3,
            top_p=0.3,
        )
    except Exception as e:
        print(f"Error: API call failed: {e}")
        sys.exit(1)

    instructions = response_instructions.choices[0]['message']['content']

    # Construct the messages for the second API call (implementation)
    messages_implementation = [
        {"role": "assistant", "content": "I am CODEMASTER, an AI coding expert. I will implement the following improvement instructions in the exact following format:\n\n{\n    \"suggested_changes\": [\n        {\n            \"type\": \"{CHANGE_TYPE}\",\n            \"original_text\": \"{OLD_TEXT}\",\n \"suggested_text\": \"{IMPROVED_TEXT}\",\n \"confidence_score\": {CONFIDENCE_SCORE}\n }\n ],\n \"metadata\": {\n \"gpt_version\": \"{GPT_VERSION}\",\n \"time_stamp\": \"{TIMESTAMP}\"\n }\n}\nValid change types: [\"replace_word\",\"add_line\",\"remove_paragraph\"].\nI will stick to this format for every single change. \nI will not repeat the full code.\nI will not change wording or variable naming.\n\n"},
        {"role": "user", "content": f"Source: \nhtml\n{source_code}\n\nImprovement instructions: {instructions}"}
    ]
    try:
        response_implementation = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages_implementation,
            max_tokens=800,
            n=1,
            temperature=0.3,
            top_p=0.3,
        )
    except Exception as e:
        print(f"Error: API call failed: {e}")
        sys.exit(1)

    # Save the API response to the log file
    with open(log_path, "a", encoding="utf-8") as log_file:
        log_file.write("API Response:\n")
        log_file.write(response_implementation.choices[0]['message']['content'])
        log_file.write("\n\n")

    response_data = response_implementation.choices[0]['message']['content']
    # Extract the JSON object from the API response
    response_json = handle_incomplete_json(response_data)

    # Apply the improvements to the source code
    for change in response_json:
        change_type = change["type"]
        original_text = change["original_text"]
        suggested_text = change["suggested_text"]
        confidence_score = change["confidence_score"]

        # Apply the change only if the confidence score is above a certain threshold (e.g., 0.7)
        if confidence_score >= 0.7:
            if change_type == "replace_word":
                # Replace the original text with the suggested text using regex
                escaped_original_text = re.escape(original_text)
                source_code = re.sub(escaped_original_text, suggested_text, source_code)
            elif change_type == "add_line":
                # Add the suggested line at the end of the source code
                source_code += f"\n{suggested_text}"
            elif change_type == "remove_paragraph":
                # Remove the specified paragraph from the source code
                source_code = source_code.replace(original_text, "")

    # Save the modified source code to the file
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(source_code)

print("Improvements applied successfully.")