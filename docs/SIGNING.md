# Firma Android

La release 0.9.0 ha introdotto una nuova chiave. La 0.9.1 usa la stessa firma e può aggiornare la 0.9.0 senza disinstallazione. Gli APK precedenti hanno una firma diversa.

## Consegna privata

Nell'archivio privato trovi:

- `signing/tucatv-release.p12`: keystore PKCS12.
- `signing/password.txt`: password del keystore; alias `tucatv`.

Questi file sono esclusi da `.gitignore` e non sono presenti nei commit o nei tag. Un clone Git non li contiene. Conservali in un archivio privato con backup; non allegarli a release pubbliche, issue, log o CI. `.gitignore` non cifra un file e non protegge da `git add -f` o dalla condivisione dello ZIP completo.

Fingerprint SHA-256 del certificato pubblico:

```text
fc2a46f8eba925c2c65e38affc057d8e31b0bb1f38cdc2542ea1eb17190ec264
```

## Build

`npm run android:release` usa i percorsi sopra. In alternativa imposta `TUCATV_KEYSTORE`, `TUCATV_KEYSTORE_PASSWORD_FILE` e, facoltativamente, `TUCATV_KEY_ALIAS` (default `tucatv`). La password viene passata ad apksigner tramite file, non scritta nei sorgenti o negli argomenti in chiaro.

Se manca la chiave lo script termina senza crearne un'altra. La rotazione della firma non è automatica: perdere la chiave può impedire gli aggiornamenti delle installazioni esistenti.

Verifica il repository prima del push:

```sh
git status --short
git check-ignore signing/tucatv-release.p12 signing/password.txt
git ls-files signing
```

L'ultimo comando non deve stampare file. Per controllare un APK usa `apksigner verify --verbose --print-certs percorso.apk` dal Build Tools SDK.
