"""Bounded native reads. No credentials or remote URLs are logged."""
import base64
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def valid_url(value):
    if not isinstance(value, str) or len(value) > 8192:
        raise ValueError('URL non valido')
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('Sono ammessi solo URL HTTP e HTTPS')
    return value


def download(url, image=False, on_progress=None):
    valid_url(url)
    limit = 2 * 1024 * 1024 if image else 256 * 1024 * 1024
    request = Request(url, headers={'Accept': 'image/*' if image else '*/*', 'User-Agent': 'TucaTV/0.5'})
    with urlopen(request, timeout=15) as response:
        valid_url(response.url)
        if response.headers.get('Content-Length', '').isdigit() and int(response.headers['Content-Length']) > limit:
            raise ValueError('Sorgente troppo grande')
        raw_total=response.headers.get('Content-Length', '')
        total=int(raw_total) if raw_total.isdigit() else 0
        if on_progress: on_progress(0,total)
        chunks=[];received=0;last=0;started=time.monotonic()
        while True:
            block=response.read(min(32768,limit-received+1))
            if not block:break
            received+=len(block)
            if received>limit:raise ValueError('Sorgente troppo grande')
            chunks.append(block);now=time.monotonic()
            if now-started>120:raise ValueError('Download scaduto')
            if on_progress and now-last>=.1:on_progress(received,total if received<=total else 0);last=now
        data=b''.join(chunks)
        if on_progress:on_progress(received,total if received<=total else 0)
        if image:
            mime = response.headers.get_content_type()
            if not mime.startswith('image/'):
                raise ValueError('Il server non ha restituito un’immagine')
            return 'data:' + mime + ';base64,' + base64.b64encode(data).decode('ascii')
        return data.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
