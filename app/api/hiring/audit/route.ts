import { handle } from "@/lib/http";
import { listAudit } from "@/lib/hiring/audit";

export const GET = handle(async () => Response.json({ entries: await listAudit() }));
