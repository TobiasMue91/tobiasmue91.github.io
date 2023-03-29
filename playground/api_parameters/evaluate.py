import requests
import json
import os
from tqdm import tqdm

api_endpoint = "https://chatgpt.tobiasmue91.workers.dev/"
tasks = [
"Task: Develop a script that uses various machine learning algorithms, such as decision trees, support vector machines, and random forests, to perform classification on a given dataset. The script should include methods for data preprocessing, feature extraction, model training, hyperparameter tuning, and performance evaluation using metrics such as accuracy, precision, recall, and F1 score.",
]

temperatures = [0.3, 0.5, 1, 1.5, 1.7]
top_p_values = [0.3, 0.5, 0.7, 1]

headers = {
    "content-type": "application/json"
}

def evaluate_code_quality(code, task):
    evaluation_prompt = f"Please rate the following response from ChatGPT in terms of quality, functionality, and efficiency from 1 to 10, and provide a brief explanation of your rating. Your response should show an overall rating at the very start. If the response contains code, rate the code. If there is no code, rate the relevance and usefulness of the response. Please try to be as consistent as possible in your ratings:\n\n```python\n{code}\n```\n\nTask: {task}"
    evaluation_data = {
        "model": "gpt-4",
        "max_tokens": 512,
        "temperature": 0.2,
        "top_p": 0.2,
        "messages": [
            {"role": "user", "content": evaluation_prompt}
        ]
    }
    evaluation_response = requests.post(api_endpoint, headers=headers, data=json.dumps(evaluation_data))

    try:
        response_data = evaluation_response.json()
    except json.JSONDecodeError:
        with open("error_responses.log", "a") as error_log:
            error_log.write(f"Error evaluating code quality code: {code} \n {task}\n")
            error_log.write("=" * 80 + "\n")
    evaluation_content = response_data['choices'][0]['message']['content']

    try:
        score = int(evaluation_content.split()[0])
    except ValueError:
        score = None

    return score, evaluation_content

def request_code(task, temperature, top_p):
    data = {
        "model": "gpt-4",
        "max_tokens": 512,
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
    task_key = task[:40]
    responses[task_key] = {}
    for temperature in progress_bar(temperatures, desc="Temperatures"):
        for top_p in progress_bar(top_p_values, desc="Top_p values"):
            response = request_code(task, temperature, top_p)
            if response is not None:
                code = response['choices'][0]['message']['content']
                score, evaluation_text = evaluate_code_quality(code, task)
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