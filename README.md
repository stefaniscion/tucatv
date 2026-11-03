# TucaTV

Client-side IPTV player with a shared Svelte 5 / Tailwind CSS 4 interface. Supports M3U files and URLs, XMLTV, Live/VOD browsing, favorites, hidden categories and TV remote navigation.

**Version:** 0.9.1. Android uses Capacitor 6 and libVLC; Windows/Linux use Python, PySide6 and libVLC. No application server is required. iOS, Tizen and webOS are not implemented.

## Web

Requirements: Node.js 22–24 and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Deploy `dist/` to a static host. Browser playback requires compatible codecs, HTTPS and CORS permissions. Playlist import is limited to 256 MiB; actual memory requirements depend on the device.

## Android / Android TV

Requirements: JDK 17, Android SDK Platform 34, Build Tools 34.0.0, Platform Tools and Python 3.12. Configure `JAVA_HOME` and `ANDROID_HOME`, and accept the SDK licenses.

```sh
npm ci
npm run android:sync
cd android
./gradlew :app:assembleDebug
```

On Windows use `gradlew.bat`. Debug output: `android/app/build/outputs/apk/debug/app-debug.apk`.

For a signed release, run from the repository root:

```sh
npm run android:release
```

Output: `artifacts/android/TucaTV-0.9.1.apk`. The script builds, aligns, signs and verifies the APK. It expects `signing/tucatv-release.p12` and `signing/password.txt`, with alias `tucatv`. Alternative paths: `TUCATV_KEYSTORE`, `TUCATV_KEYSTORE_PASSWORD_FILE`, `TUCATV_KEY_ALIAS`.

Signing inputs are excluded from Git. Android application ID: `it.stefaniscion.tucatv`.

## Windows / Linux

Requirements: Python 3.12, Node.js and matching-architecture VLC/libVLC. Install Qt/XCB dependencies on Linux; the video backend uses X11/XWayland.

```sh
python -m venv .venv
# Linux:
. .venv/bin/activate
# Windows PowerShell instead:
# .\.venv\Scripts\Activate.ps1
python -m pip install -r desktop/requirements.txt
npm ci
npm run desktop:prepare
python desktop/main.py
```

Linux Debian package (Ubuntu 24.04 x64 with `dpkg-dev` and native dependencies):

```sh
bash desktop/build-linux.sh
```

Windows directory build, run on Windows after building the web interface:

```powershell
python -m PyInstaller --noconfirm --clean --name TucaTV --windowed --add-data "dist;web" --distpath desktop-output --workpath desktop-work --specpath desktop-work desktop/main.py
```

Distribute the entire output directory. This command does not bundle VLC; install VLC x64 on the target PC or package its runtime separately. Desktop installers are unsigned and require platform testing.

## Tests

```sh
npm test
npm run build
python -m unittest discover -s desktop/tests -p 'test_network.py'
```

CI runs web tests/build, desktop network tests, Android compilation and the bounded playlist-transfer test. Streaming, audio routing, PiP and TV navigation require device testing.

## Source layout

- `src/`: Svelte interface, playlist parsing, storage and playback adapters.
- `android/`: Capacitor host, libVLC player and background playback service.
- `desktop/`: PySide6 host, libVLC integration and desktop packaging.
- `scripts/`: Android signing and desktop asset preparation.
- `tests/`: JavaScript tests; native tests live under `android/tests/` and `desktop/tests/`.

## Release configuration

Version metadata is defined in `package.json`, `package-lock.json`, Android `versionCode`/`versionName` and the UI version. Android signing is configured through the environment variables listed above.

No open-source license has been selected for the original code. Third-party components retain their own licenses.
