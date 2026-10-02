export async function call<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export type ReconcileResult = { done: number; failed: number; remaining: number; errors: string[] };

/** Generates briefs and draft emails in batches until none are left (or no progress is made). */
export async function reconcileAll(onProgress?: (r: ReconcileResult) => void) {
  let last: ReconcileResult = { done: 0, failed: 0, remaining: 0, errors: [] };
  const errors = new Set<string>();
  for (let i = 0; i < 40; i++) {
    last = await call<ReconcileResult>("/api/hiring/reconcile", { method: "POST" });
    last.errors.forEach((e) => errors.add(e));
    onProgress?.(last);
    if (last.remaining <= 0 || last.done === 0) break;
  }
  return { ...last, errors: [...errors] };
}
