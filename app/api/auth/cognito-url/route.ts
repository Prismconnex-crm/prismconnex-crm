import { NextResponse } from "next/server";
import { buildCognitoHostedUiUrl } from "@/lib/auth";

export async function GET() {
  const url = buildCognitoHostedUiUrl();
  if (!url) {
    return NextResponse.redirect(new URL("/auth/sign-in", process.env.COGNITO_REDIRECT_URI || "http://localhost:3000"));
  }
  return NextResponse.redirect(url);
}
