import { createHash } from "node:crypto";
import { db } from "@/lib/supabase";
import { fail, handle, isUuid } from "@/lib/http";
import { getRow } from "@/lib/hiring/pipeline";

// POST /api/hiring/candidates/:id/send
// The only place an email leaves the system, and only when the founder clicks Confirm.
export const POST = handle(async (_req, ctx: RouteContext<"/api/hiring/candidates/[id]/send">) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  const row = await getRow(id);

  if (row.sent_at) fail(409, "Already sent");
  if (!row.email_subject || !row.email_body) fail(409, "No draft yet. Wait for drafts to finish generating.");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) fail(503, "RESEND_API_KEY is not set");
  const real = row.personal_details.email;
  if (!real) fail(422, "This candidate has no email address. Add one on the card first.");

  // Safety valve for tests: send everything to one inbox instead of the candidate's address.
  const override = process.env.RESEND_TEST_RECIPIENT?.trim();
  const to = override || real;
  const subject = override ? `[to ${real}] ${row.email_subject}` : row.email_subject;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      // A double-click or retry of the same email can never produce a second one. The content is
      // part of the key because Resend rejects a reused key whose payload changed (fix address, retry).
      "idempotency-key": `kargo-hiring-${row.id}-${createHash("sha1").update(`${to}\n${subject}\n${row.email_body}`).digest("hex").slice(0, 16)}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Arjun at Kargo <onboarding@resend.dev>",
      to: [to],
      subject,
      text: row.email_body,
      ...(process.env.HIRING_REPLY_TO ? { reply_to: process.env.HIRING_REPLY_TO } : {}),
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) fail(502, `Resend: ${out?.message ?? res.status}`);

  const { error } = await db()
    .from("candidates")
    .update({ sent_at: new Date().toISOString(), sent_to: to, resend_id: out.id ?? null })
    .eq("id", row.id);
  if (error) throw error;
  return Response.json({ ok: true, sentTo: to });
});
