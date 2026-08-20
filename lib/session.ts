import { cookies } from "next/headers";
import { verifyCognitoJwt, verifyLocalSession } from "@/lib/auth";
import { isSessionRevoked } from "@/lib/auth/session-revocation";

export async function requireSession() {
  const token = cookies().get("pcx_session")?.value;
  if (!token) return null;

  try {
    const session = await verifyLocalSession(token);

    // Unlike resolveTenant() this reader loads no User row, so the revocation
    // stamp has to be fetched. Without it /api/export/*, /api/import and
    // /api/auth/me would still answer a cookie a password reset had retired.
    if (await isSessionRevoked(session)) return null;

    return session;
  } catch {
    try {
      const payload = await verifyCognitoJwt(token);
      if (!payload) return null;
      return {
        sub: String(payload.sub || ""),
        email: String(payload.email || ""),
        workspaceId: String(payload["custom:workspaceId"] || "default"),
      };
    } catch {
      return null;
    }
  }
}
