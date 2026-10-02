-- Kargo hiring dashboard. Run once in the Supabase SQL editor.
-- Both tables are server-only: RLS is on with no policies, so the anon key can read nothing.
-- The app uses the secret (service-role) key from route handlers.

create table if not exists rubric_criteria (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('PM', 'SPM')),
  position    int  not null,
  name        text not null,
  description text not null,
  weight      int  not null check (weight between 1 and 100),
  unique (role, position)
);

create table if not exists candidates (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  file_name        text,
  applied_role     text not null check (applied_role in ('PM', 'SPM')),
  -- {name, email, phone}. Never sent to any AI step.
  personal_details jsonb not null,
  -- The CV with name, email, phone and profile links removed. The only thing AI sees.
  cv_content       text not null,
  status           text not null default 'processing' check (status in ('processing', 'scored', 'failed')),
  error            text,
  -- {PM: {total, criteria: [{name, weight, score, reason}]}, SPM: {...}}
  scores           jsonb,
  score_pm         numeric,
  score_spm        numeric,
  brief            text,
  email_type       text check (email_type in ('invite', 'rejection')),
  email_subject    text,
  email_body       text,
  -- true once the founder has chosen the email type himself, so re-ranking never overwrites it
  email_override   boolean not null default false,
  sent_at          timestamptz,
  sent_to          text,
  resend_id        text
);

create index if not exists candidates_role_idx on candidates (applied_role);

alter table rubric_criteria enable row level security;
alter table candidates enable row level security;
