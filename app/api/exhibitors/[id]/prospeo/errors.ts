import { NextResponse } from "next/server";
import { ProspeoError, ProspeoNotConfiguredError, ProspeoNotEnabledError } from "@/lib/prospeo/service";

/** Map Prospeo pilot failures to HTTP responses with a message the UI can show as-is. */
export function prospeoErrorResponse(error: unknown) {
  if (error instanceof ProspeoNotConfiguredError) {
    return NextResponse.json({ error: error.message, code: "NOT_CONFIGURED" }, { status: 503 });
  }
  if (error instanceof ProspeoNotEnabledError) {
    return NextResponse.json({ error: error.message, code: "NOT_ENABLED" }, { status: 403 });
  }
  if (error instanceof ProspeoError) {
    const messages: Record<string, string> = {
      INVALID_API_KEY: "Prospeo rejected the API key (INVALID_API_KEY). Check PROSPEO_API_KEY.",
      INSUFFICIENT_CREDITS: "The Prospeo account has no credits left (INSUFFICIENT_CREDITS).",
      PLAN_REQUIRED: "This Prospeo search needs a higher Prospeo plan (PLAN_REQUIRED).",
      RATE_LIMITED: "Prospeo's rate limit was hit repeatedly. Wait a minute and try again.",
    };
    return NextResponse.json(
      { error: messages[error.code] ?? error.message, code: error.code },
      { status: error.code === "RATE_LIMITED" ? 429 : 502 }
    );
  }
  console.error("Prospeo pilot request failed:", error);
  return NextResponse.json({ error: "Prospeo request failed", code: "UNKNOWN" }, { status: 500 });
}
