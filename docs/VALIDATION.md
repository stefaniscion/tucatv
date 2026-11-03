# Verifiche della consegna

Verifiche eseguite il 3 novembre 2026 sulla copia del repository preparata:

- Installazione pulita da lockfile con npm ci (cache locale, script installazione disabilitati).
- 23 test JavaScript superati; build Vite riuscita con Node 24.22.1.
- 5 test Python di rete desktop superati; compilazione sintattica degli script Python e preparazione asset desktop.
- Build Android release unsigned completa riuscita con JDK 17, SDK 34 e Gradle 8.2.1, usando dipendenze già disponibili localmente.
- Controllo di autore/committer e tag, integrità Git, assenza delle chiavi dalla cronologia, clone pulito e gitignore della cartella signing.

La CI è configurata su Node 22 ma non è stata eseguita su GitHub in questa consegna. Lo script di firma è stato controllato sintatticamente; la build nativa è stata verificata con Gradle, non tramite un'esecuzione completa dello script su tutte le piattaforme. Gli installer desktop non sono stati ricostruiti. Non sono state effettuate prove hardware Android/TV/Windows/Linux.

Avvisi rimasti: Vite segnala un bundle JavaScript superiore a 500 kB; npm segnala dipendenze transitive deprecate (tar/glob). Le dipendenze applicative sono conservate dal lockfile della versione, non aggiornate indiscriminatamente durante la ricostruzione. Non è stato eseguito un audit completo delle vulnerabilità o delle licenze. Prima di una release pubblica, valutare gli aggiornamenti tramite i test e npm audit.
