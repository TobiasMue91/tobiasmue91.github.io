import os
import json
import subprocess
from pathlib import Path
from PIL import Image
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

def get_recently_modified_paths_git(project_root, num_entries=10):
    """Get recently modified files using git"""
    try:
        # Get the list of files modified in the most recent commits
        result = subprocess.run(
            ["git", "-C", str(project_root), "log", "--name-only", "--pretty=format:", "-n", "50"],
            capture_output=True, text=True, check=True
        )

        # Parse the output to get unique file paths
        modified_files = [line.strip() for line in result.stdout.split('\n') if line.strip()]

        # Filter to include only relevant paths (HTML, JS, or other web content)
        relevant_files = []
        for file_path in modified_files:
            if file_path.endswith(('.html', '.htm', '.js', '.css', '.php')) and os.path.exists(project_root / file_path):
                relevant_files.append(file_path)

        # Remove duplicates and limit to requested number
        unique_files = list(dict.fromkeys(relevant_files))
        return unique_files[:num_entries]
    except Exception as e:
        print(f"Error using git to find modified files: {str(e)}")
        return []

def get_recently_modified_paths_timestamp(project_root, num_entries=10):
    """Get recently modified files using file timestamps"""
    try:
        # Get all HTML, JS, and other web content files
        all_files = []
        for ext in ['.html', '.htm', '.js', '.css', '.php']:
            all_files.extend(list(project_root.glob(f"**/*{ext}")))

        # Sort by modification time (newest first)
        modified_files = sorted(all_files, key=lambda x: os.path.getmtime(x), reverse=True)

        # Convert to relative paths
        relative_paths = [str(path.relative_to(project_root)) for path in modified_files]

        return relative_paths[:num_entries]
    except Exception as e:
        print(f"Error finding modified files by timestamp: {str(e)}")
        return []

def get_last_modification_time_git(file_path, project_root):
    """Get the last modification time of a file using git"""
    try:
        # Get the timestamp of the last commit that modified this file
        result = subprocess.run(
            ["git", "-C", str(project_root), "log", "-1", "--format=%at", "--", str(file_path)],
            capture_output=True, text=True, check=True
        )

        # Parse the output to get the timestamp
        timestamp = result.stdout.strip()
        if timestamp:
            return int(timestamp)
        return None
    except Exception as e:
        print(f"Error getting git modification time for {file_path}: {str(e)}")
        return None

def update_screenshots(entries_file, modified_paths=None, max_entries=10, base_url="http://localhost:80", screenshot_age_days=7):
    """
    Update screenshots for recently modified entries in a JSON file, excluding screenshots updated recently

    Args:
        entries_file: Path to the JSON file with entries
        modified_paths: List of recently modified file paths
        max_entries: Maximum number of entries to update
        base_url: Base URL for the local server
        screenshot_age_days: Skip screenshots updated within this many days
    """
    # Get absolute project root path (2 levels up from the script location)
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    # Convert relative path to absolute
    entries_path = project_root / entries_file

    print(f"Processing file: {entries_path}")

    # Load JSON data with UTF-8 encoding
    with open(entries_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Error: Could not parse JSON file {entries_path}")
            return

    # Handle different JSON structures
    if isinstance(data, dict) and "entries" in data:
        entries = data["entries"]
    elif isinstance(data, list):
        entries = data
    else:
        entries = [data]

    # Filter entries to only those recently modified
    if modified_paths:
        filtered_entries = []
        for entry in entries:
            if "url" in entry:
                # Check if this entry's URL matches any of the modified paths
                for path in modified_paths:
                    if entry["url"] in path or path in entry["url"]:
                        filtered_entries.append(entry)
                        break

        # If no matching entries found, take the most recent ones by date field
        if not filtered_entries and entries and "date" in entries[0]:
            sorted_entries = sorted(entries, key=lambda x: x.get("date", ""), reverse=True)
            filtered_entries = sorted_entries[:max_entries]
            print(f"No matching files found. Using {len(filtered_entries)} most recent entries by date.")

        entries = filtered_entries[:max_entries]

    if not entries:
        print("No entries to update.")
        return

    print(f"Checking {len(entries)} entries for screenshot updates...")

    # Current time as a UNIX timestamp
    current_time = time.time()

    # Minimum age threshold in seconds
    age_threshold = current_time - (screenshot_age_days * 24 * 60 * 60)

    # Filter out entries with recently updated screenshots
    entries_to_update = []
    for entry in entries:
        if "url" not in entry or "screenshot" not in entry:
            continue

        screenshot_path = entry["screenshot"]
        abs_screenshot_path = project_root / screenshot_path

        # Skip if screenshot doesn't exist yet (always update in this case)
        if not abs_screenshot_path.exists():
            entries_to_update.append(entry)
            continue

        # Check when screenshot was last updated using git
        last_update = get_last_modification_time_git(abs_screenshot_path, project_root)

        # If we couldn't get git info or the screenshot is older than the threshold, update it
        if not last_update or last_update < age_threshold:
            entries_to_update.append(entry)
        else:
            print(f"Skipping recently updated screenshot: {screenshot_path}")

    entries = entries_to_update

    if not entries:
        print("No entries need screenshot updates.")
        return

    print(f"Updating screenshots for {len(entries)} entries...")

    # Set up headless browser with CSS to hide scrollbars
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--hide-scrollbars")  # Hide scrollbars in Chrome
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_window_size(800, 800)

    # Update screenshots for each entry
    for i, entry in enumerate(entries):
        if "url" not in entry or "screenshot" not in entry:
            print(f"Skipping entry {i+1}: Missing url or screenshot")
            continue

        url = entry["url"]
        screenshot_path = entry["screenshot"]

        # Convert screenshot path to absolute path
        abs_screenshot_path = project_root / screenshot_path

        print(f"[{i+1}/{len(entries)}] Updating: {entry.get('title', url)}")

        try:
            # Ensure screenshot directory exists
            abs_screenshot_path.parent.mkdir(parents=True, exist_ok=True)

            # Take screenshot
            full_url = f"{base_url}/{url}" if not url.startswith("http") else url
            print(f"  Loading: {full_url}")
            driver.get(full_url)

            # Wait for page to load
            time.sleep(1)

            # Hide scrollbars, #sidebar-toggle and a.logo elements before taking screenshot
            driver.execute_script("""
                // Hide scrollbars
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                document.documentElement.style.msOverflowStyle = 'none';
                document.documentElement.style.scrollbarWidth = 'none';

                // Hide sidebar-toggle
                const sidebarToggle = document.getElementById('sidebar-toggle');
                if (sidebarToggle) {
                    sidebarToggle.style.display = 'none';
                }

                // Hide logo links
                const logoLinks = document.querySelectorAll('a.logo');
                logoLinks.forEach(link => {
                    link.style.display = 'none';
                });
            """)

            # Take screenshot
            driver.save_screenshot(str(abs_screenshot_path))

            # Resize screenshot
            image = Image.open(abs_screenshot_path)
            resized_image = image.resize((260, 260), Image.LANCZOS)
            resized_image.save(abs_screenshot_path)

            print(f"  ✓ Screenshot updated: {screenshot_path}")
        except Exception as e:
            print(f"  ✗ Error updating screenshot: {str(e)}")

    driver.quit()
    print(f"Screenshot update completed for {entries_path}")

if __name__ == "__main__":
    print("Screenshot Update Tool")
    print("---------------------")

    # Get absolute project root path
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    # Ask for method to determine recent changes
    print("\nHow would you like to identify recently changed files?")
    print("1: Use git history (recommended)")
    print("2: Use file timestamps")
    print("3: Update all entries")

    choice = input("Enter choice (default: 1): ") or "1"

    # Default base URL
    base_url = input("\nEnter the base URL (default: http://localhost:80): ") or "http://localhost:80"

    # Get number of entries to update
    max_entries = int(input("\nEnter maximum number of entries to update (default: 10): ") or "10")

    # Get screenshot age threshold
    screenshot_age_days = int(input("\nSkip screenshots updated within the last X days (default: 7): ") or "7")

    # Get modified paths based on chosen method
    modified_paths = None
    if choice == "1":
        print("\nFinding recently modified files using git...")
        modified_paths = get_recently_modified_paths_git(project_root, max_entries)
        print(f"Found {len(modified_paths)} recently modified files")
    elif choice == "2":
        print("\nFinding recently modified files using timestamps...")
        modified_paths = get_recently_modified_paths_timestamp(project_root, max_entries)
        print(f"Found {len(modified_paths)} recently modified files")
    else:
        print("\nUpdating all entries...")

    # Show modified paths
    if modified_paths:
        print("\nRecently modified files:")
        for path in modified_paths:
            print(f"  - {path}")

    # Process games and tools
    update_screenshots("data/games.json", modified_paths, max_entries, base_url, screenshot_age_days)
    update_screenshots("data/tools.json", modified_paths, max_entries, base_url, screenshot_age_days)

    print("\nScreenshot update process completed!")