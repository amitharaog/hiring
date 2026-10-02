"use client";

import Link from "next/link";
import { useState } from "react";
import { call, reconcileAll } from "./api";

type Role = "PM" | "SPM";
type Item = { file: File; role: Role; state: "queued" | "working" | "done" | "error"; message?: string };

// "spm_17_nalini.pdf" -> SPM, "pm_03_x.pdf" -> PM, anything else -> the batch default.
const guessRole = (name: string, fallback: Role): Role =>
  /^spm[_\s-]/i.test(name) ? "SPM" : /^pm[_\s-]/i.test(name) ? "PM" : fallback;

export function Upload() {
  const [fallback, setFallback] = useState<Role>("PM");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");

  const patch = (i: number, p: Partial<Item>) => setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...p } : it)));

  function pick(files: FileList | null) {
    if (!files) return;
    setItems([...files].map((file) => ({ file, role: guessRole(file.name, fallback), state: "queued" })));
  }

  async function run() {
    setRunning(true);
    const queue = items.map((_, i) => i).filter((i) => items[i].state !== "done");
    let next = 0;
    // A few CVs at a time: each one is a read + a model call, so this keeps 60 CVs to a few minutes.
    const worker = async () => {
      while (next < queue.length) {
        const i = queue[next++];
        patch(i, { state: "working", message: undefined });
        try {
          const form = new FormData();
          form.set("file", items[i].file);
          form.set("role", items[i].role);
          await call("/api/hiring/candidates", { method: "POST", body: form });
          patch(i, { state: "done" });
        } catch (e) {
          patch(i, { state: "error", message: e instanceof Error ? e.message : "Failed" });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setPhase("Writing briefs and draft emails…");
    try {
      await reconcileAll((n) => setPhase(`Writing briefs and draft emails… ${n} left`));
      setPhase("Done. Everything is ready on the dashboard.");
    } catch (e) {
      setPhase(`Scored, but drafts stopped: ${e instanceof Error ? e.message : "error"}. Open the dashboard to retry.`);
    }
    setRunning(false);
  }

  const pending = items.filter((i) => i.state !== "done").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Upload CVs</h1>
        <p className="mt-1 text-sm text-slate-600">
          PDF, DOCX or TXT. Each CV is split into personal details (stored privately) and anonymised content (the only
          part the AI reads), scored against both rubrics, then ranked on the dashboard. Nothing is emailed from here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium">
          Applied for
          <select
            value={fallback}
            disabled={running}
            onChange={(e) => setFallback(e.target.value as Role)}
            className="ml-2 rounded border border-slate-300 px-2 py-1"
          >
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </label>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          disabled={running}
          onChange={(e) => pick(e.target.files)}
          className="text-sm"
        />
        <span className="text-xs text-slate-500">Files named pm_… or spm_… pick their role automatically; change any below.</span>
      </div>

      {items.length > 0 && (
        <>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
                <select
                  value={it.role}
                  disabled={running || it.state === "done"}
                  onChange={(e) => patch(i, { role: e.target.value as Role })}
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  <option value="PM">PM</option>
                  <option value="SPM">SPM</option>
                </select>
                <span
                  className={`w-40 truncate text-right ${
                    it.state === "error" ? "text-red-600" : it.state === "done" ? "text-emerald-600" : "text-slate-500"
                  }`}
                  title={it.message}
                >
                  {it.state === "error" ? it.message : it.state}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <button
              onClick={run}
              disabled={running || pending === 0}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {running ? "Working…" : pending === items.length ? `Upload ${items.length} CV${items.length > 1 ? "s" : ""}` : `Retry ${pending} remaining`}
            </button>
            {phase && <span className="text-sm text-slate-600">{phase}</span>}
            {!running && items.some((i) => i.state === "done") && (
              <Link href="/hiring" className="text-sm font-semibold text-indigo-700 underline">
                Open dashboard
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
