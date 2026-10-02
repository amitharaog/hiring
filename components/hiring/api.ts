export async function call<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export type ReconcileResult = { done: number; failed: number; remaining: number; errors: string[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Generates briefs and draft emails in batches until none are left. If Gemini is rate limiting us
 * (429), wait and try again instead of giving up, so a free-tier quota just makes it slower.
 */
export async function reconcileAll(onProgress?: (r: ReconcileResult, note?: string) => void) {
  let last: ReconcileResult = { done: 0, failed: 0, remaining: 0, errors: [] };
  let errors = new Set<string>();
  let waits = 0;
  let failures = 0;
  for (let i = 0; i < 80; i++) {
    try {
      last = await call<ReconcileResult>("/api/hiring/reconcile", { method: "POST" });
    } catch (e) {
      // A cut-off or dropped request is not fatal: partial work was saved, so try again a few times.
      if (++failures > 4) throw e;
      onProgress?.(last, "Connection hiccup. Retrying…");
      await sleep(3000);
      continue;
    }
    onProgress?.(last);
    if (last.remaining <= 0 && last.failed === 0) {
      errors = new Set();
      break;
    }
    const limited = last.errors.some((e) => /429|rate|quota/i.test(e));
    if (last.done === 0 && limited && waits < 8) {
      waits++;
      onProgress?.(last, "Gemini is rate limiting. Waiting 20 seconds, then continuing…");
      await sleep(20_000);
      continue;
    }
    last.errors.forEach((e) => errors.add(e));
    if (last.done === 0) break;
    if (last.remaining <= 0) break;
  }
  return { ...last, errors: [...errors] };
}
