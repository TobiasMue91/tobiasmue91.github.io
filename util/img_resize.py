from PIL import Image
import os

# Get the absolute path to the script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Define the input and output directories relative to the script directory
input_dir = os.path.join(script_dir, '../output')
output_dir = os.path.join(script_dir, '../output')

# Define the sizes for the small and medium images
small_size = (1600, 800)
medium_size = (1600, 800)

# Loop through all the files in the input directory
for filename in os.listdir(input_dir):
    # Open the image file and resize it to the small size
    with Image.open(os.path.join(input_dir, filename)) as img:
        # Calculate the aspect ratio of the original image
        orig_width, orig_height = img.size
        orig_aspect_ratio = orig_width / orig_height

        # Crop the image to the desired aspect ratio
        small_aspect_ratio = 2/3  # Desired aspect ratio for small images
        if orig_aspect_ratio > small_aspect_ratio:
            # Crop the image horizontally
            crop_width = int(orig_height * small_aspect_ratio)
            crop_left = (orig_width - crop_width) // 2
            crop_right = crop_left + crop_width
            crop_box = (crop_left, 0, crop_right, orig_height)
        else:
            # Crop the image vertically
            crop_height = int(orig_width / small_aspect_ratio)
            crop_top = (orig_height - crop_height) // 2
            crop_bottom = crop_top + crop_height
            crop_box = (0, crop_top, orig_width, crop_bottom)
        img = img.crop(crop_box)

        # Resize the cropped image to the small size
        img.thumbnail(small_size)

        # Save the small image to the output directory
        img.save(os.path.join(output_dir, 'small_' + filename))

    # Open the image file again and resize it to the medium size
    with Image.open(os.path.join(input_dir, filename)) as img:
        img.thumbnail(medium_size)
        # Save the medium image to the output directory
        img.save(os.path.join(output_dir, 'medium_' + filename))