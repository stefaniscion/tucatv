"""Bounded native reads. No credentials or remote URLs are logged."""

import base64
import io
import tempfile
import threading
import time
import uuid
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def valid_url(value):
    if not isinstance(value, str) or len(value) > 8192:
        raise ValueError("URL non valido")
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Sono ammessi solo URL HTTP e HTTPS")
    return value


def transfer(url, sink, limit, on_progress=None):
    valid_url(url)
    request = Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "TucaTV/0.13.0"})
    with urlopen(request, timeout=15) as response:
        valid_url(response.url)
        # urllib does not decompress responses. Reject unsolicited encoding rather
        # than parse compressed bytes or compare incompatible byte counts.
        if response.headers.get("Content-Encoding", "identity").lower() != "identity":
            raise ValueError("Codifica della sorgente non supportata")
        raw_total = response.headers.get("Content-Length", "")
        total = int(raw_total) if raw_total.isdigit() else 0
        if total > limit:
            raise ValueError("Sorgente troppo grande")
        if on_progress:
            on_progress(0, total)
        received = 0
        last = 0
        started = time.monotonic()
        while True:
            block = response.read(min(32768, limit - received + 1))
            if not block:
                break
            received += len(block)
            if received > limit:
                raise ValueError("Sorgente troppo grande")
            sink.write(block)
            now = time.monotonic()
            if now - started > 120:
                raise ValueError("Download scaduto")
            if on_progress and now - last >= 0.1:
                on_progress(received, total if received <= total else 0)
                last = now
        if total and received != total:
            raise ValueError("Download incompleto")
        if on_progress:
            on_progress(received, total)
        return received, response.headers


def download(url, image=False, on_progress=None):
    sink = io.BytesIO()
    _, headers = transfer(url, sink, 2 * 1024 * 1024 if image else 64 * 1024 * 1024, on_progress)
    data = sink.getvalue()
    if image:
        mime = headers.get_content_type()
        if not mime.startswith("image/"):
            raise ValueError("Il server non ha restituito un’immagine")
        return "data:" + mime + ";base64," + base64.b64encode(data).decode("ascii")
    return data.decode(headers.get_content_charset() or "utf-8", errors="replace")


class PlaylistDownloads:
    """Anonymous private temporary files, exposed only through bounded reads."""

    def __init__(self):
        self.files = {}
        self.lock = threading.Lock()
        self.closed = False

    def download(self, url, on_progress=None):
        stream = tempfile.TemporaryFile()
        try:
            size, _ = transfer(url, stream, 256 * 1024 * 1024, on_progress)
            stream.seek(0)
            with self.lock:
                if self.closed:
                    raise ValueError("Host chiuso")
                if len(self.files) >= 4:
                    raise ValueError("Troppe importazioni simultanee")
                handle = str(uuid.uuid4())
                self.files[handle] = stream
            return {"handle": handle, "size": size}
        except BaseException:
            stream.close()
            raise

    def read(self, handle):
        with self.lock:
            stream = self.files[handle]
            block = stream.read(65536)
            return {"done": not block, "data": base64.b64encode(block).decode("ascii")}

    def close(self, handle):
        with self.lock:
            stream = self.files.pop(handle, None)
            if stream:
                stream.close()
        return {}

    def shutdown(self):
        with self.lock:
            self.closed = True
            for stream in self.files.values():
                stream.close()
            self.files.clear()
