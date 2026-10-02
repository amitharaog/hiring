import { createHash } from "node:crypto";
import { db } from "@/lib/supabase";
import { fail, handle, isUuid, readJson } from "@/lib/http";
import { audit } from "@/lib/hiring/audit";
import { fillName, getRow } from "@/lib/hiring/pipeline";

// POST /api/hiring/candidates/:id/send   {kind: "invite" | "decline"}
// The only place an email leaves the system, and only when the founder confirms in the preview.
export const POST = handle(async (req, ctx: RouteContext<"/api/hiring/candidates/[id]/send">) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  const { kind } = await readJson(req);
  if (kind !== "invite" && kind !== "decline") fail(400, "kind must be invite or decline");
  const row = await getRow(id);

  if (row.sent_at) fail(409, "Already sent");
  const draft = row.drafts?.[kind];
  if (!draft?.subject || !draft?.body) fail(409, "No draft yet. Generate it first.");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) fail(503, "RESEND_API_KEY is not set");
  const real = row.personal_details.email;
  if (!real) fail(422, "This candidate has no email address. Add one first.");

  // Test mode: send everything to one inbox instead of the candidate's address.
  const testTo = process.env.RESEND_TEST_RECIPIENT?.trim();
  const to = testTo || real;
  const name = row.personal_details.name;
  const subject = fillName(testTo ? `[to ${real}] ${draft.subject}` : draft.subject, name);
  const text = fillName(draft.body, name);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      // A double-click or retry of the same email can never produce a second one. The content is
      // part of the key because Resend rejects a reused key whose payload changed (fix address, retry).
      "idempotency-key": `kargo-hiring-${row.id}-${createHash("sha1").update(`${kind}\n${to}\n${subject}\n${text}`).digest("hex").slice(0, 16)}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Arjun at Kargo <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
      ...(process.env.HIRING_REPLY_TO ? { reply_to: process.env.HIRING_REPLY_TO } : {}),
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    await audit(row.id, name, "send_failed", `${kind}: ${out?.message ?? res.status}`);
    fail(502, `Resend: ${out?.message ?? res.status}`);
  }

  const { error } = await db()
    .from("candidates")
    .update({ sent_at: new Date().toISOString(), sent_kind: kind, sent_to: to, resend_id: out.id ?? null })
    .eq("id", row.id);
  if (error) throw error;
  await audit(row.id, name, kind === "invite" ? "invite_sent" : "decline_sent", `${testTo ? "test mode · " : ""}to ${to} · Resend ${out.id ?? ""}`);
  return Response.json({ ok: true, sentTo: to, testMode: !!testTo, resendId: out.id ?? null });
});
