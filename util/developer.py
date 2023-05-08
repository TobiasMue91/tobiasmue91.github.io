import openai
import os
import re
import sys
import textwrap
from bs4 import BeautifulSoup
from dotenv import load_dotenv


def get_tool_name():
    tool_name = input("Enter the name of the tool to be created: ")
    return tool_name

def get_additional_criteria():
    print("Enter any additional criteria for the tool (press Enter twice to finish):")
    additional_criteria = []
    while True:
        line = input()
        if line:
            additional_criteria.append(line)
        else:
            break
    return "\n".join(additional_criteria)

def get_description(tool_name):
    messages = [
        {"role": "assistant", "content": "As an AI expert in tool development, I can provide a detailed, high-quality description of standalone web tools using the latest technologies and best practices."},
        {"role": "user", "content": f"Outline the main features, requirements, and design considerations for a standalone web version of the {tool_name} tool. Mention essential libraries, efficient coding practices, modern design principles, and strategies for ensuring responsiveness, performance, and user-friendliness. The outline should be suitable for use as input to generate the actual tool code by an advanced AI. Keep in mind that the tool should work without any backend functionality."}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
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

def get_tool_implementation(tool_name, outline, additional_criteria):
    user_content = f"Create a standalone web tool called {tool_name} based on the following features and requirements:\n\n{outline}\n\n"

    if additional_criteria:
        user_content += f"Also, consider the following additional criteria:\n\n{additional_criteria}\n\n"

    user_content += "Generate a single HTML file with embedded CSS in the <style> section and functional JavaScript in a <script> tag. Incorporate essential libraries, adhere to efficient coding practices and modern design principles, and ensure the tool is responsive, performant, user-friendly, and accessible. Focus on directly generating the HTML without repetition, or placeholders."

    messages = [
       {"role": "assistant", "content": "As an AI expert in tool development, I can generate high-quality standalone web tools using HTML, CSS, and JavaScript. I'll directly output the HTML for the desired tool without explanations or descriptions, focusing on efficiency and best practices."},
       {"role": "user", "content": user_content}
   ]

    implementation = ""
    end_of_html = False
    counter = 1

    while not end_of_html and counter < 2:
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=3000,
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
    # Access the API key
    load_dotenv()
    openai.api_key = os.getenv('OPENAI_API_KEY')

    # Get tool name from user
    tool_name = get_tool_name()

    # Get additional criteria from user
    additional_criteria = get_additional_criteria()

    # Get tool description
    description = get_description(tool_name)

    print(description)

    # Get tool implementation
    implementation = get_tool_implementation(tool_name, description, additional_criteria)

    # Save the tool implementation to a file
    save_tool(tool_name, implementation)

if __name__ == "__main__":
    main()