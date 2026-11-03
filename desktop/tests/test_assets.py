import unittest, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from PySide6.QtCore import QObject, QUrl


class Job(QObject):
    def __init__(self, url):
        super().__init__()
        self.url = QUrl(url)
        self.error = None
        self.body = None

    def requestMethod(self):
        return b"GET"

    def requestUrl(self):
        return self.url

    def fail(self, error):
        self.error = error

    def reply(self, mime, buffer):
        self.body = bytes(buffer.readAll())
        self.mime = mime


class AssetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old = main.ROOT
        main.ROOT = Path(self.temp.name)
        (main.ROOT / "web").mkdir()
        (main.ROOT / "web/index.html").write_text("<head></head><body>TucaTV</body>")
        self.handler = main.Assets()

    def tearDown(self):
        main.ROOT = self.old
        self.temp.cleanup()

    def test_webchannel_injected(self):
        job = Job("tucatv://app/")
        self.handler.requestStarted(job)
        self.assertIn(b"qrc:///qtwebchannel/qwebchannel.js", job.body)

    def test_remote_host_rejected(self):
        job = Job("tucatv://external/")
        self.handler.requestStarted(job)
        self.assertIsNotNone(job.error)

    def test_non_asset_rejected(self):
        job = Job("tucatv://app/../main.py")
        self.handler.requestStarted(job)
        self.assertIsNotNone(job.error)


if __name__ == "__main__":
    unittest.main()
