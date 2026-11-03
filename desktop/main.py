"""TucaTV Desktop: shared Svelte UI + native libVLC, without a local HTTP server."""

import os
import sys
import json
import mimetypes
import time
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
if sys.platform == "win32":
    engine = ROOT / "vlc"
    if engine.exists():
        os.environ["PYTHON_VLC_LIB_PATH"] = str(engine / "libvlc.dll")
        os.environ["PYTHON_VLC_MODULE_PATH"] = str(engine)
        os.environ["VLC_PLUGIN_PATH"] = str(engine / "plugins")
        dll_handle = os.add_dll_directory(str(engine))
else:
    # libVLC embedding uses an X11 window ID; XWayland is supported.
    os.environ.setdefault("QT_QPA_PLATFORM", "xcb")

from PySide6.QtCore import (
    QObject,
    Signal,
    Slot,
    QUrl,
    QBuffer,
    QByteArray,
    QIODevice,
    Qt,
    QTimer,
    QStandardPaths,
    QSettings,
)
from PySide6.QtGui import QIcon, QShortcut, QKeySequence
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QStackedWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLabel,
    QSlider,
    QComboBox,
    QMessageBox,
)
from PySide6.QtWebEngineCore import (
    QWebEngineUrlScheme,
    QWebEngineUrlSchemeHandler,
    QWebEngineUrlRequestJob,
    QWebEngineProfile,
    QWebEnginePage,
    QWebEngineSettings,
)
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel
from network import download, valid_url, PlaylistDownloads
from playback_queue import PlaybackQueue
from i18n import Translator

scheme = QWebEngineUrlScheme(b"tucatv")
scheme.setSyntax(QWebEngineUrlScheme.Syntax.HostAndPort)
scheme.setDefaultPort(443)
scheme.setFlags(
    QWebEngineUrlScheme.Flag.SecureScheme
    | QWebEngineUrlScheme.Flag.LocalScheme
    | QWebEngineUrlScheme.Flag.LocalAccessAllowed
)
QWebEngineUrlScheme.registerScheme(scheme)


class Assets(QWebEngineUrlSchemeHandler):
    def requestStarted(self, job):
        if job.requestMethod() != b"GET" or job.requestUrl().host() != "app":
            job.fail(QWebEngineUrlRequestJob.Error.RequestDenied)
            return
        relative = job.requestUrl().path().lstrip("/") or "index.html"
        target = (ROOT / "web" / relative).resolve()
        if not target.is_relative_to((ROOT / "web").resolve()) or not target.is_file():
            job.fail(QWebEngineUrlRequestJob.Error.UrlNotFound)
            return
        data = target.read_bytes()
        if relative == "index.html":
            data = data.replace(b"</head>", b'<script src="qrc:///qtwebchannel/qwebchannel.js"></script></head>')
        mime = {".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml"}.get(
            target.suffix, mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        )
        buffer = QBuffer(job)
        buffer.setData(QByteArray(data))
        buffer.open(QIODevice.OpenModeFlag.ReadOnly)
        job.reply(mime.encode(), buffer)


class TrustedPage(QWebEnginePage):
    def acceptNavigationRequest(self, url, navigation_type, main_frame):
        return url.scheme() == "tucatv" and url.host() == "app"

    def createWindow(self, window_type):
        return None


class Bridge(QObject):
    completed = Signal(str, str)
    progress = Signal(str, float, float)
    playbackState = Signal(str)

    def __init__(self, window):
        super().__init__(window)
        self.window = window
        self.pool = ThreadPoolExecutor(max_workers=4)
        self.downloads = PlaylistDownloads()
        self.queues = {}

    @Slot(str, str, str)
    def request(self, request_id, method, raw):
        try:
            payload = json.loads(raw)
            if method == "setLanguage":
                self.window.set_language(payload.get("language"))
                self.completed.emit(request_id, "{}")
                return
            if method == "beginQueue":
                for queue in self.queues.values():
                    queue.close()
                self.queues.clear()
                handle = str(uuid.uuid4())
                self.queues[handle] = PlaybackQueue()
                self.completed.emit(request_id, json.dumps({"handle": handle}))
                return
            if method in ("appendQueue", "closeQueue"):
                handle = payload.get("handle")
                if method == "appendQueue":
                    self.queues[handle].append(payload.get("items", []))
                else:
                    queue = self.queues.pop(handle, None)
                    if queue:
                        queue.close()
                self.completed.emit(request_id, "{}")
                return
            if method == "getPlaybackState":
                self.completed.emit(request_id, json.dumps(self.window.playback_state()))
                return
            if method == "play":
                valid_url(payload.get("url"))
                self.window.play(payload)
                self.completed.emit(request_id, "{}")
                return
            progress = lambda received, total: self.progress.emit(request_id, received, total)
            if method == "downloadPlaylist":
                future = self.pool.submit(
                    self.downloads.download,
                    valid_url(payload.get("url")),
                    progress,
                    {
                        "etag": payload.get("etag", ""),
                        "lastModified": payload.get("lastModified", ""),
                    },
                )
            elif method == "readPlaylistChunk":
                future = self.pool.submit(self.downloads.read, payload.get("handle"))
            elif method == "closePlaylist":
                future = self.pool.submit(self.downloads.close, payload.get("handle"))
            elif method in ("text", "image"):
                future = self.pool.submit(
                    download, valid_url(payload.get("url")), method == "image", progress if method == "text" else None
                )
            else:
                raise ValueError("Unsupported operation")

            def done(task):
                try:
                    value = task.result()
                    result = value if isinstance(value, dict) else {"data": value}
                except Exception:
                    result = {"error": self.window.tr("Source unavailable or invalid format")}
                try:
                    self.completed.emit(request_id, json.dumps(result))
                except RuntimeError:
                    pass

            future.add_done_callback(done)
        except Exception:
            self.completed.emit(request_id, json.dumps({"error": self.window.tr("Unable to open the source")}))


class Window(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("TucaTV")
        self.resize(1280, 800)
        self.setMinimumSize(760, 540)
        self.settings = QSettings()
        self.translator = Translator(ROOT / "web", self.settings.value("language"))
        self.translated_widgets = []
        self.setWindowIcon(QIcon(str(ROOT / "web" / "tucatv-mark.svg")))
        self.engine = None
        self.player = None
        self.queue = PlaybackQueue()
        self.playlist_id = ""
        self.last_played = None
        self.confirmed = False
        self.index = 0
        self.dragging = False
        self.tracks_loaded = False
        self.stack = QStackedWidget()
        self.setCentralWidget(self.stack)
        self.web = QWebEngineView()
        self.stack.addWidget(self.web)
        self.profile = QWebEngineProfile("TucaTV", self)
        data = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppDataLocation)
        self.profile.setPersistentStoragePath(str(Path(data) / "web"))
        self.profile.setCachePath(str(Path(data) / "cache"))
        self.handler = Assets(self)
        self.profile.installUrlSchemeHandler(b"tucatv", self.handler)
        self.page = TrustedPage(self.profile, self.web)
        self.web.setPage(self.page)
        self.page.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        self.channel = QWebChannel(self.page)
        self.bridge = Bridge(self)
        self.channel.registerObject("native", self.bridge)
        self.page.setWebChannel(self.channel)
        self.web.load(QUrl("tucatv://app/"))
        self.screen = QWidget()
        layout = QVBoxLayout(self.screen)
        layout.setContentsMargins(16, 12, 16, 12)
        top = QHBoxLayout()
        top.addWidget(self.button("← Catalogue", self.back))
        self.title = QLabel("TucaTV")
        top.addWidget(self.title, 1)
        top.addWidget(self.button("Full screen", self.fullscreen))
        layout.addLayout(top)
        self.video = QWidget()
        self.video.setAttribute(Qt.WidgetAttribute.WA_NativeWindow)
        self.video.setStyleSheet("background:black")
        layout.addWidget(self.video, 1)
        self.status = QLabel("")
        self.status.setWordWrap(True)
        layout.addWidget(self.status)
        self.seek = QSlider(Qt.Orientation.Horizontal)
        self.seek.setRange(0, 1000)
        self.seek.sliderPressed.connect(lambda: setattr(self, "dragging", True))
        self.seek.sliderReleased.connect(self.seek_to)
        layout.addWidget(self.seek)
        controls = QHBoxLayout()
        controls.addWidget(self.button("⏮ Previous", lambda: self.step(-1)))
        self.toggle_button = self.button("Pause", self.toggle)
        controls.addWidget(self.toggle_button)
        controls.addWidget(self.button("Next ⏭", lambda: self.step(1)))
        controls.addWidget(self.button("Retry", self.retry))
        controls.addWidget(self.label("Volume"))
        self.volume = QSlider(Qt.Orientation.Horizontal)
        self.volume.setRange(0, 100)
        self.volume.setValue(80)
        self.volume.setMaximumWidth(130)
        self.volume.valueChanged.connect(lambda v: self.player.audio_set_volume(v) if self.player else None)
        controls.addWidget(self.volume)
        self.elapsed = QLabel("")
        controls.addWidget(self.elapsed)
        controls.addStretch()
        layout.addLayout(controls)
        tracks = QHBoxLayout()
        tracks.addWidget(self.label("Audio"))
        self.audio = QComboBox()
        tracks.addWidget(self.audio)
        tracks.addWidget(self.label("Subtitles"))
        self.subtitles = QComboBox()
        tracks.addWidget(self.subtitles)
        tracks.addStretch()
        layout.addLayout(tracks)
        self.audio.activated.connect(lambda i: self.player.audio_set_track(self.audio.itemData(i)))
        self.subtitles.activated.connect(lambda i: self.player.video_set_spu(self.subtitles.itemData(i)))
        self.stack.addWidget(self.screen)
        self.timer = QTimer(self)
        self.timer.setInterval(500)
        self.timer.timeout.connect(self.update_player)
        QShortcut(QKeySequence("Escape"), self, activated=self.escape)
        QShortcut(QKeySequence("Space"), self.screen, activated=self.toggle)
        QShortcut(QKeySequence("F"), self.screen, activated=self.fullscreen)

    def tr(self, key):
        return self.translator.text(key)

    def set_language(self, language):
        self.translator.set_language(language)
        self.settings.setValue("language", language)
        for widget, key in self.translated_widgets:
            widget.setText(self.tr(key))
        if self.player:
            self.update_player()

    def label(self, key):
        widget = QLabel(self.tr(key))
        self.translated_widgets.append((widget, key))
        return widget

    def button(self, title, callback):
        button = QPushButton(self.tr(title))
        self.translated_widgets.append((button, title))
        button.setMinimumHeight(40)
        button.clicked.connect(callback)
        return button

    def ensure_engine(self):
        if self.engine:
            return
        import vlc

        self.vlc = vlc
        self.engine = vlc.Instance("--no-video-title-show", "--network-caching=1500", "--no-media-library", "--quiet")
        if not self.engine:
            raise RuntimeError("libVLC unavailable")
        self.player = self.engine.media_player_new()
        window_id = int(self.video.winId())
        if sys.platform == "win32":
            self.player.set_hwnd(window_id)
        else:
            self.player.set_xwindow(window_id)
        self.player.video_set_mouse_input(False)
        self.player.video_set_key_input(False)

    def play(self, payload):
        try:
            self.ensure_engine()
        except Exception:
            QMessageBox.warning(
                self,
                self.tr("Player unavailable"),
                self.tr(
                    "The VLC engine is unavailable. Install VLC/libVLC and its plugins, or include the VLC runtime with the app."
                ),
            )
            raise
        queue = self.bridge.queues.pop(payload.get("queueHandle"), None)
        if queue is None or not len(queue):
            if queue is not None:
                queue.close()
            raise ValueError("Playback queue unavailable")
        self.queue.close()
        self.queue = queue
        self.playlist_id = payload.get("playlistId", "")
        self.index = max(0, min(int(payload.get("index", 0)), len(self.queue) - 1))
        self.stack.setCurrentWidget(self.screen)
        self.retry()

    def retry(self):
        if not self.player or not self.queue:
            return
        self.player.stop()
        item = self.queue[self.index]
        self.title.setText(item["title"])
        self.status.setText(self.tr("Connecting…"))
        self.tracks_loaded = False
        self.confirmed = False
        self.audio.clear()
        self.subtitles.clear()
        media = self.engine.media_new_location(item["url"])
        self.player.set_media(media)
        media.release()
        self.player.audio_set_volume(self.volume.value())
        self.player.play()
        self.timer.start()

    def step(self, delta):
        if self.queue:
            self.index = (self.index + delta) % len(self.queue)
            self.retry()

    def toggle(self):
        if self.player:
            self.player.pause()

    def seek_to(self):
        if self.player and self.player.is_seekable():
            self.player.set_position(self.seek.value() / 1000)
        self.dragging = False

    def fullscreen(self):
        self.showNormal() if self.isFullScreen() else self.showFullScreen()

    def escape(self):
        if self.isFullScreen():
            self.showNormal()
        elif self.stack.currentWidget() == self.screen:
            self.back()

    def back(self):
        self.timer.stop()
        if self.player:
            self.player.stop()
        self.stack.setCurrentWidget(self.web)

    def playback_state(self):
        return {
            "available": self.stack.currentWidget() == self.screen and bool(self.queue),
            "lastPlayed": self.last_played,
        }

    def update_player(self):
        if not self.player:
            return
        if self.player.is_playing() and not self.confirmed:
            self.confirmed = True
            self.last_played = {
                "url": self.queue[self.index]["url"],
                "playlistId": self.playlist_id,
                "at": int(time.time() * 1000),
            }
            self.bridge.playbackState.emit(json.dumps(self.playback_state()))
        state = self.player.get_state()
        self.toggle_button.setText(self.tr("Pause" if self.player.is_playing() else "Play"))
        if state == self.vlc.State.Error:
            self.status.setText(self.tr("Playback failed: check the source, connection and access."))
            self.timer.stop()
        elif state in (self.vlc.State.Opening, self.vlc.State.Buffering):
            self.status.setText(self.tr("Connecting / buffering…"))
        elif state == self.vlc.State.Ended:
            self.status.setText(self.tr("Playback ended"))
        else:
            self.status.setText("")
        self.seek.setEnabled(bool(self.player.is_seekable()))
        if not self.dragging:
            self.seek.setValue(max(0, int(self.player.get_position() * 1000)))

        def stamp(ms):
            seconds = max(0, ms // 1000)
            return f"{seconds//60}:{seconds%60:02d}"

        length = self.player.get_length()
        self.elapsed.setText(stamp(self.player.get_time()) + (" / " + stamp(length) if length > 0 else " · LIVE"))
        if self.player.is_playing() and not self.tracks_loaded:
            for combo, descriptions, selected in [
                (self.audio, self.player.audio_get_track_description(), self.player.audio_get_track()),
                (self.subtitles, self.player.video_get_spu_description(), self.player.video_get_spu()),
            ]:
                combo.clear()
                for track_id, title in descriptions or []:
                    combo.addItem(title.decode("utf-8", "replace") if isinstance(title, bytes) else title, track_id)
                combo.setCurrentIndex(combo.findData(selected))
            self.tracks_loaded = self.audio.count() > 0

    def closeEvent(self, event):
        self.timer.stop()
        if self.player:
            self.player.stop()
            self.player.release()
        if self.engine:
            self.engine.release()
        self.queue.close()
        for queue in self.bridge.queues.values():
            queue.close()
        self.bridge.downloads.shutdown()
        self.bridge.pool.shutdown(wait=False, cancel_futures=True)
        self.web.setPage(QWebEnginePage(self.web))
        self.page.deleteLater()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("TucaTV")
    app.setOrganizationName("TucaTV")
    app.setStyleSheet(
        "QWidget{background:#080808;color:#eee;font-size:14px} QPushButton,QComboBox{background:#202020;border:1px solid #444;border-radius:7px;padding:7px 12px} QPushButton:hover,QPushButton:focus{border-color:#ff8a24;color:#ff8a24} QSlider::groove:horizontal{height:4px;background:#444} QSlider::handle:horizontal{background:#ff8a24;width:14px;margin:-5px 0;border-radius:6px} QLabel{background:transparent}"
    )
    window = Window()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
