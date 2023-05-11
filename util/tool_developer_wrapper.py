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
    html_page = urlopen("http://localhost/")
    soup = BeautifulSoup(html_page, "html.parser")
    links = soup.find_all("a", href=re.compile("^tools/"))
    tool_names = [link.find("h2").text for link in links]
    return tool_names

def generate_new_tool_names(existing_tools, num_options=8):
    load_dotenv()
    openai.api_key = os.getenv('OPENAI_API_KEY')

    forbidden_tools = ["Random Password Generator", "Image Color Palette Extractor", "URL Shortener", "Image Watermarker", "Currency Converter", "File Type Converter", "IP Address Locator", "Text to Speech Converter", "Password Manager", "File Type Detector", "Audio Speed Changer", "Image to ASCII Art Converter", "Markdown Editor", "Online Mind Map Maker", "Image to PDF Converter"]

    messages = [
        {"role": "assistant", "content": "As an AI expert in tool development, I can generate ideas for standalone web tools that work without backend functionality. The tools should be entirely client-side, not relying on any server-side processing. My output will have the format: \"\nUnit Converter: Transform units like a boss! This unit converter is so epic, it'll make your head spin.\nJSON Formatter: Transform messy JSON into a beautiful and organized format with just a click! Copy and paste your JSON code and voila!\n...\n\".\nMy suggestions will be creative and good fitting additions to the existing tools."},
        {"role": "system", "content": f"Suggestion blacklist: {', '.join(forbidden_tools)}\nExisting tools: {', '.join(existing_tools)}."},
        {"role": "user", "content": f"Generate {num_options} tool names for practical standalone web tools that work entirely on the client side without relying on any backend or server-side functionality. Don't suggest tools that already exist. Don't suggest tools that are similar to tools that already exist."}
    ]

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=300,
            n=1,
            stop=None,
            temperature=0.3,
            top_p=0.3,
        )
    except Exception as e:
        print(f"Error: API call failed: {e}")
        return None

    response_text = response.choices[0]['message']['content'].strip()
    tool_name_and_descriptions = response_text.split('\n')
    print(response_text)

    tool_names_and_descriptions = []
    for tool_and_description in tool_name_and_descriptions:
        # Remove enumeration numbers, if present
        tool_and_description = re.sub(r'^\d+\.\s*', '', tool_and_description)
        tool_name, description = tool_and_description.split(": ", 1)
        tool_names_and_descriptions.append((tool_name.strip(), description.strip()))

    return tool_names_and_descriptions

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
    new_tool_div = f"""    <div class="game-card">
        <a href="{file_path}">
            <img src="screenshots/screenshot_{screenshot_number}.png" alt="{entry_name}" loading="lazy">
            <h2>{entry_name}</h2>
            <p>{description}</p>
        </a>
    </div>"""
    index_content = index_content.replace('<!-- end -->', f'{new_tool_div}\n<!-- end -->')

    # Write the updated index.html content
    with open("index.html", "w", encoding="utf-8") as index_file:
        index_file.write(index_content)

    # Read sidebar.html content
    with open("sidebar.html", "r", encoding="utf-8") as sidebar_file:
        sidebar_content = sidebar_file.read()

    # Append new tool list item
    new_tool_li = f'      <li><a href="/{file_path}">{entry_name}</a></li>'
    sidebar_content = sidebar_content.replace('<!-- end -->', f'{new_tool_li}\n<!-- end -->')

    # Write the updated sidebar.html content
    with open("sidebar.html", "w", encoding="utf-8") as sidebar_file:
        sidebar_file.write(sidebar_content)

def main():
    existing_tools = get_existing_tools()
    print(existing_tools)

    tool_names_and_descriptions = generate_new_tool_names(existing_tools)
    if not tool_names_and_descriptions:
        print("Failed to generate new tool names and descriptions.")
        return

    print("\nChoose a tool from the list below by entering the corresponding number:")
    for i, (tool_name, description) in enumerate(tool_names_and_descriptions):
        print(f"{i + 1}. {tool_name}: {description}")

    choice = int(input("\nEnter your choice: ")) - 1
    tool_name, description = tool_names_and_descriptions[choice]

    file_name = f"{tool_name.lower().replace(' ', '_')}.html"
    file_path = f"tools/{file_name}"

    print(file_name, file_path)
    # Use developer.py to create the tool
    outline = get_description(tool_name)
    implementation = get_tool_implementation(tool_name, outline, description)
    save_tool(tool_name, implementation)

    # Use new_entry.py to take a screenshot and update the HTML files
    screenshot_number = take_screenshot(file_path, tool_name, description)
    update_html_files(screenshot_number, file_path, tool_name, description)

    print(f"New tool '{tool_name}' added successfully to the website.")

if __name__ == "__main__":
    main()