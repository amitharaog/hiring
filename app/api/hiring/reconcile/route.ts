import { handle } from "@/lib/http";
import { reconcile } from "@/lib/hiring/pipeline";

export const maxDuration = 60;

// POST /api/hiring/reconcile
// Generates the next batch of briefs and draft emails for the current ranking.
// Returns {done, failed, remaining}; call again while remaining > 0 and done > 0.
export const POST = handle(async () => Response.json(await reconcile()));
