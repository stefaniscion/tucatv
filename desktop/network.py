"""Bounded native reads. No credentials or remote URLs are logged."""
import base64
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def valid_url(value):
    if not isinstance(value, str) or len(value) > 8192:
        raise ValueError('URL non valido')
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('Sono ammessi solo URL HTTP e HTTPS')
    return value


def download(url, image=False):
    valid_url(url)
    limit = 2 * 1024 * 1024 if image else 64 * 1024 * 1024
    request = Request(url, headers={'Accept': 'image/*' if image else '*/*', 'User-Agent': 'TucaTV/0.5'})
    with urlopen(request, timeout=15) as response:
        valid_url(response.url)
        if response.headers.get('Content-Length', '').isdigit() and int(response.headers['Content-Length']) > limit:
            raise ValueError('Sorgente troppo grande')
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Sorgente troppo grande')
        if image:
            mime = response.headers.get_content_type()
            if not mime.startswith('image/'):
                raise ValueError('Il server non ha restituito un’immagine')
            return 'data:' + mime + ';base64,' + base64.b64encode(data).decode('ascii')
        return data.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
