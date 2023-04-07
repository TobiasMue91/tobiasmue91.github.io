import os
from pathlib import Path
from PIL import Image
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# Prompt user for input
file_path = input("Enter the file path: ")
entry_name = input("Enter the tool/game name: ")
description = input("Enter the description: ")

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

# resize and save the screenshot
image = Image.open(screenshot_file)
resized_image = image.resize((260, 260), Image.ANTIALIAS)
resized_image.save(screenshot_file)

# Print the dynamic HTML block
print(f"""
<div class="game-card">
    <a href="{file_path}">
        <img src="screenshots/screenshot_{screenshot_number}.png" alt="{entry_name}" loading="lazy">
        <h2>{entry_name}</h2>
        <p>{description}</p>
    </a>
</div>
""")

# Print the HTML list item
print(f'<li><a href="/{file_path}">{entry_name}</a></li>')