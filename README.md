# Taxi Teori · webbversion 2.4.0

Webbappen för övning inför svensk taxiförarlegitimation, byggd med React och Vite. Ingen inloggning och ingen reklam. Framsteg sparas lokalt i webbläsaren.

## Nytt i denna version

- Miniprov med tio lagstiftningsfrågor, fem från vardera lagstiftningsområdet. Facit efter varje svar, sparat pass och nästa omgång direkt från resultatet.
- 40 egna, källbelagda textfrågor: 20 om på-/avstigning och stoppregler, 6 om svårare dygnsvila, 10 om tariffer och 4 om särskild utrustning för taxifordon.
- 200 godkända innehållsversioner från granskningsomgång 1–20. Omgång 21 är fortfarande väntande. Ursprungliga frågefiler bevaras; godkända versioner läggs på vid sammanställning.
- Miniprovet använder 119 godkända lagstiftningsfrågor och de 40 nytillskotten. Övriga delar av appen innehåller fortfarande äldre ogranskat material. Totalt 500 frågor.
- Förklaringar med länkar till officiella källor. Ändrade frågor visas på svenska tills deras engelska översättningar har uppdaterats.
- Export och återställning av lokala framsteg från version 2.3, samt befintlig statistik, mörkt/ljust läge och tillgänglighetsinställningar.
- 68 automatiska tester, inklusive urval, återupptagning, säkerhetskopiering och rullande vilotidsberäkningar.

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

Kvarvarande frågor, facit och bildrättigheter behöver granskas. Ett innehållsgodkännande innebär inte att rättigheter är klarerade. Skärmläsare och systemtext behöver provas på riktiga telefoner. Bildfrågorna har ännu generella bildbeskrivningar. Tidigare framsteg bevaras även när en godkänd frågeversion ersätter den gamla; historisk behärskning är därför inte bevis på att den nya versionen har övats. Innehållet är fortfarande under utveckling inför kommersiell publicering.
