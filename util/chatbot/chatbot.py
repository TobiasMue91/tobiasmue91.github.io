import os
import json
import requests
import openai
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Set up OpenAI API
load_dotenv()
openai.api_key = os.environ['OPENAI_API_KEY']

# URL of gptgames.dev
URL = "https://www.gptgames.dev/"

# Fetch page HTML and parse it
response = requests.get(URL)
soup = BeautifulSoup(response.text, 'html.parser')

# Find all anchor tags with href containing 'tools/' or 'games/'
links = soup.find_all('a', href=lambda href: href and ('tools/' in href or 'games/' in href))

# Initialize empty JSON object
json_data = {}

# Function to generate description using OpenAI ChatCompletion API
def generate_description(text):
    system_message = "You are an assistant that describes games and tools based on given text to generate data for a ChatBot. That ChatBot will be used on the page where the standalone game/tool is hosted. The text provided by the user is the text representation of the standalone tool/game."
    prompt = f"Describe the following game/tool based on the given text: {text}"

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt},
        ],
        max_tokens=500,
        n=1,
    )

    return response.choices[0].message['content'].strip()

# Function to generate keywords using OpenAI ChatCompletion API
def generate_keywords(text):
    system_message = "You are an assistant that generates keywords based on given text in order to generate data for a ChatBot. That ChatBot will be used on the page where the standalone game/tool is hosted. If the users message contains one of those keywords, a fitting description will be used as context for creating a good chatbot response."
    prompt = f"Generate comma-separated keywords for the following game/tool based on the given text: {text}"

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt},
        ],
        max_tokens=100,
        n=1,
    )

    return response.choices[0].message['content'].strip()

# Iterate over all links found
for link in links:
    # Fetch the game/tool page and parse its HTML
    game_tool_url = URL + link['href']
    response = requests.get(game_tool_url)
    game_tool_soup = BeautifulSoup(response.text, 'html.parser')

    print(f"Generating description and keywords for {game_tool_url}...")

    # Extract text representation of the game/tool page
    page_text = game_tool_soup.get_text().replace('\n', ' ').strip()

    # Generate description using the OpenAI ChatCompletion API
    description = generate_description(page_text)

    # Generate keywords using the OpenAI ChatCompletion API
    keywords = generate_keywords(page_text)

    # Add the generated description to the JSON object
    json_data[keywords] = description

# Write the JSON data to chatbot.json
with open('chatbot.json', 'w') as json_file:
    json.dump(json_data, json_file, indent=4)