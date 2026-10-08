# Taxi Teori · webbversion 2.2.0

Webbappen för övning inför svensk taxiförarlegitimation, byggd med React och Vite. Ingen inloggning och ingen reklam. Framsteg sparas lokalt i webbläsaren.

## Nytt i denna version

- Ny mobillayout med klassisk gul färgpalett, ljust och mörkt läge.
- Kunskapsfördelning, statistik, provberedskap och de senaste tio testresultaten.
- Delprov, sparade pass, repetition, bokmärken, bildzoom och minneskort.
- Textstorlek upp till 200 procent, förbättrad kontrast och tangentbordsfokus.
- Frågebank, webbens bildresurser och 52 automatiska tester.

Detta repo innehåller webbens källkod och resurser. Android- och iOS-projekt, installationsfiler, privata inställningar och användares studieresultat ingår inte. Gemensamma JavaScript-hjälpare och de beroenden som webbbygget importerar finns kvar.

## Kör lokalt

Använd Node.js 24:

```sh
npm ci
npm test
npm run dev
```

Bygg med `npm run build`. Resultatet hamnar i `dist/`, med basadressen `/taxi-teoriapp/` för GitHub Pages. Inga miljövariabler krävs för lokal studieanvändning. Äldre Supabase-migrering är valfri och använder miljövariabler, inga incheckade nycklar.

## Publicering

Ändringar på `main` kör tester, bygger webbappen och publicerar till GitHub Pages via `.github/workflows/deploy.yml`.

## Kvar inför lansering

Frågor, facit och bildrättigheter behöver granskas. Skärmläsare och systemtext behöver provas på riktiga telefoner. Bildfrågorna har ännu generella bildbeskrivningar. Innehållet är fortfarande under utveckling inför kommersiell publicering.
