"""
Rebuild the two files the home page's time travel bar reads.

timeline_data.json lists the days it can visit: one snapshot per day on which the
catalogue changed (index.html itself, or since 2025 the data/games.json and
data/tools.json it renders). Each snapshot is the last commit of that day on the main
branch's first-parent line. The model names in "GptVersion" are set by hand; they are
kept by date, so re-running this never loses them.

timeline_pages.json lists the versions of every page in games/ and tools/, so the bar
can step through one page commit by commit, including the commits of a pull request
that reached main in a single merge:

    "games/snake.html": [[hash, time, message], ..., [hash, time, message, extra]]
    "games/old_name.html": "games/new_name.html"

Oldest first. extra holds "live", the time the merge that brought the commit onto
main was made, when that is not the commit's own time, and "path" when the page had
another name then. Renamed pages are listed under their latest name, and each older
name points there. Commits that touch many pages and change each by a line or two
(a favicon, a sidebar, a model name everywhere) are left out: they are housekeeping,
and the version after them carries the change.

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
PAGES_OUTPUT = ROOT / "timeline_pages.json"
WATCHED = ["index.html", "data/games.json", "data/tools.json"]
PAGE_DIRS = ["games", "tools"]
# A commit that touches at least SWEEP_PAGES pages is a sweep; in a page it changes by
# at most SWEEP_LINES lines (added plus removed) it is not a version of its own.
SWEEP_PAGES = 8
SWEEP_LINES = 10
MESSAGE_LENGTH = 200


def git(*args: str) -> str:
    return subprocess.run(["git", "-c", "core.quotePath=false", *args],
                          cwd=ROOT, check=True, capture_output=True, text=True).stdout


def utc(stamp: str) -> str:
    return datetime.fromisoformat(stamp).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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


def publication_times(ref: str) -> dict[str, str]:
    """When each commit reached the main line: its own time, or that of the merge that brought it."""
    live = {}
    for line in git("log", "--first-parent", "--format=%H %cI %P", ref).splitlines():
        sha, stamp, *parents = line.split()
        live[sha] = utc(stamp)
        if len(parents) > 1:
            for merged in git("rev-list", f"{parents[0]}..{sha}").split():
                live.setdefault(merged, utc(stamp))
    return live


def clean_message(subject: str) -> str:
    """The subject line, without the "- " that opens most of the older ones."""
    text = " ".join(subject.split())
    if text.startswith("- "):
        text = text[2:]
    return text if len(text) <= MESSAGE_LENGTH else text[:MESSAGE_LENGTH - 1].rstrip() + "…"


def is_page(path: str) -> bool:
    return path.endswith(".html")


def page_histories(ref: str) -> dict:
    """Every page's versions, oldest first, keyed by its latest path; older paths map to that."""
    live = publication_times(ref)
    # Lines changed per (commit, path), to tell a sweep's one-line edits from real work.
    sizes, sha = {}, None
    for line in git("log", "--no-merges", "--no-renames", "--numstat", "--format=@%H", ref, "--", *PAGE_DIRS).splitlines():
        if line.startswith("@"):
            sha = line[1:]
        elif line.strip():
            added, removed, path = line.split("\t", 2)
            sizes[(sha, path)] = (int(added) if added != "-" else 0) + (int(removed) if removed != "-" else 0)

    log = git("log", "--no-merges", "--date-order", "--reverse", "-M", "--name-status",
              "--format=@%H\x1f%cI\x1f%s", ref, "--", *PAGE_DIRS)
    commits = []
    for line in log.splitlines():
        if line.startswith("@"):
            sha, stamp, subject = line[1:].split("\x1f", 2)
            commits.append((sha, utc(stamp), clean_message(subject), []))
        elif line.strip():
            status, *paths = line.split("\t")
            if all(is_page(p) for p in paths):
                commits[-1][3].append((status[0], paths))

    current = {}   # path -> the history (a list of versions) that goes by that name now
    former = {}    # a name a history had before a rename -> that history
    for sha, stamp, message, changes in commits:
        sweep = len(changes) >= SWEEP_PAGES
        # All at once: one commit can move a page away and another into its place.
        moved = {paths[0]: current.pop(paths[0], None) for status, paths in changes if status == "R"}
        for status, paths in changes:
            path = paths[-1]
            if status == "D":
                continue  # its history stays, for the days it still existed
            if status in "RC":
                history = moved.get(paths[0]) if status == "R" else None
                if history is not None:
                    former[paths[0]] = history
                history = history if history is not None else []
            else:
                history = current.get(path, [])
                if status == "M" and sweep and sizes.get((sha, path), 0) <= SWEEP_LINES and history:
                    continue
            current[path] = history
            history.append({"hash": sha, "time": stamp, "message": message, "path": path,
                            "live": live.get(sha, stamp)})

    pages = {}
    for path, history in current.items():
        if history:
            pages[path] = [version_row(v, path) for v in history]
    for old, history in former.items():
        if old in pages or not history:
            continue  # the name was taken again by another page
        pages[old] = next(p for p, h in current.items() if h is history)
    return dict(sorted(pages.items()))


def version_row(version: dict, key: str) -> list:
    row = [version["hash"], version["time"], version["message"]]
    extra = {}
    if version["live"] != version["time"]:
        extra["live"] = version["live"]
    if version["path"] != key:
        extra["path"] = version["path"]
    return row + [extra] if extra else row


def write_pages(pages: dict) -> None:
    """One version per line, so a rebuild shows up in a diff as the lines it added."""
    lines = []
    for path, value in pages.items():
        if isinstance(value, str):
            lines.append(f"  {json.dumps(path)}: {json.dumps(value)}")
        else:
            rows = ",\n".join("    " + json.dumps(row, ensure_ascii=False) for row in value)
            lines.append(f"  {json.dumps(path)}: [\n{rows}\n  ]")
    PAGES_OUTPUT.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")


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

    pages = page_histories(ref)
    write_pages(pages)
    histories = [h for h in pages.values() if isinstance(h, list)]
    print(f"{sum(map(len, histories))} versions of {len(histories)} pages written to {PAGES_OUTPUT.name}")


if __name__ == "__main__":
    main()
