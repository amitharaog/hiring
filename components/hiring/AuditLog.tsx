"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/hiring/types";
import { call } from "./api";
import { ACTION_LABEL, fmtTime } from "./shared";

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    void call<{ entries: AuditEntry[] }>("/api/hiring/audit")
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, []);

  const shown = (entries ?? []).filter((e) => {
    const t = q.trim().toLowerCase();
    return !t || `${e.candidate_name ?? ""} ${ACTION_LABEL[e.action] ?? e.action} ${e.detail ?? ""}`.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Every upload, score, draft, edit and send, with the time it happened. This is the record of why each candidate was
          shortlisted or passed over, and what was sent to them.
        </p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, action or detail" className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!entries && !error && <p className="text-slate-500">Loading…</p>}
      {entries && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-4 py-2.5 font-semibold">Candidate</th>
                <th className="px-4 py-2.5 font-semibold">What happened</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtTime(e.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {e.candidate_id && e.candidate_name && e.action !== "deleted" ? (
                      <Link href={`/hiring/candidate/${e.candidate_id}`} className="font-medium text-violet-700 hover:underline">{e.candidate_name}</Link>
                    ) : (
                      <span className="text-slate-500">{e.candidate_name ?? "·"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="hidden max-w-md truncate px-4 py-2.5 text-slate-500 md:table-cell" title={e.detail ?? ""}>{e.detail}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nothing here yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
