import openai
import os
import re
import textwrap
from bs4 import BeautifulSoup

# Set OpenAI API key
openai.api_key = ""

# Change directory to the script's directory and go up one level
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.chdir('..')

# Prompt the user for the file path
file_path = input("Enter the file path of the HTML tool: ")
log_path = "logs/api_responses.log"

try:
    with open(file_path, "r", encoding="utf-8") as file:
        source_code = file.read()
except FileNotFoundError:
    print(f"Error: File not found: {file_path}")
    sys.exit(1)

# Construct the messages for the API call
messages = [
    {"role": "assistant", "content": "I am in 'tool improvement mode' and will provide extensive improvements, optimizations and new features for the given standalone HTML tool. \nI will include the old code for easier updating. \nI will use the exact following format:\n\nImprovement description: {IMPROVEMENT DESCRIPTION}\n\nImprovement:\n\n```\n{OLD CODE}\n```\n\n```\n{IMPROVED CODE}\n```\n\nI will stick to this format for every single code block change. I am not allowed to use ellipses. I will use the same indentation as in the input source code."},
    {"role": "system", "content": "The following is a standalone HTML tool:"},
    {"role": "user", "content": f"```html\n{source_code}\n```"}
]

try:
    response = openai.ChatCompletion.create(
        model="gpt-4",
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
improvements = re.findall(r'Improvement description: .*?\n\nImprovement:\n\n```(?:html|javascript|css)?\n(.*?)\n```\n\n```(?:html|javascript|css)?\n(.*?)\n```', response.choices[0]['message']['content'], re.DOTALL)

# Apply the improvements to the source code
for old_code, improved_code in improvements:
    # Normalize the code snippets by removing leading and trailing whitespaces
    old_code = old_code.strip()
    improved_code = improved_code.strip()

    # Create a pattern for the old code, escaping any special regex characters and
    # allowing for any number of whitespaces (including newlines) between characters
    pattern = re.compile(r'\s*'.join(re.escape(char) for char in old_code), re.DOTALL)

    # Replace the old code with the improved code, if found
    source_code = pattern.sub(improved_code, source_code, count=1)

# Save the modified source code to the file
with open(file_path, "w", encoding="utf-8") as file:
    file.write(source_code)

print("Improvements applied successfully.")