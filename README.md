# Kargo hiring dashboard

Built for MESA Case 2 (Arjun and the Hiring Backlog).

**Flow:** upload CVs (`/hiring/upload`) → each CV is split into personal details and anonymised content → the anonymised content is scored against the PM and SPM rubrics → candidates are ranked per applied role on `/hiring` → the top 5 per role get a 3-sentence interview brief and an invite draft, everyone else a rejection draft → **Arjun reads, edits, and clicks Confirm & send.** Nothing is ever sent automatically (Nine Checks 06 and 09: no auto-rejection).

## Privacy
- `lib/hiring/pii.ts` pulls name, email, phone and profile links out of the CV with deterministic code, not an LLM. They are stored in `candidates.personal_details` and never leave the database except to address the email. Every Gemini call receives only `cv_content` (check the "Anonymised CV text" panel on a card).
- Use a Gemini key from a project **with billing enabled**; the free AI Studio tier may use prompts to improve Google's models.
- RLS is on for both tables with no policies, so the anon key reads nothing. The app uses the secret key from route handlers only. Set `DASHBOARD_PASSWORD` on any public deploy; `proxy.ts` then guards `/hiring` and `/api/hiring` with Basic auth.

## Setup
1. Run `supabase/hiring.sql` in the Supabase SQL editor. (Already ran the first version? Run `supabase/hiring_v2.sql` instead; it adds the brief, draft and audit-log columns and is safe to re-run.) The rubric (`lib/hiring/rubric-data.ts`, mirrored in `rubric.txt`) loads into `rubric_criteria` automatically on first use.
2. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `DASHBOARD_PASSWORD`. Leave `RESEND_API_KEY` blank until the Resend step.
3. `npm run dev`, then open `/hiring/upload`. Add the same variables in Vercel and deploy.
4. Resend: set `RESEND_API_KEY` (and redeploy). Until you verify a domain, Resend only delivers to your own account email from `onboarding@resend.dev`; set `RESEND_TEST_RECIPIENT` to route every email to one test inbox (the subject shows the intended recipient).

## Scoring
Each criterion is scored 0-10 by Gemini from evidence in the CV. The weighted 0-100 total is computed in code (`toRoleScore`), never by the model. Every candidate is scored against both rubrics; ranking uses the rubric of the role they applied for. `SHORTLIST_SIZE` (default 5) sets the line.

## Rubric
`rubric.txt` was derived from Kargo's 8 hire CVs and their ratings, not the JDs. Three patterns separated the five "Exceeds" hires from the three "Meets/Below": hands-on operator time in freight/logistics, an unprompted fix that others adopted, and sole ownership with no one above. A fourth, failure on the record, separates the two hires who documented failures from three CVs that list only wins. The hire files contained CVs only (no interview notes or outcome one-liners), so the patterns come from the CVs plus the ratings table.

## Deploying to Vercel
Import this repo, set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` and `DASHBOARD_PASSWORD` under Environment Variables, and deploy. The framework is detected as Next.js; no build settings need changing. After the first deploy, open `/hiring/upload` and sign in with `DASHBOARD_PASSWORD` (any username).
