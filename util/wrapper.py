import os
import re
import openai
import sys
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pathlib import Path
from urllib.request import urlopen

# Import functions from developer.py and new_entry.py
from developer import get_tool_implementation, save_tool, get_description
from new_entry import webdriver, Options, Image, Path

def get_existing_tools():
    html_page = urlopen("https://gptgames.dev/")
    soup = BeautifulSoup(html_page, "html.parser")
    links = soup.find_all("a", href=re.compile("^tools/"))
    tool_names = [link.find("h2").text for link in links]
    return tool_names

def generate_new_tool_name(existing_tools):
    load_dotenv()
    openai.api_key = os.getenv('OPENAI_API_KEY')

    messages = [
        {"role": "assistant", "content": "As an AI expert in tool development, I can generate ideas for standalone web tools that work without backend functionality.\nMy output will have the format: \"<TOOL_NAME>: <TOOL_DESCRIPTION>\". I will not output anything else."},
        {"role": "user", "content": f"Generate a tool name for a practical standalone web tool and a fitting description with less than 24 words that should explain the main functionality of the tool. The tool should not be one of the existing tools nor be similar to them: {', '.join(existing_tools)}."}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=100,
            n=1,
            stop=None,
            temperature=0.3,
            top_p=0.3,
        )
    except Exception as e:
        print(f"Error: API call failed: {e}")
        return None, None

    response_text = response.choices[0]['message']['content'].strip()
    tool_name, description = response_text.split(": ", 1)
    return tool_name.strip(), description.strip()

def take_screenshot(file_path, entry_name, description):
    # Create screenshots directory if it doesn't exist
    screenshots_dir = Path("screenshots")
    screenshots_dir.mkdir(exist_ok=True)

    # Determine the screenshot file name
    screenshot_number = len(list(screenshots_dir.glob("*.png")))
    screenshot_file = screenshots_dir / f"screenshot_{screenshot_number}.png"

    # Set up headless browser and take a screenshot
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_window_size(800, 800)
    driver.get(f"http://localhost:80/{file_path}")
    driver.save_screenshot(str(screenshot_file))

    # Resize and save the screenshot
    image = Image.open(screenshot_file)
    resized_image = image.resize((260, 260), Image.ANTIALIAS)
    resized_image.save(screenshot_file)

    return screenshot_number

def update_html_files(screenshot_number, file_path, entry_name, description):
    # Read index.html content
    with open("index.html", "r", encoding="utf-8") as index_file:
        index_content = index_file.read()

    # Append new tool div block
    new_tool_div = f"""
<div class="game-card">
    <a href="{file_path}">
        <img src="screenshots/screenshot_{screenshot_number}.png" alt="{entry_name}" loading="lazy">
        <h2>{entry_name}</h2>
        <p>{description}</p>
    </a>
</div>
"""
    index_soup = BeautifulSoup(index_content, "html.parser")
    last_tool_div = index_soup.find_all("div", class_="game-card")[-1]
    last_tool_div.insert_after(BeautifulSoup(new_tool_div, "html.parser"))

    # Write the updated index.html content
    with open("index.html", "w", encoding="utf-8") as index_file:
        index_file.write(str(index_soup))

    # Read sidebar.html content
    with open("sidebar.html", "r", encoding="utf-8") as sidebar_file:
        sidebar_content = sidebar_file.read()

    # Append new tool list item
    new_tool_li = f'<li><a href="/{file_path}">{entry_name}</a></li>'
    sidebar_soup = BeautifulSoup(sidebar_content, "html.parser")
    last_tool_li = sidebar_soup.find_all("li")[-1]
    last_tool_li.insert_after(BeautifulSoup(new_tool_li, "html.parser"))

    # Write the updated sidebar.html content
    with open("sidebar.html", "w", encoding="utf-8") as sidebar_file:
        sidebar_file.write(str(sidebar_soup))

def main():
    existing_tools = get_existing_tools()
    print(existing_tools)
    tool_name, description = generate_new_tool_name(existing_tools)
    print(tool_name, description)

    if tool_name is None or description is None:
        print("Failed to generate a new tool name and description.")
        return

    file_name = f"{tool_name.lower().replace(' ', '_')}.html"
    file_path = f"tools/{file_name}"

    print(file_name, file_path)
    # Use developer.py to create the tool
    outline = get_description(tool_name)
    implementation = get_tool_implementation(tool_name, outline, "")
    save_tool(tool_name, implementation)

    # Use new_entry.py to take a screenshot and update the HTML files
    screenshot_number = take_screenshot(file_path, tool_name, description)
    update_html_files(screenshot_number, file_path, tool_name, description)

    print(f"New tool '{tool_name}' added successfully to the website.")

if __name__ == "__main__":
    main()