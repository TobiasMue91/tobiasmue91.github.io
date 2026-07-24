"""
Unified update script for gptgames.
Starts a local server, updates entry dates from git, refreshes stale screenshots, then stops the server.

Usage:
    python util/update.py                # defaults: git mode, up to 10 entries
    python util/update.py --all          # update every entry, not just recently changed ones
    python util/update.py --max 20       # raise the cap on entries to process
    python util/update.py --base-url http://localhost:3000  # custom server URL
"""

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

# Optional deps – imported lazily so the date-only path stays lightweight
PIL = None
webdriver = None
ChromeOptions = None


def lazy_import_screenshot_deps():
    global PIL, webdriver, ChromeOptions
    if PIL is None:
        from PIL import Image as _Image
        from selenium import webdriver as _wd
        from selenium.webdriver.chrome.options import Options as _Opts

        PIL = _Image
        webdriver = _wd
        ChromeOptions = _Opts


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
JSON_FILES = ["games.json", "tools.json"]


# ---------------------------------------------------------------------------
# Server helpers
# ---------------------------------------------------------------------------


def _port_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((host, port)) == 0


def start_server(port: int = 80) -> subprocess.Popen | None:
    """Start http-server in the background and wait until it is reachable."""
    if _port_open(port):
        print(f"  Port {port} already in use – assuming server is running.")
        return None

    proc = subprocess.Popen(
        ["npx", "http-server", "-p", str(port), "--silent"],
        cwd=PROJECT_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=(sys.platform == "win32"),
    )

    # Wait up to 10 s for the server to come up
    for _ in range(40):
        if _port_open(port):
            print(f"  Server started on port {port} (pid {proc.pid}).")
            return proc
        time.sleep(0.25)

    proc.kill()
    print("  ERROR: server did not start in time.", file=sys.stderr)
    sys.exit(1)


def stop_server(proc: subprocess.Popen | None):
    if proc is None:
        return
    if sys.platform == "win32":
        # shell=True spawns a child tree; taskkill /T kills the whole tree
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    print("  Server stopped.")


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------


def git_last_commit_epoch(rel_path: str) -> int | None:
    """Return the UNIX epoch of the last commit that touched *rel_path*, or None."""
    try:
        r = subprocess.run(
            ["git", "log", "-1", "--format=%at", "--", rel_path],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        val = r.stdout.strip()
        return int(val) if val else None
    except (subprocess.CalledProcessError, ValueError):
        return None


def git_last_commit_date(rel_path: str) -> str | None:
    """Return YYYY-MM-DD of the last commit that touched *rel_path*, or None."""
    try:
        r = subprocess.run(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", rel_path],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        val = r.stdout.strip()
        return val or None
    except subprocess.CalledProcessError:
        return None


def git_recently_modified_paths(limit: int = 50) -> list[str]:
    """Return relative paths of web-content files touched in recent commits."""
    try:
        r = subprocess.run(
            ["git", "log", "--name-only", "--pretty=format:", "-n", str(limit)],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        seen: dict[str, None] = {}
        for line in r.stdout.splitlines():
            p = line.strip()
            if p and p not in seen and (PROJECT_ROOT / p).exists():
                if any(p.endswith(ext) for ext in (".html", ".htm", ".js", ".css", ".php")):
                    seen[p] = None
        return list(seen)
    except subprocess.CalledProcessError:
        return []


# ---------------------------------------------------------------------------
# 1. Update dates
# ---------------------------------------------------------------------------


def update_dates():
    print("\n── Updating dates ─────────────────────────────────")
    for fname in JSON_FILES:
        json_path = DATA_DIR / fname
        if not json_path.exists():
            print(f"  {fname}: not found, skipping.")
            continue

        with open(json_path, "r", encoding="utf-8") as f:
            entries = json.load(f)

        changed = 0
        for entry in entries:
            url = (entry.get("url") or "").replace("\\", "/")
            if not url:
                continue
            commit_date = git_last_commit_date(url) or entry.get("date")
            if entry.get("updated") != commit_date:
                entry["updated"] = commit_date
                changed += 1

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2)

        print(f"  {fname}: {changed} entr{'y' if changed == 1 else 'ies'} updated.")


# ---------------------------------------------------------------------------
# 2. Update screenshots
# ---------------------------------------------------------------------------


def _needs_screenshot(entry: dict) -> bool:
    """Return True when the source was committed more recently than the screenshot."""
    url = entry.get("url", "")
    screenshot = entry.get("screenshot", "")
    if not url or not screenshot:
        return False

    abs_screenshot = PROJECT_ROOT / screenshot

    # Screenshot doesn't exist yet → always take one
    if not abs_screenshot.exists():
        return True

    source_epoch = git_last_commit_epoch(url)
    screenshot_epoch = git_last_commit_epoch(screenshot)

    # No git info for the source → skip (nothing changed that we know of)
    if source_epoch is None:
        return False

    # No git info for the screenshot → be safe and retake
    if screenshot_epoch is None:
        return True

    return source_epoch > screenshot_epoch


def update_screenshots(base_url: str, modified_paths: list[str] | None, max_entries: int):
    lazy_import_screenshot_deps()

    print("\n── Updating screenshots ───────────────────────────")

    all_entries: list[dict] = []
    for fname in JSON_FILES:
        json_path = DATA_DIR / fname
        if not json_path.exists():
            continue
        with open(json_path, "r", encoding="utf-8") as f:
            all_entries.extend(json.load(f))

    # Narrow to recently-modified entries when a path list is available
    if modified_paths is not None:
        candidates = []
        for entry in all_entries:
            url = entry.get("url", "")
            if any(url in p or p in url for p in modified_paths):
                candidates.append(entry)
        if not candidates:
            # Fall back to most-recent by date
            candidates = sorted(all_entries, key=lambda e: e.get("date", ""), reverse=True)
        all_entries = candidates[:max_entries]

    # Keep only entries whose source is newer than their screenshot
    to_update = [e for e in all_entries if _needs_screenshot(e)]

    if not to_update:
        print("  All screenshots are up to date.")
        return

    print(f"  {len(to_update)} screenshot(s) to refresh.")

    # Launch headless browser
    opts = ChromeOptions()
    opts.add_argument("--headless")
    opts.add_argument("--hide-scrollbars")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    driver = webdriver.Chrome(options=opts)
    driver.set_window_size(800, 800)

    for i, entry in enumerate(to_update, 1):
        url = entry["url"]
        screenshot_rel = entry["screenshot"]
        abs_screenshot = PROJECT_ROOT / screenshot_rel
        abs_screenshot.parent.mkdir(parents=True, exist_ok=True)

        full_url = f"{base_url}/{url}" if not url.startswith("http") else url
        label = entry.get("title", url)
        print(f"  [{i}/{len(to_update)}] {label}")

        try:
            driver.get(full_url)
            time.sleep(1)

            driver.execute_script("""
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                var el = document.getElementById('sidebar-toggle');
                if (el) el.style.display = 'none';
                document.querySelectorAll('a.logo').forEach(a => a.style.display = 'none');
            """)

            driver.save_screenshot(str(abs_screenshot))

            img = PIL.open(abs_screenshot)
            img.resize((260, 260), PIL.LANCZOS).save(abs_screenshot)
            print(f"         ✓ {screenshot_rel}")
        except Exception as exc:
            print(f"         ✗ {exc}")

    driver.quit()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Update gptgames dates & screenshots.")
    parser.add_argument("--all", action="store_true", help="Process every entry, not just recently changed ones.")
    parser.add_argument("--max", type=int, default=10, help="Max entries to update (default: 10).")
    parser.add_argument("--port", type=int, default=80, help="Local server port (default: 80).")
    parser.add_argument("--base-url", default=None, help="Base URL (default: http://localhost:<port>).")
    parser.add_argument("--dates-only", action="store_true", help="Only update dates, skip screenshots.")
    args = parser.parse_args()

    base_url = args.base_url or f"http://localhost:{args.port}"

    print("╔══════════════════════════════════════════════════╗")
    print("║           gptgames · update pipeline             ║")
    print("╚══════════════════════════════════════════════════╝")

    # 1 – Update dates (no server needed)
    update_dates()

    if args.dates_only:
        print("\nDone (dates only).")
        return

    # 2 – Start server
    print("\n── Starting server ────────────────────────────────")
    server = start_server(args.port)

    try:
        # 3 – Determine which paths changed
        modified = None if args.all else git_recently_modified_paths()

        # 4 – Screenshots
        update_screenshots(base_url, modified, args.max)
    finally:
        # 5 – Always stop the server, even on error
        print("\n── Stopping server ────────────────────────────────")
        stop_server(server)

    print("\n✓ All done.")


if __name__ == "__main__":
    main()