import { fail, handle, isUuid } from "@/lib/http";
import { scoreAndSave } from "@/lib/hiring/pipeline";

export const maxDuration = 60;

// POST: retry scoring for a candidate whose first attempt failed (e.g. a model hiccup).
export const POST = handle(async (_req, ctx: RouteContext<"/api/hiring/candidates/[id]/rescore">) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) fail(404, "Candidate not found");
  await scoreAndSave(id);
  return Response.json({ ok: true });
});
