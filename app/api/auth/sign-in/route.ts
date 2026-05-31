import { NextResponse } from "next/server";
import { signLocalSession } from "@/lib/auth";

export async function POST(request: Request) {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email || "owner@prismconnex.demo";

    // For MVP demo: sign a local session JWT (no real Cognito verification yet)
    const token = await signLocalSession({
        sub: "demo-user",
        email,
        workspaceId: "demo-workspace",
    });

    const response = NextResponse.json({ ok: true, onboarded: false });
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
