import requests
import json
import os
from tqdm import tqdm

api_endpoint = "https://chatgpt.tobiasmue91.workers.dev/"
tasks = [
    "Task: Create a basic neural network from scratch in Python, without using any existing machine learning libraries. The neural network should be able to perform binary classification on a given dataset, with input/output layers and one hidden layer. Include functions for forward propagation, backpropagation, and training using gradient descent.",
    "Task: Design a web scraper in a language like Python, using concurrency (e.g., threads or asynchronous programming) to efficiently scrape data from multiple web pages simultaneously. The scraper should accept a list of URLs, fetch their content, and extract specific information (e.g., article titles and dates) from each page."
]

temperatures = [0, 0.5, 1, 1.5, 2]
top_p_values = [0, 0.5, 1]

headers = {
    "content-type": "application/json"
}

def evaluate_code_quality(code):
    evaluation_prompt = f"Please rate the following code snippet in terms of quality, functionality, and efficiency from 1 to 10, and provide a brief explanation of your rating:\n\n```python\n{code}\n```\n"
    evaluation_data = {
        "model": "gpt-3.5-turbo-0301",
        "max_tokens": 512,
        "messages": [
            {"role": "user", "content": evaluation_prompt}
        ]
    }
    evaluation_response = requests.post(api_endpoint, headers=headers, data=json.dumps(evaluation_data))
    evaluation_content = evaluation_response.json()['choices'][0]['message']['content']

    try:
        score = int(evaluation_content.split()[0])
    except ValueError:
        score = None

    return score, evaluation_content

def request_code(task, temperature, top_p):
    data = {
        "model": "gpt-3.5-turbo-0301",
        "max_tokens": 1024,
        "temperature": temperature,
        "top_p": top_p,
        "messages": [
            {"role": "user", "content": task}
        ]
    }
    response = requests.post(api_endpoint, headers=headers, data=json.dumps(data))

    try:
        response_data = response.json()
    except json.JSONDecodeError:
        with open("error_responses.log", "a") as error_log:
            error_log.write(f"Error decoding response for task: {task}\n")
            error_log.write(f"Temperature: {temperature}, Top_p: {top_p}\n")
            error_log.write(f"Raw response: {response.content.decode('utf-8')}\n")
            error_log.write("=" * 80 + "\n")

        response_data = None

    return response_data

def progress_bar(iterable, desc=None):
    return tqdm(iterable, desc=desc, ncols=80)

responses = {}
for task in progress_bar(tasks, desc="Tasks"):
    task_key = task[:20]
    responses[task_key] = {}
    for temperature in progress_bar(temperatures, desc="Temperatures"):
        for top_p in progress_bar(top_p_values, desc="Top_p values"):
            response = request_code(task, temperature, top_p)
            if response is not None:
                code = response['choices'][0]['message']['content']
                score, evaluation_text = evaluate_code_quality(code)
                setting_key = f"temp_{temperature}_top_p_{top_p}"
                responses[task_key][setting_key] = {
                    "code": code,
                    "score": score,
                    "evaluation_text": evaluation_text
                }
            else:
                print(f"Error: Task: {task}, Temperature: {temperature}, Top_p: {top_p}")

# Save the responses to a JSON file for easy evaluation
with open("code_responses.json", "w") as f:
    json.dump(responses, f, indent=4)