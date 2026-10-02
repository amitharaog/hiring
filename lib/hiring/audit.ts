import "server-only";
import { db } from "@/lib/supabase";
import type { AuditEntry } from "./types";

/** Records who/what/when. Never throws: a logging hiccup must not block the action itself. */
export async function audit(candidateId: string | null, name: string | null, action: string, detail?: string) {
  const { error } = await db()
    .from("audit_log")
    .insert({ candidate_id: candidateId, candidate_name: name, action, detail: detail ?? null });
  if (error) console.error("audit log failed:", error.message);
}

export async function listAudit(candidateId?: string, limit = 500): Promise<AuditEntry[]> {
  let q = db().from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (candidateId) q = q.eq("candidate_id", candidateId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}
