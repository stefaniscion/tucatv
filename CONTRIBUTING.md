# Contribuire

Leggi README, BUILD e ARCHITECTURE. Mantieni il progetto client-side e la compatibilità con telecomando, touch e tastiera. Non aggiungere proxy pubblici, credenziali incorporate o disabilitazioni della sandbox.

Usa branch brevi e commit con scopo preciso (`fix:`, `feat:`, `docs:`, `test:`, `chore:`). Descrivi problema, comportamento finale, verifiche e limiti nella pull request. Non includere modifiche di formattazione estese in una correzione funzionale.

Prima di proporre modifiche: `npm ci`, `npm test`, `npm run build`, `git diff --check`. Per modifiche native esegui anche la build Android; per il desktop i test Python e una prova sulla piattaforma target. I test automatici non sostituiscono audio, codec, PiP e focus reali.

I file generati, gli installer, le chiavi e le playlist personali non entrano in Git. Usa fixture sintetiche con URL di esempio. Le versioni storiche sono congelate nei tag; non riscriverne i contenuti.
