"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CandidateView, Role } from "@/lib/hiring/types";
import { call, reconcileAll } from "./api";

const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };

export function Dashboard() {
  const [all, setAll] = useState<CandidateView[] | null>(null);
  const [shortlist, setShortlist] = useState(5);
  const [role, setRole] = useState<Role>("PM");
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    const d = await call<{ candidates: CandidateView[]; shortlistSize: number }>("/api/hiring/candidates");
    setAll(d.candidates);
    setShortlist(d.shortlistSize);
    return d.candidates;
  }, []);

  // Bring briefs and drafts up to date with the ranking, then refresh. Re-entrancy guarded.
  const refreshDrafts = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setDrafting(true);
    try {
      await reconcileAll();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate drafts");
    } finally {
      busy.current = false;
      setDrafting(false);
    }
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
        await refreshDrafts();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load");
      }
    })();
  }, [load, refreshDrafts]);

  if (error && !all) return <p className="text-red-600">{error}</p>;
  if (!all) return <p className="text-slate-500">Loading…</p>;

  const inRole = all
    .filter((c) => c.applied_role === role)
    .sort((a, b) => {
      // Scored candidates by score; unscored (processing/failed) at the bottom.
      const sa = a.status === "scored" ? (role === "PM" ? a.score_pm : a.score_spm) ?? 0 : -1;
      const sb = b.status === "scored" ? (role === "PM" ? b.score_pm : b.score_spm) ?? 0 : -1;
      return sb - sa || a.created_at.localeCompare(b.created_at);
    });
  const counts = { PM: all.filter((c) => c.applied_role === "PM").length, SPM: all.filter((c) => c.applied_role === "SPM").length };
  const sent = all.filter((c) => c.sent_at).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Shortlist</h1>
          <p className="text-sm text-slate-600">
            {all.length} candidates · {sent} emails sent · The system ranks and drafts. Nothing is sent until you confirm.
          </p>
        </div>
        <button
          onClick={refreshDrafts}
          disabled={drafting}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {drafting ? "Updating drafts…" : "Refresh drafts"}
        </button>
      </div>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        {(["PM", "SPM"] as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              role === r ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {ROLE_NAME[r]} ({counts[r]})
          </button>
        ))}
      </div>

      {inRole.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No {ROLE_NAME[role]} candidates yet. Upload CVs to get started.
        </p>
      )}

      <ol className="space-y-3">
        {inRole.map((c, i) => (
          <li key={c.id}>
            {i === shortlist && (
              <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span className="h-px flex-1 bg-slate-300" />
                Below the line · drafts here are rejections. Review before sending
                <span className="h-px flex-1 bg-slate-300" />
              </div>
            )}
            <Card c={c} rank={i + 1} above={i < shortlist} onChange={load} onError={setError} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Card({
  c,
  rank,
  above,
  onChange,
  onError,
}: {
  c: CandidateView;
  rank: number;
  above: boolean;
  onChange: () => Promise<unknown>;
  onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(rank <= 1 && !c.sent_at);
  const [working, setWorking] = useState("");
  const other: Role = c.applied_role === "PM" ? "SPM" : "PM";
  const mine = c.scores?.[c.applied_role];
  const score = mine?.total;

  async function act(label: string, fn: () => Promise<unknown>) {
    setWorking(label);
    onError("");
    try {
      await fn();
      await onChange();
    } catch (e) {
      onError(`${c.name || "Candidate"}: ${e instanceof Error ? e.message : "failed"}`);
    }
    setWorking("");
  }

  return (
    <div className={`rounded-lg border bg-white ${above ? "border-emerald-300" : "border-slate-200"}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 px-4 py-3 text-left">
        <span className="w-6 text-sm font-semibold text-slate-400">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{c.name || c.file_name || "Unnamed"}</span>
          <span className="block truncate text-xs text-slate-500">
            {c.status === "scored" && c.scores
              ? `Also scores ${c.scores[other].total} as ${other}`
              : c.status === "failed"
                ? "Scoring failed"
                : "Scoring…"}
          </span>
        </span>
        {c.sent_at ? (
          <Badge tone="green">Sent {c.email_type === "invite" ? "invite" : "rejection"}</Badge>
        ) : c.email_type ? (
          <Badge tone={c.email_type === "invite" ? "indigo" : "slate"}>Draft {c.email_type}</Badge>
        ) : null}
        <span className="w-14 text-right text-2xl font-bold tabular-nums">{score ?? "–"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-4 text-sm">
          {c.status === "failed" && (
            <div className="rounded bg-red-50 p-3 text-red-700">
              {c.error}
              <button
                onClick={() => act("Retrying…", () => call(`/api/hiring/candidates/${c.id}/rescore`, { method: "POST" }))}
                className="ml-3 font-semibold underline"
              >
                {working || "Retry scoring"}
              </button>
            </div>
          )}

          {c.brief && (
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Interview brief</h3>
              <p className="rounded bg-indigo-50 p-3 leading-relaxed">{c.brief}</p>
            </section>
          )}

          {mine && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Why {score}/100 as {c.applied_role}
              </h3>
              <ul className="space-y-2">
                {mine.criteria.map((k) => (
                  <li key={k.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {k.name} <span className="font-normal text-slate-400">· {k.weight}%</span>
                      </span>
                      <span className="tabular-nums">{k.score}/10</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-slate-100">
                      <div className="h-1.5 rounded bg-slate-700" style={{ width: `${k.score * 10}%` }} />
                    </div>
                    <p className="mt-1 text-slate-600">{k.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.email_subject !== null && (
            // Re-mounted whenever the stored draft changes (redraft, background regeneration), which resets the edit boxes.
            <Draft key={`${c.email_type}|${c.email_subject}|${c.email_body}|${c.email}`} c={c} onChange={onChange} onError={onError} />
          )}

          <details>
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">
              Anonymised CV text (what the AI read)
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
              {c.cv_content}
            </pre>
          </details>

          {!c.sent_at && (
            <button
              onClick={() => window.confirm(`Delete ${c.name}? This removes the candidate.`) && act("Deleting…", () => call(`/api/hiring/candidates/${c.id}`, { method: "DELETE" }))}
              disabled={!!working}
              className="text-xs text-red-600 underline disabled:opacity-40"
            >
              Delete candidate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Draft({ c, onChange, onError }: { c: CandidateView; onChange: () => Promise<unknown>; onError: (m: string) => void }) {
  const [subject, setSubject] = useState(c.email_subject ?? "");
  const [body, setBody] = useState(c.email_body ?? "");
  const [email, setEmail] = useState(c.email);
  const [working, setWorking] = useState("");
  const dirty = subject !== (c.email_subject ?? "") || body !== (c.email_body ?? "") || email !== c.email;

  async function act(label: string, fn: () => Promise<unknown>) {
    setWorking(label);
    onError("");
    try {
      await fn();
      await onChange();
    } catch (e) {
      onError(`${c.name || "Candidate"}: ${e instanceof Error ? e.message : "failed"}`);
    }
    setWorking("");
  }

  const patch = (data: object) =>
    call(`/api/hiring/candidates/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const save = () => patch({ subject, body, email });

  function confirmSend() {
    const verb = c.email_type === "rejection" ? "REJECTION" : "interview invite";
    if (!window.confirm(`Send this ${verb} to ${c.name} (${email})? This can't be undone.`)) return;
    act("Sending…", async () => {
      if (dirty) await save();
      await call(`/api/hiring/candidates/${c.id}/send`, { method: "POST" });
    });
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Draft {c.email_type} {c.sent_at && `· sent to ${c.sent_to} on ${new Date(c.sent_at).toLocaleString()}`}
      </h3>
      <label className="flex items-center gap-2">
        <span className="w-14 text-slate-500">To</span>
        <input
          value={email}
          disabled={!!c.sent_at}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="No email found on this CV. Add one"
          className={`flex-1 rounded border px-2 py-1 ${email ? "border-slate-300" : "border-red-400"}`}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-14 text-slate-500">Subject</span>
        <input
          value={subject}
          disabled={!!c.sent_at}
          onChange={(e) => setSubject(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <textarea
        value={body}
        disabled={!!c.sent_at}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        className="w-full rounded border border-slate-300 p-2 leading-relaxed"
      />
      {!c.sent_at && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={confirmSend}
            disabled={!!working || !email}
            className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {working || "Confirm & send"}
          </button>
          <button
            onClick={() => act("Saving…", save)}
            disabled={!!working || !dirty}
            className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40"
          >
            Save edits
          </button>
          <button
            onClick={() => act("Redrafting…", () => patch({ switchTo: c.email_type === "invite" ? "rejection" : "invite" }))}
            disabled={!!working}
            className="px-2 py-2 text-slate-600 underline disabled:opacity-40"
          >
            Redraft as {c.email_type === "invite" ? "rejection" : "invite"}
          </button>
        </div>
      )}
    </section>
  );
}

function Badge({ tone, children }: { tone: "green" | "indigo" | "slate"; children: React.ReactNode }) {
  const cls = { green: "bg-emerald-100 text-emerald-800", indigo: "bg-indigo-100 text-indigo-800", slate: "bg-slate-100 text-slate-700" }[tone];
  return <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${cls}`}>{children}</span>;
}
