
#!/usr/bin/env python3
import sys, json, os
# This script uses the whisper package. Ensure you have installed it:
# pip install -U openai-whisper
try:
    import whisper
except Exception as e:
    print("Missing whisper package. Install with: pip install -U openai-whisper", file=sys.stderr)
    sys.exit(2)

def format_timestamp(s):
    # seconds to HH:MM:SS, with integer seconds
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    return f"{h:02d}:{m:02d}:{sec:02d}"

def main():
    if len(sys.argv) < 2:
        print("Usage: transcribe_whisper.py <audio_path> [--output <json_out>]", file=sys.stderr)
        sys.exit(1)
    audio = sys.argv[1]
    out = audio + ".json"
    if "--output" in sys.argv:
        try:
            out = sys.argv[sys.argv.index("--output")+1]
        except:
            pass
    model = os.environ.get("WHISPER_MODEL", "base")
    try:
        m = whisper.load_model(model)
        result = m.transcribe(audio, language='en', verbose=False)
        segments = []
        for seg in result.get("segments", []):
            segments.append({ "start": format_timestamp(seg["start"]), "end": format_timestamp(seg["end"]), "text": seg["text"].strip() })
        out_json = { "text": result.get("text",""), "segments": segments }
        with open(out, "w", encoding="utf8") as f:
            json.dump(out_json, f, indent=2)
        print("Transcription written to", out)
    except Exception as e:
        print("Transcription error: " + str(e), file=sys.stderr)
        sys.exit(3)

if __name__ == "__main__":
    main()
