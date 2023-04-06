import os

def create_redirect_file(old_path, new_url):
    redirect_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url={new_url}" />
  <link rel="canonical" href="{new_url}" />
</head>
<body>
  <h1 style="text-align:center;">Redirecting...</h1>
  <script>
    window.location.replace("{new_url}");
  </script>
</body>
</html>
"""
    with open(old_path, "w") as f:
        f.write(redirect_html)

def process_directory(source_directory, target_directory, base_url):
    for root, _, files in os.walk(source_directory):
        for file in files:
            if file.endswith(".html"):
                old_path = os.path.join(root, file)
                relative_path = os.path.relpath(old_path, start=source_directory)
                redirect_path = os.path.join(target_directory, relative_path)
                os.makedirs(os.path.dirname(redirect_path), exist_ok=True)
                new_url = os.path.join(base_url, relative_path)
                create_redirect_file(redirect_path, new_url)

base_url = "https://www.gptgames.dev"
source_directories = ["tools", "games"]
target_directories = ["gptgames/tools", "gptgames/games"]

for source, target in zip(source_directories, target_directories):
    process_directory(source, target, base_url)