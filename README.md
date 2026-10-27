# Bibliotekens datainsikter – prototyp

En dashboard för biblioteksstatistik i Malmö (och Eslöv) med en AI-panel som svarar på följdfrågor genom att fråga datan, visar hur den räknat och anger hur tillförlitligt svaret är.

Flikar: **Aktivitet**, **Räckvidd per område**, **Jämför kommuner** och **Framtid**.

> **Exempeldata.** Allt per bibliotek, område och digital användning är påhittat (men kalibrerat mot Malmös totaler i Kolada). Riktiga data i dag: Kolada-nyckeltalen och SCB:s befolkningsframskrivning.

## Kom igång

Kräver [Node.js](https://nodejs.org) 18 eller senare. Inga andra beroenden behöver installeras.

```bash
npm run dev
```

Öppna <http://localhost:5173>. Sidan byggs om varje gång du sparar en fil i `src/` eller `data/` – ladda om webbläsaren för att se ändringen.

### Slå på AI-panelen lokalt

Utanför Claude behöver AI-panelen en egen AI-tjänst. Allt som talar ett OpenAI-kompatibelt API fungerar, till exempel Berget.

1. Kopiera `.env.example` till `.env`.
2. Fyll i `LLM_API_KEY` (från Bergets konsol) och välj `LLM_MODEL`.
3. Starta om `npm run dev`.

Nyckeln ligger bara i `.env` på din dator. Den lokala servern skickar AI-anropen vidare och lämnar aldrig ut nyckeln till webbläsaren. Servern lyssnar bara på den egna datorn.

Utan `.env` fungerar hela dashboarden, bara AI-panelen är avstängd.

## Projektstruktur

```
src/
  index.html          sidans struktur (flikar, kort, AI-panel)
  styles.css          utseende, färger för ljust och mörkt läge
  app.js              all logik: diagram, tabeller, tillförlitlighetsregler, AI-verktyg och AI-instruktioner
  llm-shim.js         lokal AI-koppling (används bara utanför Claude)
data/                 all data som sidan visar (CSV/JSON) – byt ut mot riktiga exporter här
scripts/
  build.mjs           bygger dist/index.html av src/ + data/
  fetch-kolada.mjs    hämtar nyckeltal från Kolada → data/kolada.csv
  fetch-scb-projection.mjs  hämtar SCB:s befolkningsframskrivning → data/scb_proj.json
  generate_example_data.py  genererar exempeldatan (bara för prototypen)
server.mjs            lokal server: bygger, serverar och vidarebefordrar AI-anrop
dist/index.html       färdig sida (skapas av bygget, checkas inte in)
```

## Så hänger det ihop

1. **Bygget** läser filerna i `data/`, packar dem som ett JSON-objekt och lägger in det tillsammans med CSS och JavaScript i **en enda HTML-fil**, `dist/index.html`. En fil är ett krav för att sidan ska kunna publiceras som Claude-artefakt, och gör den lätt att dela.
2. **Diagrammen** ritas med d3 (laddas från cdnjs, version 7.9.0).
3. **AI-panelen** skickar frågan tillsammans med en lista *verktyg* (funktioner i `app.js`, avsnittet `AI: tools over the tables`). Modellen väljer vilka verktyg den vill köra, verktygen räknar på datan i webbläsaren, och modellen skriver svaret utifrån resultatet. Modellen ser alltså bara de aggregerade tabellerna.
4. **Tillförlitligheten** (Tillförlitligt / Indikation / Osäkert) räknas fram i kod med fasta regler (`assessReliability`, `assessChange`, `futureRating`), inte av AI:n. Modellen måste anropa `check_reliability` och avsluta varje svar med en rad i formatet `[[reliability:R|sv]] motivering`, som sidan ritar som en färgad etikett.
5. **Två AI-vägar:**
   - Publicerad som Claude-artefakt: Claudes egen AI (`window.claude.use("sample")`).
   - Lokalt: `llm-shim.js` erbjuder samma gränssnitt och går via `server.mjs` till Berget eller annan OpenAI-kompatibel tjänst.

## Vanliga uppgifter

### Byta exempeldata mot riktiga exporter
Ersätt filerna i `data/` och behåll kolumnnamnen:

| Fil | Kolumner | Innehåll |
|---|---|---|
| `branch_month.csv` | month, branch, stadsomrade, loans_physical, loans_children, visits, events, event_participants, open_hours | En rad per bibliotek och månad (`2026-03`). Lån inklusive omlån. |
| `digital_month.csv` | month, eloans_ebook, eloans_audiobook, web_sessions, catalogue_searches | En rad per månad för hela kommunen. |
| `active_borrowers.csv` | year, stadsomrade, age_band, active_borrowers | Låntagare med minst ett lån under året. Grupper under 10 ska tas bort före export. |
| `area_population_example.csv` | stadsomrade, age_band, population | Invånare per område och åldersgrupp (ersätt med Malmös områdesstatistik). |
| `kolada.csv` | kpi_id, kpi, kommun_id, kommun, year, value | Hämtas med `npm run fetch:kolada`. |
| `scb_proj.json` | – | Hämtas med `npm run fetch:scb`. |

Åldersgrupperna i reach-vyn är `0-12`, `13-19`, `20-64`, `65+`, och stadsområdena `Innerstaden`, `Norr`, `Öster`, `Söder`, `Väster`. Ändras de behöver konstanterna `AREAS` och `BANDS` överst i `app.js` ändras också. Anteckningar om händelser (stängningar, ändrade öppettider) ligger i `NOTES` överst i `app.js`.

Om 2026 inte längre är innevarande år: konstanterna `LAST` och `YTD_M` i `app.js` styr vilken period som jämförs.

### Uppdatera offentliga data
```bash
npm run fetch:kolada
npm run fetch:scb
```
Skripten kunde inte köras i miljön där de skrevs (API:erna var inte nåbara därifrån), men tolkningen av svaren är testad. Granska ändringarna med `git diff data/` första gången.

### Lägga till ett AI-verktyg
Lägg till ett objekt i listan `TOOLS` i `app.js` med `name`, `description` (på engelska, för modellen), `inputSchema` (JSON Schema) och `execute(input)` som returnerar små, aggregerade data. Nämn verktyget i `RULES` om modellen behöver veta när det ska användas.

### Byta AI-modell
Ändra `LLM_MODEL` i `.env`. Förslag hos Berget: `moonshotai/Kimi-K3` (bäst på verktygsanrop i flera steg) eller `google/gemma-4-31B-it` (billigare, bra svenska). Testa med samma frågor och jämför – särskilt att siffrorna stämmer och att tillförlitlighetsraden kommer med.

### Publicera som Claude-artefakt igen
Kör `npm run build` och ladda upp `dist/index.html` i ett samtal med Claude, och be om att uppdatera artefakten "Malmö biblioteksinsikter". Sidan behöver behörigheten att fråga Claude (`sample`).

## Dataskydd
- Bara aggregerade data: inga uppgifter om enskilda låntagare får läggas i `data/`.
- Grupper med färre än 10 personer ska tas bort redan vid exporten från bibliotekssystemet.
- AI-tjänsten får bara se de aggregerade tabellerna som verktygen returnerar, plus personalens frågor. Påminn användarna om att inte skriva personuppgifter i frågorna.
- Den lokala servern har ingen inloggning och är byggd för utveckling på den egna datorn, inte för drift.

## Kända begränsningar
- Den lokala AI-kopplingen är testad mot ett låtsas-API i OpenAI-format, inte mot Bergets riktiga modeller.
- Svaren visas först när de är klara (ingen strömning lokalt).
- Fetch-skripten är inte körda mot de riktiga API:erna.
- Framtidsvyn använder exempelräckvidd per åldersgrupp (`REACH0` i `app.js`).

Projektplanen med alla uppgifter finns som dokument i Claude: "Projektplan: Bibliotekens datainsikter".
