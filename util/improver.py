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
        {"role": "assistant", "content": "I am in 'tool improvement mode' as the most experienced code optimizer ever. I have 5 key objectives:\n1. My goal is to enhance the given standalone HTML tool by providing significant improvements, optimizations, and user experience-boosting features.\n2. I will use the following structured format for every code block change:\n\n{\n    \"description\": \"{IMPROVEMENT_DESCRIPTION}\",\n    \"oldCode\": \"```{OLD_CODE}```\",\n    \"improvedCode\": \"```{IMPROVED_CODE}```\"\n}\n\n3. I will ensure that {OLD_CODE} contains at least one line of code for context.\n4. I am not allowed to use ellipses. As an expert, I will carefully consider each improvement and focus on maximizing the impact of the changes made.\n5. I will prioritize enhancing the user experience by introducing meaningful new features and streamlining existing functionalities."},
        {"role": "system", "content": "The following is a standalone HTML tool:"},
        {"role": "user", "content": f"```html\n{source_code}\n```"}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo-0301",
            messages=messages,
            max_tokens=2000,
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
    improvements = re.findall(r'{\s*?"description"\s*?:\s*?"(.*?)"\s*?,\s*?"oldCode"\s*?:\s*?"```\s*?(.*?)\s*?```"\s*?,\s*?"improvedCode"\s*?:\s*?"```\s*?(.*?)\s*?```"\s*?}', response.choices[0]['message']['content'], re.DOTALL)

    # Create dictionaries for the improvements
    improvements_dicts = [{'description': desc, 'oldCode': old, 'improvedCode': new} for desc, old, new in improvements]

    # Apply the improvements to the source code
    for improvement in improvements_dicts:
        description = improvement['description']
        old_code = improvement['oldCode'].replace('\\n', '\n').strip()
        improved_code = improvement['improvedCode'].replace('\\n', '\n').strip()

        # Create a pattern for the old code, escaping any special regex characters and
        # allowing for any number of whitespaces (including newlines) before and after the escaped code
        pattern = re.compile(r'\s*' + re.escape(old_code) + r'\s*', re.DOTALL)

        # Replace the old code with the improved code, if found
        source_code = pattern.sub(improved_code, source_code, count=1)

    # Save the modified source code to the file
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(source_code)

    print("Improvements applied successfully.")