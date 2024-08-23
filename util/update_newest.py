import os
import re

def extract_entries_from_index(index_content):
    pattern = r'<div class="game-card">\s*<a href="([^"]+)">\s*<img src="screenshots/screenshot_(\d+).png"[^>]*>\s*<h2>([^<]+)</h2>'
    matches = re.findall(pattern, index_content, re.DOTALL)
    return [{'href': m[0], 'number': int(m[1]), 'title': m[2]} for m in matches]

def update_index_html(root_dir):
    index_path = os.path.join(root_dir, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()

    entries = extract_entries_from_index(content)
    entries.sort(key=lambda x: x['number'], reverse=True)

    newest_div_match = re.search(r'(<div class="game-list newest">)(.*?)(</div>)', content, re.DOTALL)
    if not newest_div_match:
        print("Couldn't find the 'Newest Additions' section. Make sure you've added it to your index.html file.")
        return

    start, _, end = newest_div_match.groups()
    new_content = start + '\n'

    added_entries = 0
    for entry in entries:
        if added_entries >= 7:
            break

        new_content += f'    <div class="game-card">\n'
        new_content += f'        <a href="{entry["href"]}">\n'
        new_content += f'            <img src="screenshots/screenshot_{entry["number"]}.png" alt="{entry["title"]}" loading="lazy">\n'
        new_content += f'            <h2>{entry["title"]}</h2>\n'
        new_content += f'        </a>\n'
        new_content += f'    </div>\n'
        added_entries += 1

    new_content += end

    updated_content = content[:newest_div_match.start()] + new_content + content[newest_div_match.end():]

    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)

if __name__ == "__main__":
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    update_index_html(root_dir)
    print("Index.html has been updated with the 7 newest additions.")