import os
import json
import subprocess
import requests
import logging
from pathlib import Path
from PIL import Image
from datetime import date
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
API_URL="https://chatgpt.tobiasmue91.workers.dev/"
G_CATS=["puzzle","arcade","card","strategy","simulation","word","trivia","multiplayer","other"]
T_CATS=["text","image","converter","generator","utility","calculator","developer","audio","other"]
G_TAGS=["singleplayer","multiplayer","relaxing","competitive","educational","retro","logic","fast-paced"]
T_TAGS=["productivity","creative","developer","educational","privacy","social","entertainment","data"]

def get_base_dir():
    return Path(__file__).resolve().parent.parent

def get_latest_git_added_file(directory, base_dir):
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

def get_latest_git_added_file_any(base_dir):
    for directory in ["tools", "games"]:
        latest = get_latest_git_added_file(directory, base_dir)
        if latest:
            return latest, "tool" if directory == "tools" else "game"
    return None, None

def parse_html_file(file_path):
    title = None
    description = None
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
            title_tag = soup.find('title')
            if title_tag and title_tag.string:
                title = title_tag.string.strip()
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                description = meta_desc['content'].strip()
    except Exception as e:
        print(f"Error parsing HTML: {e}")
    return title, description

def get_next_screenshot_number(screenshots_dir):
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
    if not os.path.exists(json_file_path):
        json_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump([], f)
    with open(json_file_path, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    for i, entry in enumerate(entries):
        if entry.get('id') == new_entry['id']:
            entries[i] = new_entry
            break
    else:
        entries.append(new_entry)
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2)

def update_sidebar(base_dir, file_path, entry_name):
    sidebar_path = base_dir / "sidebar.html"
    try:
        with open(sidebar_path, 'r', encoding='utf-8') as f:
            sidebar_content = f.readlines()
        end_line_index = None
        for i, line in enumerate(sidebar_content):
            if '<!-- end -->' in line:
                end_line_index = i
                break
        if end_line_index is not None:
            new_item = f'      <li><a href="/{file_path}">{entry_name}</a></li>\n'
            sidebar_content.insert(end_line_index, new_item)
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
    try:
        subprocess.run(["git", "add", str(file_path)], check=True)
        print(f"Added {file_path} to git")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error adding file to git: {e}")
        return False

def take_screenshot(driver, url, screenshot_file):
    driver.get(url)
    hide_elements_script = """
    document.querySelectorAll('a.logo').forEach(el => {
        el.style.display = 'none';
    });
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.style.display = 'none';
    }
    """
    driver.execute_script(hide_elements_script)
    driver.implicitly_wait(1)
    driver.save_screenshot(str(screenshot_file))

def classify_entry(title, description, entry_type):
    """Use LLM to assign categories and tags to the entry."""
    cats = G_CATS if entry_type == "game" else T_CATS
    tags = G_TAGS if entry_type == "game" else T_TAGS
    prompt = f"""Classify this {entry_type}:
Title: {title}
Description: {description[:200] if description else 'N/A'}

Assign:
1. One primary category from: {', '.join(cats)}
2. 1-2 tags from: {', '.join(tags)}

Respond ONLY with valid JSON, no markdown:
{{"categories":["category"],"tags":["tag1","tag2"]}}"""

    try:
        resp = requests.post(API_URL,
            headers={"Content-Type":"application/json","Accept":"*/*"},
            json={"model":"gpt-4o-mini","temperature":0.3,"max_tokens":256,
                  "messages":[{"role":"system","content":prompt}]},
            timeout=30)
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            text = text.split("\n",1)[1] if "\n" in text else text[3:]
            if text.endswith("```"): text = text[:-3]
            text = text.strip()
        result = json.loads(text)
        # Validate against allowed values
        result["categories"] = [c for c in result.get("categories",[]) if c in cats][:1]
        result["tags"] = [t for t in result.get("tags",[]) if t in tags][:2]
        if not result["categories"]:
            result["categories"] = ["other"]
        return result
    except Exception as e:
        logging.warning(f"LLM classification failed: {e}")
        return None

if __name__ == "__main__":
    base_dir = get_base_dir()
    latest_file, entry_type = get_latest_git_added_file_any(base_dir)

    if latest_file:
        file_path = latest_file
        full_path = base_dir / file_path
        print(f"Found recently added file: {file_path}")
        print(f"Detected type: {entry_type}")
    else:
        print("No recently added file found in tools or games directories.")
        entry_type = ""
        while entry_type not in ["tool", "game"]:
            entry_type = input("Are you adding a tool or a game? (tool/game): ").lower()
            if entry_type not in ["tool", "game"]:
                print("Please enter either 'tool' or 'game'.")
        file_path = input(f"Enter the {entry_type} file path: ")
        full_path = base_dir / file_path

    title, description = parse_html_file(full_path)
    if not title:
        title = Path(file_path).stem.replace("_", " ").title()
    if not description:
        description = ""

    print(f"\nTitle: {title}")
    print(f"Description: {description}")
    confirm = input("Are these correct? (yes/no): ").lower()
    if confirm != "yes":
        new_title = input(f"Enter title [{title}]: ").strip()
        if new_title:
            title = new_title
        new_description = input(f"Enter description [{description}]: ").strip()
        if new_description:
            description = new_description

    ai_powered = input("Is this AI powered? (yes/no): ").lower() == "yes"
    featured = input("Should this be featured? (yes/no): ").lower() == "yes"

    # LLM classification
    print("\nClassifying entry with LLM...")
    classification = classify_entry(title, description, entry_type)
    if classification:
        categories = classification["categories"]
        tags = classification["tags"]
        print(f"  Categories: {categories}")
        print(f"  Tags: {tags}")
        confirm_cls = input("Accept classification? (yes/no): ").lower()
        if confirm_cls != "yes":
            cats_list = G_CATS if entry_type == "game" else T_CATS
            tags_list = G_TAGS if entry_type == "game" else T_TAGS
            print(f"  Available categories: {', '.join(cats_list)}")
            cat_input = input(f"  Enter category [{categories[0]}]: ").strip()
            if cat_input and cat_input in cats_list:
                categories = [cat_input]
            print(f"  Available tags: {', '.join(tags_list)}")
            tags_input = input(f"  Enter tags comma-separated [{', '.join(tags)}]: ").strip()
            if tags_input:
                tags = [t.strip() for t in tags_input.split(",") if t.strip() in tags_list][:2]
    else:
        print("  LLM classification failed, entering manually.")
        cats_list = G_CATS if entry_type == "game" else T_CATS
        tags_list = G_TAGS if entry_type == "game" else T_TAGS
        print(f"  Available categories: {', '.join(cats_list)}")
        cat_input = input("  Enter category: ").strip()
        categories = [cat_input] if cat_input in cats_list else ["other"]
        print(f"  Available tags: {', '.join(tags_list)}")
        tags_input = input("  Enter tags comma-separated: ").strip()
        tags = [t.strip() for t in tags_input.split(",") if t.strip() in tags_list][:2] if tags_input else []

    screenshots_dir = base_dir / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)
    screenshot_number = get_next_screenshot_number(screenshots_dir)
    screenshot_file = screenshots_dir / f"screenshot_{screenshot_number}.webp"

    chrome_options = Options()
    chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(options=chrome_options)
    driver.set_window_size(800, 800)
    take_screenshot(driver, f"http://localhost:80/{file_path}", screenshot_file)
    driver.quit()

    image = Image.open(screenshot_file)
    resized_image = image.resize((260, 260), Image.LANCZOS)
    resized_image.save(screenshot_file, format="WEBP", quality=90, lossless=True)
    git_add_file(screenshot_file)

    entry_id = Path(file_path).stem
    today = date.today().strftime("%Y-%m-%d")
    json_entry = {
        "id": entry_id,
        "title": title,
        "description": description,
        "url": file_path,
        "screenshot": f"screenshots/screenshot_{screenshot_number}.webp",
        "type": entry_type,
        "aiPowered": ai_powered,
        "featured": featured,
        "date": today,
        "categories": categories,
        "tags": tags
    }

    json_file = base_dir / "data" / f"{entry_type}s.json"
    update_json_file(json_file, json_entry)
    git_add_file(json_file)
    update_sidebar(base_dir, file_path, title)
    git_add_file(base_dir / "sidebar.html")

    print(f"\nAdded new {entry_type} entry to {json_file}:")
    print(json.dumps(json_entry, indent=2))
    print("\nAll files have been added to git.")
    print("Don't forget to commit the changes!")