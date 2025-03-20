import os
from datetime import datetime
import json
from github import Github
from dotenv import load_dotenv

# Access the API key
load_dotenv()
GITHUB_ACCESS_TOKEN = os.getenv('GITHUB_ACCESS_TOKEN')

# Set up the GitHub API client with no caching
g = Github(GITHUB_ACCESS_TOKEN, per_page=100)

# Set up the repository and file path
repo = g.get_repo("TobiasMue91/tobiasmue91.github.io")
file_path = "index.html"

# Fetch the commit history for index.html
index_commits = list(repo.get_commits(path=file_path, sha="main"))

# Also fetch the latest commit from the repository (regardless of file)
latest_commit = repo.get_commits()[0]  # First commit is the latest

# Print the date ranges to verify
if index_commits:
    print(f"Oldest index.html commit: {index_commits[-1].commit.author.date}")
    print(f"Latest index.html commit: {index_commits[0].commit.author.date}")
    print(f"Total index.html commits found: {len(index_commits)}")

print(f"Latest repository commit: {latest_commit.commit.author.date} (hash: {latest_commit.sha})")

# Load existing data to preserve GptVersion values
existing_data = {}
try:
    with open("timeline_data.json", "r") as f:
        existing_entries = json.load(f)
        # Create a dictionary with commit hash as key for faster lookup
        for entry in existing_entries:
            existing_data[entry["hash"]] = entry
except FileNotFoundError:
    pass  # No existing file, that's OK

# Process the commits and generate the JSON data
timeline_data = []
last_date = None

for commit in index_commits:
    commit_date = commit.commit.author.date.date()

    if commit_date != last_date:
        # Create new entry
        new_entry = {
            "hash": commit.sha,
            "timestamp": commit.commit.author.date.isoformat(),
            "GptVersion": None  # Default value
        }

        # If this hash exists in our existing data and has a GptVersion, preserve it
        if commit.sha in existing_data and existing_data[commit.sha].get("GptVersion"):
            new_entry["GptVersion"] = existing_data[commit.sha]["GptVersion"]

        timeline_data.append(new_entry)
        last_date = commit_date

# Check if today's date is already in the timeline
today = datetime.now().date()
has_today_entry = any(datetime.fromisoformat(entry["timestamp"]).date() == today for entry in timeline_data)

# If not, add the latest commit from the repository
if not has_today_entry:
    latest_entry = {
        "hash": latest_commit.sha,
        "timestamp": latest_commit.commit.author.date.isoformat(),
        "GptVersion": None  # You can set this manually later
    }

    # If this hash exists in our existing data and has a GptVersion, preserve it
    if latest_commit.sha in existing_data and existing_data[latest_commit.sha].get("GptVersion"):
        latest_entry["GptVersion"] = existing_data[latest_commit.sha]["GptVersion"]

    print(f"Adding latest repository commit for today")
    timeline_data.insert(0, latest_entry)  # Insert at the beginning (most recent)

# Save the JSON data to a file
with open("timeline_data.json", "w") as f:
    json.dump(timeline_data, f, indent=2)

print("Timeline data saved to timeline_data.json")