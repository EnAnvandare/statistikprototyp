// Lokal utvecklingsserver utan beroenden (kräver Node 18 eller senare).
//   npm run dev    → bygger, serverar på http://localhost:5173 och bygger om när du sparar
//   npm start      → bygger en gång och serverar
// Servern
//   1. serverar dist/index.html
//   2. vidarebefordrar AI-panelens anrop (POST /api/chat) till ett OpenAI-kompatibelt API, t.ex. Berget.
//      API-nyckeln stannar på servern och skickas aldrig till webbläsaren.
// Inställningar läses från .env (se .env.example).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./scripts/build.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// --- .env (enkel läsare: NAMN=värde per rad, # för kommentarer)
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const BASE = (process.env.LLM_BASE_URL || "https://api.berget.ai/v1").replace(/\/$/, "");
const KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "";
const PORT = Number(process.env.PORT || 5173);
const configured = Boolean(KEY && MODEL);

// --- bygg (och bevaka)
const rebuild = () => { try { build(); console.log(new Date().toLocaleTimeString("sv-SE"), "byggde dist/index.html"); } catch (e) { console.error("Bygget misslyckades:", e.message); } };
rebuild();
if (process.argv.includes("--watch")) {
  let t; const again = () => { clearTimeout(t); t = setTimeout(rebuild, 100); };
  for (const d of ["src", "data"]) fs.watch(path.join(ROOT, d), again);
}

// --- server
// dist/index.html saknar <!doctype>, <head> och <body>: Claude lägger till dem när sidan publiceras som artefakt.
// Lokalt lägger servern till samma skal, så att sidan beter sig likadant här som i Claude.
const wrap = (page) => `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`;

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const readBody = (req, limit = 2_000_000) => new Promise((ok, bad) => {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > limit) { bad(new Error("För stor förfrågan")); req.destroy(); } else chunks.push(c); });
  req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
  req.on("error", bad);
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return send(res, 200, wrap(fs.readFileSync(path.join(ROOT, "dist/index.html"), "utf8")), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { configured, model: MODEL || null });
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      if (!configured) return send(res, 503, { error: "Ingen AI-tjänst inställd. Fyll i LLM_API_KEY och LLM_MODEL i .env." });
      const { messages, tools } = JSON.parse(await readBody(req));
      if (!Array.isArray(messages)) return send(res, 400, { error: "messages saknas" });
      const upstream = await fetch(BASE + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
        body: JSON.stringify({
          model: MODEL,
          messages,
          ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });
      const text = await upstream.text();
      if (!upstream.ok) {
        console.error("AI-tjänsten svarade", upstream.status, text.slice(0, 500));
        return send(res, upstream.status, { error: `AI-tjänsten svarade ${upstream.status}` });
      }
      return send(res, 200, text);
    }
    send(res, 404, { error: "Hittades inte" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: String(e.message || e) });
  }
});

// Lyssnar bara på den egna datorn, så att API-nyckeln inte kan användas av andra i nätverket.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Öppna http://localhost:${PORT}`);
  console.log(configured ? `AI-panelen använder ${MODEL} via ${BASE}` : "AI-panelen är avstängd: fyll i LLM_API_KEY och LLM_MODEL i .env");
});
