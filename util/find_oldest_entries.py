#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone
import argparse
import os

def get_git_last_modified_date(file_path):
    """Get the last modification date of a file from git history"""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%aI", "--", file_path],
            capture_output=True, text=True, check=True
        )
        timestamp = result.stdout.strip()
        if timestamp:
            return datetime.fromisoformat(timestamp)
    except Exception as e:
        print(f"Warning: Could not get git timestamp for {file_path}: {e}")

    # Fallback to file system timestamp if git command fails
    try:
        file_timestamp = os.path.getmtime(file_path)
        return datetime.fromtimestamp(file_timestamp, tz=timezone.utc)
    except:
        # Ultimate fallback - current time minus 1 year
        return datetime.now(timezone.utc).replace(year=datetime.now().year-1)

def ensure_timezone(dt):
    """Ensure a datetime has timezone information (add UTC if missing)"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def find_oldest_entries(count=10, item_type=None, include_git_date=True):
    """Find the oldest entries from games.json and tools.json"""
    all_entries = []
    project_root = Path('.')

    # Process games.json
    try:
        games_file = project_root / 'data' / 'games.json'
        if games_file.exists():
            with open(games_file, 'r', encoding='utf-8') as f:
                games_data = json.load(f)

            for game in games_data:
                if item_type and item_type.lower() != 'game':
                    continue

                entry_date = None

                # Try to get date from the entry itself
                if 'date' in game and game['date']:
                    try:
                        # Parse date and ensure it has timezone
                        entry_date = datetime.fromisoformat(game['date'].replace('Z', '+00:00') if game['date'].endswith('Z') else game['date'])
                        entry_date = ensure_timezone(entry_date)
                    except (ValueError, TypeError):
                        pass

                # If include_git_date is True, check if we can get a more recent git date
                if include_git_date and 'url' in game and game['url']:
                    game_path = game['url']
                    if game_path.startswith('http'):
                        # Skip external URLs for git check
                        pass
                    else:
                        # Make path relative to project root
                        if game_path.startswith('/'):
                            game_path = game_path[1:]

                        # Only check git if file exists
                        full_path = project_root / game_path
                        if full_path.exists():
                            git_date = get_git_last_modified_date(full_path)
                            git_date = ensure_timezone(git_date)
                            if git_date and (not entry_date or git_date > entry_date):
                                entry_date = git_date

                # If we still don't have a date, get it from games.json file
                if not entry_date:
                    entry_date = ensure_timezone(get_git_last_modified_date(games_file))

                all_entries.append({
                    'title': game.get('title', 'Unnamed Game'),
                    'type': 'Game',
                    'url': game.get('url', ''),
                    'date': entry_date,
                    'featured': game.get('featured', False),
                    'ai_powered': game.get('aiPowered', False)
                })
    except Exception as e:
        print(f"Error processing games.json: {e}")

    # Process tools.json
    try:
        tools_file = project_root / 'data' / 'tools.json'
        if tools_file.exists():
            with open(tools_file, 'r', encoding='utf-8') as f:
                tools_data = json.load(f)

            for tool in tools_data:
                if item_type and item_type.lower() != 'tool':
                    continue

                entry_date = None

                # Try to get date from the entry itself
                if 'date' in tool and tool['date']:
                    try:
                        # Parse date and ensure it has timezone
                        entry_date = datetime.fromisoformat(tool['date'].replace('Z', '+00:00') if tool['date'].endswith('Z') else tool['date'])
                        entry_date = ensure_timezone(entry_date)
                    except (ValueError, TypeError):
                        pass

                # If include_git_date is True, check if we can get a more recent git date
                if include_git_date and 'url' in tool and tool['url']:
                    tool_path = tool['url']
                    if tool_path.startswith('http'):
                        # Skip external URLs for git check
                        pass
                    else:
                        # Make path relative to project root
                        if tool_path.startswith('/'):
                            tool_path = tool_path[1:]

                        # Only check git if file exists
                        full_path = project_root / tool_path
                        if full_path.exists():
                            git_date = get_git_last_modified_date(full_path)
                            git_date = ensure_timezone(git_date)
                            if git_date and (not entry_date or git_date > entry_date):
                                entry_date = git_date

                # If we still don't have a date, get it from tools.json file
                if not entry_date:
                    entry_date = ensure_timezone(get_git_last_modified_date(tools_file))

                all_entries.append({
                    'title': tool.get('title', 'Unnamed Tool'),
                    'type': 'Tool',
                    'url': tool.get('url', ''),
                    'date': entry_date,
                    'featured': tool.get('featured', False),
                    'ai_powered': tool.get('aiPowered', False)
                })
    except Exception as e:
        print(f"Error processing tools.json: {e}")

    # Sort by date (oldest first)
    all_entries.sort(key=lambda x: x['date'])

    # Return the oldest entries
    return all_entries[:count]

def display_entries(entries):
    """Display entries in a formatted way"""
    if not entries:
        print("No entries found.")
        return

    print("\n{:<40} {:<8} {:<25} {:<8} {:<10}".format(
        "Title", "Type", "Last Updated", "Featured", "AI Powered"))
    print("-" * 95)

    for entry in entries:
        date_str = entry['date'].strftime("%Y-%m-%d %H:%M:%S")
        featured = "Yes" if entry['featured'] else "No"
        ai_powered = "Yes" if entry['ai_powered'] else "No"

        title = entry['title']
        if len(title) > 38:
            title = title[:35] + "..."

        print("{:<40} {:<8} {:<25} {:<8} {:<10}".format(
            title, entry['type'], date_str, featured, ai_powered))

    print("\nTotal entries listed: {}".format(len(entries)))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Find the oldest entries in games.json and tools.json")
    parser.add_argument("-c", "--count", type=int, default=10, help="Number of entries to show (default: 10)")
    parser.add_argument("-t", "--type", choices=["game", "tool"], help="Filter by type (game or tool)")
    parser.add_argument("--no-git", action="store_true", help="Don't check git dates, use only JSON dates")

    args = parser.parse_args()

    print(f"Finding the {args.count} oldest {'games and tools' if not args.type else args.type + 's'}...")
    oldest_entries = find_oldest_entries(args.count, args.type, not args.no_git)
    display_entries(oldest_entries)

    print("\nTip: These entries might need updating or refreshing!")
    if not args.no_git:
        print("Note: Dates reflect the latest of: JSON date field, git history of the entry file")
    else:
        print("Note: Only using dates from JSON files (git check disabled)")