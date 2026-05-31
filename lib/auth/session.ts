import { cookies } from "next/headers";
import { verifyCognitoToken } from "./cognito";

export const SESSION_COOKIE_NAME = "pcx_session";

export async function setSessionCookie(token: string) {
    cookies().set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
    });
}

export function clearSessionCookie() {
    cookies().delete(SESSION_COOKIE_NAME);
}

export async function getSessionPayload() {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifyCognitoToken(token);
    return payload;
}
