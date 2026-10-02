import type { CandidateView, Kind, Role } from "@/lib/hiring/types";

export const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };
export const SHORT: Record<string, string> = {
  "Floor-Level Operator Time": "Operator",
  "Unprompted Fix That Others Adopted": "Fixes",
  "Owned It With No One Above": "Ownership",
  "Failure On The Record": "Failures",
};
export const roleScore = (c: CandidateView, role: Role) => (role === "PM" ? c.score_pm : c.score_spm);
export const tone = (n: number) =>
  n >= 70 ? "bg-emerald-100 text-emerald-800" : n >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
export const barTone = (n: number) => (n >= 7 ? "bg-emerald-500" : n >= 5 ? "bg-amber-500" : "bg-rose-500");
export const KIND_LABEL: Record<Kind, string> = { invite: "Interview invite", decline: "Decline" };

/** Candidates of one role, best score first; unscored (processing / failed) at the bottom. */
export function rankRole(all: CandidateView[], role: Role) {
  return all
    .filter((c) => c.applied_role === role)
    .sort((a, b) => {
      const sa = a.status === "scored" ? roleScore(a, role) ?? 0 : -1;
      const sb = b.status === "scored" ? roleScore(b, role) ?? 0 : -1;
      return sb - sa || a.created_at.localeCompare(b.created_at);
    });
}

export type Stage = "scoring" | "failed" | "drafting" | "review" | "sent";
export function stageOf(c: CandidateView, suggested: Kind): Stage {
  if (c.status === "failed") return "failed";
  if (c.status === "processing") return "scoring";
  if (c.sent_at) return "sent";
  return c.drafts[suggested] ? "review" : "drafting";
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const ACTION_LABEL: Record<string, string> = {
  uploaded: "CV uploaded",
  scored: "Scored",
  scoring_failed: "Scoring failed",
  rescored: "Re-scored",
  brief_written: "Interview brief written",
  draft_written: "Email draft written",
  draft_edited: "Draft edited",
  recipient_edited: "Recipient changed",
  invite_sent: "Interview invite sent",
  decline_sent: "Decline sent",
  send_failed: "Send failed",
  deleted: "Candidate deleted",
  cleared_all: "All candidates cleared",
};
