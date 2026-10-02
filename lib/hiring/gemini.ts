import "server-only";

// Gemini over plain REST: one dependency fewer, and the request is easy to audit.
// PRIVACY: use a key from a project with billing enabled. The free AI Studio tier may use
// prompts to improve Google's models; the paid API does not. Callers must only pass
// anonymised CV content (see pii.ts), never names, emails or phone numbers.

type Schema = Record<string, unknown>;

export async function geminiJson<T>(opts: { system: string; prompt: string; schema: Schema }): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY must be set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: opts.schema },
  });

  const started = Date.now();
  let lastError = "";
  let wait = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) {
      // Stay inside the 60s function limit: give up rather than start a wait we can't finish.
      if (Date.now() - started + wait > 48_000) break;
      await new Promise((r) => setTimeout(r, wait));
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
    });
    if (res.status === 429 || res.status >= 500) {
      const err = await res.json().catch(() => null);
      lastError = `Gemini ${res.status}: ${String(err?.error?.message ?? "rate limited or unavailable").slice(0, 240)}`;
      // Honour Google's own "retry in Ns" hint (header or error details), capped; otherwise back off.
      const hinted = Number(res.headers.get("retry-after")) ||
        parseFloat(String(JSON.stringify(err?.error?.details ?? "").match(/"retryDelay":"([\d.]+)s"/)?.[1] ?? "")) || 0;
      wait = Math.min(15_000, Math.max(hinted * 1000, 2000 * 2 ** attempt));
      continue;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message ?? "request failed"}`);
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      lastError = `Gemini returned no text (${data?.candidates?.[0]?.finishReason ?? "unknown reason"})`;
      wait = 1500;
      continue;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      lastError = "Gemini returned invalid JSON";
      wait = 1500;
    }
  }
  throw new Error(lastError || "Gemini failed");
}

export const S = {
  string: { type: "STRING" },
  int: { type: "INTEGER" },
  obj: (properties: Record<string, Schema>): Schema => ({
    type: "OBJECT",
    properties,
    required: Object.keys(properties),
  }),
  arr: (items: Schema): Schema => ({ type: "ARRAY", items }),
};
