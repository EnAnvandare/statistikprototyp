# Bibliotekens datainsikter – kontext för Claude Code

Prototyp för folkbiblioteken i Malmö (bibliotekssystem Sierra) och Eslöv (Quria). Målet är ett verktyg där en biblioteksdirektör kan föra en dialog med statistiken. Användaren skriver på svenska.

## Kommandon
- `npm run dev` – bygger `dist/index.html`, serverar på http://localhost:5173, bygger om vid ändring.
- `npm run build` – bara bygget.
- `npm run fetch:kolada`, `npm run fetch:scb` – uppdaterar offentliga data i `data/`.
- `node scripts/fraga.mjs …` – kör AI-panelens verktyg från kommandoraden (se nedan).
Inga npm-beroenden; Node 18+. d3 för Node ligger i `vendor/` (samma version som sidan laddar från cdnjs).

## Frågor om statistiken
När användaren frågar om bibliotekens siffror (lån, besök, räckvidd, Kolada, prognoser): använd skillen `statistik` (`.claude/skills/statistik/SKILL.md`). Kortfattat:
- Ta fram alla siffror med `node scripts/fraga.mjs <verktyg> nyckel=värde …`. Läs inte `data/*.csv` för att räkna själv.
- Kör `check_reliability` för huvudresultatet och avsluta svaret med tillförlitlighetsbedömningen.
- `node scripts/fraga.mjs verktyg` listar verktygen, `node scripts/fraga.mjs regler` visar hela regelverket.

## Arkitektur
- `scripts/build.mjs` slår ihop `src/index.html` + `src/styles.css` + `src/llm-shim.js` + `src/core.js` + `src/app.js` och data från `data/` (JSON inlagt i stället för `__DATA__` i core.js) till **en enda HTML-fil**. Det måste förbli en fil: den publiceras som Claude-artefakt.
- `dist/index.html` har ingen `<!doctype>/<head>/<body>`; artefaktplattformen lägger till dem, och `server.mjs` gör samma sak lokalt (`wrap`).
- Externa skript bara från cdnjs med exakt version (d3 7.9.0). Typsnitt från Google Fonts. Inget annat externt.
- `src/core.js` = allt som räknar: data, formatering, tillförlitlighetsregler, framtidsberäkningar, `TOOLS` (AI-verktygen) och `RULES` (instruktioner till modellen, på engelska). **Får inte röra `document`/`window`**: den körs även i Node av `scripts/core-node.mjs`, så att `fraga.mjs` och sidan räknar med samma kod. Konstanter som styr perioder och grupper står överst (`LAST`, `YTD_M`, `AREAS`, `BANDS`, `NOTES`).
- `src/app.js` = gränssnittet: flikar, diagram, tabeller och AI-panelens samtal (`ask()`).
- AI-panelen: `sample` kommer från `window.claude.use("sample")` i Claude, annars från `window.__localSample()` i `llm-shim.js` som går via `server.mjs` till ett OpenAI-kompatibelt API (Berget).

## Principer som inte får brytas
- **Bara aggregerade data.** Aldrig uppgifter om enskilda låntagare i `data/` eller i verktygens svar. Grupper under 10 personer redovisas inte.
- **Siffror kommer från verktyg, inte från modellen.** Ny analys = nytt verktyg i `TOOLS` i `core.js` som räknar i kod; då finns det automatiskt både i sidan och i `fraga.mjs`.
- **Tillförlitlighet räknas i kod** (`assessReliability`, `assessChange`, `futureRating`), aldrig av modellen. Varje AI-svar slutar med `[[reliability:R|sv]] motivering`, som `renderAnswer()` ritar. Mönster mellan områden är som bäst "Indikation" och aldrig orsaker.
- **Exempeldata märks alltid** i gränssnittet (`chip ex`) tills den ersatts med riktiga exporter. Riktiga källor märks `chip real`.
- **Gränssnittet är på svenska**: svensk talformatering via `LOC`/`fmt`/`fmtPct`/`dec` (mellanslag som tusentalsavgränsare, decimalkomma, ` %`).
- Färger bara via CSS-variabler som har både ljus och mörk variant i `styles.css`.

## Kontrollera ändringar
- `npm run build` ska gå utan fel; öppna sidan och kolla alla fyra flikar i både ljust och mörkt läge och i smal bredd (~400 px).
- Efter ändringar i `core.js`: kör några `node scripts/fraga.mjs`-anrop och jämför med sidan.
- För AI-ändringar: ställ några frågor och kontrollera att siffrorna i svaret stämmer med verktygsanropen under "Så räknade jag", och att tillförlitlighetsraden kommer med.
