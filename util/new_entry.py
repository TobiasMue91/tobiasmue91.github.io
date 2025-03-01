import os
import json
from pathlib import Path
from PIL import Image
from datetime import date
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

if __name__ == "__main__":
    # Prompt user for input
    file_path = input("Enter the file path: ")
    entry_name = input("Enter the tool/game name: ")
    description = input("Enter the description: ")

    # Determine if it's a tool or game based on the file path
    entry_type = "tool" if "tools" in file_path.lower() else "game"

    # Ask for additional JSON fields
    ai_powered = input("Is this AI powered? (yes/no): ").lower() == "yes"
    featured = input("Should this be featured? (yes/no): ").lower() == "yes"

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
    resized_image = image.resize((260, 260), Image.LANCZOS)
    resized_image.save(screenshot_file)

    # Create JSON data for the entry
    entry_id = Path(file_path).stem
    today = date.today().strftime("%Y-%m-%d")

    json_entry = {
        "id": entry_id,
        "title": entry_name,
        "description": description,
        "url": file_path,
        "screenshot": f"screenshots/screenshot_{screenshot_number}.png",
        "type": entry_type,
        "aiPowered": ai_powered,
        "featured": featured,
        "date": today
    }

    # Print the JSON entry
    print("\nJSON Entry:")
    print(json.dumps(json_entry, indent=2))

    # Print the HTML list item for sidebar
    print("\nHTML List Item for Sidebar:")
    print(f'<li><a href="/{file_path}">{entry_name}</a></li>')