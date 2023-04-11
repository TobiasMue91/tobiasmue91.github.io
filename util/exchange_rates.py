import requests
from bs4 import BeautifulSoup
import json

url = "https://www.x-rates.com/table/?from=USD&amount=1"

response = requests.get(url)

soup = BeautifulSoup(response.text, "html.parser")

table = soup.find("table", class_="tablesorter ratesTable")
table_body = table.find("tbody")

currency_data = {}

for row in table_body.findAll("tr"):
    currency = row.findAll("td")
    currency_name = currency[0].text.strip()
    currency_rate = float(currency[1].find("a").text.strip())
    currency_data[currency_name] = currency_rate

with open("exchange_rates.json", "w") as outfile:
    json.dump(currency_data, outfile, indent=4)

for currency_name, currency_rate in currency_data.items():
    print(f"{currency_name}: {currency_rate}")