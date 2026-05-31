import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("pcx_onboarded", "true", { path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
