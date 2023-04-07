import os
import time
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from PIL import Image

# set up Selenium webdriver
driver = webdriver.Chrome("/usr/local/bin/chromedriver")

# navigate to website
driver.get("https://www.gptgames.dev/")

# find all links with "gptgames/games" or "gptgames/tools" in them
links = driver.find_elements_by_xpath("//a[contains(@href, 'games/') or contains(@href, 'tools/')]")

print(links)

# create screenshots directory if it doesn't exist
if not os.path.exists("screenshots"):
    os.makedirs("screenshots")

# visit each link and take a screenshot
for i, link in enumerate(links):
    # navigate to link
    link.send_keys(Keys.RETURN)
    time.sleep(2)  # wait for page to load

    # take screenshot and save it
    screenshot_filename = "screenshots/screenshot_{}.png".format(i)
    driver.save_screenshot(screenshot_filename)

    # resize image to make it smaller
    im = Image.open(screenshot_filename)
    im_resized = im.resize((int(im.size[0]*0.5), int(im.size[1]*0.5)))
    im_resized.save(screenshot_filename)

    # go back to previous page
    driver.execute_script("window.history.go(-1)")

# close the webdriver
driver.close()