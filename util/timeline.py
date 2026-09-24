"""
Rebuild timeline_data.json, the list of days the home page's time travel bar can visit.

One snapshot per day on which the catalogue changed: index.html itself, or since 2025
the data/games.json and data/tools.json it renders. Each snapshot is the last commit
of that day on the main branch's first-parent line. The model names in "GptVersion"
are set by hand; they are kept by date, so re-running this never loses them.

Reads the local git history, so it needs a full clone (not a shallow one) but no token.

Usage:
    python util/timeline.py              # from the main branch
    python util/timeline.py --ref HEAD   # from whatever is checked out
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "timeline_data.json"
WATCHED = ["index.html", "data/games.json", "data/tools.json"]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def resolve_ref(ref: str) -> str:
    try:
        git("rev-parse", "--verify", "--quiet", ref)
        return ref
    except subprocess.CalledProcessError:
        print(f"'{ref}' not found, using HEAD", file=sys.stderr)
        return "HEAD"


def daily_snapshots(ref: str) -> list[dict]:
    """Newest first: the last commit of every day that touched a watched file."""
    log = git("log", "--first-parent", "--format=%H %cI", ref, "--", *WATCHED)
    snapshots, seen_days = [], set()
    for line in log.splitlines():
        sha, stamp = line.split()
        when = datetime.fromisoformat(stamp).astimezone(timezone.utc)
        day = when.date().isoformat()
        if day in seen_days:
            continue
        seen_days.add(day)
        snapshots.append({"hash": sha, "timestamp": when.isoformat(), "GptVersion": None})
    return snapshots


def carry_labels(snapshots: list[dict], previous: list[dict]) -> None:
    """Put each hand-set model name back on the snapshot of its day, or the next one after."""
    labels = sorted(
        (entry["timestamp"][:10], entry["GptVersion"])
        for entry in previous
        if entry.get("GptVersion") and entry["GptVersion"] != "CURRENT"
    )
    oldest_first = list(reversed(snapshots))
    for day, label in labels:
        target = next((s for s in oldest_first if s["timestamp"][:10] >= day), None)
        if target is None:
            print(f"No snapshot on or after {day} for '{label}', dropped", file=sys.stderr)
        elif target["GptVersion"] and target["GptVersion"] != label:
            print(f"{target['timestamp'][:10]} already has '{target['GptVersion']}', '{label}' dropped", file=sys.stderr)
        else:
            target["GptVersion"] = label


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ref", default="main", help="branch or commit to read the history of (default: main)")
    args = parser.parse_args()

    if git("rev-parse", "--is-shallow-repository").strip() == "true":
        sys.exit("This is a shallow clone; run `git fetch --unshallow` first.")

    ref = resolve_ref(args.ref)
    snapshots = daily_snapshots(ref)
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else []
    carry_labels(snapshots, previous)

    OUTPUT.write_text(json.dumps(snapshots, indent=2) + "\n")
    print(f"{len(snapshots)} snapshots from {snapshots[-1]['timestamp'][:10]} to {snapshots[0]['timestamp'][:10]} "
          f"written to {OUTPUT.name}")


if __name__ == "__main__":
    main()
