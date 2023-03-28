import json
import pandas as pd
import os

# Initialize an empty DataFrame
results_df = pd.DataFrame(columns=["settings", "score", "file"])
script_dir = os.path.dirname(os.path.abspath(__file__))

# Loop through the JSON files
for i in range(1, 8):
    filename = f"code_responses_{str(i).zfill(2)}.json"
    filepath = os.path.join(script_dir, f"{filename}")
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            data = json.load(file)

        # Iterate through tasks and their corresponding settings and scores
        for task in data:
            for setting, details in data[task].items():
                score = details["score"]
                if isinstance(score, list):
                    for single_score in score:
                        results_df = results_df.append({"settings": setting, "score": single_score, "file": filename}, ignore_index=True)
                elif score is not None:
                    results_df = results_df.append({"settings": setting, "score": score, "file": filename}, ignore_index=True)

# Display the table
print(results_df)

# Save the table to a CSV file
results_df.to_csv("results_table.csv", index=False)