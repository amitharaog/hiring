import { handle } from "@/lib/http";
import { listAudit } from "@/lib/hiring/audit";

export const GET = handle(async () => {
  try {
    return Response.json({ entries: await listAudit() });
  } catch (e) {
    const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    if (/audit_log/.test(m)) throw new Error("The audit_log table is missing. Run supabase/hiring_v2.sql in the Supabase SQL editor.");
    throw e;
  }
});
