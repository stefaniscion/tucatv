# TucaTV 0.3
Client-only IPTV application: Svelte 5, Tailwind 4, Capacitor 6 and libVLC 3.6.0 for Android.

## Android
Requires Node 20+, JDK 17, Android SDK 34, build tools 34.
- npm ci
- npm run build
- npx cap sync android
- cd android && ./gradlew :app:assembleDebug

The debug APK targets ARM64 and ARMv7 Android devices. It is a development build, not a Play Store release. Import your playlist again inside the app: browser and Android storage are separate.
Streams open in an integrated libVLC Activity. HTTP is allowed for user-supplied IPTV sources. Back returns to the channel list; pause/play and retry are available. Playlist URL downloads use a native HTTP bridge with a private temporary file and bounded chunks. Data is stored in IndexedDB.
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

## Versione 0.7 — Importazione con memoria ridotta
- Android scarica la playlist nella cache privata: restituisce solo un handle e la dimensione, poi trasferisce blocchi da 64 KiB alla WebView. Il file temporaneo viene eliminato dopo l'importazione o un errore, al prossimo import e all'avvio dopo una chiusura imprevista. Nessun file completo serializzato in un messaggio JSON.
- Parser M3U incrementale per file/browser/Android, UTF-8 conservato fra blocchi, limite totale 64 MiB e singola riga 64 KiB. Le righe non vengono più raccolte in un array completo. Su browser download e lettura avanzano insieme.
- Raccolte Svelte non profondamente reattive, salvataggio IndexedDB senza conversione JSON intermedia. Le raccolte si aggiornano per sostituzione. Un errore lascia intatta la playlist precedentemente salvata.
- Browser: rilevamento HTTP da pagina HTTPS; errori di rete/CORS spiegati senza attribuire una causa non verificata. Link per apertura separata e importazione file; nessun proxy e nessuna disabilitazione della sicurezza.
- Verifiche: 14 test JavaScript; trasferimento Java di 50 MiB con heap di 16 MiB, limite dimensione e interruzione; parser di 140.000 voci / 47,2 MiB con heap Node limitato a 128 MiB; importazione e salvataggio della stessa playlist nella UI browser. Build Android verificata. Il crash sul telefono dell'utente non è stato riprodotto con logcat: la pressione di memoria è una causa plausibile corretta, da verificare installando l'APK aggiornato.

## Versione 0.8 — Ripresa, avvio e telecomando
- Android espone lo stato del servizio di riproduzione alla UI; «Torna al player» riapre la stessa sessione senza reimpostare la sorgente. Disponibile anche da telecomando, con Stop nel menu. Il ritorno dal player aggiorna lo stato; una sessione fermata non viene mostrata.
- Aggiornamento automatico a ogni avvio della UI per tutte le playlist da link, in sequenza e con la playlist attiva prima delle altre. Il catalogo salvato rimane navigabile durante il download, ogni errore conserva la copia precedente e non blocca gli altri aggiornamenti. I file locali non hanno una sorgente remota da aggiornare. Il ritorno dal player non rilancia l'aggiornamento.
- Modalità TV automatica sui dispositivi Android TV (UiModeManager) e selezionabile dal menu su tutte le piattaforme. 24 voci per pagina, focus arancione esplicito, navigazione direzionale lineare senza ordinamento a ogni pressione, niente animazioni decorative nel catalogo TV. Indietro riporta prima al menu, poi alla radice e infine al launcher Android. Frecce nei select restano native. Page Up/Down cambiano pagina nel catalogo TV.
- Indice Live/VOD e categorie ricostruito solo al cambio della playlist, ricerca ritardata 180 ms, guida indicizzata per canale. Preferiti salvati con aggiornamento IndexedDB separato per non sovrascrivere una playlist in aggiornamento.
- Intro 3,9 secondi (+1,5 secondi), sempre saltabile; reduced-motion mantiene la durata breve.
- Limite playlist 256 MiB in browser, APK e desktop. Trasferimento APK a blocchi conservato; immagini restano limitate a 2 MiB e la guida XMLTV nativa Android a 64 MiB. Il limite dimensionale non garantisce che ogni dispositivo possa mantenere in memoria un catalogo di dimensioni arbitrarie.
- Verifiche: 20 test JS, 5 test rete desktop, trasferimento Java di 128 MiB con heap di 16 MiB e guardia a 256 MiB, build Android. Navigazione browser con tastiera su 140.000 canali: 24 tile, focus destra/giù e cambio pagina. Test UI aggiornamento automatico dopo modifica della sorgente; copie offline conservate. Ripresa nativa e telecomando fisico richiedono verifica su dispositivo.

## Versione 0.9 — Interfaccia TV-first
- Un solo layout per TV, tablet e telefono: barra laterale compatta su schermi stretti o bassi, contenuto scorrevole indipendente, titoli e spaziature ridotti. Nessun selettore separato di modalità mobile/TV.
- Catalogo iniziale con ultimo canale aperto per playlist, conservato sul dispositivo. Un canale rimosso o nascosto non viene riproposto. Gli spostamenti interni al player nativo non modificano questa cronologia.
- Categorie nascondibili dalla gestione playlist, con ricerca, paginazione, mostra/nascondi tutte e salvataggio esplicito. Le esclusioni si applicano a catalogo, ricerca e preferiti; restano salvate durante il refresh remoto. I canali non vengono eliminati.
- Android 0.9.0 / versionCode 8. Nuova chiave di firma, conservata separatamente dal repository: il primo passaggio dagli APK precedenti richiede disinstallazione e reimportazione delle playlist. Gli aggiornamenti successivi devono riutilizzare questa chiave.
- Verifiche: 22 test JavaScript; layout browser 844×390, 390×844 e 1280×720; salvataggio categorie, esclusione dal catalogo e persistenza dopo refresh. Prove fisiche su TV/telefono ancora necessarie.
