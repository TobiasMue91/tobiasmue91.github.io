import os
import json
import subprocess
from pathlib import Path


def get_base_dir():
    return Path(__file__).resolve().parent.parent


def get_last_commit_date(base_dir, rel_path):
    """Return YYYY-MM-DD of the most recent commit that touched rel_path, or None."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", rel_path],
            cwd=base_dir, capture_output=True, text=True, check=True
        )
        out = result.stdout.strip()
        return out or None
    except subprocess.CalledProcessError:
        return None


def process(base_dir, entry_type):
    json_file = base_dir / "data" / f"{entry_type}s.json"
    if not json_file.exists():
        print(f"Skipping {json_file} (not found)")
        return

    with open(json_file, "r", encoding="utf-8") as f:
        entries = json.load(f)

    changed = 0
    for entry in entries:
        url = (entry.get("url") or "").replace("\\", "/")
        if not url:
            continue
        commit_date = get_last_commit_date(base_dir, url)
        if not commit_date:
            commit_date = entry.get("date")
        if entry.get("updated") != commit_date:
            entry["updated"] = commit_date
            changed += 1

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)

    print(f"{entry_type}s.json: {changed} entr{'y' if changed == 1 else 'ies'} updated")


if __name__ == "__main__":
    base_dir = get_base_dir()
    for entry_type in ["tool", "game"]:
        process(base_dir, entry_type)
    print("Done. Don't forget to commit the updated JSON files!")