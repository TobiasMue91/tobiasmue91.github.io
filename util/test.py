import pandas as pd

# Load the CSV file into a Pandas DataFrame
df = pd.read_csv("https://gist.githubusercontent.com/ChandrashekharRamamuthi/aa09e2ff6f45e9bf2c024f12aa4ccc11/raw/e2eb3f93ae6c80f7186cc98efee07abf4bedf1da/cardata.csv")

# Calculate the average cylinder count
avg_cyl = df["cyl"].mean()

print("The average cylinder count is:", avg_cyl)