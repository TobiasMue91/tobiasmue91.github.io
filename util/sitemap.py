import json
import subprocess
from datetime import datetime, timezone
from html import escape

root_url = 'https://www.gptgames.dev/'


def get_git_last_modified_date(file_path):
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", file_path],
            capture_output=True, text=True, check=True
        )
        timestamp = result.stdout.strip()
        if timestamp:
            return timestamp
    except Exception as e:
        print(f"Warning: Could not get git timestamp for {file_path}: {e}")

    return datetime.now(timezone.utc).isoformat()


def format_timestamp(timestamp):
    try:
        dt = datetime.fromisoformat(timestamp)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
    except Exception:
        return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')


def normalize_url(url):
    return url.replace('\\', '/')


def is_valid_url(url):
    invalid_chars = ["'", '"', "+", " ", "{", "}", "(", ")"]
    return not any(c in url for c in invalid_chars)


def extract_links_from_html(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    urls = []
    marker = '<a href="'
    start = 0
    while True:
        start = content.find(marker, start)
        if start == -1:
            break
        start += len(marker)
        end = content.find('"', start)
        if end == -1:
            break
        url = content[start:end]
        if not url.startswith('http') and not url.startswith('#') and not url.startswith('mailto:') and is_valid_url(url):
            urls.append(normalize_url(url))
        start = end + 1

    return urls


def load_json_entries(file_path):
    urls = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        file_timestamp = get_git_last_modified_date(file_path)

        for entry in data:
            if not entry.get('url'):
                continue
            url = normalize_url(entry['url'])
            if url.startswith(root_url):
                url = url[len(root_url):]

            # Prefer the per-page commit date written by update_dates.py,
            # then an explicit 'date', and only fall back to the whole-file
            # commit time as a last resort.
            timestamp = None
            for candidate in (entry.get('updated'), entry.get('date')):
                if not candidate:
                    continue
                try:
                    dt = datetime.fromisoformat(candidate)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    timestamp = dt.astimezone(timezone.utc).isoformat()
                    break
                except Exception:
                    continue

            if timestamp is None:
                timestamp = file_timestamp

            urls.append((url, timestamp))
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not process {file_path}: {e}")

    return urls


def generate_sitemap():
    url_timestamps = {}

    index_file = 'index.html'
    index_timestamp = get_git_last_modified_date(index_file)

    for url in extract_links_from_html(index_file):
        url_timestamps.setdefault(url, index_timestamp)

    for data_file in ['data/games.json', 'data/tools.json']:
        for url, timestamp in load_json_entries(data_file):
            url_timestamps[url] = timestamp

    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 '
                'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n')

        f.write(f'  <url>\n'
                f'    <loc>{escape(root_url)}</loc>\n'
                f'    <lastmod>{format_timestamp(index_timestamp)}</lastmod>\n'
                f'    <priority>1.00</priority>\n'
                f'  </url>\n')

        for url in sorted(url_timestamps):
            if url in ('', '/'):
                continue

            path = url.lstrip('/')
            full_url = escape(root_url + path)
            timestamp = format_timestamp(url_timestamps[url])

            f.write(f'  <url>\n'
                    f'    <loc>{full_url}</loc>\n'
                    f'    <lastmod>{timestamp}</lastmod>\n'
                    f'    <priority>0.80</priority>\n'
                    f'  </url>\n')

        f.write('</urlset>\n')

    print(f"Sitemap generated with {len(url_timestamps) + 1} URLs using git timestamps.")


if __name__ == '__main__':
    generate_sitemap()