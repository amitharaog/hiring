import { db } from "@/lib/supabase";
import { fail, handle, isUuid, readJson } from "@/lib/http";
import { audit, listAudit } from "@/lib/hiring/audit";
import { getRow, toView } from "@/lib/hiring/pipeline";

async function load(ctx: RouteContext<"/api/hiring/candidates/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  return getRow(id);
}

// GET: the candidate plus their decision history.
export const GET = handle(async (_req, ctx: RouteContext<"/api/hiring/candidates/[id]">) => {
  const row = await load(ctx);
  return Response.json({ candidate: toView(row), history: await listAudit(row.id, 100) });
});

// PATCH {kind, subject?, body?}  save edits to one draft;  {email}  fix the recipient address.
export const PATCH = handle(async (req, ctx: RouteContext<"/api/hiring/candidates/[id]">) => {
  const row = await load(ctx);
  if (row.sent_at) fail(409, "Already sent");
  const b = await readJson(req);
  const patch: Record<string, unknown> = {};

  if (b.kind !== undefined) {
    if (b.kind !== "invite" && b.kind !== "decline") fail(400, "kind must be invite or decline");
    const cur = row.drafts?.[b.kind];
    if (!cur) fail(409, "That draft doesn't exist yet");
    patch.drafts = {
      ...row.drafts,
      [b.kind]: {
        subject: typeof b.subject === "string" ? b.subject.slice(0, 300) : cur.subject,
        body: typeof b.body === "string" ? b.body.slice(0, 5000) : cur.body,
      },
    };
  }
  if (typeof b.email === "string") {
    const email = b.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "That doesn't look like an email address");
    patch.personal_details = { ...row.personal_details, email };
  }
  if (!Object.keys(patch).length) fail(400, "Nothing to save");
  const { error } = await db().from("candidates").update(patch).eq("id", row.id).is("sent_at", null);
  if (error) throw error;
  await audit(row.id, row.personal_details.name, patch.drafts ? "draft_edited" : "recipient_edited", String(b.kind ?? "email"));
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req, ctx: RouteContext<"/api/hiring/candidates/[id]">) => {
  const row = await load(ctx);
  const { error } = await db().from("candidates").delete().eq("id", row.id);
  if (error) throw error;
  await audit(row.id, row.personal_details.name, "deleted");
  return Response.json({ ok: true });
});
