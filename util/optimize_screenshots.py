"""
Screenshot Optimizer for GPTGames
---------------------------------
Re-compresses the WebP screenshots referenced in data/games.json and
data/tools.json to cut their file size without a visible quality loss.

This targets the Lighthouse "Bildübermittlung verbessern / Improve image
delivery" finding (~78 KiB of estimated savings). The screenshots are small
thumbnails displayed at 320x200 / 400x250 in cards, so a moderate WebP
quality with the slowest/best compression method shrinks them noticeably
while staying crisp on screen.

It mirrors update_screenshots.py:
  - project root is one level up from this script
  - entries are read from data/games.json and data/tools.json
  - each entry's "screenshot" field is a path relative to the project root

Safe by default: runs as a DRY RUN and only reports what *would* change.
Pass --apply to actually overwrite files. Use --quality / --max-dim to tune.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from PIL import Image


# Card display sizes from the site (CSS width/height on <img>): the largest is
# 400x250, so capping the longest edge at 800px keeps 2x retina sharpness while
# discarding wasted resolution. Set to 0 to disable downscaling.
DEFAULT_MAX_DIM = 800
DEFAULT_QUALITY = 80  # WebP quality; 78-82 is the usual sweet spot for thumbnails


def load_entries(entries_path):
    """Read an entries JSON file and return the list of entries."""
    try:
        with open(entries_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"  ! File not found: {entries_path}")
        return []
    except json.JSONDecodeError:
        print(f"  ! Could not parse JSON: {entries_path}")
        return []

    if isinstance(data, dict) and "entries" in data:
        return data["entries"]
    if isinstance(data, list):
        return data
    return [data]


def collect_screenshot_paths(project_root, entries_files):
    """Gather the unique, existing screenshot paths from all entries files."""
    seen = {}
    for entries_file in entries_files:
        entries_path = project_root / entries_file
        print(f"Reading {entries_file} ...")
        for entry in load_entries(entries_path):
            shot = entry.get("screenshot")
            if not shot:
                continue
            abs_path = (project_root / shot).resolve()
            if abs_path.exists() and abs_path not in seen:
                seen[abs_path] = shot  # keep the relative path for nice logging
    return seen


def optimize_one(abs_path, quality, max_dim):
    """
    Re-encode a single image as WebP in memory and return
    (original_bytes, new_bytes, new_image_data_or_None).

    new_image_data is None when re-encoding wouldn't help (we never make a file
    bigger).
    """
    original_bytes = abs_path.stat().st_size

    with Image.open(abs_path) as im:
        im.load()
        # Preserve transparency if present, otherwise use plain RGB.
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")

        # Optional downscale: only shrink, never enlarge.
        if max_dim and max(im.size) > max_dim:
            ratio = max_dim / max(im.size)
            new_size = (round(im.size[0] * ratio), round(im.size[1] * ratio))
            im = im.resize(new_size, Image.LANCZOS)

        # Encode to a temp path next to the original, then compare sizes.
        tmp_path = abs_path.with_suffix(abs_path.suffix + ".tmp")
        im.save(
            tmp_path,
            format="WEBP",
            quality=quality,
            method=6,  # slowest, best compression
        )

    new_bytes = tmp_path.stat().st_size

    if new_bytes >= original_bytes:
        tmp_path.unlink(missing_ok=True)
        return original_bytes, original_bytes, None

    return original_bytes, new_bytes, tmp_path


def human(n):
    return f"{n / 1024:.1f} KiB"


def main():
    parser = argparse.ArgumentParser(description="Optimize GPTGames screenshots.")
    parser.add_argument("--apply", action="store_true",
                        help="Actually overwrite files (default is a dry run).")
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY,
                        help=f"WebP quality 1-100 (default {DEFAULT_QUALITY}).")
    parser.add_argument("--max-dim", type=int, default=DEFAULT_MAX_DIM,
                        help=f"Longest-edge cap in px, 0 to disable "
                             f"(default {DEFAULT_MAX_DIM}).")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    print("Screenshot Optimizer")
    print("--------------------")
    print(f"Project root : {project_root}")
    print(f"Mode         : {'APPLY (overwriting files)' if args.apply else 'DRY RUN (no changes)'}")
    print(f"WebP quality : {args.quality}")
    print(f"Max edge     : {args.max_dim or 'unlimited'} px")
    print()

    screenshots = collect_screenshot_paths(
        project_root, ["data/games.json", "data/tools.json"]
    )
    if not screenshots:
        print("No screenshots found. Nothing to do.")
        return

    print(f"\nFound {len(screenshots)} unique screenshots.\n")

    total_before = 0
    total_after = 0
    changed = 0
    errors = 0

    for abs_path, rel_path in sorted(screenshots.items(), key=lambda kv: kv[1]):
        try:
            before, after, tmp = optimize_one(abs_path, args.quality, args.max_dim)
        except Exception as e:
            print(f"  x {rel_path}: {e}")
            errors += 1
            continue

        total_before += before

        if tmp is None:
            total_after += before
            print(f"  = {rel_path}: already optimal ({human(before)})")
            continue

        saved = before - after
        pct = saved / before * 100
        total_after += after
        changed += 1

        if args.apply:
            os.replace(tmp, abs_path)  # atomic overwrite
            mark = "✓"
        else:
            tmp.unlink(missing_ok=True)  # discard the trial encode
            mark = "→"

        print(f"  {mark} {rel_path}: {human(before)} -> {human(after)} "
              f"(-{human(saved)}, -{pct:.0f}%)")

    saved_total = total_before - total_after
    print()
    print("Summary")
    print("-------")
    print(f"  Files touched : {changed} of {len(screenshots)}")
    if errors:
        print(f"  Errors        : {errors}")
    print(f"  Before        : {human(total_before)}")
    print(f"  After         : {human(total_after)}")
    print(f"  Saved         : {human(saved_total)} "
          f"({(saved_total / total_before * 100) if total_before else 0:.0f}%)")
    if not args.apply:
        print("\n  This was a DRY RUN. Re-run with --apply to write the changes.")


if __name__ == "__main__":
    main()