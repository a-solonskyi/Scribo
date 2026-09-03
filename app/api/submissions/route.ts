import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { errorResponse, readJsonObject, stringValue } from "@/lib/server/data";

function jsonText(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function firstForwardedAddress(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function detectOperatingSystem(userAgent: string | null) {
  if (!userAgent) return null;

  const ipad = userAgent.match(/(?:CPU OS|iPad; CPU OS) ([\d_]+)/i);
  if (ipad) return `iPadOS ${ipad[1].replaceAll("_", ".")}`;

  const iphone = userAgent.match(/iPhone OS ([\d_]+)/i);
  if (iphone) return `iOS ${iphone[1].replaceAll("_", ".")}`;

  const android = userAgent.match(/Android ([\d.]+)/i);
  if (android) return `Android ${android[1]}`;

  const windows = userAgent.match(/Windows NT ([\d.]+)/i);
  if (windows) {
    const names: Record<string, string> = {
      "10.0": "Windows 10 or 11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    return names[windows[1]] || `Windows NT ${windows[1]}`;
  }

  const mac = userAgent.match(/Mac OS X ([\d_]+)/i);
  if (mac) return `macOS ${mac[1].replaceAll("_", ".")}`;

  if (/CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}

function getDeviceInfo(request: Request) {
  const headers = request.headers;
  const ip =
    firstForwardedAddress(headers.get("cf-connecting-ip")) ||
    firstForwardedAddress(headers.get("x-real-ip")) ||
    firstForwardedAddress(headers.get("x-forwarded-for"));
  const country = headers.get("cf-ipcountry")?.trim().toUpperCase() || null;

  return {
    ip,
    country,
    operatingSystem: detectOperatingSystem(headers.get("user-agent")),
  };
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const stats = objectValue(body.stats_json);
  const assignmentId = stringValue(body.assignment_id);
  const studentName = stringValue(body.student_name).trim();
  const finalText = stringValue(body.final_text);
  if (!assignmentId || !studentName || !finalText.trim()) {
    return errorResponse("Student name and essay text are required.");
  }
  if (studentName.length > 180 || finalText.length > 150000) {
    return errorResponse("Submission is too large.", 413);
  }

  const [assignment] = await getDb().select({ id: assignments.id })
    .from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment) return errorResponse("Essay link is no longer available.", 404);

  await getDb().insert(submissions).values({
    id: crypto.randomUUID(),
    assignmentId,
    studentName,
    finalText,
    title: stringValue(body.title).slice(0, 240) || null,
    statsJson: jsonText({ ...stats, deviceInfo: getDeviceInfo(request) }, {}),
    eventLogJson: jsonText(body.event_log_json, []),
    pasteEventsJson: jsonText(body.paste_events_json, []),
    pauseEventsJson: jsonText(body.pause_events_json, []),
    submittedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true }, { status: 201 });
}
