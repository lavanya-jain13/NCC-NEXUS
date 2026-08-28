import subprocess

from app.models.whisper_model import model


def transcribe(audio_path: str, audio=None) -> str:
    """
    Convert speech to text using Whisper.
    """

    try:
        result = model.transcribe(
            audio if audio is not None else audio_path,
            language="en",
            fp16=False
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Speech transcription failed because ffmpeg is not available."
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise ValueError("Invalid or unsupported audio file.") from exc
    except Exception as exc:
        raise RuntimeError("Speech transcription failed.") from exc

    # Whisper may return the "text" field as either a string or a list of segments.
    text_field = result.get("text", "")

    if isinstance(text_field, list):
        # Join segments with a space and strip surrounding whitespace
        text = " ".join(s.strip() for s in text_field).strip()
    else:
        text = str(text_field).strip()

    return text
