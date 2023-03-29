import json
import pandas as pd
import os
import matplotlib.pyplot as plt
import seaborn as sns

# Initialize an empty DataFrame
results_df = pd.DataFrame(columns=["temperature", "top_p", "score", "file"])
script_dir = os.path.dirname(os.path.abspath(__file__))

# Loop through the JSON files
for i in range(1, 3):
    filename = f"code_responses_{str(i).zfill(2)}.json"
    filepath = os.path.join(script_dir, f"gpt-4\{filename}")
    print(filepath)
    if os.path.exists(filepath):
        with open(filepath, "r") as file:
            data = json.load(file)

        # Iterate through tasks and their corresponding settings and scores
        for task in data:
            for setting, details in data[task].items():
                temp, top_p = setting.split("_")[1], setting.split("_")[4]
                score = details["score"]
                if isinstance(score, list):
                    for single_score in score:
                        results_df = pd.concat([results_df, pd.DataFrame({"temperature": [temp], "top_p": [top_p], "score": [single_score], "file": [filename]})], ignore_index=True)
                elif score is not None:
                    results_df = pd.concat([results_df, pd.DataFrame({"temperature": [temp], "top_p": [top_p], "score": [score], "file": [filename]})], ignore_index=True)

# Convert temperature and top_p columns to numeric type
results_df["temperature"] = pd.to_numeric(results_df["temperature"])
results_df["top_p"] = pd.to_numeric(results_df["top_p"])

# Display the table
print(results_df)

# Save the table to a CSV file
results_df.to_csv("results_table.csv", index=False)

# Create a heatmap to visualize the data
plt.figure(figsize=(10, 6))
heatmap_data = results_df.pivot_table(values='score', index='temperature', columns='top_p', aggfunc='mean')
sns.heatmap(heatmap_data, annot=True, cmap="coolwarm", fmt=".2f", linewidths=1, linecolor="black", cbar_kws={"label": "Mean Score"})
plt.xlabel("Top-P")
plt.ylabel("Temperature")
plt.title("Mean Code Quality Score by Temperature and Top-P Settings")
plt.savefig("heatmap.png")
plt.show()