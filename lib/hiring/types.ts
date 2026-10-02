import type { Role } from "./rubric-data";
export type { Role };

export type CriterionScore = { name: string; weight: number; score: number; reason: string };
export type RoleScore = { total: number; criteria: CriterionScore[] };
export type Scores = Record<Role, RoleScore>;

/** What the dashboard receives for each candidate. */
export type CandidateView = {
  id: string;
  created_at: string;
  file_name: string | null;
  applied_role: Role;
  name: string;
  email: string;
  status: "processing" | "scored" | "failed";
  error: string | null;
  scores: Scores | null;
  score_pm: number | null;
  score_spm: number | null;
  brief: string | null;
  email_type: "invite" | "rejection" | null;
  email_subject: string | null;
  email_body: string | null;
  sent_at: string | null;
  sent_to: string | null;
  cv_content: string;
};
