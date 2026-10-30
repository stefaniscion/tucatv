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

## Versione 0.4
Intro TucaTV animata e saltabile (rispetta reduced motion), cataloghi Live e VOD con righe per categoria, ricerca completa e vista elenco. Classificazione euristica da estensione, percorso /movie|series|vod/ e gruppo; M3U non fornisce sempre un tipo affidabile. Nessun recupero di metadati esterno. Le righe mostrano fino a 20 titoli per 12 categorie: «Vedi tutti», filtro categoria e ricerca mantengono accessibile tutta la raccolta. Test automatico su 134388 voci sintetiche.

Web: HLS nativo preferito quando disponibile anche in modalità forzata, timeout di avvio 20 secondi, errori nel player e download locale del singolo stream M3U per VLC. Le sorgenti HTTP su hosting HTTPS non vengono avviate: il gestore deve fornire HTTPS. Nessun proxy e nessuna riscrittura automatica degli URL con credenziali. CORS e codec devono essere compatibili con il browser. Il file esportato contiene l'URL privato della sorgente. Android continua a usare libVLC.

### Correzione layout player web
Il player in errore non usa più il rapporto d'aspetto insieme a un'altezza minima per determinare la larghezza: il messaggio entra nel flusso e cresce in verticale. Larghezza vincolata al contenitore, pulsanti a capo e controlli superiori accessibili. Messaggio HTTP esplicita il controllo preventivo dell'app, senza attribuirlo a una richiesta fallita osservata nel browser.

## Versione 0.5 — Desktop e Android
- Desktop Windows/Linux con host PySide6, stesso frontend Svelte, bridge QWebChannel e libVLC incorporato. I dettagli di packaging, installazione e limiti di verifica sono in desktop/README.md.
- Loghi Android scaricati tramite HTTP nativo (limite 2 MiB), caricamento solo in prossimità del viewport, quattro richieste concorrenti, cache fino a 8 MiB/160 voci e fallback con iniziali. Nessun allentamento della sicurezza della WebView.
- PlaybackService Android possiede VLC indipendentemente dall'Activity. Foreground service mediaPlayback, notifica con pausa/stop, MediaSession e audio focus USAGE_MEDIA. Wake lock limitato alla riproduzione, pausa in caso di perdita audio focus e scollegamento cuffie. Il video viene scollegato in background e riagganciato alla UI al ritorno senza fermare l'audio. PiP automatico (Android 8+ quando supportato), tasto PiP e tasto Stop; Back torna al catalogo lasciando l'audio in background. La notifica riapre il player. Stop chiude la riproduzione.
- MediaSession è usata per comandi e instradamento audio del sistema; non è una pubblicazione/app navigabile nel catalogo Android Auto. Compatibilità con l'auto, ritorno dal background, PiP e loghi reali ancora da verificare su hardware fisico.

## Versione 0.6 — Avanzamento importazione
Barra condivisa per file, link e aggiornamento playlist: trasferimento (byte ricevuti, percentuale soltanto con dimensione nota), lettura M3U (percentuale di righe e canali trovati), salvataggio IndexedDB (indeterminato), conferma solo dopo il salvataggio. I download browser, Android e desktop emettono progressi reali. Il parser cede periodicamente il controllo alla UI; i download sono limitati a 64 MiB. In caso di errore di aggiornamento la playlist salvata non viene sostituita. Gli URL privati non compaiono nell'indicatore. Test streaming UTF-8 spezzato, dimensione ignota, limite dimensione, metadati e avanzamento incrementale.
