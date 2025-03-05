import os
import glob
import re

def ensure_script_inclusion(directory):
    os.chdir(directory)
    sidebar_pattern = re.compile(r'<script src="\.\./sidebar\.js"( data-position="[^"]+")?></script>')
    logo_pattern = re.compile(r'<script src="\.\./logo\.js"( data-position="[^"]+")?></script>')

    for file in glob.glob("*.html"):
        with open(file, 'r', encoding='utf-8') as html_file:
            lines = html_file.readlines()

        sidebar_present = any(sidebar_pattern.match(line.strip()) for line in lines)
        logo_present = any(logo_pattern.match(line.strip()) for line in lines)

        for i, line in enumerate(lines):
            if line.strip() == '</body>':
                if sidebar_present or logo_present:
                    print(f"File: {file} - OK")
                else:
                    print(f"File: {file} - Missing both script tags, adding logo.js")
                    lines.insert(i, '<script src="../logo.js"></script>\n')
                    with open(file, 'w', encoding='utf-8') as html_file:
                        html_file.writelines(lines)
                break
        else:
            print(f"File: {file} - No closing body tag")

if __name__ == "__main__":
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tools_dir = os.path.join(root_dir, "tools")
    games_dir = os.path.join(root_dir, "games")

    print("\nEnsuring script inclusion in /tools:")
    ensure_script_inclusion(tools_dir)

    print("\nEnsuring script inclusion in /games:")
    ensure_script_inclusion(games_dir)