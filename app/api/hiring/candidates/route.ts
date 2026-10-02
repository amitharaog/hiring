import { db } from "@/lib/supabase";
import { fail, handle } from "@/lib/http";
import { SHORTLIST_SIZE, ingestCv, listCandidates } from "@/lib/hiring/pipeline";

// A single upload reads, anonymises and scores one CV, which is a few seconds of model time.
export const maxDuration = 60;

export const GET = handle(async () => {
  return Response.json({ candidates: await listCandidates(), shortlistSize: SHORTLIST_SIZE });
});

// POST /api/hiring/candidates   multipart: file, role (PM | SPM)
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  const role = form.get("role");
  if (!(file instanceof File) || file.size === 0) fail(400, "Choose a CV file");
  if (role !== "PM" && role !== "SPM") fail(400, "Choose the role this person applied for");
  if (file.size > 8 * 1024 * 1024) fail(413, `${file.name} is over 8 MB`);
  return Response.json(await ingestCv(file, role));
});

// DELETE /api/hiring/candidates   removes every candidate (the rubric is kept). Used by "Clear all".
export const DELETE = handle(async () => {
  const { error, count } = await db()
    .from("candidates")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
  return Response.json({ deleted: count ?? 0 });
});
