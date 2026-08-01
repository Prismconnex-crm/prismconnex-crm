import { NextResponse } from "next/server";
import { signLocalSession } from "@/lib/auth";

/**
 * Development-only shortcut: mints a session for any email with no password.
 *
 * Gated because real authentication now goes through Supabase Auth
 * (/api/auth/sign-in) — left ungated this would be a complete auth bypass in
 * production.
 */
export async function POST(request: Request) {
  // Cast: this project's types narrow NODE_ENV to "development" | "test", so a
  // direct literal comparison is rejected even though the value exists at runtime.
  if ((process.env.NODE_ENV as string) === "production") {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }

  const body = (await request.json()) as { email?: string };
  const email = body.email || "owner@prismconnex.demo";

  const token = await signLocalSession({
    sub: "demo-user",
    email,
    workspaceId: "demo-workspace",
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pcx_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set("pcx_onboarded", "false", { path: "/", maxAge: 60 * 60 * 8 });

  return response;
}
