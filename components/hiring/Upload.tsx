"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { call, reconcileAll } from "./api";

type Role = "PM" | "SPM";
type State = "queued" | "working" | "done" | "duplicate" | "error";
type Item = { key: string; file: File; role: Role; state: State; message?: string };

const OK_TYPES = /\.(pdf|docx|txt)$/i;
// "spm_17_nalini.pdf" -> SPM, "pm_03_x.pdf" -> PM, anything else -> the default role.
const guessRole = (name: string, fallback: Role): Role =>
  /^spm[_\s-]/i.test(name) ? "SPM" : /^pm[_\s-]/i.test(name) ? "PM" : fallback;

export function Upload() {
  const [fallback, setFallback] = useState<Role>("PM");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((it) => (it.key === key ? { ...it, ...p } : it)));

  function add(files: File[]) {
    const fresh = files.filter((f) => OK_TYPES.test(f.name));
    setItems((cur) => {
      const have = new Set(cur.map((c) => c.key));
      const next = fresh
        .map((file) => ({ key: `${file.name}:${file.size}:${file.lastModified}`, file, role: guessRole(file.name, fallback), state: "queued" as State }))
        .filter((i) => !have.has(i.key));
      return [...cur, ...next];
    });
    setPhase(fresh.length < files.length ? `${files.length - fresh.length} file(s) skipped: only PDF, DOCX and TXT are supported.` : "");
  }

  async function run() {
    setRunning(true);
    setDraftErrors([]);
    setPhase("");
    const queue = items.filter((i) => i.state === "queued" || i.state === "error");
    let next = 0;
    let scored = 0;
    // Three CVs at a time: each is a read plus a model call, which keeps 60 CVs to a few minutes.
    const worker = async () => {
      while (next < queue.length) {
        const it = queue[next++];
        patch(it.key, { state: "working", message: undefined });
        try {
          const form = new FormData();
          form.set("file", it.file);
          form.set("role", it.role);
          const r = await call<{ duplicate: boolean }>("/api/hiring/candidates", { method: "POST", body: form });
          if (!r.duplicate) scored++;
          patch(it.key, { state: r.duplicate ? "duplicate" : "done" });
        } catch (e) {
          patch(it.key, { state: "error", message: e instanceof Error ? e.message : "Failed" });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    setPhase("Writing interview briefs and draft emails…");
    try {
      const r = await reconcileAll((p) => setPhase(`Writing interview briefs and draft emails… ${p.remaining} left`));
      setDraftErrors(r.errors);
      setPhase(r.errors.length ? "Scored, but some drafts failed (see below). Open the dashboard and press Refresh drafts to retry." : scored ? "All done. Your ranked shortlist is ready." : "Nothing new to add.");
    } catch (e) {
      setPhase(`Scored, but drafting stopped: ${e instanceof Error ? e.message : "error"}`);
    }
    setRunning(false);
  }

  const total = items.length;
  const finished = items.filter((i) => i.state === "done" || i.state === "duplicate").length;
  const failed = items.filter((i) => i.state === "error").length;
  const todo = items.filter((i) => i.state === "queued" || i.state === "error").length;
  const pct = total ? Math.round(((finished + failed) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload CVs</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Add as many as you like at once. Each CV is split into personal details (stored privately) and anonymised
          content (the only part the AI reads), then scored against both rubrics. Nothing is emailed from this page.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!running) add([...e.dataTransfer.files]);
        }}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"
        }`}
      >
        <p className="text-lg font-semibold">Drag and drop CVs here</p>
        <p className="mt-1 text-sm text-slate-500">PDF, DOCX or TXT · select 60 at once if you like</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={running}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            Choose files
          </button>
          <button
            onClick={() => folderInput.current?.click()}
            disabled={running}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Choose a whole folder
          </button>
        </div>
        <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.txt" hidden onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          // @ts-expect-error webkitdirectory is supported by all major browsers but missing from React's types
          webkitdirectory=""
          onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <label className="font-medium">
          Role for files that don&apos;t say pm_ or spm_ in the name
          <select
            value={fallback}
            disabled={running}
            onChange={(e) => {
              const r = e.target.value as Role;
              setFallback(r);
              // Files that don't say pm_/spm_ in their name follow the default.
              setItems((c) => c.map((i) => (i.state === "queued" ? { ...i, role: guessRole(i.file.name, r) } : i)));
            }}
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
          >
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </label>
        {total > 0 && (
          <span className="flex items-center gap-2 text-slate-600">
            Set every file to
            <button disabled={running} onClick={() => setItems((c) => c.map((i) => (i.state === "queued" ? { ...i, role: "PM" } : i)))} className="rounded border border-slate-300 px-2 py-0.5 font-medium hover:bg-slate-50 disabled:opacity-50">PM</button>
            <button disabled={running} onClick={() => setItems((c) => c.map((i) => (i.state === "queued" ? { ...i, role: "SPM" } : i)))} className="rounded border border-slate-300 px-2 py-0.5 font-medium hover:bg-slate-50 disabled:opacity-50">SPM</button>
          </span>
        )}
      </div>

      {total > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={run}
              disabled={running || todo === 0}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
            >
              {running ? "Working…" : todo === total ? `Score ${total} CV${total > 1 ? "s" : ""}` : `Score ${todo} remaining`}
            </button>
            <button
              onClick={() => setItems((c) => c.filter((i) => i.state === "working"))}
              disabled={running}
              className="text-sm text-slate-500 underline disabled:opacity-40"
            >
              Clear list
            </button>
            <div className="min-w-[200px] flex-1">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{finished} of {total} scored{failed ? ` · ${failed} failed` : ""}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {phase && <p className="text-sm text-slate-700">{phase}</p>}
          {draftErrors.map((e) => (
            <p key={e} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e}</p>
          ))}
          {!running && finished > 0 && (
            <Link href="/hiring" className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Open the dashboard →
            </Link>
          )}

          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            {items.map((it) => (
              <li key={it.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
                <select
                  value={it.role}
                  disabled={running || it.state === "done" || it.state === "duplicate"}
                  onChange={(e) => patch(it.key, { role: e.target.value as Role })}
                  className="rounded-md border border-slate-300 px-2 py-0.5"
                >
                  <option value="PM">PM</option>
                  <option value="SPM">SPM</option>
                </select>
                <StatePill state={it.state} />
                {it.state === "error" && <p className="w-full break-words text-xs text-red-600">{it.message}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function StatePill({ state }: { state: State }) {
  const map: Record<State, [string, string]> = {
    queued: ["Waiting", "bg-slate-100 text-slate-600"],
    working: ["Scoring…", "bg-indigo-100 text-indigo-700"],
    done: ["Scored ✓", "bg-emerald-100 text-emerald-700"],
    duplicate: ["Already uploaded", "bg-amber-100 text-amber-700"],
    error: ["Failed", "bg-red-100 text-red-700"],
  };
  const [label, cls] = map[state];
  return <span className={`w-28 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${cls}`}>{label}</span>;
}
