import os
from datetime import datetime
import json
from github import Github

# Replace with your GitHub access token or use an empty string for public repos
GITHUB_ACCESS_TOKEN = os.environ.get("GITHUB_ACCESS_TOKEN", "")

# Set up the GitHub API client
g = Github(GITHUB_ACCESS_TOKEN)

# Set up the repository and file path
repo = g.get_repo("TobiasMue91/gptgames")
file_path = "index.html"

# Fetch the commit history
commits = repo.get_commits(path=file_path)

# Process the commits and generate the JSON data
timeline_data = []
last_date = None

for commit in commits:
    commit_date = commit.commit.author.date.date()

    if commit_date != last_date:
        timeline_data.append({
            "hash": commit.sha,
            "timestamp": commit.commit.author.date.isoformat(),
            "GptVersion": None  # This can be added manually later
        })
        last_date = commit_date

# Save the JSON data to a file
with open("timeline_data.json", "w") as f:
    json.dump(timeline_data, f, indent=2)

print("Timeline data saved to timeline_data.json")