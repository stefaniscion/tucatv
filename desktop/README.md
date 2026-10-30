# TucaTV Desktop 0.8 beta

Windows x64: estrarre tutta la cartella del pacchetto ZIP e avviare `Avvia TucaTV.bat`. Python 3.12.10, PySide6 6.8.3 e VLC 3.0.24 sono inclusi; nessun server e nessuna installazione VLC separata. Pacchetto portabile non firmato, assemblato su Linux; esecuzione Windows non verificata.

Linux x64: pacchetto `.deb` costruito su Ubuntu 24.04, richiede glibc >= 2.39 (Ubuntu 24.04 o distribuzione Debian compatibile). Installare con `sudo apt install ./TucaTV-0.8-Linux-amd64.deb`, poi avviare TucaTV dal menu applicazioni. apt installa le librerie VLC e di sistema mancanti. Il rendering VLC usa X11/XWayland. Non eseguire come root e non disabilitare il sandbox Chromium. Nessuna prova effettuata su desktop Linux fisico, Wayland nativo non supportato da questo backend video.

Per altre distribuzioni: build dai sorgenti con Python 3.12, `pip install -r desktop/requirements.txt`, libVLC e plugin dal gestore pacchetti, `npm ci && npm run build`, copiare dist in desktop/web, poi `python desktop/main.py` (ambiente virtuale consigliato). Qt può richiedere pacchetti XCB, XTest, XKB e NSS.

La UI Svelte viene caricata tramite schema locale `tucatv://app`, senza aprire porte HTTP. Il bridge espone solo riproduzione e download HTTP/HTTPS di testo/immagini; la pagina non può navigare su siti esterni. I loghi sono scaricati dal codice nativo e passati alla UI come immagini incorporate, con limite 2 MiB e quattro richieste concorrenti. Playlist/EPG remoti hanno limite 256 MiB. Nessun URL privato viene registrato nei log applicativi.

Playlist e preferiti restano nel profilo locale TucaTV; reimportare la playlist già usata su Android/browser. VLC riproduce nel pannello nativo della stessa finestra: pausa, canale precedente/successivo (finestra di 101 canali), avanzamento, volume, tracce audio e sottotitoli. Escape esce da fullscreen e poi torna al catalogo. Il player desktop si interrompe tornando al catalogo o chiudendo l'app. Il background con servizio e PiP è specifico dell'APK Android.

## Componenti
UI Svelte/Tailwind condivisa, host Python/PySide6 e binding python-vlc. I componenti Qt/VLC restano librerie dinamiche sostituibili. Licenze e sorgenti originali: https://www.python.org/downloads/source/ ; https://download.qt.io/official_releases/QtForPython/pyside6/ ; https://pypi.org/project/python-vlc/ ; https://www.videolan.org/vlc/download-sources.html . Il pacchetto Windows include la distribuzione VideoLAN e i suoi file di licenza. Il pacchetto Linux usa libVLC fornita dalla distribuzione. Le licenze Qt/PySide6 vengono incluse da PyInstaller.

## Verifiche
Test della validazione URL, limite dimensione immagini e rifiuto risposte HTML; test catalogo a 134388 voci; build web e compilazione Python. Queste verifiche non sostituiscono la prova di streaming sui dispositivi e sulla rete del fornitore.

Importazione: avanzamento byte per byte nei download nativi, lettura a blocchi dei canali e attesa del salvataggio. La percentuale di download compare solo se Content-Length è disponibile; altrimenti vengono mostrati i byte ricevuti.
