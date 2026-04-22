import os
from typing import Optional

try:
    from groq import Groq
except ImportError:  # Allows the app to keep running until dependencies are installed.
    Groq = None


GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def ask_groq(messages: list[dict[str, str]], temperature: float = 0.3, max_tokens: int = 500) -> Optional[str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or Groq is None:
        return None

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )
        return completion.choices[0].message.content
    except Exception:
        return None
