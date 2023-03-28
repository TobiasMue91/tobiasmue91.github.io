import requests
import json
from bs4 import BeautifulSoup

def fetch_emoji_data():
    url = "https://unicode.org/emoji/charts/full-emoji-list.html"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, "html.parser")
    rows = soup.find_all("tr")
    emoji_data = []

    for row in rows:
        cells = row.find_all("td")
        if len(cells) >= 15:
            emoji = cells[2].get_text()
            keywords = cells[14].get_text()
            emoji_data.append({"emoji": emoji, "keywords": keywords})

    return emoji_data

def save_emoji_data_to_file(emoji_data, filename):
    with open(filename, "w", encoding="utf-8") as file:
        json.dump(emoji_data, file, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    emoji_data = fetch_emoji_data()
    save_emoji_data_to_file(emoji_data, "emoji_data.json")
    print("Emoji data saved to emoji_data.json")