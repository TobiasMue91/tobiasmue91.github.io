import os
from PIL import Image

def convert_to_webp(input_dir, quality='lossless'):
    # Validate the input directory
    if not os.path.isdir(input_dir):
        print("The provided directory does not exist. Please enter a valid directory.")
        return

    # Iterate through each file in the directory
    for filename in os.listdir(input_dir):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif')):
            try:
                # Construct file paths
                file_path = os.path.join(input_dir, filename)
                output_file_path = os.path.join(input_dir, f"{os.path.splitext(filename)[0]}.webp")

                # Open and convert the image
                with Image.open(file_path) as img:
                    if quality == 'lossless':
                        img.save(output_file_path, 'webp', lossless=True)
                    else:
                        img.save(output_file_path, 'webp', quality=90)

                print(f"Converted {filename} to WebP format.")
            except Exception as e:
                print(f"Failed to convert {filename}: {e}")

if __name__ == "__main__":
    # User inputs for directory and quality
    directory = input("Enter the path to the directory: ")
    quality_choice = input("Enter 'lossless' for lossless compression or anything else for 90% quality: ").lower()

    # Call the function with the user's choices
    convert_to_webp(directory, quality_choice)