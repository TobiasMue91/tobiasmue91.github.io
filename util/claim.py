"""
Claim a game before working on it, so two sessions never rework the same one.

A claim is a branch on GitHub, claim/<id>/<sha>, where <sha> is the last commit on main
that changed games/<id>.html. Pushing it is create-only, so of two sessions claiming the
same game at the same moment exactly one succeeds. Claims are never deleted (a session
cannot delete a remote branch): once the rework is merged, the game's last commit changes,
and with it the name any new claim would take, so the old claim simply stops counting. A
claim older than STALE_DAYS whose game never changed is treated as abandoned.

Usage:
    python util/claim.py                    # claim the game whose last big change is oldest
    python util/claim.py games/2048.html    # claim this one, or fail if it is taken
    python util/claim.py --list             # show the queue and the claims, claim nothing

Prints the claimed page's path on success; exits 1 if the named game is taken or nothing
is left to claim.
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN = "origin/main"
STALE_DAYS = 7
BIG_CHANGE = 150  # lines added plus removed that make a commit a real rework


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, check=check, capture_output=True, text=True)


def fetch() -> None:
    git("fetch", "--quiet", "origin", "main")
    git("fetch", "--quiet", "--prune", "origin", "+refs/heads/claim/*:refs/remotes/origin/claim/*")


def games() -> list[str]:
    return [g["url"] for g in json.loads(git("show", f"{MAIN}:data/games.json").stdout)]


@lru_cache(maxsize=None)
def last_commit(path: str) -> str:
    return git("log", "-1", "--format=%H", MAIN, "--", path).stdout.strip()[:12]


@lru_cache(maxsize=None)
def last_big_change(path: str) -> str:
    """The date of the newest commit on main that changed the page by BIG_CHANGE lines or more."""
    log = git("log", "--no-merges", "--numstat", "--format=@%cI", MAIN, "--", path).stdout
    when = None
    for line in log.splitlines():
        if line.startswith("@"):
            when = line[1:]
        elif line.strip():
            added, removed, _ = line.split("\t", 2)
            if added != "-" and int(added) + int(removed) >= BIG_CHANGE:
                return when
    return "0000"


def claims() -> dict[str, list[tuple[str, datetime]]]:
    """claim/<id>/<sha>[-n] on the remote, by "<id>/<sha>", with when each was made."""
    out = git("for-each-ref", "--format=%(refname:strip=4) %(committerdate:iso-strict)",
              "refs/remotes/origin/claim").stdout
    found = {}
    for line in out.splitlines():
        name, stamp = line.split(" ", 1)
        m = re.fullmatch(r"(.+/[0-9a-f]{12})(?:-\d+)?", name)
        if m:
            found.setdefault(m.group(1), []).append((name, datetime.fromisoformat(stamp)))
    return found


def game_id(path: str) -> str:
    return Path(path).stem


def status(path: str, taken: dict) -> tuple[str, str]:
    """('free' | 'claimed' | 'abandoned', the claim name a new claim would take)."""
    key = f"{game_id(path)}/{last_commit(path)}"
    held = taken.get(key, [])
    if not held:
        return "free", key
    now = datetime.now(timezone.utc)
    if any((now - when).days < STALE_DAYS for _, when in held):
        return "claimed", key
    return "abandoned", f"{key}-{len(held) + 1}"


def claim(path: str, name: str) -> bool:
    """Create claim/<name> on the remote, only if it does not exist yet."""
    branch = git("branch", "--show-current").stdout.strip() or "a detached checkout"
    commit = git("commit-tree", f"{MAIN}^{{tree}}", "-p", MAIN,
                 "-m", f"claim {path}\n\nWorked on in {branch}.").stdout.strip()
    ref = f"refs/heads/claim/{name}"
    return git("push", "--quiet", f"--force-with-lease={ref}:", "origin", f"{commit}:{ref}", check=False).returncode == 0


def main() -> None:
    args = sys.argv[1:]
    fetch()
    taken = claims()

    if args and args[0] == "--list":
        try:
            for path in sorted(games(), key=last_big_change):
                state, name = status(path, taken)
                print(f"{last_big_change(path)[:10]}  {state:9}  {path}", flush=True)
        except BrokenPipeError:  # piped into head
            sys.stderr.close()
        return

    if args:
        path = args[0] if args[0].startswith("games/") else f"games/{args[0].removesuffix('.html')}.html"
        if path not in games():
            sys.exit(f"{path} is not in data/games.json")
        state, name = status(path, taken)
        if state == "claimed" or not claim(path, name):
            sys.exit(f"{path} is already claimed by another session (claim/{name})")
        print(path)
        return

    for path in sorted(games(), key=last_big_change):
        state, name = status(path, taken)
        if state == "claimed":
            continue
        if claim(path, name):
            print(path)
            return
        # Another session claimed it a moment ago; look again and move on.
        fetch()
        taken = claims()
    sys.exit("every game is claimed")


if __name__ == "__main__":
    main()
