# Cronologia e rilascio

## Cronologia ricostruita

I commit originali del progetto avevano messaggi generici e includevano build e metadati di hosting. Questo repository è una nuova cronologia curata: un commit per versione disponibile, attribuito su richiesta a **Stefano Di Pasquale <stefaniscion@gmail.com>** come autore e committer. Le date dei commit di versione derivano dallo snapshot sorgente selezionato. Le correzioni intermedie della stessa versione sono accorpate nello snapshot finale.

I tag annotati `v0.1.0`, `v0.1.1`, `v0.2.0` … `v0.9.1` identificano tali snapshot. Non attestano una firma crittografica dell'autore né una ricompilazione odierna di tutte le vecchie release. I commit sorgente e quelli ricostruiti sono mappati in `version-history.json`.

Da tutti gli snapshot sono esclusi output `dist`, metadati `.openai`, workflow preesistenti e test Android segnaposto del template. È applicato un `.gitignore` comune per impedire l'aggiunta accidentale di chiavi e output. Il codice applicativo delle versioni è conservato. Il commit successivo all'ultimo tag prepara documentazione, strumenti e CI: non rappresenta una nuova release dell'app.

## Nuova versione

1. Crea un branch con scopo circoscritto e aggiungi test per le regressioni sostanziali.
2. Aggiorna `package.json`, la voce radice di `package-lock.json`, `versionCode`/`versionName` in `android/app/build.gradle` e la versione visualizzata in `src/App.svelte`. Il pacchetto Debian legge `package.json`.
3. Aggiorna `CHANGELOG.md` e le limitazioni note.
4. Esegui test, build web, sync e build Android. Prova le piattaforme target su hardware.
5. Firma con la chiave esistente e verifica fingerprint, applicationId e versionCode crescente.
6. Crea un commit descrittivo e un tag annotato, ad esempio `git tag -a v0.9.2 -m "TucaTV 0.9.2"`.
7. Pubblica solo gli installer e i sorgenti destinati alla distribuzione. Mai `signing/`, playlist private o l'archivio originale di consegna.

La configurazione autore locale è inclusa nella copia Git consegnata; un nuovo clone deve impostarla nuovamente:

```sh
git config user.name "Stefano Di Pasquale"
git config user.email "stefaniscion@gmail.com"
```

## Caricamento su un servizio Git

Il repository consegnato non ha remoti né credenziali. Crea un repository vuoto sul servizio scelto, poi:

```sh
git remote add origin URL_DEL_TUO_REPOSITORY
git push -u origin main
git push origin --tags
```

Per consegnare soltanto i file tracciati: `git archive --format=zip --output=../TucaTV-source.zip HEAD`. Per trasferire la cronologia senza chiavi: `git bundle create ../TucaTV-history.bundle --all`.
