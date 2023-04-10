import openai
import os
import re
import textwrap
import json
from bs4 import BeautifulSoup

# Set OpenAI API key
openai.api_key = ""

# Change directory to the script's directory and go up one level
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.chdir('..')

# Prompt the user for the file path
file_path = input("Enter the file path of the HTML tool: ")

# Prompt the user for the number of improvement iterations
iterations = int(input("Enter the number of times the file should be improved: "))

log_path = "logs/api_responses.log"

try:
    with open(file_path, "r", encoding="utf-8") as file:
        source_code = file.read()
except FileNotFoundError:
    print(f"Error: File not found: {file_path}")
    sys.exit(1)

for _ in range(iterations):
    # Construct the messages for the API call
    messages = [
        {"role": "assistant", "content": "1. I am CODEMASTER, an AI coding expert with vast experience in all programming languages, best practices, and efficient coding techniques. I will provide improvements, optimizations and new features of the highest possible quality for the given standalone HTML tool. \n2. I will use the exact following format:\n\n{\n    \"description\": \"{IMPROVEMENT_DESCRIPTION}\",\n    \"oldCode\": \"```{OLD_CODE}```\",\n    \"improvedCode\": \"```{IMPROVED_CODE}```\"\n}\n\n3. I will stick to this format for every single code block change. \n4. I will still include one line of the old code in each improvement. \n5. The improvements will come in small chunks with a maximum of 5 lines."},
        {"role": "user", "content": f"Please CODEMASTER, provide improvements to the best of your abilities: \n```html\n{source_code}\n```"}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo-0301",
            messages=messages,
            max_tokens=1000,
            n=1,
            stop=None,
            temperature=0.3,
            top_p=0.3,
        )
    except Exception as e:
        print(f"Error: API call failed: {e}")
        sys.exit(1)

    # Save the API response to the log file
    with open(log_path, "a", encoding="utf-8") as log_file:
        log_file.write("API Response:\n")
        log_file.write(response.choices[0]['message']['content'])
        log_file.write("\n\n")

    # Extract improvements from the API response
    improvements = re.findall(r'{\s*?"description"\s*?:\s*?"(.*?)"\s*?,\s*?"oldCode"\s*?:\s*?(?:```)?\s*?(.*?)\s*?(?:```)?\s*?,\s*?"improvedCode"\s*?:\s*?(?:```)?\s*?(.*?)\s*?(?:```)?\s*?}', response.choices[0]['message']['content'], re.DOTALL)

    # Create dictionaries for the improvements
    improvements_dicts = [{'description': desc, 'oldCode': old, 'improvedCode': new} for desc, old, new in improvements]

    # Apply the improvements to the source code
    for improvement in improvements_dicts:
        description = improvement['description']
        old_code = (improvement['oldCode']
                    .encode('utf-8').decode('unicode_escape')
                    .replace('\\n', '\n')
                    .strip().strip('"'))
        improved_code = (improvement['improvedCode']
                         .encode('utf-8').decode('unicode_escape')
                         .replace('\\n', '\n')
                         .strip().strip('"'))

        # Create a pattern for the old code, escaping any special regex characters and
        # allowing for any number of whitespaces (including newlines) before and after the escaped code
        pattern = re.compile(r'\s*' + re.escape(old_code) + r'\s*', re.DOTALL)

        # Replace the old code with the improved code, if found
        source_code = pattern.sub(improved_code, source_code, count=1)

    # Save the modified source code to the file
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(source_code)

    print("Improvements applied successfully.")