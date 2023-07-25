import os
import os
from google.cloud import speech_v1p1beta1 as speech
from google.cloud.speech_v1p1beta1 import types

# Set the environment variable for credentials from within the script
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "ball-bouncing-game-1fdd986e2749.json"

# Create a client
client = speech.SpeechClient()

# Set the directory path for audio files
audio_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio')

# Loop through each file in the audio directory
for file_name in os.listdir(audio_directory):
    print("Performing Transcription...")
    if file_name.endswith('.ogg'):
        file_path = os.path.join(audio_directory, file_name)

        # Read the audio file
        with open(file_path, "rb") as audio_file:
            content = audio_file.read()

        # Configure audio settings
        audio = types.RecognitionAudio(content=content)
        config = types.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
            sample_rate_hertz=16000,
            language_code="de-DE",
        )

        # Make the API request
        response = client.recognize(config=config, audio=audio)

        # Build the transcript
        transcript = ""
        for result in response.results:
            transcript += result.alternatives[0].transcript + "\n"

        # Print the transcript
        print("Transcript for file {}: {}".format(file_name, transcript))

        # Save the transcript to a text file
        output_filename = os.path.splitext(file_name)[0] + '.txt'
        output_filepath = os.path.join(audio_directory, output_filename)
        with open(output_filepath, 'w') as output_file:
            output_file.write(transcript)

print("Transcription complete.")
