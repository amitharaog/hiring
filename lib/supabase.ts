import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only: uses the secret key, which bypasses RLS. Never import this from
// a client component — the "server-only" import makes that a build error.
let client: SupabaseClient | null = null;

export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
