# Sicurezza

Non pubblicare playlist, URL con credenziali, keystore o password nelle issue. Segnala vulnerabilità privatamente al manutentore: stefaniscion@gmail.com. Non è promesso un tempo di risposta o un programma di ricompense.

Fornisci versione, piattaforma, impatto e riproduzione con dati sintetici. Rimuovi token dai log e dagli screenshot. In caso di perdita della chiave di firma o pubblicazione accidentale di una playlist, cancellare il file dall'ultimo commit non lo elimina dalla cronologia: revoca le credenziali interessate e valuta il recupero con il manutentore.

L'app consente HTTP per sorgenti native IPTV fornite dall'utente: tali connessioni non sono cifrate. Il browser mantiene le proprie restrizioni CORS/HTTPS. Nessuna chiave viene inclusa nel codice distribuito; `signing/` è soltanto nella consegna privata locale.

Non disabilitare certificati TLS o sandbox Chromium per far funzionare uno stream. Usa contenuti e sorgenti per cui disponi delle autorizzazioni necessarie.
