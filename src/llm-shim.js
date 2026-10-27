/* ---------- Lokal AI-koppling ----------
   Används bara när sidan INTE körs som Claude-artefakt (window.claude saknas).
   Ger samma gränssnitt som Claudes sample(): sample(meddelanden, {signal, onText, tools}) och sample.limits(),
   så att resten av app.js inte behöver veta vilken AI som svarar.
   Anropen går till den lokala servern (server.mjs), som håller API-nyckeln och skickar vidare till ett
   OpenAI-kompatibelt API, till exempel Berget (https://api.berget.ai/v1).
   Verktygen (query_library_activity m.fl.) körs här i webbläsaren, precis som i Claude-versionen. */
window.__localSample = async function () {
  if (location.protocol === "file:") return null;
  let health;
  try {
    const r = await fetch("api/health");
    if (!r.ok) return null;
    health = await r.json();
  } catch { return null; }
  if (!health.configured) return null;

  const MAX_ROUNDS = 8; // max antal varv med verktygsanrop innan modellen måste svara
  const fail = (code, message, text) => Object.assign({ code, message }, text ? { text } : {});

  async function sample(input, opts = {}) {
    const turns = (typeof input === "string" ? [{ role: "user", content: input }] : input)
      .map((m) => ({ role: m.role, content: String(m.content) }));
    // Slå ihop turer i följd med samma roll; vissa modeller kräver att user/assistant växlar.
    const messages = [];
    for (const m of turns) {
      const last = messages[messages.length - 1];
      if (last && last.role === m.role) last.content += "\n\n" + m.content;
      else messages.push({ ...m });
    }
    const tools = opts.tools || [];
    const toolDefs = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema || { type: "object", properties: {} } },
    }));

    let text = "", truncated = false;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (opts.signal?.aborted) throw fail("cancelled", "Avbruten", text || undefined);
      const lastRound = round === MAX_ROUNDS - 1;
      let res;
      try {
        res = await fetch("api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: opts.signal,
          body: JSON.stringify({ messages, tools: toolDefs.length && !lastRound ? toolDefs : undefined }),
        });
      } catch (e) {
        if (e.name === "AbortError") throw fail("cancelled", "Avbruten", text || undefined);
        throw fail("upstream_error", String(e), text || undefined);
      }
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).error; } catch {}
        const code = res.status === 429 ? "rate_limited" : res.status === 401 || res.status === 403 ? "not_granted" : "upstream_error";
        throw fail(code, detail || "HTTP " + res.status, text || undefined);
      }
      const data = await res.json();
      const choice = data.choices?.[0] || {};
      const msg = choice.message || {};
      if (msg.content) {
        const delta = (text ? "\n\n" : "") + msg.content;
        text += delta;
        try { opts.onText?.({ text, delta }); } catch (e) { console.error(e); }
      }
      const calls = msg.tool_calls || [];
      if (!calls.length) { truncated = choice.finish_reason === "length"; break; }

      messages.push({ role: "assistant", content: msg.content || null, tool_calls: calls });
      for (const c of calls) {
        const tool = tools.find((t) => t.name === c.function?.name);
        let out;
        try {
          if (!tool) throw new Error("Okänt verktyg: " + c.function?.name);
          const args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
          const r = await tool.execute(args, { signal: opts.signal });
          out = typeof r === "string" ? r : JSON.stringify(r);
        } catch (e) {
          out = "Error: " + (e?.message || e);
        }
        messages.push({ role: "tool", tool_call_id: c.id, content: out.slice(0, 32000) });
      }
    }
    if (!text.trim()) throw fail("empty_completion", "Modellen gav inget svar");
    return { text, truncated, modelTierApplied: "default", modelApplied: health.model };
  }
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 32 } });
  sample.json = async (input, opts) => {
    const { text } = await sample(input, opts);
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    try { return JSON.parse(m ? m[0] : text); } catch { throw fail("invalid_json", "Svaret var inte JSON", text); }
  };
  return sample;
};
