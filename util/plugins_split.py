import json
import os
from pathlib import Path

# Get the absolute path to the Python script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Open the JSON file with utf-8 encoding and load its data
with open(os.path.join(script_dir, "plugins.json"), "r", encoding='utf-8') as f:
    data = json.load(f)

# Define the chunk size
chunk_size = 100
count = len(data["items"])

# Split the items into chunks
chunks = [data["items"][i:i + chunk_size] for i in range(0, len(data["items"]), chunk_size)]

# Create the plugins directory if it doesn't exist
plugins_dir = os.path.join(script_dir, "plugins")
Path(plugins_dir).mkdir(parents=True, exist_ok=True)

# Write each chunk to a separate JSON file
for i, chunk in enumerate(chunks, 1):
    chunk_data = {"items": chunk, "count": count}
    with open(os.path.join(plugins_dir, f"plugins_{i}.json"), "w", encoding='utf-8') as f:
        json.dump(chunk_data, f, indent=4)