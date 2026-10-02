import { db } from "@/lib/supabase";
import { fail, handle, isUuid, readJson } from "@/lib/http";
import { generateEmail, getRow } from "@/lib/hiring/pipeline";

export const maxDuration = 60;

async function load(ctx: RouteContext<"/api/hiring/candidates/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  const row = await getRow(id);
  return row;
}

// PATCH /api/hiring/candidates/:id
//   {subject?, body?, email?}   save the founder's edits to the draft or the recipient
//   {switchTo: "invite" | "rejection"}   redraft as the other kind; the choice then sticks
export const PATCH = handle(async (req, ctx: RouteContext<"/api/hiring/candidates/[id]">) => {
  const row = await load(ctx);
  if (row.sent_at) fail(409, "Already sent");
  const b = await readJson(req);

  if (b.switchTo !== undefined) {
    if (b.switchTo !== "invite" && b.switchTo !== "rejection") fail(400, "switchTo must be invite or rejection");
    const e = await generateEmail(row, b.switchTo);
    const { error } = await db()
      .from("candidates")
      .update({ email_type: b.switchTo, email_subject: e.subject, email_body: e.body, email_override: true })
      .eq("id", row.id);
    if (error) throw error;
    return Response.json({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  if (typeof b.subject === "string") patch.email_subject = b.subject.slice(0, 300);
  if (typeof b.body === "string") patch.email_body = b.body.slice(0, 5000);
  if (typeof b.email === "string") {
    const email = b.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "That doesn't look like an email address");
    patch.personal_details = { ...row.personal_details, email };
  }
  if (!Object.keys(patch).length) fail(400, "Nothing to save");
  const { error } = await db().from("candidates").update(patch).eq("id", row.id).is("sent_at", null);
  if (error) throw error;
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req, ctx: RouteContext<"/api/hiring/candidates/[id]">) => {
  const row = await load(ctx);
  const { error } = await db().from("candidates").delete().eq("id", row.id);
  if (error) throw error;
  return Response.json({ ok: true });
});
