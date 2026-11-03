# Build

Esegui i comandi dalla radice del repository. Usa `npm ci` con `package-lock.json`; non sostituirlo con un aggiornamento indiscriminato delle dipendenze.

## Web

Requisiti: Node.js 22, npm. `npm ci`, poi `npm run dev` per lo sviluppo. `npm test` esegue i test JavaScript e `npm run build` produce `dist/`. `npm run preview` serve localmente la build. Le variabili o credenziali inserite nel frontend diventano visibili: non inserire token del fornitore nel codice o in variabili Vite.

## Android / Android TV

Requisiti:

- Node.js 22 e npm; Python 3.12 per lo script di release.
- JDK **17**, con `JAVA_HOME` configurato.
- Android SDK Platform **34**, Build Tools **34.0.0** e Platform Tools.
- `ANDROID_HOME` (oppure `ANDROID_SDK_ROOT`) verso l'SDK.
- Connessione per il primo download Gradle/Maven e accettazione delle licenze SDK.

Installa i pacchetti con Android Studio SDK Manager, oppure con gli strumenti ufficiali:

```sh
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
sdkmanager --licenses
npm ci
npm run android:sync
```

`android:sync` ricostruisce la UI e aggiorna gli asset Capacitor. Eseguilo dopo ogni modifica al frontend. Non copiare manualmente file in `android/app/src/main/assets/public`.

Debug (chiave di sviluppo, **non compatibile** con la firma release distribuita):

```sh
cd android
./gradlew :app:assembleDebug
```

Su Windows usa `gradlew.bat :app:assembleDebug`. Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

Release firmata:

```sh
npm run android:release
```

Lo script `scripts/build_android.py` verifica prima la presenza della chiave, esegue build web, sync, `assembleRelease`, allineamento, firma e verifica. Output: `artifacts/android/TucaTV-0.9.1.apk`. Vedi [SIGNING.md](SIGNING.md) per i percorsi predefiniti e quelli personalizzati. Non viene generata automaticamente una nuova chiave.

Build unsigned manuale, per CI o firma separata:

```sh
npm run android:sync
cd android
./gradlew :app:assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`. Non è ancora un APK installabile firmato. Il progetto usa applicationId `it.stefaniscion.onda`: non cambiarlo per gli aggiornamenti della stessa app. Min SDK 22, target/compile SDK 34; ARM64 e ARMv7.

## Desktop da sorgente

Requisiti: Python **3.12**, Node.js 22, VLC/libVLC della stessa architettura di Python. Crea un ambiente virtuale e installa `desktop/requirements.txt` (versioni fissate):

```sh
python -m venv .venv
# Linux:
. .venv/bin/activate
# Windows PowerShell, in alternativa:
# .\.venv\Scripts\Activate.ps1
python -m pip install -r desktop/requirements.txt
npm ci
npm run build
python scripts/prepare_desktop.py
python desktop/main.py
```

Su Linux installa libVLC, plugin VLC e le librerie Qt/XCB richieste dalla distribuzione. Il backend video usa X11/XWayland. Non eseguire come root e non disabilitare la sandbox Chromium.

Su Windows x64 installa VLC x64 dalla distribuzione ufficiale; se necessario aggiungi la sua directory al `PATH` prima di avviare Python. La disponibilità di libVLC va verificata sul PC target. Non è fornito un sistema di cross-compilazione Windows da Linux.

### Pacchetto Linux Debian

Su Ubuntu 24.04 x64 (o ambiente compatibile): installa le dipendenze native, `python3-venv`, `dpkg-dev`, quindi:

```sh
bash desktop/build-linux.sh
```

Output in `desktop-output/`. Lo script ricrea la build web e usa PyInstaller. Il `.deb` richiede glibc >= 2.39 e risolve VLC tramite le dipendenze di sistema; non è universale per tutte le distribuzioni.

### Cartella Windows con PyInstaller

Esegui su Windows x64, nell'ambiente virtuale con le dipendenze installate e dopo `npm run build`:

```powershell
python -m PyInstaller --noconfirm --clean --name TucaTV --windowed --add-data "dist;web" --distpath desktop-output --workpath desktop-work --specpath desktop-work desktop/main.py
```

Consegna tutta la cartella `desktop-output/TucaTV`, non solo l'EXE. Questo comando **non include una distribuzione VLC portabile**: serve VLC installato, oppure un processo separato di inclusione dei binari/licenze e verifica. L'eseguibile non è firmato. Il pacchetto Windows 0.8 distribuito in precedenza includeva runtime aggiuntivi: non è riprodotto da questo solo comando.

## Test

```sh
npm test
npm run build
python -m unittest discover -s desktop/tests -p 'test_network.py'
# Con PySide6 e VLC disponibili:
python -m unittest discover -s desktop/tests
```

Test Java del trasferimento playlist (JDK 17):

```sh
mkdir -p artifacts/java-tests
javac -d artifacts/java-tests android/app/src/main/java/it/stefaniscion/onda/PlaylistTransfer.java android/tests/PlaylistTransferTest.java
java -Xmx16m -cp artifacts/java-tests it.stefaniscion.onda.PlaylistTransferTest
```

Prova sempre su hardware: rotazione/notch, focus D-pad, ritorno dal player, audio, PiP, stream del fornitore, import grandi e modalità offline. Una build riuscita non prova la compatibilità dei codec o del dispositivo.
