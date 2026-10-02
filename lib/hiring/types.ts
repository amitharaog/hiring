import type { Role } from "./rubric-data";
export type { Role };

export type CriterionScore = { name: string; weight: number; score: number; reason: string };
export type RoleScore = { total: number; criteria: CriterionScore[] };
export type Scores = Record<Role, RoleScore>;

export type Kind = "invite" | "decline";
export type Draft = { subject: string; body: string };
export type Drafts = Partial<Record<Kind, Draft>>;
export type Probe = { question: string; criterion: string };

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
  probe: Probe[] | null;
  unknowns: string[] | null;
  risks: string[] | null;
  drafts: Drafts;
  sent_kind: Kind | null;
  sent_at: string | null;
  sent_to: string | null;
  cv_content: string;
};

export type AuditEntry = {
  id: number;
  created_at: string;
  candidate_id: string | null;
  candidate_name: string | null;
  action: string;
  detail: string | null;
};
