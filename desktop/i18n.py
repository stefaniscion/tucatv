"""Shared source-key catalogues; provider metadata is never translated."""

import json
import locale
from pathlib import Path


class Translator:
    def __init__(self, web_root, language=None):
        system = (locale.getlocale()[0] or "en").lower()
        self.language = language if language in ("it", "en") else ("it" if system.startswith("it") else "en")
        self.catalogues = {}
        for code in ("it", "en"):
            try:
                self.catalogues[code] = json.loads(
                    (Path(web_root) / "locales" / (code + ".json")).read_text(encoding="utf-8")
                )
            except (OSError, ValueError):
                self.catalogues[code] = {}

    def set_language(self, language):
        if language not in ("it", "en"):
            raise ValueError("Unsupported language")
        self.language = language

    def text(self, key):
        return self.catalogues[self.language].get(key, key)
