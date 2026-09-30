import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { backupAuthorized, createDatabaseBackup, backupResponse } from "@/src/utils/databaseBackup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuration = env as unknown as Record<string, string>;
  if (!await backupAuthorized(request, configuration.SCRIBO_BACKUP_EXPORT_HASH, configuration.SCRIBO_BACKUP_EXPORT_EXPIRES_AT)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return backupResponse(await createDatabaseBackup(getRawDb(), "appgprj_6a96af394d1481919c3dd06d43baef4c"));
  } catch {
    // Never print record contents or credentials, and never deliver a partial
    // snapshot as a successful backup. Export has no production write path.
    return Response.json({ error: "A complete snapshot could not be created. No database records were changed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
