import { db } from "@/lib/supabase";
import { fail, handle, isUuid } from "@/lib/http";
import { audit } from "@/lib/hiring/audit";
import { getRow, scoreAndSave } from "@/lib/hiring/pipeline";

export const maxDuration = 60;

// POST: score again and clear the generated brief and drafts so they are rewritten from the new scores.
// Anything already sent is left alone.
export const POST = handle(async (_req, ctx: RouteContext<"/api/hiring/candidates/[id]/rescore">) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  const row = await getRow(id);
  await scoreAndSave(id);
  if (!row.sent_at) {
    const { error } = await db()
      .from("candidates")
      .update({ brief: null, probe: null, unknowns: null, risks: null, drafts: {} })
      .eq("id", id)
      .is("sent_at", null);
    if (error) throw error;
  }
  await audit(id, row.personal_details.name, "rescored");
  return Response.json({ ok: true });
});
