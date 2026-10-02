"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AuditEntry, CandidateView, Kind, Role } from "@/lib/hiring/types";
import { call, reconcileAll } from "./api";
import { ACTION_LABEL, KIND_LABEL, ROLE_NAME, barTone, fmtTime, rankRole, tone } from "./shared";

type Config = { testMode: boolean; testTarget: string | null; sendingConfigured: boolean };
type Detail = { candidate: CandidateView; history: AuditEntry[] };

const firstName = (full: string) => full.split(/\s+/)[0] || "there";
const fill = (t: string, full: string) => t.replaceAll("{{first_name}}", firstName(full)).replaceAll("[NAME]", firstName(full));

export function CandidateDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [rank, setRank] = useState<{ n: number; of: number; shortlist: number } | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [one, list] = await Promise.all([
      call<Detail>(`/api/hiring/candidates/${id}`),
      call<{ candidates: CandidateView[]; shortlistSize: number }>("/api/hiring/candidates"),
    ]);
    setD(one);
    const r = rankRole(list.candidates, one.candidate.applied_role);
    setRank({ n: r.findIndex((c) => c.id === id) + 1, of: r.length, shortlist: list.shortlistSize });
  }, [id]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
        setCfg(await call<Config>("/api/hiring/config"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load");
      }
    })();
  }, [load]);

  if (error) return <div className="space-y-3"><Back /><p className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p></div>;
  if (!d || !rank) return <p className="text-slate-500">Loading…</p>;

  const c = d.candidate;
  const role = c.applied_role;
  const other: Role = role === "PM" ? "SPM" : "PM";
  const mine = c.scores?.[role];
  const above = c.status === "scored" && rank.n > 0 && rank.n <= rank.shortlist;
  const suggested: Kind = above ? "invite" : "decline";

  return (
    <div className="space-y-6">
      <Back />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.name || c.file_name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 font-medium">Applied: {ROLE_NAME[role]}</span>
            {c.status === "scored" && (
              <span className={`rounded-full px-2.5 py-0.5 font-medium ${above ? "bg-violet-100 text-violet-800" : "bg-slate-200/70"}`}>
                #{rank.n} of {rank.of} · {above ? "on the shortlist" : "below the line"}
              </span>
            )}
          </p>
        </div>
        {mine && (
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl px-5 py-2 text-center ${tone(mine.total)}`}>
              <div className="text-3xl font-bold tabular-nums leading-none">{Math.round(mine.total)}</div>
              <div className="mt-1 text-xs font-semibold">as {role}</div>
            </div>
            <div className="rounded-2xl bg-slate-200/60 px-4 py-2 text-center text-slate-700">
              <div className="text-xl font-bold tabular-nums leading-none">{Math.round(c.scores![other].total)}</div>
              <div className="mt-1 text-xs font-semibold">as {other}</div>
            </div>
          </div>
        )}
      </header>

      {c.status === "failed" && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Scoring failed: {c.error}. Use Re-score below to try again.</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Brief c={c} onChange={load} />
          {mine && (
            <Card title={`Why ${Math.round(mine.total)}/100 as ${role}`}>
              <ul className="space-y-4">
                {mine.criteria.map((k) => (
                  <li key={k.name}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{k.name} <span className="font-normal text-slate-400">· {k.weight}% of score</span></span>
                      <span className="font-semibold tabular-nums">{k.score}/10</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                      <div className={`h-1.5 rounded-full ${barTone(k.score)}`} style={{ width: `${k.score * 10}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">{k.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-slate-500">What the AI read (anonymised CV text)</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{c.cv_content}</pre>
          </details>
        </div>

        <div className="space-y-6">
          <Email c={c} suggested={suggested} cfg={cfg} onChange={load} />
          <Card title="Decision history" icon="list">
            {d.history.filter((h) => h.action === "invite_sent" || h.action === "decline_sent").length === 0 && (
              <p className="text-sm text-slate-500">No decision yet. Nothing has been sent to {firstName(c.name)}.</p>
            )}
            <ul className="space-y-1.5 text-sm">
              {d.history
                .filter((h) => h.action === "invite_sent" || h.action === "decline_sent")
                .map((h) => (
                  <li key={h.id}><b>{h.action === "invite_sent" ? "Invite" : "Decline"}</b> <span className="text-slate-500">· {fmtTime(h.created_at)}</span></li>
                ))}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">All activity for this candidate</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {d.history.map((h) => (
                  <li key={h.id}>{fmtTime(h.created_at)} · {ACTION_LABEL[h.action] ?? h.action}{h.detail ? ` · ${h.detail}` : ""}</li>
                ))}
              </ul>
            </details>
          </Card>
          <Maintenance c={c} onChange={load} />
        </div>
      </div>
    </div>
  );
}

function Back() {
  return <Link href="/hiring" className="inline-block text-sm font-medium text-violet-700 hover:underline">← All candidates</Link>;
}

function Card({ title, icon, children }: { title: string; icon?: "list"; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        {icon === "list" && <span className="text-violet-600">≡</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{children}</h3>;
}

function Brief({ c, onChange }: { c: CandidateView; onChange: () => Promise<unknown> }) {
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  async function generate() {
    setWorking(true);
    setMsg("");
    try {
      await call(`/api/hiring/candidates/${c.id}/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ what: "brief" }) });
      await onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setWorking(false);
  }

  return (
    <Card title="Interview brief">
      {c.status !== "scored" ? (
        <p className="text-sm text-slate-500">The brief appears after scoring.</p>
      ) : !c.brief ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">No brief yet. Briefs are written automatically for the shortlist; you can write one for anyone.</p>
          <button onClick={generate} disabled={working} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            {working ? "Writing…" : "Write the brief"}
          </button>
          {msg && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{msg}</p>}
        </div>
      ) : (
        <>
          <p className="leading-relaxed text-slate-800">{c.brief}</p>
          {c.probe && c.probe.length > 0 && (
            <>
              <Label>What to probe</Label>
              <ol className="divide-y divide-slate-100">
                {c.probe.map((p, i) => (
                  <li key={i} className="flex gap-3 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{i + 1}</span>
                    <div>
                      <p className="leading-relaxed">{p.question}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{p.criterion}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
          {c.unknowns && c.unknowns.length > 0 && (
            <>
              <Label>Unknowns</Label>
              <div className="flex flex-wrap gap-2">
                {c.unknowns.map((u) => (
                  <span key={u} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700">{u}</span>
                ))}
              </div>
            </>
          )}
          {c.risks && c.risks.length > 0 && (
            <>
              <Label>Risks noted in scoring</Label>
              <ul className="list-disc space-y-1 pl-5 text-slate-700">
                {c.risks.map((r) => (<li key={r}>{r}</li>))}
              </ul>
            </>
          )}
          {!c.sent_at && (
            <button onClick={generate} disabled={working} className="mt-4 text-xs text-slate-500 underline disabled:opacity-50">
              {working ? "Rewriting…" : "Rewrite the brief"}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function Email({ c, suggested, cfg, onChange }: { c: CandidateView; suggested: Kind; cfg: Config | null; onChange: () => Promise<unknown> }) {
  const [tab, setTab] = useState<Kind>(c.sent_kind ?? suggested);
  const kinds: Kind[] = ["invite", "decline"];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        {kinds.map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-white shadow-sm" : "text-slate-500"}`}>
            {KIND_LABEL[k]}
            {c.sent_kind === k && <span className="text-emerald-600"> · sent</span>}
            {!c.sent_at && k === suggested && <span className="ml-1.5 text-[10px] font-bold uppercase text-violet-500">suggested</span>}
          </button>
        ))}
      </div>
      {c.status !== "scored" ? (
        <p className="text-sm text-slate-500">Drafts appear after scoring.</p>
      ) : (
        <Draft key={`${tab}|${c.drafts[tab]?.subject}|${c.drafts[tab]?.body}|${c.email}|${c.sent_at}`} c={c} kind={tab} cfg={cfg} onChange={onChange} />
      )}
    </section>
  );
}

function Draft({ c, kind, cfg, onChange }: { c: CandidateView; kind: Kind; cfg: Config | null; onChange: () => Promise<unknown> }) {
  const draft = c.drafts[kind];
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [email, setEmail] = useState(c.email);
  const [working, setWorking] = useState("");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(false);
  const [receipt, setReceipt] = useState<{ sentTo: string; testMode: boolean; resendId: string | null } | null>(null);
  const dirty = subject !== (draft?.subject ?? "") || body !== (draft?.body ?? "") || email !== c.email;
  const sentHere = c.sent_kind === kind;
  const locked = !!c.sent_at;

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
  const json = (data: object) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const save = () =>
    call(`/api/hiring/candidates/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, subject, body, email }) });

  if (!draft) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">No {KIND_LABEL[kind].toLowerCase()} draft yet.</p>
        <button onClick={() => act("Writing…", () => call(`/api/hiring/candidates/${c.id}/draft`, json({ what: kind })))} disabled={!!working || locked} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {working || `Write the ${KIND_LABEL[kind].toLowerCase()} draft`}
        </button>
        {msg && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{msg}</p>}
      </div>
    );
  }

  const shownTo = cfg?.testMode ? `${cfg.testTarget} (test inbox)` : email;
  return (
    <div className="space-y-3">
      <Field label="To">
        <input value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} placeholder="No email found on this CV. Add one" className={`w-full rounded-xl border px-3 py-2 ${email ? "border-slate-300" : "border-rose-400"} disabled:bg-slate-50`} />
      </Field>
      <Field label="Subject">
        <input value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-50" />
      </Field>
      <Field label="Message">
        <textarea value={body} disabled={locked} onChange={(e) => setBody(e.target.value)} rows={12} className="w-full rounded-xl border border-slate-300 p-3 leading-relaxed disabled:bg-slate-50" />
      </Field>
      <p className="text-xs text-slate-400">{"{{first_name}}"} is replaced with the candidate&apos;s name when the email is sent.</p>
      {msg && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{msg}</p>}

      {!locked && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => act("Redrafting…", () => call(`/api/hiring/candidates/${c.id}/draft`, json({ what: kind })))} disabled={!!working} className="mr-auto text-xs text-slate-500 underline disabled:opacity-40">
            {working === "Redrafting…" ? "Redrafting…" : "Redraft with AI"}
          </button>
          <button onClick={() => act("Saving…", save)} disabled={!!working || !dirty} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">
            {working === "Saving…" ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => act("Saving…", async () => { if (dirty) await save(); setPreview(true); })}
            disabled={!!working || !email || !cfg?.sendingConfigured}
            title={!cfg?.sendingConfigured ? "RESEND_API_KEY is not set" : undefined}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
          >
            Preview {kind} →
          </button>
        </div>
      )}
      {!locked && cfg && !cfg.sendingConfigured && <p className="text-xs text-amber-700">Sending is switched off until RESEND_API_KEY is added in Vercel.</p>}

      {sentHere && c.sent_at && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">✓ {KIND_LABEL[kind]} sent{cfg?.testMode ? " (test mode)" : ""} · {fmtTime(c.sent_at)}</p>
          <p className="mt-1 break-all text-emerald-700">Sent to {c.sent_to}{receipt?.resendId ? ` · Resend id ${receipt.resendId}` : ""}</p>
        </div>
      )}
      {locked && !sentHere && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">A {c.sent_kind} was already sent to this candidate, so this draft is locked.</p>}

      {preview && (
        <Preview
          kind={kind}
          to={shownTo}
          intended={email}
          testMode={!!cfg?.testMode}
          subject={fill(cfg?.testMode ? `[to ${email}] ${subject}` : subject, c.name)}
          body={fill(body, c.name)}
          onClose={() => setPreview(false)}
          onSend={() =>
            act("Sending…", async () => {
              const r = await call<{ sentTo: string; testMode: boolean; resendId: string | null }>(`/api/hiring/candidates/${c.id}/send`, json({ kind }));
              setReceipt(r);
              setPreview(false);
            })
          }
          sending={working === "Sending…"}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Preview({ kind, to, intended, testMode, subject, body, onClose, onSend, sending }: {
  kind: Kind; to: string; intended: string; testMode: boolean; subject: string; body: string; onClose: () => void; onSend: () => void; sending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Preview · {KIND_LABEL[kind]}</h2>
        <p className="mt-1 text-sm text-slate-500">This is exactly what will be sent. Check it, then confirm.</p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2"><dt className="w-16 text-slate-500">To</dt><dd className="font-medium">{to}</dd></div>
          {testMode && <div className="flex gap-2"><dt className="w-16 text-slate-500" /><dd className="text-xs text-orange-700">Test mode: intended for {intended}, delivered to your test inbox instead.</dd></div>}
          <div className="flex gap-2"><dt className="w-16 text-slate-500">Subject</dt><dd className="font-medium">{subject}</dd></div>
        </dl>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans leading-relaxed">{body}</pre>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={sending} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">Back to edit</button>
          <button onClick={onSend} disabled={sending} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {sending ? "Sending…" : kind === "invite" ? "Confirm & send invite" : "Confirm & send decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Maintenance({ c, onChange }: { c: CandidateView; onChange: () => Promise<unknown> }) {
  const router = useRouter();
  const [working, setWorking] = useState("");
  const [msg, setMsg] = useState("");

  async function run(label: string, fn: () => Promise<unknown>) {
    setWorking(label);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
    setWorking("");
  }

  return (
    <Card title="Maintenance">
      <p className="text-sm text-slate-500">
        Re-run scoring from the saved CV, then rewrite the brief and drafts from the new scores.{c.sent_at ? " Anything already sent is kept." : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => run("Re-scoring…", async () => {
            await call(`/api/hiring/candidates/${c.id}/rescore`, { method: "POST" });
            await onChange();
            await reconcileAll();
            await onChange();
          })}
          disabled={!!working}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          ⟳ {working === "Re-scoring…" ? "Re-scoring…" : "Re-score"}
        </button>
        {!c.sent_at && (
          <button
            onClick={() => window.confirm(`Delete ${c.name}? This removes the candidate.`) && run("Deleting…", async () => {
              await call(`/api/hiring/candidates/${c.id}`, { method: "DELETE" });
              router.push("/hiring");
            })}
            disabled={!!working}
            className="text-sm text-rose-600 underline disabled:opacity-50"
          >
            Delete candidate
          </button>
        )}
      </div>
      {msg && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{msg}</p>}
    </Card>
  );
}
