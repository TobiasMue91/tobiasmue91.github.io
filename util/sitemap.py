import os
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

root_url = 'https://www.gptgames.dev/'

def get_git_last_modified_date(file_path):
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%aI", "--", file_path],
            capture_output=True, text=True, check=True
        )
        timestamp = result.stdout.strip()
        if timestamp:
            return timestamp
    except Exception as e:
        print(f"Warning: Could not get git timestamp for {file_path}: {e}")

    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')

def format_timestamp(timestamp):
    if timestamp and len(timestamp) > 19:
        if ":" not in timestamp[-5:]:
            return f"{timestamp[:-2]}:{timestamp[-2:]}"
        return timestamp

    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')
    return f"{now[:-2]}:{now[-2:]}"

def is_valid_url(url):
    invalid_chars = ["'", '"', "+", " ", "{", "}", "(", ")"]
    return not any(c in url for c in invalid_chars)

def generate_sitemap():
    project_root = Path('.')
    urls = set()
    url_timestamps = {}

    index_file = 'index.html'
    with open(index_file, 'r', encoding='utf-8') as f:
        content = f.read()

    index_timestamp = get_git_last_modified_date(index_file)

    start = 0
    while True:
        start = content.find('<a href="', start)
        if start == -1:
            break
        end = content.find('"', start+9)
        url = content[start+9:end]
        if not url.startswith('http') and not url.startswith('#') and is_valid_url(url):
            urls.add(url)
            url_timestamps[url] = index_timestamp
        start = end

    try:
        games_file = 'data/games.json'
        with open(games_file, 'r', encoding='utf-8') as f:
            games_data = json.load(f)

        games_timestamp = get_git_last_modified_date(games_file)

        for game in games_data:
            if 'url' in game and game['url']:
                game_url = game['url']
                if game_url.startswith(root_url):
                    game_url = game_url[len(root_url):]
                urls.add(game_url)
                url_timestamps[game_url] = games_timestamp

                if 'date' in game and game['date']:
                    try:
                        specific_date = datetime.fromisoformat(game['date'])
                        specific_timestamp = specific_date.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')
                        url_timestamps[game_url] = specific_timestamp
                    except:
                        pass
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not process games data: {e}")

    try:
        tools_file = 'data/tools.json'
        with open(tools_file, 'r', encoding='utf-8') as f:
            tools_data = json.load(f)

        tools_timestamp = get_git_last_modified_date(tools_file)

        for tool in tools_data:
            if 'url' in tool and tool['url']:
                tool_url = tool['url']
                if tool_url.startswith(root_url):
                    tool_url = tool_url[len(root_url):]
                urls.add(tool_url)
                url_timestamps[tool_url] = tools_timestamp

                if 'date' in tool and tool['date']:
                    try:
                        specific_date = datetime.fromisoformat(tool['date'])
                        specific_timestamp = specific_date.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')
                        url_timestamps[tool_url] = specific_timestamp
                    except:
                        pass
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not process tools data: {e}")

    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 '
                'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n')

        f.write(f'  <url>\n'
                f'    <loc>{root_url}</loc>\n'
                f'    <lastmod>{format_timestamp(index_timestamp)}</lastmod>\n'
                f'    <priority>1.00</priority>\n'
                f'  </url>\n')

        for url in sorted(urls):
            if url == '' or url == '/':
                continue

            full_url = root_url + (url if not url.startswith('/') else url[1:])

            timestamp = url_timestamps.get(url, index_timestamp)

            f.write(f'  <url>\n'
                    f'    <loc>{full_url}</loc>\n'
                    f'    <lastmod>{format_timestamp(timestamp)}</lastmod>\n'
                    f'    <priority>0.80</priority>\n'
                    f'  </url>\n')

        f.write('</urlset>')

    print(f"Sitemap generated with {len(urls) + 1} URLs using git timestamps.")

if __name__ == '__main__':
    generate_sitemap()