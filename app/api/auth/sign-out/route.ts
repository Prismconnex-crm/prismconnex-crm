import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("pcx_session", "", { path: "/", maxAge: 0 });
  response.cookies.set("pcx_onboarded", "", { path: "/", maxAge: 0 });
  return response;
}
