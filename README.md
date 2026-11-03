# TucaTV

Player IPTV **client-side** per playlist M3U, con interfaccia Svelte 5 / Tailwind CSS 4 condivisa fra browser, Android e desktop Windows/Linux. Tema nero/arancione, catalogo Live/VOD e navigazione TV-first.

Versione applicativa: **0.9.1**. Questo repository contiene i sorgenti, non playlist o abbonamenti IPTV.

## Funzioni

- Importazione M3U da file o URL, con avanzamento e limite di 256 MiB.
- Aggiornamento delle playlist da URL all'avvio, conservando la copia precedente se la rete fallisce.
- Categorie, ricerca, preferiti, categorie nascondibili e ultimo canale aperto per playlist.
- Guida XMLTV, se disponibile; il mancato caricamento dell'EPG non impedisce lo streaming.
- Android: player libVLC, servizio di riproduzione, notifica, ritorno al player e Picture-in-Picture quando supportato.
- Desktop: host Python/PySide6 con libVLC e interfaccia locale, senza server HTTP.

## Avvio rapido web

Prerequisiti: Node.js 22 e npm, Git.

```sh
npm ci
npm run dev
```

Apri l'indirizzo mostrato da Vite. Per la produzione:

```sh
npm test
npm run build
npm run preview
```

Pubblica `dist/` su un hosting statico. Nessun backend dell'app è richiesto. La variante browser rimane soggetta a HTTPS/mixed content, CORS e codec supportati: non equivale al player VLC nativo.

## Build e documentazione

- [Guida di build web, Android, Windows e Linux](docs/BUILD.md)
- [Architettura, dati e limiti](docs/ARCHITECTURE.md)
- [Firma APK e gestione della chiave](docs/SIGNING.md)
- [Versioni e rilascio](docs/RELEASING.md)
- [Cronologia delle funzionalità](CHANGELOG.md)
- [Contribuire e verificare le modifiche](CONTRIBUTING.md)
- [Sicurezza e segnalazioni](SECURITY.md)
- [Dipendenze e licenze](THIRD_PARTY_NOTICES.md)

## Stato delle piattaforme

| Piattaforma | Implementazione | Limiti di verifica |
| --- | --- | --- |
| Browser | Svelte + video HTML/HLS.js | Solo sorgenti compatibili con il browser |
| Android / Android TV | Capacitor 6 + libVLC 3.6.0, ARM64/ARMv7 | Build verificata; notch, telecomando, audio e PiP richiedono prove hardware |
| Windows x64 | Python/PySide6 + VLC | Host presente; build e avvio vanno verificati su Windows |
| Linux x64 | Python/PySide6 + VLC, pacchetto Debian | Rendering X11/XWayland; provare sulla distribuzione target |
| iOS, Tizen, webOS | Non implementati | Nessun pacchetto disponibile |

Il riconoscimento Live/VOD è euristico: i casi ambigui restano Live. Un genere come “Cinema” non indica da solo un VOD. Il limite di 256 MiB non garantisce che ogni dispositivo abbia memoria sufficiente per qualsiasi catalogo.

## Repository e chiave

I tag `v0.1.0`–`v0.9.1` ricostruiscono le versioni disponibili; vedi [provenienza](docs/RELEASING.md). Autore e committer: Stefano Di Pasquale <stefaniscion@gmail.com>.

L'archivio privato di consegna include `.git/` e `signing/`. **La cartella `signing/` non è tracciata da Git** e non viene trasferita da clone/push. Contiene materiale riservato: non pubblicare l'archivio ZIP di consegna. Per condividere i sorgenti usa Git oppure `git archive`.

Non è stata scelta una licenza open source per il codice originale. Vedi [LICENSE](LICENSE); i componenti di terze parti conservano le proprie licenze.
