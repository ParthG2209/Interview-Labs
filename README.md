
# InterviewLabs

This project is a **video-only** Smart Interview Analyzer. It:
- Generates interview questions for a given field.
- Accepts a single video containing answers to all questions.
- Extracts audio using ffmpeg, transcribes using **local Whisper**, and analyzes results with Cohere (if `COHERE_API_KEY` provided).
- Returns a rating (1-10), timestamped mistakes, and improvement tips.

## Requirements (cross-platform)
- Node.js (16+)
- Python 3.8+
- `ffmpeg` installed and in PATH
- Whisper Python package: `pip install -U openai-whisper` (or `git+https://github.com/openai/whisper.git`)
- (Optional) Cohere API key for richer analysis

## Quick start
1. Unzip project and open terminal in project folder.
2. Install Node deps:
   ```bash
   npm install
   ```
3. Install Whisper (Python):
   ```bash
   pip install -U openai-whisper
   ```
4. Make sure `ffmpeg` is installed and available on PATH.
5. Edit `project.env` and set `COHERE_API_KEY` if you have one.
6. Run the server:
   ```bash
   npm run dev
   ```
7. Open your browser at `http://localhost:3000`

## Notes
- Transcription runs using local Whisper via a Python script `transcribe_whisper.py` which outputs a JSON transcript with timestamps.
- The server calls that script; ensure your Python environment has Whisper installed.
- If Cohere key is missing, the server falls back to a built-in heuristic analysis.

# Interview-Labs-Render
