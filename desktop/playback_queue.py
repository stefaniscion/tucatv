"""Disk-backed queue: only offsets and the current item remain in memory."""

from array import array
import json
import tempfile
from network import valid_url


class PlaybackQueue:
    def __init__(self):
        self.file = tempfile.TemporaryFile()
        self.offsets = array("Q")

    def append(self, items):
        if len(items) > 100:
            raise ValueError("Blocco troppo grande")
        for item in items:
            record = {"url": valid_url(item["url"]), "title": str(item.get("title", "TucaTV"))[:300]}
            data = json.dumps(record, ensure_ascii=False).encode("utf-8")
            if len(data) > 65536:
                raise ValueError("Voce troppo grande")
            self.file.seek(0, 2)
            self.offsets.append(self.file.tell())
            self.file.write(len(data).to_bytes(4, "big") + data)

    def __len__(self):
        return len(self.offsets)

    def __getitem__(self, index):
        self.file.seek(self.offsets[index])
        size = int.from_bytes(self.file.read(4), "big")
        return json.loads(self.file.read(size))

    def close(self):
        self.file.close()
        self.offsets = array("Q")
