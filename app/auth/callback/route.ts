import { NextResponse } from "next/server";
import { signLocalSession } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  // Placeholder exchange flow. Wire Cognito token endpoint in production.
  const token = await signLocalSession({
    sub: code || "cognito-user",
    email: "owner@prismconnex.demo",
    workspaceId: "demo-workspace",
  });

  const response = NextResponse.redirect(new URL("/onboarding", request.url));
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
