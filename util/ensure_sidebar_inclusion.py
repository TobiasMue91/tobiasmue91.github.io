import os
import glob
import re

def ensure_sidebar_inclusion(directory):
    os.chdir(directory)
    script_pattern = re.compile(r'<script src="\.\./sidebar\.js"( data-position="[^"]+")?></script>')

    for file in glob.glob("*.html"):
        with open(file, 'r', encoding='utf-8') as html_file:
            lines = html_file.readlines()

        sidebar_present = any(script_pattern.match(line.strip()) for line in lines)
        for i, line in enumerate(lines):
            if line.strip() == '</body>':
                if sidebar_present:
                    print(f"File: {file} - OK")
                else:
                    print(f"File: {file} - Missing script tag, adding it")
                    lines.insert(i, '<script src="../sidebar.js"></script>\n')
                    with open(file, 'w', encoding='utf-8') as html_file:
                        html_file.writelines(lines)
                break
        else:
            print(f"File: {file} - No closing body tag")

if __name__ == "__main__":
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tools_dir = os.path.join(root_dir, "tools")
    games_dir = os.path.join(root_dir, "games")

    print("\nEnsuring sidebar inclusion in /tools:")
    ensure_sidebar_inclusion(tools_dir)

    print("\nEnsuring sidebar inclusion in /games:")
    ensure_sidebar_inclusion(games_dir)