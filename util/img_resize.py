from PIL import Image
import os


# Get the absolute path to the script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Define the input and output directories relative to the script directory
input_dir = os.path.join(script_dir, '../img')
output_dir = os.path.join(script_dir, '../output')

# Define the sizes for the small and medium images
small_size = (800, 400)
medium_size = (1200, 600)

# Loop through all the files in the input directory
for filename in os.listdir(input_dir):
    # Open the image file and resize it to the small size
    with Image.open(os.path.join(input_dir, filename)) as img:
        img.thumbnail(small_size)
        # Save the small image to the output directory
        img.save(os.path.join(output_dir, 'small_' + filename))

    # Open the image file again and resize it to the medium size
    with Image.open(os.path.join(input_dir, filename)) as img:
        img.thumbnail(medium_size)
        # Save the medium image to the output directory
        img.save(os.path.join(output_dir, 'medium_' + filename))