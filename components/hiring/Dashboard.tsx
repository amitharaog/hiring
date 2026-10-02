"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CandidateView, Role } from "@/lib/hiring/types";
import { call, reconcileAll } from "./api";

const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };
const SHORT: Record<string, string> = {
  "Floor-Level Operator Time": "Operator",
  "Unprompted Fix That Others Adopted": "Fixes",
  "Owned It With No One Above": "Ownership",
  "Failure On The Record": "Failures",
};
type Filter = "all" | "shortlist" | "below" | "review" | "sent";

const roleScore = (c: CandidateView, role: Role) => (role === "PM" ? c.score_pm : c.score_spm);
const tone = (n: number) =>
  n >= 70 ? "bg-emerald-100 text-emerald-800" : n >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
const barTone = (n: number) => (n >= 7 ? "bg-emerald-500" : n >= 5 ? "bg-amber-500" : "bg-rose-500");

type Stage = "scoring" | "failed" | "drafting" | "review" | "sent";
function stageOf(c: CandidateView): Stage {
  if (c.status === "failed") return "failed";
  if (c.status === "processing") return "scoring";
  if (c.sent_at) return "sent";
  return c.email_subject ? "review" : "drafting";
}

export function Dashboard() {
  const [all, setAll] = useState<CandidateView[] | null>(null);
  const [shortlist, setShortlist] = useState(5);
  const [role, setRole] = useState<Role>("PM");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [drafting, setDrafting] = useState("");
  const busy = useRef(false);

  const load = useCallback(async () => {
    const d = await call<{ candidates: CandidateView[]; shortlistSize: number }>("/api/hiring/candidates");
    setAll(d.candidates);
    setShortlist(d.shortlistSize);
    return d.candidates;
  }, []);

  // Bring briefs and drafts up to date with the ranking, then refresh. Guarded against overlapping runs.
  const refreshDrafts = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setDrafting("Writing briefs and draft emails…");
    try {
      const r = await reconcileAll((p) => setDrafting(p.remaining > 0 ? `Writing briefs and draft emails… ${p.remaining} left` : "Finishing up…"));
      setDraftErrors(r.errors);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate drafts");
    } finally {
      busy.current = false;
      setDrafting("");
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

  const ranked = useMemo(() => {
    const out: Record<Role, CandidateView[]> = { PM: [], SPM: [] };
    for (const r of ["PM", "SPM"] as Role[]) {
      out[r] = (all ?? [])
        .filter((c) => c.applied_role === r)
        .sort((a, b) => {
          const sa = a.status === "scored" ? roleScore(a, r) ?? 0 : -1;
          const sb = b.status === "scored" ? roleScore(b, r) ?? 0 : -1;
          return sb - sa || a.created_at.localeCompare(b.created_at);
        });
    }
    return out;
  }, [all]);

  // Keep scoring/drafting rows fresh without the user pressing anything.
  const pending = (all ?? []).some((c) => stageOf(c) === "scoring" || stageOf(c) === "drafting");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void load().catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [pending, load]);

  if (error && !all) return <p className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!all) return <p className="text-slate-500">Loading…</p>;

  const list = ranked[role];
  const rows = list
    .map((c, i) => ({ c, rank: i + 1, above: c.status === "scored" && i < shortlist }))
    .filter(({ c, above }) => {
      const st = stageOf(c);
      if (filter === "shortlist" && !above) return false;
      if (filter === "below" && (above || c.status !== "scored")) return false;
      if (filter === "review" && st !== "review") return false;
      if (filter === "sent" && st !== "sent") return false;
      const q = query.trim().toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    });

  const count = (r: Role) => ranked[r].length;
  const stats = {
    total: all.length,
    shortlisted: (["PM", "SPM"] as Role[]).reduce((n, r) => n + Math.min(shortlist, ranked[r].filter((c) => c.status === "scored").length), 0),
    ready: all.filter((c) => stageOf(c) === "review").length,
    sent: all.filter((c) => c.sent_at).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hiring shortlist</h1>
          <p className="mt-1 text-sm text-slate-600">
            Candidates are ranked by how closely they match your best past hires. Open a card to see why, read the brief,
            then review and send the email. <b>Nothing is sent until you press Confirm.</b>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshDrafts}
            disabled={!!drafting}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh drafts
          </button>
          <Link href="/hiring/upload" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            + Upload CVs
          </Link>
        </div>
      </div>

      {drafting && (
        <p className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
          {drafting}
        </p>
      )}
      {draftErrors.map((e) => (
        <p key={e} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Drafting problem: {e}</p>
      ))}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Candidates" value={stats.total} />
        <Tile label="On the shortlist" value={stats.shortlisted} hint={`top ${shortlist} per role`} />
        <Tile label="Emails ready to review" value={stats.ready} accent />
        <Tile label="Emails sent" value={stats.sent} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-slate-200 p-1">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${role === r ? "bg-white shadow-sm" : "text-slate-600"}`}
            >
              {ROLE_NAME[r]} <span className="text-slate-400">{count(r)}</span>
            </button>
          ))}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">Everyone</option>
          <option value="shortlist">Shortlist only</option>
          <option value="below">Below the line</option>
          <option value="review">Emails to review</option>
          <option value="sent">Already sent</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="min-w-[180px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold">No {ROLE_NAME[role]} candidates yet</p>
          <Link href="/hiring/upload" className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            Upload CVs
          </Link>
        </div>
      )}
      {list.length > 0 && rows.length === 0 && <p className="text-sm text-slate-500">No one matches this filter.</p>}

      <ol className="space-y-3">
        {rows.map(({ c, rank, above }, idx) => (
          <li key={c.id}>
            {!above && c.status === "scored" && (idx === 0 || rows[idx - 1].above) && filter !== "below" && (
              <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-300" />
                Below the line · drafts are rejections, so read each before sending
                <span className="h-px flex-1 bg-slate-300" />
              </div>
            )}
            <Card c={c} rank={rank} above={above} role={role} defaultOpen={rank === 1 && !c.sent_at && filter === "all" && !query} onChange={load} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"}`}>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-sm text-slate-600">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function StagePill({ c }: { c: CandidateView }) {
  const st = stageOf(c);
  const map: Record<Stage, [string, string]> = {
    scoring: ["Scoring…", "bg-slate-100 text-slate-600"],
    failed: ["Scoring failed", "bg-rose-100 text-rose-700"],
    drafting: ["Writing email…", "bg-slate-100 text-slate-600"],
    review: [c.email_type === "invite" ? "Invite ready to review" : "Rejection ready to review", c.email_type === "invite" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"],
    sent: [c.email_type === "invite" ? "Invite sent ✓" : "Rejection sent ✓", "bg-emerald-100 text-emerald-800"],
  };
  const [label, cls] = map[st];
  return <span className={`hidden whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${cls}`}>{label}</span>;
}

function Card({
  c,
  rank,
  above,
  role,
  defaultOpen,
  onChange,
}: {
  c: CandidateView;
  rank: number;
  above: boolean;
  role: Role;
  defaultOpen: boolean;
  onChange: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [working, setWorking] = useState("");
  const [msg, setMsg] = useState("");
  const other: Role = role === "PM" ? "SPM" : "PM";
  const mine = c.scores?.[role];
  const score = mine?.total;

  async function act(label: string, fn: () => Promise<unknown>) {
    setWorking(label);
    setMsg("");
    try {
      await fn();
      await onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setWorking("");
  }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${above ? "border-emerald-300" : "border-slate-200"}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50">
        <span className="w-6 text-center text-sm font-semibold text-slate-400">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{c.name || c.file_name || "Unnamed"}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {mine?.criteria.map((k) => (
              <span key={k.name} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {SHORT[k.name] ?? k.name.split(" ")[0]} <b className="text-slate-900">{k.score}</b>
              </span>
            ))}
            {c.scores && <span className="py-0.5 text-xs text-slate-400">also {c.scores[other].total} as {other}</span>}
          </span>
        </span>
        <StagePill c={c} />
        <span className={`w-16 rounded-xl py-1.5 text-center text-xl font-bold tabular-nums ${score === undefined ? "bg-slate-100 text-slate-400" : tone(score)}`}>
          {score === undefined ? "–" : Math.round(score)}
        </span>
        <span className="text-slate-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200 p-4 text-sm">
          {c.status === "failed" && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-rose-700">
              {c.error}
              <button onClick={() => act("Retrying…", () => call(`/api/hiring/candidates/${c.id}/rescore`, { method: "POST" }))} className="ml-3 font-semibold underline">
                {working || "Retry scoring"}
              </button>
            </div>
          )}
          {msg && <p className="mb-3 rounded-lg bg-rose-50 p-2 text-rose-700">{msg}</p>}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <section>
                <Label>Interview brief</Label>
                {c.brief ? (
                  <p className="rounded-xl bg-indigo-50 p-3 leading-relaxed text-slate-800">{c.brief}</p>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-slate-500">
                    {above ? (c.status === "scored" ? "Being written…" : "Available once scored.") : "Briefs are written for the shortlist only."}
                  </p>
                )}
              </section>

              {mine && (
                <section>
                  <Label>Why {Math.round(score ?? 0)}/100 as {role}</Label>
                  <ul className="space-y-3">
                    {mine.criteria.map((k) => (
                      <li key={k.name}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {k.name} <span className="font-normal text-slate-400">· {k.weight}% of score</span>
                          </span>
                          <span className="tabular-nums font-semibold">{k.score}/10</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                          <div className={`h-1.5 rounded-full ${barTone(k.score)}`} style={{ width: `${k.score * 10}%` }} />
                        </div>
                        <p className="mt-1 text-slate-600">{k.reason}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <section>
              <Label>Email to {c.name?.split(" ")[0] || "candidate"}</Label>
              {c.email_subject !== null ? (
                <Draft key={`${c.email_type}|${c.email_subject}|${c.email_body}|${c.email}`} c={c} onChange={onChange} />
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-slate-500">
                  {c.status === "scored" ? "The draft is being written. It will appear here in a moment." : "A draft appears here after scoring."}
                </p>
              )}
            </section>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">What the AI read (anonymised CV text)</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{c.cv_content}</pre>
          </details>
          {!c.sent_at && (
            <button
              onClick={() => window.confirm(`Delete ${c.name}? This removes the candidate.`) && act("Deleting…", () => call(`/api/hiring/candidates/${c.id}`, { method: "DELETE" }))}
              disabled={!!working}
              className="mt-4 text-xs text-rose-600 underline disabled:opacity-40"
            >
              Delete candidate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{children}</h3>;
}

function Draft({ c, onChange }: { c: CandidateView; onChange: () => Promise<unknown> }) {
  const [subject, setSubject] = useState(c.email_subject ?? "");
  const [body, setBody] = useState(c.email_body ?? "");
  const [email, setEmail] = useState(c.email);
  const [working, setWorking] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const dirty = subject !== (c.email_subject ?? "") || body !== (c.email_body ?? "") || email !== c.email;
  const isInvite = c.email_type === "invite";

  async function act(label: string, fn: () => Promise<unknown>, success = "") {
    setWorking(label);
    setMsg("");
    setOk("");
    try {
      await fn();
      setOk(success);
      await onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setWorking("");
  }

  const patch = (data: object) =>
    call(`/api/hiring/candidates/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const save = () => patch({ subject, body, email });

  function confirmSend() {
    const what = isInvite ? "interview invite" : "REJECTION";
    if (!window.confirm(`Send this ${what} to ${c.name} (${email})?\n\nThis can't be undone.`)) return;
    act("Sending…", async () => {
      if (dirty) await save();
      await call(`/api/hiring/candidates/${c.id}/send`, { method: "POST" });
    });
  }

  if (c.sent_at) {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 font-medium text-emerald-800">
          ✓ {isInvite ? "Invite" : "Rejection"} sent to {c.sent_to} on {new Date(c.sent_at).toLocaleString()}
        </p>
        <p className="font-medium">{c.email_subject}</p>
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans leading-relaxed text-slate-700">{c.email_body}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${isInvite ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"}`}>
        {isInvite ? "Interview invite" : "Rejection"}
      </span>
      <Field label="To">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="No email found on this CV. Add one" className={`w-full rounded-lg border px-2.5 py-1.5 ${email ? "border-slate-300" : "border-rose-400"}`} />
      </Field>
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5" />
      </Field>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={11} className="w-full rounded-lg border border-slate-300 p-2.5 leading-relaxed" />
      {msg && <p className="rounded-lg bg-rose-50 p-2 text-rose-700">{msg}</p>}
      {ok && <p className="text-emerald-700">{ok}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={confirmSend} disabled={!!working || !email} className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40">
          {working || (isInvite ? "Confirm & send invite" : "Confirm & send rejection")}
        </button>
        <button onClick={() => act("Saving…", save, "Saved.")} disabled={!!working || !dirty} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:opacity-40">
          Save edits
        </button>
        <button onClick={() => act("Redrafting…", () => patch({ switchTo: isInvite ? "rejection" : "invite" }))} disabled={!!working} className="px-2 py-2 text-slate-600 underline disabled:opacity-40">
          Redraft as {isInvite ? "rejection" : "invite"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-slate-500">{label}</span>
      {children}
    </label>
  );
}
