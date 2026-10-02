import { db } from "@/lib/supabase";
import { fail, handle, isUuid, readJson } from "@/lib/http";
import { audit } from "@/lib/hiring/audit";
import { generateBrief, generateEmail, getRow, saveDraft } from "@/lib/hiring/pipeline";

export const maxDuration = 60;

// POST {what: "brief" | "invite" | "decline"}  (re)generate one piece on demand from the candidate page.
export const POST = handle(async (req, ctx: RouteContext<"/api/hiring/candidates/[id]/draft">) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  const row = await getRow(id);
  if (row.status !== "scored") fail(409, "Score this candidate first");
  if (row.sent_at) fail(409, "Already sent");
  const { what } = await readJson(req);

  if (what === "brief") {
    const b = await generateBrief(row);
    const { error } = await db()
      .from("candidates")
      .update({ brief: b.brief, probe: b.probe, unknowns: b.unknowns, risks: b.risks })
      .eq("id", row.id)
      .is("sent_at", null);
    if (error) throw new Error(`Could not save the brief: ${error.message}`);
    await audit(row.id, row.personal_details.name, "brief_written", "on demand");
  } else if (what === "invite" || what === "decline") {
    await saveDraft(row, what, await generateEmail(row, what), "draft_written");
  } else {
    fail(400, "what must be brief, invite or decline");
  }
  return Response.json({ ok: true });
});
