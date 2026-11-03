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

**Signing files are private and ignored by Git.** The delivery archive includes the existing 0.9.x key; cloning the bundle alone does not copy it. Keep a private backup and never publish the delivery archive. Release updates must retain the same application ID (`it.stefaniscion.onda`) and signing key. Debug APKs use a different key.

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

## Tests and releases

```sh
npm test
npm run build
python -m unittest discover -s desktop/tests -p 'test_network.py'
```

CI checks web tests/build and unsigned Android builds. Hardware checks are still required for streaming, audio, PiP, cutouts and remote navigation. Current dependencies retain known deprecation warnings; this repository is not a security audit.

Version tags `v0.1.0` through `v0.9.1` contain 11 reconstructed release snapshots. Intermediate fixes within each version were consolidated; generated output and hosting metadata were excluded. Repository-maintenance commits follow the release snapshots. Author and committer: **Stefano Di Pasquale <stefaniscion@gmail.com>**. This attribution was requested by the owner; tags are not cryptographically signed.

Before releasing, update `package.json`, `package-lock.json`, Android `versionCode`/`versionName` and the UI version. Run the tests/builds and create an annotated version tag.

To publish to an empty Git repository:

```sh
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
git push origin --tags
```

No open-source license has been selected for the original code. Third-party components retain their own licenses.
