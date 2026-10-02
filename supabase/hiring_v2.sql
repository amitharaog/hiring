-- Kargo hiring dashboard v2. Run once in the Supabase SQL editor (safe to re-run).
-- Adds: structured interview brief (probe questions, unknowns, risks), an invite AND a decline draft
-- per candidate, which one was sent, and an audit log of every action.

alter table candidates add column if not exists probe     jsonb;                 -- [{question, criterion}]
alter table candidates add column if not exists unknowns  jsonb;                 -- [text]
alter table candidates add column if not exists risks     jsonb;                 -- [text]
alter table candidates add column if not exists drafts    jsonb not null default '{}'::jsonb; -- {invite:{subject,body}, decline:{subject,body}}
alter table candidates add column if not exists sent_kind text check (sent_kind in ('invite', 'decline'));

create table if not exists audit_log (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  candidate_id   uuid,            -- no foreign key on purpose: the trail outlives a deleted candidate
  candidate_name text,
  action         text not null,
  detail         text
);
create index if not exists audit_log_candidate_idx on audit_log (candidate_id, created_at desc);
alter table audit_log enable row level security;
