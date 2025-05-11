import os
import sys
from pathlib import Path
from PIL import Image
import argparse

def convert_png_to_webp(base_dir=None):
    """Convert all PNG screenshots to WebP format."""
    if base_dir is None:
        base_dir = Path(__file__).resolve().parent.parent

    screenshots_dir = base_dir / "screenshots"

    if not screenshots_dir.exists():
        print(f"Error: Screenshots directory not found at {screenshots_dir}")
        return

    # Find all PNG files
    png_files = list(screenshots_dir.glob("screenshot_*.png"))

    if not png_files:
        print("No PNG files found to convert.")
        return

    print(f"Found {len(png_files)} PNG files to convert.")

    # Process each file
    success_count = 0
    error_count = 0
    skipped_count = 0

    for png_file in png_files:
        webp_file = png_file.with_suffix(".webp")

        # Skip if WebP version already exists
        if webp_file.exists():
            print(f"Skipped {png_file.name} (WebP version already exists)")
            skipped_count += 1
            continue

        try:
            print(f"Converting {png_file.name}...", end=" ", flush=True)

            # Open and convert the image
            image = Image.open(png_file)

            # Save as WebP with lossless compression to preserve quality
            image.save(webp_file, format="WEBP", quality=90, lossless=True)

            success_count += 1
            print("Done")

        except Exception as e:
            error_count += 1
            print(f"Failed: {e}")

    print("\nConversion Summary:")
    print(f"- Successfully converted: {success_count}")
    print(f"- Skipped (already exists): {skipped_count}")
    print(f"- Failed: {error_count}")
    print("\nNext steps:")
    print("1. Verify the WebP files look good")
    print("2. Update your JSON files to reference .webp instead of .png")
    print("3. Optionally remove the original PNG files after verification")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert PNG screenshots to WebP format")
    parser.add_argument("--dir", help="Base directory of the project (defaults to parent of script directory)")

    args = parser.parse_args()
    base_dir = Path(args.dir) if args.dir else None

    convert_png_to_webp(base_dir)