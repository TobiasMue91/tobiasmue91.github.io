import argparse
import logging
import os
import re
from bs4 import BeautifulSoup
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def call_llm_api(html_content, instructions, example):
    prompt = f"HTML code:\n\n{html_content}\n\n{instructions}\n\nExample:\n{example}\n\nPlease respond with a single line containing multiple changes, separated by pipes (|)."

    try:
        response = requests.post("https://chatgpt.tobiasmue91.workers.dev/",
            headers={
                "Content-Type": "application/json",
                "Accept": "*/*"
            },
            json={
                "model": "gpt-3.5-turbo",
                "temperature": 0.4,
                "max_tokens": 512,
                "messages": [
                    {
                        "role": "system",
                        "content": prompt
                    }
                ]
            }
        )

        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()

    except requests.exceptions.RequestException as e:
        logging.error(f"Error occurred while calling LLM API: {e}")
        raise

def validate_dsl_changes(dsl_changes):
    pattern = re.compile(r'^(\d+-\d+|\d+)(>|<|-|\^|@):.+(\|(\d+-\d+|\d+)(>|<|-|\^|@):.+)*$')
    return pattern.match(dsl_changes) is not None

def apply_dsl_changes(html_content, dsl_changes):
    if not validate_dsl_changes(dsl_changes):
        raise ValueError(f"Invalid DSL changes format: {dsl_changes}")

    lines = html_content.split("\n")
    for change in dsl_changes.split("|"):
        operation, line_info, code = change.split(":", 2)
        line_range = line_info.split("-")
        start_line = int(line_range[0]) - 1
        end_line = int(line_range[-1]) - 1 if len(line_range) > 1 else start_line

        if operation == "-":
            lines[start_line:end_line+1] = []
        elif operation == ">":
            lines[start_line:end_line+1] = [code.replace("\\n", "\n")]
        elif operation == "+":
            lines.insert(end_line + 1, code.replace("\\n", "\n"))
        elif operation == "^":
            lines.insert(start_line, code.replace("\\n", "\n"))
        elif operation == "@":
            wrap_start, wrap_end = code.split(":")
            lines.insert(end_line + 1, wrap_end.replace("\\n", "\n"))
            lines.insert(start_line, wrap_start.replace("\\n", "\n"))

    return "\n".join(lines)

def reformat_html(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.prettify()

def create_backup(file_path):
    backup_path = file_path + ".bak"
    with open(file_path, "r", encoding="utf-8") as file, open(backup_path, "w", encoding="utf-8") as backup_file:
        backup_file.write(file.read())
    logging.info(f"Created backup of {file_path} at {backup_path}")

def main(html_path, iterations):
    logging.info(f"Starting HTML improvement process for file: {html_path}")

    create_backup(html_path)

    with open(html_path, "r", encoding="utf-8") as file:
        html_content = file.read()

    instructions = "Please improve the following HTML code. Implement any improvements that an experienced web developer would, while keeping the embedded scripts and styling intact. The code should remain in the context of a standalone file.\n\nPlease provide your changes in the following DSL format:\n- Specifying the location of the change: Use line numbers or line ranges (e.g., '14' or '14-17').\n- Specifying the type of change:\n  > : Replace the selected code with new code.\n  + : Insert new code after the selected line(s).\n  - : Delete the selected line(s).\n  ^ : Insert new code before the selected line(s).\n  @ : Wrap the selected code in a new block.\n- Specifying the new code (if applicable): Use a colon (:) to separate the location and type from the new code. If the new code contains colons or pipes, escape them with a backslash (\\).\n- Multiple statements in a single line: Use pipes (|) to separate multiple statements on a single line.\n\nFocus on improving the structure, semantics, and performance of the HTML code. Suggest best practices and modern web development techniques."

    example = "1-3-:|5>:console.log(\"New debug statement\");|8+:function newFunction() {\\n  // Add new function here\\n}|12-15@:try {:|} catch (err) {\\n  console.error(err);\\n}|20^:// Add new comment|24>:const newVar = \"new value\";|27-28-:|32+:<div class=\"new-class\">\\n  <p>New HTML content</p>\\n</div>|37@:<section id=\"new-section\">:</section>|42>:if (condition) {\\n  // New conditional block\\n} else {\\n  // New else block\\n}"

    for i in range(iterations):
        logging.info(f"Iteration {i+1}/{iterations}")

        try:
            dsl_changes = call_llm_api(html_content, instructions, example)
            logging.info(f"Response from LLM: {dsl_changes}")
            html_content = apply_dsl_changes(html_content, dsl_changes)
            logging.info(f"Changed HTML: {html_content}")
        except Exception as e:
            logging.error(f"Error occurred during iteration {i+1}: {e}")
            break

    html_content = reformat_html(html_content)

    with open(html_path, "w", encoding="utf-8") as file:
        file.write(html_content)

    logging.info(f"HTML file '{html_path}' has been updated with {iterations} iteration(s) of improvements.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Improve HTML using LLM API")
    parser.add_argument("html_path", help="Path to the HTML file")
    parser.add_argument("--iterations", type=int, default=1, help="Number of improvement iterations (default: 1)")
    args = parser.parse_args()

    main(args.html_path, args.iterations)