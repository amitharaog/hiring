import { handle } from "@/lib/http";

// What the sidebar needs to show: are emails going to a test inbox or to real candidates?
export const GET = handle(async () => {
  const to = process.env.RESEND_TEST_RECIPIENT?.trim();
  const masked = to ? to.replace(/^(.).*(@.*)$/, "$1•••$2") : null;
  return Response.json({ testMode: !!to, testTarget: masked, sendingConfigured: !!process.env.RESEND_API_KEY });
});
