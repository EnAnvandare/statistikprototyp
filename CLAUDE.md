# Bibliotekens datainsikter – kontext för Claude Code

Prototyp för folkbiblioteken i Malmö (bibliotekssystem Sierra) och Eslöv (Quria). Målet är ett verktyg där en biblioteksdirektör kan föra en dialog med statistiken. Användaren skriver på svenska.

## Kommandon
- `npm run dev` – bygger `dist/index.html`, serverar på http://localhost:5173, bygger om vid ändring.
- `npm run build` – bara bygget.
- `npm run fetch:kolada`, `npm run fetch:scb` – uppdaterar offentliga data i `data/`.
Inga npm-beroenden; Node 18+.

## Arkitektur
- `scripts/build.mjs` slår ihop `src/index.html` + `src/styles.css` + `src/llm-shim.js` + `src/app.js` och data från `data/` (JSON inlagt i stället för `__DATA__`) till **en enda HTML-fil**. Det måste förbli en fil: den publiceras som Claude-artefakt.
- `dist/index.html` har ingen `<!doctype>/<head>/<body>`; artefaktplattformen lägger till dem, och `server.mjs` gör samma sak lokalt (`wrap`).
- Externa skript bara från cdnjs med exakt version (d3 7.9.0). Typsnitt från Google Fonts. Inget annat externt.
- `src/app.js` är uppdelad i avsnitt: Tabs, Tooltip helper, Overview, Reach, Compare, Future, Reliability, AI: tools. Konstanter som styr perioder och grupper står överst (`LAST`, `YTD_M`, `AREAS`, `BANDS`, `NOTES`).
- AI-panelen: `TOOLS` (verktyg som modellen anropar; körs i webbläsaren), `RULES` (instruktioner till modellen, på engelska), `ask()` (samtalet). `sample` kommer från `window.claude.use("sample")` i Claude, annars från `window.__localSample()` i `llm-shim.js` som går via `server.mjs` till ett OpenAI-kompatibelt API (Berget).

## Principer som inte får brytas
- **Bara aggregerade data.** Aldrig uppgifter om enskilda låntagare i `data/` eller i verktygens svar. Grupper under 10 personer redovisas inte.
- **Siffror kommer från verktyg, inte från modellen.** Ny analys = nytt verktyg i `TOOLS` som räknar i kod.
- **Tillförlitlighet räknas i kod** (`assessReliability`, `assessChange`, `futureRating`), aldrig av modellen. Varje AI-svar slutar med `[[reliability:R|sv]] motivering`, som `renderAnswer()` ritar. Mönster mellan områden är som bäst "Indikation" och aldrig orsaker.
- **Exempeldata märks alltid** i gränssnittet (`chip ex`) tills den ersatts med riktiga exporter. Riktiga källor märks `chip real`.
- **Gränssnittet är på svenska**: svensk talformatering via `LOC`/`fmt`/`fmtPct`/`dec` (mellanslag som tusentalsavgränsare, decimalkomma, ` %`).
- Färger bara via CSS-variabler som har både ljus och mörk variant i `styles.css`.

## Kontrollera ändringar
- `npm run build` ska gå utan fel; öppna sidan och kolla alla fyra flikar i både ljust och mörkt läge och i smal bredd (~400 px).
- För AI-ändringar: ställ några frågor och kontrollera att siffrorna i svaret stämmer med verktygsanropen under "Så räknade jag", och att tillförlitlighetsraden kommer med.
