import openai
import os
import re
import sys
import textwrap
from bs4 import BeautifulSoup

def get_tool_name():
    tool_name = input("Enter the name of the tool to be created: ")
    return tool_name

def get_description(tool_name):
    messages = [
        {"role": "assistant", "content": "I am an AI Tool Development Master with vast knowledge in creating high-quality, feature-rich web tools using the latest technologies and best practices. I will provide a streamlined and technical description of a standalone web version of the tool of your choice in form of bullet points, adhering to the highest quality standards."},
        {"role": "user", "content": f"Provide a concise and technical description of a standalone web version of the {tool_name} tool. The tool should be a single HTML file containing actual CSS styles in the <style> area and functional JavaScript in a <script> tag. It must utilize state-of-the-art and highly efficient code, modern design, and libraries. Make sure the tool is responsive, performant, and user-friendly."}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo-0301",
            messages=messages,
            max_tokens=700,
            n=1,
            stop=None,
            temperature=0.3,
            top_p=0.3,
        )
    except Exception as e:
        print(f"Error: API call failed: {e}")
        sys.exit(1)

    return response.choices[0]['message']['content'].strip()

def get_tool_implementation(tool_name, description):
    messages = [
        {"role": "assistant", "content": "As an AI Tool Development Master, I excel in creating high-quality, feature-rich standalone web tools using HTML, CSS, and JavaScript. I will immediately start outputting the HTML for the desired tool without any explanations or repetition of the description. I will not use placeholders or comments in place of actual code."},
        {"role": "user", "content": f"Create a standalone web tool called {tool_name} based on the following description:\n\n{description}\n\nThe tool should be a single HTML file containing actual CSS styles in the <style> area and functional JavaScript in a <script> tag. Make sure to use best practices, efficient code, modern design, and libraries. Ensure the tool is responsive, performant, user-friendly, and accessible."}
    ]

    implementation = ""
    end_of_html = False
    counter = 1

    while not end_of_html and counter < 2:
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

        implementation += response.choices[0]['message']['content'].strip()
        messages.append({"role": "assistant", "content": implementation})
        messages.append({"role": "user", "content": "continue"})
        end_of_html = "</html>" in implementation.strip()
        counter += 1

    # Find the substring that starts with <html> and ends with </html>
    html_pattern = re.compile(r"<html>.*</html>", re.DOTALL)
    html_match = html_pattern.search(implementation)
    if html_match:
        implementation = html_match.group(0)

    return implementation.strip()
def save_tool(tool_name, implementation):
    file_name = os.path.join("tools", f"{tool_name.lower().replace(' ', '_')}.html")

    with open(file_name, "w", encoding="utf-8") as file:
        file.write(implementation)

    print(f"Tool successfully created and saved as {file_name}")

def main():
    # Set OpenAI API key
    openai.api_key = ""

    # Get tool name from user
    tool_name = get_tool_name()

    # Get tool description
    description = get_description(tool_name)

    print(description)

    # Get tool implementation
    implementation = get_tool_implementation(tool_name, description)

    # Save the tool implementation to a file
    save_tool(tool_name, implementation)

main()