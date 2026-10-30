# TucaTV 0.3
Client-only IPTV application: Svelte 5, Tailwind 4, Capacitor 6 and libVLC 3.6.0 for Android.

## Android
Requires Node 20+, JDK 17, Android SDK 34, build tools 34.
- npm ci
- npm run build
- npx cap sync android
- cd android && ./gradlew :app:assembleDebug

The debug APK targets ARM64 and ARMv7 Android devices. It is a development build, not a Play Store release. Import your playlist again inside the app: browser and Android storage are separate.
Streams open in an integrated libVLC Activity. HTTP is allowed for user-supplied IPTV sources. Back returns to the channel list; pause/play and retry are available. Playlist URL downloads use Capacitor's native HTTP implementation. Data is stored in IndexedDB.
No playlist credentials are embedded in the app. Android backups are disabled.

## Browser
npm run build
Deploy dist as static HTTPS files. Browser playback still requires compatible sources, codecs and applicable CORS/HTTPS permissions. Native playback cannot be delivered by updating a website alone.

## Limitations
iOS is not implemented. Android TV launcher/banner and D-pad navigation are included; physical phone, tablet and TV testing is still required. Samsung Tizen and LG webOS packages are not included. Android source compiles separately from the web build. Stream compatibility must be verified on a physical device; a successful build is not a playback test.
Channel results load 100 rows at a time, with a button to load more; all entries remain searchable. XMLTV is imported separately if no EPG URL is present.

## Third-party notices
libVLC Android is distributed under LGPL 2.1 or later. Sources and license:
https://code.videolan.org/videolan/vlc-android
https://www.videolan.org/vlc/libvlc.html
Capacitor, Svelte, Tailwind CSS, idb-keyval and hls.js retain their respective upstream licenses.

Brand: black background, orange accents, vector toucan beak. Native package ID and storage keys retain the old internal name for upgrade continuity. Native player: overlay controls, audio/subtitle selection, seek when supported, fit/fill, and a local channel window (up to 50 preceding/following channels; return to the list for further navigation).
