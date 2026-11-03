# TucaTV

Client-side IPTV player with a shared Svelte 5 / Tailwind CSS 4 interface. Supports M3U files and URLs, XMLTV, Live/VOD browsing, favorites, hidden categories, TV remote navigation and a responsive timeline/agenda TV guide.

**Version:** 0.13.3. Android uses Capacitor 6 and libVLC; Windows/Linux use Python, PySide6 and libVLC. No application server is required. iOS, Tizen and webOS are not implemented.

## Web

Requirements: Node.js 22–24 and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:ui
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

Output: `artifacts/android/TucaTV-0.13.3.apk`. The script builds, aligns, signs and verifies the APK. It expects `signing/tucatv-release.p12` and `signing/password.txt`, with alias `tucatv`. Alternative paths: `TUCATV_KEYSTORE`, `TUCATV_KEYSTORE_PASSWORD_FILE`, `TUCATV_KEY_ALIAS`.

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
npx playwright install chromium
npm run test:ui
python -m unittest discover -s desktop/tests
```

Run validation locally; no CI workflows are configured. Streaming, audio routing, PiP and TV navigation require device testing. Browser tests use synthetic playlists and XMLTV only.

## Formatting

Code uses four-space indentation. Install the JavaScript and Python development tools, then run the formatter or its read-only check:

```sh
npm ci
python -m pip install -r desktop/requirements-dev.txt
npm run format
npm run format:check
```

Generated Capacitor files, build output, binary assets and bundled Rytec data are excluded from formatting.

## Source layout

- `src/`: Svelte interface, playlist parsing, storage and playback adapters.
- `src/epg/`: bundled Rytec registry, background imports, streaming XMLTV parser and indexed guide cache.
- `android/`: Capacitor host, libVLC player and background playback service.
- `desktop/`: PySide6 host, libVLC integration and desktop packaging.
- `scripts/`: Android signing and desktop asset preparation.
- `tests/`: JavaScript tests; native tests live under `android/tests/` and `desktop/tests/`.

## Runtime behavior

Catalogues, shelves, playlist collections and category management load progressively. Scrolling reveals more items; the load-more control supports remote/keyboard navigation. Existing items stay mounted as the list grows.

Settings → Manage EPG enables all 56 bundled Rytec sources by default. Sources update sequentially at startup when missing or older than 24 hours, and are checked hourly while the app is visible. Users can disable automatic updates or individual sources, update manually, stop a run, inspect errors and clear the Rytec cache. Downloads try the mirrors listed in the bundled catalogue; availability is not guaranteed. Browser CORS and mixed-content restrictions still apply.

Rytec XMLTV is decompressed (XZ/gzip) and parsed in a worker, then stored in IndexedDB in bounded batches. Limits are 256 MiB per downloaded/decompressed source and 32 KiB per title/description. All channels are imported, retaining programmes from the past day through the next 14 days. Catalogue views load current/next entries only; the full guide queries a three-hour window for progressively visible channels and switches to a single-channel agenda on narrow screens. A complete validated generation replaces the previous guide; failed imports preserve cached data. Abandoned generations are cleaned at startup.

Playlist-specific XMLTV URLs and local XML imports (64 MiB limit) are managed in Settings → Manage EPG and take precedence over Rytec. Existing playlist guides and local imports are retained. Channel matching uses exact M3U `tvg-id` / XMLTV channel IDs. The last channel is recorded after playback starts; native zapping updates it, and the hero respects the selected Live/VOD mode.

Native playlist downloads use temporary files and 64 KiB bridge reads. Playback queues are uploaded in bounded batches to private temporary files, then read by index during zapping, including Android background playback. The full catalogue still resides in JavaScript memory; the 256 MiB import cap is not a RAM bound.

## Localization

Italian and English use shared catalogues in `src/locales/`. The Settings page applies language changes immediately and stores `tucatv-language` locally. The default Device language option follows supported device languages, falling back to English; Italian and English can be selected explicitly. Settings also persist playlist refresh at startup (enabled by default), initial catalogue view and initial Live/VOD section in `tucatv-settings`; startup options apply on the next launch. Provider names, categories and XMLTV content are not translated.

`src/i18n.js` provides reactive translations, interpolation and localizable errors. Catalogue keys use the English source text; the English catalogue maps each key to itself, while other catalogues provide translations with identical placeholder names. Vite copies these catalogues to `dist/locales/`; Android and desktop read them alongside the web assets. The default preference follows the device language. Language changes are synchronized through the native bridge, including Android playback notifications. System-owned file pickers follow the OS language.

Run `npm test`, `npm run test:ui` and `python -m unittest discover -s desktop/tests -p 'test_i18n.py'` after changing translations. Run the normal web build and Capacitor sync or desktop preparation to update native assets.

## Release configuration

Version metadata is defined in `package.json`, `package-lock.json`, Android `versionCode`/`versionName` and the UI version. Android signing is configured through the environment variables listed above.

No open-source license has been selected for the original code. Third-party components retain their own licenses.

## Rytec catalogue

`src/epg/rytec.json` is a snapshot of [oe-alliance/EPGImport-Sources](https://github.com/oe-alliance/EPGImport-Sources/blob/main/rytec.sources.xml), retrieved 2026-11-03. It contains all 56 source descriptions and their mirror URLs (55 unique primary feeds). Source IDs must remain stable to retain preferences/cache. XZ decompression uses the bundled MIT-licensed `xz-decompress` WebAssembly decoder; no external decoder or application server is needed.
