export async function call<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Generates briefs and draft emails in batches until none are left (or no progress is made). */
export async function reconcileAll(onProgress?: (remaining: number) => void) {
  for (let i = 0; i < 40; i++) {
    const r = await call<{ done: number; failed: number; remaining: number }>("/api/hiring/reconcile", { method: "POST" });
    onProgress?.(r.remaining);
    if (r.remaining <= 0 || r.done === 0) return r;
  }
}
