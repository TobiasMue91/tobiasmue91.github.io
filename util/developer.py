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
        {"role": "assistant", "content": "I am in 'tool development mode' and will try my best to provide a good description for an online tool of your choice."},
        {"role": "user", "content": f"Provide a detailed, streamlined and technical description of a standalone web version of the {tool_name} tool consisting of bullet points. The tool should be a single HTML file containing CSS in the <style> area and JavaScript in a <script> tag. State-of-the-art and highly efficient code, modern design, and libraries are allowed."}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=messages,
            max_tokens=150,
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
        {"role": "assistant", "content": "I am in 'tool development mode' and will try my best to develop a high quality, feature-rich standalone web tool based on HTML, CSS, JS. I will immediately start outputting HTML as soon as you stated the tool of your choice."},
        {"role": "user", "content": f"Create a standalone web tool called {tool_name} based on the following description:\n\n{description}\n\nThe tool should be a single HTML file containing CSS in the <style> area and JavaScript in a <script> tag. State-of-the-art and highly efficient code, modern design, and libraries are allowed."}
    ]

    implementation = ""
    end_of_html = False

    while not end_of_html:
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

        implementation += response.choices[0]['message']['content'].strip()
        end_of_html = implementation.strip().endswith("</html>")

    return implementation.strip()
def save_tool(tool_name, implementation):
    file_name = os.path.join("tools", f"{tool_name.lower().replace(' ', '_')}.html")

    with open(file_name, "w", encoding="utf-8") as file:
        file.write(implementation)

    print(f"Tool successfully created and saved as {file_name}")

def main():
    # Set OpenAI API key
    openai.api_key = "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"

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