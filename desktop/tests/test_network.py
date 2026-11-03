import unittest, sys
from pathlib import Path
from unittest.mock import patch
from email.message import Message

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from network import valid_url, download


class Reply:
    def __init__(self, body, mime):
        self.body = body
        self.pos = 0
        self.url = "https://example.test/logo"
        self.headers = Message()
        self.headers["Content-Type"] = mime

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self, n):
        chunk = self.body[self.pos : self.pos + n]
        self.pos += len(chunk)
        return chunk


class NetworkTests(unittest.TestCase):
    def test_url_validation(self):
        for value in ["file:///etc/passwd", "javascript:alert(1)", "https://", "x", None]:
            with self.assertRaises(ValueError):
                valid_url(value)
        self.assertEqual(valid_url("http://example.test/live/1"), "http://example.test/live/1")

    def test_image_encoded_for_webview(self):
        with patch("network.urlopen", return_value=Reply(b"png", "image/png")):
            self.assertEqual(download("http://example.test/logo", True), "data:image/png;base64,cG5n")

    def test_reject_html_instead_of_logo(self):
        with patch("network.urlopen", return_value=Reply(b"<html>login</html>", "text/html")):
            with self.assertRaises(ValueError):
                download("https://example.test/logo", True)

    def test_bound_image_size(self):
        with patch("network.urlopen", return_value=Reply(b"x" * (2 * 1024 * 1024 + 1), "image/png")):
            with self.assertRaises(ValueError):
                download("https://example.test/logo", True)


if __name__ == "__main__":
    unittest.main()


class ProgressTests(unittest.TestCase):
    def test_native_download_reports_received_and_total(self):
        response = Reply(b"x" * 70000, "text/plain")
        response.headers["Content-Length"] = "70000"
        events = []
        with patch("network.urlopen", return_value=response):
            data = download(
                "http://example.test/list", on_progress=lambda received, total: events.append((received, total))
            )
        self.assertEqual(len(data), 70000)
        self.assertEqual(events[0], (0, 70000))
        self.assertEqual(events[-1], (70000, 70000))
        self.assertTrue(any(0 < received < 70000 for received, total in events))


class TransferTests(unittest.TestCase):
    def test_truncated_download_rejected(self):
        response = Reply(b"partial", "text/plain")
        response.headers["Content-Length"] = "100"
        with patch("network.urlopen", return_value=response):
            with self.assertRaisesRegex(ValueError, "incompleto"):
                download("https://example.test/list")

    def test_playlist_chunks_and_cleanup(self):
        import base64
        from network import PlaylistDownloads

        store = PlaylistDownloads()
        body = b"x" * 150000
        with patch("network.urlopen", return_value=Reply(body, "text/plain")):
            result = store.download("https://example.test/list")
        chunks = []
        while True:
            part = store.read(result["handle"])
            if part["done"]:
                break
            block = base64.b64decode(part["data"])
            self.assertLessEqual(len(block), 65536)
            chunks.append(block)
        self.assertEqual(b"".join(chunks), body)
        store.close(result["handle"])
        self.assertEqual(store.files, {})
        with self.assertRaises(KeyError):
            store.read(result["handle"])
        store.shutdown()

    def test_failed_download_retains_no_handle(self):
        from network import PlaylistDownloads

        store = PlaylistDownloads()
        response = Reply(b"partial", "text/plain")
        response.headers["Content-Length"] = "100"
        with patch("network.urlopen", return_value=response):
            with self.assertRaises(ValueError):
                store.download("https://example.test/list")
        self.assertEqual(store.files, {})
        store.shutdown()

    def test_shutdown_rejects_completed_download(self):
        from network import PlaylistDownloads

        store = PlaylistDownloads()
        store.shutdown()
        with patch("network.urlopen", return_value=Reply(b"data", "text/plain")):
            with self.assertRaises(ValueError):
                store.download("https://example.test/list")
        self.assertEqual(store.files, {})


class ConcurrentTransferTests(unittest.TestCase):
    def test_epg_download_does_not_invalidate_playlist_reader(self):
        from network import PlaylistDownloads
        import base64

        store = PlaylistDownloads()
        try:
            with patch("network.urlopen", return_value=Reply(b"playlist", "text/plain")):
                first = store.download("https://example.test/list")
            with patch("network.urlopen", return_value=Reply(b"guide", "text/plain")):
                second = store.download("https://example.test/guide")
            self.assertEqual(base64.b64decode(store.read(first["handle"])["data"]), b"playlist")
            self.assertEqual(base64.b64decode(store.read(second["handle"])["data"]), b"guide")
        finally:
            store.shutdown()
