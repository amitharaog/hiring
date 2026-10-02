"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CandidateView, Kind, Role } from "@/lib/hiring/types";
import { call, reconcileAll } from "./api";
import { ROLE_NAME, SHORT, rankRole, roleScore, stageOf, tone, type Stage } from "./shared";

type Filter = "all" | "shortlist" | "below" | "review" | "sent";

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

  // Brings briefs and drafts up to date with the ranking, then refreshes. Guarded against overlapping runs.
  const refreshDrafts = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setDrafting("Writing briefs and draft emails…");
    try {
      const r = await reconcileAll((p, note) =>
        setDrafting(note ?? (p.remaining > 0 ? `Writing briefs and draft emails… ${p.remaining} left` : "Finishing up…")),
      );
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

  const ranked = useMemo(() => ({ PM: rankRole(all ?? [], "PM"), SPM: rankRole(all ?? [], "SPM") }), [all]);

  // Keep scoring/drafting rows fresh without the user pressing anything.
  const pending = (all ?? []).some((c) => c.status === "processing" || (c.status === "scored" && !c.sent_at && !c.drafts.invite && !c.drafts.decline));
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void load().catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [pending, load]);

  if (error && !all) return <p className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!all) return <p className="text-slate-500">Loading…</p>;

  const list = ranked[role];
  const rows = list
    .map((c, i) => {
      const above = c.status === "scored" && i < shortlist;
      const suggested: Kind = above ? "invite" : "decline";
      return { c, rank: i + 1, above, suggested, stage: stageOf(c, suggested) };
    })
    .filter(({ c, above, stage }) => {
      if (filter === "shortlist" && !above) return false;
      if (filter === "below" && (above || c.status !== "scored")) return false;
      if (filter === "review" && stage !== "review") return false;
      if (filter === "sent" && stage !== "sent") return false;
      const q = query.trim().toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    });

  const stats = {
    total: all.length,
    shortlisted: (["PM", "SPM"] as Role[]).reduce((n, r) => n + Math.min(shortlist, ranked[r].filter((c) => c.status === "scored").length), 0),
    ready: all.filter((c) => c.status === "scored" && !c.sent_at && (c.drafts.invite || c.drafts.decline)).length,
    sent: all.filter((c) => c.sent_at).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Candidates</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Ranked by how closely they match your best past hires. Open a candidate to read the brief and the questions to ask,
            then review and send the email. <b>Nothing is sent until you confirm.</b>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refreshDrafts} disabled={!!drafting} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Refresh drafts
          </button>
          {all.length > 0 && (
            <button
              onClick={async () => {
                const sentNote = stats.sent ? `\n\n${stats.sent} of them already had an email sent; that record will be lost too.` : "";
                if (!window.confirm(`Delete ALL ${all.length} candidates, with their scores, briefs and drafts?${sentNote}\n\nThis can't be undone. The rubric is kept.`)) return;
                try {
                  await call("/api/hiring/candidates", { method: "DELETE" });
                  setDraftErrors([]);
                  setError("");
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not clear");
                }
              }}
              className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              Clear all
            </button>
          )}
          <Link href="/hiring/upload" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">
            + Upload CVs
          </Link>
        </div>
      </div>

      {drafting && (
        <p className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
          {drafting}
        </p>
      )}
      {draftErrors.map((e) => (
        <p key={e} className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Drafting problem: {e}</p>
      ))}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Candidates" value={stats.total} />
        <Tile label="On the shortlist" value={stats.shortlisted} hint={`top ${shortlist} per role`} />
        <Tile label="Emails ready to review" value={stats.ready} accent />
        <Tile label="Emails sent" value={stats.sent} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-slate-200/70 p-1">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${role === r ? "bg-white shadow-sm" : "text-slate-600"}`}>
              {ROLE_NAME[r]} <span className="text-slate-400">{ranked[r].length}</span>
            </button>
          ))}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">Everyone</option>
          <option value="shortlist">Shortlist only</option>
          <option value="below">Below the line</option>
          <option value="review">Emails to review</option>
          <option value="sent">Already sent</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="min-w-[180px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold">No {ROLE_NAME[role]} candidates yet</p>
          <Link href="/hiring/upload" className="mt-3 inline-block rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Upload CVs</Link>
        </div>
      )}
      {list.length > 0 && rows.length === 0 && <p className="text-sm text-slate-500">No one matches this filter.</p>}

      <ol className="space-y-3">
        {rows.map(({ c, rank, above, stage }, idx) => {
          const mine = c.scores?.[role];
          const score = roleScore(c, role);
          const other: Role = role === "PM" ? "SPM" : "PM";
          return (
            <li key={c.id}>
              {!above && c.status === "scored" && (idx === 0 || rows[idx - 1].above) && filter !== "below" && (
                <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span className="h-px flex-1 bg-slate-300" />
                  Below the line · suggested emails are declines, so read each before sending
                  <span className="h-px flex-1 bg-slate-300" />
                </div>
              )}
              <Link
                href={`/hiring/candidate/${c.id}`}
                className={`flex items-center gap-4 rounded-2xl border bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md ${above ? "border-violet-200" : "border-slate-200"}`}
              >
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
                <StagePill stage={stage} c={c} />
                <span className={`w-16 rounded-xl py-1.5 text-center text-xl font-bold tabular-nums ${score == null ? "bg-slate-100 text-slate-400" : tone(score)}`}>
                  {score == null ? "–" : Math.round(score)}
                </span>
                <span className="text-slate-300">›</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"}`}>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-sm text-slate-600">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function StagePill({ stage, c }: { stage: Stage; c: CandidateView }) {
  const sentLabel = c.sent_kind === "decline" ? "Decline sent ✓" : "Invite sent ✓";
  const map: Record<Stage, [string, string]> = {
    scoring: ["Scoring…", "bg-slate-100 text-slate-600"],
    failed: ["Scoring failed", "bg-rose-100 text-rose-700"],
    drafting: ["Writing email…", "bg-slate-100 text-slate-600"],
    review: ["Email ready to review", "bg-violet-100 text-violet-800"],
    sent: [sentLabel, "bg-emerald-100 text-emerald-800"],
  };
  const [label, cls] = map[stage];
  return <span className={`hidden whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${cls}`}>{label}</span>;
}
