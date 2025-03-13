import os
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

root_url = 'https://www.gptgames.dev/'

def get_git_last_modified_date(file_path):
    """Get the last modification date of a file from git history"""
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

    # Fallback to current time if git command fails
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')

def format_timestamp(timestamp):
    """Format timestamp for sitemap (ensure correct timezone format)"""
    # If timestamp already has the right format, return it
    if timestamp and len(timestamp) > 19:
        # If the timestamp has no colon in timezone part, add it
        if ":" not in timestamp[-5:]:
            return f"{timestamp[:-2]}:{timestamp[-2:]}"
        return timestamp

    # Fallback to current time with proper format
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')
    return f"{now[:-2]}:{now[-2:]}"

def generate_sitemap():
    project_root = Path('.')
    urls = set()
    url_timestamps = {}

    # Get static URLs from index.html
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
        if not url.startswith('http') and not url.startswith('#'):
            urls.add(url)
            # Initially set timestamp from index.html for static URLs
            url_timestamps[url] = index_timestamp
        start = end

    # Get dynamic URLs from games.json
    try:
        games_file = 'data/games.json'
        with open(games_file, 'r', encoding='utf-8') as f:
            games_data = json.load(f)

        games_timestamp = get_git_last_modified_date(games_file)

        for game in games_data:
            if 'url' in game and game['url']:
                # Remove root domain if present
                game_url = game['url']
                if game_url.startswith(root_url):
                    game_url = game_url[len(root_url):]
                urls.add(game_url)
                # Store the timestamp for this URL
                url_timestamps[game_url] = games_timestamp

                # Try to get a more specific timestamp if the game has a date
                if 'date' in game and game['date']:
                    try:
                        # If the entry has its own date field, use that
                        specific_date = datetime.fromisoformat(game['date'])
                        specific_timestamp = specific_date.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')
                        url_timestamps[game_url] = specific_timestamp
                    except:
                        pass
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not process games data: {e}")

    # Get dynamic URLs from tools.json
    try:
        tools_file = 'data/tools.json'
        with open(tools_file, 'r', encoding='utf-8') as f:
            tools_data = json.load(f)

        tools_timestamp = get_git_last_modified_date(tools_file)

        for tool in tools_data:
            if 'url' in tool and tool['url']:
                # Remove root domain if present
                tool_url = tool['url']
                if tool_url.startswith(root_url):
                    tool_url = tool_url[len(root_url):]
                urls.add(tool_url)
                # Store the timestamp for this URL
                url_timestamps[tool_url] = tools_timestamp

                # Try to get a more specific timestamp if the tool has a date
                if 'date' in tool and tool['date']:
                    try:
                        # If the entry has its own date field, use that
                        specific_date = datetime.fromisoformat(tool['date'])
                        specific_timestamp = specific_date.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S%z')
                        url_timestamps[tool_url] = specific_timestamp
                    except:
                        pass
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not process tools data: {e}")

    # Generate sitemap.xml
    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 '
                'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n')

        # Add root URL
        f.write(f'  <url>\n'
                f'    <loc>{root_url}</loc>\n'
                f'    <lastmod>{format_timestamp(index_timestamp)}</lastmod>\n'
                f'    <priority>1.00</priority>\n'
                f'  </url>\n')

        # Add all other URLs
        for url in sorted(urls):
            if url == '' or url == '/':
                continue  # Skip empty URLs and root URL (already added)

            # Ensure the URL is properly formatted
            full_url = root_url + (url if not url.startswith('/') else url[1:])

            # Get timestamp for this URL (fallback to index.html timestamp if not found)
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