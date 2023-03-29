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
improvements = re.findall(r'Improvement description: .*?\n\nImprovement:\n\n```\n(.*?)\n```\n\n```\n(.*?)\n```', response.choices[0]['message']['content'], re.DOTALL)

# Parse the HTML with Beautiful Soup
soup = BeautifulSoup(source_code, "html.parser")

for old_code, improved_code in improvements:
    old_code_dedent = textwrap.dedent(old_code)
    improved_code_dedent = textwrap.dedent(improved_code)

    # Find the old code in the soup and replace it with the improved code
    old_code_soup = BeautifulSoup(old_code_dedent, "html.parser")
    improved_code_soup = BeautifulSoup(improved_code_dedent, "html.parser")
    old_tag = soup.find_all(text=re.compile(re.escape(old_code_dedent).strip()))[0]
    old_tag.replace_with(improved_code_soup.prettify())

# Save the updated HTML
with open(file_path, "w", encoding="utf-8") as file:
    file.write(str(soup))

print("Source code has been updated.")