import os
import openai
import json
from dotenv import load_dotenv

# Set up OpenAI API client
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# Define the roles
roles = [
    "Describer",
    "Test Writer",
#     "Reflector",
#     "Researcher",
#     "Decider",
    "Implementer",
    "Reviewer",
]

# Define the role instructions
role_instructions = {
    "Describer": "Provide detailed requirements and specifications for the tool, which should result in a standalone HTML file with embedded scripts, styling, and optional libraries.",
    "Test Writer": "Write comprehensive tests for the tool based on the description using Cypress. Only write full tests, no explanations or commented out lines.",
#     "Reflector": "Carefully review the written tests and provide feedback to the Test Writer if any improvements can be made.",
#     "Researcher": "Thoroughly research the best implementation methods based on the outline and tests.",
#     "Decider": "Collaborate with the Researcher to decide on the most suitable implementation method.",
    "Implementer": "Implement the actual tool based on the outline and tests. Include comments in the code for better understanding.",
    "Reviewer": "Review the written code, look for errors, and suggest fixes if necessary. Provide feedback to the Implementer for any improvements.",
}

def chat_with_role(role, message):
    system_message = f"You are {role}, and your purpose is to {role_instructions[role]}."
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "assistant", "content": message},
        ],
        max_tokens=3000,
    )
    return response.choices[0].message["content"].strip()

def main():
    # Get user inputs
    tool_name = input("Enter the tool name: ")
    requirements = input("Enter optional requirements (leave blank if none): ")

    # Set up directories and files
    project_dir = f"{tool_name}_project"
    os.makedirs(project_dir, exist_ok=True)

    test_dir = os.path.join(project_dir, "cypress", "e2e")
    os.makedirs(test_dir, exist_ok=True)

    # Initialize the previous_role_response with user inputs
    previous_role_response = f"Create a {tool_name} tool. {requirements}"

    # Iterate through the roles and get their responses
    role_index = 0
    while role_index < len(roles):
        role = roles[role_index]
        print(f"{role} is working...")
        role_response = chat_with_role(role, previous_role_response)
        previous_role_response = role_response

        # Save the intermediate outputs for better analysis
        intermediate_output_path = os.path.join(project_dir, f"{role}_output.txt")
        with open(intermediate_output_path, "w") as intermediate_output_file:
            intermediate_output_file.write(role_response)

        print(role_response)
        user_input = input(f"{role} has completed its task. Continue to the next role? (y/n): ").lower()
        if user_input == 'n':
            print(f"Process aborted after {role}.")
            break

        if role == "Test Writer":
            test_file_path = os.path.join(test_dir, f"{tool_name}.js")
            with open(test_file_path, "w") as test_file:
                test_file.write(role_response)
        elif role == "Implementer":
            tool_file_path = os.path.join(project_dir, f"{tool_name}.html")
            with open(tool_file_path, "w") as tool_file:
                tool_file.write(role_response)

        role_index += 1

    print("Process completed.")

main()