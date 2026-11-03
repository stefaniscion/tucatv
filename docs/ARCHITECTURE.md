# Architettura

## Componenti

- `src/App.svelte`: navigazione, stato UI, importazione, persistenza e coordinamento player.
- `src/playlist-import.js`: lettura M3U incrementale e limiti; `playlist-network.js`: errori di rete browser.
- `src/catalog.js`: separatori, classificazione Live/VOD, indici e guida corrente.
- `src/Catalog.svelte` e `TVCatalog.svelte`: righe catalogo e griglia paginata (24 titoli), focus telecomando.
- `src/CategoryManager.svelte`, `playlist-preferences.js`: categorie nascoste e ultimo canale.
- `src/native.js`: adattatori Capacitor e desktop QWebChannel.
- `src/Player.svelte`: UI del player web; `hls.js` gestisce HLS dove supportato.
- `android/.../NativePlayerPlugin.java`: bridge per rete e player; `PlaylistTransfer.java`: copia a blocchi.
- `PlaybackService.java`: possiede la sessione VLC Android; `PlayerActivity.java`: superficie e controlli; `MainActivity.java`: WebView, insets e ritorno al catalogo.
- `desktop/main.py`: finestra Qt, schema locale `tucatv://app`, bridge e player VLC; `desktop/network.py`: download nativi.

## Dati

Playlist e preferiti sono salvati in IndexedDB (`onda`); l'ultimo canale aperto usa `tuca-last-opened`. Il browser, la WebView Android e il profilo desktop hanno archivi distinti. Nessun account o sincronizzazione cloud. La cronologia registra i canali aperti dalla UI, non i cambi canale interni al player nativo.

Le playlist da URL vengono aggiornate all'avvio della UI, in sequenza. Un errore conserva la copia precedente. Le playlist da file non possono aggiornarsi da sole. Le categorie nascoste sono preferenze per playlist e non eliminano i dati originali.

## Rete e memoria

L'app non gestisce un backend. Le richieste vanno direttamente ai fornitori scelti dall'utente. Nel browser valgono CORS, mixed content e supporto codec. Su Android download nativo verso cache temporanea, trasferimenti da 64 KiB e parser incrementale limitano le copie di stringhe grandi. Limite playlist: 256 MiB; immagini native: 2 MiB; XMLTV nativo Android: 64 MiB. I cataloghi restano in memoria dopo il parsing: il limite di ingresso non è una garanzia sul consumo totale di RAM.

I loghi hanno caricamento differito, concorrenza limitata e cache. Le viste limitano le schede renderizzate e indicizzano Live/VOD e categorie al cambio della playlist.

## Classificazione

Un `kind` esplicito ha precedenza. Poi `/live/` identifica Live; file video e percorsi `/movie/`, `/series/`, `/vod/`, oppure una categoria esplicitamente VOD identificano on demand. I generi Cinema/Film/Series non sono sufficienti. Gli URL ambigui restano Live. Non viene interrogato un catalogo metadati esterno.

## Limiti

iOS/Tizen/webOS non sono implementati. Android Auto non ha un'interfaccia dedicata: audio focus e MediaSession non equivalgono a una certificazione Android Auto. Il servizio BG/PiP è Android; il desktop ferma la riproduzione tornando al catalogo. Non ci sono test end-to-end automatici di streaming reale né emulazione completa del telecomando o del notch.
