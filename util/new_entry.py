import os
import json
import subprocess
from pathlib import Path
from PIL import Image
from datetime import date
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def get_base_dir():
    """Get the base directory (parent of the script directory)."""
    return Path(__file__).resolve().parent.parent

def get_latest_git_added_file(directory, base_dir):
    """Get the most recently added file in git within the specified directory."""
    try:
        os.chdir(base_dir)
        result = subprocess.run(
            ["git", "log", "--diff-filter=A", "--name-only", "--pretty=format:", directory],
            capture_output=True, text=True, check=True
        )
        files = [line.strip() for line in result.stdout.split('\n') if line.strip()]
        return files[0] if files else None
    except subprocess.CalledProcessError:
        print("Error executing git command. Make sure git is installed and this is a git repository.")
        return None

def get_title_from_html(file_path):
    """Extract the title from an HTML file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
            title_tag = soup.find('title')
            if title_tag and title_tag.string:
                return title_tag.string.strip()
    except Exception as e:
        print(f"Error extracting title: {e}")
    return None

def get_next_screenshot_number(screenshots_dir):
    """Get the next available screenshot number by checking existing files."""
    # Check both webp and png files for compatibility during transition
    existing_screenshots = list(screenshots_dir.glob("screenshot_*.webp")) + list(screenshots_dir.glob("screenshot_*.png"))
    if not existing_screenshots:
        return 0

    numbers = []
    for screenshot in existing_screenshots:
        try:
            number = int(screenshot.stem.split('_')[1])
            numbers.append(number)
        except (IndexError, ValueError):
            continue

    return max(numbers) + 1 if numbers else 0

def update_json_file(json_file_path, new_entry):
    """Update the JSON file with the new entry."""
    if not os.path.exists(json_file_path):
        json_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump([], f)

    # Read the existing entries with explicit UTF-8 encoding
    with open(json_file_path, 'r', encoding='utf-8') as f:
        entries = json.load(f)

    # Check if an entry with the same ID already exists
    for i, entry in enumerate(entries):
        if entry.get('id') == new_entry['id']:
            entries[i] = new_entry
            break
    else:
        entries.append(new_entry)

    # Write back with explicit UTF-8 encoding
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2)

def update_sidebar(base_dir, file_path, entry_name):
    """Update the sidebar.html file with a new entry."""
    sidebar_path = base_dir / "sidebar.html"

    try:
        # Read the current sidebar content
        with open(sidebar_path, 'r', encoding='utf-8') as f:
            sidebar_content = f.readlines()

        # Find the '<!-- end -->' comment line
        end_line_index = None
        for i, line in enumerate(sidebar_content):
            if '<!-- end -->' in line:
                end_line_index = i
                break

        if end_line_index is not None:
            # Create the new list item
            new_item = f'      <li><a href="/{file_path}">{entry_name}</a></li>\n'

            # Insert the new item before the end comment
            sidebar_content.insert(end_line_index, new_item)

            # Write the updated content back to the file
            with open(sidebar_path, 'w', encoding='utf-8') as f:
                f.writelines(sidebar_content)

            print(f"Added entry to sidebar.html")
            return True
        else:
            print("Couldn't find '<!-- end -->' comment in sidebar.html")
            return False
    except Exception as e:
        print(f"Error updating sidebar: {e}")
        return False

def git_add_file(file_path):
    """Add a file to git."""
    try:
        subprocess.run(["git", "add", str(file_path)], check=True)
        print(f"Added {file_path} to git")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error adding file to git: {e}")
        return False

def take_screenshot(driver, url, screenshot_file):
    """Take a screenshot with specific elements hidden."""
    driver.get(url)

    # Hide the logo and sidebar toggle before taking the screenshot
    hide_elements_script = """
    // Hide logo elements
    document.querySelectorAll('a.logo').forEach(el => {
        el.style.display = 'none';
    });

    // Hide sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.style.display = 'none';
    }
    """
    driver.execute_script(hide_elements_script)

    # Give the page a moment to update after hiding elements
    driver.implicitly_wait(1)

    # Take the screenshot
    driver.save_screenshot(str(screenshot_file))

if __name__ == "__main__":
    base_dir = get_base_dir()

    # Ask the user what type of entry they're adding
    entry_type = ""
    while entry_type not in ["tool", "game"]:
        entry_type = input("Are you adding a tool or a game? (tool/game): ").lower()
        if entry_type not in ["tool", "game"]:
            print("Please enter either 'tool' or 'game'.")

    # Get the latest added file from git based on the entry type
    directory = "tools" if entry_type == "tool" else "games"
    latest_file = get_latest_git_added_file(directory, base_dir)

    if latest_file:
        file_path = latest_file
        full_path = base_dir / file_path

        # Try to extract name from HTML title
        title_from_html = get_title_from_html(full_path)
        if title_from_html:
            entry_name = title_from_html
            print(f"Found title in HTML: {entry_name}")
        else:
            # Fall back to filename
            entry_name = Path(file_path).stem.replace("_", " ").title()
            print(f"Using filename for name: {entry_name}")

        print(f"Found recently added file: {file_path}")
        confirm = input(f"Use '{entry_name}' as the name? (yes/no): ").lower()
        if confirm != "yes":
            entry_name = input("Enter the tool/game name: ")
    else:
        print(f"No recently added file found in the {directory} directory.")
        file_path = input(f"Enter the {entry_type} file path: ")
        full_path = base_dir / file_path

        # Try to extract name from HTML title
        title_from_html = get_title_from_html(full_path)
        if title_from_html:
            entry_name = title_from_html
            print(f"Found title in HTML: {entry_name}")
            confirm = input(f"Use '{entry_name}' as the name? (yes/no): ").lower()
            if confirm != "yes":
                entry_name = input(f"Enter the {entry_type} name: ")
        else:
            entry_name = input(f"Enter the {entry_type} name: ")

    description = input("Enter the description: ")

    # Ask for additional JSON fields
    ai_powered = input("Is this AI powered? (yes/no): ").lower() == "yes"
    featured = input("Should this be featured? (yes/no): ").lower() == "yes"

    # Create screenshots directory if it doesn't exist
    screenshots_dir = base_dir / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)

    # Determine the screenshot file name using our improved method
    screenshot_number = get_next_screenshot_number(screenshots_dir)
    screenshot_file = screenshots_dir / f"screenshot_{screenshot_number}.webp"  # Changed to .webp

    # Set up headless browser
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_window_size(800, 800)

    # Take screenshot with elements hidden
    take_screenshot(driver, f"http://localhost:80/{file_path}", screenshot_file)
    driver.quit()

    # Resize and save the screenshot
    image = Image.open(screenshot_file)
    resized_image = image.resize((260, 260), Image.LANCZOS)
    resized_image.save(screenshot_file, format="WEBP", quality=90, lossless=True)  # WebP settings

    # Add the screenshot to git
    git_add_file(screenshot_file)

    # Create JSON data for the entry
    entry_id = Path(file_path).stem
    today = date.today().strftime("%Y-%m-%d")
    json_entry = {
        "id": entry_id,
        "title": entry_name,
        "description": description,
        "url": file_path,
        "screenshot": f"screenshots/screenshot_{screenshot_number}.webp",  # Changed to .webp
        "type": entry_type,
        "aiPowered": ai_powered,
        "featured": featured,
        "date": today
    }

    # Determine the JSON file to update
    json_file = base_dir / "data" / f"{entry_type}s.json"

    # Update the JSON file
    update_json_file(json_file, json_entry)

    # Add JSON file to git
    git_add_file(json_file)

    # Update the sidebar
    update_sidebar(base_dir, file_path, entry_name)

    # Also add sidebar to git if it was updated
    git_add_file(base_dir / "sidebar.html")

    print(f"\nAdded new {entry_type} entry to {json_file}:")
    print(json.dumps(json_entry, indent=2))

    print("\nAll files have been added to git.")
    print("Don't forget to commit the changes!")